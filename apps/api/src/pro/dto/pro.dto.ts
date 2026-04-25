import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProProfileDto {
  @ApiPropertyOptional({ description: '한 줄 소개' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  shortIntro?: string;

  @ApiPropertyOptional({ description: '주요 경력' })
  @IsOptional()
  @IsString()
  mainExperience?: string;

  @ApiPropertyOptional({ description: '경력 연차' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(80)
  careerYears?: number;

  @ApiPropertyOptional({ description: '수상 내역' })
  @IsOptional()
  @IsString()
  awards?: string;

  @ApiPropertyOptional({ description: '상세 소개 HTML' })
  @IsOptional()
  @IsString()
  detailHtml?: string;

  @ApiPropertyOptional({ description: '유튜브 URL' })
  @IsOptional()
  @IsString()
  youtubeUrl?: string;

  @ApiPropertyOptional({ description: '성별' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ description: '전국 활동 여부' })
  @IsOptional()
  @IsBoolean()
  isNationwide?: boolean;

  @ApiPropertyOptional({ description: '공개 목록/홈 노출 숨김 여부' })
  @IsOptional()
  @IsBoolean()
  isProfileHidden?: boolean;
}
