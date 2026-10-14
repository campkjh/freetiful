// 웨딩 파트너 상세 랜딩 CSS(.pl-*) — 첨부 랜딩의 짜임(가운데 제목 · 둥근 연회색 카드 · 파랑→보라 띠 · 번갈아 놓인 기능 줄 ·
// 아이콘 격자 · 요금표형 카드 · 비교 카드 · 사진 격자 · 흐르는 키워드 · 묻고 답하기 · 마무리 띠)을 프리티풀 색·글꼴로 다시 그렸다.
// 등장 = [data-rv] (아래에서 · 왼쪽 · 오른쪽 · 커지며), 루트에 is-armed 가 붙은 뒤에만 숨긴다(스크립트 전엔 그냥 보임).
export const PL_CSS = `
.pl{--pl-ink:#191F28;--pl-sub:#4E5968;--pl-mute:#6B7684;--pl-gray:#8B95A1;--pl-line:#E9EDF2;--pl-card:#F6F8FB;--pl-blue:#3182F6;
  --pl-grad:linear-gradient(135deg,#4A7CF7 0%,#6370F6 48%,#8A6DF2 100%);color:var(--pl-ink);overflow-x:clip}
.pl *{box-sizing:border-box}
.pl-sec{padding:76px 20px 0}
.pl-center{text-align:center}
.pl-eyebrow{display:block;font-size:13px;font-weight:400;letter-spacing:.7px;color:#8B95A1;text-transform:uppercase;line-height:1.4}
.pl-h2{margin:8px 0 0;font-size:24px;line-height:1.42;font-weight:700;letter-spacing:-.6px;color:var(--pl-ink);word-break:keep-all;overflow-wrap:break-word;text-wrap:balance}
.pl-grad-text{background:var(--pl-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.pl-lead{margin:10px 0 0;font-size:15px;line-height:1.65;color:var(--pl-mute);letter-spacing:-.2px;word-break:keep-all;text-wrap:pretty}

/* 등장 */
.pl.is-armed [data-rv]{opacity:0;transform:translate3d(0,28px,0);transition:opacity .85s cubic-bezier(.22,.61,.36,1),transform .85s cubic-bezier(.22,.61,.36,1);transition-delay:var(--d,0s)}
.pl.is-armed [data-rv="left"]{transform:translate3d(-40px,0,0)}
.pl.is-armed [data-rv="right"]{transform:translate3d(40px,0,0)}
.pl.is-armed [data-rv="scale"]{transform:scale(.93)}
.pl.is-armed [data-rv][data-in]{opacity:1;transform:none}

/* ① 소개 문장 + 떠 있는 사진 */
.pl-intro{position:relative;padding:min(48vw,232px) 20px min(48vw,232px);text-align:center;background:radial-gradient(60% 50% at 50% 50%,#F3F6FF 0%,rgba(243,246,255,0) 100%)}
.pl-intro-statement{position:relative;z-index:2;margin:12px 0 0;font-size:24px;line-height:1.5;font-weight:700;letter-spacing:-.6px;word-break:keep-all;overflow-wrap:break-word;color:var(--pl-ink)}
.pl-intro-name{display:block;margin-bottom:6px;font-size:28px;line-height:1.35;letter-spacing:-.8px}
.pl-intro .pl-lead{position:relative;z-index:2}
.pl-float{position:absolute;z-index:1;display:block;padding:0;border:0;background:none;cursor:pointer;
  transform:translate3d(0,calc(var(--pl-p,0) * var(--k,0) * 1px),0);will-change:transform}
span.pl-float{cursor:default}
.pl-float-frame{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:5px;overflow:hidden;background:#EEF1F5;
  box-shadow:0 12px 26px -12px rgba(28,40,96,.3),0 1px 4px rgba(28,40,96,.08);animation:plBob var(--t,6s) ease-in-out var(--dl,0s) infinite;transition:scale .15s}
.pl-float-frame img{width:100%;height:100%;object-fit:cover;display:block}
.pl-float-frame.is-deco{background:var(--pl-grad)}
.pl-float:active .pl-float-frame{scale:.96}
@keyframes plBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}

/* ② 한눈에 보기(흰 카드) + 매니저(파랑 카드) */
.pl-duo{display:grid;gap:12px;margin-top:28px}
.pl-card{border-radius:24px;background:#fff;border:1px solid var(--pl-line);padding:24px 22px 12px}
.pl-tag{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:#EEF4FF;color:var(--pl-blue);font-size:12.5px;font-weight:700;letter-spacing:-.2px}
.pl-card-title{margin:12px 0 0;font-size:19px;line-height:1.45;font-weight:700;letter-spacing:-.4px;word-break:keep-all;overflow-wrap:break-word}
.pl-facts-link a{color:var(--pl-blue)}
.pl-facts{margin:14px 0 0;padding:0;list-style:none}
.pl-facts li{display:flex;gap:14px;padding:13px 0;border-top:1px solid #F0F2F5;font-size:15px;line-height:1.55;letter-spacing:-.2px}
.pl-facts dt,.pl-facts .k{width:68px;flex-shrink:0;color:var(--pl-gray)}
.pl-facts .v{min-width:0;flex:1;color:var(--pl-ink);font-weight:600;word-break:keep-all}
.pl-blue{position:relative;overflow:hidden;border-radius:24px;padding:26px 22px 22px;color:#fff;background:var(--pl-grad);isolation:isolate}
.pl-blue::before,.pl-blue::after{content:"";position:absolute;z-index:-1;border-radius:50%;filter:blur(30px);opacity:.55;animation:plDrift 14s ease-in-out infinite}
.pl-blue::before{width:220px;height:220px;right:-60px;top:-80px;background:#9FD0FF}
.pl-blue::after{width:180px;height:180px;left:-50px;bottom:-90px;background:#C8A8FF;animation-delay:-7s}
.pl-blue .pl-tag{background:rgba(255,255,255,.18);color:#fff}
.pl-blue h3{margin:12px 0 0;font-size:21px;line-height:1.42;font-weight:700;letter-spacing:-.5px;word-break:keep-all}
.pl-blue p{margin:8px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,.84);letter-spacing:-.2px;word-break:keep-all}
.pl-white-btn{display:inline-flex;align-items:center;gap:2px;margin-top:20px;height:44px;padding:0 14px 0 18px;border:0;border-radius:999px;background:#fff;color:#3B5BF0;font-size:15px;font-weight:700;letter-spacing:-.2px;cursor:pointer;transition:transform .15s}
.pl-white-btn:active{transform:scale(.96)}
@keyframes plDrift{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-24px,18px,0) scale(1.12)}}

/* ③ 넘겨 보는 카드 */
.pl-rail{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 20px;padding:6px 20px 10px;margin-top:28px;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.pl-rail::-webkit-scrollbar{display:none}
.pl-rail.is-drag{scroll-snap-type:none;cursor:grabbing}
.pl-rail.is-drag *{pointer-events:none}
.pl-hl{position:relative;flex:0 0 68%;max-width:300px;aspect-ratio:4/5;scroll-snap-align:start;border-radius:22px;overflow:hidden;background:var(--pl-card);
  transition:transform .5s cubic-bezier(.22,.61,.36,1),opacity .5s;user-select:none;-webkit-user-select:none}
.pl-hl.is-dim{transform:scale(.955);opacity:.72}
.pl-hl img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none}
.pl-hl-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 38%,rgba(0,0,0,.62) 100%)}
.pl-hl-body{position:absolute;left:0;right:0;bottom:0;padding:20px}
.pl-hl-k{font-size:13px;font-weight:600;letter-spacing:-.1px;opacity:.82}
.pl-hl-v{margin-top:4px;font-size:22px;line-height:1.36;font-weight:700;letter-spacing:-.5px;word-break:keep-all;overflow-wrap:break-word}
.pl-hl.is-photo .pl-hl-body{color:#fff}
.pl-hl.is-grad{background:var(--pl-grad);color:#fff}
.pl-hl.is-art{background:#EEEDFD}
.pl-hl-art-fade{position:absolute;left:0;right:0;top:0;height:46%;background:linear-gradient(180deg,rgba(240,239,254,.94) 0%,rgba(240,239,254,.7) 55%,rgba(240,239,254,0) 100%)}
.pl-hl-body.is-top{top:0;bottom:auto;color:var(--pl-ink)}
.pl-hl.is-art .pl-hl-k{color:#6B7684;opacity:1}
.pl-hl.is-plain .pl-hl-body,.pl-hl.is-grad .pl-hl-body{top:0;display:flex;flex-direction:column;justify-content:flex-end}
.pl-hl-ic{position:absolute;left:20px;top:20px;width:52px;height:52px;border-radius:17px;display:flex;align-items:center;justify-content:center;background:#fff;color:var(--pl-blue);box-shadow:0 8px 20px -10px rgba(49,90,200,.35)}
.pl-hl.is-grad .pl-hl-ic{background:rgba(255,255,255,.2);color:#fff;box-shadow:none}
.pl-hl-quote{font-size:16px;line-height:1.62;font-weight:600;letter-spacing:-.3px;color:var(--pl-ink);display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden;word-break:keep-all}
.pl-hl-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.pl-hl-tags span{height:30px;display:inline-flex;align-items:center;padding:0 11px;border-radius:999px;background:#fff;font-size:13.5px;font-weight:600;color:var(--pl-sub)}
.pl-progress{position:relative;margin:14px auto 0;width:96px;height:3px;border-radius:3px;background:#E5E8EB;overflow:hidden}
.pl-progress>i{position:absolute;left:0;top:0;bottom:0;border-radius:3px;background:#333D4B;width:var(--w,30%);transform:translateX(var(--x,0%));transition:transform .12s linear}

/* ④ AI 분석 */
.pl-ai-head{display:flex;align-items:center;justify-content:center;gap:6px}
.pl-ai-head .pl-eyebrow{color:#7C6AE6;font-weight:500}
.pl-ask{position:relative;margin-top:14px;border-radius:24px;background:#fff;border:1px solid var(--pl-line);padding:20px 18px 18px;box-shadow:0 24px 48px -32px rgba(60,70,160,.35)}
.pl-ask-label{font-size:14px;font-weight:600;color:var(--pl-sub);letter-spacing:-.2px}
.pl-ask-bar{margin-top:12px;display:flex;align-items:center;gap:10px;width:100%;height:56px;padding:0 8px 0 18px;border:1px solid #E3E7EE;border-radius:999px;background:#FAFBFD;cursor:pointer;text-align:left;transition:border-color .2s,box-shadow .2s}
.pl-ask-bar:hover{border-color:#C9D6F5;box-shadow:0 0 0 4px rgba(49,130,246,.08)}
.pl-ask-bar:active{transform:scale(.99)}
.pl-ask-text{min-width:0;flex:1;font-size:15.5px;letter-spacing:-.2px;color:#333D4B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-caret{display:inline-block;width:1.5px;height:1.05em;margin-left:1px;vertical-align:-2px;background:#3182F6;animation:plCaret 1s steps(1) infinite}
@keyframes plCaret{50%{opacity:0}}
.pl-send{flex-shrink:0;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--pl-grad);color:#fff;box-shadow:0 6px 14px -6px rgba(80,100,240,.6)}
.pl-ask-foot{display:flex;align-items:center;justify-content:space-between;margin-top:14px}
.pl-ask-foot img{height:14px;width:auto;opacity:.9}
.pl-ask-foot span{font-size:12.5px;color:var(--pl-gray);letter-spacing:-.1px}

/* ⑤ 매니저 띠 — 사장 그림(3:2, 왼쪽이 비어 있는 밝은 라벤더) 위 왼쪽에 제목만 */
.pl-band{position:relative;overflow:hidden;margin-top:76px;aspect-ratio:3/2;min-height:250px;background:#F4F5FE;container-type:inline-size;isolation:isolate}
.pl-band-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:78% 50%;z-index:-1;
  transform:scale(1.06) translate3d(0,calc(var(--pl-p,0) * -10px),0);will-change:transform}
.pl-band-copy{position:relative;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;height:100%;width:58%;padding:0 0 0 7cqw}
.pl-band .pl-eyebrow{font-size:max(11px,3cqw);color:#7C86A8}
.pl-band h2{margin:7px 0 0;font-size:max(18px,5.6cqw);line-height:1.4;font-weight:700;letter-spacing:-.5px;color:var(--pl-ink);word-break:keep-all}
.pl-band-btn{display:inline-flex;align-items:center;gap:1px;margin-top:max(12px,3.6cqw);height:38px;padding:0 10px 0 14px;border:0;border-radius:999px;background:#fff;color:#3B5BF0;font-size:14px;font-weight:700;letter-spacing:-.2px;cursor:pointer;box-shadow:0 6px 16px -8px rgba(60,80,200,.35);transition:transform .15s}
.pl-band-btn:active{transform:scale(.96)}

/* ⑥ 이렇게 준비해요 — 번갈아 놓인 기능 줄 */
.pl-gray{margin-top:0;padding-top:64px;padding-bottom:64px;background:#F4F6F9}
.pl-gray + .pl-sec{padding-top:64px}
.pl-rows{display:grid;gap:14px;margin-top:28px;container-type:inline-size}
.pl-row{display:grid;border-radius:24px;background:#fff;overflow:hidden}
.pl-row-ui{position:relative;height:200px;overflow:hidden;background:linear-gradient(160deg,#EAF1FF 0%,#F3F0FF 100%)}
.pl-row-txt{padding:20px 22px 22px}
.pl-step{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:999px;background:#fff;color:var(--pl-blue);font-size:12px;font-weight:700;letter-spacing:.2px}
.pl-row-txt h3{margin:10px 0 0;font-size:19px;line-height:1.42;font-weight:700;letter-spacing:-.45px;word-break:keep-all;overflow-wrap:break-word}
.pl-row-txt p{margin:6px 0 0;font-size:14.5px;line-height:1.62;color:var(--pl-mute);letter-spacing:-.2px;word-break:keep-all}
.pl-link{display:inline-flex;align-items:center;gap:1px;margin-top:12px;padding:0;border:0;background:none;font-size:14.5px;font-weight:600;color:var(--pl-blue);cursor:pointer}
@container (min-width:440px){
  .pl-row{grid-template-columns:1fr 1fr;align-items:stretch}
  .pl-row-ui{height:auto;min-height:220px}
  .pl-row-txt{display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:24px 20px}
  .pl-row.is-flip .pl-row-ui{order:2}
  .pl-msheet{width:90%;padding-left:12px;padding-right:12px}
  .pl-msheet .chips span{padding:0 7px}
}
/* 기능 줄 그림 — 사진 덱(매칭 화면 사회자 카드 덱과 같은 부품 · 누르면 사진 크게) */
.pl-deck{display:flex;align-items:center;justify-content:center;width:100%;padding:0;border:0;cursor:zoom-in;font:inherit}
/* 기능 줄 그림 — 미니 지도 */
.pl-mmap{position:absolute;inset:0;background-color:#EEF2F6;
  background-image:linear-gradient(0deg,transparent 46%,#fff 46%,#fff 54%,transparent 54%),linear-gradient(90deg,transparent 47%,#fff 47%,#fff 53%,transparent 53%),
  linear-gradient(28deg,transparent 48.5%,#fff 48.5%,#fff 51.5%,transparent 51.5%),linear-gradient(0deg,rgba(255,255,255,.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.7) 1px,transparent 1px);
  background-size:100% 100%,100% 100%,100% 100%,34px 34px,34px 34px}
.pl-mmap::before{content:"";position:absolute;left:8%;top:12%;width:26%;height:24%;border-radius:10px;background:#DDEFD9}
.pl-mmap::after{content:"";position:absolute;right:10%;bottom:10%;width:30%;height:22%;border-radius:10px;background:#D7E6F7}
.pl-pin{position:absolute;left:50%;top:50%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center}
.pl-pin b{display:block;max-width:150px;padding:7px 12px;border-radius:12px;background:#191F28;color:#fff;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.2px}
.pl-pin i{width:12px;height:12px;margin-top:6px;border-radius:50%;background:var(--pl-blue);border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.2);position:relative}
.pl-pin i::after{content:"";position:absolute;inset:-9px;border-radius:50%;border:2px solid rgba(49,130,246,.55);animation:plPulse 1.8s ease-out infinite}
@keyframes plPulse{0%{transform:scale(.4);opacity:1}100%{transform:scale(1.6);opacity:0}}
/* 기능 줄 그림 — 미니 문의 시트 */
.pl-msheet{position:absolute;left:50%;bottom:-10px;width:min(250px,84%);transform:translateX(-50%);border-radius:20px 20px 0 0;background:#fff;padding:12px 16px 26px;box-shadow:0 -10px 30px -16px rgba(30,40,100,.3)}
.pl-msheet .grab{display:block;width:32px;height:4px;margin:0 auto 10px;border-radius:2px;background:#E5E8EB}
.pl-msheet b{display:block;font-size:14px;font-weight:700;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl-msheet .chips{display:flex;gap:5px;margin-top:9px}
.pl-msheet .chips span{height:26px;display:inline-flex;align-items:center;padding:0 9px;border-radius:9px;background:#F2F4F6;font-size:11.5px;font-weight:600;color:var(--pl-sub);white-space:nowrap}
.pl-msheet .chips span.on{background:#E8F3FF;color:var(--pl-blue)}
.pl-msheet .field{height:30px;margin-top:8px;border-radius:9px;background:#F2F4F6}
.pl-msheet .send{position:relative;display:flex;align-items:center;justify-content:center;height:36px;margin-top:10px;border-radius:11px;background:var(--pl-blue);color:#fff;font-size:12.5px;font-weight:700;animation:plPress 3.2s ease-in-out infinite}
.pl-msheet .send::after{content:"";position:absolute;right:26%;top:55%;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid #fff;animation:plTap 3.2s ease-in-out infinite}
@keyframes plPress{0%,62%,78%,100%{transform:scale(1)}70%{transform:scale(.95)}}
@keyframes plTap{0%,50%{opacity:0;transform:translate(14px,14px) scale(1.4)}62%{opacity:1;transform:translate(0,0) scale(1)}70%{transform:scale(.8)}82%,100%{opacity:0;transform:scale(1)}}
/* 기능 줄 그림 — 알림 */
.pl-noti{position:absolute;left:50%;top:50%;width:min(270px,88%);transform:translate(-50%,-50%);display:flex;flex-direction:column;gap:8px}
.pl-noti>div{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border-radius:18px;background:rgba(255,255,255,.88);box-shadow:0 12px 26px -14px rgba(30,40,100,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.pl-noti>div:nth-child(1){animation:plNoti 5s cubic-bezier(.22,.61,.36,1) infinite}
.pl-noti>div:nth-child(2){opacity:.6;scale:.94;margin-top:-4px}
.pl-noti .app{flex-shrink:0;width:32px;height:32px;border-radius:9px;background:var(--pl-grad);display:flex;align-items:center;justify-content:center;color:#fff}
.pl-noti .t{min-width:0;flex:1}
.pl-noti .t b{display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;letter-spacing:-.2px}
.pl-noti .t b em{font-style:normal;font-weight:500;color:var(--pl-gray)}
.pl-noti .t span{display:block;margin-top:2px;font-size:12.5px;line-height:1.45;color:var(--pl-sub);letter-spacing:-.2px;word-break:keep-all;overflow-wrap:break-word}
@keyframes plNoti{0%{opacity:0;transform:translateY(-16px) scale(.96)}10%,86%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-6px)}}

/* ⑦ 업체 정보 — 아이콘 격자 */
/* 세 칸씩, 마지막 줄이 모자라면 가운데로 모은다 */
.pl-grid{display:flex;flex-wrap:wrap;justify-content:center;row-gap:26px;margin:30px 0 0;padding:0;list-style:none}
.pl-gi{display:flex;flex-direction:column;align-items:center;width:33.333%;padding:0 4px;text-align:center;min-width:0}
.pl-gi-ic{width:50px;height:50px;border-radius:17px;background:#F1F5FF;color:var(--pl-blue);display:flex;align-items:center;justify-content:center;transition:transform .3s cubic-bezier(.34,1.56,.64,1)}
.pl-gi:hover .pl-gi-ic{transform:translateY(-3px)}
.pl-gi-k{margin-top:10px;font-size:13px;color:var(--pl-gray);letter-spacing:-.1px}
.pl-gi-v{margin-top:3px;max-width:100%;padding:0 2px;font-size:14.5px;font-weight:700;line-height:1.45;letter-spacing:-.3px;word-break:keep-all;overflow-wrap:anywhere}
.pl-gi-v a{color:var(--pl-blue)}

/* ⑧ 홀 안내 — 요금표형 카드 */
.pl-plans{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 20px;padding:14px 20px 52px;margin:14px 0 -34px;scrollbar-width:none;overscroll-behavior-x:contain}
.pl-plans::-webkit-scrollbar{display:none}
.pl-plans.is-drag{scroll-snap-type:none;cursor:grabbing}
.pl-plans.is-drag *{pointer-events:none}
.pl-plan{flex:0 0 82%;max-width:340px;scroll-snap-align:start;border-radius:24px;background:#fff;border:1.5px solid var(--pl-line);overflow:hidden;transition:border-color .35s,box-shadow .35s,transform .35s;user-select:none;-webkit-user-select:none}
.pl-plans.is-single .pl-plan{flex-basis:100%;max-width:none}
.pl-plan.is-on{border-color:#7B95F7;box-shadow:0 22px 44px -22px rgba(70,100,240,.5);transform:translateY(-4px)}
.pl-plan-ph{position:relative;display:block;width:100%;aspect-ratio:16/9;padding:0;border:0;background:#F2F4F6;cursor:zoom-in}
.pl-plan-ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;-webkit-user-drag:none}
.pl-plan-ph em{position:absolute;right:10px;bottom:10px;font-style:normal;height:24px;display:inline-flex;align-items:center;padding:0 9px;border-radius:999px;background:rgba(0,0,0,.45);color:#fff;font-size:12px;font-weight:600}
.pl-plan-body{padding:18px 20px 16px}
.pl-plan-pill{display:inline-flex;align-items:center;height:26px;padding:0 10px;border-radius:999px;background:#F2F4F6;color:var(--pl-sub);font-size:12.5px;font-weight:700}
.pl-plan.is-on .pl-plan-pill{background:var(--pl-grad);color:#fff}
.pl-plan-name{margin:10px 0 0;font-size:19px;font-weight:700;letter-spacing:-.45px;word-break:keep-all;overflow-wrap:break-word}
.pl-plan-body>.pl-plan-name:first-child{margin-top:0}
.pl-plan-price{margin-top:12px;display:flex;align-items:baseline;gap:6px}
.pl-plan-price span{font-size:13.5px;color:var(--pl-gray)}
.pl-plan-price b{font-size:26px;font-weight:700;letter-spacing:-.8px}
.pl-plan ul{margin:14px 0 0;padding:14px 0 0;list-style:none;border-top:1px solid #F0F2F5;display:grid;gap:10px}
.pl-plan li{display:flex;gap:8px;font-size:14px;line-height:1.5;letter-spacing:-.2px;color:var(--pl-sub);word-break:keep-all}
.pl-plan li svg{flex-shrink:0;margin-top:2px;color:var(--pl-blue)}
.pl-plan li b{flex-shrink:0;font-weight:600;color:var(--pl-ink)}
.pl-note{margin:10px 20px 0;font-size:13px;line-height:1.55;color:var(--pl-gray);letter-spacing:-.2px;text-align:center;word-break:keep-all}
.pl-long{margin-top:14px;border-radius:20px;background:var(--pl-card);padding:18px 18px 16px}
.pl-long h3{margin:0;font-size:17px;font-weight:700;letter-spacing:-.4px}
.pl-long p{margin:10px 0 0;white-space:pre-line;word-break:keep-all;font-size:15px;line-height:1.65;letter-spacing:-.2px;color:#333D4B}
.pl-long button{margin-top:8px;padding:0;border:0;background:none;font-size:14px;font-weight:600;color:var(--pl-blue);cursor:pointer}

/* ⑨ 비교 */
.pl-vs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:28px;align-items:end}
.pl-vs-card{border-radius:22px;padding:22px 16px 20px;background:#F2F4F6}
.pl-vs-card h3{margin:0;font-size:15px;font-weight:700;letter-spacing:-.3px;color:var(--pl-sub)}
.pl-vs-card ul{margin:14px 0 0;padding:0;list-style:none;display:grid;gap:12px}
.pl-vs-card li{display:flex;gap:7px;font-size:13.5px;line-height:1.5;letter-spacing:-.25px;color:var(--pl-mute);word-break:keep-all}
.pl-vs-card li i{flex-shrink:0;width:16px;height:16px;margin-top:2px;border-radius:50%;background:#D1D6DB;position:relative}
.pl-vs-card li i::after{content:"";position:absolute;left:4px;right:4px;top:7px;height:2px;border-radius:1px;background:#fff}
.pl-vs-card.is-ours{position:relative;overflow:hidden;padding-top:30px;background:var(--pl-grad);color:#fff;box-shadow:0 24px 44px -22px rgba(80,90,240,.55);isolation:isolate}
.pl-vs-card.is-ours::before{content:"";position:absolute;z-index:-1;width:160px;height:160px;right:-60px;top:-60px;border-radius:50%;background:rgba(160,210,255,.6);filter:blur(28px)}
.pl-vs-card.is-ours h3{color:#fff}
.pl-vs-card.is-ours li{color:rgba(255,255,255,.92)}
.pl-vs-card.is-ours li svg{flex-shrink:0;margin-top:1px}
.pl-vs-badge{position:absolute;right:12px;top:12px;height:22px;display:inline-flex;align-items:center;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.22);font-size:11px;font-weight:700;letter-spacing:.3px}

/* ⑩ 사진 격자 */
.pl-gal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:26px}
.pl-gal>button{position:relative;aspect-ratio:1;padding:0;border:0;border-radius:5px;overflow:hidden;background:#F2F4F6;cursor:zoom-in}
.pl-gal>button.is-big{grid-column:span 2;grid-row:span 2}
.pl-gal.is-one{grid-template-columns:1fr}
.pl-gal.is-one>button{aspect-ratio:4/3}
.pl-gal.is-two{grid-template-columns:1fr 1fr}
.pl-gal img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .7s cubic-bezier(.22,.61,.36,1)}
@media (hover:hover){.pl-gal>button:hover img{transform:scale(1.06)}}
.pl-gal>button:active img{transform:scale(1.03)}
.pl-gal-more{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);color:#fff;font-size:18px;font-weight:700}
.pl-pill-btn{display:flex;align-items:center;gap:2px;margin:22px auto 0;height:46px;padding:0 16px 0 20px;border:1px solid #E5E8EB;border-radius:999px;background:#fff;font-size:15px;font-weight:600;color:#333D4B;cursor:pointer;transition:background-color .15s,transform .15s}
.pl-pill-btn:hover{background:#F9FAFB}
.pl-pill-btn:active{transform:scale(.97)}

/* ⑪ 흐르는 키워드 */
.pl-mq{display:grid;gap:10px;margin-top:30px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent);mask-image:linear-gradient(90deg,transparent,#000 14%,#000 86%,transparent)}
.pl-mq-track{display:flex;gap:8px;width:max-content;animation:plMarq var(--dur,30s) linear infinite}
.pl-mq-track.rev{animation-direction:reverse}
.pl-mq:hover .pl-mq-track{animation-play-state:paused}
.pl-mq-chip{flex-shrink:0;display:inline-flex;align-items:center;height:42px;padding:0 17px;border-radius:999px;background:var(--pl-card);border:1px solid var(--pl-line);font-size:15px;font-weight:600;color:var(--pl-sub);letter-spacing:-.2px;white-space:nowrap}
.pl-mq-chip b{margin-right:2px;font-weight:700;background:var(--pl-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
@keyframes plMarq{to{transform:translateX(-50%)}}

/* 위치(페이지가 그리는 지도 칸의 머리) */
.pl-loc{padding-top:76px}

/* ⑫ 묻고 답하기 */
.pl-faq{margin-top:26px;border-top:1px solid var(--pl-line)}
.pl-faq-item{border-bottom:1px solid var(--pl-line)}
.pl-faq-q{display:flex;width:100%;align-items:flex-start;gap:10px;padding:19px 2px;border:0;background:none;text-align:left;font-size:16px;line-height:1.5;font-weight:600;letter-spacing:-.3px;color:var(--pl-ink);cursor:pointer;word-break:keep-all}
.pl-faq-q .q{flex-shrink:0;font-weight:700;background:var(--pl-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.pl-faq-q .t{min-width:0;flex:1}
.pl-faq-plus{position:relative;flex-shrink:0;width:22px;height:22px;margin-top:1px;transition:transform .35s cubic-bezier(.22,.61,.36,1)}
.pl-faq-plus::before,.pl-faq-plus::after{content:"";position:absolute;left:4px;right:4px;top:10px;height:2px;border-radius:1px;background:#8B95A1}
.pl-faq-plus::after{transform:rotate(90deg)}
.pl-faq-item.is-open .pl-faq-plus{transform:rotate(45deg)}
.pl-faq-a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s cubic-bezier(.22,.61,.36,1)}
.pl-faq-item.is-open .pl-faq-a{grid-template-rows:1fr}
.pl-faq-a>div{overflow:hidden;min-height:0}
.pl-faq-a p{margin:0;padding:0 34px 20px 26px;font-size:15px;line-height:1.68;letter-spacing:-.2px;color:var(--pl-sub);word-break:keep-all;opacity:0;transform:translateY(-6px);transition:opacity .3s,transform .4s}
.pl-faq-item.is-open .pl-faq-a p{opacity:1;transform:none}

/* ⑬ 마무리 띠 */
.pl-cta{position:relative;overflow:hidden;margin:72px 20px 0;border-radius:26px;padding:30px 24px 26px;background:var(--pl-grad);color:#fff;isolation:isolate}
.pl-cta::before{content:"";position:absolute;z-index:-1;width:240px;height:240px;right:-80px;bottom:-110px;border-radius:50%;background:rgba(170,215,255,.6);filter:blur(34px);animation:plDrift 14s ease-in-out infinite}
.pl-cta::after{content:"";position:absolute;z-index:-1;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.22),rgba(255,255,255,0));transform:translateX(0) skewX(-18deg);animation:plSweep 5.5s ease-in-out infinite}
@keyframes plSweep{0%,55%{transform:translateX(0) skewX(-18deg)}100%{transform:translateX(475%) skewX(-18deg)}}
.pl-cta img{height:15px;width:auto;filter:brightness(0) invert(1);opacity:.9}
.pl-cta h2{margin:16px 0 0;font-size:23px;line-height:1.42;font-weight:700;letter-spacing:-.6px;word-break:keep-all;overflow-wrap:break-word}
.pl-cta p{margin:8px 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,.84);letter-spacing:-.2px;word-break:keep-all}
.pl-source{margin:18px 20px 0;font-size:13px;line-height:1.55;color:var(--pl-gray);letter-spacing:-.2px;text-align:center;word-break:keep-all}

/* 화면 밖이면 끝없는 애니메이션을 멈춘다(useLandingMotion 이 화면 근처에서만 data-on) */
.pl.is-armed [data-anim]:not([data-on]),.pl.is-armed [data-anim]:not([data-on]) *,.pl.is-armed [data-anim]:not([data-on])::before,.pl.is-armed [data-anim]:not([data-on])::after,
.pl.is-armed [data-anim]:not([data-on]) *::before,.pl.is-armed [data-anim]:not([data-on]) *::after{animation-play-state:paused!important}

@media (prefers-reduced-motion:reduce){
  .pl.is-armed [data-rv]{opacity:1;transform:none;transition:none}
  .pl-float,.pl-float>span,.pl-blue::before,.pl-blue::after,.pl-pin i::after,
  .pl-msheet .send,.pl-msheet .send::after,.pl-noti>div,.pl-mq-track,.pl-cta::before,.pl-cta::after,.pl-caret{animation:none!important}
  .pl-float,.pl-band-art{transform:none}
  .pl-msheet .send::after{display:none}
}
`;
