/*
 * ③ 경영 철학 카드 04 오른쪽 폰 — AI 키워드 판 → 리뷰 화면(CeoReviewPhone, 261013 사장 '…AI 애니메이션 … 슝슝 뜨는거 그거가 나오면서 리뷰 ui로').
 * 클래스 앞머리 cxv-(styles.ts 의 cx- 와 겹치지 않게). CeoValues 가 자기 <style> 로 그린다.
 * 판 = 390 디자인 px(캡처 css px) — 폰 화면 폭에 맞춰 scale(--cxv-s) 로 줄이고, 높이(--cxv-h)는 화면 비율대로 조금 길다.
 *   위 40 = 상태 막대 자리(폰 섬이 머리줄 이름을 가리지 않게) · 40~156 = 캡처 머리줄 + 탭 · 156~ = 본문(띠 · 판).
 *   키워드 판 칸 = 350×380.3 · 왼쪽 20 · 띠 안 위 끝 317.8(캡처에서 잰 값 — CeoReviewPhone 의 SLICES 와 같이 본다).
 *   판 차례엔 판 칸 위 끝을 본문 84 에 둔다 — 원이 화면 가운데쯤(데스크톱은 폰 아래쪽이 카드 바닥 글자 막(그라데이션 · 블러)에 걸려
 *   한가운데 두면 아래 칩이 흐려졌다, 261013 검증). 리뷰 화면은 띠를 96 올린 자리에서 시작(머리줄 바로 밑 AI 요약 카드 전체 → 그 아래 판)
 *   → 판은 138 내려앉아 캡처 속 제자리(본문 221.8)에 닿고, 닿자마자 띠와 판 층이 함께 리뷰 줄 쪽으로 굴러간다(쉬는 틈 없이 한 흐름).
 * 움직임은 transform · opacity 뿐(카드 쌓기 스크롤을 건드리지 않게). 흐림(filter)은 위 조각이 들어오는 0.75초 동안만.
 *
 * 261013 검토 반영
 *  · .cxv-screen — 오른쪽 폰 화면 칸을 .cxv 의 기준 칸으로(position:relative). 전엔 기준이 폰 몸체(.cx-vc-phone)라 .cxv 가 베젤까지 덮고
 *    둥근 모서리로 잘리지 않아 '네모난 흰 판'으로 보였다(배율도 214/390 로 틀렸다 → 지금 204/390). styles.ts 는 건드리지 않는다.
 *  · 시간 줄임 — 내려앉기 .8 → .65초 · 위 조각 지연 .44 → .30초 · 굴러가기 3.6 → 3.0초(카드 04 가 맨 앞에 머무는 스크롤이 짧다).
 *  · 이음매 — 내려앉는 순간 판 안 애니메이션(숨쉬기 · 칩 둥실)을 멈춰 캡처와 같은 쉬는 자세로 겹치고, 0.14초에 녹인다.
 *  · data-keep(한국어 밖) — 캡처 판 조각(.cxv-sl-1)을 숨기고 그 언어 판을 끝까지 남겨 띠와 함께 굴린다.
 *  · 판의 첫 자리(.cxv-gh) — 기다리는 동안 점 셋 · 제목 자리 회색 줄 · 옅은 보라 원(값 = KeywordOrb 폰 판 × 350/335).
 */
export const VALUES_CSS = `
.cxv-screen{position:relative;isolation:isolate}
.cxv{position:absolute;inset:0;overflow:hidden;background:#fff;letter-spacing:normal;--cxv-s:.5;--cxv-h:844px;--cxv-bh:calc(var(--cxv-h) - 156px);--cxv-sc:min(450px,calc(1290px - var(--cxv-bh)));--cxv-ex:cubic-bezier(.45,0,.25,1)}
.cxv-stage{position:absolute;left:0;top:0;width:390px;height:var(--cxv-h);transform:scale(var(--cxv-s));transform-origin:0 0;background:#fff}
.cxv:not([data-ready]) .cxv-stage{visibility:hidden}
.cxv-head{position:absolute;left:0;top:40px;z-index:2;width:390px;height:116px;overflow:hidden;background:#fff}
.cxv-body{position:absolute;left:0;top:156px;width:390px;height:var(--cxv-bh);overflow:hidden}
.cxv-strip{position:absolute;left:0;top:0;width:390px;height:1290px;transform:translate3d(0,-96px,0)}
.cxv-sl{position:absolute;left:0;width:390px;overflow:hidden;opacity:0}
.cx-vc-screen .cxv-img{position:absolute;left:0;top:0;display:block;width:390px;height:1406px;max-width:none;object-fit:fill}
.cxv-orbl{position:absolute;inset:0}
.cxv-orbbox{position:absolute;left:20px;top:84px;width:350px}
/* 판의 첫 자리 — 점 셋(판의 점과 같은 자리 · 색) · 제목 두 줄 자리 회색 줄 · 원 자리 옅은 보라(판의 원보다 조금 작게 — 판이 덮는다) */
.cxv-gh{position:absolute;left:0;top:0;width:350px;height:380.3px;pointer-events:none}
.cxv-gd{position:absolute;border-radius:50%}
.cxv-gd1{left:172.388px;top:0;width:5.224px;height:5.224px;background:#B4B4B8}
.cxv-gd2{left:172.806px;top:12.955px;width:4.388px;height:4.388px;background:#D3D3D7}
.cxv-gd3{left:173.224px;top:25.911px;width:3.552px;height:3.552px;background:#E5E4E9}
.cxv-gs{position:absolute;left:50%;height:14px;margin-top:-7px;border-radius:7px;background:#EFF0F3;transform:translateX(-50%)}
.cxv-gs1{top:71.57px;width:176px}
.cxv-gs2{top:99.78px;width:288px}
.cxv-gc{position:absolute;left:84.6px;top:157.2px;width:180.8px;height:180.8px;border-radius:50%;background:radial-gradient(closest-side,rgba(118,104,244,.16) 0%,rgba(118,104,244,.08) 62%,rgba(118,104,244,0) 100%)}
.cxv-gs,.cxv-gc{opacity:0}
.cxv[data-ph=idle] .cxv-gs,.cxv[data-ph=idle] .cxv-gc{opacity:1}
.cxv[data-ph=orb] .cxv-gs{transition:opacity .3s ease}
.cxv[data-ph=orb] .cxv-gc{transition:opacity .5s ease .8s}
/* 위 조각(제목 · 별점 · AI 요약 카드) — 판이 내려앉는 동안 위에서 흐림 → 선명 */
.cxv-sl-0{transform:translate3d(0,-16px,0);filter:blur(6px)}
/* 내려앉기(morph) → 굴러가기(scroll) — 두 차례는 같은 값 · 같은 transition 을 나눠 쓴다(차례가 바뀌어도 진행 중인 전환이 끊기지 않게) */
.cxv:is([data-ph=morph],[data-ph=scroll],[data-ph=out]) .cxv-orbbox *{animation:none!important}
.cxv:is([data-ph=morph],[data-ph=scroll]) .cxv-orbbox{transform:translate3d(0,137.8px,0);transition:transform .65s cubic-bezier(.65,0,.35,1)}
.cxv:is([data-ph=morph],[data-ph=scroll]) .cxv-sl-0{opacity:1;transform:none;filter:blur(0);transition:opacity .5s ease .34s,transform .75s var(--ez,cubic-bezier(.22,1,.36,1)) .3s,filter .75s ease .3s}
.cxv:is([data-ph=morph],[data-ph=scroll]) .cxv-sl-1{opacity:1;transition:opacity 0s linear .65s}
.cxv:is([data-ph=morph],[data-ph=scroll]) .cxv-sl-2{opacity:1;transition:opacity .4s ease .45s}
.cxv:is([data-ph=morph],[data-ph=scroll]) .cxv-orbl{opacity:0;transition:opacity .14s linear .65s,transform 3s var(--cxv-ex)}
/* 살아 있는 화면처럼 리뷰 줄 쪽으로 한 번 천천히(450 = 판 제목이 머리줄 밑으로 다 들어가고 리뷰 둘이 온전히 보이는 만큼) — 판 층도 같이 */
.cxv[data-ph=scroll] .cxv-strip{transform:translate3d(0,calc(-1 * var(--cxv-sc)),0);transition:transform 3s var(--cxv-ex)}
.cxv[data-ph=scroll] .cxv-orbl{transform:translate3d(0,calc(96px - var(--cxv-sc)),0)}
/* 한국어 밖 — 캡처 판 조각은 숨기고 그 언어 판을 끝까지 */
.cxv[data-keep] .cxv-sl-1{opacity:0!important}
.cxv[data-keep]:is([data-ph=morph],[data-ph=scroll]) .cxv-orbl{opacity:1}
/* 움직임 줄이기의 고정 리뷰 화면 */
.cxv[data-ph=rev] .cxv-sl{opacity:1;transform:none;filter:none}
/* 다시 재생 — 리뷰 화면(과 남겨 둔 판)을 걷어 내고(0.3초) 판부터 */
.cxv[data-ph=out] .cxv-sl{opacity:0;transform:none;filter:none;transition:opacity .3s ease}
.cxv[data-ph=out] .cxv-strip{transform:translate3d(0,calc(-1 * var(--cxv-sc)),0)}
.cxv[data-ph=out] .cxv-orbl{opacity:0;transform:translate3d(0,calc(96px - var(--cxv-sc)),0);transition:opacity .3s ease}
.cxv[data-ph=out] .cxv-orbbox{transform:translate3d(0,137.8px,0)}
@media (prefers-reduced-motion:reduce){.cxv *{transition:none!important}}
`;
