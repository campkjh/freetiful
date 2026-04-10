'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, X } from 'lucide-react';

export default function PhotosPage() {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddPhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // FileReader를 사용하여 이미지를 base64로 변환
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPhotos(prev => [...prev, base64String]);
    };
    reader.readAsDataURL(file);

    // input 초기화 (같은 파일을 다시 선택할 수 있도록)
    e.target.value = '';
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));

    // 대표 사진 인덱스 조정
    if (mainPhotoIndex === index) {
      setMainPhotoIndex(0);
    } else if (mainPhotoIndex > index) {
      setMainPhotoIndex(mainPhotoIndex - 1);
    }
  };

  const handleNext = () => {
    if (photos.length < 4) {
      return;
    }
    router.push('/pro-register/profile');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <button onClick={() => router.back()} className="mb-10">
          <ChevronLeft size={24} className="text-gray-900" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">프로필사진</h1>
        <p className="text-sm text-gray-400">메인이미지는 1:1비율의 사진으로 첨부해주세요.</p>
        <p className="text-sm text-gray-400">[필수] 4장 이상 등록할 시 다음버튼이 활성화 됩니다.</p>
      </div>

      {/* Photos Grid */}
      <div className="px-6 flex-1">
        <div className="grid grid-cols-2 gap-4">
          {/* Add Photo Button */}
          <button
            onClick={handleAddPhoto}
            className="aspect-square bg-gray-100 rounded-2xl flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <Plus size={32} className="text-gray-400" />
          </button>

          {/* Photo Items */}
          {photos.map((photo, index) => (
            <div
              key={index}
              className="aspect-square relative rounded-2xl overflow-hidden cursor-pointer"
              onClick={() => setMainPhotoIndex(index)}
            >
              {/* 대표 라벨 */}
              {mainPhotoIndex === index && (
                <div className="absolute top-3 left-3 bg-black text-white text-xs px-3 py-1.5 rounded z-10 font-medium">
                  대표
                </div>
              )}

              {/* 이미지 */}
              <img
                src={photo}
                alt={`Profile ${index + 1}`}
                className="w-full h-full object-cover"
              />

              {/* 삭제 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemovePhoto(index);
                }}
                className="absolute top-3 right-3 w-8 h-8 bg-black/70 rounded-full flex items-center justify-center z-10 hover:bg-black/80 transition-colors"
              >
                <X size={18} className="text-white stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Next Button */}
      <div className="p-6 pb-8">
        <button
          onClick={handleNext}
          disabled={photos.length < 4}
          className={`w-full py-4 rounded-2xl font-bold text-base transition-colors ${
            photos.length >= 4
              ? 'bg-[#3180F7] text-white'
              : 'bg-blue-100 text-blue-300 cursor-not-allowed'
          }`}
        >
          다음
        </button>
      </div>
    </div>
  );
}
