'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Save,
  Upload,
  Trash2,
  Star,
  ImageOff,
  ChevronUp,
  ChevronDown,
  Loader2,
  X,
  Search,
} from '@/app/(admin)/admin/_components/admin-icons';
import toast from 'react-hot-toast';
import NaverMap from '@/components/map/NaverMap';
import { isInKorea } from '@/lib/naver-map-shared';
import { naverMapLinkProps } from '@/lib/naver-map-links';
import type { NaverLatLng } from '@/lib/naver-map';
import {
  adminPartnersApi,
  type AdminPartnerDetail,
  type AdminPartnerInput,
  type AdminBusinessCategory,
} from '@/lib/api/admin-partners.api';
import {
  deriveBusinessTagSuggestions,
  extractBusinessTagsFromHtml,
  normalizeBusinessTags,
  stripBusinessTagMarker,
  withBusinessTagMarker,
} from '@/lib/business-tags';
import { adminConfirm } from '../_components/adminDialog';

type ImageItem = AdminPartnerDetail['images'][number];

interface Props {
  mode: 'create' | 'edit';
  partnerId?: string;
}

/** /api/naver-map/geocode 결과 한 줄(쓰는 칸만) */
type GeoResult = { roadAddress: string; jibunAddress: string; buildingName: string; lat: number; lng: number };

const STATUS_OPTIONS = [
  { value: 'draft', label: '임시저장' },
  { value: 'pending', label: '대기' },
  { value: 'approved', label: '승인' },
  { value: 'rejected', label: '반려' },
];

export default function PartnerForm({ mode, partnerId }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [reordering, setReordering] = useState(false);

  // 폼 상태
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [phone, setPhone] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('');
  const [status, setStatus] = useState<string>('approved');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const [categories, setCategories] = useState<AdminBusinessCategory[]>([]);
  const [images, setImages] = useState<ImageItem[]>([]);

  // 드래그앤드롭 상태
  const [isDragging, setIsDragging] = useState(false);

  // 위치 — 주소로 좌표 찾기 + 네이버 지도 미리보기(261012 사장 '네이버 다이나믹맵 전부 다 적용').
  //  예전엔 위도·경도를 손으로 적어야 했다. 찾기는 버튼(·엔터)으로만 — 글자마다 부르면 네이버 한도를 쓴다.
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoCandidates, setGeoCandidates] = useState<GeoResult[]>([]);
  /** 다이나믹맵이 실제로 떠서 지도를 눌러 핀을 옮길 수 있는가(인증 실패면 정적 그림 — 보기만) */
  const [pinEditable, setPinEditable] = useState(false);
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const coordsTyped = lat.trim() !== '' && lng.trim() !== '';
  const coordsValid = coordsTyped && isInKorea(latNum, lngNum);
  // 미리보기는 0.45초 멈춘 뒤에만 옮긴다 — 위도·경도·업체명을 칠 때마다 정적 지도 그림(유료 한도)을 새로 받지 않게
  const [preview, setPreview] = useState<{ lat: number; lng: number; label: string } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setPreview(coordsValid ? { lat: latNum, lng: lngNum, label: businessName.trim().slice(0, 20) } : null);
    }, 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, businessName]);

  const applyGeo = (r: GeoResult) => {
    setLat(r.lat.toFixed(7));
    setLng(r.lng.toFixed(7));
    setGeoCandidates([]);
    toast.success(`좌표를 채웠어요 · ${r.roadAddress || r.jibunAddress}`);
  };

  const findCoords = async () => {
    const query = address.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (query.length < 2) {
      toast.error('주소를 먼저 적어 주세요');
      return;
    }
    setGeoBusy(true);
    setGeoCandidates([]);
    try {
      const res = await fetch(`/api/naver-map/geocode?${new URLSearchParams({ query }).toString()}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { results?: GeoResult[] };
      const results = (data.results || []).filter((r) => isInKorea(r.lat, r.lng));
      if (results.length === 0) toast.error('이 주소로 좌표를 못 찾았어요. 도로명이나 지번 주소로 적어 주세요(층·호수는 상세 주소 칸에)');
      else if (results.length === 1) applyGeo(results[0]);
      else setGeoCandidates(results);
    } catch {
      toast.error('좌표 찾기에 실패했어요. 잠시 뒤 다시 눌러 주세요');
    } finally {
      setGeoBusy(false);
    }
  };

  // 카테고리 로드 — 항상 실행
  useEffect(() => {
    adminPartnersApi.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  // 기존 업체 상세 로드 — 편집 모드에서만
  useEffect(() => {
    if (mode !== 'edit' || !partnerId) return;
    (async () => {
      setLoading(true);
      try {
        const d = await adminPartnersApi.getDetail(partnerId);
        setBusinessName(d.businessName || '');
        setBusinessType(d.businessType || '');
        setAddress(d.address || '');
        setAddressDetail(d.addressDetail || '');
        setLat(d.lat != null ? String(d.lat) : '');
        setLng(d.lng != null ? String(d.lng) : '');
        setPhone(d.phone || '');
        setInstagramUrl(d.instagramUrl || '');
        setWebsiteUrl(d.websiteUrl || '');
        setVideoUrl(d.videoUrl || '');
        setDescriptionHtml(stripBusinessTagMarker(d.descriptionHtml || ''));
        setStatus(d.status || 'approved');
        const loadedCategories = (d.categories || []).map((c) => c.category?.name).filter(Boolean) as string[];
        setSelectedCategories(loadedCategories);
        const loadedTags = normalizeBusinessTags([
          ...(Array.isArray(d.tags) ? d.tags : []),
          ...extractBusinessTagsFromHtml(d.descriptionHtml),
        ], 6);
        setTags(loadedTags.length > 0 ? loadedTags : deriveBusinessTagSuggestions({
          businessName: d.businessName,
          businessType: d.businessType,
          address: d.address,
          categoryNames: loadedCategories,
        }).slice(0, 6));
        setImages(d.images || []);
      } catch (e: any) {
        toast.error(`로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [mode, partnerId]);

  const toggleCategory = (name: string) => {
    setSelectedCategories((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const suggestedTags = useMemo(() => (
    deriveBusinessTagSuggestions({
      businessName,
      businessType,
      address,
      categoryNames: selectedCategories,
    }).filter((tag) => !tags.includes(tag)).slice(0, 8)
  ), [address, businessName, businessType, selectedCategories, tags]);

  const addTags = (values: unknown[]) => {
    setTags((prev) => normalizeBusinessTags([...prev, ...values], 6));
  };

  const addTagInput = () => {
    const values = tagInput.split(/[,，\n]/).map((value) => value.trim()).filter(Boolean);
    if (values.length === 0) return;
    addTags(values);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((item) => item !== tag));
  };

  const buildPayload = (): AdminPartnerInput => ({
    businessName: businessName.trim(),
    businessType: businessType.trim() || null,
    address: address.trim() || null,
    addressDetail: addressDetail.trim() || null,
    lat: lat.trim() || null,
    lng: lng.trim() || null,
    phone: phone.trim() || null,
    instagramUrl: instagramUrl.trim() || null,
    websiteUrl: websiteUrl.trim() || null,
    videoUrl: videoUrl.trim() || null,
    descriptionHtml: withBusinessTagMarker(descriptionHtml, tags) || null,
    tags,
    categoryNames: selectedCategories,
    status,
  });

  const handleSave = async () => {
    if (!businessName.trim()) {
      toast.error('업체명은 필수입니다');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await adminPartnersApi.create(buildPayload());
        toast.success('업체가 등록되었습니다');
        router.replace(`/admin/partners/${created.id}`);
      } else if (partnerId) {
        await adminPartnersApi.update(partnerId, buildPayload());
        toast.success('저장되었습니다');
      }
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!partnerId) {
      toast.error('업체 저장 후 이미지를 업로드할 수 있습니다');
      return;
    }
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;

    setUploadingImage(true);
    try {
      for (const file of arr) {
        const img = await adminPartnersApi.uploadImage(partnerId, file);
        setImages((prev) => [
          ...prev,
          {
            id: img.id,
            imageUrl: img.imageUrl,
            displayOrder: img.displayOrder,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      toast.success(`${arr.length}개 이미지 업로드 완료`);
    } catch (e: any) {
      toast.error(`업로드 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!partnerId) return;
    if (!(await adminConfirm('이 이미지를 삭제하시겠습니까?'))) return;
    try {
      await adminPartnersApi.deleteImage(partnerId, imageId);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      toast.success('삭제되었습니다');
    } catch (e: any) {
      toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  };

  const moveImage = async (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= images.length) return;
    const next = [...images];
    const tmp = next[index];
    next[index] = next[newIndex];
    next[newIndex] = tmp;
    // displayOrder 재계산
    const rebuilt = next.map((img, i) => ({ ...img, displayOrder: i }));
    setImages(rebuilt);
    if (!partnerId) return;
    setReordering(true);
    try {
      await adminPartnersApi.reorderImages(
        partnerId,
        rebuilt.map((i) => i.id),
      );
    } catch (e: any) {
      toast.error(`순서 변경 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setReordering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <Link
          href="/admin/partners"
          className="flex items-center gap-1 text-gray-500 hover:text-gray-900 text-sm font-medium"
        >
          <ChevronLeft size={16} /> 목록
        </Link>
        <h1 className="text-xl font-bold text-gray-900 ml-2">
          {mode === 'create' ? '파트너 업체 등록' : '파트너 업체 수정'}
        </h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#3182F6] text-white text-sm font-semibold hover:bg-[#1B64DA] disabled:opacity-50"
        >
          <Save size={14} /> {saving ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
        </button>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <h2 className="text-[15px] font-bold text-gray-900">기본 정보</h2>

        <Field label="업체명 *">
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="예: 더채플앳청담"
            className="input-plain"
          />
        </Field>

        <Field label="업종 / 세부 분류">
          <input
            type="text"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="예: 웨딩홀, 드레스샵, 스튜디오, 피부과"
            className="input-plain"
          />
        </Field>

        <Field label="카테고리 (복수 선택 가능)">
          {categories.length === 0 ? (
            <p className="text-xs text-gray-400">
              등록된 business 카테고리가 없습니다 (Category.type = 'business')
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => {
                const selected = selectedCategories.includes(c.name);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.name)}
                    className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors"
                    style={{
                      backgroundColor: selected ? '#3180F7' : '#FFFFFF',
                      color: selected ? '#FFFFFF' : '#4B5563',
                      border: selected ? '1px solid #3180F7' : '1px solid #D1D5DB',
                    }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <Field label="태그 (최대 6개 · 홈/목록/상세 노출)">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 rounded-xl bg-[#F9FAFB] px-3 py-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full bg-[#E8F3FF] px-3 py-1.5 text-[12px] font-bold text-[#3182F6]"
                >
                  {tag}
                  <X size={12} />
                </button>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onBlur={addTagInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTagInput();
                  }
                  if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                    removeTag(tags[tags.length - 1]);
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (!/[,\n，]/.test(pasted)) return;
                  e.preventDefault();
                  addTags(pasted.split(/[,，\n]/));
                }}
                placeholder={tags.length === 0 ? '예: 웨딩케어, 프리미엄홀' : '태그 추가'}
                className="min-w-[160px] flex-1 bg-transparent py-1.5 text-[13px] font-semibold text-[#191F28] placeholder:text-[#B0B8C1] focus:outline-none"
              />
            </div>
            {suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="py-1 text-[11px] font-semibold text-[#8B95A1]">추천</span>
                {suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addTags([tag])}
                    className="rounded-full border border-[#E5E8EB] bg-white px-2.5 py-1 text-[11px] font-bold text-[#4E5968] hover:border-[#3182F6] hover:text-[#3182F6]"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="상태">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-plain"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="전화">
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="02-1234-5678"
              className="input-plain"
            />
          </Field>
        </div>
      </div>

      {/* 위치 */}
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <h2 className="text-[15px] font-bold text-gray-900">위치</h2>

        <Field label="주소">
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 엔터는 글자 확정용 — 그때는 찾지 않는다
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void findCoords();
                }
              }}
              placeholder="서울시 강남구 도산대로 123"
              className="input-plain min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => void findCoords()}
              disabled={geoBusy}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#E8F3FF] px-4 text-[13px] font-semibold text-[#3182F6] hover:bg-[#D6E9FF] disabled:opacity-60"
            >
              {geoBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              좌표 찾기
            </button>
          </div>
          {geoCandidates.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-[#E5E8EB]">
              <p className="px-4 pb-1 pt-3 text-[12px] font-semibold text-[#8B95A1]">찾은 주소 {geoCandidates.length}곳 — 맞는 곳을 고르세요</p>
              {geoCandidates.map((r) => (
                <button
                  key={`${r.lat},${r.lng},${r.roadAddress}`}
                  type="button"
                  onClick={() => applyGeo(r)}
                  className="block w-full px-4 py-2.5 text-left hover:bg-[#F9FAFB]"
                >
                  <span className="block text-[14px] font-semibold text-[#191F28]">
                    {r.roadAddress || r.jibunAddress}
                    {/* 도로명 주소 끝에 건물 이름이 이미 붙어 오면 또 쓰지 않는다 */}
                    {r.buildingName && !(r.roadAddress || r.jibunAddress).includes(r.buildingName) && (
                      <span className="ml-1 font-medium text-[#8B95A1]">({r.buildingName})</span>
                    )}
                  </span>
                  {r.roadAddress && r.jibunAddress && <span className="block text-[12px] text-[#8B95A1]">지번 {r.jibunAddress}</span>}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="상세 주소 (동/호수 등)">
          <input
            type="text"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder="3층 301호"
            className="input-plain"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="위도 (lat)">
            <input
              type="text"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="37.5172"
              className="input-plain"
            />
          </Field>
          <Field label="경도 (lng)">
            <input
              type="text"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="127.0473"
              className="input-plain"
            />
          </Field>
        </div>

        {/* 네이버 지도 미리보기 — 업체 상세 지도와 같은 좌표·핀. 다이나믹맵이 뜨면 지도를 눌러 핀을 옮겨 위도·경도를 바로잡는다 */}
        {coordsTyped && !coordsValid ? (
          <p className="break-keep rounded-xl bg-[#FFF4E5] px-4 py-3 text-[13px] font-medium text-[#B25E00]">
            대한민국 밖 좌표예요. 위도(33~38)와 경도(124~132)가 서로 바뀌지 않았는지 확인해 주세요.
          </p>
        ) : preview ? (
          <div>
            <NaverMap
              className="h-[260px] rounded-xl"
              markers={[{ lat: preview.lat, lng: preview.lng, label: preview.label || undefined }]}
              zoom={17}
              interactive
              // 다이나믹맵이 뜬 뒤엔 핀을 옮길 때마다 밑에 깔 정적 그림(유료 한도)을 또 받지 않는다 — 실패하면 컴포넌트가 다시 그림으로
              staticPreview={!pinEditable}
              lockHint="눌러서 지도 움직이기 · 핀 옮기기"
              title={businessName.trim() || undefined}
              address={address.trim() || undefined}
              onReady={(map, naver) => {
                naver.Event.addListener(map, 'click', (ev) => {
                  const c = (ev as { coord?: NaverLatLng } | undefined)?.coord;
                  if (!c || !isInKorea(c.lat(), c.lng())) return;
                  setLat(c.lat().toFixed(7));
                  setLng(c.lng().toFixed(7));
                });
                setPinEditable(true);
              }}
              onFallback={() => setPinEditable(false)}
            />
            <div className="mt-2 flex items-center justify-between gap-3 text-[12px]">
              <span className="text-[#8B95A1]">
                {pinEditable ? '지도를 눌러 핀을 옮기면 위도·경도가 바뀌어요(저장해야 반영)' : '업체 상세 화면에 이 위치로 지도가 나와요'}
              </span>
              <a
                {...naverMapLinkProps({ lat: preview.lat, lng: preview.lng, name: businessName.trim() || address.trim() })}
                className="shrink-0 font-semibold text-[#3182F6] hover:underline"
              >
                네이버 지도에서 확인 ↗
              </a>
            </div>
          </div>
        ) : coordsValid ? (
          // 미리보기가 0.45초 뒤 들어올 자리 — 칸이 튀지 않게 같은 높이로
          <div className="h-[280px] animate-pulse rounded-xl bg-[#F2F4F6]" aria-hidden />
        ) : !coordsTyped ? (
          <div className="flex h-[112px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#D1D6DB] bg-[#F9FAFB] px-4 text-center">
            <span className="text-[13px] font-semibold text-[#4E5968]">좌표가 비어 있어요</span>
            <span className="text-[12px] text-[#8B95A1]">주소를 적고 &lsquo;좌표 찾기&rsquo;를 누르면 네이버 지도에 핀이 찍혀요</span>
          </div>
        ) : null}
      </div>

      {/* 연락처 / 링크 */}
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <h2 className="text-[15px] font-bold text-gray-900">연결 링크</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="인스타그램 URL">
            <input
              type="text"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              placeholder="https://instagram.com/..."
              className="input-plain"
            />
          </Field>
          <Field label="웹사이트 URL">
            <input
              type="text"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://..."
              className="input-plain"
            />
          </Field>
          <Field label="소개 영상 URL (YouTube 등)">
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="input-plain"
            />
          </Field>
        </div>
      </div>

      {/* 설명 */}
      <div className="bg-white rounded-2xl p-6 space-y-3">
        <h2 className="text-[15px] font-bold text-gray-900">설명</h2>
        <p className="text-[12px] text-gray-400">HTML 태그 사용 가능 (b, br, p, ul, li 등)</p>
        <textarea
          value={descriptionHtml}
          onChange={(e) => setDescriptionHtml(e.target.value)}
          rows={8}
          placeholder="<p>업체 소개...</p>"
          className="w-full bg-[#F9FAFB] rounded-xl px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#3182F6] font-mono"
        />
      </div>

      {/* 이미지 */}
      <div className="bg-white rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold text-gray-900">이미지</h2>
          <span className="text-[12px] text-gray-400">({images.length})</span>
          {reordering && <Loader2 size={14} className="text-gray-400 animate-spin" />}
        </div>

        {mode === 'create' ? (
          <p className="text-[13px] text-gray-500 bg-[#FFF8E6] border border-[#F7E1A4] rounded-xl px-4 py-3">
            업체를 먼저 등록한 뒤 수정 페이지에서 이미지를 업로드할 수 있습니다.
          </p>
        ) : (
          <>
            {/* 드롭존 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer?.files) uploadFiles(e.dataTransfer.files);
              }}
              disabled={uploadingImage}
              className={`w-full rounded-2xl border-2 border-dashed py-10 flex flex-col items-center gap-2 transition-colors ${
                isDragging
                  ? 'border-[#3182F6] bg-[#E8F3FF]'
                  : 'border-gray-200 bg-[#F9FAFB] hover:bg-[#F2F4F6]'
              } disabled:opacity-50`}
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
                  <span className="text-sm text-gray-500">업로드 중...</span>
                </>
              ) : (
                <>
                  <Upload size={26} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-700">
                    이미지를 드래그하거나 클릭해서 업로드
                  </span>
                  <span className="text-[12px] text-gray-400">JPG, PNG, WebP · 최대 10MB</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
                if (e.target) e.target.value = '';
              }}
            />

            {/* 썸네일 그리드 */}
            {images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <ImageTile
                    key={img.id}
                    image={img}
                    index={idx}
                    isFirst={idx === 0}
                    isLast={idx === images.length - 1}
                    onMoveUp={() => moveImage(idx, -1)}
                    onMoveDown={() => moveImage(idx, 1)}
                    onDelete={() => handleDeleteImage(img.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center text-[13px] text-gray-400 py-4">
                등록된 이미지가 없습니다
              </p>
            )}
          </>
        )}
      </div>

      {mode === 'edit' && partnerId && (
        <div className="bg-white rounded-2xl p-6">
          <h2 className="text-[15px] font-bold text-gray-900 mb-3">위험 영역</h2>
          <button
            onClick={async () => {
              if (!(await adminConfirm(`"${businessName}" 업체를 삭제하시겠습니까?`))) return;
              try {
                await adminPartnersApi.remove(partnerId);
                toast.success('삭제되었습니다');
                router.replace('/admin/partners');
              } catch (e: any) {
                toast.error(`삭제 실패: ${e?.response?.data?.message || e?.message || ''}`);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100"
          >
            <Trash2 size={14} /> 업체 삭제
          </button>
        </div>
      )}

      <style jsx>{`
        :global(.input-plain) {
          width: 100%;
          background-color: #f9fafb;
          border-radius: 0.75rem;
          padding: 0.75rem 1rem;
          font-size: 14px;
          color: #191f28;
          outline: none;
        }
        :global(.input-plain:focus) {
          background-color: #fff;
          box-shadow: 0 0 0 2px #3182f6;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[#8B95A1] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ImageTile({
  image,
  index,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  image: ImageItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [err, setErr] = useState(false);
  return (
    <div className="group relative aspect-[4/3] rounded-xl bg-gray-100 overflow-hidden">
      {err || !image.imageUrl ? (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff size={22} className="text-gray-300" />
        </div>
      ) : (
        <img
          src={image.imageUrl}
          alt=""
          onError={() => setErr(true)}
          className="w-full h-full object-cover"
        />
      )}
      {index === 0 && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold shadow">
          <Star size={10} /> 대표
        </div>
      )}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
          aria-label="삭제"
        >
          <X size={12} />
        </button>
      </div>
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className="p-1.5 rounded-full bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 shadow"
          aria-label="앞으로"
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className="p-1.5 rounded-full bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-30 shadow"
          aria-label="뒤로"
        >
          <ChevronDown size={12} />
        </button>
      </div>
    </div>
  );
}
