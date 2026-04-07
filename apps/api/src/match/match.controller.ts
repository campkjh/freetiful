import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('match')
@Controller('match')
export class MatchController {}
