// 웨딩런 엔진 설정값 (261011 사장 '웨딩런: 신혼집까지 달려!' 2D 횡스크롤 러너 — 사양서 [4][5][6][9][12] '설정값으로 분리')
//  · Phaser 를 import 하지 않는다 — 화면·서버 검증이 숫자만 가져가도 엔진 청크가 안 섞인다.
//  · 길이 단위 = 설계 좌표(화면 세로 VIEW_H=450 기준, 캐릭터 키 CHAR_H=126). 시간 = 초. 속도 = 단위/초.
//  · 숫자를 바꾸면 '첫 완주 ≈ 3분', '점프로 넘을 수 있는가', '서버 점수 상한' 이 같이 움직인다 — 아래 근거 주석을 같이 고칠 것.

/* ───────── 화면(설계 좌표) ───────── */

/** 설계 세로 길이. 실제 캔버스는 이 높이가 화면 세로에 꽉 차게 확대된다(카메라 줌) */
export const VIEW_H = 450;
/**
 * 최소 가시 폭. 20:9(=2.22)는 450×2.22=1000 이 그대로 보이고, 16:9·16:10·PC 처럼 덜 넓은 화면은
 * 세로를 늘려(하늘이 더 보임) 폭 900 을 지킨다 → 기기마다 '앞을 내다보는 거리'가 크게 달라지지 않는다.
 */
export const VIEW_MIN_W = 900;
/**
 * 땅(발 딛는 선)은 화면 아래에서 이만큼 위 — 세로가 늘어나도 바닥 쪽은 그대로, 늘어난 만큼 위(하늘)가 더 보인다.
 * 화면 아래 띠(20:9 에서 세로의 25.8%, 16:9 에서 22.9%)는 발판 앞면 — 점프·슬라이드 버튼은 이 띠 안에 두면 장애물·착지 지점을 가리지 않는다(사양서 [7]).
 */
export const GROUND_FROM_BOTTOM = 116;
/** 신부 발(피벗) 화면 x — 왼쪽 노치·슬라이드 버튼과 겹치지 않게 조금 안쪽 */
export const PLAYER_X = 250;
/** 캐릭터 몸 높이(달리기 refH 가 화면에서 이 크기) — 1~5단계 내내 신부 키가 같다 */
export const CHAR_H = 126;
/** 발판 그림에서 발을 둘 깊이: topY(윗면 뒤 가장자리)~faceY(앞 모서리) 사이 비율 — 2.5D 그림상 '위에 선' 느낌 */
export const PLATFORM_FOOT_DEPTH = 0.5;
/** 발판 이음 처리: 평평한 범위를 잘라 좌우 반전 교대로 이어 붙이고, 끝 둥근 마개는 구간 시작·바닥 틈에만 */
export const PLATFORM_CAP_EXTRA = 60; // 마개 조각에 평평한 부분을 이만큼(이미지 px) 붙여 아래 조각을 덮는다
/** 배경 시차: 땅이 1 갈 때 배경은 이만큼(구간마다 왼쪽 끝부터 시작, 이어지지 않는 끝은 좌우 반전 교대) */
export const BG_PARALLAX = 0.05;
/** 구간 배경 교차 전환 시간 */
export const BG_FADE_SEC = 0.9;

/* ───────── 조작·물리 ───────── */

/** 점프 꼭대기(발 높이). 지상 장애물 충돌 위끝 최대 0.674×CHAR_H=85 → 꼭대기 136 이면 넉넉히 넘음 */
export const JUMP_H = 136;
/** 점프 체공 시간(이륙~착지). 중력·초속은 이 둘에서 계산 */
export const JUMP_AIR_SEC = 0.7;
export const GRAVITY = (8 * JUMP_H) / (JUMP_AIR_SEC * JUMP_AIR_SEC); // ≈ 2220
export const JUMP_V = (4 * JUMP_H) / JUMP_AIR_SEC; // ≈ 777
/** 공중에서 슬라이드를 누르면 빨리 내려옴(중력 배수) → 착지하자마자 슬라이드 */
export const FAST_FALL_MUL = 2.6;
/** 땅을 막 벗어난 뒤에도 점프 허용(초) */
export const COYOTE_SEC = 0.09;
/** 착지 직전에 누른 점프를 기억(초) — 착지 순간 바로 뜀 */
export const JUMP_BUFFER_SEC = 0.15;
/** 슬라이드 최소 유지(초). 버튼을 누르고 있으면 계속, 머리 위 장애물 밑이면 자동 연장 */
export const SLIDE_MIN_SEC = 0.55;

/* ───────── 충돌(관대하게, 사양서 [6]) ───────── */

/** 플레이어 충돌 상자 축소 배수(가운데 기준) — 그림상 '닿았다' 싶을 때만 걸리게 */
export const PLAYER_HIT_W = 0.82;
export const PLAYER_HIT_H = 0.9;
/** 장애물 충돌 상자 축소 배수(가운데 기준) */
export const OBS_HIT = 0.9;
/** 바닥 틈: 발 중심이 틈 안쪽으로 이만큼 들어가야 떨어짐(가장자리 관대) */
export const PIT_EDGE_GRACE = 10;
/** 수집 판정 여유(반지름에 더함) */
export const COLLECT_GRACE = 12;
/** 보호막: 한 번 막으면 사라짐 / 시간이 지나도 사라짐(초) */
export const SHIELD_SEC = 9;
/** 보호막이 막아준 뒤 잠깐 무적(초) */
export const SHIELD_INVULN_SEC = 1.1;

/* ───────── 속도·구간 길이(첫 완주 ≈ 3분, 사양서 [5]) ───────── */

/**
 * (261011 사장 '갈수록 완전 더 어렵게' + '더 갈수록 빨라지게') 속도 = 구간 계단 + 바퀴마다 시작·상한 상승.
 *   v(바퀴, 구간, f) = min(바퀴 상한, v0 + Δ·구간 + Δ·SPEED_KAPPA·f)   f = 구간 안 비율 0~1
 *   → 증가분의 70% 는 구간 경계에서(SPEED_BLEND 거리 동안 부드럽게), 30% 는 구간 안에서 서서히.
 * 바퀴별 [v0, 구간당 Δ, 바퀴 상한]. 6바퀴~ 는 마지막 줄에서 v0 += SPEED_LAP_PLUS(최대 SPEED_V0_MAX), 상한 MAX_SPEED.
 *   1바퀴 450→631(달린 시간 176.4초 = 예전 460→620 연속 곡선 176.0초와 같음 → 첫 완주 ≈ 3분 유지)
 *   2바퀴 570→717(147.3초) · 3바퀴 645→781(132.8초) · 4바퀴 700→813(125.0초) · 5바퀴 730→832(121.0초)
 * (261011 검증 low '바퀴 경계에서 꺾임') 예전엔 다음 여정 시작이 직전 바퀴 끝보다 14~15% 느렸다(631 → 540) → 약 10% 로 줄임(631 → 570).
 *   도착에서 완전히 멈췄다 '다음 여정 시작!' 으로 다시 출발하는 자리라 짧은 숨 고르기(−10%)는 남김 — 같은 자리 비교로는 바퀴마다 +70~+120 빠름.
 * ⚠ 서버 apps/api/src/game/game.constants.ts WR_SPEED_LAPS 등과 **같은 값**(서버가 이 곡선으로 '진행 ↔ 달린 시간' 창을 계산한다).
 *   바꾸면 같이 배포 — 엇갈리면 정직한 판이 시간 창 검사에서 거절된다.
 */
export const SPEED_LAPS: ReadonlyArray<readonly [number, number, number]> = [
  [450, 16, 640],
  [570, 13, 720],
  [645, 12, 790],
  [700, 10, 830],
  [730, 9, 860],
];
export const SPEED_KAPPA = 0.3;
export const SPEED_LAP_PLUS = 10;
export const SPEED_V0_MAX = 760;
/** 속도 상한(어떤 경우에도) — 최소 시야 650 에서도 정적 장애물이 0.76초 보임(반응 0.25 + 이륙 0.2 보다 넉넉) */
export const MAX_SPEED = 860;
/** 구간 경계 속도 계단을 이 거리(설계 좌표) 동안 smoothstep 으로(경계 안전 구간 안에서 끝남, 시간 영향 < 0.02초/경계) */
export const SPEED_BLEND = 300;
/** 첫 완주 목표 시간(초) — LAP_LEN 의 근거(지금은 SPEED_LAPS 1바퀴가 176.4초로 맞춤) */
export const FIRST_CLEAR_SEC = 176;
/** 12구간 상대 길이(1=평균). 합으로 나눠 쓴다 */
export const SEGMENT_WEIGHTS: readonly number[] = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
/**
 * 한 바퀴 길이 = 94,341(예전 460→620 곡선을 176초에 달리는 거리 — 그대로 둔다).
 * ⚠ 서버 game.constants.ts WR_LAP_LEN 과 같은 값. 서버 진행·시간·점수 상한이 이 값과 SPEED_LAPS·점수 규칙으로 계산된다.
 */
export const LAP_LEN = 94_341;
/** 게임 시작·다음 여정 출발 때 0 → 목표 속도까지 걸리는 시간 */
export const START_ACCEL_SEC = 0.6;

/* ───────── 단계·이벤트 위치(구간 번호 0~11 + 구간 안 비율 0~1) ───────── */

export type CoursePoint = { seg: number; f: number };

/**
 * 캐릭터 5단계 전환 위치(첫 바퀴). 사양서 [4] '첫 변화는 시작 후 약 15~20초' → 2단계 = 종로 8% 지점 ≈ 18.6초.
 * 이후 ≈ 72초(드레스 매장) · ≈ 101초(플래너 상담, 신랑 합류) · ≈ 129초(하객 웨딩홀, 손잡기).
 */
export const STAGE_AT: readonly CoursePoint[] = [
  { seg: 0, f: 0 },
  { seg: 1, f: 0.08 },
  { seg: 4, f: 0.35 },
  { seg: 6, f: 0.3 },
  { seg: 8, f: 0.25 },
];
/** 이벤트(바퀴마다 반복): 웨딩 촬영(빈 웨딩홀) · 하객 응원 보호막(하객 웨딩홀) · 신혼여행 출발(비행기 구간 입구) */
export const PHOTO_AT: CoursePoint = { seg: 7, f: 0.4 };
export const SHIELD_AT: CoursePoint = { seg: 8, f: 0.72 };
export const HONEYMOON_AT: CoursePoint = { seg: 9, f: 0.03 };
/** 신혼집 '보여요!' 알림은 도착 이만큼(초) 전 */
export const HOME_NOTICE_SEC = 2.6;
/**
 * 첫 판 조작 안내: 1단계 문구('결혼 준비, 출발!')를 먼저 보여 주고 이만큼(초) 뒤에 '점프!' 안내.
 * 첫 연습 장애물은 출발점에서 이만큼 앞(출발 가속 0.6초 + 460/초 → ≈ 4.1초에 만남 → 안내 뒤 ≈ 2.7초 여유).
 * (261011 검증 low: 안내를 같은 틱에 보내 1단계 문구가 첫 판엔 한 번도 안 보였다)
 */
export const TUTORIAL_INTRO_SEC = 1.4;
export const TUTORIAL_FIRST_AT = 1800;
/**
 * HUD 구간 이름은 그 구간 배경·발판 그림이 준비된 뒤 알림 — 이보다 오래(초) 안 오면 그냥 알림(받기 포기면 바로).
 * (261011 검증 E2: 예전 15초는 구간이 바뀔 때마다 0 으로 돌아가 15초보다 짧은 구간(뒤쪽은 12~14초)에선 영영 안 알렸다 → 4초 + 기다림 이어 세기)
 * 같은 시간이 지나면 코스 생성기도 '받은 그림으로 대체'로 넘어간다(장애물이 하트로만 바뀌지 않게).
 */
export const SEG_NOTICE_WAIT_SEC = 4;
/**
 * 그림 받기 시간 제한(ms)·Phaser 자체 재시도 횟수 — 응답 없는 그림 하나가 로더 전체를 막지 않게(E2).
 * (261011 검증 high) XHR timeout 은 '멈춤'이 아니라 '총 받기 시간'이라 8초는 느린 망(≈1.6Mbps 아래)에서 큰 그림을 끝까지 못 받게 했다
 *  → 멈춤은 LOADER_STALL_MS(응답·받은 양이 이만큼 안 늘면 끊고 다시 — scene.ts startStallWatch)로 따로 보고,
 *    총 시간 제한은 마지막 안전망으로만 넉넉히 60초. 동시 받기 6개(LOADER_PARALLEL — 기본 32 는 첫 묶음 1.5MB 를 32갈래로 나눠 전부 늦어짐).
 */
export const LOADER_TIMEOUT_MS = 60_000;
export const LOADER_STALL_MS = 12_000;
export const LOADER_MAX_RETRIES = 1;
export const LOADER_PARALLEL = 6;
/**
 * 받기 실패(재시도 다 쓴 loaderror) 이만큼이면 그 파일은 '잠시 포기' → 대체 그림(구간 장애물·HUD 이름은 기다리지 않음).
 * (261011 검증 high) 예전엔 그 세션 내내 영구 포기라 잠깐 느렸던 캐릭터 그림이 끝까지 검은 점이었다 → LOADER_BACKOFF_SEC 뒤 다시(두 배씩, 최대 60초),
 * 구간이 바뀔 때·새 판에는 바로 다시.
 */
export const LOADER_GIVE_UP = 2;
export const LOADER_BACKOFF_SEC = 8;
export const LOADER_BACKOFF_MAX_SEC = 60;
/** 창 안의 빠진 그림(캐릭터·신랑 포함)을 이 간격(초)으로 다시 요청(구간이 바뀔 때만 요청하던 것 보강) */
export const LOADER_RETRY_SEC = 2.5;

/** 장애물 없는 '안전 구간'(초, 해당 지점 기준 앞·뒤) — 전환 중 불가피한 충돌 금지(사양서 [5]) */
export const QUIET = {
  start: 2.2, // 출발 직후
  segment: [0.6, 1.4] as const, // 구간 경계(배경 교차 전환) — (261011 사장 맵 제목) 뒤 1.0 → 1.4초: 제목이 뜨는 동안 장애물 없음
  stage: [0.7, 1.5] as const, // 단계 전환 연출
  groom: [0.7, 2.6] as const, // 신랑 뛰어 들어옴
  photo: [0.9, 2.0] as const, // 웨딩 촬영 포즈
  shield: [0.5, 0.9] as const,
  honeymoon: [0.6, 1.5] as const,
  arrive: 3.2, // 신혼집 앞 마지막 직선
  nextJourney: 2.4, // 다음 여정 출발 직후
};

/**
 * (261011 사장 '맵이 바뀔 때마다 어떤 맵인지 페이드인되는 제목' — 제목이 떠 있는 동안 장애물 간격 여유)
 * 구간 경계 통과 뒤 from~to 초 = '가벼운 구간': 간격 × gapMul, 바닥 틈·기믹 시작 금지(나는 장애물은 허용).
 * 기믹은 경계 앞 GIMMICK_TITLE_GUARD[0] ~ 뒤 [1] 초 안에 예고·접촉이 걸리지 않게 민다(공정성 규칙 1).
 */
export const LIGHT_ZONE = { from: 1.4, to: 2.6, gapMul: 1.35 };
export const GIMMICK_TITLE_GUARD: readonly [number, number] = [0.6, 2.6];
/** 맵 제목: 구간 그림이 이보다 늦게(초) 준비되면 제목은 생략(촘촘한 구간 한가운데에 뜨지 않게) — HUD 이름만 바꿈 */
export const MAP_TITLE_LATE_SEC = 0.8;
/**
 * 맵 제목 12개(번호 · 이름 + 한 줄) — 화면 위쪽 가운데에 0.35초 페이드인 → 1.5초 → 0.45초 페이드아웃.
 * 2바퀴~ 서울은 따로 띄우지 않고 '다음 여정' 큰 문구 아랫줄로 합친다(설계 §2.1).
 */
export const SEG_TITLES: ReadonlyArray<{ no: string; line: string }> = [
  { no: '01', line: 'D-100, 결혼 준비 출발!' },
  { no: '02', line: '커피는 식기 전에, 예물은 놓치기 전에' },
  { no: '03', line: '전하, 웨딩 촬영 납시오!' },
  { no: '04', line: '오늘의 날씨: 시어머니발 벼락' },
  { no: '05', line: '이 드레스, 저 드레스… 다 예뻐!' },
  { no: '06', line: '혼수 가전 대방출, 감전 주의!' },
  { no: '07', line: '계약서는 꼼꼼히, 발은 빠르게' },
  { no: '08', line: '아무도 없을 때 입장 리허설' },
  { no: '09', line: '박수 소리에 맞춰 입장!' },
  { no: '10', line: '좌석벨트 매세요, 난기류 구간입니다' },
  { no: '11', line: '파도도 우리 편, 발리 직진!' },
  { no: '12', line: '집 앞까지 딱 한 걸음!' },
];

/* ───────── 연출 시간 ───────── */
export const STAGE_FX_SEC = 0.5; // 단계 전환 '팡' + celebrate 포즈
export const GROOM_RUN_SEC = 1.5; // 신랑이 왼쪽 밖에서 뛰어 들어오는 시간
export const PHOTO_SEC = 1.0; // 웨딩 촬영(느려짐 + 포즈 + 플래시 2번)
export const PHOTO_SLOW = 0.35; // 촬영 중 속도 배수
export const ARRIVE_STOP_SEC = 0.7; // 신혼집 앞에서 서서히 멈춤
export const ARRIVE_HOLD_SEC = 2.4; // 불 켜짐·환호 유지
export const NEXT_FADE_SEC = 0.45; // 다음 여정 하얀 전환(반쪽)
export const STUMBLE_SEC = 0.95; // 넘어짐 연출 뒤 gameover

/* ───────── 장애물 간격·난이도(사양서 [6]) ───────── */

/**
 * 간격 계산(설계 좌표, 앞 장애물 가운데 → 다음 장애물 가운데):
 *   점프 다음 = 앞 장애물 통과 시간 + 체공 전체(가장 늦게 뛰어도 착지) + 반응 여유 + 다음 장애물 도착 시간
 *   슬라이드 다음 점프 = 통과 + 반응 여유 + 이륙 시간(높이별) …  → planner.ts minGap()
 *
 * (261011 사장 '갈수록 완전 더 어렵게, 기믹도 많이') 밀도는 구간 단위 계단 — 진행도
 *   Lv = (바퀴−1) + (구간 + 0.35·f)/12  (구간 경계에서 65% 오름)
 *   diff = clamp(Lv/2, 0, 1), over = clamp((Lv−2)/2, 0, 1)   → course.ts level()
 *   값 = a − b·diff − c·over  (아래 [a, b, c])
 *   반응 여유 0.42→0.16초(바닥 0.16 = 착지 후 ≈10프레임, minGap 은 '가장 늦게 뛴 착지 + 여유'라 그래도 물리적으로 반드시 가능)
 *   무작위 배수 상한 1.9→1.08 · 숨 거리 240→40 · 바닥 틈 확률 0.07→0.18
 * 예고 시간은 바퀴가 올라가도 줄이지 않는다(공정) — 어려움은 속도·밀도·겹침으로만.
 */
export const DENSITY = {
  pad: [0.42, 0.22, 0.04] as const,
  gapMul: [1.9, 0.75, 0.07] as const,
  breath: [240, 170, 30] as const,
  pit: [0.07, 0.08, 0.03] as const,
  /** 움직임 배수 = MOVE_MUL(diff) + moveOver·over */
  moveOver: 0.1,
};
/** 가끔 길게 쉬는 구간(하트 줄) 확률 — 바퀴별(1·2·3·4바퀴~) · 길이(초) */
export const REST_CHANCE_BY_LAP: readonly number[] = [0.12, 0.08, 0.05, 0.03];
export const REST_SEC: readonly [number, number] = [1.2, 2.0];
/**
 * '콤보 묶음' = 최소 간격(배수 1.0·숨 0)으로 연속 붙는 장애물 묶음 — 바퀴별 [시작 확률, 최대 개수]. 점수 배수는 없다(서버 상한 구조 유지).
 */
export const COMBO_BY_LAP: ReadonlyArray<readonly [number, number]> = [
  [0.08, 2],
  [0.18, 3],
  [0.28, 4],
  [0.36, 5],
];
/** 바닥 틈: 첫 바퀴 3번째 구간(경복궁)부터, 폭은 속도·체공으로 계산 */
export const PIT_FROM_SEG = 2;
/** 틈 폭 = 속도 × 체공 × 이 비율(넉넉히 넘게) */
export const PIT_W_RATIO: readonly [number, number] = [0.32, 0.46];
/** 종류별 등장 가중치(난이도 0 → 1). 초반엔 지상 위주, 뒤로 갈수록 움직이는·공중 장애물 */
export const KIND_WEIGHT = {
  ground: [1, 1] as const,
  'moving-ground': [0.35, 0.95] as const,
  flying: [0.3, 0.85] as const,
  air: [0.8, 1] as const,
};
/** 움직이는·나는 장애물 속도 배수(난이도 0 → 1) — 각 장애물 기본 속도(OBSTACLE_TUNING.move)에 곱함 */
export const MOVE_MUL: readonly [number, number] = [0.8, 1.2];
/** 나는 장애물 위아래 흔들림(CHAR_H 배수·초당 횟수) — 충돌 아래끝 0.7±0.045 → 슬라이드(위끝 ≤0.54)는 항상 통과, 달리기(≥0.86)는 항상 걸림 */
export const FLY_BOB_AMP = 0.045;
export const FLY_BOB_HZ = 1.3;

/**
 * 장애물별 조정(assets.ts 의 kind·hitbox 는 그대로 쓰고, 게임 감각만 여기서):
 *  · move = 플레이어 쪽으로 다가오는 자체 속도(현재 땅 속도 대비). 0/없음 = 제자리
 *  · flip = 그림을 좌우 반전해 신부 쪽을 보게(원본은 모두 오른쪽을 봄). 글자가 있을 수 있는 물건은 반전 안 함
 */
export const OBSTACLE_TUNING: Record<string, { move?: number; flip?: boolean }> = {
  couple_selfie: { flip: true },
  couple_photographer: { flip: true },
  couple_phone_pose: { flip: true },
  pigeon: { move: 0.22, flip: true },
  iced_americano: {},
  running_children: { move: 0.2, flip: true },
  hanbok_tourists: { flip: true },
  royal_procession: { move: 0.08, flip: true },
  haetae_statue: { flip: true },
  scolding_mother: { flip: true },
  nagging_father: { flip: true },
  dress_mannequin: {},
  dress_rack: {},
  bespoke_washer: {},
  lg_stanbyme: { move: 0.12, flip: true },
  flying_dyson: { move: 0.2, flip: true },
  wedding_album: {},
  contract_stack: {},
  fabric_samples: {},
  floral_arch: {},
  guest_chair: {},
  flower_pedestal: {},
  clapping_guests: { flip: true },
  wedding_photographer: { flip: true },
  service_cart: { move: 0.14, flip: true },
  travel_luggage: {},
  playful_monkey: { move: 0.24, flip: true },
  surfboard: {},
  beach_umbrella: {},
  moving_boxes: {},
  robot_vacuum: { move: 0.12, flip: true },
  home_cat: { move: 0.24, flip: true },
};

/* ───────── 점수(사양서 [9] — 이동 거리 + 수집 아이템) ───────── */

/** 달린 거리 25 = 1점 */
export const DIST_PER_POINT = 25;
/** 하트는 작게(+5) 자주 — 예산 안에서 초당 2개 이상 놓을 수 있게 */
export const HEART_VALUE = 5;
export const ENVELOPE_VALUE = 30;
export const PHOTO_BONUS = 100;
export const ARRIVE_BONUS = 500;
/**
 * 수집물 예산: 길에 놓는 하트·봉투의 누적 점수 ≤ (그 지점까지 거리 점수) × 이 비율.
 * 놓는 순간 차감(못 먹어도 차감) → 어떤 플레이로도 '수집 점수 ≤ 거리 점수 × 0.7'.
 */
export const COLLECT_RATIO = 0.7;

/**
 * 서버 검증용 이론 최대 초당 점수 — apps/api/src/game/game.constants.ts WR_MAX_SCORE_PER_SEC 와 **같은 값(70)**.
 * (261011 사장 '더 갈수록 빨라지게' — 속도 상한 720 → 860 이라 60 → 70, 엔진·서버 같이)
 * 근거(엔진이 강제하는 상한, 판 전체 어느 시점에서도 성립):
 *   거리 점수 ≤ MAX_SPEED / DIST_PER_POINT                  = 860 / 25            = 34.4 /초
 *   수집물   ≤ 거리 점수 × COLLECT_RATIO                     = 34.4 × 0.7          = 24.08 /초
 *   도착·촬영 ≤ (500 + 100) / (가장 빠른 바퀴 ≈ 116.5초)                            ≈ 5.15 /초
 *   합계 ≈ 63.6 → 70. 엔진도 점수를 (달린 초 × 70) 으로 한 번 더 자른다(서버 거절 0 보장).
 * 기믹 보너스·콤보 배수는 없다 — 점수원은 거리·하트·봉투·촬영·도착 그대로(서버식 구조 유지).
 * 하트(+5)·봉투(+30)는 모두 1점 이상 → 서버의 '수집 개수 ≤ 점수' 대조와 맞음.
 */
export const WR_MAX_SCORE_PER_SEC = 70;

/* ───────── 2단 점프(261011 사장 '가전제품 바닥 전기 — 공중에서 점프 한 번 더') ───────── */

/**
 * 점프 버튼(또는 Space·↑)을 공중에서 다시 누르면 2단 점프 — 진짜 점프(땅에서 뜀) 뒤에만 1회, 착지하면 다시 1회.
 *  · 초속 = min(DJUMP_V, √(2·g2·(DJUMP_PEAK_MAX − 지금 높이)))  g2 = 중력 × DJUMP_G_MUL(착지까지 살짝 '붕')
 *  · 이륙 DJUMP_MIN_AIR 뒤부터(손가락 '톡톡'도 2단으로 인정)
 *  · 안전한 땅에 DJUMP_LAND_BUFFER(0.15) 안에 내릴 때 누르면 2단 대신 기존 '착지 즉시 점프'(발밑이 전기·틈이면 2단)
 *  · 계산한 초속이 지금 오르는 속도보다 작으면 DJUMP_DEFER 까지 기다렸다 적용(누름 낭비 없음)
 * 근거(scratchpad phys.js): 2단을 이륙 0.2초 뒤 ~ 착지 직전에 누르면 발이 7 위에 0.94~1.36초 → 바닥 전기(0.78초)를 반드시 넘음.
 *   1단은 0.681초라 0.099초 모자라 어떤 박자로도 못 넘음('2단 점프로만').
 * 1바퀴 가전 매장 연습 전에는 잠금(우발 2단 방지), 연습 뒤·2바퀴~·같은 페이지 다음 판은 모든 장애물에서 사용 가능.
 */
export const DJUMP_V = 600;
export const DJUMP_G_MUL = 0.8;
export const DJUMP_PEAK_MAX = 190;
export const DJUMP_MIN_AIR = 0.06;
/**
 * (261011 검증 medium) 착지 0.10~0.15초 전 누름은 예전처럼 '착지 즉시 점프'(JUMP_BUFFER_SEC 와 같은 0.15) — 0.1 이면 이 박자가 낮은 2단 점프가 돼
 * 바닥 전기 직전에 미리 누르는 습관이면 2단을 써 버리고 띠 위에 내렸다. 발밑이 전기·틈이면 그대로 2단.
 */
export const DJUMP_LAND_BUFFER = JUMP_BUFFER_SEC;
export const DJUMP_DEFER = 0.25;
/** 발 높이가 이 위면 왼쪽 위 구간 알약을 흐리게(머리가 그 아래로 지나감), 아래로 내려오면 되돌림 */
export const HUD_DIM_FEET: readonly [number, number] = [140, 120];

/* ───────── 기믹(261011 사장 '기믹도 많이' — 지정 3 + 추가 15, 모두 예고 신호) ───────── */

/**
 * 공정성 불변식(설계 §5): 모든 기믹은 접촉 0.9초 이상 전에 예고(소리 + 화면 신호, 화면 밖이면 오른쪽 끝 경고 아이콘),
 * 움직이는 기믹은 마지막 0.6초 등속, 회피 창 ≥ 0.25초. 바퀴가 올라가도 예고는 줄이지 않는다.
 * 값은 기믹별 시간(초)·배수 — 설계표(§6) 그대로.
 */
export const GIMMICK_TUNING = {
  /** 기믹마다 접촉 전 예고 시작(초) */
  warn: {
    'mil-bolt': 1.4,
    'zap-floor': 1.2,
    blackout: 0.6,
    'nag-barrage': 1.1,
    'pigeon-dive': 1.5,
    'kid-rush': 1.1,
    'royal-triple': 1.2,
    'rack-slide': 1.2,
    'dryer-wind': 1.0,
    'paper-rain': 1.3,
    'photo-flash': 1.6,
    turbulence: 1.2,
    'monkey-hop': 1.3,
    'surf-wave': 1.0,
    'robo-zigzag': 1.0,
    'cat-pounce': 1.4,
    'clap-rhythm': 1.2,
    'arch-tunnel': 1.0,
  } as Record<string, number>,
  /** 번개: 접촉 이만큼 전 내리꽂힘(그 전엔 땅 표시만) · 번개 아래끝 높이 */
  boltStrike: 0.45,
  boltBottom: 84,
  /** 바닥 전기 충돌 길이 = round(zapK·v − zapPlayerW) → 띠 위를 지나는 시간 0.78초(속도 무관) */
  zapK: 0.78,
  zapPlayerW: 72,
  zapTop: 18,
  /** 2단 점프 가장 늦은 착지(띠 끝 뒤 초) — 다음 장애물 간격에 쓴다 */
  zapLandAfter: 0.62,
  /** 정전: 깜빡 예고(초)·캄캄(초, 3바퀴~ 길게)·켜질 때 깜빡(초)·덮개 진하기 */
  blackoutPre: 0.6,
  blackoutDur: [2.4, 2.8] as const,
  blackoutPost: 0.3,
  blackoutAlpha: 0.9,
  /** 바닥 전기 뒤 정전까지(초) */
  blackoutAfterZap: 0.9,
  /** 사진사 플래시: 접촉 이만큼 전 0.4초 흰 덮개 */
  flashAt: 0.9,
  flashDur: 0.4,
  flashAlpha: 0.75,
  /** 난기류 흔들림(초·세기) */
  turbSec: 2.5,
  turbIntensity: 0.0045,
  /** 바람 구역(초, 3바퀴~ 길게)·중력 배수(체공 0.897·꼭대기 174) */
  windSec: [2.0, 2.6] as const,
  windG: 0.78,
  /** 다가오는 배수(땅 속도 대비) */
  kidMove: [0.55, 0.7] as const,
  rackMove: 0.45,
  bubbleMove: 0.3,
  cartMove: 0.35,
  catMove: 0.35,
  surfMove: 0.15,
  roboMove: [0.05, 0.4, 0.2] as const,
  /** 비둘기 급강하: 출발 높이 · 머리 높이 도착(접촉 전 초) · 급강하 시간 */
  diveFrom: 230,
  diveLevelAt: 0.55,
  diveSec: 0.5,
  /** 간격(물리 거리): 잔소리 말풍선 · 쌍번개 · 꽃 아치 */
  bubbleGap: 90,
  boltPairGap: 110,
  archGap: 170,
};

/** 맵 시작 기믹 첫 등장 안내(캔버스 말풍선) — 판마다 그 기믹 첫 번째에만 */
export const GIMMICK_HINT: Record<string, string> = {
  'mil-bolt': '번개는 슬라이드!',
  'zap-floor': '공중에서 한 번 더!',
  'nag-barrage': '계속 슬라이드!',
  'pigeon-dive': '슬라이드!',
  'kid-rush': '점프!',
  'royal-triple': '둥! 점프 3번',
  'rack-slide': '점프!',
  'dryer-wind': '바람 속 점프는 높게!',
  'paper-rain': '점프!',
  'photo-flash': '눈부셔도 점프!',
  turbulence: '흔들려도 점프!',
  'monkey-hop': '점프!',
  'surf-wave': '파도는 슬라이드!',
  'robo-zigzag': '점프!',
  'cat-pounce': '점프!',
  'clap-rhythm': '박자 맞춰!',
  'arch-tunnel': '계속 슬라이드!',
};

/** 기믹 첫 등장 알림(화면 이벤트 문구) — 판마다 한 번 */
export const GIMMICK_TEXT: Record<string, string> = {
  'mil-bolt': '시어머니의 벼락! 슬라이드로 피해요',
  'zap-floor': '바닥 전기! 2단 점프로만 넘어요',
  blackout: '정전! 보이는 것만 보고 달려요',
  'nag-barrage': '아버지 잔소리 탄막! 계속 숙여요',
  'pigeon-dive': '비둘기 급강하! 슬라이드',
  'kid-rush': '아이들이 우다다 달려와요!',
  'royal-triple': '왕의 행렬! 북소리에 맞춰 점프 3번',
  'rack-slide': '드레스 행거가 미끄러져 와요!',
  'dryer-wind': '드라이어 바람! 점프가 높아져요',
  'paper-rain': '계약서 서류 비! 떨어진 더미는 점프',
  'photo-flash': '찰칵! 플래시가 터져요',
  turbulence: '난기류! 카트가 밀려와요',
  'monkey-hop': '원숭이가 깡충깡충!',
  'surf-wave': '서핑보드 파도! 슬라이드면 안전',
  'robo-zigzag': '로봇청소기 지그재그!',
  'cat-pounce': '고양이 기습 점프!',
  'clap-rhythm': '박수 리듬! 점프·슬라이드·점프',
  'arch-tunnel': '꽃 아치 터널! 쭉 슬라이드',
};

/* ───────── 문구(사양서 [4][10] — '진화' 대신 '준비 완료'·'다음 여정') ───────── */

export const STAGE_TEXT: readonly string[] = [
  '결혼 준비, 출발!',
  '부케 장착!',
  '본식 준비 완료!',
  '신랑 합류! 이제 같이 준비해♥',
  '신혼집까지 함께!',
];

export const EVENT_TEXT = {
  bouquet: '부케 장착!',
  ceremony: '본식 준비 완료!',
  groom: '신랑이 달려와요!',
  photo: '웨딩 촬영! 찰칵',
  shield: '하객 응원! 보호막이 한 번 지켜줘요',
  shieldBlock: '보호막이 지켜줬어요!',
  honeymoon: '신혼여행 출발! 발리로 슝',
  homeNotice: '저기 우리 신혼집이 보여요!',
  arrive: '우리 신혼집 입주 완료!',
  nextJourney: '우리의 다음 여정 시작!',
  tutorialJumpTouch: '오른쪽 아래 버튼으로 점프!',
  tutorialJumpKey: 'Space 또는 ↑ 로 점프!',
  tutorialSlideTouch: '머리 위는 왼쪽 아래 버튼으로 슬라이드!',
  tutorialSlideKey: '머리 위는 ↓ 로 슬라이드!',
  tutorialRetry: '괜찮아요! 연습이에요, 한 번 더!',
  tutorialDone: '좋아요! 신혼집까지 달려요!',
  // (261011 사장 '2단 점프 — 이 기믹 첫 등장 전 '공중에서 한 번 더!' 안내 + 연습 1회')
  djTutorialTouch: '점프 버튼을 공중에서 한 번 더! 2단 점프',
  djTutorialKey: 'Space·↑ 를 공중에서 한 번 더! 2단 점프',
  djRetry: '괜찮아요! 뛰고 나서 공중에서 한 번 더!',
  djDone: '좋아요! 이제 진짜 전기예요',
};

/** 조작 안내 말풍선(캔버스 안, 연습 장애물 위) */
export const HINT_TEXT = { jump: '점프!', slide: '슬라이드!' };

/* ───────── 성능 ───────── */

/** 캔버스 해상도 배율 상한(기기 픽셀 비율과 이것 중 작은 값) */
export const MAX_RESOLUTION = 2;
/** 저사양: 평균 프레임이 이 fps 아래로 3초 이상이면 해상도 배율을 한 단계씩 내림(최저 1) */
export const LOW_FPS = 48;
export const RES_STEP = 0.25;
export const MIN_RESOLUTION = 1;
/** 물리·충돌 한 걸음 최대 길이(초) — 프레임이 길어도 통과 판정 누락 없게 쪼갬 */
export const MAX_SUBSTEP = 1 / 120;
/** 한 프레임 최대 시간(초) — 탭 전환 직후 큰 delta 무시 */
export const MAX_FRAME_DT = 0.05;
/** 앞쪽 장애물을 미리 만들어 두는 거리(화면 오른쪽 밖 여유) */
export const SPAWN_MARGIN = 160;
/** 텍스처 메모리: 0·1구간(재도전 즉시 출발용)은 항상, 나머지는 현재-1 ~ 현재+2 구간만 올려 둠 */
export const KEEP_SEGMENTS_BEHIND = 1;
export const PRELOAD_SEGMENTS_AHEAD = 2;
