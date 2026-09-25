import type { Metadata } from 'next';
import './community.css';
import CommunityLoginSheet from '@/components/community/CommunityLoginSheet';

export const metadata: Metadata = {
  title: '프리티풀 웨딩숲',
  description: '예식·행사 사회자와 예비부부가 함께하는 프리티풀 웨딩숲',
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fcom">
      {children}
      <CommunityLoginSheet />
    </div>
  );
}
