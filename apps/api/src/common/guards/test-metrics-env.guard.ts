import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { isTestMetricsEnabled } from '../app-env';

/**
 * 테스트 좋아요·조회수 API 를 운영 서버에서 아예 없는 것처럼 막는다(261004).
 * 컨트롤러에서 AdminGuard 보다 먼저 둔다 — 운영이면 관리자 여부를 따지기 전에 404(라우트가 없는 것과 같은 응답).
 */
@Injectable()
export class TestMetricsEnvGuard implements CanActivate {
  canActivate(): boolean {
    if (!isTestMetricsEnabled()) throw new NotFoundException('Cannot find this route');
    return true;
  }
}
