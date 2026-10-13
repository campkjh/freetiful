/*
 * ③ 경영 철학 카드 04 오른쪽 폰 — AI 키워드 판 → 리뷰 화면(CeoReviewPhone, 261013 사장 '…AI 애니메이션 … 슝슝 뜨는거 그거가 나오면서 리뷰 ui로').
 * 클래스 앞머리 cxv-(styles.ts 의 cx- 와 겹치지 않게). CeoValues 가 자기 <style> 로 그린다.
 * 판 = 390 디자인 px(캡처 css px) — 폰 화면 폭에 맞춰 scale(--cxv-s) 로 줄이고, 높이(--cxv-h)는 화면 비율대로 조금 길다.
 *   위 40 = 상태 막대 자리(폰 섬이 머리줄 이름을 가리지 않게) · 40~156 = 캡처 머리줄 + 탭 · 156~ = 본문(띠 · 판).
 *   키워드 판 칸 = 350×380.3 · 왼쪽 20 · 띠 안 위 끝 317.8(캡처에서 잰 값 — CeoReviewPhone 의 SLICES 와 같이 본다).
 *   판 차례엔 판 칸 위 끝을 본문 --cxv-ot 에 둔다 — 모바일 · 태블릿 44(폰 아래쪽이 제목 위에서 사라져도 아래 칩까지 또렷하게 · 예전 84 는 아래 칩이 제목 블러에 걸렸다),
 *   PC 100(폰이 카드 안에 온전히 보여 판이 화면 가운데 쪽 · 261013 검토). 리뷰 화면은 띠를 96 올린 자리에서 시작(머리줄 바로 밑 AI 요약 카드 전체 → 그 아래 판)
 *   → 판은 --cxv-land(221.8 - ot = 모바일 177.8 · PC 121.8) 내려앉아 캡처 속 제자리(본문 221.8)에 닿고, 닿자마자 띠와 판 층이 함께 리뷰 줄 쪽으로 굴러간다(쉬는 틈 없이 한 흐름).
 * 움직임은 transform · opacity 뿐(카드 쌓기 스크롤을 건드리지 않게). 흐림(filter)은 위 조각이 들어오는 0.75초 동안만.
 *
 * 261013 검토 반영
 *  · .cxv-screen — 오른쪽 폰 화면 칸을 .cxv 의 기준 칸으로. 전엔 기준이 폰 몸체(.cx-vc-phone)라 .cxv 가 베젤까지 덮고
 *    둥근 모서리로 잘리지 않아 '네모난 흰 판'으로 보였다. 지금은 화면 칸(.cx-vc-screen)이 absolute 칸이라 그대로 기준 칸이 된다.
 * 261013 사장 '기술 기반 혁신 부분 모바일 아이폰 디자인 너무 이상해 pc도 다듬고 모바일도 다듬어줘' — 기기(아이폰 15 · 16 Pro 비율 · 티타늄 띠 · 섬 · 옆 단추 ·
 *  그림자)와 배치(PC 두 대 · 모바일 · 태블릿 한 대)를 이 파일 한 곳으로 옮겼다(styles.ts 의 옛 폰 규칙은 지움).
 *  · 시간 줄임 — 내려앉기 .8 → .65초 · 위 조각 지연 .44 → .30초 · 굴러가기 3.6 → 3.0초(카드 04 가 맨 앞에 머무는 스크롤이 짧다).
 *  · 이음매 — 내려앉는 순간 판 안 애니메이션(숨쉬기 · 칩 둥실)을 멈춰 캡처와 같은 쉬는 자세로 겹치고, 0.14초에 녹인다.
 *  · data-keep(한국어 밖) — 캡처 판 조각(.cxv-sl-1)을 숨기고 그 언어 판을 끝까지 남겨 띠와 함께 굴린다.
 *  · 판의 첫 자리(.cxv-gh) — 기다리는 동안 점 셋 · 제목 자리 회색 줄 · 옅은 보라 원(값 = KeywordOrb 폰 판 × 350/335).
 */
export const VALUES_CSS = `
/* ── 기기(261013 사장 '기술 기반 혁신 부분 모바일 아이폰 디자인 너무 이상해 pc도 다듬고 모바일도 다듬어줘') ──
   아이폰 15 · 16 Pro 비율 — 화면 393×852 · 테두리(티타늄 띠 1.2 + 검은 베젤 2.0) = 기기 폭의 3.2% → 화면 93.6 × 202.9 · 기기 = 100 : 209.3(실기기 71.5 × 149.6 = 2.092).
   모서리 = 기기 폭 16.3% · 베젤 15.1% · 화면 13.1%(화면 폭의 14% = 55pt/393pt, 동심). 기기 칸(.cx-vc-phone)이 크기 기준 칸이라 안쪽 길이는 모두 cqw(= 기기 폭 %),
   화면 칸(.cx-vc-screen) 안(상태 표시줄 · 섬)은 다시 화면 폭 기준 cqw. 움직임은 translate(둥실) 뿐 — 카드 쌓기 스크롤을 건드리지 않는다.
   (261013 검토 — 예전 테두리 4.1% · 화면 모서리 11.9% · 어두운 띠는 '두꺼운 검은 판'으로 보였다 → 얇은 베젤 · 둥근 화면 · 은빛 티타늄 띠) */
.cx-vc-phones{position:absolute;inset:0;container-type:size;pointer-events:none}
/* isolation — 기기마다 쌓임 맥락(화면 칸 z-index 가 카드 블러 · 흰 막 위로 새지 않게). 둥실 애니메이션이 없을 때(움직임 줄이기)도 같아야 한다(261013 검증: 빠지면 글 뒤 화면이 또렷하게 비쳤다) */
.cx-vc-phone{position:absolute;isolation:isolate;width:var(--pw);aspect-ratio:100/209.3;container-type:inline-size;animation:cxvFloat 9s ease-in-out infinite}
@keyframes cxvFloat{0%,100%{translate:0 0}50%{translate:0 -1%}}
/* 몸체 = 티타늄 띠(은빛 금속 결 그라데이션 · 바깥 머리카락 선 · 모따기 빛) + 그림자(닿는 그림자 · 중간 · 넓게 퍼지는 것) */
.cx-vc-dev{position:absolute;inset:0;border-radius:16.3cqw;background:linear-gradient(135deg,#d2d5d9 0%,#7a7d82 8%,#3c3e42 22%,#8b8e93 45%,#3a3c40 63%,#6e7176 83%,#c6c9cd 100%);box-shadow:inset 0 0 0 .15cqw rgba(0,0,0,.6),inset 0 0 0 .4cqw rgba(255,255,255,.16),0 .6cqw 1.2cqw rgba(12,24,52,.22),0 5cqw 10cqw -3cqw rgba(16,34,84,.22),0 22cqw 36cqw -12cqw rgba(20,44,112,.32)}
/* 검은 베젤 — 띠 안쪽, 화면 가장자리에 아주 옅은 유리 테 */
.cx-vc-dev::before{content:'';position:absolute;inset:1.2cqw;border-radius:15.1cqw;background:#050507;box-shadow:inset 0 0 0 .2cqw rgba(255,255,255,.05)}
.cx-vc-screen{position:absolute;inset:3.2cqw;z-index:1;overflow:hidden;border-radius:13.1cqw;background:#fff;container-type:inline-size}
.cx-vc-screen > img{position:absolute;left:0;top:13.8cqw;display:block;width:100%;height:calc(100% - 13.8cqw);object-fit:cover;object-position:top}
/* 유리 빛 — 왼쪽 위에서 비스듬히 아주 옅게(흰 화면 위에선 거의 안 보이고 섬 · 사진 위에서만 살짝) */
.cx-vc-screen::after{content:'';position:absolute;inset:0;z-index:5;border-radius:inherit;background:linear-gradient(118deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,.04) 24%,rgba(255,255,255,0) 40%);pointer-events:none}
/* 옆 단추 — 몸체 뒤(먼저 그림)에서 기기 폭 .75% 나온다(띠와 같은 은빛). 높이 위치는 15 Pro 비율(동작 · 음량 위 · 아래 = 왼쪽, 전원 = 오른쪽) */
.cx-vc-key{position:absolute;width:1.4cqw;background:linear-gradient(90deg,#4a4d52,#a9acb1 50%,#55585d)}
.cx-vc-key-a,.cx-vc-key-u,.cx-vc-key-d{left:-.75cqw;border-radius:.7cqw 0 0 .7cqw}
.cx-vc-key-a{top:33cqw;height:11cqw}
.cx-vc-key-u{top:50cqw;height:18cqw}
.cx-vc-key-d{top:72cqw;height:18cqw}
.cx-vc-key-p{right:-.75cqw;top:55cqw;height:28cqw;border-radius:0 .7cqw .7cqw 0}
/* 아이폰 상태 표시줄(261013 사장 '스테이터스 바가 없음') — 화면 폭 기준 cqw: 높이 13.8%(54pt/393pt).
   섬 = 폭 32% · 높이 9.5% · 위 2.8%(126×37pt · 위 11pt) — 시간(왼쪽 귀 가운데) · 아이콘(오른쪽 귀 가운데)은 섬과 같은 줄(위 2.8 · 높이 9.5) 가운데.
   화면 내용(뒤 폰 그림 · 앞 폰 판)은 이 줄 아래부터 */
.cxv-sb{position:absolute;left:0;right:0;top:0;z-index:3;height:13.8cqw;background:#fff;color:#0B0B0F;line-height:1;pointer-events:none}
.cxv-sb-t,.cxv-sb-i{position:absolute;top:2.8cqw;box-sizing:border-box;display:flex;height:9.5cqw;align-items:center;justify-content:center}
.cxv-sb-t{left:0;width:34cqw;padding-left:2.4cqw;font-size:4.35cqw;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.cxv-sb-i{right:0;width:34cqw;gap:1.4cqw;padding-right:2.6cqw}
.cxv-sb-i svg{display:block;width:auto;height:2.95cqw}
.cxv-sb-i svg:nth-child(2){height:2.8cqw}
.cxv-sb-i svg:last-child{height:3.2cqw}
.cx-vc-island{position:absolute;left:34cqw;top:2.8cqw;z-index:4;width:32cqw;height:9.5cqw;border-radius:4.75cqw;background:radial-gradient(circle at 80% 50%,#2a3550 0,#11151f .9cqw,#000 1.7cqw)}
/* 앞 폰 판(.cxv) — 판의 위 40 디자인 px 가 상태 표시줄 자리라, 판을 (13.8 - 40/390 × 100 = 3.54)cqw 내려 머리줄이 표시줄 바로 밑에 오게 */
.cxv-screen{isolation:isolate}
.cxv-screen .cxv{top:3.54cqw}

/* ── 배치 ── 모바일 · 태블릿(<1024) = 앞 폰 한 대 가운데 · 똑바로(카드 폭 59% · 카드 높이로도 상한), 위는 카드 안 여유 두고
   아래는 제목 위에서 투명하게 사라진다. 뒤 폰은 숨김(작은 폰 둘이 겹쳐 글자가 안 보이던 것). */
.cx-vc-phone[data-k=back]{display:none}
/* --vc-tb = 글 칸 위 끝 ~ 카드 바닥(px, CeoValues 가 잰다 · 기본 = 한국어 세 줄 144) — 키워드 판 아래 끝(폰 위 + 폭 × 1.458)이 글 위 30px 안쪽에 오게 폭 상한(÷ 1.458 = × .686).
   위 여유 28px 이상(261013 검토 — 24 는 위에 쌓인 카드 머리와 붙어 보였다) */
.cx-vc-phone[data-k=front]{--pw:min(59cqw,41.5cqh,calc((100cqh - var(--vc-tb,144px) - 30px - max(28px,5.6cqh)) * .686));left:calc(50cqw - var(--pw) / 2);top:max(28px,5.6cqh)}
/* 카드 04 블러 · 흰 막을 제목 바로 위로 좁히고(그대로면 블러가 카드 아래 62%라 키워드 판 아래 칩까지 흐려졌다) 천천히 짙어지게.
   블러 위 끝 = 글 위 66px, 66px 동안 0 → 다 짙음 · 흰 막 = 글 위 56px 부터 */
.cx-vc-light .cx-vc-blur{height:calc(var(--vc-tb,144px) + 66px);-webkit-mask-image:linear-gradient(to bottom,transparent 0,rgba(0,0,0,.12) 16px,rgba(0,0,0,.38) 33px,rgba(0,0,0,.72) 50px,#000 66px);mask-image:linear-gradient(to bottom,transparent 0,rgba(0,0,0,.12) 16px,rgba(0,0,0,.38) 33px,rgba(0,0,0,.72) 50px,#000 66px)}
.cx-vc-light .cx-vc-grad{background:linear-gradient(180deg,rgba(246,249,255,0) calc(100% - var(--vc-tb,144px) - 56px),rgba(246,249,255,.2) calc(100% - var(--vc-tb,144px) - 21px),rgba(246,249,255,.6) calc(100% - var(--vc-tb,144px) + 24px),rgba(246,249,255,.9) 100%)}
/* 폰 자체를 글 위에서 투명하게(261013 검토 — 블러에 검은 테두리가 회색으로 번지고 768 은 폰 둘레에 흰 얼룩이 생겼다).
   마스크는 가만히 있고 안의 둥실은 translate 라 합성만 다시 한다(레이아웃 다시 재지 않음) */
@media (max-width:1023.98px){
  .cx-vc-light .cx-vc-phones{-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - var(--vc-tb,144px) - 52px),rgba(0,0,0,.38) calc(100% - var(--vc-tb,144px) - 14px),transparent calc(100% - var(--vc-tb,144px) + 10px));mask-image:linear-gradient(to bottom,#000 calc(100% - var(--vc-tb,144px) - 52px),rgba(0,0,0,.38) calc(100% - var(--vc-tb,144px) - 14px),transparent calc(100% - var(--vc-tb,144px) + 10px))}
}
/* PC(≥1024) = 앞 폰(리뷰 · 판) 오른쪽 크게 · 똑바로, 뒤 폰(목록) 왼쪽 위로 비켜 작게(앞 폰의 .68) · 살짝 반대로 기울여 뒤에.
   261013 검토 — 폰 두 대를 블러 · 흰 막 위로(z1: 글 칸 z1 은 DOM 뒤라 계속 위 · 쌓일 때 어두운 막 z2 도 위) — 전엔 앞 폰 아래 110px 가 안개에 덮여
   검은 테가 회색으로 번지고 폭마다 다르게 보였다. 앞 폰은 카드 안에 온전히(오른쪽 여백 5.5% · 아래 40px 이상), 글 칸과 35px 이상 떨어지게.
   뒤 폰은 카드 위 끝에서 30px 이상 · 앞 폰보다 확실히 위로 엇갈리게 · 아래 끝은 글 칸 위 36px 안쪽 */
@media (min-width:1024px){
  .cx-vc-light .cx-vc-phones{z-index:1}
  .cx-vc-phone[data-k=front]{--pw:min(34cqw,38cqh);left:calc(94.5cqw - var(--pw));top:min(12cqh,calc(100cqh - var(--pw) * 2.093 - 40px))}
  /* 뒤 폰 폭 = 앞 폰의 .68, 단 아래 끝(위 + 높이 2.093 배 + 기울기 여유)이 글 칸 위 36px 안쪽(÷ 2.12 = × .47 · --vc-tb 기본 = 한국어 세 줄 179) — 너무 작아지면 숨김(data-solo) */
  .cx-vc-phone[data-k=back]{display:block;--pw:min(calc(min(34cqw,38cqh) * .68),calc((100cqh - var(--vc-tb,179px) - 36px - max(30px,5.4cqh)) * .47));left:calc(94.5cqw - min(34cqw,38cqh) - var(--pw) * .62);top:max(30px,5.4cqh);rotate:-3deg;animation-delay:-4.5s}
  .cx-vc-phones[data-solo] .cx-vc-phone[data-k=back]{visibility:hidden;animation:none}
  .cx-vc-light .cx-vc-body{right:auto;width:calc(57.5% - 60px)}
  .cx-vc-light .cx-vc-blur{height:30%;-webkit-mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.5) 30%,#000 60%);mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.5) 30%,#000 60%)}
  .cx-vc-light .cx-vc-grad{background:linear-gradient(180deg,rgba(246,249,255,0) 64%,rgba(246,249,255,.55) 84%,rgba(246,249,255,.85) 100%)}
  /* 판 시작을 화면 가운데 쪽으로(폰이 온전히 보이니 44 면 판 아래가 빈 흰 칸 40% — 44 는 모바일 제목 블러 때문에 줄인 값) → 내려앉기 = 221.8 - 100 = 121.8 */
  .cx-vc-light .cxv{--cxv-ot:100px}
}
@media (prefers-reduced-motion:reduce){.cx-vc-phone{animation:none}}
/* cq 단위를 모르는 옛 브라우저(iOS 15 이하 사파리 · 크롬 105 미만) — cq 선언이 통째로 무효가 되면 폰이 0×0 으로 사라진다(261013 검토).
   앞 폰 한 대만 카드 % · vh 로 놓고(카드 높이 = styles.ts .cx-vc 의 식), 기기 안은 기기 비율이 고정이라 % 로 옮겨 적는다(세로 % = 가로 cqw ÷ 209.3 · 화면은 ÷ 216.8).
   상태 표시줄 글자 · 아이콘만 px. 뒤 폰은 숨김(높이 상한을 정확히 못 잰다) */
@supports not (width:1cqw){
  .cx-vc-phones .cx-vc-phone[data-k=back]{display:none}
  .cx-vc-phones .cx-vc-phone[data-k=front]{width:min(59%,calc((clamp(400px,100vh - var(--hh,56px) - 150px,500px) - var(--vc-tb,144px) - 58px) * .686));left:0;right:0;top:28px;margin:0 auto}
  .cx-vc-phones .cx-vc-dev{border-radius:16.3%/7.79%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.5),0 2px 5px rgba(12,24,52,.22),0 22px 40px -16px rgba(20,44,112,.34)}
  .cx-vc-phones .cx-vc-dev::before{inset:.57% 1.2%;border-radius:15.47%/7.3%}
  .cx-vc-phones .cx-vc-screen{inset:1.53% 3.2%;border-radius:14%/6.46%}
  .cx-vc-phones .cx-vc-screen > img{top:6.37%;height:93.63%}
  .cx-vc-phones .cx-vc-key{width:1.4%}
  .cx-vc-phones .cx-vc-key-a,.cx-vc-phones .cx-vc-key-u,.cx-vc-phones .cx-vc-key-d{left:-.75%;border-radius:1px 0 0 1px}
  .cx-vc-phones .cx-vc-key-a{top:15.77%;height:5.26%}
  .cx-vc-phones .cx-vc-key-u{top:23.89%;height:8.6%}
  .cx-vc-phones .cx-vc-key-d{top:34.4%;height:8.6%}
  .cx-vc-phones .cx-vc-key-p{right:-.75%;top:26.28%;height:13.38%;border-radius:0 1px 1px 0}
  .cx-vc-phones .cxv-sb{height:6.37%}
  .cx-vc-phones .cxv-sb-t,.cx-vc-phones .cxv-sb-i{top:20.3%;height:68.8%;width:34%}
  .cx-vc-phones .cxv-sb-t{padding-left:2.4%;font-size:8px}
  .cx-vc-phones .cxv-sb-i{gap:2px;padding-right:2.6%}
  .cx-vc-phones .cxv-sb-i svg{height:5.5px}
  .cx-vc-phones .cx-vc-island{left:34%;top:1.29%;width:32%;height:4.38%;border-radius:999px;background:#000}
  .cx-vc-phones .cxv-screen .cxv{top:1.63%}
}
@media (min-width:1024px){@supports not (width:1cqw){
  .cx-vc-phones .cx-vc-phone[data-k=front]{width:min(34%,calc(clamp(400px,100vh - var(--hh,64px) - 190px,560px) * .38));left:auto;right:5.5%;top:12%;margin:0}
  .cx-vc-phones .cxv-sb-t{font-size:9px}
}}

.cxv{position:absolute;inset:0;overflow:hidden;background:#fff;letter-spacing:normal;--cxv-s:.5;--cxv-h:844px;--cxv-bh:calc(var(--cxv-h) - 156px);--cxv-sc:min(450px,calc(1290px - var(--cxv-bh)));--cxv-ex:cubic-bezier(.45,0,.25,1);--cxv-ot:44px;--cxv-land:calc(221.8px - var(--cxv-ot))}
.cxv-stage{position:absolute;left:0;top:0;width:390px;height:var(--cxv-h);transform:scale(var(--cxv-s));transform-origin:0 0;background:#fff}
.cxv:not([data-ready]) .cxv-stage{visibility:hidden}
.cxv-head{position:absolute;left:0;top:40px;z-index:2;width:390px;height:116px;overflow:hidden;background:#fff}
.cxv-body{position:absolute;left:0;top:156px;width:390px;height:var(--cxv-bh);overflow:hidden}
.cxv-strip{position:absolute;left:0;top:0;width:390px;height:1290px;transform:translate3d(0,-96px,0)}
.cxv-sl{position:absolute;left:0;width:390px;overflow:hidden;opacity:0}
.cx-vc-screen .cxv-img{position:absolute;left:0;top:0;display:block;width:390px;height:1406px;max-width:none;object-fit:fill}
.cxv-orbl{position:absolute;inset:0}
.cxv-orbbox{position:absolute;left:20px;top:var(--cxv-ot);width:350px}
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
.cxv:is([data-ph=morph],[data-ph=scroll]) .cxv-orbbox{transform:translate3d(0,var(--cxv-land),0);transition:transform .65s cubic-bezier(.65,0,.35,1)}
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
/* 모바일 · 태블릿은 굴러간 끝 자세(움직이는 판의 마지막 장면과 같다) — -96 자리면 판 아래 칩 줄이 제목 위 블러 · 흐려지는 자리에 묻혔다(261013 검토) */
@media (max-width:1023.98px){.cxv[data-ph=rev] .cxv-strip{transform:translate3d(0,calc(-1 * var(--cxv-sc)),0)}}
/* 다시 재생 — 리뷰 화면(과 남겨 둔 판)을 걷어 내고(0.3초) 판부터 */
.cxv[data-ph=out] .cxv-sl{opacity:0;transform:none;filter:none;transition:opacity .3s ease}
.cxv[data-ph=out] .cxv-strip{transform:translate3d(0,calc(-1 * var(--cxv-sc)),0)}
.cxv[data-ph=out] .cxv-orbl{opacity:0;transform:translate3d(0,calc(96px - var(--cxv-sc)),0);transition:opacity .3s ease}
.cxv[data-ph=out] .cxv-orbbox{transform:translate3d(0,var(--cxv-land),0)}
@media (prefers-reduced-motion:reduce){.cxv *{transition:none!important}}
`;
