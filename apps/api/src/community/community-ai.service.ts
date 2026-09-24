import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

// 글쓰기 중 "AI 추천 태그" — 본문을 읽고 소분류 1개 + 그 대분류 태그 0~3개를 고른다.
// 고르는 값은 반드시 기존 목록(카테고리·태그) 안에서만: 태그가 무한히 늘어나 필터 칩이 지저분해지지 않게.
// 키가 없거나 AI 가 실패/엉뚱한 값을 주면 키워드 규칙으로 폴백한다(글쓰기는 절대 막지 않는다).

export interface SuggestMajor {
  id: string;
  name: string;
  tags: { id: string; name: string }[];
  subs: { id: string; name: string; slug: string }[];
}

export interface SuggestResult {
  subSlug: string | null;
  tagNames: string[];
  source: 'ai' | 'rule';
}

// 소분류 키워드(규칙 폴백용). 없으면 태그 매칭만으로 대분류를 추정한다.
const SUB_KEYWORDS: Record<string, string[]> = {
  'prep-forum': ['결혼준비', '결혼 준비', '웨딩', '예식', '본식', '사회자', '스드메', '예식장', '웨딩홀', '상견례', '청첩장', '혼수', '예물'],
  resources: ['자료', '양식', '체크리스트', '엑셀', '템플릿'],
  choice: ['골라', '고르', '선택', '뭐가 나', '어떤 게', '추천해'],
  honeymoon: ['허니문', '신혼여행', '몰디브', '발리', '하와이', '칸쿤'],
  inlaws: ['시댁', '처가', '시어머니', '시아버지', '장모', '장인', '시누'],
  newlywed: ['신혼', '신혼집', '집들이', '살림', '인테리어'],
  diary: ['일기', '기록', '오늘 하루'],
  conflict: ['싸웠', '싸움', '갈등', '다퉜', '서운'],
  brag: ['자랑', '최고의 남편', '최고의 아내'],
  parenting: ['임신', '출산', '육아', '아기', '태교', '산후', '임산부'],
  diet: ['다이어트', '살 빼', '체중', '식단', '운동'],
  free: [],
  'curious-qna': ['궁금', '질문', '어떻게 해', '아시는 분'],
  comfort: ['힘들', '우울', '지쳐', '위로', '속상'],
  others: ['남들은', '다들 어떻게', '보통 어떻게'],
  'why-marry': ['결혼하는 이유', '결혼한 이유', '왜 결혼'],
  faq: ['자주 묻는', 'FAQ'],
  recipe: ['요리', '레시피', '반찬', '밀프렙'],
  datefood: ['맛집', '데이트', '카페', '레스토랑'],
  beauty: ['피부', '시술', '미용', '관리', '보톡스', '헤어'],
  legal: ['법', '부동산', '전세', '월세', '대출', '계약', '등기', '세금'],
  blogger: ['블로그', '블로거', '포스팅'],
  market: ['팔아요', '판매', '중고', '양도', '팝니다'],
  share: ['나눔', '무료로 드', '드려요'],
  buy: ['삽니다', '구해요', '구매', '구합니다'],
};

// 태그 동의어(규칙 폴백용).
const TAG_SYNONYMS: Record<string, string[]> = {
  스드메: ['스드메', '스튜디오', '드레스', '메이크업'],
  예식장: ['예식장', '웨딩홀', '식장', '홀 투어', '홀투어'],
  상견례: ['상견례'],
  청첩장: ['청첩장', '모바일 청첩'],
  예산: ['예산', '비용', '견적', '가격', '얼마'],
  혼수: ['혼수', '가전', '가구'],
  사회자: ['사회자', 'MC', '엠씨', '아나운서', '축사'],
  본식: ['본식', '예식 당일', '식순', '리허설'],
  예물: ['예물', '반지', '시계', '예단'],
  허니문: ['허니문', '신혼여행'],
  맞벌이: ['맞벌이'],
  재테크: ['재테크', '저축', '적금', '투자', '가계부'],
  뷰티: ['뷰티', '피부', '시술', '다이어트'],
  부동산: ['부동산', '청약', '전세', '대출'],
  신혼집: ['신혼집', '전세', '매매', '이사'],
  인테리어: ['인테리어', '가구 배치', '셀프 인테리어'],
  집들이: ['집들이'],
  부부: ['부부', '남편', '아내', '신랑', '신부'],
  살림: ['살림', '청소', '빨래', '정리'],
  임신: ['임신', '임산부', '입덧'],
  출산: ['출산', '분만'],
  육아: ['육아', '아기', '아이'],
  태교: ['태교'],
  산후조리: ['산후조리', '조리원'],
  수다: ['수다', '잡담'],
  고민: ['고민', '어떡하', '어떻게 하'],
  질문: ['질문', '궁금', '?'],
  위로: ['위로', '힘들', '속상'],
  공감: ['공감', '저만', '나만'],
  꿀팁: ['꿀팁', '팁', '노하우'],
  후기: ['후기', '다녀왔', '해봤'],
  추천: ['추천'],
  맛집: ['맛집'],
  정보: ['정보', '공유'],
  판매: ['판매', '팔아요', '팝니다', '양도'],
  나눔: ['나눔', '무료'],
  삽니다: ['삽니다', '구해요', '구매'],
  웨딩용품: ['웨딩용품', '부케', '베일', '웨딩슈즈'],
  직거래: ['직거래'],
};

@Injectable()
export class CommunityAiService {
  private readonly logger = new Logger(CommunityAiService.name);
  private readonly client: GoogleGenerativeAI | null;

  constructor() {
    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_AI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    this.client = key ? new GoogleGenerativeAI(key) : null;
  }

  async suggest(content: string, majors: SuggestMajor[], lockedSubSlug?: string | null): Promise<SuggestResult> {
    const text = content.trim().slice(0, 1500);
    if (!text) return { subSlug: lockedSubSlug ?? null, tagNames: [], source: 'rule' };
    const ai = await this.suggestWithAi(text, majors, lockedSubSlug).catch((e) => {
      this.logger.warn(`community suggest AI failed: ${String(e?.message || e).slice(0, 140)}`);
      return null;
    });
    return ai ?? this.suggestWithRules(text, majors, lockedSubSlug);
  }

  private majorOfSub(majors: SuggestMajor[], slug: string | null | undefined) {
    if (!slug) return null;
    return majors.find((m) => m.subs.some((s) => s.slug === slug)) ?? null;
  }

  private async suggestWithAi(
    text: string,
    majors: SuggestMajor[],
    lockedSubSlug?: string | null,
  ): Promise<SuggestResult | null> {
    if (!this.client) return null;
    const lockedMajor = this.majorOfSub(majors, lockedSubSlug);
    const catalog = majors
      .map(
        (m) =>
          `- 대분류 "${m.name}" (태그 후보: ${m.tags.map((t) => t.name).join(', ') || '없음'})\n` +
          m.subs.map((s) => `  - ${s.slug}: ${s.name}`).join('\n'),
      )
      .join('\n');
    const prompt = `너는 결혼·신혼 커뮤니티 "프리티풀"의 글 분류기다.
아래 [글]을 읽고 JSON 으로만 답하라.
1) "sub": 글에 가장 알맞은 소분류 slug 하나를 [목록]에서 고른다.${
      lockedSubSlug ? ` 단, 작성자가 이미 "${lockedSubSlug}" 를 골랐으니 그대로 둔다.` : ''
    } 애매하면 자유게시판(free).
2) "tags": 그 소분류가 속한 대분류의 "태그 후보" 중 글과 분명히 관련된 것만 0~3개. 후보에 없는 말은 절대 만들지 않는다.

[목록]
${catalog}

[글]
${text}

형식: {"sub":"slug","tags":["태그", "..."]}`;

    // 2.5-flash-lite 는 신규 사용자 차단(404), *-latest(3.x)는 thinkingBudget 을 받으면 400 → 모델별로 설정을 나눈다.
    // 어떤 이유로든 실패하면 다음 모델로 넘어가고, 전체가 실패하면 규칙 폴백(글쓰기 흐름은 막지 않는다).
    const models = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'].filter(
      Boolean,
    ) as string[];
    const deadline = Date.now() + 9000;
    for (const name of Array.from(new Set(models))) {
      const left = deadline - Date.now();
      if (left < 800) break;
      try {
        const model = this.client.getGenerativeModel({
          model: name,
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            ...(/2\.5/.test(name) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          } as any,
        });
        const res = (await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), Math.min(6000, left))),
        ])) as any;
        const parsed = JSON.parse(String(res.response.text() || '{}'));
        const subSlug = lockedSubSlug || String(parsed?.sub || '');
        const major = this.majorOfSub(majors, subSlug);
        if (!major) continue; // 목록 밖 slug → 다음 모델/규칙으로
        const allowed = new Set((lockedMajor ?? major).tags.map((t) => t.name));
        const tagNames = Array.from(
          new Set((Array.isArray(parsed?.tags) ? parsed.tags : []).map((t: unknown) => String(t).replace(/^#/, '').trim())),
        )
          .filter((t) => allowed.has(t as string))
          .slice(0, 3) as string[];
        return { subSlug, tagNames, source: 'ai' };
      } catch (e: any) {
        this.logger.warn(`community suggest ${name} failed: ${String(e?.message || e).slice(0, 300)}`);
      }
    }
    return null;
  }

  private suggestWithRules(text: string, majors: SuggestMajor[], lockedSubSlug?: string | null): SuggestResult {
    const lower = text.toLowerCase();
    const hits = (words: string[]) => words.reduce((n, w) => (w && lower.includes(w.toLowerCase()) ? n + 1 : n), 0);

    let subSlug = lockedSubSlug ?? null;
    if (!subSlug) {
      let best = { slug: '', score: 0 };
      for (const m of majors) {
        for (const s of m.subs) {
          const score = hits(SUB_KEYWORDS[s.slug] ?? []) * 2 + hits(m.tags.flatMap((t) => TAG_SYNONYMS[t.name] ?? [t.name]));
          if (score > best.score) best = { slug: s.slug, score };
        }
      }
      subSlug = best.score > 0 ? best.slug : majors.some((m) => m.subs.some((s) => s.slug === 'free')) ? 'free' : null;
    }
    const major = this.majorOfSub(majors, subSlug);
    const tagNames = (major?.tags ?? [])
      .map((t) => ({ name: t.name, score: hits(TAG_SYNONYMS[t.name] ?? [t.name]) }))
      .filter((t) => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((t) => t.name);
    return { subSlug, tagNames, source: 'rule' };
  }
}
