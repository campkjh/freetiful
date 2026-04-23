import { IsOptional, IsString } from 'class-validator';

export class OneSignalRegisterDto {
  @IsString()
  playerId: string;

  @IsOptional()
  @IsString()
  platform?: string;
}
