import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { BIZ_NEWS, BIZ_NEWS_MILESTONES } from './news';

const requestedIds = [
  'reception-2025', 'freetiful-show-hongdae-2026', 'freetiful-show-suseo-2026',
  'freetiful-show-anyang-2026', 'chouchoumonde-wedding-listening-2026',
  'bexco-busan-2026', 'wedding-showcase-pangyo-2026',
  'seed', 'venture', 'villadegd', 'chouchoumonde-partnership',
  'villadmont-partnership', 'thebom-partnership',
];
const article = (id: string) => {
  const item = BIZ_NEWS.find((entry) => entry.id === id);
  assert.ok(item, `Missing article: ${id}`);
  return item;
};

test('all 13 requested stories have individual, localized, sourced content', () => {
  assert.equal(new Set(requestedIds).size, 13);
  for (const id of requestedIds) {
    const item = article(id);
    assert.equal(BIZ_NEWS.filter((entry) => entry.id === id).length, 1);
    assert.ok(item.points && item.points.length >= 3);
    for (const lang of ['ko', 'en', 'ja', 'zh'] as const) {
      assert.ok(item.title[lang] && item.lead[lang] && item.body?.[lang]);
      assert.ok(item.sourceNote?.[lang]);
      assert.ok(item.points.every((point) => point[lang]));
    }
  }
});

test('the feed and milestone timeline retain unique IDs and chronological order', () => {
  assert.equal(new Set(BIZ_NEWS.map((entry) => entry.id)).size, BIZ_NEWS.length);
  assert.deepEqual(BIZ_NEWS.map((entry) => entry.date), BIZ_NEWS.map((entry) => entry.date).sort().reverse());
  assert.deepEqual(BIZ_NEWS_MILESTONES.map((entry) => entry.date), BIZ_NEWS_MILESTONES.map((entry) => entry.date).sort());
  for (const id of ['kodit', 'partners-300', 'launch', 'founded']) assert.ok(article(id));
});

test('business news excludes system updates from the feed and article deep links', () => {
  const excludedIds = [
    'quick-match', 'wedding-forest', 'wedding-partners', 'safe-pay',
    'corporate-mc', 'grand-open', 'company-i18n', 'biz-open',
  ];
  for (const id of excludedIds) {
    assert.equal(BIZ_NEWS.find((entry) => entry.id === id), undefined);
    assert.equal(BIZ_NEWS_MILESTONES.find((entry) => entry.id === id), undefined);
  }
  assert.equal(BIZ_NEWS.length, requestedIds.length + 4);
});

test('event dates, weekdays and times match the supplied schedule', () => {
  const cases = [
    ['reception-2025', '2025.11.24', '월', '18:00~21:00'],
    ['freetiful-show-hongdae-2026', '2026.02.06', '금', '19:30~21:00'],
    ['freetiful-show-suseo-2026', '2026.03.28', '토', '19:00~21:00'],
    ['freetiful-show-anyang-2026', '2026.05.23', '토', '19:00~20:30'],
    ['chouchoumonde-wedding-listening-2026', '2026.08.16', '일', '13:00~15:00'],
    ['wedding-showcase-pangyo-2026', '2026.11.05', '목', '12:00~15:00'],
  ];
  for (const [id, date, weekday, time] of cases) {
    const item = article(id);
    assert.equal(item.date, date);
    const actualDay = new Date(`${date.replaceAll('.', '-')}T12:00:00+09:00`).getUTCDay();
    assert.equal('일월화수목금토'[actualDay], weekday);
    const facts = item.points!.map((point) => point.ko).join(' ');
    assert.ok(facts.includes(`(${weekday})`));
    assert.ok(facts.includes(time));
  }
  const bexco = article('bexco-busan-2026');
  assert.equal(bexco.date, '2026.09.16');
  assert.match(bexco.points![0].ko, /9월 16일\(수\).*9월 18일\(금\)/);
  assert.match(bexco.lead.ko, /총괄 운영 및 대행/);
});

test('the future showcase is a plan, and the Anyang show credits the organizer', () => {
  const showcase = article('wedding-showcase-pangyo-2026');
  assert.match(showcase.title.ko, /개최 예정/);
  assert.match(showcase.points!.map((point) => point.ko).join(' '), /초청 계획:.*120명/);
  assert.doesNotMatch(showcase.lead.ko, /성료|개최했습니다|참석했습니다/);
  const anyang = article('freetiful-show-anyang-2026');
  assert.match(anyang.lead.ko, /빌라드지디가 자체적으로 진행/);
  assert.match(anyang.lead.ko, /협업 파트너/);
});

test('partnership months and supplied masked names are preserved', () => {
  for (const [id, date, name] of [
    ['villadegd', '2026.06', '빌라드*디'],
    ['chouchoumonde-partnership', '2026.07', '슈슈*드웨딩'],
    ['villadmont-partnership', '2026.08', '빌*드몽'],
    ['thebom-partnership', '2026.10', '더*봄'],
  ]) {
    const item = article(id);
    assert.equal(item.date, date);
    assert.equal(item.tag, 'hall');
    assert.ok(item.title.ko.includes(name));
    assert.match(item.title.ko, /전속 사회자 파트너십/);
  }
  assert.equal(article('seed').date, '2026.02');
  assert.equal(article('venture').date, '2026.03');
});

test('related coverage distinguishes the July event from the August event', () => {
  const listening = article('chouchoumonde-wedding-listening-2026');
  const report = listening.sources?.find((source) => source.href.includes('kukminjob.com'));
  assert.ok(report);
  assert.match(report.note!.ko, /7월 27일/);
  assert.match(report.note!.ko, /8월 16일/);
  assert.doesNotMatch(listening.lead.ko + listening.body!.ko, /400명|50쌍|5:1/);
  assert.ok(article('reception-2025').sources?.some((source) => source.href === 'https://kcbpaper.kr/post/8Q5iIaAb'));
});

test('news assets exist locally and external references use HTTPS', () => {
  const publicDir = path.resolve(__dirname, '../../../public');
  for (const item of BIZ_NEWS) {
    assert.ok(existsSync(path.join(publicDir, item.image.src)), item.image.src);
    if (item.video) assert.ok(existsSync(path.join(publicDir, item.video)), item.video);
    if (item.image.src.includes('/notices/v2/')) assert.ok(item.image.caption);
    for (const source of item.sources || []) assert.equal(new URL(source.href).protocol, 'https:');
  }
});
