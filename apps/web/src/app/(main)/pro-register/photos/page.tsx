'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, X, Crop, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

/* ─── Face Detection ─── */
async function detectFace(imageSrc: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      // Try browser FaceDetector API first
      if ('FaceDetector' in window) {
        try {
          // @ts-ignore - FaceDetector is experimental
          const detector = new window.FaceDetector();
          const faces = await detector.detect(img);
          resolve(faces.length > 0);
          return;
        } catch {}
      }
      // Fallback: canvas-based skin color heuristic
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      let skinPixels = 0;
      const total = size * size;
      // Simple skin color detection (YCbCr range)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;
        if (y > 80 && cb > 85 && cb < 135 && cr > 135 && cr < 180) skinPixels++;
      }
      // If >8% skin-colored pixels in upper 60% of image, likely has face
      const upperData = ctx.getImageData(0, 0, size, Math.floor(size * 0.6)).data;
      let upperSkin = 0;
      for (let i = 0; i < upperData.length; i += 4) {
        const r = upperData[i], g = upperData[i + 1], b = upperData[i + 2];
        const cb = 128 - 0.169 * r - 0.331 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.419 * g - 0.081 * b;
        const y2 = 0.299 * r + 0.587 * g + 0.114 * b;
        if (y2 > 80 && cb > 85 && cb < 135 && cr > 135 && cr < 180) upperSkin++;
      }
      resolve(upperSkin / (size * size * 0.6) > 0.08);
    };
    img.onerror = () => resolve(true); // 에러 시 통과
    img.src = imageSrc;
  });
}

/* ─── Crop Helper ─── */
function getCroppedImg(imageSrc: string, crop: Area): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.src = imageSrc;
  });
}

export default function PhotosPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proRegister_photos');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop state
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropFor, setCropFor] = useState<'new' | number>('new');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const ASPECT_OPTIONS = [
    { label: '1:1', value: 1 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '자유', value: 0 },
  ];

  // Face detection
  const [faceError, setFaceError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    localStorage.setItem('proRegister_photos', JSON.stringify(photos));
  }, [photos]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleAddPhoto = () => {
    fileInputRef.current?.click();
  };

  const [pendingFiles, setPendingFiles] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // 1장이면 바로 크롭, 여러 장이면 크롭 없이 바로 추가
    if (imageFiles.length === 1) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropImage(reader.result as string);
        setCropFor('new');
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setAspect(1);
        setFaceError('');
      };
      reader.readAsDataURL(imageFiles[0]);
    } else {
      // 여러 장: 전부 읽어서 바로 추가
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPhotos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const handleCropSave = async () => {
    if (!cropImage || !croppedArea) return;
    const cropped = await getCroppedImg(cropImage, croppedArea);

    // If this will be the main photo (index 0 or setting as main), check face
    const willBeMain = cropFor === 'new' ? photos.length === 0 : cropFor === 0;
    if (willBeMain) {
      setChecking(true);
      const hasFace = await detectFace(cropped);
      setChecking(false);
      if (!hasFace) {
        setFaceError('대표 사진에는 얼굴이 포함된 사진을 등록해주세요');
        return;
      }
    }

    if (cropFor === 'new') {
      setPhotos(prev => [...prev, cropped]);
    } else {
      setPhotos(prev => prev.map((p, i) => i === cropFor ? cropped : p));
    }
    setCropImage(null);
    setFaceError('');
  };

  const handleSetMain = async (index: number) => {
    // Check face for new main photo
    setChecking(true);
    const hasFace = await detectFace(photos[index]);
    setChecking(false);
    if (!hasFace) {
      setFaceError('대표 사진에는 얼굴이 포함된 사진만 설정할 수 있습니다');
      setTimeout(() => setFaceError(''), 3000);
      return;
    }
    setMainPhotoIndex(index);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    if (mainPhotoIndex === index) setMainPhotoIndex(0);
    else if (mainPhotoIndex > index) setMainPhotoIndex(mainPhotoIndex - 1);
  };

  const handleEditCrop = (index: number) => {
    setCropImage(photos[index]);
    setCropFor(index);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(1);
    setFaceError('');
  };

  const handleNext = () => {
    if (photos.length < 4) return;
    router.push('/pro-register/pricing');
  };

  const isValid = photos.length >= 4;

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* Header — fixed */}
      <div className="shrink-0 px-6 pt-4 pb-4 relative z-10">
        <motion.button onClick={() => router.back()} className="mb-4" whileTap={{ scale: 0.9 }}>
          <ChevronLeft size={24} className="text-gray-900" />
        </motion.button>
        {/* Progress bar */}
        <div className="relative h-[3px] bg-gray-100 rounded-full overflow-hidden mb-2">
          <motion.div
            className="absolute left-0 top-0 h-full bg-[#3180F7] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(5 / 7) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-2xl font-bold text-gray-900 mb-2">
          프로필사진 <span className="text-[11px] text-gray-400">5/7</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="text-sm text-gray-400">
          대표 사진은 얼굴이 포함된 사진만 등록 가능합니다
        </motion.p>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="text-sm text-gray-400">
          [필수] 4장 이상 등록 시 다음 버튼이 활성화됩니다
        </motion.p>
      </div>

      {/* Face error toast */}
      <AnimatePresence>
        {faceError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-red-500 text-white px-5 py-3 rounded-full shadow-lg z-50 flex items-center gap-2"
          >
            <AlertCircle size={16} />
            <p className="text-sm font-medium">{faceError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photos Grid — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Add Photo Button */}
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleAddPhoto}
            className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-[#3180F7] hover:bg-blue-50/30 transition-colors"
          >
            <Plus size={28} className="text-gray-400" />
            <span className="text-[12px] text-gray-400 font-medium">{photos.length}/4+</span>
          </motion.button>

          {/* Photo Items */}
          {photos.map((photo, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + index * 0.05 }}
              className="aspect-square relative rounded-2xl overflow-hidden group"
            >
              {/* 대표 라벨 */}
              <AnimatePresence>
                {mainPhotoIndex === index && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute top-2.5 left-2.5 bg-[#3180F7] text-white text-[11px] px-2.5 py-1 rounded-full z-10 font-bold"
                  >
                    대표
                  </motion.div>
                )}
              </AnimatePresence>

              <img src={photo} alt={`Profile ${index + 1}`} className="w-full h-full object-cover" />

              {/* Overlay actions */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-2.5 gap-2 opacity-0 group-hover:opacity-100">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSetMain(index)}
                  className="px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-gray-700"
                >
                  대표설정
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleEditCrop(index)}
                  className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center"
                >
                  <Crop size={13} className="text-gray-700" />
                </motion.button>
              </div>

              {/* Delete */}
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={(e) => { e.stopPropagation(); handleRemovePhoto(index); }}
                className="absolute top-2.5 right-2.5 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center z-10"
              >
                <X size={15} className="text-white stroke-[2.5]" />
              </motion.button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Next Button — fixed bottom */}
      <div className="shrink-0 p-6 pb-8 bg-white">
        <motion.button
          onClick={handleNext}
          disabled={!isValid}
          whileTap={{ scale: 0.96 }}
          animate={{
            backgroundColor: isValid ? '#3180F7' : '#F3F4F6',
            color: isValid ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.25 }}
          className="w-full py-4 rounded-2xl font-bold text-base"
        >
          다음 ({photos.length}/4)
        </motion.button>
      </div>

      {/* Crop Modal */}
      <AnimatePresence>
        {cropImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black flex flex-col"
          >
            {/* Crop header */}
            <div className="shrink-0 flex items-center justify-between px-4 h-[52px] bg-black/80 z-10">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setCropImage(null); setFaceError(''); }} className="text-white text-[14px] font-medium">
                취소
              </motion.button>
              <span className="text-white text-[16px] font-bold">사진 크롭</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleCropSave}
                disabled={checking}
                className="text-[#3180F7] text-[14px] font-bold"
              >
                {checking ? '확인중...' : '완료'}
              </motion.button>
            </div>

            {/* Cropper */}
            <div className="flex-1 relative">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={aspect || undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={false}
                style={{
                  containerStyle: { background: '#000' },
                  cropAreaStyle: { border: '2px solid #3180F7' },
                }}
              />
            </div>

            {/* Aspect ratio tabs */}
            <div className="shrink-0 px-4 py-3 bg-black/80 flex gap-2 justify-center">
              {ASPECT_OPTIONS.map((opt) => (
                <motion.button
                  key={opt.label}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setAspect(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                    aspect === opt.value ? 'bg-[#3180F7] text-white' : 'bg-white/10 text-gray-400'
                  }`}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>

            {/* Zoom slider */}
            <div className="shrink-0 px-8 py-3 bg-black/80 flex items-center gap-3">
              <span className="text-[12px] text-gray-400">-</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#3180F7]"
              />
              <span className="text-[12px] text-gray-400">+</span>
            </div>

            {/* Face error in crop modal */}
            <AnimatePresence>
              {faceError && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-24 left-4 right-4 bg-red-500 text-white px-4 py-3 rounded-xl flex items-center gap-2 z-20"
                >
                  <AlertCircle size={16} />
                  <p className="text-[13px] font-medium">{faceError}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
