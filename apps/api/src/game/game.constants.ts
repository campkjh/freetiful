/**
 * 웨딩런 '신혼집까지 달려!' 서버 상수(261011 사장 '원라인솔루션 에그점프처럼 점프게임, url 은 따로').
 * (261011 사장 2D 러너 개편 + 랭킹 API 검증 보강 — 세션 DB 기록·진행/시간 대조·기간별 요약·속도 제한 재구성)
 *
 * ⚠ 아래 '엔진과 맞출 값' 묶음은 웹 엔진 설정(apps/web/src/app/wedding-run/game/config.ts)과 같은 뜻·같은 값이어야 한다.
 *   엔진을 고쳐 점수가 빨라지거나 코스가 짧아지면 여기도 같이 고친다 — 안 고치면 잘하는 사람의 정상 기록이 400 으로 막힌다
 *   (웹은 그 판을 '기기에만 저장'으로 처리한다). 바퀴 시간 하한은 물리 하한(바퀴 길이 ÷ 그 바퀴 최고 속도) 바로 아래,
 *   단계 시간 하한은 설계값의 절반 정도로 넉넉하게 잡았다(261011 검증 반영: 바퀴 하한을 물리 하한으로 조임).
 */

// ───────── 엔진과 맞출 값 ─────────

/**
 * 이론 최대 초당 점수 — 웹 2D 엔진 config.ts 의 WR_MAX_SCORE_PER_SEC 와 **같은 값(70)**.
 * (261011 사장 '더 갈수록 빨라지게' — 속도 상한 720 → 860 이라 60 → 70, 엔진·서버 같이 배포)
 * 엔진 근거(config.ts 주석): 거리 ≤ 860/25 = 34.4 · 수집물 ≤ 거리 × 0.7 = 24.08 · 도착·촬영 ≈ 5.15(가장 빠른 바퀴 116.5초) → 합 ≈ 63.6/초 → 70.
 *   엔진이 점수를 (달린 초 × 70) 으로 한 번 더 자르므로 정직한 판은 이 검사에 걸리지 않는다.
 */
export const WR_MAX_SCORE_PER_SEC = 70;

/** 구간 12개(0~11: 서울→종로→경복궁→상견례→드레스 매장→가전 매장→플래너 상담→빈 웨딩홀→하객 웨딩홀→비행기→발리→신혼집) — 사양 [5] */
export const WR_SEGMENT_COUNT = 12;
export const WR_SEGMENT_MAX = WR_SEGMENT_COUNT - 1;
/** 캐릭터 단계 0~4(드레스·부케·부케+베일티아라·신랑 합류·손잡고) — 사양 [4] */
export const WR_STAGE_MAX = 4;

/**
 * 한 바퀴 길이(설계 좌표) — 엔진 config.ts LAP_LEN(94,341)과 같은 값. 구간 길이 = 바퀴 ÷ 12(모두 같음).
 */
export const WR_LAP_LEN = 94_341;

/**
 * (261011 사장 '갈수록 완전 더 어렵게' + '더 갈수록 빨라지게') 속도 곡선 — 엔진 config.ts SPEED_LAPS·SPEED_KAPPA·SPEED_LAP_PLUS·
 * SPEED_V0_MAX·MAX_SPEED 와 **같은 값**. 속도가 바퀴 안 위치로 정해지므로 '진행(완주 수·구간) ↔ 달린 시간'이 구간 하나 폭으로 묶인다.
 *   v(바퀴, 구간, f) = min(바퀴 상한, v0 + Δ·구간 + Δ·0.3·f)  — 바퀴별 [v0, 구간당 Δ, 상한], 6바퀴~ v0 += 10(최대 760), 상한 860
 *   시험 값(game-rules wrLapTimeSec): 1바퀴 176.4초 · 2바퀴 147.3 · 3바퀴 132.8 · 4바퀴 125.0 · 5바퀴 121.0
 *   (261011 검증 low: 다음 여정 시작 속도를 직전 바퀴 끝의 −15% → −10% 로 올림 — 엔진 config.ts 와 같이)
 * ⚠ 엔진과 엇갈리면 정직한 판이 시간 창 검사에서 거절된다 — 꼭 같이 배포.
 */
export const WR_SPEED_LAPS: ReadonlyArray<readonly [number, number, number]> = [
  [450, 16, 640],
  [570, 13, 720],
  [645, 12, 790],
  [700, 10, 830],
  [730, 9, 860],
];
export const WR_SPEED_KAPPA = 0.3;
export const WR_SPEED_LAP_PLUS = 10;
export const WR_SPEED_V0_MAX = 760;
export const WR_MAX_SPEED = 860;

/** 엔진 점수 규칙(config.ts): 달린 거리 25 = 1점 · 수집물 누적 ≤ 거리 점수 × 0.7 · 도착 +500(바퀴마다) · 웨딩 촬영 +100(바퀴마다 한 번) */
export const WR_DIST_PER_POINT = 25;
export const WR_COLLECT_RATIO = 0.7;
export const WR_ARRIVE_BONUS = 500;
export const WR_PHOTO_BONUS = 100;
/** 웨딩 촬영 위치(구간 7 = 빈 웨딩홀) — 그 구간부터 지금 바퀴 촬영 1번 허용 */
export const WR_PHOTO_SEG = 7;
/** 하트 +5 · 축의금 봉투 +30(config.ts HEART_VALUE·ENVELOPE_VALUE) — 모은 개수 ↔ 진행 대조 */
export const WR_HEART_VALUE = 5;
export const WR_ENVELOPE_VALUE = 30;

/**
 * 시간 창(일시정지는 달린 시간에서 빠짐 → 연출만 여유):
 *   하한 = WR_TIME_MIN_RATIO × (그 구간 시작까지의 곡선 시간) − WR_TIME_MIN_SLACK_MS  (실제 속도는 곡선 이하 — 경계 섞기·출발 가속·촬영 감속)
 *   상한 = (그 구간 끝까지의 곡선 시간) + 완주마다 WR_TIME_LAP_OVERHEAD_MS + WR_TIME_BASE_SLACK_MS (+ 지금 바퀴 촬영 구간이면 1초)
 *   완주 1번의 연출 ≈ 도착 감속 0.23 + 유지 2.4 + 하얀 전환 0.9 + 출발 가속 0.3 + 촬영 감속 0.65 + 경계 섞기 0.24 ≈ 4.7초 → 6초.
 */
export const WR_TIME_MIN_RATIO = 0.99;
export const WR_TIME_MIN_SLACK_MS = 1000;
export const WR_TIME_LAP_OVERHEAD_MS = 6000;
export const WR_TIME_BASE_SLACK_MS = 8000;
export const WR_TIME_PHOTO_SLACK_MS = 1000;
/** 거리 점수 창 여유(점) — 도착 감속·마지막 물리 걸음 넘침 */
export const WR_DIST_SLACK_PTS = 8;
/** 수집 상한 여유(점) — 하트 줄 한 개 정도 */
export const WR_COLLECT_SLACK_PTS = 35;

/**
 * 단계별 최소 달린 시간 — 첫 변화(부케)는 시작 후 15~20초(사양 [4])의 절반, 그 뒤 단계는 3분 코스에서 넉넉히 앞당긴 값.
 * stage=4 인데 durationMs 가 1초 같은 기록을 거른다(시간 창이 주된 검사, 이건 보조).
 */
export const WR_STAGE_MIN_MS: readonly number[] = [0, 7_500, 20_000, 35_000, 50_000];
/**
 * 하트·봉투를 합쳐 초당 이보다 많이 모을 수 없다(넉넉히) — 수집 개수 부풀리기 방어.
 * 대조 규칙은 '수집물 1개 ≥ 1점'(하트 + 봉투 ≤ 점수)도 가정한다 — 엔진이 0점짜리 수집물을 만들면 이 가정을 고칠 것(game-rules.ts).
 */
export const WR_COLLECT_MAX_PER_SEC = 10;

// ───────── 자동 보류(운영 확인 뒤 반영) ─────────
// 점수는 결국 클라가 보낸 값이라(재현 검증 없음), 엔진 규칙 안이지만 사람이 내기 어려운 판은 '숨김(보류)'으로 저장하고 운영 목록에 띄운다
// (hiddenReason 'auto:…', 운영 화면 /admin/wedding-run · API GET admin/scores?hidden=auto → POST admin/scores/:id/hide { hidden:false } 로 반영).
/**
 * 완주가 이만큼 이상인 판은 보류 — (261011 E1) 새 난이도에서 3바퀴 = 약 8분 무사고 + 3바퀴째 겹침 기믹(4 → 3).
 * 위조 판은 '보류 없이' 최대 완주 2·구간 12까지만 → 그 진행의 점수 상한(≈ 1.94만, game-rules 시험표)이 한계.
 */
export const WR_HOLD_LAPS = 3;
/**
 * 모은 하트·봉투 점수 > 이 비율 × (그 진행 거리 점수 상한) 이면 보류 — 수집 예산(0.7)의 약 89%.
 * 근거(261011 실측): 엔진 생성기·물리·봇을 그대로 옮긴 노드 시뮬레이션 300판×3바퀴(길 위 하트를 거의 다 먹는 봇) —
 *   판 중 어느 순간이든(거리 점수 상한 > 2,500) 수집 ÷ 거리 상한 p99 0.583 · 최대 0.594 → p99 + 0.03 ≈ 0.62.
 *   실제 엔진 헤드리스 봇 3바퀴 판(표본 315개) 최대 0.452 — 사람은 이보다 낮다.
 */
export const WR_HOLD_COLLECT_RATIO = 0.62;
/**
 * (261011 검증 E1 medium '보류 없이 통과하는 위조 상한 19,648 > 정직 상위권') 수집 보류선을 거리에 따라 낮춘다 —
 *   거리 점수 상한 ≤ 4,000 은 0.62 그대로, 10,000 이상은 0.50, 그 사이는 직선.
 * 근거(헤드리스 엔진 봇 판 상태 167개, 길 위 하트를 거의 다 먹는 봇 — scratchpad wrun3/adv/honest-samples.json, 서버식 dMax):
 *   dMax 2,500~4,000 최대 0.549 · 4,000~6,000 0.544 · 6,000~10,000 0.505 · 10,000 이상 0.448 — 길수록 낮다(초반 연습·쉬는 하트 줄 몫이 줄어서).
 *   → 각 구간 봇 최대보다 0.05 이상 위. 짧은 판은 그대로 두고(위조해도 점수가 작아 순위 위로 못 감) 긴 판만 조인다.
 * 효과(game-rules 를 그대로 돌린 위조 탐색): 보류 없이 통과하는 위조 상한 19,648 → 약 18,300(완주 2·구간 11, dMax ≈ 11,330).
 *   같은 진행의 정직 판(봇 최대 수집 0.45) ≈ 17,700 — 남은 틈 ≈ 3%. 완주 3번 이상은 전부 보류(WR_HOLD_LAPS).
 */
export const WR_HOLD_COLLECT_RATIO_LONG = 0.5;
export const WR_HOLD_COLLECT_TAPER: readonly [number, number] = [4000, 10000];
/** 거리 점수 상한 dMax 에서의 수집 보류선(비율) */
export function wrHoldCollectRatio(dMax: number): number {
  const [a, b] = WR_HOLD_COLLECT_TAPER;
  const t = Math.max(0, Math.min(1, (dMax - a) / (b - a)));
  return WR_HOLD_COLLECT_RATIO + (WR_HOLD_COLLECT_RATIO_LONG - WR_HOLD_COLLECT_RATIO) * t;
}
/** 수집 보류는 거리 점수 상한이 이만큼 넘는 판만(초반 연습·안전 구간 하트 줄로 비율이 흔들리는 짧은 판 제외 — 1바퀴의 ⅔쯤) */
export const WR_HOLD_COLLECT_MIN_PTS = 2500;
/** 이보다 오래 달린 판은 보류(12분 ≈ 4~5바퀴 무사고) */
export const WR_HOLD_DURATION_MS = 12 * 60 * 1000;
/** 판 평균 초당 점수 보류선 — 이론 상한 63.6/초보다 위라 정직한 판은 걸리지 않음(시간·거리 창이 주된 검사, 이건 마지막 안전망) */
export const WR_HOLD_SCORE_PER_SEC = 66;
/** 초당 점수 보류는 이만큼 이상 달린 판만 */
export const WR_HOLD_RATE_MIN_MS = 60_000;

// ───────── 점수 상한 ─────────

/** 점수 상한 = min(서버가 잰 세션 시작~제출, 클라 durationMs) 초 × WR_MAX_SCORE_PER_SEC + 200(반올림·첫 몇 초 여유) */
export const WR_SCORE_SLACK_ADD = 200;
/** 터무니없는 값 방어(정수 칸 넘침 포함) */
export const WR_ABS_MAX_SCORE = 10_000_000;
/** 달린 시간은 서버 시계(지금 - 세션 시작) 이하여야 — 판 시작과 세션 요청이 거의 동시라 생기는 차이·네트워크 여유 2초 */
export const WR_DURATION_SLACK_MS = 2000;

/** 이론 점수 상한(달린 시간 기준) */
export function wrMaxScoreFor(durationMs: number): number {
  return Math.floor((Math.max(0, durationMs) / 1000) * WR_MAX_SCORE_PER_SEC + WR_SCORE_SLACK_ADD);
}

// ───────── 세션 ─────────

/**
 * 세션 수명 30분 — 판 시작 때 DB 에 1행, 제출 때 한 번만 쓴다. 예전 2시간·무상태 토큰은 '토큰 받아 두고 기다렸다 큰 점수' 공격이 됐다
 * (2시간 대기 → 약 47만 점 통과). 30분이 지나면 그 판은 '기기에만 저장'된다(일시정지를 아주 오래 한 판 포함 — 드문 경우).
 */
export const WR_SESSION_TTL_MS = 30 * 60 * 1000;
/** 세션 토큰 audience — 로그인 토큰과 섞이지 않게(비밀도 JWT_SECRET 에서 따로 파생) */
export const WR_SESSION_AUDIENCE = 'wedding-run-session';
/** 같은 기기에 동시에 열려 있을 수 있는 판 — 넘으면 오래된 것부터 닫는다(그만둔 판·새로고침이 쌓여도 새 판은 늘 열림) */
export const WR_OPEN_SESSIONS_PER_DEVICE = 3;
/**
 * 같은 IP(해시)에 동시에 열려 있을 수 있는 판(요청한 기기 자기 판은 빼고 셈) — 넘으면 새 판을 429 로 거절.
 * 기기 id 를 바꿔 가며 판을 잔뜩 열어 두는 공격의 상한. (261011 검증 medium: 30 은 박람회 와이파이·회사 NAT 에서 기기 10대면 닿아
 * 그 IP 의 모든 기기가 최대 30분 랭킹에서 빠졌다 → 200, 그리고 웹이 그만둔 판·안 쓴 판을 'sessions/abandon' 으로 닫는다)
 */
export const WR_OPEN_SESSIONS_PER_IP = 200;
/** 다 쓴·만료된 세션 행을 지우는 기준(하루) · 한 번에 지우는 최대 행 · 청소 간격(서버 한 대 기준) */
export const WR_SESSION_KEEP_MS = 24 * 60 * 60 * 1000;
export const WR_CLEANUP_BATCH = 5000;
export const WR_CLEANUP_EVERY_MS = 10 * 60 * 1000;

// ───────── 범위 ─────────

/** 완주·수집 개수 상한(정상 플레이로는 닿지 않는 값 — 실제 상한은 위 시간 대조가 정한다) */
export const WR_LAPS_MAX = 1000;
export const WR_COLLECT_MAX = 100_000;

// ───────── 속도 제한(메모리, 1분 고정 창) ─────────
// IP 는 웹(Vercel)이 붙인 비밀 헤더가 맞을 때만 x-forwarded-for 를 믿는다(game-ip.ts). 아니면 연결 주소 하나로 묶는다.
// 서버가 여러 대가 되면 대당 한도가 된다(그때 Redis 로). 열린 세션 상한은 DB 로 세서 대수와 상관없다.
export const WR_RATE_WINDOW_MS = 60_000;
/** 기기 단위 — 금방 넘어지고 바로 다시 해도(판당 2초 남짓) 분당 30판이면 넉넉하다 */
export const WR_RATE_DEVICE_SESSIONS_PER_MIN = 30;
export const WR_RATE_DEVICE_SCORES_PER_MIN = 30;
/** IP 단위 — 통신사 공유 IP·박람회 와이파이를 생각해 넉넉히 */
export const WR_RATE_IP_SESSIONS_PER_MIN = 240;
export const WR_RATE_IP_SCORES_PER_MIN = 240;
/** 읽기(순위·공유 기록) — IP 단위. 순위는 캐시로 막고, 이건 캐시를 비켜 가는 반복(내 순위·없는 id)을 막는다 */
export const WR_RATE_IP_READS_PER_MIN = 300;

// ───────── 순위 ─────────

/** 순위 화면 상위 몇 명 · 'TOP N 까지 ○점' 의 N */
export const WR_LEADERBOARD_LIMIT = 50;
export const WR_TOP_N = 10;
/**
 * 순위·내 순위 캐시 10초(TTL 로만 만료). 예전엔 점수가 들어올 때마다 통째로 비워 사람이 몰리면 거의 안 맞았다.
 * 지금은 새 점수가 그 기간 상위 목록을 바꿀 때만 그 기간 목록을 비운다(내 순위는 내 것만 비움).
 */
export const WR_BOARD_CACHE_MS = 10_000;
export const WR_RANK_CACHE_MS = 10_000;
/** 탈퇴·정지 계정 숨김 청소 간격(서버 한 대 기준) — 순위 목록에 보이는 계정은 매번 확인한다 */
export const WR_ACCOUNT_SWEEP_EVERY_MS = 5 * 60 * 1000;
/** 지난 기간 요약 보관 — 오늘 순위는 9일, 이번 주 순위는 6주 지나면 지운다('전체'는 지우지 않음) */
export const WR_KEEP_DAY_BESTS_DAYS = 9;
export const WR_KEEP_WEEK_BESTS_DAYS = 42;

// ───────── 기간 경계(한국 시간) ─────────
// 오늘 = KST 자정부터, 이번 주 = KST 월요일 0시부터. 한국은 서머타임이 없어 +9시간 고정.
export type WRPeriod = 'today' | 'week' | 'all';
export const WR_PERIODS: readonly WRPeriod[] = ['today', 'week', 'all'];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** nowMs 가 속한 KST 날짜의 0시(UTC epoch ms) */
export function kstDayStartMs(nowMs: number): number {
  return Math.floor((nowMs + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
}

/** nowMs 가 속한 KST 주의 월요일 0시(UTC epoch ms) */
export function kstWeekStartMs(nowMs: number): number {
  const dayStart = kstDayStartMs(nowMs);
  const dow = new Date(dayStart + KST_OFFSET_MS).getUTCDay(); // 0=일 … 6=토 (KST 기준 요일)
  return dayStart - ((dow + 6) % 7) * DAY_MS;
}

/** 기간 시작 시각 — 전체면 null */
export function wrPeriodStart(period: WRPeriod, nowMs: number): Date | null {
  if (period === 'today') return new Date(kstDayStartMs(nowMs));
  if (period === 'week') return new Date(kstWeekStartMs(nowMs));
  return null;
}

/** KST 0시(UTC ms) → 'YYYY-MM-DD'(KST 날짜) */
function kstDateString(kstMidnightUtcMs: number): string {
  return new Date(kstMidnightUtcMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 요약 표(wedding_run_bests)의 기간 키 — 'all' | 'd:YYYY-MM-DD'(KST 날짜) | 'w:YYYY-MM-DD'(KST 주 월요일) */
export function wrPeriodKey(period: WRPeriod, nowMs: number): string {
  if (period === 'today') return `d:${kstDateString(kstDayStartMs(nowMs))}`;
  if (period === 'week') return `w:${kstDateString(kstWeekStartMs(nowMs))}`;
  return 'all';
}

/** 그 시각의 판이 들어가는 기간 키 셋(오늘·이번 주·전체) */
export function wrPeriodKeysAt(atMs: number): string[] {
  return WR_PERIODS.map((p) => wrPeriodKey(p, atMs));
}

/** 기간 키 → 그 기간의 [시작, 끝) (UTC ms). 'all' 이면 null(전 기간) */
export function wrPeriodRange(periodKey: string): { from: number; to: number } | null {
  const m = /^([dw]):(\d{4}-\d{2}-\d{2})$/.exec(periodKey);
  if (!m) return null;
  const from = Date.parse(`${m[2]}T00:00:00.000+09:00`);
  return { from, to: from + (m[1] === 'd' ? DAY_MS : 7 * DAY_MS) };
}
