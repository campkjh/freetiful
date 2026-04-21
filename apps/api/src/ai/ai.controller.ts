import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AiService, GenerateProfileInput } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
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
}
