import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AiService, GenerateProfileInput } from './ai.service';

// pro-register 플로우(비로그인 상태)에서도 AI 생성이 필요하므로 JWT 가드 제거.
// 남용 방지는 레이트 리밋으로 대응 (추후).
@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  @Get('status')
  status() {
    return { enabled: this.ai.isEnabled() };
  }

  @Post('generate-profile')
  async generateProfile(@Body() body: GenerateProfileInput) {
    return this.ai.generateProfile(body);
  }

  @Post('generate-hero-image')
  async generateHeroImage(
    @Body()
    body: {
      name?: string;
      category?: string;
      keywords?: string;
      imageDataUrls?: string[];
    },
  ) {
    return this.ai.generateHeroImageForProfile(body);
  }
}
