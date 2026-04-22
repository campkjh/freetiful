import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';

export interface GenerateProfileInput {
  name?: string;
  category?: string;          // 사회자 / 쇼호스트 / 축가/연주
  careerYears?: number;
  selectedTags?: string[];    // 전문영역 태그
  languages?: string[];
  awards?: string;            // 자유 입력
  keywords?: string;          // 자유 입력 (톤/분위기 힌트)
  imageDataUrls?: string[];   // 최대 4장 base64 data URL
}

export interface GenerateProfileOutput {
  shortIntro: string;
  mainExperience: string;
  detailHtml: string;
  faqs: { question: string; answer: string }[];
  warnings?: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: GoogleGenerativeAI | null;

  constructor(private prisma: PrismaService) {
    // 이름 오타 방지: GEMINI_API_KEY / GEMINI_AI_KEY / GOOGLE_API_KEY 모두 인식
    const key =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_AI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (key) {
      this.client = new GoogleGenerativeAI(key);
      this.logger.log('Gemini AI service enabled');
    } else {
      this.client = null;
      this.logger.warn('GEMINI_API_KEY not set — AI features disabled');
    }
  }

  isEnabled() {
    return this.client !== null;
  }

  async generateProfile(input: GenerateProfileInput): Promise<GenerateProfileOutput> {
    if (!this.client) {
      throw new BadRequestException('AI 기능이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.');
    }

    // 모델 시도 순서 — 앞 모델이 503/429 나면 다음 모델로 폴백
    const modelNames = [
      process.env.GEMINI_MODEL,
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-flash-lite-latest',
    ].filter(Boolean) as string[];

    // 이미지 파트 구성 (Gemini vision 지원)
    const imageParts = (input.imageDataUrls || []).slice(0, 4).flatMap((url) => {
      const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (!match) return [];
      return [{
        inlineData: { mimeType: match[1], data: match[2] },
      }];
    });

    const tagsText = (input.selectedTags || []).join(', ') || '(미선택)';
    const languagesText = (input.languages || []).join(', ') || '(없음)';

    const prompt = `당신은 토스(Toss) 커머스 스타일 상세페이지 디자이너이자 카피라이터입니다.
아래 정보를 바탕으로 **토스 앱의 대회/상품 상세페이지처럼 여백이 넉넉하고 볼드한 헤딩 + 짧은 캡션 + 아이콘 리스트 행으로 이뤄진 HTML 콘텐츠**를 **한국어 존댓말**로 작성해주세요.

[입력 정보]
- 이름: ${input.name || '(미기재)'}
- 분류: ${input.category || '사회자'}
- 경력: ${input.careerYears ?? 0}년
- 전문 분야: ${tagsText}
- 구사 언어: ${languagesText}
- 수상/자격 이력 (자유 입력): ${input.awards || '(없음)'}
- 키워드/톤 힌트: ${input.keywords || '(없음)'}
- 사진 ${imageParts.length}장 첨부됨 (얼굴/분위기 참조용)

[출력 형식 — 반드시 JSON]
{
  "shortIntro": "50자 이내 한 줄 소개. 전문성과 매력을 함축.",
  "mainExperience": "핵심 경력 3~5줄. 구체적 기관/행사명이 있으면 활용, 없으면 경력 연차 기반으로 자연스럽게.",
  "detailHtml": "아래 [토스 스타일 HTML 템플릿] 을 그대로 따라 1,000~1,500자 HTML.",
  "faqs": [{ "question": "...", "answer": "..." }]
}

[디자인 원칙 — 토스 스타일]
- 전체적으로 **좌정렬**, 배경 흰색, 여백 넉넉 (섹션 간 padding 40~48px).
- 본문 텍스트: 기본 #4b5563, 강조 #111827, 포인트 컬러 #3180F7 (파랑).
- 섹션 헤딩은 **큰 bold** (26~30px), 위에 작은 gray 캡션("00 안내" 같은).
- 카드 남발 금지 — 전체는 평면. 필요한 곳에만 옅은 회색(#f9fafb) 박스 사용.
- 아이콘 리스트: 좌측 40x40 파랑 틴트 원형 배경에 이모지/✓, 우측에 제목(bold) + 값(우정렬) 2단 배치.

[토스 스타일 HTML 템플릿 — 이 순서로 작성]

1) 히어로 (카드 없이, 중앙 정렬):
<section style="text-align:center;padding:8px 0 32px;">
  <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">전문 사회자 소개</div>
  <h2 style="font-size:28px;font-weight:700;line-height:1.25;margin:0 0 8px;color:#111827;">[경력+분류 기반 핵심 캐치프레이즈]</h2>
  <p style="font-size:15px;color:#4b5563;margin:0;line-height:1.5;">[간단 2줄 요약]</p>
</section>

2) 전문 분야 섹션 (토스 "우승 조건" 스타일):
<section style="padding:32px 0;">
  <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">전문 분야</div>
  <h3 style="font-size:22px;font-weight:700;margin:0 0 4px;color:#3180F7;line-height:1.3;">[전문영역 요약 1줄]</h3>
  <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">[보조 설명 1줄 — 예: 결혼식, 기업행사, 쇼호스팅 등 N개 분야]</p>
  <ul style="list-style:none;padding:0;margin:0;">
    <li style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid #f3f4f6;">
      <span style="display:inline-flex;width:36px;height:36px;border-radius:10px;background:#eff6ff;color:#3180F7;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🎤</span>
      <span style="flex:1;font-size:15px;font-weight:700;color:#111827;">[항목 제목]<br/><span style="font-weight:400;color:#6b7280;font-size:13px;">[짧은 부연]</span></span>
      <span style="font-size:14px;font-weight:700;color:#111827;text-align:right;white-space:nowrap;">[우측 값 — 예: "13,000+건", "가능", "전국"]</span>
    </li>
    <!-- 항목 3~4개 -->
  </ul>
</section>

3) 제공 서비스 섹션 (토스 "대회 참여" 안내 스타일):
<section style="padding:32px 0;">
  <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">포함 서비스</div>
  <h3 style="font-size:22px;font-weight:700;margin:0 0 4px;color:#111827;line-height:1.3;">기본 진행에 포함돼요</h3>
  <p style="font-size:14px;color:#6b7280;margin:0 0 20px;">[보조 설명 1줄]</p>
  <ul style="list-style:none;padding:0;margin:0;">
    <li style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;font-size:15px;color:#374151;line-height:1.6;">
      <span style="color:#3180F7;font-weight:700;margin-top:2px;">✓</span>
      <span>[서비스 항목 — 구체적으로]</span>
    </li>
    <!-- 4~6개 항목 -->
  </ul>
</section>

4) 진행 프로세스 섹션 (토스 "대회 기간" 스타일):
<section style="padding:32px 0;">
  <div style="font-size:13px;color:#6b7280;margin-bottom:6px;">진행 프로세스</div>
  <h3 style="font-size:22px;font-weight:700;margin:0 0 20px;color:#3180F7;line-height:1.3;">문의부터 행사 당일까지</h3>
  <ol style="list-style:none;padding:0;margin:0;counter-reset:step;">
    <li style="display:flex;gap:14px;padding:12px 0;counter-increment:step;align-items:flex-start;">
      <span style="display:inline-flex;width:28px;height:28px;border-radius:50%;background:#3180F7;color:#fff;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">1</span>
      <div style="flex:1;"><p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 2px;">[단계 제목]</p><p style="font-size:13px;color:#6b7280;margin:0;line-height:1.5;">[단계 설명 1줄]</p></div>
    </li>
    <!-- 4단계: 상담 → 계약 → 준비 → 진행 -->
  </ol>
</section>

5) 유의사항 섹션 (토스 "취소될 수 있어요" 스타일):
<section style="padding:32px 0;">
  <h3 style="font-size:22px;font-weight:700;margin:0 0 16px;color:#111827;line-height:1.3;">예약 전 꼭 확인해주세요</h3>
  <ul style="list-style:none;padding:0;margin:0;">
    <li style="display:flex;gap:10px;padding:8px 0;font-size:14px;color:#4b5563;line-height:1.6;"><span style="color:#9ca3af;margin-top:8px;font-size:8px;">●</span><span>[유의사항 1 — 예약·취소 규정, 복장 등]</span></li>
    <!-- 3~4개 항목 -->
  </ul>
</section>

[제약]
- **토스 디자인 언어를 엄격히 따를 것**: 큰 bold 헤딩 + 작은 회색 캡션, 여백 넉넉, 평면 레이아웃, 포인트 컬러 #3180F7만.
- font-weight 400 / 700 두 단계만 사용. font-black(900) 금지.
- 모든 text 는 좌정렬 (히어로 섹션만 중앙 정렬).
- gradient 배경 금지 (단색만).
- 경계선(border-bottom: 1px solid #f3f4f6) 으로 구분, 카드 border-radius 남발 금지.
- faqs 4개: (1) 가격/예약, (2) 행사 준비, (3) 경력/전문성, (4) 취소/환불.
- 거짓/과장 금지. 입력에 없는 수상내역/구체 실적 꾸미지 말 것.
- 이모지는 🎤 🎁 🏆 ✓ 등 아이콘 용도로 최소 사용 (각 최대 1회).
- 인라인 style 만 사용, 외부 class 금지.`;

    // 재시도 + 모델 폴백: 각 모델에 대해 짧은 백오프로 2번 시도, 실패하면 다음 모델
    let lastError: any = null;
    let parsed: any = null;
    outer: for (const modelName of modelNames) {
      const model = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.8,
          responseMimeType: 'application/json',
          // thinking 끄기: 2.5 시리즈는 기본 thinking 활성 → 5-10초 추가 지연. 카피라이팅엔 불필요.
          thinkingConfig: { thinkingBudget: 0 },
        } as any,
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await model.generateContent([prompt, ...imageParts]);
          const text = result.response.text();
          parsed = JSON.parse(text);
          this.logger.log(`Gemini generated with model=${modelName}, attempt=${attempt + 1}`);
          break outer;
        } catch (e: any) {
          lastError = e;
          const msg = String(e?.message || e);
          // 503/429/504 는 다음 시도로, 그 외(401/400 등)는 바로 폭파
          if (!/503|429|504|UNAVAILABLE|overloaded|high demand|retry/i.test(msg)) {
            break outer;
          }
          this.logger.warn(`Gemini ${modelName} attempt ${attempt + 1} failed: ${msg.slice(0, 120)}`);
          // 500ms 백오프
          await new Promise((r) => setTimeout(r, 500 + attempt * 500));
        }
      }
    }
    if (!parsed) {
      this.logger.error(`Gemini generation failed after all retries: ${lastError?.message || lastError}`);
      throw new BadRequestException(`AI 생성 실패: ${lastError?.message || '모든 모델이 응답하지 않습니다'}`);
    }

    // 히어로 이미지는 별도 엔드포인트에서 생성 (15초+ 걸려 Vercel 프록시 타임아웃 회피).
    return {
      shortIntro: String(parsed.shortIntro || '').slice(0, 50),
      mainExperience: String(parsed.mainExperience || ''),
      detailHtml: String(parsed.detailHtml || ''),
      faqs: Array.isArray(parsed.faqs)
        ? parsed.faqs.slice(0, 6).map((f: any) => ({
            question: String(f.question || ''),
            answer: String(f.answer || ''),
          }))
        : [],
    };
  }

  /**
   * 히어로 이미지만 단독 생성 (상세페이지 상단 삽입용).
   * 텍스트 생성과 분리된 엔드포인트 — 15초+ 걸릴 수 있어 별도 요청으로 처리.
   */
  async generateHeroImageForProfile(input: {
    name?: string;
    category?: string;
    keywords?: string;
    imageDataUrls?: string[];
  }): Promise<{ url: string | null }> {
    if (!this.client) {
      throw new BadRequestException('AI 기능이 아직 설정되지 않았습니다.');
    }
    const imageParts = (input.imageDataUrls || []).slice(0, 4).flatMap((url) => {
      const match = url.match(/^data:(image\/[a-z]+);base64,(.+)$/i);
      if (!match) return [];
      return [{ inlineData: { mimeType: match[1], data: match[2] } }];
    });
    const result = await this.generateHeroImage({
      category: input.category,
      keywords: input.keywords,
      referenceImages: imageParts,
    });
    return result;
  }

  /**
   * Gemini 2.5 Flash Image (Nano Banana) 로 히어로 이미지 생성.
   * 성공 시 /uploads/:id 공개 URL 반환, 실패 시 null.
   */
  private async generateHeroImage(input: {
    category?: string;
    keywords?: string;
    referenceImages?: { inlineData: { mimeType: string; data: string } }[];
  }): Promise<{ url: string | null; debug: string[] }> {
    const debug: string[] = [];
    if (!this.client) {
      debug.push('client=null (no API key)');
      return { url: null, debug };
    }
    // 실측 SDK 호출 시간:
    //   gemini-2.5-flash-image           ~7.5초  (빠름, 먼저 시도)
    //   gemini-3.1-flash-image-preview  ~17.8초  (느려서 Vercel 타임아웃 위험)
    //   gemini-2.5-flash-image-preview   404     (모델 제거됨)
    const imageModels = [
      process.env.GEMINI_IMAGE_MODEL,
      'gemini-2.5-flash-image',
      'gemini-3.1-flash-image-preview',
    ].filter(Boolean) as string[];

    const prompt = `Create a professional hero banner image for a Korean service commerce detail page (like Kmong/Soomgo style).
Style: clean, modern, e-commerce product detail page aesthetic. Photorealistic, soft natural lighting.
Brand color accent: vivid blue (#3180F7) — incorporate as subtle background gradient, highlight, or mood.
Subject: Korean ${input.category || '사회자'} (event host/MC) in professional attire, confident and warm expression.
Context: ${input.keywords || 'professional event hosting'}.
Composition: wide 16:9 aspect, centered subject or left-aligned with blue-tinted background space on right for potential text.
Mood: trustworthy, premium, approachable. Minimalist background (soft gray/blue gradient, subtle studio lighting).
Strict: no text overlay, no logos, no watermarks. If reference photos are provided, match vibe/age/gender only (not identity).`;

    for (const modelName of imageModels) {
      const imageModel = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] as any } as any,
      });
      try {
        const parts: any[] = [{ text: prompt }, ...(input.referenceImages || [])];
        const t0 = Date.now();
        const result = await imageModel.generateContent(parts);
        const elapsed = Date.now() - t0;
        const candidates = (result.response as any)?.candidates || [];
        debug.push(`${modelName}: ${elapsed}ms, candidates=${candidates.length}`);
        for (const cand of candidates) {
          const partList = cand?.content?.parts || [];
          for (const part of partList) {
            if (part?.inlineData?.data) {
              const mimeType = part.inlineData.mimeType || 'image/png';
              const buffer = Buffer.from(part.inlineData.data, 'base64');
              const record = await this.prisma.uploadedFile.create({
                data: { mimeType, data: buffer, size: buffer.length },
                select: { id: true },
              });
              this.logger.log(`Hero image generated via ${modelName} in ${elapsed}ms`);
              debug.push(`saved upload id=${record.id}`);
              return { url: `/uploads/${record.id}`, debug };
            }
          }
        }
        debug.push(`${modelName}: no inlineData in response`);
        this.logger.warn(`${modelName} returned no image data`);
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 200);
        debug.push(`${modelName} error: ${msg}`);
        this.logger.warn(`generateHeroImage ${modelName} failed: ${msg}`);
      }
    }
    return { url: null, debug };
  }
}
