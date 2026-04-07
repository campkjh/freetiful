import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  IsArray,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum MessageTypeEnum {
  text = 'text',
  image = 'image',
  file = 'file',
  location = 'location',
  link = 'link',
  sticker = 'sticker',
  system = 'system',
}

// ─── Chat Room ───────────────────────────────────────────────────────────────

export class CreateChatRoomDto {
  @ApiProperty()
  @IsUUID()
  proProfileId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  matchRequestId?: string;
}

// ─── Messages ────────────────────────────────────────────────────────────────

export class SendMessageDto {
  @ApiProperty({ enum: MessageTypeEnum })
  @IsEnum(MessageTypeEnum)
  type: MessageTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}

export class EditMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  content: string;
}

export class ReactToMessageDto {
  @ApiProperty({ description: 'Emoji string (e.g. ❤️, 😢, 👍, 😂)' })
  @IsString()
  @MaxLength(10)
  emoji: string;
}

// ─── Scheduled Messages ──────────────────────────────────────────────────────

export class CreateScheduledMessageDto {
  @ApiProperty({ enum: MessageTypeEnum })
  @IsEnum(MessageTypeEnum)
  type: MessageTypeEnum;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  @IsDateString()
  scheduledAt: string;
}

// ─── Frequent Messages ──────────────────────────────────────────────────────

export class CreateFrequentMessageDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

export class UpdateFrequentMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  displayOrder?: number;
}

// ─── Query / Pagination ─────────────────────────────────────────────────────

export class ChatRoomQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class MessageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  after?: string;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class PhotoGalleryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 30;
}
