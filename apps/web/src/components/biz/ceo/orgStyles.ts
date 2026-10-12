/*
 * ⑤ 조직도 CSS(261012 사장 '조직도 이런느낌으로' — 흰 카드 조직도: 가운데 대표 카드 · 머리선 · 그 아래 사람 카드 격자).
 * 클래스 앞머리 cxo-(styles.ts 의 cx- 와 겹치지 않게). CeoOrg 가 자기 <style> 로 그린다.
 * 색 · 곡선은 CEO 화면 공통 값 — 본문 #191F28 · 보조 #4E5968 · 선 #E5E8EB · 파랑 #3182F6 · 곡선 var(--ez).
 *   작은 회색 글자(직함 · 말풍선 머리말 · 설명 문단)는 #6B7684 — 흰 바탕 4.6:1(AA). #8B95A1(3.0:1)은 쓰지 않는다(261012 검수).
 * 카드 = 흰 바탕 · 얇은 테 · 아주 옅은 그림자, 동그란 얼굴이 카드 왼쪽 위 모서리에 반쯤 걸친다(흰 고리로 테를 끊는다).
 * 칸 수: 폰 2 · 560~ 2 · 900~ 3 · 1200~ 4(마지막 줄 가운데 — 참고 화면처럼).
 */
export const ORG_CSS = `
.cxo{--gx:12px;--gy:50px;--cols:2;--av:54px;--pad:14px;--cw:calc((100% - (var(--cols) - 1) * var(--gx)) / var(--cols));margin-top:calc(44px + var(--av) / 2)}
@media (min-width:560px){.cxo{--gx:16px;--gy:58px;--av:60px;--pad:18px}}
@media (min-width:900px){.cxo{--gx:20px;--gy:62px;--cols:3;--av:64px;--pad:20px;margin-top:calc(64px + var(--av) / 2)}}
@media (min-width:1200px){.cxo{--gx:24px;--gy:66px;--cols:4;--av:68px;--pad:22px}}

/* 카드 */
.cxo-card{position:relative;box-sizing:border-box;min-width:0;padding:calc(var(--av) / 2 + 16px) var(--pad) calc(var(--pad) + 2px);border:1px solid #E5E8EB;border-radius:16px;background:#fff;text-align:left;
  box-shadow:0 1px 2px rgba(2,32,71,.03),0 14px 30px -20px rgba(2,32,71,.18)}
.cxo-card[data-open]{z-index:4}
.cxo-av{position:absolute;left:calc(var(--pad) - 2px);top:calc(var(--av) / -2);width:var(--av);height:var(--av);border-radius:50%;overflow:hidden;background:#D7DBE0;
  box-shadow:0 0 0 4px #fff,0 4px 10px -6px rgba(2,32,71,.18)}
/* (261012 검수) 얼굴 그림자를 카드 그림자(.18)보다 옅게 — 진하면 흰 고리 밑에 회색 초승달이 생겨 스티커처럼 떠 보였다 */
/* 누끼 사진은 옅은 회청 원 위에 — 회색 스튜디오 사진(김도윤 #D4DADF · 박수용 #DEDCDC 안팎)과 나란히 놓여도 튀지 않게(261012 검수로 한 톤 낮춤) */
.cxo-av[data-cut]{background:radial-gradient(circle at 50% 30%,#EEF2F6 0%,#E2E7ED 65%,#D8DEE5 100%)}
/* 얼굴 맞추기 — --x · --y = 원 가운데가 올 사진 속 자리(가로 · 세로 비율), --s = 원 지름이 사진 가로의 몇 배인지 */
.cxo-av img{position:absolute;max-width:none;width:calc(100% / var(--s));height:auto;left:calc(50% - var(--x) * 100% / var(--s));top:calc(50% - var(--y) * 133.333% / var(--s));user-select:none;-webkit-user-drag:none}
.cxo-av b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:.04em;color:#4E5968}
.cxo-n{display:block;margin:0;font-size:16px;line-height:1.4;font-weight:700;letter-spacing:-0.02em;color:#191F28}
/* 두 줄로 접힐 때 줄 길이를 고르게(일본어 'マーケティング本部 / 長' 처럼 한 글자만 넘어가지 않게)
 * 색 #6B7684(흰 바탕 4.6:1 — 작은 글자 AA, 아래 설명 문단과 같은 색). #8B95A1 은 3.0:1 이라 못 미쳤다(261012 검수) */
.cxo-r{display:block;margin:3px 0 0;font-size:13px;line-height:1.45;font-weight:500;color:#6B7684;word-break:keep-all;overflow-wrap:anywhere;text-wrap:balance}
@media (max-width:379.98px){.cxo{--pad:12px}.cxo-r{font-size:12.5px}}
@media (min-width:560px){.cxo-n{font-size:17px}.cxo-r{font-size:13.5px}}
@media (min-width:900px){.cxo-n{font-size:18px}.cxo-r{margin-top:4px;font-size:14px}}
/* 1200~ 이름 · 직함 크기 차이를 참고 화면 비율(≈1.45)에 가깝게 — 267px 카드에서 세 글자 이름이 작아 보였다(261012 검수) */
@media (min-width:1200px){.cxo-n{font-size:19px;letter-spacing:-.025em}.cxo-r{font-size:13.5px}}
/* 대표 카드 — 같은 카드, 한 칸 넓이(폰에선 조금 넓게) · 얼굴 조금 크게 */
.cxo-top{display:flex;justify-content:center;margin-top:4px}
.cxo-top .cxo-card{width:min(100%,max(var(--cw),236px));--av:60px}
.cxo-top .cxo-n{font-size:18px}
@media (min-width:560px){.cxo-top .cxo-card{--av:66px}}
@media (min-width:900px){.cxo-top .cxo-card{--av:72px}.cxo-top .cxo-n{font-size:20px}}
@media (min-width:1200px){.cxo-top .cxo-card{--av:76px}.cxo-top .cxo-n{font-size:21px}}

/* ⋯ 단추 + 산하 팀 말풍선 */
.cxo-more{position:absolute;top:8px;right:8px}
.cxo-btn{display:flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0;border:0;border-radius:10px;background:transparent;color:#4E5968;cursor:pointer;
  transition:background-color .2s ease,color .2s ease,transform .25s var(--ez);-webkit-tap-highlight-color:transparent}
.cxo-btn svg{display:block;width:20px;height:20px}
@media (hover:hover){.cxo-btn:hover{background:#F2F4F6;color:#191F28}}
.cxo-btn:active{transform:scale(.9)}
.cxo-btn[aria-expanded="true"]{background:#F2F4F6;color:#191F28}
.cxo-btn:focus{outline:none}
.cxo-btn:focus-visible{outline:2px solid #3182F6;outline-offset:2px}
/* 단추 칸(34px)이 기준이라 폭은 내용대로(max-content) — 안 그러면 줄어든 폭에 팀 이름이 접힌다 */
.cxo-pop{position:absolute;top:calc(100% + 6px);right:0;z-index:5;box-sizing:border-box;width:max-content;min-width:168px;max-width:min(300px,calc(100vw - 32px));padding:12px 6px 6px;
  overflow-y:auto;overscroll-behavior:contain;
  border:1px solid #EEF0F3;border-radius:16px;background:#fff;text-align:left;
  box-shadow:0 2px 6px rgba(2,32,71,.05),0 22px 44px -18px rgba(2,32,71,.3);
  transform-origin:calc(100% - 17px) -6px;opacity:0;visibility:hidden;transform:translate3d(var(--dx,0px),-4px,0) scale(.9);
  transition:opacity .16s ease,transform .2s var(--ez),visibility 0s linear .2s}
.cxo-pop[data-open]{opacity:1;visibility:visible;transform:translate3d(var(--dx,0px),0,0) scale(1);transition:opacity .2s ease,transform .34s var(--ez),visibility 0s}
/* 위로 열기 — 아래 자리가 모자랄 때(폰 하단 탭바, CeoOrg 가 data-up 을 붙인다 · 261012 검수). 단추 아래 모서리에서 자란다 */
.cxo-pop[data-up]{top:auto;bottom:calc(100% + 6px);transform-origin:calc(100% - 17px) calc(100% + 6px);transform:translate3d(var(--dx,0px),4px,0) scale(.9)}
.cxo-pop[data-up][data-open]{transform:translate3d(var(--dx,0px),0,0) scale(1)}
.cxo-pop:focus{outline:none}
/* 머리말 = '이름 · 산하 팀' — 색은 직함과 같은 #6B7684(AA) */
.cxo-pop-h{display:block;margin:0;padding:0 12px 6px;font-size:12.5px;line-height:1.4;font-weight:600;color:#6B7684}
.cxo-pop-h b{font-weight:700;color:#4E5968}
.cxo-pop ul{list-style:none;margin:0;padding:0}
.cxo-pop-t{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 12px;border-radius:10px;font-size:15px;font-weight:600;color:#191F28;white-space:nowrap}
.cxo-pop-t::before{content:'';flex:none;width:6px;height:6px;border-radius:50%;background:#3182F6}
/* 대표 말풍선 — 부문마다 두 줄(코드 · 이름 / 산하 팀) */
.cxo-pop-u{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:4px;padding:8px 12px;border-radius:10px}
.cxo-pop-u b{font-size:12px;line-height:22px;font-weight:700;letter-spacing:.04em;color:#3182F6}
.cxo-pop-u span{font-size:15px;line-height:22px;font-weight:600;color:#191F28;white-space:nowrap}
.cxo-pop-u small{grid-column:2;font-size:13px;line-height:1.45;color:#6B7684}

/* 머리선 — 대표 카드 아래 작은 꺾쇠 · 가운데에서 양쪽으로 그어진다 */
.cxo-rule{display:flex;align-items:flex-end;height:8px;margin:36px 0 calc(var(--av) / 2 + 30px)}
.cxo-rule-l,.cxo-rule-r{flex:1 1 0;height:1px;background:#E5E8EB}
.cxo-rule-l{transform-origin:100% 50%}
.cxo-rule-r{transform-origin:0 50%}
.cxo-caret{flex:none;display:block;width:16px;height:8px;color:#D9DEE4;transform-origin:50% 100%}
@media (min-width:900px){.cxo-rule{margin-top:44px}}

/* 사람 카드 격자 — 줄바꿈 flex 라 마지막 줄이 가운데로 온다 */
.cxo-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--gy) var(--gx);margin:0;padding:0;list-style:none}
.cxo-grid>.cxo-card{flex:0 0 var(--cw)}

/* 들어올 때 — 대표 카드 → 선(가운데에서 양쪽) → 카드 차례로 */
.cxo .cxo-card{opacity:0;transform:translate3d(0,22px,0);transition:opacity .7s var(--ez),transform .9s var(--ez);transition-delay:var(--d,0ms)}
.cxo-rule-l,.cxo-rule-r{transform:scaleX(0);transition:transform 1s var(--ez) .26s}
.cxo-caret{opacity:0;transform:scale(.4);transition:opacity .4s ease .18s,transform .5s var(--ez) .18s}
.cxo-grid>.cxo-card{--d:calc(520ms + var(--i,0) * 80ms)}
.cxo[data-in] .cxo-card{opacity:1;transform:none}
.cxo[data-in] .cxo-rule-l,.cxo[data-in] .cxo-rule-r{transform:none}
.cxo[data-in] .cxo-caret{opacity:1;transform:none}

.cxo-cap{margin:56px 0 0;font-size:15px;line-height:1.7;color:#6B7684;text-align:center;word-break:keep-all}
@media (min-width:900px){.cxo-cap{margin-top:64px;font-size:16px}}

/* 스크립트가 꺼진 브라우저 — 들어올 때 움직임을 걸 수 없으니 처음부터 보이게(261012 검수) */
@media (scripting:none){.cxo .cxo-card{opacity:1;transform:none}.cxo-rule-l,.cxo-rule-r,.cxo-caret{opacity:1;transform:none}}

@media (prefers-reduced-motion:reduce){
  .cxo .cxo-card,.cxo-rule-l,.cxo-rule-r,.cxo-caret{opacity:1!important;transform:none!important;transition:none!important}
  .cxo-pop,.cxo-btn{transition:none!important}
  .cxo-pop{transform:translate3d(var(--dx,0px),0,0)!important}
}
`;
