// 웨딩런 홈 배너 2장(261012 사장 '배너에 웨딩런 배너, 바로가기도') — 첫 진입 일러스트(원본 PNG 1870×841, freetiful-wedding-entry.zip)로
// 모바일 8:3(home-top-wedding-run-8x3.webp) · PC 4:3(pc-hero-wedding-run.webp)을 만든다. 제목·바로가기는 홈 배너가 웹 글자로 얹는다.
// 사용: node apps/web/scripts/wedding-run-banners.cjs <entry-illustration.png> apps/web apps/web/public/images/banners
const sharp = require(require.resolve('sharp', { paths: [process.argv[3]] }));
const SRC = process.argv[2];
const OUT = process.argv[4];
(async () => {
  const meta = await sharp(SRC).metadata(); // 1870×841
  // 모바일 8:3 — 가로 전부, 세로는 하늘 위쪽 100 · 발밑 아래쪽을 조금 잘라 701
  const h = Math.round(meta.width * 3 / 8);
  const top = Math.min(100, meta.height - h);
  await sharp(SRC).extract({ left: 0, top, width: meta.width, height: h }).resize(1200, 450).webp({ quality: 82, effort: 6 }).toFile(`${OUT}/home-top-wedding-run-8x3.webp`);
  // PC 4:3 — 일러스트를 1450 폭으로 키워 아래에 깔고, 위는 원본 하늘에서 잰 라벤더→분홍 그러데이션으로 하늘을 늘린다 → 경계는 190px 페이드
  // 일러스트를 1450 폭으로 키워 왼쪽 빈 하늘 250 을 잘라 낸다 — 신랑·신부가 더 크게 보이게
  const W = 1200, H = 900, SW = 1450, CUT = 250, IH = Math.round(meta.height * SW / meta.width), IY = H - IH;
  const ill = await sharp(SRC).resize(SW, IH).extract({ left: CUT, top: 0, width: W, height: IH }).png().toBuffer();
  // 하늘 = 일러스트 왼쪽 하늘 라벤더(#DCCFF6 근처) → 오른쪽 벚꽃 쪽 분홍 라벤더, 위로 갈수록 밝게(색은 원본에서 잰 값)
  const skySvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${IY + 200}"><defs>
    <linearGradient id="h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E2D7F8"/><stop offset="0.55" stop-color="#DCCDF4"/><stop offset="1" stop-color="#E8CFE2"/></linearGradient>
  </defs><rect width="100%" height="100%" fill="url(#h)"/></svg>`);
  const sky = await sharp(skySvg).png().toBuffer();
  // 위로 갈수록 살짝 밝게(흰 0.35 → 0)
  const lightSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${IY + 200}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  // 일러스트 위쪽 FADE(190px)를 투명 → 불투명으로
  const FADE = 190;
  const maskSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${IH}"><defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="${FADE / IH}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`);
  const mask = await sharp(maskSvg).extractChannel(3).toBuffer();
  const illFaded = await sharp(ill).ensureAlpha().joinChannel(mask, { raw: undefined }).png().toBuffer().catch(async () => {
    // joinChannel 이 알파를 하나 더 붙이므로 RGB 만 꺼내 붙인다
    const rgb = await sharp(ill).removeAlpha().toBuffer();
    return sharp(rgb).joinChannel(mask).png().toBuffer();
  });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#ece4f6' } })
    .composite([
      { input: sky, left: 0, top: 0 },
      { input: lightSvg, left: 0, top: 0 },
      { input: illFaded, left: 0, top: IY },
    ])
    .webp({ quality: 82, effort: 6 })
    .toFile(`${OUT}/pc-hero-wedding-run.webp`);
  for (const f of ['home-top-wedding-run-8x3.webp', 'pc-hero-wedding-run.webp']) {
    const m = await sharp(`${OUT}/${f}`).metadata();
    console.log(f, m.width + 'x' + m.height, m.channels, (require('fs').statSync(`${OUT}/${f}`).size / 1024 | 0) + 'KB');
  }
})().catch((e) => { console.error(e); process.exit(1); });
