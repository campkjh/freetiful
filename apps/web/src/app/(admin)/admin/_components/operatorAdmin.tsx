'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/lib/store/auth.store';
import { adminFetch } from './adminFetch';

/* ────────────────────────────────────────────────────────────
 * 운영 콘텐츠(261004) 공용 — 운영 프로필 · 운영 글 · 반응 수치 · 변경 이력
 *  · 운영 글은 늘 운영 프로필(전용 계정)로 올라가고 앱에선 '운영팀' 표시가 붙는다(회원 사칭 없음).
 *  · 테스트 좋아요·조회수는 서버가 개발·스테이징(APP_ENV)일 때만 — 운영 서버는 API 가 404.
 * ──────────────────────────────────────────────────────────── */

export type PostStatus = 'published' | 'draft' | 'scheduled' | 'private';

export interface OperatorProfile {
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  posts: Record<PostStatus, number>;
  lastPostAt: string | null;
}

export interface RealStats {
  likes: number;
  likesByType: Record<string, number>;
  comments: number;
  replies: number;
  views: number;
}

export const STATUS_LABEL: Record<string, string> = { published: '게시됨', draft: '임시저장', scheduled: '예약', private: '비공개' };
export const STATUS_TONE: Record<string, string> = { published: 'green', draft: '', scheduled: 'blue', private: 'orange' };

/** 리액션 6종 — 앱과 같은 이름 */
export const REACTION_LABEL: Record<string, string> = { heart: '좋아요', laugh: '웃겨요', smile: '훈훈해요', sad: '슬퍼요', devil: '화나요', skull: '헉' };

/** 서버 환경 — 테스트 수치 화면을 보여줄지 */
export function useOperatorEnv() {
  const [env, setEnv] = useState<{ appEnv: string; testMetricsEnabled: boolean } | null>(null);
  useEffect(() => {
    adminFetch('GET', '/api/v1/admin/operator/env')
      .then((d) => setEnv(d))
      .catch(() => setEnv({ appEnv: 'production', testMetricsEnabled: false }));
  }, []);
  return env;
}

export const ENV_LABEL: Record<string, string> = { production: '운영', staging: '스테이징', development: '개발' };

/** 사진 올리기 — 어드민 이미지 업로드(editor-images) → URL */
export async function uploadAdminImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('사진 파일만 올릴 수 있어요');
  if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하 사진만 올릴 수 있어요');
  const form = new FormData();
  form.append('file', file, file.name || 'image');
  const token = useAuthStore.getState().accessToken;
  const adminKey = typeof window !== 'undefined' ? localStorage.getItem('admin-key') || '' : '';
  const DIRECT = process.env.NEXT_PUBLIC_DIRECT_API_URL || 'https://affectionate-smile-production-6535.up.railway.app';
  const res = await axios.post<{ url: string }>(`${DIRECT}/api/v1/admin/editor-images`, form, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(adminKey ? { 'x-admin-key': adminKey } : {}) },
    timeout: 60000,
  });
  if (!res.data?.url) throw new Error('서버가 사진 주소를 주지 않았어요');
  return res.data.url;
}

/** 프로필 동그라미 */
export function OpAvatar({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="adm-op-ava" style={{ width: size, height: size }} />
  ) : (
    <span className="adm-op-ava none" style={{ width: size, height: size }}>{(name || '운').slice(0, 1)}</span>
  );
}

/** 'datetime-local'(KST 로 입력) ↔ ISO */
export function kstLocalToIso(v: string): string {
  if (!v) return '';
  return new Date(`${v}:00+09:00`).toISOString();
}
export function isoToKstLocal(iso?: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime() + 9 * 3600000;
  return new Date(t).toISOString().slice(0, 16);
}

/** 변경 이력 동작 이름 */
export const ACTION_LABEL: Record<string, string> = {
  'operator_profile.create': '운영 프로필 생성',
  'operator_profile.update': '운영 프로필 수정',
  'operator_profile.activate': '운영 프로필 다시 사용',
  'operator_profile.deactivate': '운영 프로필 쉬기',
  'operator_post.create': '운영 글 임시저장',
  'operator_post.update': '운영 글 수정',
  'operator_post.publish': '운영 글 게시',
  'operator_post.schedule': '운영 글 예약',
  'operator_post.unschedule': '운영 글 예약 취소',
  'operator_post.visibility': '운영 글 공개/비공개',
  'operator_post.delete': '운영 글 삭제',
  'metric.view_correction': '조회수 보정',
  'test_metric.set': '테스트 수치 설정',
  'test_metric.reset': '테스트 수치 초기화',
  'test_metric.reset_all': '테스트 수치 전체 초기화',
  'community.post_visibility': '커뮤니티 글 숨김/보이기',
  'community.post_delete': '커뮤니티 글 삭제',
  'community.comment_visibility': '커뮤니티 댓글 숨김/보이기',
  'community.report_resolve': '커뮤니티 신고 처리',
  'community.nickname_change': '웨딩숲 닉네임 변경',
  'community.nickname_reset': '웨딩숲 닉네임 원래대로',
  'pro.quick_match': '퀵매칭 노출 변경',
};

/** 변경 전후 값 보기용 — 키 이름 */
export const FIELD_LABEL: Record<string, string> = {
  nickname: '이름',
  avatarUrl: '사진',
  bio: '소개',
  isActive: '노출/사용',
  title: '제목',
  content: '본문',
  groupId: '카테고리',
  imageUrls: '사진',
  status: '상태',
  publishAt: '예약 시각',
  profileId: '운영 프로필',
  views: '조회수',
  likes: '좋아요',
  publishedAt: '게시 시각',
  createdAt: '게시 시각',
  reason: '신고 사유',
  reportId: '신고',
  hidTarget: '대상 숨김',
  closedReports: '함께 닫은 신고',
  deleted: '지운 개수',
  userId: '계정',
  stats: '반응',
  custom: '직접 정한 닉네임',
  quickMatchDesignated: '퀵매칭 노출',
  quickMatchGender: '첫 화면 묶음',
};
