import { ChevronRight } from 'lucide-react';

export default function ReceptionBannerCopy({ pc, active, leaving }: { pc: boolean; active: boolean; leaving: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute w-[62%] text-left tracking-[0] ${pc ? 'left-9 top-8' : 'left-4 top-3 max-[359px]:top-1.5'}`}
      style={active ? { animation: 'fadeSlideUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both' } : { opacity: leaving ? 1 : 0 }}
    >
      <span className={`block font-medium leading-[1.4] text-[#F3DDB2] ${pc ? 'text-[18px]' : 'text-[12px] max-[359px]:text-[10px]'}`}>Freetiful &amp; WMAK</span>
      <span className={`block font-serif font-medium leading-[1.1] text-[#F3DDB2] ${pc ? 'mt-2 text-[34px]' : 'mt-1 text-[20px] max-[359px]:mt-0.5 max-[359px]:text-[16px]'}`}>
        <span className="block">2026 Year-End</span>
        <span className="block">RECEPTION</span>
      </span>
      <span className={`block font-semibold leading-[1.5] text-white ${pc ? 'mt-5 text-[16px]' : 'mt-1.5 text-[11px] max-[359px]:mt-0.5 max-[359px]:text-[10px]'}`}>
        11월 23일 (월) 17:30–21:00
      </span>
      <span className={`block font-normal leading-[1.5] text-white/85 ${pc ? 'mt-1 text-[14px]' : 'text-[10px] max-[359px]:text-[9px]'}`}>
        청담 리베라호텔 3F{pc ? <br /> : ' '}베르사이유 홀
      </span>
      {pc && <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[#F3DDB2]">식순 · 내 자리 보기<ChevronRight size={15} /></span>}
    </span>
  );
}
