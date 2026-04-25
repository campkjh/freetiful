'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronDown, ChevronUp, Plus, X, Check, Star, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminSwitch } from '../../../_components/AdminSwitch';
import { adminFetch } from '../../../_components/adminFetch';

/* ─── Constants (pro-edit와 동일) ─── */
const WEDDING_TAGS = ['결혼식', '돌잔치', '회갑/칠순', '상견례'];
const EVENT_TAGS = ['기업행사', '컨퍼런스/세미나', '체육대회', '송년회/시무식', '레크리에이션', '팀빌딩', '라이브커머스', '기업PT', '축제/페스티벌', '공식행사'];
const OTHER_TAGS = ['레슨/클래스', '쇼호스트', '축가/연주'];
const REGIONS = ['전국가능', '수도권(서울/인천/경기)', '강원도', '충청권', '전라권', '경상권', '제주'];
const LANGUAGES = ['영어', '일본어', '중국어', '스페인어', '프랑스어', '독일어', '러시아어', '아랍어', '베트남어', '태국어'];
const CAREER_YEARS = Array.from({ length: 30 }, (_, i) => i + 1);

/* ─── Section wrapper (pro-edit 동일) ─── */
function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 active:bg-gray-50 transition-colors"
      >
        <span className="text-[15px] font-bold text-gray-900">{title}</span>
        {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {open && (
        <div className="overflow-hidden">
          <div className="px-5 pb-5">{children}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Tag chip ─── */
function TagChip({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-colors"
      style={{
        backgroundColor: selected ? '#3180F7' : '#FFFFFF',
        color: selected ? '#FFFFFF' : '#4B5563',
        border: selected ? '1px solid #3180F7' : '1px solid #D1D5DB',
      }}
    >
      {label}
    </button>
  );
}

export default function AdminProEditPage() {
  const router = useRouter();
  const params = useParams();
  const proId = params?.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Loading / error ── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /* ── State (pro-edit 동일 + 어드민 전용 필드) ── */
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [category, setCategory] = useState('');
  const [intro, setIntro] = useState('');
  const [careerYears, setCareerYears] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [mainPhotoIndex, setMainPhotoIndex] = useState(0);
  const [languages, setLanguages] = useState<string[]>([]);
  const [awards, setAwards] = useState('');
  const [videos, setVideos] = useState<string[]>([]);
  const [showYoutubeSearch, setShowYoutubeSearch] = useState(false);
  const [ytChannelQuery, setYtChannelQuery] = useState('');
  const [ytChannels, setYtChannels] = useState<Array<{ id: string; title: string; description: string; thumbnail: string }>>([]);
  const [ytVideos, setYtVideos] = useState<Array<{ id: string; title: string; thumbnail: string }>>([]);
  const [ytSelectedChannel, setYtSelectedChannel] = useState<string | null>(null);
  const [ytLoading, setYtLoading] = useState(false);
  const [faqItems, setFaqItems] = useState<{ q: string; a: string }[]>([]);
  const [services, setServices] = useState<{ title: string; description: string; basePrice: number }[]>([]);
  const [mainExperience, setMainExperience] = useState('');
  const [detailHtml, setDetailHtml] = useState('');

  // 어드민 전용
  const [status, setStatus] = useState<string>('pending');
  const [isFeatured, setIsFeatured] = useState(false);
  const [showPartnersLogo, setShowPartnersLogo] = useState(false);
  const [basePrice, setBasePrice] = useState(0);
  const [adminRelations, setAdminRelations] = useState<any>(null);

  const [showCategorySheet, setShowCategorySheet] = useState(false);
  const [showCareerSheet, setShowCareerSheet] = useState(false);

  /* ── Load from admin API ── */
  useEffect(() => {
    if (!proId) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await adminFetch('GET', `/api/v1/admin/pros/${proId}`);
        setName(d.user?.name || '');
        setPhone(d.user?.phone || '');
        setGender(d.gender || '');
        setIntro(d.shortIntro || '');
        setCareerYears(d.careerYears || 1);
        setMainExperience(d.mainExperience || '');
        setAwards(d.awards || '');
        setDetailHtml(d.detailHtml || '');
        setPhotos((d.images || []).map((img: any) => img.imageUrl));
        const primaryIdx = (d.images || []).findIndex((img: any) => img.isPrimary);
        setMainPhotoIndex(primaryIdx >= 0 ? primaryIdx : 0);
        setLanguages((d.languages || []).map((l: any) => l.languageCode));
        setServices((d.services || []).map((s: any) => ({
          title: s.title || '',
          description: s.description || '',
          basePrice: s.basePrice || 0,
        })));
        setFaqItems((d.faqs || []).map((f: any) => ({ q: f.question || '', a: f.answer || '' })));
        setSelectedCategories((d.categories || []).map((c: any) => c.category?.name).filter(Boolean));
        setCategory((d.categories || [])[0]?.category?.name || '');
        setSelectedRegions((d.regions || []).map((r: any) => r.region?.name).filter(Boolean));
        setVideos(d.youtubeUrl ? [d.youtubeUrl] : []);
        setStatus(d.status || 'pending');
        setIsFeatured(!!d.isFeatured);
        setShowPartnersLogo(!!d.showPartnersLogo);
        setBasePrice(d.services?.[0]?.basePrice || 0);
        setAdminRelations(d.adminRelations || null);
      } catch (e: any) {
        setErr(e?.response?.data?.message || e?.message || '로드 실패');
      } finally {
        setLoading(false);
      }
    })();
  }, [proId]);

  /* ── Helpers (pro-edit 동일) ── */
  const formatPhoneNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '').slice(0, 11);
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
  };
  const toggleCategory = (cat: string) =>
    setSelectedCategories((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  const toggleRegion = (r: string) =>
    setSelectedRegions((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  const toggleLanguage = (l: string) =>
    setLanguages((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));

  const handleAddPhoto = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => setPhotos((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };
  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (mainPhotoIndex === index) setMainPhotoIndex(0);
    else if (mainPhotoIndex > index) setMainPhotoIndex((prev) => prev - 1);
  };

  /* ── YouTube search (pro-edit 동일) ── */
  const searchYtChannels = async () => {
    if (!ytChannelQuery.trim()) return;
    setYtLoading(true);
    setYtChannels([]);
    setYtVideos([]);
    setYtSelectedChannel(null);
    try {
      const res = await fetch(`/api/youtube?action=searchChannels&q=${encodeURIComponent(ytChannelQuery)}`);
      const data = await res.json();
      setYtChannels(data.channels || []);
    } catch {} finally { setYtLoading(false); }
  };
  const loadYtVideos = async (channelId: string) => {
    setYtSelectedChannel(channelId);
    setYtLoading(true);
    try {
      const res = await fetch(`/api/youtube?action=channelVideos&channelId=${channelId}`);
      const data = await res.json();
      setYtVideos(data.videos || []);
    } catch {} finally { setYtLoading(false); }
  };
  const addVideoUrl = (url: string) => {
    if (!url.trim() || videos.includes(url)) return;
    setVideos((prev) => [...prev, url]);
  };
  const removeVideo = (url: string) => setVideos((prev) => prev.filter((v) => v !== url));

  /* ── FAQ / Service ── */
  const addFaqItem = () => setFaqItems((prev) => [...prev, { q: '', a: '' }]);
  const updateFaqItem = (i: number, k: 'q' | 'a', v: string) =>
    setFaqItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const removeFaqItem = (i: number) => setFaqItems((prev) => prev.filter((_, idx) => idx !== i));

  const addService = () => setServices((prev) => [...prev, { title: '', description: '', basePrice: 0 }]);
  const updateService = (i: number, patch: any) =>
    setServices((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const removeService = (i: number) => setServices((prev) => prev.filter((_, idx) => idx !== i));

  const refreshRelations = async () => {
    if (!proId) return;
    const d = await adminFetch('GET', `/api/v1/admin/pros/${proId}`);
    setAdminRelations(d.adminRelations || null);
  };

  const runAdminAction = async (label: string, method: string, path: string, body?: any, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    try {
      await adminFetch(method, path, body);
      toast.success(label);
      await refreshRelations();
    } catch (e: any) {
      toast.error(`${label} 실패: ${e?.response?.data?.message || e?.message || ''}`, { duration: 6000 });
    }
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!proId || saving) return;
    setSaving(true);
    try {
      const awardsArray = awards.split('\n').filter(Boolean);
      const normalizedServices = services.filter((s) => s.title).map((s) => ({
        title: s.title,
        description: s.description || undefined,
        basePrice: s.basePrice || undefined,
      }));
      if (basePrice > 0) {
        if (normalizedServices.length > 0) normalizedServices[0] = { ...normalizedServices[0], basePrice };
        else normalizedServices.push({ title: '기본 플랜', description: undefined, basePrice });
      }
      const payload = {
        name: name || undefined,
        phone: phone || undefined,
        gender: gender || undefined,
        shortIntro: intro || undefined,
        mainExperience: mainExperience || (awardsArray.length > 0 ? awardsArray.join(' / ') : undefined),
        careerYears: careerYears || undefined,
        awards: awards || undefined,
        youtubeUrl: videos[0] || '',
        detailHtml: detailHtml || undefined,
        photos: photos.length > 0 ? photos : undefined,
        mainPhotoIndex,
        services: normalizedServices,
        faqs: faqItems.filter((f) => f.q && f.a).map((f) => ({ question: f.q, answer: f.a })),
        languages: languages.length > 0 ? languages : [],
        category: category || selectedCategories[0] || undefined,
        regions: selectedRegions,
        tags: selectedCategories,
        // 어드민 전용
        status,
        isFeatured,
        showPartnersLogo,
        basePrice: basePrice || undefined,
      };
      await adminFetch('PATCH', `/api/v1/admin/pros/${proId}/full`, payload);
      toast.success('저장되었습니다');
      setTimeout(() => router.push('/admin/pros'), 600);
    } catch (e: any) {
      toast.error(`저장 실패: ${e?.response?.data?.message || e?.message || ''}`, { duration: 6000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen -m-4 md:-mx-0 md:-my-6 md:mx-auto md:max-w-2xl md:my-4 md:rounded-2xl md:border md:border-gray-200" style={{ letterSpacing: '-0.02em' }}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-gray-100/60 md:rounded-t-2xl">
        <div className="flex items-center gap-3 px-4 h-[52px]">
          <button onClick={() => router.back()} className="p-1">
            <ChevronLeft size={24} className="text-gray-700" />
          </button>
          <h1 className="text-[17px] font-bold text-gray-900">프로필 수정 (어드민)</h1>
          <span className="ml-auto text-[11px] text-gray-400">{name}</span>
        </div>
      </div>

      {err && (
        <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-red-600">{err}</p>
        </div>
      )}

      {/* ─── 어드민 전용 ─── */}
      <Section title="어드민 관리" defaultOpen={true}>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">상태</label>
            <div className="grid grid-cols-5 gap-2">
              {(['draft', 'pending', 'approved', 'rejected', 'suspended'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="py-2 rounded-lg text-[13px] font-bold transition-colors"
                  style={{
                    backgroundColor: status === s ? '#3180F7' : '#F3F4F6',
                    color: status === s ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {s === 'approved' ? '승인' : s === 'pending' ? '대기' : s === 'rejected' ? '반려' : s === 'suspended' ? '중지' : '임시'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <AdminSwitch
              checked={isFeatured}
              onChange={setIsFeatured}
              label="추천 노출"
            />
            <AdminSwitch
              checked={showPartnersLogo}
              onChange={setShowPartnersLogo}
              label="파트너 로고 노출"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">기본 가격 (basePrice)</label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(Number(e.target.value))}
              className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7]"
            />
          </div>
        </div>
      </Section>

      <Section title="연동 데이터 / 인과관계">
        <div className="space-y-5">
          <AdminRelationSummary relations={adminRelations} />

          <AdminRelationGroup title="찜한 유저" items={adminRelations?.favorites || []}>
            {(fav: any) => (
              <AdminRelationRow
                key={fav.id}
                title={fav.user?.name || fav.user?.email || fav.id}
                meta={`${fav.user?.email || ''} · ${new Date(fav.createdAt).toLocaleDateString('ko-KR')}`}
              >
                <button onClick={() => runAdminAction('찜 삭제 완료', 'DELETE', `/api/v1/admin/favorites/${fav.id}`, undefined, '이 찜 데이터를 삭제할까요?')} className="admin-danger-btn">삭제</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="채팅방" items={adminRelations?.chatRooms || []}>
            {(room: any) => (
              <AdminRelationRow
                key={room.id}
                title={room.user?.name || room.user?.email || room.id}
                meta={`메시지 ${room._count?.messages || 0} · 견적 ${room._count?.quotations || 0} · ${room.lastMessageAt ? new Date(room.lastMessageAt).toLocaleDateString('ko-KR') : '대화 없음'}`}
              >
                <button onClick={() => runAdminAction('채팅방 숨김 완료', 'DELETE', `/api/v1/admin/chat-rooms/${room.id}`, undefined, '양쪽 채팅 목록에서 이 채팅방을 숨김 처리할까요?')} className="admin-danger-btn">숨김</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="견적" items={adminRelations?.quotations || []}>
            {(q: any) => (
              <AdminRelationRow
                key={q.id}
                title={`${q.user?.name || '유저'} · ${Number(q.amount || 0).toLocaleString()}원`}
                meta={`${q.title || '제목 없음'} · ${new Date(q.createdAt).toLocaleDateString('ko-KR')}`}
              >
                <AdminStatusSelect value={q.status} options={['pending', 'accepted', 'paid', 'cancelled', 'refunded', 'expired']} onChange={(status) => runAdminAction('견적 상태 변경 완료', 'PATCH', `/api/v1/admin/quotations/${q.id}`, { status })} />
                <button onClick={() => runAdminAction('견적 삭제 완료', 'DELETE', `/api/v1/admin/quotations/${q.id}`, undefined, '견적을 삭제할까요?')} className="admin-danger-btn">삭제</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="결제" items={adminRelations?.payments || []}>
            {(p: any) => (
              <AdminRelationRow
                key={p.id}
                title={`${p.user?.name || '유저'} · ${Number(p.amount || 0).toLocaleString()}원`}
                meta={`${p.method || 'method 없음'} · ${new Date(p.createdAt).toLocaleDateString('ko-KR')}`}
              >
                <AdminStatusSelect value={p.status} options={['pending', 'completed', 'failed', 'refunded', 'escrowed', 'settled']} onChange={(status) => runAdminAction('결제 상태 변경 완료', 'PATCH', `/api/v1/admin/payments/${p.id}`, { status })} />
                <button onClick={() => runAdminAction('결제 삭제 완료', 'DELETE', `/api/v1/admin/payments/${p.id}`, undefined, '결제와 연결 리뷰를 삭제하고 견적/스케줄 연결을 해제할까요?')} className="admin-danger-btn">삭제</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="스케줄" items={adminRelations?.schedules || []}>
            {(s: any) => (
              <AdminRelationRow
                key={s.id}
                title={`${new Date(s.date).toLocaleDateString('ko-KR')} · ${s.status}`}
                meta={`${s.source || 'manual'}${s.note ? ` · ${s.note}` : ''}`}
              >
                <AdminStatusSelect value={s.status} options={['available', 'unavailable', 'booked', 'pending', 'cancelled', 'completed']} onChange={(status) => runAdminAction('스케줄 상태 변경 완료', 'PATCH', `/api/v1/admin/schedules/${s.id}`, { status })} />
                <button onClick={() => runAdminAction('스케줄 삭제 완료', 'DELETE', `/api/v1/admin/schedules/${s.id}`, undefined, '스케줄을 삭제할까요?')} className="admin-danger-btn">삭제</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="매칭 전달" items={adminRelations?.matchDeliveries || []}>
            {(d: any) => (
              <AdminRelationRow
                key={d.id}
                title={`${d.matchRequest?.user?.name || '유저'} · ${d.matchRequest?.eventLocation || '장소 없음'}`}
                meta={`${d.matchRequest?.category?.name || '카테고리'} · ${new Date(d.deliveredAt).toLocaleDateString('ko-KR')}`}
              >
                <AdminStatusSelect value={d.status} options={['pending', 'viewed', 'replied', 'declined', 'expired']} onChange={(status) => runAdminAction('매칭 전달 상태 변경 완료', 'PATCH', `/api/v1/admin/match-deliveries/${d.id}`, { status })} />
                <button onClick={() => runAdminAction('매칭 전달 삭제 완료', 'DELETE', `/api/v1/admin/match-deliveries/${d.id}`, undefined, '이 사회자에게 전달된 매칭 데이터를 삭제할까요?')} className="admin-danger-btn">삭제</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="리뷰" items={adminRelations?.reviews || []}>
            {(r: any) => (
              <AdminRelationRow
                key={r.id}
                title={`${r.reviewer?.name || '유저'} · ${Number(r.avgRating || 0).toFixed(1)}점`}
                meta={`${r.comment || '내용 없음'} · ${new Date(r.createdAt).toLocaleDateString('ko-KR')}`}
              >
                <button onClick={() => runAdminAction('리뷰 삭제 완료', 'DELETE', `/api/v1/admin/reviews/${r.id}`, undefined, '리뷰를 삭제할까요?')} className="admin-danger-btn">삭제</button>
              </AdminRelationRow>
            )}
          </AdminRelationGroup>

          <AdminRelationGroup title="푸딩/정산 로그" items={[...(adminRelations?.puddingTransactions || []), ...(adminRelations?.settlementLogs || [])]}>
            {(item: any) => (
              <AdminRelationRow
                key={item.id}
                title={item.type ? `${item.type} · ${item.amount}` : `${item.status} · ${Number(item.netAmount || 0).toLocaleString()}원`}
                meta={new Date(item.createdAt).toLocaleDateString('ko-KR')}
              />
            )}
          </AdminRelationGroup>
        </div>
        <style jsx>{`
          .admin-danger-btn {
            padding: 6px 10px;
            border-radius: 8px;
            background: #fef2f2;
            color: #dc2626;
            font-size: 12px;
            font-weight: 800;
          }
        `}</style>
      </Section>

      {/* ─── 1. 기본 정보 ─── */}
      <Section title="기본 정보" defaultOpen={true}>
        <div className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
              placeholder="010-1234-5678"
              className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7]"
            />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">성별</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ k: 'male', l: '남성' }, { k: 'female', l: '여성' }].map((g) => (
                <button
                  key={g.k}
                  onClick={() => setGender(g.k)}
                  className="py-2.5 rounded-lg text-[14px] font-bold transition-colors"
                  style={{
                    backgroundColor: gender === g.k ? '#3180F7' : '#F3F4F6',
                    color: gender === g.k ? '#FFFFFF' : '#6B7280',
                  }}
                >
                  {g.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-gray-400 mb-1.5">전문가분류</label>
            <button
              onClick={() => setShowCategorySheet(true)}
              className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px] active:bg-gray-50"
            >
              <span className={category ? 'text-gray-900' : 'text-gray-400'}>{category || '선택해주세요'}</span>
              <ChevronDown size={18} className="text-gray-400" />
            </button>
          </div>
        </div>
      </Section>

      {/* ─── 2. 한줄 소개 ─── */}
      <Section title="한줄 소개" defaultOpen={true}>
        <div>
          <input
            type="text"
            value={intro}
            onChange={(e) => e.target.value.length <= 50 && setIntro(e.target.value)}
            maxLength={50}
            placeholder="한줄로 자신을 소개해주세요"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[16px] text-gray-900 outline-none focus:border-[#3180F7]"
          />
          <p className="text-right text-[11px] text-gray-400 mt-1">{intro.length}/50</p>
        </div>
      </Section>

      {/* ─── 3. 경력 ─── */}
      <Section title="경력">
        <div>
          <button
            onClick={() => setShowCareerSheet(true)}
            className="w-full h-11 border border-gray-200 rounded-xl px-4 flex items-center justify-between text-[15px]"
          >
            <span className="text-gray-900">{careerYears}년</span>
            <ChevronDown size={18} className="text-gray-400" />
          </button>
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1">
            {[1, 3, 5, 7, 10, 15, 20, 25, 30].map((y) => (
              <button
                key={y}
                onClick={() => setCareerYears(y)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors"
                style={{
                  backgroundColor: careerYears === y ? '#3180F7' : '#F3F4F6',
                  color: careerYears === y ? '#FFFFFF' : '#6B7280',
                }}
              >
                {y}년
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* ─── 4. 주요 경력 ─── */}
      <Section title="주요 경력 (mainExperience)">
        <textarea
          value={mainExperience}
          onChange={(e) => setMainExperience(e.target.value)}
          placeholder="주요 경력을 입력해주세요"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] text-gray-900 outline-none focus:border-[#3180F7] resize-none"
        />
      </Section>

      {/* ─── 5. 전문영역 ─── */}
      <Section title="전문영역">
        <div className="space-y-4">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">웨딩 / 가족행사</p>
            <div className="flex flex-wrap gap-2">
              {WEDDING_TAGS.map((c) => <TagChip key={c} label={c} selected={selectedCategories.includes(c)} onToggle={() => toggleCategory(c)} />)}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기업 / 공식행사</p>
            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map((c) => <TagChip key={c} label={c} selected={selectedCategories.includes(c)} onToggle={() => toggleCategory(c)} />)}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">기타</p>
            <div className="flex flex-wrap gap-2">
              {OTHER_TAGS.map((c) => <TagChip key={c} label={c} selected={selectedCategories.includes(c)} onToggle={() => toggleCategory(c)} />)}
            </div>
          </div>
        </div>
      </Section>

      {/* ─── 6. 행사 가능 지역 ─── */}
      <Section title="행사 가능 지역">
        <div className="space-y-2">
          {REGIONS.map((r) => {
            const selected = selectedRegions.includes(r);
            return (
              <button
                key={r}
                onClick={() => toggleRegion(r)}
                className="w-full py-3 rounded-xl text-[14px] font-bold border-2 flex items-center justify-center gap-2 transition-colors"
                style={{
                  backgroundColor: selected ? '#EFF6FF' : '#FFFFFF',
                  borderColor: selected ? '#3180F7' : '#E5E7EB',
                  color: selected ? '#3180F7' : '#9CA3AF',
                }}
              >
                {selected && <Check size={16} className="text-[#3180F7] stroke-[3]" />}
                {r}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ─── 7. 프로필 사진 ─── */}
      <Section title="프로필 사진">
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={handleAddPhoto}
            className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 hover:border-[#3180F7]"
          >
            <Plus size={22} className="text-gray-400" />
            <span className="text-[11px] text-gray-400 font-medium">{photos.length}장</span>
          </button>
          {photos.map((photo, index) => (
            <div key={index} className="aspect-square relative rounded-xl overflow-hidden group">
              {mainPhotoIndex === index && (
                <div className="absolute top-1.5 left-1.5 bg-[#3180F7] text-white text-[10px] px-2 py-0.5 rounded-full z-10 font-bold flex items-center gap-0.5">
                  <Star size={8} className="fill-white" /> 대표
                </div>
              )}
              <img src={photo} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-1.5 gap-1.5 opacity-0 group-hover:opacity-100">
                <button onClick={() => setMainPhotoIndex(index)} className="px-2 py-1 bg-white/90 rounded-full text-[10px] font-bold text-gray-700">
                  대표설정
                </button>
              </div>
              <button onClick={() => handleRemovePhoto(index)} className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center z-10">
                <X size={12} className="text-white stroke-[2.5]" />
              </button>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── 8. 언어 ─── */}
      <Section title="언어">
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => <TagChip key={l} label={l} selected={languages.includes(l)} onToggle={() => toggleLanguage(l)} />)}
        </div>
      </Section>

      {/* ─── 9. 수상내역 ─── */}
      <Section title="수상내역">
        <textarea
          value={awards}
          onChange={(e) => setAwards(e.target.value)}
          placeholder="수상 이력을 자유롭게 입력해주세요"
          rows={3}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[16px] text-gray-900 outline-none focus:border-[#3180F7] resize-none"
        />
      </Section>

      {/* ─── 10. 소개영상 ─── */}
      <Section title="소개영상">
        <div className="space-y-3">
          {videos.map((url, i) => {
            const embedSrc = url.replace('watch?v=', 'embed/').replace('youtu.be/', 'www.youtube.com/embed/');
            return (
              <div key={i} className="relative">
                <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
                  <iframe src={embedSrc} className="w-full h-full" allowFullScreen title={`영상 ${i + 1}`} />
                </div>
                <button onClick={() => removeVideo(url)} className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white">
                  <X size={16} />
                </button>
              </div>
            );
          })}
          <button
            onClick={() => setShowYoutubeSearch(true)}
            className="w-full h-12 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center gap-2 text-[14px] font-medium text-gray-500 hover:border-[#3180F7] hover:text-[#3180F7]"
          >
            <Plus size={16} /> 영상 추가 (YouTube 검색)
          </button>
          <input
            type="url"
            placeholder="또는 YouTube 링크 직접 입력 (Enter)"
            className="w-full h-11 border border-gray-200 rounded-xl px-4 text-[14px] text-gray-900 outline-none focus:border-[#3180F7]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value;
                if (val.trim()) { addVideoUrl(val.trim()); (e.target as HTMLInputElement).value = ''; }
              }
            }}
          />
        </div>
      </Section>

      {/* ─── 11. 서비스/플랜 ─── */}
      <Section title="서비스 / 플랜">
        <div className="space-y-3">
          {services.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2 relative">
              <button onClick={() => removeService(i)} className="absolute top-2 right-2 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={12} className="text-gray-500" />
              </button>
              <input
                type="text"
                value={s.title}
                onChange={(e) => updateService(i, { title: e.target.value })}
                placeholder="플랜 이름 (예: Premium)"
                className="w-full text-[15px] font-bold text-gray-900 outline-none border-b border-gray-100 pb-2 pr-6"
              />
              <input
                type="number"
                value={s.basePrice}
                onChange={(e) => updateService(i, { basePrice: Number(e.target.value) })}
                placeholder="가격"
                className="w-full text-[14px] text-gray-700 outline-none"
              />
              <textarea
                value={s.description}
                onChange={(e) => updateService(i, { description: e.target.value })}
                placeholder="설명"
                rows={2}
                className="w-full text-[14px] text-gray-600 outline-none resize-none"
              />
            </div>
          ))}
          <button
            onClick={addService}
            className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[13px] font-bold text-gray-500 flex items-center justify-center gap-1"
          >
            <Plus size={14} /> 플랜 추가
          </button>
        </div>
      </Section>

      {/* ─── 12. FAQ ─── */}
      <Section title="FAQ">
        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-xl p-3 space-y-2 relative">
              <button onClick={() => removeFaqItem(index)} className="absolute top-2 right-2 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                <X size={12} className="text-gray-500" />
              </button>
              <input
                type="text"
                value={item.q}
                onChange={(e) => updateFaqItem(index, 'q', e.target.value)}
                placeholder="질문"
                className="w-full text-[15px] font-bold text-gray-900 outline-none border-b border-gray-100 pb-2 pr-6"
              />
              <textarea
                value={item.a}
                onChange={(e) => updateFaqItem(index, 'a', e.target.value)}
                placeholder="답변"
                rows={2}
                className="w-full text-[15px] text-gray-600 outline-none resize-none"
              />
            </div>
          ))}
          <button onClick={addFaqItem} className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[13px] font-bold text-gray-500 flex items-center justify-center gap-1">
            <Plus size={14} /> FAQ 항목 추가
          </button>
        </div>
      </Section>

      {/* ─── 13. 상세 HTML ─── */}
      <Section title="상세 HTML (detailHtml)">
        <textarea
          value={detailHtml}
          onChange={(e) => setDetailHtml(e.target.value)}
          placeholder="상세 설명 HTML"
          rows={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[13px] text-gray-900 outline-none focus:border-[#3180F7] resize-none font-mono"
        />
      </Section>

      {/* ─── Save Button ─── */}
      <div className="p-5 pb-10">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-[52px] bg-[#3180F7] hover:bg-[#2668d8] text-white font-bold rounded-2xl text-[15px] transition-colors active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장하기'}
        </button>
      </div>

      {/* ─── 전문가분류 바텀시트 ─── */}
      {showCategorySheet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowCategorySheet(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-2">전문가분류를 선택해주세요</h2>
            {['사회자', '쇼호스트', '축가/연주'].map((item) => (
              <button
                key={item}
                onClick={() => { setCategory(item); setShowCategorySheet(false); }}
                className={`w-full py-4 rounded-2xl mb-3 text-[18px] font-bold transition-all ${
                  category === item ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]' : 'bg-white border-2 border-gray-200 text-gray-400'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 경력 바텀시트 ─── */}
      {showCareerSheet && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowCareerSheet(false)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6 max-h-[60vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <h2 className="text-xl font-bold mb-4">경력을 선택해주세요</h2>
            <div className="flex-1 overflow-y-auto space-y-2 pb-4">
              {CAREER_YEARS.map((y) => (
                <button
                  key={y}
                  onClick={() => { setCareerYears(y); setShowCareerSheet(false); }}
                  className={`w-full py-3 rounded-xl text-[16px] font-bold transition-all ${
                    careerYears === y ? 'bg-blue-50 border-2 border-[#3180F7] text-[#3180F7]' : 'bg-white border-2 border-gray-100 text-gray-500'
                  }`}
                >
                  {y}년
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── YouTube 검색 모달 ─── */}
      {showYoutubeSearch && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}>
                <ChevronLeft size={24} className="text-gray-900" />
              </button>
              <h2 className="text-[18px] font-bold text-gray-900">YouTube 영상 검색</h2>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={ytChannelQuery}
                onChange={(e) => setYtChannelQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchYtChannels()}
                placeholder="채널명을 검색하세요"
                className="flex-1 h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 outline-none text-[16px] text-gray-900"
                autoFocus
              />
              <button onClick={searchYtChannels} className="h-11 px-4 bg-[#3180F7] text-white rounded-xl text-[14px] font-bold shrink-0">
                검색
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ytLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-[#3180F7] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!ytSelectedChannel && ytChannels.length > 0 && !ytLoading && (
              <div className="p-4">
                <p className="text-[12px] text-gray-400 font-bold uppercase mb-3">채널 선택</p>
                <div className="space-y-2">
                  {ytChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => loadYtVideos(ch.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 text-left"
                    >
                      <img src={ch.thumbnail} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-gray-900 truncate">{ch.title}</p>
                        <p className="text-[12px] text-gray-400 truncate">{ch.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {ytSelectedChannel && ytVideos.length > 0 && !ytLoading && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-gray-400 font-bold uppercase">영상 선택</p>
                  <button onClick={() => { setYtSelectedChannel(null); setYtVideos([]); }} className="text-[12px] text-[#3180F7] font-semibold">
                    채널 다시 선택
                  </button>
                </div>
                <div className="space-y-3">
                  {ytVideos.map((v) => {
                    const url = `https://www.youtube.com/watch?v=${v.id}`;
                    const already = videos.includes(url);
                    return (
                      <button
                        key={v.id}
                        onClick={() => { if (!already) addVideoUrl(url); }}
                        className={`w-full rounded-xl overflow-hidden border text-left ${already ? 'border-[#3180F7] bg-blue-50/30' : 'border-gray-100'}`}
                      >
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <img src={v.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                          {already && (
                            <div className="absolute top-2 right-2 w-7 h-7 bg-[#3180F7] rounded-full flex items-center justify-center">
                              <Check size={16} className="text-white stroke-[3]" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-[14px] font-semibold text-gray-900 line-clamp-2">{v.title}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {!ytLoading && !ytChannelQuery && ytChannels.length === 0 && (
              <div className="flex flex-col items-center py-16">
                <p className="text-[14px] text-gray-500 mt-4">채널명을 검색해주세요</p>
              </div>
            )}
          </div>
          {videos.length > 0 && (
            <div className="shrink-0 p-4 pb-8 bg-white border-t border-gray-100">
              <button
                onClick={() => { setShowYoutubeSearch(false); setYtChannels([]); setYtVideos([]); setYtSelectedChannel(null); setYtChannelQuery(''); }}
                className="w-full py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px]"
              >
                완료 ({videos.length}개 영상)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminRelationSummary({ relations }: { relations: any }) {
  const entries = [
    ['찜', relations?.favorites?.length || 0],
    ['채팅', relations?.chatRooms?.length || 0],
    ['견적', relations?.quotations?.length || 0],
    ['결제', relations?.payments?.length || 0],
    ['스케줄', relations?.schedules?.length || 0],
    ['매칭', relations?.matchDeliveries?.length || 0],
    ['리뷰', relations?.reviews?.length || 0],
    ['정산', relations?.settlementLogs?.length || 0],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {entries.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[10px] font-bold text-gray-400">{label}</p>
          <p className="mt-1 text-[18px] font-extrabold text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function AdminRelationGroup({ title, items, children }: { title: string; items: any[]; children: (item: any) => React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-extrabold text-gray-400 mb-2">{title}</p>
      {items.length === 0 ? (
        <p className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-3 text-[13px] text-gray-400">데이터가 없습니다</p>
      ) : (
        <div className="space-y-2">{items.slice(0, 20).map(children)}</div>
      )}
    </div>
  );
}

function AdminRelationRow({ title, meta, children }: { title: string; meta?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold text-gray-900 truncate">{title}</p>
        {meta && <p className="text-[11px] text-gray-500 truncate mt-0.5">{meta}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

function AdminStatusSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-gray-200 px-2 text-[12px] font-bold text-gray-700 bg-white"
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}
