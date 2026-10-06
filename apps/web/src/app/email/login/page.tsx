import type { Metadata } from 'next';
import EmailAuthFlow from '../EmailAuthFlow';

export const metadata: Metadata = { title: '이메일로 로그인 | 프리티풀' };

export default function EmailLoginPage() {
  return <EmailAuthFlow initialMode="login" />;
}
