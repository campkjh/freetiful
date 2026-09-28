'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Crop, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { RegisterShell, RgCta } from '../_components/RegisterKit';

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
      // localStorage 용량을 위해 최대 1200px로 다운스케일
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(crop.width, crop.height));
      const outW = Math.round(crop.width * scale);
      const outH = Math.round(crop.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.src = imageSrc;
  });
}

/* ─── Downscale non-cropped photos for localStorage ─── */
function downscaleDataUrl(dataUrl: string, maxSize = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
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
  // 대표 사진 — 소개 단계 제출이 proRegister_mainPhotoIndex 를 읽는데 예전엔 저장을 안 해 고른 대표가 무시되고 늘 첫 장이 대표였다(260928)
  const [mainPhotoIndex, setMainPhotoIndex] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const n = parseInt(localStorage.getItem('proRegister_mainPhotoIndex') || '0', 10);
    return Number.isFinite(n) && n >= 0 && n < photos.length ? n : 0;
  });
  useEffect(() => {
    try { localStorage.setItem('proRegister_mainPhotoIndex', String(mainPhotoIndex)); } catch { /* 저장소 막힘 */ }
  }, [mainPhotoIndex]);
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
    try {
      localStorage.setItem('proRegister_photos', JSON.stringify(photos));
    } catch (err) {
      // 용량 초과 시 세션 저장소 폴백 + 사용자 안내
      try {
        sessionStorage.setItem('proRegister_photos', JSON.stringify(photos));
      } catch {}
      console.warn('사진 저장 공간 부족:', err);
      setFaceError('사진 저장 공간이 부족합니다. 사진을 줄이거나 다시 시도해주세요.');
      setTimeout(() => setFaceError(''), 4000);
    }
  }, [photos]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleAddPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    // 다중 선택 업로드 — 선택한 모든 사진을 한 번에 추가(얼굴 인식 조건 없음).
    // 개별 사진은 추가 후 탭하여 크롭/편집할 수 있음.
    const readFile = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject();
        reader.readAsDataURL(file);
      });

    try {
      const results: string[] = [];
      for (const file of imageFiles) {
        const data = await readFile(file);
        const scaled = await downscaleDataUrl(data);
        results.push(scaled);
      }
      setPhotos(prev => [...prev, ...results]);
    } catch {
      // 읽기 실패 무시
    }
    e.target.value = '';
  };

  const handleCropSave = async () => {
    if (!cropImage || !croppedArea) return;
    const cropped = await getCroppedImg(cropImage, croppedArea);

    if (cropFor === 'new') {
      setPhotos(prev => [...prev, cropped]);
    } else {
      setPhotos(prev => prev.map((p, i) => i === cropFor ? cropped : p));
    }
    setCropImage(null);
    setFaceError('');
  };

  const handleSetMain = (index: number) => {
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
    router.push('/pro-register/profile'); // 상품고지(pricing) 단계 제거 — 가격은 가입 후 프로필 설정에서
  };

  const isValid = photos.length >= 4;

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      <RegisterShell
        step={4}
        title="프로필사진"
        sub={
          <>
            마음에 드는 사진을 자유롭게 등록해주세요
            <br />
            <span className="font-semibold text-[#3182F6]">필수</span> 4장 이상 등록 시 다음 버튼이 활성화됩니다
          </>
        }
        cta={<RgCta disabled={!isValid} onClick={handleNext}>다음 ({photos.length}/4)</RgCta>}
      >
        <div className="grid grid-cols-2 gap-3">
          {/* 사진 추가 — 회색 면 + 흰 동그라미 파란 더하기 */}
          <button
            type="button"
            onClick={handleAddPhoto}
            aria-label="사진 추가"
            className="flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl bg-[#F2F4F6] transition-colors active:bg-[#E5E8EB] lg:hover:bg-[#EBEEF1]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <Plus size={22} strokeWidth={2.4} className="text-[#3182F6]" />
            </span>
            <span className="text-[13px] font-semibold tabular-nums text-[#8B95A1]">
              <b className="font-semibold text-[#3182F6]">{photos.length}</b>/4+
            </span>
          </button>

          {/* 사진 — 처음 뜰 땐 본문 슬라이드에 묻히고, 나중에 더한 사진만 톡 떠오른다 */}
          {photos.map((photo, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
              className="group relative aspect-square overflow-hidden rounded-2xl bg-[#F2F4F6]"
            >
              {/* 대표 라벨 */}
              <AnimatePresence>
                {mainPhotoIndex === index && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute left-2.5 top-2.5 z-10 flex h-6 items-center rounded-full bg-[#3182F6] px-2.5 text-[12px] font-semibold text-white"
                  >
                    대표
                  </motion.div>
                )}
              </AnimatePresence>

              <img src={photo} alt={`Profile ${index + 1}`} className="h-full w-full object-cover" />

              {/* 대표설정 · 자르기 — 올려 두면 나타난다 */}
              <div className="absolute inset-0 flex items-end justify-center gap-2 bg-black/0 pb-2.5 opacity-0 transition-[background-color,opacity] duration-150 group-hover:bg-black/20 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => handleSetMain(index)}
                  className="h-7 rounded-full bg-white/95 px-3 text-[12px] font-semibold text-[#333D4B] transition-transform active:scale-95"
                >
                  대표설정
                </button>
                <button
                  type="button"
                  onClick={() => handleEditCrop(index)}
                  aria-label="사진 자르기"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 transition-transform active:scale-95"
                >
                  <Crop size={13} className="text-[#333D4B]" />
                </button>
              </div>

              {/* 삭제 */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemovePhoto(index); }}
                aria-label="사진 삭제"
                className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 transition-transform active:scale-90"
              >
                <X size={15} className="stroke-[2.5] text-white" />
              </button>
            </motion.div>
          ))}
        </div>
      </RegisterShell>

      {/* 저장 공간 오류 토스트 — 앱 공통 토스트(AppToaster)와 같은 흰 유리 알약, 빨간 글자. 가운데 정렬은 감싼 칸이(framer transform 이 translate 를 덮어써서) */}
      <AnimatePresence>
        {faceError && (
          <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4">
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              role="alert"
              className="flex items-center gap-2 rounded-[20px] border-[0.6px] border-[#E5E9F0]/90 bg-white/[.92] px-[18px] py-[13px] text-[#E5484D] shadow-[0_18px_42px_rgba(15,23,42,0.14)] backdrop-blur-[18px]"
            >
              <AlertCircle size={16} className="flex-none" />
              <p className="text-[14px] font-bold leading-[1.35]">{faceError}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                className="text-[#3182F6] text-[14px] font-bold"
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
                  cropAreaStyle: { border: '2px solid #3182F6' },
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
                    aspect === opt.value ? 'bg-[#3182F6] text-white' : 'bg-white/10 text-gray-400'
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
                className="flex-1 accent-[#3182F6]"
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
                  className="absolute bottom-24 left-4 right-4 bg-[#F04452] text-white px-4 py-3 rounded-xl flex items-center gap-2 z-20"
                >
                  <AlertCircle size={16} />
                  <p className="text-[13px] font-medium">{faceError}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
