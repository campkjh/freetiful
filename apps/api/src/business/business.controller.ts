import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('business')
@Controller('business')
export class BusinessController {}
