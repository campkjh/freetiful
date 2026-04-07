'use client';

import { useState } from 'react';
import { ArrowLeft, Search, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface ProItem {
  id: string;
  name: string;
  category: string;
  status: string;
  showPartnersLogo: boolean;
  image: string;
  rating: number;
  reviewCount: number;
}

const MOCK_ADMIN_PROS: ProItem[] = [
  { id: '1', name: '김민준', category: 'MC', status: 'approved', showPartnersLogo: true, image: 'https://i.pravatar.cc/100?img=1', rating: 4.9, reviewCount: 142 },
  { id: '2', name: '이서연', category: 'MC', status: 'approved', showPartnersLogo: false, image: 'https://i.pravatar.cc/100?img=5', rating: 4.8, reviewCount: 98 },
  { id: '3', name: '박준혁', category: '가수', status: 'approved', showPartnersLogo: true, image: 'https://i.pravatar.cc/100?img=3', rating: 5.0, reviewCount: 67 },
  { id: '4', name: '최지은', category: '쇼호스트', status: 'pending', showPartnersLogo: false, image: 'https://i.pravatar.cc/100?img=9', rating: 4.7, reviewCount: 55 },
  { id: '5', name: '정대현', category: 'MC', status: 'approved', showPartnersLogo: false, image: 'https://i.pravatar.cc/100?img=11', rating: 4.9, reviewCount: 89 },
  { id: '6', name: '한소희', category: '가수', status: 'approved', showPartnersLogo: true, image: 'https://i.pravatar.cc/100?img=20', rating: 4.6, reviewCount: 43 },
];

export default function AdminProsPage() {
  const [pros, setPros] = useState<ProItem[]>(MOCK_ADMIN_PROS);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('전체');

  const filtered = pros.filter((p) => {
    if (filterCategory !== '전체' && p.category !== filterCategory) return false;
    if (search && !p.name.includes(search)) return false;
    return true;
  });

  const handleTogglePartnersLogo = (proId: string) => {
    setPros((prev) =>
      prev.map((p) =>
        p.id === proId ? { ...p, showPartnersLogo: !p.showPartnersLogo } : p
      )
    );
    // TODO: API 호출 - PATCH /admin/pros/:id { showPartnersLogo: boolean }
  };

  const statusLabel: Record<string, { text: string; className: string }> = {
    approved: { text: '승인', className: 'bg-green-50 text-green-600' },
    pending: { text: '대기', className: 'bg-yellow-50 text-yellow-600' },
    rejected: { text: '반려', className: 'bg-red-50 text-red-600' },
    draft: { text: '임시저장', className: 'bg-gray-50 text-gray-500' },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-1 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-lg font-bold text-gray-900">전문가 관리</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="전문가 이름 검색"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300"
              />
            </div>
            <div className="flex gap-2">
              {['전체', 'MC', '가수', '쇼호스트'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterCategory === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat}
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">전문가</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">카테고리</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">상태</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">평점</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">리뷰</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">파트너스 로고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((pro) => (
                  <tr key={pro.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={pro.image}
                          alt={pro.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <Link href={`/pros/${pro.id}`} className="text-sm font-semibold text-gray-900 hover:text-primary-500">
                          {pro.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{pro.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusLabel[pro.status]?.className || ''}`}>
                        {statusLabel[pro.status]?.text || pro.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-gray-900">{pro.rating}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-600">{pro.reviewCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleTogglePartnersLogo(pro.id)}
                          className="transition-colors"
                          title={pro.showPartnersLogo ? '파트너스 로고 비활성화' : '파트너스 로고 활성화'}
                        >
                          {pro.showPartnersLogo ? (
                            <ToggleRight size={32} className="text-primary-500" />
                          ) : (
                            <ToggleLeft size={32} className="text-gray-300" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">검색 결과가 없습니다</p>
            </div>
          )}

          {/* Pagination */}
          <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-gray-500">총 {filtered.length}명</p>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-1 text-xs font-medium bg-primary-50 text-primary-600 rounded-lg">1</span>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
