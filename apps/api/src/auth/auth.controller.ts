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
  KakaoNativeLoginDto,
  GoogleLoginDto,
  NaverLoginDto,
  NaverNativeLoginDto,
  AppleLoginDto,
  EmailRegisterDto,
  EmailLoginDto,
  RefreshTokenDto,
  LogoutDto,
  UpdateProfileDto,
} from './dto/auth.dto';

function getLoginDeviceInfo(req: any, source: 'web' | 'native' = 'web', platform?: string) {
  const headers = req?.headers || {};
  const forwardedFor = headers['x-forwarded-for'];
  const hintedPlatform =
    platform ||
    headers['x-platform'] ||
    headers['x-device-platform'] ||
    headers['x-app-platform'] ||
    headers['sec-ch-ua-platform'];
  return {
    platform: Array.isArray(hintedPlatform) ? hintedPlatform[0] : hintedPlatform,
    source,
    userAgent: headers['user-agent'],
    ipAddress: Array.isArray(forwardedFor) ? forwardedFor[0] : (forwardedFor || req?.ip),
  };
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login/kakao')
  @ApiOperation({ summary: 'Kakao social login (web — authorization code)' })
  kakaoLogin(@Body() dto: KakaoLoginDto, @Request() req: any) {
    return this.auth.kakaoLogin(dto.code, dto.redirectUri, getLoginDeviceInfo(req, 'web', dto.platform));
  }

  @Post('login/kakao/native')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kakao social login (iOS/Android native SDK — access token)' })
  kakaoNativeLogin(@Body() dto: KakaoNativeLoginDto, @Request() req: any) {
    return this.auth.kakaoNativeLogin(dto.accessToken, getLoginDeviceInfo(req, 'native', dto.platform));
  }

  @Post('login/google')
  @ApiOperation({ summary: 'Google social login' })
  googleLogin(@Body() dto: GoogleLoginDto, @Request() req: any) {
    return this.auth.googleLogin(dto.idToken, getLoginDeviceInfo(req, 'web', dto.platform));
  }

  @Post('login/naver')
  @ApiOperation({ summary: 'Naver social login (web — authorization code)' })
  naverLogin(@Body() dto: NaverLoginDto, @Request() req: any) {
    return this.auth.naverLogin(dto.code, dto.state, dto.redirectUri, getLoginDeviceInfo(req, 'web', dto.platform));
  }

  @Post('login/naver/native')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Naver social login (iOS/Android native SDK — access token)' })
  naverNativeLogin(@Body() dto: NaverNativeLoginDto, @Request() req: any) {
    return this.auth.naverNativeLogin(dto.accessToken, getLoginDeviceInfo(req, 'native', dto.platform));
  }

  @Post('login/apple')
  @ApiOperation({ summary: 'Apple social login' })
  appleLogin(@Body() dto: AppleLoginDto, @Request() req: any) {
    return this.auth.appleLogin(dto.identityToken, dto.fullName, getLoginDeviceInfo(req, 'web', dto.platform));
  }

  @Post('register/email')
  @ApiOperation({ summary: 'Email registration' })
  emailRegister(@Body() dto: EmailRegisterDto, @Request() req: any) {
    return this.auth.emailRegister(dto, getLoginDeviceInfo(req, 'web', dto.platform));
  }

  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email login' })
  emailLogin(@Body() dto: EmailLoginDto, @Request() req: any) {
    return this.auth.emailLogin(dto.email, dto.password, getLoginDeviceInfo(req, 'web', dto.platform));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshTokenDto, @Request() req: any) {
    return this.auth.refresh(dto.refreshToken, getLoginDeviceInfo(req));
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
