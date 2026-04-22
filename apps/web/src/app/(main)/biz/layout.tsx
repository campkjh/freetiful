import { BizLangProvider } from '@/lib/biz/i18n';

export default function BizLayout({ children }: { children: React.ReactNode }) {
  return <BizLangProvider>{children}</BizLangProvider>;
}
