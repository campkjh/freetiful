import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('payment')
@Controller('payment')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  /** 주문 생성 (결제 전) */
  @Post('order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '주문 생성 (결제 전 pending 레코드)' })
  createOrder(
    @Request() req: any,
    @Body()
    body: {
      quotationId: string;
      amount: number;
      orderName: string;
      proProfileId: string;
    },
  ) {
    return this.paymentService.createOrder(req.user.id, body);
  }

  /** 토스 결제 승인 */
  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '토스 결제 승인 (위젯 완료 후 호출)' })
  confirmPayment(
    @Request() req: any,
    @Body() body: { paymentKey: string; orderId: string; amount: number },
  ) {
    return this.paymentService.confirmPayment(req.user.id, body);
  }

  /** 결제 내역 목록 */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 내역 목록 조회' })
  getPayments(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.paymentService.getPayments(req.user.id, +page, +limit);
  }

  /** 결제 상세 조회 */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 상세 조회' })
  getPaymentDetail(@Request() req: any, @Param('id') id: string) {
    return this.paymentService.getPaymentDetail(req.user.id, id);
  }

  /** 결제 취소/환불 */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '결제 취소/환불' })
  cancelPayment(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.paymentService.cancelPayment(req.user.id, id, reason);
  }

  /** 전문가: 예약 승낙 */
  @Post(':id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전문가가 예약 승낙' })
  acceptBooking(@Request() req: any, @Param('id') id: string) {
    return this.paymentService.acceptBooking(req.user.id, id);
  }

  /** 전문가: 예약 거절 + 사유 */
  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전문가가 예약 거절 (취소 사유 포함)' })
  rejectBooking(
    @Request() req: any,
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.paymentService.rejectBooking(req.user.id, id, reason);
  }
}
