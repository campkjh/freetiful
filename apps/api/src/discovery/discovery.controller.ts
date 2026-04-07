import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {}
