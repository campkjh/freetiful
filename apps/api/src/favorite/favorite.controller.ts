import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('favorite')
@Controller('favorite')
export class FavoriteController {}
