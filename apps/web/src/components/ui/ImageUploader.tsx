'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Plus, X, GripVertical, Sun, Contrast, Droplets,
  Sparkles, Crop, AlertTriangle, Check, RotateCcw, Trash2,
} from 'lucide-react';
import { prosApi } from '@/lib/api/pros.api';

interface ProfileImage {
  id: string;
  imageUrl: string;
  originalUrl?: string;
  displayOrder: number;
  hasFace: boolean;
  isPrimary: boolean;
}

interface ImageUploaderProps {
  images: ProfileImage[];
  onChange: (images: ProfileImage[]) => void;
  maxImages?: number;
  minImages?: number;
  requireFace?: boolean;
}

interface AdjustState {
  brightness: number;
  contrast: number;
  saturation: number;
  sharpen: boolean;
}

export default function ImageUploader({
  images,
  onChange,
  maxImages = 10,
  minImages = 4,
  requireFace = true,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<ProfileImage | null>(null);
  const [adjustState, setAdjustState] = useState<AdjustState>({
    brightness: 0, contrast: 0, saturation: 0, sharpen: false,
  });
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Upload ──────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = maxImages - images.length;
    if (remaining <= 0) {
      setError(`이미지는 최대 ${maxImages}장까지 등록할 수 있습니다.`);
      return;
    }

    setError(null);
    setUploading(true);

    const filesToUpload = Array.from(files).slice(0, remaining);

    for (const file of filesToUpload) {
      // Validate client-side
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name}: 파일 크기는 10MB를 초과할 수 없습니다.`);
        continue;
      }

      if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
        setError(`${file.name}: 지원하지 않는 형식입니다. (JPG, PNG, WebP, HEIC)`);
        continue;
      }

      try {
        const result = await prosApi.uploadImage(file);
        onChange([...images, result]);
      } catch (err: any) {
        const msg = err?.response?.data?.message || '업로드에 실패했습니다.';
        setError(msg);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [images, maxImages, onChange]);

  // ─── Delete ──────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    try {
      await prosApi.deleteImage(id);
      onChange(images.filter((img) => img.id !== id));
    } catch {
      setError('삭제에 실패했습니다.');
    }
  }, [images, onChange]);

  // ─── Reorder (drag & drop) ───────────────────────────────────────────────

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDragEnd = useCallback(async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dragOverIdx, 0, moved);

    const updated = reordered.map((img, i) => ({
      ...img,
      displayOrder: i,
      isPrimary: i === 0,
    }));

    onChange(updated);
    setDragIdx(null);
    setDragOverIdx(null);

    try {
      await prosApi.reorderImages(updated.map((img) => img.id));
    } catch {
      // revert on failure
    }
  }, [dragIdx, dragOverIdx, images, onChange]);

  // ─── Image Adjust ───────────────────────────────────────────────────────

  const handleAdjustSave = useCallback(async () => {
    if (!editingImage) return;

    try {
      setUploading(true);
      const result = await prosApi.adjustImage(editingImage.id, adjustState);
      onChange(images.map((img) => (img.id === editingImage.id ? { ...img, ...result } : img)));
      setEditingImage(null);
      setAdjustState({ brightness: 0, contrast: 0, saturation: 0, sharpen: false });
    } catch (err: any) {
      setError(err?.response?.data?.message || '보정에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  }, [editingImage, adjustState, images, onChange]);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-bold text-gray-900">프로필 사진</p>
          <span className={`text-[12px] font-medium ${images.length >= minImages ? 'text-green-500' : 'text-amber-500'}`}>
            {images.length}/{maxImages}
          </span>
        </div>
        {images.length < minImages && (
          <p className="text-[11px] text-amber-500 flex items-center gap-1">
            <AlertTriangle size={12} /> 최소 {minImages}장 필요
          </p>
        )}
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-2.5">
        {images.map((img, idx) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`relative aspect-square rounded-2xl overflow-hidden group cursor-grab active:cursor-grabbing ${
              dragOverIdx === idx ? 'ring-2 ring-primary-500 ring-offset-2' : ''
            }`}
            style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />

            {/* Primary badge */}
            {idx === 0 && (
              <span className="absolute top-1.5 left-1.5 bg-primary-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                대표
              </span>
            )}

            {/* Face warning */}
            {!img.hasFace && (
              <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white text-[9px] font-bold p-1 rounded-full">
                <AlertTriangle size={10} />
              </span>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100"
              style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <button
                onClick={() => {
                  setEditingImage(img);
                  setAdjustState({ brightness: 0, contrast: 0, saturation: 0, sharpen: false });
                }}
                className="p-2 bg-white/90 rounded-full hover:bg-white active:scale-90"
                style={{ transition: 'all 0.3s' }}
                title="보정"
              >
                <Sparkles size={14} className="text-gray-700" />
              </button>
              <button
                onClick={() => handleDelete(img.id)}
                className="p-2 bg-white/90 rounded-full hover:bg-white active:scale-90"
                style={{ transition: 'all 0.3s' }}
                title="삭제"
              >
                <Trash2 size={14} className="text-red-500" />
              </button>
              <div className="p-2 bg-white/90 rounded-full cursor-grab">
                <GripVertical size={14} className="text-gray-400" />
              </div>
            </div>
          </div>
        ))}

        {/* Add button */}
        {images.length < maxImages && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 hover:border-primary-300 hover:bg-primary-50/30 active:scale-[0.97] disabled:opacity-50"
            style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {uploading ? (
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Plus size={20} className="text-gray-400" />
                <span className="text-[10px] text-gray-400 font-medium">사진 추가</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 text-red-600 text-[13px] px-4 py-3 rounded-2xl animate-scale-in" style={{ animationFillMode: 'forwards' }}>
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 text-[11px] font-medium mt-1">닫기</button>
          </div>
        </div>
      )}

      {/* Hint text */}
      <p className="text-[11px] text-gray-400 leading-relaxed">
        얼굴이 잘 보이는 사진을 올려주세요. 업로드된 사진은 자동으로 WebP로 변환되며, 얼굴이 인식되지 않으면 등록되지 않습니다. 드래그로 순서를 변경할 수 있습니다.
      </p>

      {/* ─── Image Editor Modal ──────────────────────────────────────────── */}
      {editingImage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingImage(null)}>
          <div
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden animate-scale-in"
            style={{ animationFillMode: 'forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview */}
            <div className="relative bg-gray-900 flex items-center justify-center">
              <img
                src={editingImage.imageUrl}
                alt=""
                className="max-h-[300px] w-full object-contain"
                style={{
                  filter: `brightness(${1 + adjustState.brightness}) contrast(${1 + adjustState.contrast}) saturate(${1 + adjustState.saturation})`,
                  transition: 'filter 0.2s',
                }}
              />
            </div>

            {/* Controls */}
            <div className="p-5 space-y-5">
              <h3 className="text-[16px] font-bold text-gray-900">사진 보정</h3>

              {/* Brightness */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                    <Sun size={14} /> 밝기
                  </label>
                  <span className="text-[12px] text-gray-400 font-mono">{(adjustState.brightness * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range" min="-0.5" max="0.5" step="0.05"
                  value={adjustState.brightness}
                  onChange={(e) => setAdjustState((s) => ({ ...s, brightness: parseFloat(e.target.value) }))}
                  className="w-full accent-primary-500 h-1.5"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                    <Contrast size={14} /> 대비
                  </label>
                  <span className="text-[12px] text-gray-400 font-mono">{(adjustState.contrast * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range" min="-0.5" max="0.5" step="0.05"
                  value={adjustState.contrast}
                  onChange={(e) => setAdjustState((s) => ({ ...s, contrast: parseFloat(e.target.value) }))}
                  className="w-full accent-primary-500 h-1.5"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[13px] font-medium text-gray-700">
                    <Droplets size={14} /> 채도
                  </label>
                  <span className="text-[12px] text-gray-400 font-mono">{(adjustState.saturation * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range" min="-0.5" max="0.5" step="0.05"
                  value={adjustState.saturation}
                  onChange={(e) => setAdjustState((s) => ({ ...s, saturation: parseFloat(e.target.value) }))}
                  className="w-full accent-primary-500 h-1.5"
                />
              </div>

              {/* Sharpen toggle */}
              <button
                onClick={() => setAdjustState((s) => ({ ...s, sharpen: !s.sharpen }))}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-medium ${
                  adjustState.sharpen
                    ? 'bg-primary-50 border-primary-200 text-primary-600'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
                style={{ transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
              >
                <Sparkles size={14} />
                선명하게
                {adjustState.sharpen && <Check size={14} />}
              </button>

              {/* Actions */}
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setAdjustState({ brightness: 0, contrast: 0, saturation: 0, sharpen: false })}
                  className="btn-ghost flex items-center gap-1.5 text-[13px]"
                >
                  <RotateCcw size={14} /> 초기화
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => setEditingImage(null)}
                  className="btn-ghost text-[13px]"
                >
                  취소
                </button>
                <button
                  onClick={handleAdjustSave}
                  disabled={uploading}
                  className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-primary-600 active:scale-[0.97] disabled:opacity-50"
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  {uploading ? '적용중...' : '적용'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
