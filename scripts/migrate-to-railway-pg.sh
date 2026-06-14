#!/usr/bin/env bash
# Supabase Postgres → Railway 내장 Postgres 데이터 이전
# 사용법:
#   export SOURCE_DB_URL="postgresql://...supabase...:5432/postgres"   # Supabase (Settings→Database→Connection string, 직접/5432)
#   export TARGET_DB_URL="postgresql://...@<public-host>:<port>/railway"  # Railway PG (Connect→Public Network)
#   bash scripts/migrate-to-railway-pg.sh
# 주의: 프로덕션 데이터. 실행 전 TARGET 이 비어있는 새 DB 인지 확인.
set -euo pipefail
: "${SOURCE_DB_URL:?Supabase 연결 문자열을 SOURCE_DB_URL 로 export}"
: "${TARGET_DB_URL:?Railway PG 공개 연결 문자열을 TARGET_DB_URL 로 export}"

cd "$(dirname "$0")/../apps/api"

echo "▶ 1/3 타겟에 스키마 생성 (Prisma 마이그레이션 — Supabase 잔재 없이 깨끗)"
DATABASE_URL="$TARGET_DB_URL" npx prisma migrate deploy

echo "▶ 2/3 Supabase public 데이터만 덤프 (스키마/소유자/권한 제외, FK 트리거 우회)"
pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --no-privileges \
  --schema=public \
  --exclude-table='public._prisma_migrations' \
  --disable-triggers \
  > /tmp/freetiful_data.sql
echo "  덤프 크기: $(du -h /tmp/freetiful_data.sql | cut -f1)"

echo "▶ 3/3 타겟에 데이터 적재"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -1 -f /tmp/freetiful_data.sql

echo ""
echo "▶ 검증 (행 수 비교 — 주요 테이블)"
for t in users pro_profiles match_requests match_deliveries chat_rooms messages; do
  src=$(psql "$SOURCE_DB_URL" -tAc "select count(*) from public.\"$t\"" 2>/dev/null || echo "?")
  tgt=$(psql "$TARGET_DB_URL" -tAc "select count(*) from public.\"$t\"" 2>/dev/null || echo "?")
  printf "  %-18s source=%s  target=%s\n" "$t" "$src" "$tgt"
done
echo ""
echo "✅ 완료. 행 수가 일치하면 Railway 의 API 서비스 DATABASE_URL 을"
echo "   Railway PG 의 '내부(private)' 주소(postgres.railway.internal)로 바꾸고 재배포하세요."
