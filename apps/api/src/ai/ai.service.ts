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

    const prompt = `당신은 크몽/숨고 스타일 전문가 서비스 플랫폼의 상세페이지 디자이너이자 카피라이터입니다.
아래 정보를 바탕으로 **상품 상세페이지 수준의 구조화된 HTML 콘텐츠**를 **한국어 존댓말**로 작성해주세요.

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
  "detailHtml": "아래 [상세페이지 HTML 템플릿] 을 기반으로 800~1200자 HTML.",
  "faqs": [{ "question": "...", "answer": "..." }]
}

[상세페이지 HTML 템플릿 — 이 구조를 그대로 따라 작성]
메인 컬러 #3180F7 을 강조에 사용. 인라인 style 로만 스타일링 (외부 CSS 금지). 섹션 사이 <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>.

1. 인트로 섹션:
   <div style="text-align:center;padding:16px 0;">
     <div style="color:#3180F7;font-size:13px;font-weight:700;letter-spacing:0.1em;margin-bottom:8px;">INTRODUCTION</div>
     <h3 style="font-size:22px;font-weight:700;line-height:1.4;margin:0 0 12px;">핵심 한 줄 캐치프레이즈 (분류+경력 강조)</h3>
     <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0;">서비스 개요 2-3줄</p>
   </div>

2. CHECK POINT 섹션 3개 (01, 02, 03):
   <div style="padding:20px 0;">
     <div style="color:#3180F7;font-size:13px;font-weight:700;letter-spacing:0.1em;">CHECK POINT</div>
     <div style="color:#3180F7;font-size:28px;font-weight:700;margin:4px 0 12px;">01</div>
     <h3 style="font-size:18px;font-weight:700;margin:0 0 6px;">특징 제목<br/><span style="background:#3180F7;color:#fff;padding:2px 10px;border-radius:4px;font-size:15px;">핵심 키워드</span></h3>
     <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:12px 0 0;">특징 설명 2-3줄</p>
   </div>
   (02, 03 도 같은 구조. 각각 다른 강점: 예 — 경력/전문성, 서비스 품질, 고객 경험)

3. 제공 서비스 섹션:
   <div style="padding:20px 0;">
     <div style="color:#3180F7;font-size:13px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">WHAT'S INCLUDED</div>
     <h3 style="font-size:20px;font-weight:700;margin:0 0 16px;">제공되는 서비스</h3>
     <ul style="list-style:none;padding:0;margin:0;">
       <li style="display:flex;gap:10px;padding:10px 12px;background:#f9fafb;border-radius:8px;margin-bottom:8px;"><span style="color:#3180F7;font-weight:700;">✓</span><span>서비스 항목 1</span></li>
       ...(4-5개 항목)
     </ul>
   </div>

4. 프로모션/옵션 박스:
   <div style="background:linear-gradient(135deg,#3180F7,#1e5fd9);color:#fff;border-radius:12px;padding:20px;margin:16px 0;">
     <div style="font-size:12px;opacity:0.9;letter-spacing:0.1em;margin-bottom:6px;">SPECIAL OFFER</div>
     <h3 style="font-size:18px;font-weight:700;margin:0 0 8px;color:#fff;">프로모션 제목</h3>
     <p style="font-size:14px;line-height:1.6;margin:0;opacity:0.95;">예: 평일 예약 시 10% 할인, 2시간 이상 예약 시 리허설 무료 제공 등</p>
   </div>

5. 만족도/강점 박스 (해당되면):
   <div style="background:#eff6ff;border-left:4px solid #3180F7;padding:16px;border-radius:4px;margin:16px 0;">
     <div style="color:#3180F7;font-weight:700;font-size:14px;margin-bottom:4px;">CUSTOMER SATISFACTION</div>
     <p style="font-size:14px;color:#1f2937;line-height:1.6;margin:0;">신뢰감 있는 마무리 메시지 — 왜 저를 선택해야 하는지</p>
   </div>

[제약]
- 모든 강조색은 **#3180F7** (파란색) 통일. 빨강/초록 사용 금지.
- font-weight 최대 700. font-black(900) 금지.
- faqs 4개: (1) 가격/예약, (2) 행사 준비, (3) 경력/전문성, (4) 취소/환불.
- 거짓/과장 금지. 입력에 없는 수상내역/구체 실적 꾸미지 말 것.
- 이모지는 ✓ ★ 외에는 사용 금지.
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
