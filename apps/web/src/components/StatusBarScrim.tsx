'use client';

// 상태바 가림판(261014 iOS 앱 화면 끝까지) — 고정·sticky 머리가 없는 화면에서 스크롤한 내용이 상태바 글자 밑으로 지나가지 않게.
//  · 높이 = var(--ft-sat) → iOS 앱에서만 상태바 높이, 안드·사파리·옛 앱은 0 이라 안 보인다.
//  · 머리가 있는 화면엔 쓰지 않는다(머리가 padding-top 으로 상태바 칸을 칠한다). 사진을 상태바 밑까지 까는 화면에도 쓰지 않는다.
export default function StatusBarScrim({ color = '#fff' }: { color?: string }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[45]"
      style={{ height: 'var(--ft-sat, 0px)', background: color }}
    />
  );
}
