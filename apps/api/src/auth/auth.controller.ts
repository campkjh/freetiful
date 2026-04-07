import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  KakaoLoginDto,
  GoogleLoginDto,
  NaverLoginDto,
  AppleLoginDto,
  EmailRegisterDto,
  EmailLoginDto,
  RefreshTokenDto,
  LogoutDto,
  UpdateProfileDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login/kakao')
  @ApiOperation({ summary: 'Kakao social login' })
  kakaoLogin(@Body() dto: KakaoLoginDto) {
    return this.auth.kakaoLogin(dto.code);
  }

  @Post('login/google')
  @ApiOperation({ summary: 'Google social login' })
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.auth.googleLogin(dto.idToken);
  }

  @Post('login/naver')
  @ApiOperation({ summary: 'Naver social login' })
  naverLogin(@Body() dto: NaverLoginDto) {
    return this.auth.naverLogin(dto.code, dto.state);
  }

  @Post('login/apple')
  @ApiOperation({ summary: 'Apple social login' })
  appleLogin(@Body() dto: AppleLoginDto) {
    return this.auth.appleLogin(dto.identityToken, dto.fullName);
  }

  @Post('register/email')
  @ApiOperation({ summary: 'Email registration' })
  emailRegister(@Body() dto: EmailRegisterDto) {
    return this.auth.emailRegister(dto);
  }

  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email login' })
  emailLogin(@Body() dto: EmailLoginDto) {
    return this.auth.emailLogin(dto.email, dto.password);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@Request() req: any, @Body() dto: LogoutDto) {
    return this.auth.logout(req.user.id, dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user' })
  me(@Request() req: any) {
    return req.user;
  }
}
