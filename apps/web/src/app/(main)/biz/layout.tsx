import LanguageToggle from '@/components/biz/LanguageToggle';

export default function BizLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <LanguageToggle />
    </>
  );
}
