import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('quotation')
@Controller('quotation')
export class QuotationController {}
