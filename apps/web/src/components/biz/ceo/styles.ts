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

/* ④ 이사진 */
.cx-lc{flex:none;margin:0}
.cx-lc-ph{position:relative;aspect-ratio:3/4;border-radius:28px;overflow:hidden;isolation:isolate;background:linear-gradient(180deg,#EEF1F5 0%,#D9DFE7 100%)}
.cx-lc-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.1);will-change:transform;user-select:none;-webkit-user-drag:none}
.cx-lc-bd{position:absolute;left:14px;top:14px;display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.8);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font-size:12px;font-weight:700;letter-spacing:.04em;color:#191F28}
.cx-lc figcaption{display:block;padding:16px 4px 0}
.cx-lc-n{display:block;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#191F28}
.cx-lc-r{display:block;margin-top:4px;font-size:15px;color:#6B7684;word-break:keep-all}
@media (min-width:1024px){.cx-lc-n{font-size:22px}}
.cx-ld-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
.cx-count{font-size:15px;font-weight:600;letter-spacing:.02em;color:#B0B8C1;font-variant-numeric:tabular-nums;white-space:nowrap}
.cx-count-cur{color:#191F28}
.cx-count-sep{margin:0 6px}
.cx-ld-stage{position:sticky;top:var(--hh);height:calc(100vh - var(--hh));overflow:hidden;display:flex;flex-direction:column;justify-content:center;background:#fff}
.cx-ld-meta{display:flex;align-items:center;gap:16px;padding-bottom:12px}
.cx-ld-bar{position:relative;display:block;width:120px;height:2px;border-radius:2px;background:#E5E8EB;overflow:hidden}
.cx-ld-bar-in{position:absolute;inset:0;background:#191F28;transform-origin:0 50%;transform:scaleX(0)}
.cx-ld-track{--lw:clamp(220px,calc((100vh - var(--hh) - 330px) * .75),320px);display:flex;gap:24px;width:max-content;margin-top:clamp(28px,5vh,56px);padding:0 max(48px,calc((100vw - 1140px) / 2));will-change:transform}
.cx-ld-track .cx-lc{width:var(--lw);opacity:0;transform:translate3d(90px,0,0);transition:opacity .9s var(--ez),transform 1.1s var(--ez);transition-delay:calc(var(--i) * 70ms)}
[data-in] .cx-ld-track .cx-lc{opacity:1;transform:none}
/* 마우스를 올리면 사진 칸이 살짝 떠오른다(사진 자체의 transform 은 시차가 쓰고 있어 칸을 움직인다) */
.cx-lc-ph{transition:transform .5s var(--ez),box-shadow .5s var(--ez)}
@media (hover:hover){.cx-lc:hover .cx-lc-ph{transform:translate3d(0,-6px,0);box-shadow:0 24px 40px -24px rgba(2,32,71,.35)}}
.cx-lm{padding:110px 0 24px;background:#fff}
@media (min-width:768px){.cx-lm{padding:150px 0 40px}}
.cx-lm-nav{display:none}
@media (min-width:768px){.cx-lm-nav{display:flex;align-items:center;gap:8px;padding-bottom:6px}.cx-lm-nav .cx-count{margin-right:8px}}
.cx-arrow{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:50%;background:#F2F4F6;color:#333D4B;cursor:pointer;transition:background-color .2s ease,opacity .2s ease}
.cx-arrow:hover:not(:disabled){background:#E5E8EB}
.cx-arrow:disabled{opacity:.35;cursor:default}
.cx-lm-track{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 24px;padding:36px 24px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.cx-lm-track::-webkit-scrollbar{display:none}
.cx-lm-track::after{content:'';flex:none;width:10px}
.cx-lm-track .cx-lc{width:min(68vw,280px);scroll-snap-align:start}
@media (min-width:768px){.cx-lm-track{gap:20px;scroll-padding:0 40px;padding:44px 40px 8px}.cx-lm-track .cx-lc{width:260px}}
@media (min-width:1024px){.cx-lm-track{scroll-padding:0 max(48px,calc((100vw - 1140px) / 2));padding:48px max(48px,calc((100vw - 1140px) / 2)) 8px}}
.cx-dots{display:flex;justify-content:center;gap:6px;margin-top:24px}
.cx-dot{position:relative;width:6px;height:6px;padding:0;border:0;border-radius:999px;background:#D1D6DB;cursor:pointer;transition:width .4s var(--ez),background-color .3s ease}
.cx-dot::before{content:'';position:absolute;inset:-10px -4px}
.cx-dot[data-on]{width:20px;background:#191F28}

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
  .cx-ot,.cx-ap,.cx-mqw,.cx-hm-cap,.cx-cl-cta,.cx-sign-line,.cx-hl,.cx-dot,.cx-wpill{transition:none}
  .cx-sign-line{transform:none}
}
`;
