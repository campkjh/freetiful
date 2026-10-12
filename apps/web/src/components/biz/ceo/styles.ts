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
.cx-eyebrow{margin:0;font-size:15px;line-height:1.4;font-weight:600;letter-spacing:-0.01em;color:#3182F6}
@media (min-width:768px){.cx-eyebrow{font-size:17px}}
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
.cx-navy{position:absolute;inset:0;background:radial-gradient(110% 80% at 72% 28%,#22375A 0%,#12203A 42%,#08111F 100%)}
.cx-spot{position:absolute;left:0;top:0;width:1000px;height:1000px;border-radius:50%;transform-origin:0 0;background:radial-gradient(closest-side,rgba(110,148,210,.5),rgba(70,104,160,.2) 55%,rgba(30,50,90,0) 100%);will-change:transform;pointer-events:none}
.cx-wm{position:absolute;left:50%;top:54%;transform:translate3d(-50%,-50%,0);font-size:22vw;font-weight:700;line-height:1;letter-spacing:-0.05em;white-space:nowrap;color:rgba(255,255,255,.05);pointer-events:none;user-select:none;will-change:transform}
.cx-pt{position:absolute;left:0;top:0;max-width:none;transform-origin:0 0;will-change:transform,opacity;user-select:none;-webkit-user-drag:none}
.cx-floor{position:absolute;left:0;right:0;bottom:0;height:24%;background:linear-gradient(rgba(8,17,31,0),rgba(8,17,31,.5));pointer-events:none}
.cx-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,11,24,.82) 0%,rgba(5,11,24,.55) 34%,rgba(5,11,24,0) 60%);pointer-events:none}
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
.cx-hm-spot{position:absolute;left:50%;top:4%;width:120%;aspect-ratio:1/1;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(110,148,210,.5),rgba(70,104,160,.18) 55%,rgba(30,50,90,0) 100%);pointer-events:none}
.cx-hm-wm{top:42%;font-size:40vw}
.cx-hm-par{position:absolute;inset:0;will-change:transform}
.cx-hm-pt{position:absolute;bottom:0;left:50%;height:94%;width:auto;max-width:none;transform:translateX(-50%);transform-origin:50% 100%;animation:cxPortrait 1.6s var(--ez) .3s backwards;user-select:none;-webkit-user-drag:none}
@keyframes cxPortrait{from{opacity:0;transform:translateX(-50%) translate3d(0,6%,0) scale(1.1)}to{opacity:1;transform:translateX(-50%)}}
.cx-hm-fade{position:absolute;left:0;right:0;bottom:0;height:58%;background:linear-gradient(rgba(8,17,31,0) 0%,rgba(8,17,31,.62) 46%,rgba(8,17,31,.92) 100%);pointer-events:none}
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
  .cx-hm-spot{left:70%;top:-6%;width:70%}
  .cx-hm-wm{font-size:22vw;top:50%}
  .cx-hm-pt{left:70%;height:96%}
  .cx-hm-fade{top:0;height:auto;background:linear-gradient(90deg,rgba(5,11,24,.86) 0%,rgba(5,11,24,.5) 40%,rgba(5,11,24,0) 64%)}
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
.cx-vc{position:sticky;top:calc(var(--hh) + 20px + var(--i) * 12px);height:min(500px,calc(100vh - var(--hh) - 150px));height:min(500px,calc(100svh - var(--hh) - 150px));min-height:400px;margin-bottom:28px;border-radius:28px;overflow:hidden;background:#191F28;transform-origin:50% 0;will-change:transform;isolation:isolate;box-shadow:0 30px 60px -30px rgba(2,32,71,.35)}
.cx-vc:last-child{margin-bottom:0}
@media (min-width:1024px){.cx-vc{top:calc(var(--hh) + 110px + var(--i) * 18px);height:min(560px,calc(100vh - var(--hh) - 190px));margin-bottom:40px}}
.cx-va-still .cx-vc{position:relative;top:auto}
.cx-vc-ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cx-vc-grad{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,9,19,.2) 0%,rgba(2,9,19,0) 26%,rgba(2,9,19,.4) 54%,rgba(2,9,19,.88) 100%);pointer-events:none}
.cx-vc-blue{background:linear-gradient(155deg,#5AA2FF 0%,#3182F6 46%,#1B5FD0 100%)}
.cx-vc-blue .cx-vc-grad{background:linear-gradient(180deg,rgba(12,44,120,0) 38%,rgba(12,44,120,.6) 100%)}
.cx-vc-body{position:absolute;left:24px;right:24px;bottom:26px;z-index:1;color:#fff}
@media (min-width:1024px){.cx-vc-body{left:40px;right:40px;bottom:38px}}
.cx-vc-num{display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.16);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font-size:13px;font-weight:700;letter-spacing:.04em;font-variant-numeric:tabular-nums}
.cx-vc-t{margin:16px 0 0;text-wrap:balance;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-0.03em;word-break:keep-all}
.cx-vc-d{margin:10px 0 0;max-width:32em;font-size:15px;line-height:1.65;color:rgba(255,255,255,.84);word-break:keep-all}
@media (min-width:1024px){.cx-vc-t{font-size:36px}.cx-vc-d{font-size:17px}}
.cx-vc-dim{position:absolute;inset:0;z-index:2;background:#0B1220;opacity:0;pointer-events:none}
.cx-vc-phones{position:absolute;right:-4%;top:-6%;width:74%;height:84%;pointer-events:none}
.cx-vc-phone{position:absolute;left:calc(6% + var(--i) * 44%);top:calc(16% - var(--i) * 14%);width:46%;aspect-ratio:390/844;padding:5px;border-radius:30px;background:#0E1013;box-shadow:0 40px 60px -24px rgba(5,20,60,.6);transform:rotate(-9deg);animation:cxFloat 7s ease-in-out calc(var(--i) * -3.2s) infinite}
@keyframes cxFloat{0%,100%{translate:0 0}50%{translate:0 -10px}}
.cx-vc-screen{width:100%;height:100%;border-radius:25px;overflow:hidden;background:#fff}
.cx-vc-screen img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.cx-vc-island{position:absolute;left:50%;top:9px;width:30%;height:4.2%;transform:translateX(-50%);border-radius:999px;background:#0E1013}

/* ④ 이사진 — 일렁이는 유리 · 비단 바탕 + 오른쪽 끝까지 이어지는 카드 줄(261012 사장 '이런느낌으로 · 배경을 일렁이는 고급스러운 3d배경 느낌으로') */
/* 바탕 CSS = WebGL 이 없을 때(그리고 첫 장이 그려지기 전) 보이는 정지 그림 — 셰이더와 같은 연하늘 → 흰빛, 비스듬한 빛 띠 세 줄 */
.cx-ld{position:relative;overflow:hidden;isolation:isolate;padding:96px 0 88px;--cw:min(72vw,300px);--gap:14px;--pad:24px;
  background:radial-gradient(70% 55% at 16% 18%,rgba(255,255,255,.95) 0%,rgba(255,255,255,0) 70%),linear-gradient(166deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.8) 43%,rgba(255,255,255,0) 56%),linear-gradient(172deg,rgba(255,255,255,0) 56%,rgba(176,202,250,.55) 68%,rgba(255,255,255,0) 80%),linear-gradient(176deg,rgba(255,255,255,0) 62%,rgba(255,255,255,.7) 66%,rgba(255,255,255,0) 70%),linear-gradient(158deg,#F8FAFF 0%,#EAF1FE 40%,#D7E5FC 72%,#BCD2F8 100%)}
@media (min-width:768px){.cx-ld{padding:130px 0 116px;--cw:300px;--gap:20px;--pad:40px}}
.cx-ld-silk{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.cx-ld-silk canvas{display:block;width:100%;height:100%;opacity:0;transition:opacity 1.4s ease}
.cx-ld-silk canvas[data-on]{opacity:1}
/* 위(경영 철학 #F2F4F6) · 아래(조직도 흰색)와 이음새 없이 — 아래는 카드 밑 진한 띠가 급히 끊기지 않게 길게(261012 검토) */
.cx-ld::before,.cx-ld::after{content:'';position:absolute;left:0;right:0;z-index:1;pointer-events:none}
.cx-ld::before{top:0;height:80px;background:linear-gradient(#F2F4F6,rgba(242,244,246,0))}
.cx-ld::after{bottom:0;height:150px;background:linear-gradient(rgba(255,255,255,0) 0%,rgba(255,255,255,.35) 35%,rgba(255,255,255,.8) 70%,#fff 100%)}
/* 모바일 · 태블릿 = 제목 → 카드 줄 → 01 / 09 · 단추(DOM 은 단추가 카드 줄 앞 — 키보드 차례를 데스크톱 화면 순서와 맞춘다) */
.cx-ld-in{position:relative;z-index:2;display:flex;flex-direction:column}
.cx-ld-rail{order:1}
.cx-ld-nav{order:2}
.cx-ld-head,.cx-ld-nav{position:relative;z-index:1;box-sizing:border-box;padding:0 var(--pad)}
.cx-ld-h2{margin-top:12px}
.cx-ld-sub{margin:12px 0 0;font-size:16px;line-height:1.6;font-weight:500;color:#4E5968;word-break:keep-all}
@media (min-width:768px){.cx-ld-sub{margin-top:16px;font-size:18px}}
/* 이 섹션만 — 띠가 지나가는 바탕 위 작은 파란 글자는 한 단계 진하게 */
.cx-ld .cx-eyebrow{color:#1B64DA}
/* 카드 줄 — 위아래 여백(떠오름 · 그림자)만큼 넓혀 두고 바깥 여백으로 되돌린다 */
.cx-ld-rail{position:relative;margin-top:30px}
@media (min-width:768px){.cx-ld-rail{margin-top:40px}}
.cx-ld-track{position:relative;display:flex;gap:var(--gap);margin:-24px 0 -64px;padding:24px 0 64px var(--pad);list-style:none;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-padding-left:var(--pad);overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;outline:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
.cx-ld-track::-webkit-scrollbar{display:none}
/* 끝 빈칸 — 스크립트가 잰 --tail(끝에서 다 보이는 카드 수만큼 · 끝 자리 = 카드 경계). 없으면 줄 폭 - 카드 한 칸(마지막 카드가 맨 앞 자리에) */
.cx-ld-track::after{content:'';flex:none;width:var(--tail,calc(100% - var(--cw) - var(--gap)))}
.cx-ld-track[data-free]{scroll-snap-type:none}
@media (hover:hover) and (pointer:fine){.cx-ld-track{cursor:grab}.cx-ld-track[data-drag]{cursor:grabbing}}
.cx-ld-track:focus-visible .cx-lc[data-cur] .cx-lc-in{outline:2px solid #3182F6;outline-offset:3px}
/* 카드 — 파랑 / 어두운 유리 / 흰 유리 */
.cx-lc{flex:none;width:var(--cw);scroll-snap-align:start}
.cx-lc-in{position:relative;margin:0;aspect-ratio:7/10;border-radius:28px;overflow:hidden;isolation:isolate;color:#fff;
  --scrim:rgba(20,88,206,.96);--scrim-mid:rgba(27,96,214,.62);--ring:rgba(255,255,255,.24);--no:rgba(255,255,255,.58);
  background:radial-gradient(90% 58% at 50% 24%,#73AEFF 0%,#3182F6 54%,#1B64DA 100%);
  box-shadow:0 28px 44px -28px rgba(20,70,170,.5);transition:transform .6s var(--ez),box-shadow .6s var(--ez)}
/* 어두운 유리 — 누끼 카드는 위쪽을 덜 막아 뒤의 비단이 흐리게 비친다(연기 낀 유리) */
.cx-lc[data-tone=smoke] .cx-lc-in{--scrim:rgba(13,17,25,.95);--scrim-mid:rgba(17,21,31,.5);--ring:rgba(255,255,255,.16);--no:rgba(255,255,255,.42);
  background:radial-gradient(85% 55% at 50% 26%,rgba(132,150,182,.38) 0%,rgba(46,54,70,.62) 56%,rgba(17,21,29,.9) 100%);
  -webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 28px 44px -28px rgba(8,18,40,.55)}
.cx-lc[data-tone=frost] .cx-lc-in{color:#191F28;--scrim:rgba(250,251,253,.97);--scrim-mid:rgba(250,251,253,.6);--ring:rgba(255,255,255,.8);--no:rgba(49,130,246,.45);
  background:linear-gradient(165deg,rgba(255,255,255,.84),rgba(255,255,255,.56));
  -webkit-backdrop-filter:blur(20px) saturate(1.6);backdrop-filter:blur(20px) saturate(1.6);box-shadow:0 28px 44px -28px rgba(30,70,140,.36)}
.cx-lc[data-tone=frost]:not([data-cut]) .cx-lc-in{--no:rgba(49,130,246,.62)}
/* 회색 배경 사진은 카드를 꽉 덮어 유리가 안 보인다 — 흐림 계산만 아낀다 */
.cx-lc:not([data-cut]) .cx-lc-in{-webkit-backdrop-filter:none;backdrop-filter:none}
.cx-lc-in img{position:absolute;inset:0;z-index:0;display:block;width:100%;height:100%;object-fit:cover;object-position:50% 0;pointer-events:none;-webkit-user-drag:none;transition:opacity .7s ease}
.cx-ld[data-js] .cx-lc-in img:not([data-ld]){opacity:0}
.cx-lc[data-cut] .cx-lc-in img{filter:drop-shadow(0 22px 28px rgba(6,20,52,.28))}
/* 글자 덮막 — 카드 전체에 펴고 이름 · 직함 자리(아래 20%)는 카드 색으로 꽉(흰 재킷 누끼 위에서도 대비 AA, 261012 검토) */
.cx-lc-in::before{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,transparent 40%,var(--scrim-mid) 62%,var(--scrim) 82%,var(--scrim) 100%);pointer-events:none}
/* 회색 스튜디오 사진판 — 가장자리를 카드 색으로 물들여 사진이 아니라 유리 카드로 읽히게(어두운 유리는 번호 자리 오른쪽 위도) */
.cx-lc[data-tone=smoke]:not([data-cut]) .cx-lc-in::before{background:linear-gradient(180deg,transparent 40%,var(--scrim-mid) 62%,var(--scrim) 82%,var(--scrim) 100%),radial-gradient(125% 80% at 50% 36%,rgba(13,17,25,0) 45%,rgba(13,17,25,.62) 100%),radial-gradient(70% 45% at 100% 0%,rgba(13,17,25,.5),rgba(13,17,25,0) 70%)}
.cx-lc[data-tone=frost]:not([data-cut]) .cx-lc-in::before{background:linear-gradient(180deg,transparent 40%,var(--scrim-mid) 62%,var(--scrim) 82%,var(--scrim) 100%),radial-gradient(125% 80% at 50% 36%,rgba(250,251,253,0) 48%,rgba(250,251,253,.72) 100%)}
.cx-lc-in::after{content:'';position:absolute;inset:0;z-index:3;border-radius:inherit;box-shadow:inset 0 0 0 1px var(--ring),inset 0 1px 0 var(--ring);pointer-events:none}
.cx-lc-bd{position:absolute;left:18px;top:18px;z-index:2;display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.94);font-size:12px;font-weight:700;letter-spacing:.06em;color:#1B64DA}
.cx-lc[data-tone=smoke] .cx-lc-bd{background:rgba(10,14,22,.42);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);color:#fff}
.cx-lc[data-tone=frost] .cx-lc-bd{background:#1F6FE5;color:#fff}
/* 큰 번호 — 선만(속 빈 글자), 오른쪽 위에 세로로 · 머리에 닿지 않게 오른쪽 끝으로 */
.cx-lc-no{position:absolute;top:14px;right:6px;z-index:2;writing-mode:vertical-rl;font-size:clamp(56px,4.9vw,74px);line-height:1;font-weight:600;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;color:transparent;-webkit-text-stroke:1.2px var(--no);pointer-events:none;user-select:none}
@supports not (-webkit-text-stroke:1px #000){.cx-lc-no{color:var(--no)}}
.cx-lc-cap{position:absolute;left:22px;right:22px;bottom:22px;z-index:2;display:block}
.cx-lc-n{display:block;font-size:22px;line-height:1.3;font-weight:700;letter-spacing:-0.02em}
.cx-lc-r{display:block;margin-top:4px;font-size:14px;line-height:1.45;font-weight:500;color:rgba(255,255,255,.88);word-break:keep-all}
.cx-lc[data-tone=frost] .cx-lc-r{color:#4E5968}
/* 데스크톱 직함 — 1024~1365 은 카드가 최소폭이라 14px(일본어 'マーケティングチームリーダー' 가 한 줄에 든다) */
@media (min-width:1024px){.cx-lc-n{font-size:24px}.cx-lc-r{font-size:clamp(14px,1.05vw,15px)}}
/* 지나간 카드(줄 왼쪽 밖)는 그림자를 거둔다 — 안 그러면 줄 왼쪽 끝에서 그림자가 세로로 잘린 자국이 남는다 */
.cx-lc[data-past] .cx-lc-in{box-shadow:none}
@media (hover:hover) and (pointer:fine){.cx-lc:hover .cx-lc-in{transform:translate3d(0,-8px,0);box-shadow:0 38px 52px -32px rgba(20,60,150,.5)}}
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
/* 데스크톱 — 왼쪽 제목 칸 + 화면 오른쪽 끝까지 이어지는 카드 줄 */
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

/* ⑤ 조직도 */
.cx-org{background:#fff;padding:120px 0}
@media (min-width:768px){.cx-org{padding:150px 0}}
@media (min-width:1024px){.cx-org{padding:180px 0}}
.cx-ln{display:block;border-radius:2px;background:#C9D2DC}
.cx-lv{width:2px;transform-origin:50% 0;transform:scaleY(0)}
.cx-lh{height:2px;transform-origin:50% 50%;transform:scaleX(0)}
.cx-ap{opacity:0;transform:translate3d(0,14px,0) scale(.96);filter:blur(6px);transition:opacity .6s var(--ez),transform .7s var(--ez),filter .6s var(--ez)}
.cx-ap[data-on]{opacity:1;transform:none;filter:none}
.cx-oc{display:flex;flex-direction:column;align-items:center;min-width:220px;padding:20px 40px;border-radius:22px;background:#3182F6;color:#fff;box-shadow:0 18px 40px -14px rgba(49,130,246,.5)}
.cx-oc-b{font-size:12px;font-weight:600;letter-spacing:.06em;opacity:.8}
.cx-oc-n{margin-top:4px;font-size:21px;font-weight:700}
.cx-oc-r{font-size:13px;opacity:.9}
.cx-og{margin-top:72px}
.cx-og-top{display:flex;justify-content:center}
.cx-og-trunk{height:40px;margin:0 auto}
.cx-og-barw{position:relative;height:2px;margin:0 calc((100% - 64px) / 10)}
.cx-og-bar{position:absolute;inset:0}
.cx-og-cols{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px}
.cx-og-col{display:flex;flex-direction:column;align-items:center}
.cx-og-stub{height:28px}
.cx-og-stub2{height:18px}
.cx-ou{box-sizing:border-box;display:flex;flex-direction:column;align-items:center;width:100%;padding:18px 12px;border:1px solid #E5E8EB;border-radius:20px;background:#fff;text-align:center;box-shadow:0 10px 30px -18px rgba(2,32,71,.22)}
.cx-ou-b{font-size:12px;font-weight:700;letter-spacing:.06em;color:#3182F6}
.cx-ou-n{margin-top:4px;font-size:18px;font-weight:700;color:#191F28}
.cx-ou-r{margin-top:2px;font-size:13px;line-height:1.4;color:#6B7684;word-break:keep-all}
.cx-og-teams{display:flex;flex-direction:column;gap:8px;width:100%}
.cx-ot{padding:11px 10px;border:1px solid #EEF0F3;border-radius:14px;background:#F9FAFB;font-size:13px;color:#4E5968;text-align:center;opacity:0;transform:translate3d(0,10px,0);transition:opacity .5s var(--ez),transform .6s var(--ez);transition-delay:calc(var(--j) * 90ms)}
.cx-og-teams[data-on] .cx-ot{opacity:1;transform:none}
.cx-og-cap{margin:56px 0 0;font-size:15px;line-height:1.7;color:#6B7684;text-align:center;word-break:keep-all}
.cx-om{margin-top:44px}
.cx-om .cx-oc{align-items:flex-start;min-width:0;padding:20px 22px}
.cx-om-list{position:relative;padding:20px 0 0 44px}
.cx-om-trunk{position:absolute;left:21px;top:0}
.cx-om-row{position:relative;margin-top:14px}
.cx-om-row:first-of-type{margin-top:0}
.cx-om-stub{position:absolute;left:-23px;width:23px;transform-origin:0 50%}
.cx-om-card{align-items:flex-start;padding:16px 18px;text-align:left}
.cx-ou-teams{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.cx-ot-chip{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#F2F4F6;font-size:12.5px;font-weight:500;color:#4E5968}
@media (min-width:768px){.cx-om-list{padding-left:56px}.cx-om-trunk{left:27px}.cx-om-stub{left:-29px;width:29px}}

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
  .cx-rise,.cx-hint,.cx-hm-card,.cx-hm-pt,.cx-vc-phone{animation:none}
  .cx-hint-line::after{animation:none;transform:none}
  .cx-chip{opacity:1;transform:none;transition:none}
  .cx-ot,.cx-ap,.cx-mqw,.cx-hm-cap,.cx-cl-cta,.cx-sign-line,.cx-hl,.cx-wpill,.cx-lc,.cx-lc-in,.cx-lc-in img,.cx-ld-btn,.cx-ld-silk canvas{transition:none}
  .cx-ld[data-arm] .cx-lc{opacity:1;transform:none}
  .cx-sign-line{transform:none}
}
`;
