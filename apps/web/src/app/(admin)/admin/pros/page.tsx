'use client';

import { useState, useEffect } from 'react';
import { Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight, Check, X, Edit3 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { apiClient } from '@/lib/api/client';

interface ProItem {
  id: string;
  name: string;
  email: string;
  status: string;
  showPartnersLogo: boolean;
  image: string;
  avgRating: number;
  reviewCount: number;
  isFeatured: boolean;
}

const statusLabel: Record<string, { text: string; className: string }> = {
  approved: { text: '승인', className: 'bg-green-50 text-green-600' },
  pending: { text: '대기', className: 'bg-yellow-50 text-yellow-600' },
  rejected: { text: '반려', className: 'bg-red-50 text-red-600' },
  draft: { text: '임시저장', className: 'bg-gray-50 text-gray-500' },
};

async function adminFetch(method: string, path: string, body?: any) {
  const res = await apiClient.request({ method, url: path, data: body });
  return res.data;
}

export default function AdminProsPage() {
  const [pros, setPros] = useState<ProItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('전체');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editingPro, setEditingPro] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const LIMIT = 20;

  const fetchPros = async (p = page, s = search, st = filterStatus) => {
    setLoading(true);
    try {
      const params: any = { page: p, limit: LIMIT };
      if (s) params.search = s;
      if (st !== '전체') params.status = st;
      const data = await adminFetch('GET', `/api/v1/admin/pros?${new URLSearchParams(params).toString()}`);
      setPros(data.data || []);
      setTotal(data.total || 0);
    } catch {
      toast.error('목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPros(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/approve`);
      toast.success('승인되었습니다');
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, status: 'approved' } : p));
    } catch { toast.error('승인 실패'); }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('반려 사유 (선택)') || undefined;
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/reject`, { reason });
      toast.success('반려되었습니다');
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, status: 'rejected' } : p));
    } catch { toast.error('반려 실패'); }
  };

  const handleToggleLogo = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/toggle-logo`);
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, showPartnersLogo: !p.showPartnersLogo } : p));
    } catch { toast.error('변경 실패'); }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${id}/featured`);
      setPros((prev) => prev.map((p) => p.id === id ? { ...p, isFeatured: !p.isFeatured } : p));
    } catch { toast.error('변경 실패'); }
  };

  const openEdit = async (id: string) => {
    try {
      const detail = await adminFetch('GET', `/api/v1/admin/pros/${id}`);
      setEditingPro(detail);
      setEditForm({
        name: detail.user?.name || '',
        phone: detail.user?.phone || '',
        gender: detail.gender || '',
        shortIntro: detail.shortIntro || '',
        mainExperience: detail.mainExperience || '',
        careerYears: detail.careerYears || 0,
        awards: detail.awards || '',
        youtubeUrl: detail.youtubeUrl || '',
        detailHtml: detail.detailHtml || '',
        basePrice: detail.basePrice || 0,
        isFeatured: detail.isFeatured,
        showPartnersLogo: detail.showPartnersLogo,
        status: detail.status,
      });
    } catch { toast.error('상세 조회 실패'); }
  };

  const saveEdit = async () => {
    if (!editingPro) return;
    try {
      await adminFetch('PATCH', `/api/v1/admin/pros/${editingPro.id}`, editForm);
      toast.success('저장되었습니다');
      setEditingPro(null);
      fetchPros();
    } catch { toast.error('저장 실패'); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold text-gray-900">전문가 관리</h1>
        <span className="ml-auto text-sm text-gray-400">총 {total}명</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchPros(1, search, filterStatus); } }}
              placeholder="전문가 이름 검색 (Enter)"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['전체', 'pending', 'approved', 'rejected'].map((st) => (
              <button
                key={st}
                onClick={() => { setFilterStatus(st); setPage(1); fetchPros(1, search, st); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterStatus === st ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {st === '전체' ? '전체' : st === 'pending' ? '대기' : st === 'approved' ? '승인' : '반려'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">전문가</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">이메일</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">상태</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">평점</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">리뷰</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">로고</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">추천</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">로딩 중...</td></tr>
              ) : pros.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">검색 결과가 없습니다</td></tr>
              ) : pros.map((pro) => (
                <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={pro.image || '/images/placeholder.avif'} alt={pro.name} className="w-10 h-10 rounded-full object-cover bg-gray-100" />
                      <Link href={`/pros/${pro.id}`} target="_blank" className="text-sm font-semibold text-gray-900 hover:text-blue-500">{pro.name}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{pro.email}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusLabel[pro.status]?.className || 'bg-gray-100 text-gray-500'}`}>
                      {statusLabel[pro.status]?.text || pro.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium text-gray-900">{pro.avgRating?.toFixed(1) || '-'}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">{pro.reviewCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <button onClick={() => handleToggleLogo(pro.id)} className="transition-colors">
                        {pro.showPartnersLogo
                          ? <ToggleRight size={28} className="text-blue-500" />
                          : <ToggleLeft size={28} className="text-gray-300" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center">
                      <button onClick={() => handleToggleFeatured(pro.id)} className="transition-colors">
                        {pro.isFeatured
                          ? <ToggleRight size={28} className="text-amber-500" />
                          : <ToggleLeft size={28} className="text-gray-300" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      <button
                        onClick={() => openEdit(pro.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                      >
                        <Edit3 size={12} /> 수정
                      </button>
                      {pro.status !== 'approved' && (
                        <button
                          onClick={() => handleApprove(pro.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                        >
                          <Check size={12} /> 승인
                        </button>
                      )}
                      {pro.status !== 'rejected' && (
                        <button
                          onClick={() => handleReject(pro.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                        >
                          <X size={12} /> 반려
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">총 {total}명 ({page}/{totalPages})</p>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => { const p = page - 1; setPage(p); fetchPros(p); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg">{page}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => { const p = page + 1; setPage(p); fetchPros(p); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPro && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEditingPro(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">전문가 프로필 수정</h2>
              <button onClick={() => setEditingPro(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-5 grid grid-cols-2 gap-4">
              <Field label="이름" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
              <Field label="전화번호" value={editForm.phone} onChange={(v) => setEditForm({ ...editForm, phone: v })} />
              <Field label="성별" value={editForm.gender} onChange={(v) => setEditForm({ ...editForm, gender: v })} />
              <Field label="경력(년)" type="number" value={editForm.careerYears} onChange={(v) => setEditForm({ ...editForm, careerYears: Number(v) })} />
              <Field label="기본 가격" type="number" value={editForm.basePrice} onChange={(v) => setEditForm({ ...editForm, basePrice: Number(v) })} />
              <SelectField label="상태" value={editForm.status} options={['draft', 'pending', 'approved', 'rejected']} onChange={(v) => setEditForm({ ...editForm, status: v })} />
              <div className="col-span-2">
                <Field label="한 줄 소개" value={editForm.shortIntro} onChange={(v) => setEditForm({ ...editForm, shortIntro: v })} />
              </div>
              <div className="col-span-2">
                <TextareaField label="주요 경력" value={editForm.mainExperience} onChange={(v) => setEditForm({ ...editForm, mainExperience: v })} />
              </div>
              <div className="col-span-2">
                <TextareaField label="수상/자격" value={editForm.awards} onChange={(v) => setEditForm({ ...editForm, awards: v })} />
              </div>
              <div className="col-span-2">
                <Field label="YouTube URL" value={editForm.youtubeUrl} onChange={(v) => setEditForm({ ...editForm, youtubeUrl: v })} />
              </div>
              <div className="col-span-2">
                <TextareaField label="상세 HTML" value={editForm.detailHtml} onChange={(v) => setEditForm({ ...editForm, detailHtml: v })} rows={5} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isFeatured} onChange={(e) => setEditForm({ ...editForm, isFeatured: e.target.checked })} />
                추천 노출
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.showPartnersLogo} onChange={(e) => setEditForm({ ...editForm, showPartnersLogo: e.target.checked })} />
                파트너 로고
              </label>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-2 justify-end">
              <button onClick={() => setEditingPro(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200">취소</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: any; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 3 }: { label: string; value: any; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <textarea
        value={value ?? ''}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: any; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
