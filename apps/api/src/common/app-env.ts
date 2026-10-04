/**
 * 서버가 어떤 환경인지(261004 — 테스트 좋아요·조회수는 개발·스테이징에서만).
 *  · 운영 Railway 서버엔 NODE_ENV 가 없다 → NODE_ENV 만 보고 판단하면 운영이 '개발'로 잡힌다. 그래서 켜는 쪽은 명시적으로만:
 *    APP_ENV=development | staging 인 서버에서만 테스트 수치가 켜진다.
 *  · 그래도 RAILWAY_ENVIRONMENT_NAME=production 이거나 NODE_ENV=production 이면 APP_ENV 와 상관없이 꺼진다(잘못 넣은 설정 방어).
 */
export type AppEnv = 'production' | 'staging' | 'development';

export function appEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  const railway = String(env.RAILWAY_ENVIRONMENT_NAME || env.RAILWAY_ENVIRONMENT || '').trim().toLowerCase();
  const node = String(env.NODE_ENV || '').trim().toLowerCase();
  if (railway === 'production' || node === 'production') return 'production';
  const explicit = String(env.APP_ENV || '').trim().toLowerCase();
  if (explicit === 'development' || explicit === 'staging') return explicit;
  // 명시가 없으면 운영으로 본다 — 테스트 기능이 실수로 켜지는 쪽보다 꺼지는 쪽이 안전하다
  return 'production';
}

export function isTestMetricsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return appEnv(env) !== 'production';
}
