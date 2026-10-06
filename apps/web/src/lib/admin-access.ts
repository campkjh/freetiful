/**
 * 어드민 출입 — API(common/guards/admin.guard.ts)와 같은 기준. 목록을 바꿀 땐 둘 다.
 *  · 역할이 admin 이거나, 어드민 이메일이거나, 아래 계정 id.
 *  · ADMIN_USER_IDS = 역할은 그대로(사회자 등) 두고 어드민만 여는 계정 — 이메일이 아니라 id 로
 *    (같은 이메일을 단 다른 소셜 계정이 이어 붙어도 어드민이 열리지 않게). 261006 사장 'campkjh@nate.com 은 총괄운영자'.
 */
export const ADMIN_EMAILS = ['admin@freetiful.com', 'freetiful2025@naver.com', 'freetiful2025@admin.com'];
export const ADMIN_USER_IDS = [
  'a7c23078-a2cd-4643-87c0-c9292321bc3b', // campkjh@nate.com — 총괄운영자(사회자 계정 겸)
];

export function isAdminUser(user: { id?: string | null; email?: string | null; role?: string | null } | null | undefined) {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  return user.role === 'admin' || (!!email && ADMIN_EMAILS.includes(email)) || (!!user.id && ADMIN_USER_IDS.includes(user.id));
}
