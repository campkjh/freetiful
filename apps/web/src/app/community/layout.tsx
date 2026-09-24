import type { Metadata } from 'next';
import './community.css';

export const metadata: Metadata = {
  title: '프리티풀 커뮤니티',
  description: '예식·행사 사회자와 예비부부가 함께하는 프리티풀 커뮤니티',
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <div className="fcom">{children}</div>;
}
