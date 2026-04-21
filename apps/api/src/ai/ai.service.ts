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

    const prompt = `당신은 한국의 행사 전문가(MC/사회자/쇼호스트 등) 플랫폼의 카피라이터입니다.
아래 정보를 바탕으로 전문가 프로필 페이지에 들어갈 매력적인 소개 콘텐츠를 **한국어 존댓말**로 작성해주세요.

[입력 정보]
- 이름: ${input.name || '(미기재)'}
- 분류: ${input.category || '사회자'}
- 경력: ${input.careerYears ?? 0}년
- 전문 분야: ${tagsText}
- 구사 언어: ${languagesText}
- 수상/자격 이력 (자유 입력): ${input.awards || '(없음)'}
- 키워드/톤 힌트: ${input.keywords || '(없음)'}
- 사진 ${imageParts.length}장 첨부됨 (얼굴/분위기 참조용)

[요구사항]
JSON 형식으로 다음 필드를 출력:
{
  "shortIntro": "50자 이내 한 줄 소개. 전문성과 매력을 함축.",
  "mainExperience": "핵심 경력 3~5줄. 구체적 기관/행사명이 입력되었다면 활용하고, 없으면 경력 연차 기반으로 자연스럽게.",
  "detailHtml": "상세 소개 HTML. h3/p/ul 등 기본 태그 사용. 400~600자. 전문성, 신뢰감, 개성을 담아 고객이 예약하고 싶도록. 과장·허위 금지. 사진을 참조해 분위기(따뜻한/격식있는/에너지있는)에 맞는 어조 선택.",
  "faqs": [
    { "question": "문의 가능한 질문", "answer": "150자 이내 답변" }
  ]
}

제약:
- faqs 는 4개 작성. 첫 질문은 가격/예약 절차, 두번째는 행사 준비, 세번째는 경력/전문성, 네번째는 취소/환불 관련.
- 거짓/과장 금지. 입력에 없는 수상내역 꾸미지 말 것.
- 이모지 사용 최소 (1-2개만).
- HTML 은 인라인 스타일 없이 시맨틱 태그만.`;

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
    const url = await this.generateHeroImage({
      category: input.category,
      keywords: input.keywords,
      referenceImages: imageParts,
    });
    return { url };
  }

  /**
   * Gemini 2.5 Flash Image (Nano Banana) 로 히어로 이미지 생성.
   * 성공 시 /uploads/:id 공개 URL 반환, 실패 시 null.
   */
  private async generateHeroImage(input: {
    category?: string;
    keywords?: string;
    referenceImages?: { inlineData: { mimeType: string; data: string } }[];
  }): Promise<string | null> {
    if (!this.client) return null;
    // 최신 → 구 모델 폴백 체인. 앞 모델이 503/quota 나면 다음으로.
    const imageModels = [
      process.env.GEMINI_IMAGE_MODEL,
      'gemini-3.1-flash-image-preview',
      'gemini-2.5-flash-image',
      'gemini-2.5-flash-image-preview',
    ].filter(Boolean) as string[];

    const prompt = `Create a professional, warm banner image for a Korean event host/MC detail page.
Style: photorealistic, soft lighting, modern, clean composition.
Subject tone: ${input.keywords || input.category || '사회자'}.
Wide aspect (16:9), uplifting mood, no text overlay.
If reference photos are provided, match the person's vibe (not identity).`;

    for (const modelName of imageModels) {
      const imageModel = this.client.getGenerativeModel({
        model: modelName,
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] as any } as any,
      });
      try {
        const parts: any[] = [{ text: prompt }, ...(input.referenceImages || [])];
        const result = await imageModel.generateContent(parts);
        const candidates = (result.response as any)?.candidates || [];
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
              this.logger.log(`Hero image generated via ${modelName}`);
              return `/uploads/${record.id}`;
            }
          }
        }
        this.logger.warn(`${modelName} returned no image data`);
      } catch (e: any) {
        this.logger.warn(`generateHeroImage ${modelName} failed: ${String(e?.message || e).slice(0, 120)}`);
      }
    }
    return null;
  }
}
