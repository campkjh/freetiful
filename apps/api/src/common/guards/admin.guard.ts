import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 어드민 권한 확인 가드
 *
 * 두 가지 방식으로 허용:
 *   1. `x-admin-key` 헤더가 `ADMIN_SECRET_KEY` 환경변수와 일치 (스크립트/레거시용)
 *   2. JWT bearer 토큰의 유저가 ADMIN_EMAILS 목록에 있거나 role === 'admin'
 *
 * 상태 코드:
 *   401 — 토큰 없음/만료/서명 불일치 (프론트 axios interceptor 가 refresh 후 재시도)
 *   403 — 토큰은 유효하지만 어드민 권한 부족
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly ADMIN_EMAILS = [
    'admin@freetiful.com',
    'freetiful2025@naver.com',
    'freetiful2025@admin.com',
  ];

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();

    // 1. x-admin-key 체크 (있을 때만)
    const key = req.headers['x-admin-key'] as string | undefined;
    const secret = this.config.get<string>('ADMIN_SECRET_KEY');
    if (key && secret && key === secret) return true;

    // 2. JWT 기반 체크
    const authHeader = req.headers.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }
    const token = authHeader.slice(7);
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('토큰이 만료되었습니다');
    }
    const userId = payload?.sub || payload?.id;
    if (!userId) throw new UnauthorizedException('유효하지 않은 토큰입니다');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new UnauthorizedException('유효하지 않은 토큰입니다');

    const email = user.email?.toLowerCase();
    if (user.role === 'admin' || (email && this.ADMIN_EMAILS.includes(email))) {
      req.user = user;
      return true;
    }
    throw new ForbiddenException('어드민 권한이 없습니다');
  }
}
