import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KakaoLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class KakaoNativeLoginDto {
  @ApiProperty({ description: 'Kakao access token from iOS/Android native SDK' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios or android' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class GoogleLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class NaverLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  redirectUri?: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class NaverNativeLoginDto {
  @ApiProperty({ description: 'Naver access token from iOS/Android native SDK' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios or android' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class AppleLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class EmailRegisterDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class EmailLoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

/** 비회원 로그인 — 랜딩으로 가입한 계정을 전화번호+이름으로 확인 */
export class GuestLoginDto {
  @ApiProperty({ description: '가입 시 입력한 전화번호 (하이픈 무관)' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: '가입 시 입력한 이름' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Client platform hint: ios, android, web' })
  @IsOptional()
  @IsString()
  platform?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}
