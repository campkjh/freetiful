import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('ref-data')
@Controller('ref-data')
export class RefDataController {}
