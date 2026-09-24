import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// 토큰이 있으면 req.user 세팅, 없거나 무효여도 통과(401 던지지 않음).
// 비로그인도 열람 가능하되 로그인 시 개인화(내 리액션/투표 등)가 필요한 공개 조회에 사용.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: any, user: any): TUser {
    return (user || undefined) as TUser;
  }
}
