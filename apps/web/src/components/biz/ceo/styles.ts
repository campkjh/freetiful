/*
 * CEO 인사말 화면 CSS(클래스 앞머리 cx-, 261009). 글자 · 색 · 모서리 · 곡선은 비즈 홈 장면들(toss/*)과 같은 값 —
 * 본문 #191F28 · 보조 #4E5968 · 연회색 #8B95A1 · 파랑 #3182F6 · 바탕 #F2F4F6, 글꼴 Pretendard(전역), 곡선 cubic-bezier(.22,1,.36,1).
 * 데스크톱 고정 장면 / 쌓는 판은 같은 미디어 쿼리(motion.ts DESK_MQ)로 서버 첫 그림부터 갈라 둔다.
 */
export const CEO_CSS = `
/* framer useScroll 의 스크롤 칸(<html>)이 static 이면 개발 모드 경고 — 계산은 같다(비즈 홈과 같은 처리) */
html{position:relative}
.cx-root{--hh:56px;--ez:cubic-bezier(.22,1,.36,1);letter-spacing:-0.02em;-webkit-font-smoothing:antialiased}
@media (min-width:768px){.cx-root{--hh:64px}}
.cx-desk{display:none}
@media (min-width:1024px) and (min-aspect-ratio:1/1) and (prefers-reduced-motion:no-preference){.cx-desk{display:block}.cx-stack{display:none}}

/* 일본어 · 중국어 — 띄어쓰기가 없어 keep-all 이면 줄바꿈 기회가 0 이 된다(비즈 홈과 같은 규칙) */
.cx-root:lang(ja),.cx-root:lang(zh){word-break:normal;line-break:strict;overflow-wrap:break-word}
.cx-root:lang(ja) *,.cx-root:lang(zh) *{word-break:normal!important;line-break:strict;overflow-wrap:break-word!important}
.cx-root:lang(ja),.cx-root:lang(ja) *{word-break:auto-phrase!important}
.cx-root:lang(ja){font-family:Pretendard,'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',Meiryo,sans-serif}
.cx-root:lang(zh){font-family:Pretendard,'PingFang SC','Noto Sans SC','Microsoft YaHei','Hiragino Sans GB',sans-serif}
.cx-root [lang="ko"],.cx-root [lang="ko"] *{word-break:keep-all!important;line-break:auto}

/* 공통 */
.cx-wrap{box-sizing:border-box;width:100%;max-width:1188px;margin:0 auto;padding:0 24px}
@media (min-width:768px){.cx-wrap{max-width:1220px;padding:0 40px}}
@media (min-width:1024px){.cx-wrap{max-width:1236px;padding:0 48px}}
/* 영문 소제목(CEO MESSAGE · OUR PHILOSOPHY · LEADERSHIP · ORGANIZATION · CEO 인사말) = 쿨그레이 · 얇게(261013 사장 '영문 서브타이틀 색상 쿨그레이로, 글씨 더 얇게') */
.cx-eyebrow{margin:0;font-size:15px;line-height:1.4;font-weight:400;letter-spacing:-0.01em;color:#8B95A1}
@media (min-width:768px){.cx-eyebrow{font-size:17px}}
/* 이사진 및 책임자 소개 — 두 줄일 때 고르게('이사진 및 / 책임자 소개', '소개'만 홀로 남지 않게, 261013) */
.cx-ld .cx-h2{text-wrap:balance}
.cx-h2{margin:14px 0 0;font-size:clamp(30px,calc(22px + 2.2vw),56px);line-height:1.3;font-weight:700;letter-spacing:-0.035em;color:#191F28;word-break:keep-all}
.cx-hw{display:inline-block}
.cx-rise{animation:cxRise 1s var(--ez) backwards;animation-delay:calc(var(--i,0) * 80ms + 120ms)}
@keyframes cxRise{from{opacity:0;transform:translate3d(0,26px,0);filter:blur(12px)}to{opacity:1;transform:none;filter:blur(0)}}
.cx-qmark{display:block;height:.5em;margin-bottom:14px;font-family:Georgia,'Times New Roman',serif;font-size:120px;line-height:1;font-weight:700;color:#5AA0FF}
.cx-cap-line{display:inline-block;width:32px;height:1px;background:rgba(255,255,255,.5)}

/* ① 첫 화면 — 데스크톱 */
.cx-hd-stage{position:sticky;top:var(--hh);height:calc(100vh - var(--hh));overflow:hidden;background:#fff}
.cx-hd-stage{--cl:max(48px,calc((100% - 1140px) / 2));--cw:min(1140px,calc(100% - 96px))}
.cx-hd-text{position:absolute;top:50%;left:var(--cl);width:calc(var(--cw) * .47);translate:0 -50%;z-index:1;will-change:transform,opacity}
.cx-hd-h1{margin:18px 0 0;font-size:clamp(44px,calc(14px + 3.4vw),72px);line-height:1.24;font-weight:700;letter-spacing:-0.035em;color:#191F28;word-break:keep-all}
.cx-hd-sub{margin:26px 0 0;font-size:clamp(17px,calc(10px + .75vw),21px);line-height:1.6;color:#4E5968}
.cx-hint{position:absolute;left:var(--cl);bottom:32px;z-index:1;display:flex;align-items:center;gap:12px;font-size:14px;font-weight:500;color:#8B95A1;animation:cxRise 1s var(--ez) 1.1s backwards}
.cx-hint-line{position:relative;display:block;width:1px;height:36px;background:#E5E8EB;overflow:hidden}
.cx-hint-line::after{content:'';position:absolute;left:0;top:0;width:1px;height:14px;background:#3182F6;animation:cxDrip 1.8s cubic-bezier(.6,0,.2,1) infinite}
@keyframes cxDrip{from{transform:translate3d(0,-14px,0)}to{transform:translate3d(0,36px,0)}}
.cx-hd-card{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none;transform-origin:50% 50%;transition:transform .6s cubic-bezier(.33,1,.68,1),border-radius .6s cubic-bezier(.33,1,.68,1)}
.cx-hd-card[data-end]{transform:scale(.92);border-radius:40px}
.cx-hd-win{position:absolute;inset:0;overflow:hidden;will-change:clip-path}
/* 우주 배경(CeoSpace, 261013 사장 '첨부 이미지처럼 우주 배경') — 캔버스 첫 장 전 · WebGL 없을 때는 이 CSS 그림:
   견본에서 잰 세로 밝기(남흑색 하늘 → 푸른 안개 → 대기선 → 파란 땅) + 달 점 + 빛줄기 띠. 넓은 판(무대 · 768px 이상 16:10 카드) / 폰 카드(세로) 구도가 다르다
   (셰이더와 같은 조건 · 같은 자리 — 달 = 가로 57.5% · 위 18%, 지름은 판 높이의 3.3%: 무대 = 화면 높이 - 머리줄, 태블릿 카드 = (폭 - 80) × 10/16 · 최대 600).
   폰 카드 캔버스는 제 층으로(둥근 카드 안에서 매 장 카드째 다시 칠하지 않게 — 390 · 3배 화면 CPU 4배 느림에서 메인 19 → 15%) */
.cx-space{position:absolute;inset:0;overflow:hidden;pointer-events:none;background-color:#050812;--mr:calc((100vh - var(--hh,64px)) * .0165);--mg:calc((100vh - var(--hh,64px)) * .046);
  background-image:radial-gradient(circle var(--mr) at 57.5% 18%,#DCDAE0 0,#CDCBD3 45%,#A4A2B1 84%,rgba(16,20,44,0) 100%),radial-gradient(circle var(--mg) at 57.5% 18%,rgba(150,172,226,.14),rgba(150,172,226,0)),linear-gradient(107deg,rgba(200,232,228,0) 73.4%,rgba(200,232,228,.15) 76.6%,rgba(200,232,228,.06) 78.2%,rgba(200,232,228,0) 80.6%),linear-gradient(107deg,rgba(200,232,228,0) 81.2%,rgba(200,232,228,.06) 83.2%,rgba(200,232,228,0) 85.2%),linear-gradient(180deg,#04070F 0%,#05080F 18%,#060918 36%,#0B1025 48%,#11193E 58%,#16214F 63%,#1C3166 69%,#28487F 73.5%,#3B5E97 77%,#64829F 80%,#8597B5 82.4%,#8C9DB7 83%,#6F87AE 84.2%,#43639A 86.5%,#2A4378 90%,#1F305F 95%,#1B2A58 100%)}
.cx-space[data-v=card]{--mr:clamp(7px,calc(1.03vw - .8px),10px);--mg:clamp(19px,calc(2.85vw - 2px),28px)}
@media (max-width:767.98px){
  .cx-space[data-v=card]{background-image:radial-gradient(circle 10px at 19% 17%,#DCDAE0 0,#CDCBD3 45%,#A4A2B1 84%,rgba(16,20,44,0) 100%),radial-gradient(circle 28px at 19% 17%,rgba(150,172,226,.14),rgba(150,172,226,0)),linear-gradient(103deg,rgba(200,232,228,0) 65.8%,rgba(200,232,228,.13) 69.1%,rgba(200,232,228,0) 72.3%),linear-gradient(180deg,#04070F 0%,#060918 22%,#0B1025 36%,#12193F 46%,#19274F 52%,#22396F 57%,#36578F 62%,#6A86A6 67%,#8C9DB7 70%,#6A84AD 71.5%,#40619A 74.5%,#273F72 80%,#1D2D5C 90%,#1A2856 100%)}
}
.cx-space canvas{display:block;width:100%;height:100%;opacity:0;transition:opacity .9s ease}
.cx-space canvas[data-on]{opacity:1}
.cx-space[data-v=card] canvas{will-change:transform}
.cx-pt{position:absolute;left:0;top:0;max-width:none;transform-origin:0 0;will-change:transform,opacity;user-select:none;-webkit-user-drag:none}
/* 바닥 — 누끼 아래 끝이 지구 땅빛(어두운 파랑)에 스미게. 누끼는 화면 아래에서 잘린 흉상이라 받칠 바닥이 없다 — 땅이 견본보다 어두워지지 않게 낮고 옅게(261013 검토) */
.cx-floor{position:absolute;left:0;right:0;bottom:0;height:14%;background:linear-gradient(rgba(10,16,42,0),rgba(10,16,42,.22));pointer-events:none}
/* 한마디 뒤 왼쪽 그늘 — 견본처럼 하늘이 어두워 글이 읽히므로 옅게(예전 .82 는 지구 가장자리까지 덮었다, 261013).
   아래 20% 는 빼서 지구 대기선이 견본처럼 가로 전체에서 고르게 밝다(서명 줄 = 무대 높이 약 64.5% 까지는 그늘 그대로, 261013 검토) */
.cx-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,6,16,.42) 0%,rgba(3,6,16,.22) 34%,rgba(3,6,16,0) 58%);-webkit-mask-image:linear-gradient(180deg,#000 62%,transparent 80%);mask-image:linear-gradient(180deg,#000 62%,transparent 80%);pointer-events:none}
.cx-hd-q{position:absolute;top:50%;left:var(--cl);width:calc(var(--cw) * .5);transform:translateY(-50%);z-index:2;color:#fff}
.cx-hd-qt{margin:0;text-wrap:balance;font-size:clamp(38px,calc(10px + 2.9vw),60px);line-height:1.3;font-weight:700;letter-spacing:-0.03em;word-break:keep-all}
.cx-qw{display:inline-block;color:rgba(255,255,255,.14);filter:blur(6px);will-change:color,filter}
.cx-hd-cap{display:flex;align-items:center;gap:14px;margin-top:36px;font-size:17px;color:rgba(255,255,255,.72);opacity:0;transform:translate3d(0,12px,0);transition:opacity .7s var(--ez),transform .7s var(--ez)}
.cx-hd-cap[data-on]{opacity:1;transform:none}
.cx-hd-cap b{margin-left:4px;font-weight:700;color:#fff}

/* ① 첫 화면 — 모바일 · 태블릿 · 움직임 줄이기 */
.cx-hm{padding-bottom:8px}
.cx-hm-text{padding:36px 24px 0}
.cx-hm-h1{margin:14px 0 0;font-size:34px;line-height:1.3;font-weight:700;letter-spacing:-0.035em;color:#191F28;word-break:keep-all}
.cx-hm-sub{margin:16px 0 0;font-size:16px;line-height:1.6;color:#4E5968}
.cx-hm-card{position:relative;margin:32px 20px 0;aspect-ratio:3/4;max-height:640px;border-radius:28px;overflow:hidden;isolation:isolate;background:#08111F;animation:cxMask 1.3s var(--ez) .3s backwards}
@keyframes cxMask{from{clip-path:inset(100% 0 0 0 round 28px)}to{clip-path:inset(0 0 0 0 round 28px)}}
.cx-hm-par{position:absolute;inset:0;will-change:transform}
.cx-hm-pt{position:absolute;bottom:0;left:50%;height:94%;width:auto;max-width:none;transform:translateX(-50%);transform-origin:50% 100%;animation:cxPortrait 1.6s var(--ez) .3s backwards;user-select:none;-webkit-user-drag:none}
@keyframes cxPortrait{from{opacity:0;transform:translateX(-50%) translate3d(0,6%,0) scale(1.1)}to{opacity:1;transform:translateX(-50%)}}
/* 카드 아래 그늘 — 지구 대기선이 비치게 옅게(261013) */
.cx-hm-fade{position:absolute;left:0;right:0;bottom:0;height:52%;background:linear-gradient(rgba(5,9,22,0) 0%,rgba(5,9,22,.38) 42%,rgba(5,9,22,.74) 100%);pointer-events:none}
.cx-hm-q{position:absolute;left:24px;right:24px;bottom:26px;color:#fff}
.cx-qmark-sm{height:.42em;margin-bottom:10px;font-size:72px}
.cx-hm-qt{margin:0;text-wrap:balance;font-size:25px;line-height:1.38;font-weight:700;letter-spacing:-0.03em;word-break:keep-all}
.cx-mqw{display:inline-block;color:rgba(255,255,255,.14);filter:blur(6px);transition:color .7s cubic-bezier(.25,.1,.25,1),filter .7s cubic-bezier(.25,.1,.25,1);transition-delay:var(--d,0s)}
[data-q] .cx-mqw{color:#fff;filter:none}
.cx-hm-cap{display:flex;align-items:center;gap:12px;margin-top:18px;font-size:14px;color:rgba(255,255,255,.72);opacity:0;transform:translate3d(0,10px,0);transition:opacity .6s var(--ez),transform .6s var(--ez);transition-delay:var(--d,0s)}
[data-q] .cx-hm-cap{opacity:1;transform:none}
.cx-hm-cap b{margin-left:3px;font-weight:700;color:#fff}
@media (max-width:374px){.cx-hm-h1{font-size:30px}.cx-hm-qt{font-size:22px}.cx-hm-card{margin:28px 16px 0}}
@media (min-width:768px){
  .cx-hm-text{max-width:1040px;margin:0 auto;padding:64px 40px 0}
  .cx-hm-h1{font-size:48px;line-height:1.25}
  .cx-hm-sub{font-size:19px}
  .cx-hm-card{margin:48px 40px 0;aspect-ratio:16/10;max-height:none}
  .cx-hm-pt{left:70%;height:96%}
  .cx-hm-fade{top:0;height:auto;background:linear-gradient(90deg,rgba(3,6,16,.55) 0%,rgba(3,6,16,.3) 40%,rgba(3,6,16,0) 62%);-webkit-mask-image:linear-gradient(180deg,#000 68%,transparent 84%);mask-image:linear-gradient(180deg,#000 68%,transparent 84%)}
  .cx-hm-q{left:44px;right:auto;bottom:auto;top:50%;transform:translateY(-50%);width:44%}
  .cx-hm-qt{font-size:34px}
  .cx-qmark-sm{font-size:96px}
}
@media (min-width:1040px){.cx-hm-card{max-width:960px;margin:52px auto 0}}

/* ② 인사말 본문 */
.cx-lt{position:relative;background:#fff;padding:96px 0 120px}
@media (min-width:768px){.cx-lt{padding:140px 0 150px}}
@media (min-width:1024px){.cx-lt{padding:180px 0 180px}}
.cx-lt-grid{display:block}
@media (min-width:1024px){.cx-lt-grid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:88px}}
.cx-rail{display:none}
@media (min-width:1024px){.cx-rail{display:block}}
.cx-rail-in{position:sticky;top:calc(var(--hh) + 120px)}
.cx-rail-who{display:flex;align-items:center;gap:14px;margin-top:20px}
.cx-face{flex:none;display:block;width:56px;height:56px;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 50% 30%,#2C4468,#0E1A30)}
.cx-face img{display:block;width:100%;height:100%;object-fit:cover}
.cx-rail-name{display:block;font-size:17px;font-weight:700;color:#191F28}
.cx-rail-role{display:block;margin-top:2px;font-size:14px;color:#8B95A1}
.cx-rail-line{position:relative;display:block;width:2px;height:min(280px,34vh);margin:32px 0 0 27px;border-radius:2px;background:#E5E8EB;overflow:hidden}
.cx-rail-fill{position:absolute;inset:0;background:#3182F6;transform-origin:50% 0;transform:scaleY(0)}
.cx-lt-from{margin-bottom:40px}
@media (min-width:1024px){.cx-lt-from{display:none}}
.cx-p{margin:0 0 28px;font-size:20px;line-height:1.7;font-weight:600;letter-spacing:-0.02em;color:#D1D6DB;word-break:keep-all;overflow-wrap:break-word}
@media (max-width:374px){.cx-p{font-size:18.5px}}
@media (min-width:768px){.cx-p{margin-bottom:36px;font-size:23px;line-height:1.66}}
@media (min-width:1024px){.cx-p{margin-bottom:44px;font-size:26px;line-height:1.62}}
.cx-st{font-weight:700}
.cx-hl{background-image:linear-gradient(transparent 62%,rgba(49,130,246,.22) 62%,rgba(49,130,246,.22) 94%,transparent 94%);background-repeat:no-repeat;background-size:0% 100%;transition:background-size 1.1s var(--ez)}
.cx-hl[data-on]{background-size:100% 100%}
.cx-thanks{margin-top:8px}
.cx-stat{display:grid;gap:22px;margin:4px 0 40px;padding:28px 24px;border-radius:28px;background:#F2F4F6}
@media (min-width:768px){.cx-stat{grid-template-columns:minmax(0,1fr) auto;align-items:end;margin:8px 0 52px;padding:36px 40px}}
.cx-stat-num{display:flex;align-items:baseline;margin:0;font-size:56px;line-height:1;font-weight:700;letter-spacing:-0.04em;color:#191F28;font-variant-numeric:tabular-nums}
.cx-stat-suf{margin-left:4px;font-size:24px;letter-spacing:-0.02em}
.cx-stat-label{margin:12px 0 0;font-size:16px;font-weight:500;color:#4E5968}
@media (min-width:1024px){.cx-stat-num{font-size:72px}.cx-stat-suf{font-size:30px}.cx-stat-label{font-size:18px}}
.cx-stat-side{min-width:0}
@media (min-width:768px){.cx-stat-side{text-align:right}.cx-chips{justify-content:flex-end}}
.cx-chips{display:flex;gap:8px}
.cx-chip{display:inline-flex;align-items:center;height:40px;padding:0 16px;border-radius:999px;background:#fff;font-size:15px;font-weight:700;letter-spacing:.02em;color:#333D4B;box-shadow:0 2px 10px rgba(2,32,71,.05);opacity:0;transform:translate3d(0,10px,0) scale(.9);transition:opacity .5s var(--ez),transform .6s cubic-bezier(.34,1.56,.64,1);transition-delay:calc(var(--i) * 90ms + 300ms)}
[data-in] .cx-chip{opacity:1;transform:none}
.cx-stat-cap{margin:10px 0 0;font-size:14px;color:#8B95A1}
.cx-sign{display:flex;align-items:flex-end;gap:24px;margin-top:48px}
@media (min-width:1024px){.cx-sign{margin-top:64px}}
.cx-sign-line{flex:1;height:1px;margin-bottom:30px;background:#E5E8EB;transform-origin:0 50%;transform:scaleX(0);transition:transform 1.2s var(--ez)}
.cx-sign[data-in] .cx-sign-line{transform:none}
.cx-sign-who{text-align:right}
.cx-sign-co{margin:0;font-size:16px;font-weight:700;color:#191F28}
.cx-sign-name{margin:4px 0 0;font-size:15px;color:#6B7684}
.cx-sign-name strong{margin-left:2px;font-weight:700;color:#333D4B}
.cx-sig{width:180px;margin:10px 0 0 auto}
.cx-sig img{display:block;width:100%;height:auto;opacity:.88}
@media (min-width:1024px){.cx-sig{width:210px}}

/* ③ 경영 철학 — 쌓이는 카드 */
.cx-va{background:#F2F4F6;padding:110px 0 90px}
@media (min-width:768px){.cx-va{padding:150px 0 110px}}
@media (min-width:1024px){.cx-va{padding:180px 0 130px}}
.cx-va-side{margin-bottom:40px}
@media (min-width:1024px){
  .cx-va-grid{display:grid;grid-template-columns:minmax(0,.82fr) minmax(0,1.18fr);gap:72px;align-items:start}
  .cx-va-side{position:sticky;top:calc(var(--hh) + 110px);margin-bottom:0}
}
.cx-va-index{display:none;margin:48px 0 0;padding:0;list-style:none}
@media (min-width:1024px){.cx-va-index{display:block}}
.cx-va-index button{display:flex;align-items:center;gap:16px;width:100%;padding:15px 0;border:0;border-top:1px solid #E5E8EB;background:none;text-align:left;font:inherit;font-size:18px;font-weight:600;letter-spacing:-0.02em;color:#B0B8C1;cursor:pointer;transition:color .4s ease}
.cx-va-index li:last-child button{border-bottom:1px solid #E5E8EB}
.cx-va-index button:hover{color:#6B7684}
.cx-va-index button[data-on]{color:#191F28}
.cx-va-ix{width:24px;font-size:14px;font-variant-numeric:tabular-nums}
.cx-va-list{margin:0;padding:0 0 6vh;list-style:none}
.cx-vc{position:sticky;top:calc(var(--hh) + 20px + var(--i) * 12px);height:min(500px,calc(100vh - var(--hh) - 150px));height:min(500px,calc(100svh - var(--hh) - 150px));min-height:400px;margin-bottom:28px;border-radius:5px;overflow:hidden;background:#191F28;transform-origin:50% 0;will-change:transform;isolation:isolate;box-shadow:0 30px 60px -30px rgba(2,32,71,.35)}
.cx-vc:last-child{margin-bottom:0}
@media (min-width:1024px){.cx-vc{top:calc(var(--hh) + 110px + var(--i) * 18px);height:min(560px,calc(100vh - var(--hh) - 190px));margin-bottom:40px}}
.cx-va-still .cx-vc{position:relative;top:auto}
.cx-vc-ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cx-vc-grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,9,19,.2) 0%,rgba(2,9,19,0) 26%,rgba(2,9,19,.4) 54%,rgba(2,9,19,.88) 100%);pointer-events:none}
/* 아래쪽 그라데이션 블러 — 공지사항 카드와 같은 값(blur 28 · saturate 150% · 위 0% → 30% 반 → 60% 다), 그 위에 색 막(.cx-vc-grad)(261013 사장 '프리티풀 공지사항처럼') */
.cx-vc-blur{position:absolute;left:0;right:0;bottom:0;height:62%;-webkit-backdrop-filter:blur(28px) saturate(150%);backdrop-filter:blur(28px) saturate(150%);-webkit-mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.5) 30%,#000 60%);mask-image:linear-gradient(to bottom,transparent 0%,rgba(0,0,0,.5) 30%,#000 60%);pointer-events:none}
/* 04 앱 화면 카드 = 이사진 소개와 같은 일렁이는 비단(CeoSilk) — 바탕 CSS 는 WebGL 없을 때 · 첫 장 전 정지 그림(이사진 섹션과 같은 그러데이션), 밝은 바탕이라 글자는 어둡게(261013 사장 '파란색 말고') */
.cx-vc-light{background:radial-gradient(70% 55% at 16% 18%,rgba(255,255,255,.95) 0%,rgba(255,255,255,0) 70%),linear-gradient(166deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.8) 43%,rgba(255,255,255,0) 56%),linear-gradient(172deg,rgba(255,255,255,0) 56%,rgba(176,202,250,.55) 68%,rgba(255,255,255,0) 80%),linear-gradient(158deg,#F8FAFF 0%,#EAF1FE 40%,#D7E5FC 72%,#BCD2F8 100%)}
.cx-vc-silk{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.cx-vc-silk canvas{display:block;width:100%;height:100%;opacity:0;transition:opacity 1.4s ease}
.cx-vc-silk canvas[data-on]{opacity:1}
.cx-vc-light .cx-vc-grad{background:linear-gradient(180deg,rgba(246,249,255,0) 42%,rgba(246,249,255,.5) 66%,rgba(246,249,255,.82) 100%)}
.cx-vc-light .cx-vc-body{color:#191F28}
.cx-vc-light .cx-vc-d{color:#4E5968}
.cx-vc-body{position:absolute;left:24px;right:24px;bottom:26px;z-index:1;color:#fff}
@media (min-width:1024px){.cx-vc-body{left:40px;right:40px;bottom:38px}}
.cx-vc-t{margin:0;text-wrap:balance;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-0.03em;word-break:keep-all}
.cx-vc-d{margin:10px 0 0;max-width:32em;font-size:15px;line-height:1.65;color:rgba(255,255,255,.84);word-break:keep-all}
@media (min-width:1024px){.cx-vc-t{font-size:36px}.cx-vc-d{font-size:17px}}
.cx-vc-dim{position:absolute;inset:0;z-index:2;background:#0B1220;opacity:0;pointer-events:none}
/* 카드 04 폰(기기 · 배치 · 상태 표시줄 · 섬)은 valuesStyles.ts 한 곳에서 그린다(261013 사장 '기술 기반 혁신 부분 모바일 아이폰 디자인 너무 이상해 pc도 다듬고 모바일도 다듬어줘') */

/* ④ 이사진 — 일렁이는 유리 · 비단 바탕 + 카드 줄(261012 사장 '이런느낌으로 · 배경을 일렁이는 고급스러운 3d배경 느낌으로')
 * 261012 사장 2차 — 카드 살짝 반투명 · 스크롤 내리면 오른쪽에서 왼쪽으로 흐름 · 왼쪽은 그라데이션으로 사라짐 · 알약 '대표이사(CEO)' · 01 엄청 옅게 · 카드 r 5 */
/* 바탕 CSS = WebGL 이 없을 때(그리고 첫 장이 그려지기 전) 보이는 정지 그림 — 셰이더와 같은 연하늘 → 흰빛, 비스듬한 빛 띠 세 줄.
   overflow 는 clip(가로만) — hidden 이면 이 칸이 스크롤 칸이 돼 흐르는 판의 무대 · 비단이 붙지(sticky) 않는다 */
.cx-ld{position:relative;overflow-x:clip;isolation:isolate;padding:96px 0 88px;--cw:min(72vw,300px);--gap:24px;--pad:24px;
  background:radial-gradient(70% 55% at 16% 18%,rgba(255,255,255,.95) 0%,rgba(255,255,255,0) 70%),linear-gradient(166deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.8) 43%,rgba(255,255,255,0) 56%),linear-gradient(172deg,rgba(255,255,255,0) 56%,rgba(176,202,250,.55) 68%,rgba(255,255,255,0) 80%),linear-gradient(176deg,rgba(255,255,255,0) 62%,rgba(255,255,255,.7) 66%,rgba(255,255,255,0) 70%),linear-gradient(158deg,#F8FAFF 0%,#EAF1FE 40%,#D7E5FC 72%,#BCD2F8 100%)}
/* 1단 카드 사이 = 옆 여백(폰 24 · 태블릿 32, 261012 검토) — 멈춘 앞 카드의 오른쪽 끝이 화면 왼쪽 끝 밖(또는 띠 시작)에 놓여 10~20px 조각이 남지 않는다 */
@media (min-width:768px){.cx-ld{padding:130px 0 116px;--cw:300px;--gap:32px;--pad:40px}}
/* 비단 — 섹션 높이만큼 깔린 칸 안에서 화면 한 장 높이가 따라 붙는다(흐르는 판은 섹션이 화면 몇 장이라 늘이면 띠가 길게 늘어진다) */
.cx-ld-bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.cx-ld-silk{position:sticky;top:0;height:100vh;max-height:100%;overflow:hidden}
/* 흐르는 판 — 무대와 같은 top(머리줄 아래, 머리줄은 흰 바탕이라 그 밑은 안 보인다): 흐름 첫 56~64px 동안 바탕만 위로 미끄러지던 것(261012 검토) */
.cx-ld[data-flow] .cx-ld-silk{top:var(--hh);height:calc(100vh - var(--hh))}
.cx-ld-silk canvas{display:block;width:100%;height:100%;opacity:0;transition:opacity 1.4s ease}
.cx-ld-silk canvas[data-on]{opacity:1}
/* 위(경영 철학 #F2F4F6) · 아래(조직도 흰색)와 이음새 없이 — 아래는 카드 밑 진한 띠가 급히 끊기지 않게 길게(261012 검토) */
.cx-ld::before,.cx-ld::after{content:'';position:absolute;left:0;right:0;z-index:1;pointer-events:none}
.cx-ld::before{top:0;height:80px;background:linear-gradient(#F2F4F6,rgba(242,244,246,0))}
.cx-ld::after{bottom:0;height:150px;background:linear-gradient(rgba(255,255,255,0) 0%,rgba(255,255,255,.35) 35%,rgba(255,255,255,.8) 70%,#fff 100%)}
.cx-ld-run{position:relative;z-index:2}
/* 모바일 · 태블릿 = 제목 → 카드 줄 → 01 / 09 · 단추(DOM 은 단추가 카드 줄 앞 — 키보드 차례를 데스크톱 화면 순서와 맞춘다) */
.cx-ld-in{position:relative;display:flex;flex-direction:column}
.cx-ld-rail{order:1}
.cx-ld-nav{order:2}
.cx-ld-head,.cx-ld-nav{position:relative;z-index:1;box-sizing:border-box;padding:0 var(--pad)}
.cx-ld-h2{margin-top:12px}
.cx-ld-sub{margin:12px 0 0;font-size:16px;line-height:1.6;font-weight:500;color:#4E5968;word-break:keep-all}
@media (min-width:768px){.cx-ld-sub{margin-top:16px;font-size:18px}}
/* 이 섹션만 — 띠가 지나가는 바탕 위 작은 파란 글자는 한 단계 진하게 */
/* 카드 줄 — 위아래 여백(떠오름 · 그림자)만큼 넓혀 두고 바깥 여백으로 되돌린다.
   데스크톱은 스크립트가 잰 --ext(줄 왼쪽 끝을 제목 칸 쪽으로 넓힘 — 카드가 잘리기 전에 다 녹게) · --lead(첫 카드 자리) */
.cx-ld-rail{position:relative;margin-top:30px}
@media (min-width:768px){.cx-ld-rail{margin-top:40px}}
.cx-ld-track{position:relative;display:flex;gap:var(--gap);margin:-24px 0 -64px calc(-1 * var(--ext,0px));padding:24px 0 64px var(--lead,var(--pad));list-style:none;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-padding-left:var(--lead,var(--pad));overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;outline:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.cx-ld-track::-webkit-scrollbar{display:none}
/* 끝 빈칸 — 스크립트가 잰 --tail(끝에서 다 보이는 카드 수만큼 · 끝 자리 = 카드 경계). 없으면 줄 폭 - 카드 한 칸(마지막 카드가 맨 앞 자리에) */
.cx-ld-track::after{content:'';flex:none;width:var(--tail,calc(100% - var(--cw) - var(--gap)))}
.cx-ld-track[data-free]{scroll-snap-type:none}
@media (hover:hover) and (pointer:fine){.cx-ld-track{cursor:grab}.cx-ld-track[data-drag]{cursor:grabbing}}
.cx-ld-track:focus-visible .cx-lc[data-cur] .cx-lc-in{outline:2px solid #3182F6;outline-offset:3px}
/* 흐르는 판 — 섹션 = 무대 높이 + 흐를 거리(스크립트), 무대는 머리줄 아래에 붙는다. 카드 줄은 스크롤 칸이 아니라 transform 으로 흐른다.
   무대 높이는 svh(주소창이 나와 있을 때 높이) — 주소창이 들어가고 나와도 섹션 길이가 그대로다 */
.cx-ld[data-flow]{padding:0}
/* 무대 overflow 는 일부러 hidden(스크롤 칸) — 찾기(Ctrl+F) · 읽기 프로그램이 화면 밖 카드를 보여 주려고 무대를 옆으로 밀면 스크립트가 그만큼 페이지를 굴려
   카드 줄을 흐르게 하고 무대는 0 으로 되돌린다(clip 이면 밀리지는 않지만 화면 밖 카드로 갈 길이 없다, 261012 검토) */
.cx-ld[data-flow] .cx-ld-stage{position:sticky;top:var(--hh);display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;height:calc(100vh - var(--hh));height:calc(100svh - var(--hh));overflow:hidden}
.cx-ld[data-flow] .cx-ld-rail{touch-action:pan-y}
.cx-ld[data-flow] .cx-ld-track{overflow:visible;scroll-snap-type:none;margin-top:0;margin-bottom:0;padding-top:0;padding-bottom:0;will-change:transform}
.cx-ld[data-flow] .cx-ld-track::after{display:none}
/* 서버 첫 그림(스크립트가 판을 고르기 전 = data-pre) — 흐르는 판이 될 화면은 섹션 높이 · 붙는 무대를 대략 미리 그려 둔다.
   안 그러면 붙은 뒤 섹션이 1.8천 px 늘어나 스크롤 앵커링이 없는 브라우저는 섹션 아래에서 새로 고침 · 뒤로 가기 하면 자리가 위로 튄다(261012 검토).
   흐를 거리 ≈ 데스크톱 카드 6칸(1280 미만 7칸) · 태블릿 7칸 · 폰 8칸(폰 카드 폭 ≈ 무대 높이에 맞춘 값) — 붙은 뒤와 차이 40px 안팎(실측).
   스크립트가 없으면 <noscript> 가 되돌린다 */
@media (prefers-reduced-motion:no-preference) and (min-width:1024px) and (min-height:560px){
  .cx-ld[data-pre]{padding:0}
  .cx-ld[data-pre] .cx-ld-run{height:calc(100vh - var(--hh) + 6 * (var(--cw) + var(--gap)))}
}
@media (prefers-reduced-motion:no-preference) and (min-width:1024px) and (max-width:1279.98px) and (min-height:560px){
  .cx-ld[data-pre] .cx-ld-run{height:calc(100vh - var(--hh) + 7 * (var(--cw) + var(--gap)))}
}
@media (prefers-reduced-motion:no-preference) and (max-width:1023.98px) and (min-height:640px){
  .cx-ld[data-pre]{padding:0}
  .cx-ld[data-pre] .cx-ld-run{height:calc(100svh - var(--hh) + 8 * (min(var(--cw), (100svh - var(--hh) - 278px) * .7) + var(--gap)))}
}
@media (prefers-reduced-motion:no-preference) and (min-width:768px) and (max-width:1023.98px) and (min-height:640px){
  .cx-ld[data-pre] .cx-ld-run{height:calc(100svh - var(--hh) + 7 * (var(--cw) + var(--gap)))}
}
@media (prefers-reduced-motion:no-preference) and (min-width:1024px) and (min-height:560px),(prefers-reduced-motion:no-preference) and (min-height:640px){
  .cx-ld[data-pre] .cx-ld-stage{position:sticky;top:var(--hh);display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;height:calc(100vh - var(--hh));height:calc(100svh - var(--hh))}
}
@media (max-width:1023.98px){
  /* 하단 탭바(58 + 바닥 안전 영역) 위에서 가운데 — 스크롤을 올려 탭바가 나와도 01 / 09 · 단추가 가려지지 않는다 */
  .cx-ld[data-flow] .cx-ld-stage{padding-bottom:calc(58px + max(8px, env(safe-area-inset-bottom, 0px)))}
  /* 사이 여백은 낮은 화면(사파리 · 크롬 실제 창 659~668)에서 더 줄여 카드를 키운다(844 이상은 예전과 같은 30 안팎) */
  .cx-ld[data-flow] .cx-ld-rail{margin-top:clamp(16px,calc(7.5vh - 33px),30px)}
  .cx-ld[data-flow] .cx-ld-nav{margin-top:clamp(14px,calc(7.5vh - 35px),30px)}
}
/* 카드 — 파랑 / 어두운 유리 / 흰 유리, 셋 다 뒤 비단이 살짝 비친다(파랑 ≈ .68 · 어두운 유리 ≈ .45 · 흰 유리 ≈ .4, 흐림은 띠 결이 남을 만큼만 8~10px,
   왼쪽 위 옅은 빛 한 겹 = 유리 결). 사람 사진은 그 위라 비치지 않는다.
   그림자 세기 --sh = 왼쪽 띠에 다가갈수록 스크립트가 0 으로(마스크가 그림자를 '툭' 자르기 전에).
   마스크 그림 판은 카드보다 사방 64px 크게 · mask-clip:no-clip — 그림자(아래 44~58px)도 같은 띠로 녹는다(폰처럼 그림자 거둘 칸이 없는 1단에서
   맨 앞 카드 그림자가 0.5px 만 움직여도 꺼지던 것, 261012 검토). no-clip 을 모르는 브라우저는 예전처럼 테두리에서 잘린다 — 스크립트 셈은 같다 */
.cx-lc{flex:none;width:var(--cw);scroll-snap-align:start}
.cx-lc-in{position:relative;margin:0;aspect-ratio:7/10;border-radius:5px;overflow:hidden;isolation:isolate;color:#fff;
  --scrim:rgba(20,88,206,.9);--scrim-mid:rgba(27,96,214,.48);--ring:rgba(255,255,255,.3);--no:rgba(255,255,255,.12);--sc:20,70,170;--sa:.5;
  background:linear-gradient(128deg,rgba(255,255,255,.2) 0%,rgba(255,255,255,0) 42%),radial-gradient(90% 58% at 50% 24%,rgba(115,174,255,.5) 0%,rgba(49,130,246,.66) 54%,rgba(27,100,218,.84) 100%);
  -webkit-backdrop-filter:blur(8px) saturate(1.4);backdrop-filter:blur(8px) saturate(1.4);
  box-shadow:0 28px 44px -28px rgba(var(--sc),calc(var(--sa) * var(--sh,1)));transition:transform .6s var(--ez);
  -webkit-mask-size:calc(100% + 128px) calc(100% + 128px);mask-size:calc(100% + 128px) calc(100% + 128px);-webkit-mask-position:-64px -64px;mask-position:-64px -64px;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;mask-clip:no-clip}
.cx-lc[data-tone=smoke] .cx-lc-in{--scrim:rgba(13,17,25,.86);--scrim-mid:rgba(17,21,31,.4);--ring:rgba(255,255,255,.18);--no:rgba(255,255,255,.11);--sc:8,18,40;--sa:.55;
  background:linear-gradient(128deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 42%),radial-gradient(85% 55% at 50% 26%,rgba(132,150,182,.14) 0%,rgba(46,54,70,.4) 56%,rgba(17,21,29,.72) 100%);
  -webkit-backdrop-filter:blur(10px) saturate(1.4);backdrop-filter:blur(10px) saturate(1.4)}
.cx-lc[data-tone=frost] .cx-lc-in{color:#191F28;--scrim:rgba(250,251,253,.9);--scrim-mid:rgba(250,251,253,.48);--ring:rgba(255,255,255,.72);--no:rgba(27,100,218,.09);--sc:30,70,140;--sa:.36;
  background:linear-gradient(165deg,rgba(255,255,255,.54),rgba(255,255,255,.26));
  -webkit-backdrop-filter:blur(10px) saturate(1.6);backdrop-filter:blur(10px) saturate(1.6)}
.cx-lc-in img{position:absolute;inset:0;z-index:0;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 0;pointer-events:none;-webkit-user-drag:none;transition:opacity .7s ease}
.cx-ld[data-js] .cx-lc-in img:not([data-ld]){opacity:0}
.cx-lc[data-cut] .cx-lc-in img{filter:drop-shadow(0 22px 28px rgba(6,20,52,.28))}
/* 회색 스튜디오 사진 — 가장자리(회색 배경)를 녹여 유리 위에 앉힌다. 얼굴 · 몸 가운데는 그대로(유령처럼 비치지 않게).
   타원을 좁혀(62%×74%) 머리 위 · 위쪽 모서리 회색도 녹인다 — 넓은 타원은 위 60% 가 불투명한 사진 인화처럼 보였다(261012 검토) */
.cx-lc:not([data-cut]) .cx-lc-in img{opacity:.95;-webkit-mask-image:radial-gradient(ellipse 62% 74% at 50% 40%,#000 46%,rgba(0,0,0,.5) 70%,transparent 94%);mask-image:radial-gradient(ellipse 62% 74% at 50% 40%,#000 46%,rgba(0,0,0,.5) 70%,transparent 94%)}
/* 글자 덮막 — 이름 자리(아래 20%)는 카드 색으로(흰 재킷 누끼 · 회색 사진 위에서도 대비 AA) */
.cx-lc-in::before{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,transparent 42%,var(--scrim-mid) 64%,var(--scrim) 84%,var(--scrim) 100%);pointer-events:none}
.cx-lc-in::after{content:'';position:absolute;inset:0;z-index:3;border-radius:inherit;box-shadow:inset 0 0 0 1px var(--ring),inset 0 1px 0 var(--ring);pointer-events:none}
/* 알약 = 직함(코드) — 가장 긴 것(일 'マーケティングチームリーダー' · 영 'Chief Technology Officer')도 가장 좁은 카드 안에 한 줄 */
/* 글자 크기 = 카드 폭 × .05(12px 까지) — 낮은 폰 화면에서 카드를 줄여도(최소 210) 한 줄에 든다 */
/* 큰 번호 — 아주 옅은 선만(속 빈 글자), 오른쪽 위에 세로로(261013 알약을 없애 위로 올림).
   선 대비는 세 카드 모두 ≈1.12~1.14:1(261012 검토 — 흰 유리의 파란 선만 또렷하던 것) */
.cx-lc-no{position:absolute;top:18px;right:8px;z-index:2;writing-mode:vertical-rl;font-size:clamp(54px,4.7vw,72px);line-height:1;font-weight:500;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;color:transparent;-webkit-text-stroke:1px var(--no);pointer-events:none;user-select:none}
@supports not (-webkit-text-stroke:1px #000){.cx-lc-no{color:var(--no)}}
.cx-lc-cap{position:absolute;left:20px;right:20px;bottom:20px;z-index:2;display:block}
.cx-lc-n{display:block;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-0.02em}
@media (min-width:1024px){.cx-lc-n{font-size:26px}}
/* 이름 아래 '코드 직함' — 코드는 굵게, 직함은 보통(261013 사장 '알약 말고 이름 아래에 CEO 대표이사') */
.cx-lc-r{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:6px;margin-top:6px;font-size:15px;line-height:1.45;font-weight:500;opacity:.92}
.cx-lc-code{font-weight:700;letter-spacing:.02em}
@media (min-width:1024px){.cx-lc-r{font-size:16px}}
@media (hover:hover) and (pointer:fine){.cx-lc:hover .cx-lc-in{transform:translate3d(0,-8px,0);box-shadow:0 38px 52px -32px rgba(var(--sc),calc(var(--sa) * var(--sh,1)))}}
/* 왼쪽 띠를 다 지나간 카드는 숨긴다 */
.cx-lc[data-gone]{visibility:hidden}
/* 들어올 때 — 오른쪽에서 차례로(스크립트가 붙은 뒤에만 숨긴다) */
.cx-lc{transition:opacity .9s var(--ez),transform 1.1s var(--ez);transition-delay:calc(min(var(--i),5) * 70ms)}
.cx-ld[data-arm] .cx-lc{opacity:0;transform:translate3d(72px,0,0)}
.cx-ld[data-in] .cx-lc{opacity:1;transform:none}
/* 01 / 09 · 단추 — 09 는 #4E5968(일렁이는 바탕에서 #8B95A1 은 녹는다, 261012 검토), 모바일은 단추와 같은 유리 알약 안에 */
.cx-ld-nav{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:30px}
.cx-ld-count{display:flex;align-items:center;gap:12px;font-size:15px;font-weight:600;letter-spacing:.02em;color:#4E5968;font-variant-numeric:tabular-nums;white-space:nowrap}
.cx-ld-count b{font-weight:700;color:#191F28}
.cx-ld-bar{position:relative;display:block;width:88px;height:2px;border-radius:2px;background:rgba(25,31,40,.2);overflow:hidden}
.cx-ld-bar-in{position:absolute;inset:0;background:#191F28;transform-origin:0 50%;transform:scaleX(.1111)}
@media (max-width:1023.98px){
  /* 제목 뒤 옅은 안개 — 띠가 제목 줄을 지나갈 때도 작은 글자가 읽히게(데스크톱은 아래 .cx-ld-in::before) */
  .cx-ld-head::before{content:'';position:absolute;z-index:-1;left:0;right:0;top:-36px;bottom:-28px;background:radial-gradient(75% 62% at 30% 50%,rgba(250,252,255,.8),rgba(250,252,255,.5) 55%,rgba(250,252,255,0));pointer-events:none}
  .cx-ld-count{box-sizing:border-box;height:48px;padding:0 18px;border-radius:999px;background:rgba(255,255,255,.62);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.9)}
}
@media (max-width:420px){.cx-ld-bar{width:56px}}
.cx-ld-btns{display:flex;gap:10px}
.cx-ld-btn{display:flex;align-items:center;justify-content:center;width:48px;height:48px;padding:0;border:0;border-radius:50%;cursor:pointer;transition:transform .25s var(--ez),background-color .2s ease,opacity .2s ease,box-shadow .25s ease;-webkit-tap-highlight-color:transparent}
.cx-ld-prev{background:rgba(255,255,255,.74);color:#333D4B;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.95),0 10px 22px -12px rgba(30,70,140,.4)}
.cx-ld-next{background:#3182F6;color:#fff;box-shadow:0 12px 24px -10px rgba(49,130,246,.7)}
.cx-ld-prev:hover:not([aria-disabled=true]){background:rgba(255,255,255,.94)}
.cx-ld-next:hover:not([aria-disabled=true]){background:#1B64DA}
.cx-ld-btn:active:not([aria-disabled=true]){transform:scale(.94)}
.cx-ld-btn[aria-disabled=true]{opacity:.55;cursor:default;box-shadow:none}
.cx-ld-btn:focus-visible{outline:2px solid #3182F6;outline-offset:3px}
/* 데스크톱 — 왼쪽 제목 칸 + 카드 줄 */
@media (min-width:1024px){
  .cx-ld{padding:150px 0 160px;--cw:clamp(244px,17.4vw,288px);--gap:20px;--pad:16px;--cl:max(48px,calc((100% - 1140px) / 2))}
  /* 제목 · 단추 묶음을 카드 세로 가운데에(가운데 두 줄 = 제목 · 단추, 위아래 1fr 은 빈 줄) */
  .cx-ld-in{display:grid;grid-template-columns:clamp(270px,24vw,350px) minmax(0,1fr);grid-template-rows:1fr auto auto 1fr;grid-template-areas:'. rail' 'head rail' 'nav rail' '. rail';column-gap:24px;padding-left:var(--cl)}
  .cx-ld-head{grid-area:head;padding:0}
  .cx-ld-nav{grid-area:nav;flex-direction:row-reverse;justify-content:flex-end;gap:28px;margin-top:44px;padding:0}
  .cx-ld-rail{grid-area:rail;align-self:center;margin-top:0}
  .cx-ld-btn{width:52px;height:52px}
  /* 1024~1200 은 제목 칸이 좁다(270) — 막대를 줄여 단추 · 번호가 칸 안에 든다 */
  .cx-ld-bar{width:clamp(48px,5.6vw,88px)}
  /* 제목 칸 뒤 읽기용 안개 — 띠는 카드 뒤로 흐르고 글자 뒤는 차분하게(참고 화면의 흰 안개) */
  .cx-ld-in::before{content:'';position:absolute;left:0;top:50%;width:min(48vw,660px);height:560px;transform:translateY(-50%);background:radial-gradient(closest-side at 42% 50%,rgba(250,252,255,.8),rgba(250,252,255,.5) 55%,rgba(250,252,255,0));pointer-events:none}
}

/* ⑤ 조직도 — 카드 · 얼굴 원 · ⋯ 말풍선은 orgStyles.ts(cxo-, 261013). 여기는 섹션 여백만 */
.cx-org{background:#fff;padding:120px 0}
@media (min-width:768px){.cx-org{padding:150px 0}}
@media (min-width:1024px){.cx-org{padding:180px 0}}

/* ⑥ 맺음 */
.cx-cl{position:relative;background:rgb(2,14,32);color:#fff}
.cx-cl-band{height:220px;background:linear-gradient(180deg,#fff 0%,rgb(246,236,234) 18%,rgb(176,160,172) 40%,rgb(52,72,104) 66%,rgb(2,14,32) 100%)}
.cx-cl-stage{position:relative;overflow:hidden;padding:40px 0 140px}
@media (min-width:1024px){.cx-cl-stage{padding:90px 0 200px}}
.cx-cl-ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.5}
.cx-cl-veil{position:absolute;inset:0}
.cx-cl-in{position:relative}
.cx-cl-t{margin:0;text-wrap:balance;max-width:15em;font-size:30px;line-height:1.38;font-weight:700;letter-spacing:-0.03em;word-break:keep-all}
@media (min-width:768px){.cx-cl-t{font-size:44px;line-height:1.34}}
@media (min-width:1024px){.cx-cl-t{font-size:56px;line-height:1.3}}
.cx-clw{display:inline-block;color:rgba(255,255,255,.12);filter:blur(6px);will-change:color,filter}
.cx-cl-cta{margin-top:40px;opacity:0;transform:translate3d(0,16px,0);pointer-events:none;transition:opacity .6s cubic-bezier(.33,1,.68,1),transform .6s cubic-bezier(.33,1,.68,1)}
.cx-cl-cta[data-on]{opacity:1;transform:none;pointer-events:auto}
.cx-wpill{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 10px 0 22px;border-radius:136px;background:#fff;color:#1C1F25;font-size:16px;font-weight:600;letter-spacing:-0.02em;text-decoration:none;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:transform .25s var(--ez),background-color .2s ease;-webkit-tap-highlight-color:transparent}
.cx-wpill i{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#1C1F25;transition:transform .25s var(--ez)}
.cx-wpill:hover{background:#F2F4F6}
.cx-wpill:hover i{transform:translateX(2px)}
.cx-wpill:active{transform:scale(.97)}
.cx-wpill:focus-visible,.cx-gpill:focus-visible{outline:2px solid #fff;outline-offset:3px}
.cx-cl-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
.cx-gpill{display:inline-flex;align-items:center;height:40px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(255,255,255,.08);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:rgba(255,255,255,.86);font-size:14px;font-weight:600;text-decoration:none;transition:background-color .2s ease}
.cx-gpill:hover{background:rgba(255,255,255,.16)}
.cx-foot{background:rgb(2,14,32)}

@media (prefers-reduced-motion:reduce){
  .cx-rise,.cx-hint,.cx-hm-card,.cx-hm-pt{animation:none}
  .cx-hint-line::after{animation:none;transform:none}
  .cx-chip{opacity:1;transform:none;transition:none}
  .cx-vc-silk canvas,.cx-space canvas,.cx-mqw,.cx-hm-cap,.cx-cl-cta,.cx-sign-line,.cx-hl,.cx-wpill,.cx-lc,.cx-lc-in,.cx-lc-in img,.cx-ld-btn,.cx-ld-silk canvas{transition:none}
  .cx-ld[data-arm] .cx-lc{opacity:1;transform:none}
  .cx-sign-line{transform:none}
}
`;
