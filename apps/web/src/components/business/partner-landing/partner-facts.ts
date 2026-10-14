// 웨딩 파트너 상세 랜딩(261014 사장 '첨부한 사진처럼 똑같이, 인터렉션들도 · 히어로는 그대로') — 화면에 쓰는 글자를 업체 데이터로만 만든다.
//  · 업체에는 리뷰가 없다(BusinessProfile 에 리뷰 관계 없음). 그래서 'AI 분석' 동그라미의 칩·요약 문장은
//    업체 정보(분야 · 지역 · 태그 · 제휴 홀 정보)에서 뽑는다 — 데이터에 없는 말(할인 · 혜택 · 만족도)은 만들지 않는다.
//  · 칸마다 데이터가 없으면 그 줄·카드·질문을 뺀다(사진 1장 · 소개 없음인 카카오 등록 업체도 빈칸 없이).
import {
  formatCapacity,
  formatFlower,
  formatGuarantee,
  formatParking,
  formatRental,
  formatStyle,
  type HallDetail,
  type HallInfo,
} from '@/lib/business-hall-info';

/** 마지막 글자에 받침이 있나 — 한글은 종성, 숫자는 읽는 소리(영·일·삼·육·칠·팔), 영문은 l·m·n·ng 끝만 받침으로 본다.
 *  끝에 붙은 괄호 설명('아모리스 역삼점(GS타워)')은 떼고 앞말로 판단한다 — 같은 화면에서 '역삼점은'과 '…(GS타워)는'이 섞이지 않게 */
function hasBatchim(word: string): boolean {
  let s = word.trim();
  for (let i = 0; i < 3 && /[)\]]$/.test(s); i++) {
    const t = s.replace(/\s*[(\[][^()[\]]*[)\]]$/, '').trim();
    if (!t || t === s) break;
    s = t;
  }
  s = s.replace(/[\s」』"'.,!?·…]+$/g, '');
  const ch = s.charAt(s.length - 1);
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[013678]/.test(ch)) return true;
  if (/[lmn]/i.test(ch) || /ng$/i.test(s)) return true;
  return false;
}

/** 조사 붙이기 — josa('빌라드지디', '은는') → '빌라드지디는' */
export function josa(word: string, pair: '은는' | '이가' | '을를' | '과와' | '이에요예요'): string {
  const b = hasBatchim(word);
  switch (pair) {
    case '은는': return `${word}${b ? '은' : '는'}`;
    case '이가': return `${word}${b ? '이' : '가'}`;
    case '을를': return `${word}${b ? '을' : '를'}`;
    case '과와': return `${word}${b ? '과' : '와'}`;
    case '이에요예요': return `${word}${b ? '이에요' : '예요'}`;
  }
}

/** '서울특별시 송파구 …' → '서울 송파구'(시·도 이름은 줄여 부른다) */
const SIDO: Record<string, string> = {
  서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
  세종특별자치시: '세종', 경기도: '경기', 강원도: '강원', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전라북도: '전북',
  전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주',
};
export function shortRegion(address?: string | null) {
  const parts = String(address || '').trim().split(/\s+/).filter(Boolean);
  if (!parts[0]) return '';
  if (SIDO[parts[0]]) parts[0] = SIDO[parts[0]];
  // 둘째 낱말은 시·군·구일 때만('서울 서울 강남구' · '부산 광역시' 같은 잘못 적힌 주소는 첫 낱말만)
  const second = parts[1] || '';
  if (second && second !== parts[0] && /[시군구]$/.test(second) && !/(광역시|특별시)$/.test(second)) return `${parts[0]} ${second}`;
  return parts[0];
}

/** 문장에 넣을 업체 명사 — 분야 이름(상품 카테고리)을 그대로 쓰면 '드레스예요' · '보석이에요'가 된다 */
const KIND: Record<string, string> = {
  웨딩홀: '웨딩홀', 스튜디오: '스튜디오', 드레스: '드레스샵', 피부과: '피부과', 헤어: '헤어샵', 메이크업: '메이크업샵', 가전: '가전 매장',
  스냅: '스냅 업체', DVD: '영상 업체', 한복: '한복집', 성형외과: '성형외과', 보석: '예물샵', 답례품: '답례품 업체', 자동차: '웨딩카 업체',
  신혼여행: '여행사', 가구: '가구점',
};
function kindOf(category: string, categoryNames: string[], businessType?: string | null): string {
  if (/예복|턱시도|테일러|양복/.test(String(businessType || ''))) return '예복샵';
  if (categoryNames.includes('헤어') && categoryNames.includes('메이크업')) return '헤어·메이크업샵';
  return KIND[category] || '웨딩 파트너';
}

/** 'AI 분석' 칩·흐르는 키워드에 올리지 않는 말 — 주관적 평가(이름 규칙이 붙이는 말)와 목록용 '인기' */
export const SUBJECTIVE_TAGS = new Set(['접근성좋은', '프리미엄홀', '경건한예식', '프리미엄케어', '대형예식', '인기']);
/** 웨딩홀이 아닌 업체에는 붙이지 않는 홀 계열 태그(이름에 '하우스' · '파크'가 든 스튜디오 · 드레스샵 오탐) */
const HALL_RULE_TAGS = new Set(['호텔웨딩', '컨벤션홀', '채플웨딩', '야외예식', '하우스웨딩']);

const toNum = (s: string) => Number(s.replace(/,/g, ''));

/** 식대 글 → { price, label } — '양식 코스 A 150,000원 ~ 185,000원' 은 범위째로, '0원 ~ 250,000원' 은 '~250,000원', '0원' 뿐이면 가격 없음 */
function priceOf(text?: string): { price: string; label: string } {
  const t = tidy(text);
  const range = t.match(/([\d,]+)\s*원?\s*~\s*([\d,]+)\s*원/);
  let price = '';
  let rest = t;
  if (range) {
    const lo = toNum(range[1]);
    const hi = toNum(range[2]);
    price = hi > 0 ? (lo > 0 ? `${range[1]}~${range[2]}원` : `~${range[2]}원`) : '';
    rest = t.replace(range[0], ' ');
  } else {
    const one = t.match(/([\d,]+)\s*원/);
    if (one) {
      price = toNum(one[1]) > 0 ? `${one[1]}원` : '';
      rest = t.replace(one[0], ' ');
    }
  }
  // 뒤에 붙은 '/ 소인 …' · '※ …' 꼬리는 라벨에서 뗀다
  const label = tidy(rest.replace(/\s*[/※].*$/, ''));
  return { price, label };
}

/** '130,000원' → '13만원' · '75,500원' → '7.5만원'(반올림 아닌 내림) · '77,000~132,000원' → '7.7~13.2만원' · '~250,000원' → '~25만원' */
function shortWon(price?: string): string {
  const t = String(price || '').replace(/\s+/g, '');
  const nums = (t.match(/\d[\d,]*/g) || []).map(toNum).filter((n) => Number.isFinite(n));
  const man = (n: number) => String(Math.floor(n / 1000) / 10).replace(/\.0$/, '');
  if (nums.length >= 2 && nums[1] > 0) {
    if (nums[0] <= 0) return nums[1] >= 10000 ? `~${man(nums[1])}만원` : '';
    return nums[0] >= 10000 ? `${man(nums[0])}~${man(nums[1])}만원` : '';
  }
  const n = nums[0];
  if (!n || n <= 0) return '';
  if (t.startsWith('~')) return n >= 10000 ? `~${man(n)}만원` : '';
  return n >= 10000 ? `${man(n)}만원` : `${n.toLocaleString('ko-KR')}원`;
}

/** 주차 — 숫자만이면 '대'를 붙이고, 깨진 '(0원 / 분)' 은 버리고, 0대는 빈 값 */
function cleanParking(raw?: string): string {
  const v = tidy(raw).replace(/\(\s*0원\s*\/\s*분\s*\)/g, '').trim();
  if (/^\d[\d,]*\s*대?$/.test(v)) {
    const n = toNum(v.replace(/대$/, '').trim());
    return n > 0 ? `${n.toLocaleString('ko-KR')}대` : '';
  }
  return formatParking(v);
}

/** '최소 보증 인원 300명, 최대 수용 인원 550명' → { min: 300, max: 550 } */
function guaranteeNumbers(s?: string) {
  const t = String(s || '');
  const min = t.match(/최소[^\d]*(\d[\d,]*)\s*명/)?.[1];
  const max = t.match(/최대[^\d]*(\d[\d,]*)\s*명/)?.[1];
  return { min: min ? Number(min.replace(/,/g, '')) : 0, max: max ? Number(max.replace(/,/g, '')) : 0 };
}

/** 홀 예식 방식 '웨딩홀 분리/90분' → '분리예식 · 90분' */
function shortStyle(style?: string): string {
  const m = String(style || '').match(/((?:동시|분리)(?:,\s*(?:동시|분리))?)\/(\d+)분/);
  return m ? `${m[1].replace(/,\s*/, '·')}예식 · ${m[2]}분` : '';
}

export type PartnerFact = { key: string; label: string; value: string };

export type PartnerHall = {
  name: string;
  /** 가져오기 때 넣은 자리표시 이름('홀 2')이 아닌 진짜 이름인가 */
  named: boolean;
  floor: string;
  price: string;
  priceLabel: string;
  rows: Array<{ label: string; value: string }>;
  images: string[];
};

export type PartnerFaq = { q: string; a: string };

export type PartnerFacts = {
  name: string;
  category: string;
  /** 문장에 넣는 업체 명사(드레스 → 드레스샵) */
  kind: string;
  isHall: boolean;
  region: string;
  /** 지도로 찾을 수 있는 주소인가 — 아니면 '서울/경기' 같은 활동 지역 */
  hasPlace: boolean;
  address: string;
  photoCount: number;
  facts: PartnerFact[];
  keypoints: string[];
  halls: PartnerHall[];
  sections: Array<{ title: string; text: string }>;
  /** 'AI 분석' 동그라미 칩(앞 넷 = 체크 칩, 다음 넷 = 회색 칩) */
  keywords: string[];
  /** 'AI 분석' 요약 문장 */
  summary: string;
  marquee: string[];
  faqs: PartnerFaq[];
  source: string;
  priceNote: string;
};

const tidy = (s?: string) => String(s || '').replace(/\s+/g, ' ').trim();

export function buildPartnerFacts(input: {
  name: string;
  category: string;
  categoryNames: string[];
  businessType?: string | null;
  address: string;
  hasPlace: boolean;
  tags: string[];
  /** 이름으로만 뽑은 규칙 태그(lib/business-tags) */
  extraTags: string[];
  images: string[];
  hallInfo: HallInfo | null;
}): PartnerFacts {
  const { name, category, categoryNames, businessType, address, images, hallInfo } = input;
  const region = shortRegion(address);
  const hasPlace = input.hasPlace && !!address;
  const info = hallInfo || ({ v: 1 } as HallInfo);
  const isHall = categoryNames.includes('웨딩홀') || (info.halls || []).length > 0;
  const kind = kindOf(category, categoryNames, businessType);
  const meal = priceOf(info.mealPrice);
  // 식대 값 — 숫자가 있으면 다듬은 가격(범위 · 0원 처리), 숫자 없는 글이면 그대로
  const mealPrice = meal.price ? (meal.label ? `${meal.label} ${meal.price}` : meal.price) : /\d/.test(tidy(info.mealPrice)) ? '' : tidy(info.mealPrice);
  const guarantee = formatGuarantee(info.guarantee);
  const parking = cleanParking(info.parking);
  const objective = (list: string[]) => list
    .map((t) => tidy(t).replace(/^#+/, ''))
    .filter((t) => t && !SUBJECTIVE_TAGS.has(t))
    // 식대 값이 있으면 '식대 10만원이상' 같은 태그는 칩끼리 어긋나므로 뺀다
    .filter((t) => !(mealPrice && /^식대/.test(t)));
  const tags = objective(input.tags);
  const extraTags = objective(input.extraTags).filter((t) => isHall || !HALL_RULE_TAGS.has(t));
  const keypoints = (info.keypoints || []).map(tidy).filter(Boolean);
  const extraRows = (info.rows || []).filter((r) => r && tidy(r.label) && tidy(r.value)).map((r) => ({ label: tidy(r.label), value: tidy(r.value) }));
  const sections = (info.sections || []).filter((x) => x && tidy(x.title) && String(x.text || '').trim()).map((x) => ({ title: tidy(x.title), text: String(x.text).trim() }));

  const halls: PartnerHall[] = (info.halls || [])
    .filter((h): h is HallDetail => !!h && !!(h.name || h.meal || h.capacity))
    .map((h, i) => {
      const hp = priceOf(h.meal);
      const rawName = tidy(h.name);
      return {
        name: rawName || `홀 ${i + 1}`,
        named: !!rawName && !/^홀\s*\d+$/.test(rawName),
        floor: tidy(h.floor),
        price: hp.price || (/\d/.test(tidy(h.meal)) ? '' : tidy(h.meal)),
        priceLabel: hp.price ? hp.label || '식대' : '식대',
        rows: [
          { label: '예식', value: formatStyle(h.style) },
          { label: '수용 인원', value: formatCapacity(h.capacity) },
          { label: '대관료', value: formatRental(h.rental) },
          { label: '꽃장식', value: formatFlower(h.flower) },
          { label: '주류', value: tidy(h.drink) },
        ]
          // '대관료 대관료 13,000,000원' — 값이 이름으로 시작하면 이름을 뗀다
          .map((r) => ({ label: r.label, value: r.value.startsWith(r.label) ? r.value.slice(r.label.length).trim() : r.value }))
          .filter((r) => r.value),
        images: (h.images || []).filter((src) => images.includes(src)),
      };
    });

  const facts: PartnerFact[] = [
    { key: 'category', label: '분야', value: kind === '예복샵' ? '예복' : categoryNames.join(' · ') || category },
    ...(region ? [{ key: 'region', label: hasPlace ? '지역' : '활동 지역', value: region }] : []),
    ...(mealPrice ? [{ key: 'meal', label: '식대', value: mealPrice }] : []),
    ...(tidy(info.menu) ? [{ key: 'menu', label: '메뉴', value: tidy(info.menu) }] : []),
    ...(tidy(info.hallType) ? [{ key: 'hallType', label: '홀 타입', value: tidy(info.hallType) }] : []),
    ...(guarantee ? [{ key: 'guarantee', label: '보증 인원', value: guarantee }] : []),
    ...(halls.length ? [{ key: 'halls', label: '홀', value: `${halls.length}개 홀` }] : []),
    ...(parking ? [{ key: 'parking', label: '주차', value: parking }] : []),
    ...extraRows.map((r, i) => ({ key: `row-${i}`, label: r.label, value: r.value })),
  ];

  /* 'AI 분석' 칩 — 숫자로 말하는 것(식대 · 인원 · 홀 · 예식 방식) 먼저, 그다음 태그 · 지역. 칩 자리라 12자 넘는 말은 뺀다 */
  const g = guaranteeNumbers(info.guarantee);
  const firstStyle = (info.halls || []).map((h) => shortStyle(h?.style)).find(Boolean) || '';
  const numeric = [
    shortWon(meal.price) ? `식대 ${shortWon(meal.price)}` : '',
    g.max ? `최대 ${g.max.toLocaleString('ko-KR')}명` : g.min ? `보증 ${g.min.toLocaleString('ko-KR')}명` : '',
    halls.length > 1 ? `홀 ${halls.length}개` : '',
    firstStyle,
    tidy(info.menu) && tidy(info.menu).length <= 8 ? tidy(info.menu) : '',
  ];
  const regionWord = region.split(' ').pop() || '';
  const keywordPool = [...numeric, ...tags, ...extraTags, kind === '예복샵' ? '예복' : category, hasPlace && regionWord && regionWord !== category ? regionWord : '', images.length >= 5 ? `사진 ${images.length}장` : ''];
  const keywords: string[] = [];
  for (const k of keywordPool) {
    const t = tidy(k).replace(/^#+/, '');
    // '분리예식' 과 '분리예식 · 90분' 처럼 한쪽이 다른 쪽을 품으면 앞의 것(숫자 있는 쪽)만
    if (!t || t.length > 12 || keywords.some((k2) => k2.includes(t) || t.includes(k2))) continue;
    keywords.push(t);
    if (keywords.length >= 8) break;
  }

  /* 요약 — 데이터에서 나온 사실 문장만(업체 자기소개는 히어로에 이미 있어 되풀이하지 않는다) */
  const named = halls.filter((h) => h.named);
  const hallList = (max: number) => {
    const shown = named.slice(0, max).map((h) => h.name);
    const rest = halls.length - shown.length;
    return shown.length ? `${shown.join(' · ')}${rest > 0 ? ` 외 ${rest}곳` : ''}` : '';
  };
  const parts: string[] = [];
  parts.push(`${josa(name, '은는')} ${region ? `${region}${hasPlace ? '에 있는' : '에서 활동하는'} ` : ''}${josa(kind, '이에요예요')}.`);
  if (mealPrice || guarantee) {
    const bits = [mealPrice ? `식대는 ${tidy(info.menu) ? `${tidy(info.menu)} ` : ''}${mealPrice}` : '', guarantee ? `보증 인원은 ${guarantee}` : ''].filter(Boolean);
    parts.push(`${josa(bits.join(', '), '이에요예요')}.`);
  }
  if (halls.length === 1) {
    const h = halls[0];
    parts.push(h.named ? (/단독/.test(h.name) ? '단독홀로 예식해요.' : `홀은 ${h.name}${h.floor ? `(${h.floor})` : ''} 한 곳이에요.`) : '홀은 한 곳이에요.');
  } else if (halls.length > 1) {
    const list = hallList(3);
    parts.push(list ? `홀은 ${list} 중에서 고를 수 있어요.` : `홀 ${halls.length}곳 중에서 고를 수 있어요.`);
  }
  if (parts.length < 3 && images.length > 1) parts.push(`사진 ${images.length}장으로 먼저 둘러볼 수 있어요.`);
  const summary = parts.join(' ');

  const marquee = Array.from(new Set([...tags, ...extraTags, ...keywords].map((t) => tidy(t).replace(/^#+/, '')).filter((t) => t && t.length <= 14)));

  const priceNote = halls.length > 0 || mealPrice ? '웨딩홀 사정에 따라 메뉴와 가격이 바뀔 수 있어요' : '업체 사정에 따라 상품 구성과 가격이 바뀔 수 있어요';
  const menu = tidy(info.menu);
  const faqs: PartnerFaq[] = [
    ...(mealPrice ? [{ q: '식대는 얼마인가요?', a: `${menu && !mealPrice.includes(menu) ? `${menu} ` : ''}${mealPrice} 기준이에요. ${priceNote}.` }] : []),
    ...(guarantee ? [{ q: '보증 인원은 몇 명인가요?', a: `${josa(guarantee, '이에요예요')}.${halls.length > 1 ? ' 홀마다 수용 인원이 달라 홀 안내에서 홀별로 확인할 수 있어요.' : ''}` }] : []),
    ...(halls.length > 1 ? [{ q: '홀은 몇 개인가요?', a: `${halls.length}개 홀이 있어요${named.length ? ` — ${named.map((h) => (h.floor ? `${h.name}(${h.floor})` : h.name)).join(', ')}${halls.length > named.length ? ` 외 ${halls.length - named.length}곳` : ''}` : ''}.` }] : []),
    ...(parking ? [{ q: '주차할 수 있나요?', a: `주차는 ${parking} 기준으로 안내돼 있어요.` }] : []),
    ...(hasPlace
      ? [{ q: '어디에 있나요?', a: `${address}에 있어요. 위쪽 바로가기의 길찾기나 오시는 길의 네이버 지도로 찾아갈 수 있어요.` }]
      : region ? [{ q: '활동 지역은 어디인가요?', a: `${region}에서 활동해요. 정확한 위치나 방문 가능 여부는 문의하기로 물어봐 주세요.` }] : []),
    { q: '문의하면 어떻게 진행되나요?', a: '문의하기에서 이름·연락처와 궁금한 점을 남겨 주시면, 프리티풀 매니저가 업체와 함께 확인하고 남겨 주신 연락처로 안내드려요.' },
    { q: '방문 상담도 할 수 있나요?', a: '문의하기에서 ‘방문 상담’을 고르고 희망 시기를 남겨 주세요. 프리티풀 매니저가 업체와 일정을 확인해 연락드려요.' },
    { q: '남긴 정보는 누가 보나요?', a: '문의 안내를 위해 이름·연락처를 프리티풀과 해당 업체가 확인해요.' },
  ];

  return {
    name,
    category,
    kind,
    isHall,
    region,
    hasPlace,
    address,
    photoCount: images.length,
    facts,
    keypoints,
    halls,
    sections,
    keywords,
    summary,
    marquee,
    faqs,
    source: tidy(info.source),
    priceNote,
  };
}
