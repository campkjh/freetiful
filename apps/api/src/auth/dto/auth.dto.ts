import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KakaoLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;
}

export class KakaoNativeLoginDto {
  @ApiProperty({ description: 'Kakao access token from iOS/Android native SDK' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}

export class GoogleLoginDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  idToken: string;
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
}

export class EmailLoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
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
