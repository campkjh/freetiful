import type { Metadata } from 'next';
import EmailAuthFlow from '../EmailAuthFlow';

export const metadata: Metadata = { title: '이메일로 가입 | 프리티풀' };

export default function EmailSignupPage() {
  return <EmailAuthFlow initialMode="signup" />;
}
