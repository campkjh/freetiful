#!/usr/bin/env node
// 웨딩런 2D 러너 에셋 최적화 + 매니페스트 생성기 (261011 사장 요청 — 첨부 이미지 실제 사용)
//
// 하는 일
//  1) 사장 첨부 원본 PNG(119장, 181.5MB)를 읽어 투명 여백을 잘라내고(trim) 게임 해상도로 줄여 WebP(알파 유지)로 저장
//     → apps/web/public/wedding-run/{bg,platform,char,obs,ui}/… , entry.webp
//  2) 모션 프레임은 같은 단계 안에서 한 캔버스·같은 피벗으로 맞춤(흔들림 방지)
//     - 세로: 발바닥(가장 아래 불투명 행) 정렬 / 가로: 알파 마스크 겹침이 최대가 되는 위치(상관 정렬)
//     - 장애물 여러 프레임도 같은 방식(날아다니는 것은 가로·세로 모두 상관 정렬)
//  3) 충돌 상자 = 알파≥128(반투명 빛 효과 제외) 마스크의 분위수(quantile) 상자 → 몸통 중심만 남겨 약간 관대하게
//  4) 발판 topY = 열마다 첫 불투명 행의 중앙값, solidX0/X1 = 윗면이 topY 근처인 열의 좌우 끝(둥근 모서리 제외)
//  5) apps/web/src/app/wedding-run/assets.ts(코드용 매니페스트)를 새로 씀 — 손으로 고치지 말고 이 스크립트를 다시 돌릴 것
//
// 실행
//   node apps/web/scripts/wedding-run-assets.mjs --src <원본 풀어 둔 폴더> [--debug-json <경로>]
//   원본: ~/Downloads/freetiful-wedding-{backgrounds,platforms,bride-motions,obstacles,entry,ui}.zip 을 한 폴더에 풀면
//         <src>/freetiful-wedding-backgrounds/wedding-run-backgrounds/… 구조가 됨
//   (환경변수 WR_SRC 로도 지정 가능)
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
sharp.concurrency(4);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '..');
const OUT_PUBLIC = path.join(WEB, 'public/wedding-run');
const OUT_TS = path.join(WEB, 'src/app/wedding-run/assets.ts');
const URL_BASE = '/wedding-run';

const argv = process.argv.slice(2);
const argOf = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const SRC = argOf('--src') || process.env.WR_SRC;
const DEBUG_JSON = argOf('--debug-json');
if (!SRC || !fs.existsSync(SRC)) {
  console.error('원본 폴더를 --src 로 지정하세요 (zip 6개를 한 폴더에 푼 경로). 지금 값:', SRC);
  process.exit(1);
}
const P = {
  bg: path.join(SRC, 'freetiful-wedding-backgrounds/wedding-run-backgrounds'),
  platform: path.join(SRC, 'freetiful-wedding-platforms/wedding-run-platforms'),
  char: path.join(SRC, 'freetiful-wedding-bride-motions/wedding-run-bride-motions'),
  obs: path.join(SRC, 'freetiful-wedding-obstacles/wedding-run-obstacles'),
  entry: path.join(SRC, 'freetiful-wedding-entry/wedding-run-entry'),
  ui: path.join(SRC, 'freetiful-wedding-ui/wedding-run-ui'),
};

// ───────────────────────── 조정값 ─────────────────────────
const WEBP_ALPHA = { quality: 82, alphaQuality: 90, effort: 6, smartSubsample: true };
const WEBP_OPAQUE = { quality: 80, effort: 6, smartSubsample: true };
const BG_MAX_BYTES = 400 * 1024; // 배경 한 장 상한(넘으면 품질→해상도 순으로 낮춤)
const CHAR_SCALE = 0.45; // 캐릭터 원본→게임 배율(달리기 몸 높이 ≈ 400px — 폰 DPR3·PC DPR2 모두 선명)
const OBS_PX_PER_HINT = 480; // 장애물 캔버스 높이 = scaleHint × 480 (캐릭터 refH 와 같은 밀도)
// 머리 위(air/flying) 장애물: 충돌 상자 아래 끝이 땅에서 캐릭터 refH × AIR_CLEARANCE 높이에 오도록
//  - 달리기 충돌 상자 위끝(≈0.9) 보다 낮고, 슬라이드(slideScale 적용) 위끝보다 높게
const AIR_CLEARANCE = 0.7;
const SLIDE_TOP_TARGET = 0.72; // 슬라이드 그림 위끝이 refH × 이 값 이하가 되도록 slideScale 권장값 산출
const COUPLE_HIT_WIDEN = 1.15; // 4·5단계(커플) 충돌 폭 상한 = 1단계 폭 비율 × 1.15 (사양서 [4] "커플이라고 갑자기 어려워지지 않게")
// 발판 faceY 자동 검출이 무늬(쪽매 사선·얇은 윗테두리)에 속는 3장은 확대 눈금 대조로 정한 값으로 고정(261011)
//  03 경복궁: 윗면 5~22 + 두꺼운 돌판 앞면 / 10 비행기: 남색 카펫 8~40 + 밝은 테 / 12 신혼집: 쪽매 윗면 5~50 + 나무 앞턱
const FACE_Y_FIX = { '03_gyeongbokgung': 22, '10_airplane': 41, '12_newlywed_home': 50 };

// ───────────────────────── 구간·장애물 정의(그림을 보고 판단한 값) ─────────────────────────
// kind: ground=지상(점프로 피함) / air=머리 위에 걸린 것(슬라이드로 피함, 땅에 서 있음) /
//       moving-ground=스스로 움직이는 지상 장애물(점프) / flying=날아다니는 것(슬라이드)
// scaleHint = 장애물 캔버스 높이 ÷ 캐릭터 refH(둘 다 화면 표시 기준). air 는 AIR_CLEARANCE 로 자동 계산.
// hb = 충돌 상자 분위수(가로 qx0~qx1, 세로 qy0~qy1, 알파≥128 픽셀 질량 기준) — 기본값 HB_DEFAULT
const HB_DEFAULT = { qx0: 0.07, qx1: 0.93, qy0: 0.07, qy1: 0.995 };
const SEGMENTS = [
  { id: '01_seoul', name: '서울', obstacles: [
    { key: 'couple_selfie', name: '셀카 찍는 커플', kind: 'ground', scaleHint: 0.7,
      why: '두 사람이 서서 셀카 — 바닥에 서 있는 정적 인물(1장) → 점프', hb: { qx0: 0.1, qx1: 0.9, qy0: 0.1 } },
    { key: 'couple_photographer', name: '사진 찍어 주는 커플', kind: 'ground', scaleHint: 0.64,
      why: '남자가 카메라로 여자를 찍는 장면, 둘 다 서 있음(1장) → 점프. 두 사람 사이 빈 공간은 충돌 상자에 포함(좌우 끝만 깎음)', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.1 } },
    { key: 'couple_phone_pose', name: '폰으로 찍는 커플', kind: 'ground', scaleHint: 0.66,
      why: '여자가 폰으로 남자를 찍음, 둘 다 서 있음(1장) → 점프', hb: { qx0: 0.07, qx1: 0.93, qy0: 0.1 } },
    { key: 'pigeon', name: '비둘기', kind: 'flying', scaleHint: 0.5, fps: 10,
      why: '날개 위·수평·아래 3모션 날갯짓(오른쪽 향함) → 머리 높이로 날아오는 공중 장애물, 슬라이드. 충돌=몸통(날개 끝 제외)', hb: { qx0: 0.22, qx1: 0.88, qy0: 0.22, qy1: 0.86 } },
  ] },
  { id: '02_jongno', name: '종로', obstacles: [
    { key: 'iced_americano', name: '아이스 아메리카노', kind: 'ground', scaleHint: 0.5,
      why: '바닥에 놓인 큰 테이크아웃 컵(1장) → 낮은 지상 장애물, 점프. 빨대는 충돌 제외', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.16 } },
    { key: 'running_children', name: '뛰어다니는 어린이', kind: 'moving-ground', scaleHint: 0.6, fps: 8,
      why: '두 아이가 오른쪽으로 달리는 3모션(03은 공중 깡충) → 움직이는 지상 장애물, 점프. 03은 몸통 겹침으로 세로 정렬(살짝 떠 있음)', hb: { qx0: 0.08, qx1: 0.92, qy0: 0.08 },
      align: { '03': 'corr2d' } },
  ] },
  { id: '03_gyeongbokgung', name: '경복궁', obstacles: [
    { key: 'hanbok_tourists', name: '한복 입은 외국인 관광객', kind: 'ground', scaleHint: 0.7,
      why: '한복 차림 외국인 커플이 서서 셀카(1장) → 점프. 위로 든 폰은 충돌 제외', hb: { qx0: 0.08, qx1: 0.9, qy0: 0.1 } },
    { key: 'royal_procession', name: '왕과 궁녀 행렬', kind: 'moving-ground', scaleHint: 0.58, fps: 6,
      why: '왕+궁녀 둘이 오른쪽으로 걷는 3모션(03=멈춰 손 듦) → 천천히 움직이는 넓은 지상 장애물, 점프', hb: { qx0: 0.05, qx1: 0.95, qy0: 0.12 } },
    { key: 'haetae_statue', name: '해태 석상', kind: 'ground', scaleHint: 0.6,
      why: '받침돌 위 해태 석상(1장) → 정적 지상 장애물, 점프', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.1 } },
  ] },
  { id: '04_family_meeting', name: '상견례', obstacles: [
    { key: 'scolding_mother', name: '호통치는 시어머니', kind: 'ground', scaleHint: 0.74, fps: 3,
      why: '제자리에서 허리 짚기↔손가락질 2포즈(이동 없음) → 정적 지상(포즈만 바뀜), 점프. 뻗은 팔은 충돌 제외', hb: { qx0: 0.12, qx1: 0.86, qy0: 0.08 } },
    { key: 'nagging_father', name: '잔소리하는 아버지', kind: 'ground', scaleHint: 0.74, fps: 3,
      why: '제자리에서 손 들고 잔소리↔팔짱 2포즈(이동 없음) → 정적 지상(포즈만 바뀜), 점프', hb: { qx0: 0.12, qx1: 0.88, qy0: 0.08 } },
  ] },
  { id: '05_bridal_boutique', name: '드레스 매장', obstacles: [
    { key: 'dress_mannequin', name: '드레스 마네킹', kind: 'ground', scaleHint: 0.72,
      why: '금색 받침의 드레스 마네킹(1장) → 정적 지상, 점프. 위쪽 목 기둥은 충돌 제외', hb: { qx0: 0.1, qx1: 0.9, qy0: 0.12 } },
    { key: 'dress_rack', name: '드레스 행거', kind: 'ground', scaleHint: 0.62,
      why: '바퀴 달린 금색 행거에 드레스 3벌(1장), 드레스가 바닥 근처까지 내려옴 → 밑으로 못 지나감, 점프', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.1 } },
  ] },
  { id: '06_appliance_store', name: '가전 매장', obstacles: [
    { key: 'bespoke_washer', name: '세탁기', kind: 'ground', scaleHint: 0.58,
      why: '드럼 세탁기(1장) → 정적 지상, 점프', hb: { qx0: 0.05, qx1: 0.95, qy0: 0.05 } },
    { key: 'lg_stanbyme', name: '이동식 TV', kind: 'moving-ground', scaleHint: 0.72,
      why: '바퀴 달린 스탠드형 TV(1장, 사양서 "이동식 TV") — 기둥·받침이 바닥까지 있어 밑으로 못 지나감 → 굴러오는 지상 장애물, 점프(1장이라 애니 없이 이동만)', hb: { qx0: 0.08, qx1: 0.92, qy0: 0.06 } },
    { key: 'flying_dyson', name: '날아다니는 헤어드라이어', kind: 'flying', scaleHint: 0.42, fps: 8,
      why: '수평·위로 20°·아래로 20° 3모션으로 날아옴(오른쪽 향함) → 공중 장애물, 슬라이드', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.12, qy1: 0.9 } },
  ] },
  { id: '07_planner_office', name: '웨딩플래너 상담', obstacles: [
    { key: 'wedding_album', name: '웨딩 앨범', kind: 'ground', scaleHint: 0.46,
      why: '낮은 받침 위 펼친 두꺼운 앨범(1장) → 낮은 지상, 점프', hb: { qx0: 0.05, qx1: 0.95, qy0: 0.1 } },
    { key: 'contract_stack', name: '계약서 더미', kind: 'ground', scaleHint: 0.56,
      why: '세워 둔 계약서 폴더 더미(1장) → 지상, 점프', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.06 } },
    { key: 'fabric_samples', name: '원단 샘플', kind: 'ground', scaleHint: 0.48,
      why: '부채꼴 원단 샘플+줄자 한 덩어리(1장) → 낮은 지상, 점프', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.08 } },
  ] },
  { id: '08_empty_hall', name: '빈 웨딩홀', obstacles: [
    { key: 'floral_arch', name: '꽃 아치', kind: 'air', scaleHint: 0, overhang: true,
      why: '양쪽 기둥+낮은 가로보(manifest: "wide open space underneath for slide") → 가로보만 충돌, 기둥 사이로 슬라이드. 기둥은 통과(플레이어 뒤에 그릴 것)' },
    { key: 'guest_chair', name: '하객 의자', kind: 'ground', scaleHint: 0.56,
      why: '리본 단 하객 의자(1장) → 지상, 점프', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.06 } },
    { key: 'flower_pedestal', name: '꽃 장식대', kind: 'ground', scaleHint: 0.72,
      why: '좁고 높은 금색 꽃 장식대(1장) → 지상, 점프. 위쪽 꽃 덩어리 폭으로 충돌', hb: { qx0: 0.1, qx1: 0.9, qy0: 0.06 } },
  ] },
  { id: '09_guest_hall', name: '하객 웨딩홀', obstacles: [
    { key: 'clapping_guests', name: '박수치는 하객', kind: 'ground', scaleHint: 0.72, fps: 4,
      why: '제자리 하객 둘, 손 벌림↔박수 2모션(이동 없음) → 정적 지상(애니), 점프', hb: { qx0: 0.07, qx1: 0.93, qy0: 0.08 } },
    { key: 'wedding_photographer', name: '촬영하는 사진사', kind: 'ground', scaleHint: 0.68, fps: 2,
      why: '서서 촬영↔쪼그려 촬영 2모션(제자리) → 정적 지상(애니), 점프. 이벤트 "웨딩 촬영" 플래시 연출에 재사용 가능', hb: { qx0: 0.08, qx1: 0.88, qy0: 0.1 } },
  ] },
  { id: '10_airplane', name: '비행기', obstacles: [
    { key: 'service_cart', name: '서비스 카트', kind: 'moving-ground', scaleHint: 0.62,
      why: '바퀴 달린 기내 카트(1장) → 통로를 굴러오는 지상 장애물, 점프. 위 컵은 충돌 제외', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.14 } },
    { key: 'travel_luggage', name: '여행 캐리어', kind: 'ground', scaleHint: 0.56,
      why: '손잡이 뽑은 캐리어(1장) → 정적 지상, 점프. 뽑은 손잡이는 충돌 제외', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.2 } },
  ] },
  { id: '11_bali', name: '발리', obstacles: [
    { key: 'playful_monkey', name: '원숭이', kind: 'moving-ground', scaleHint: 0.46, fps: 8,
      why: '바나나 든 원숭이가 오른쪽으로 뛰는 2모션 → 움직이는 지상, 점프. 꼬리는 충돌 제외', hb: { qx0: 0.22, qx1: 0.92, qy0: 0.1 } },
    { key: 'surfboard', name: '서핑보드', kind: 'ground', scaleHint: 0.72,
      why: '받침에 세운 서핑보드(1장) → 좁고 높은 정적 지상, 점프', hb: { qx0: 0.08, qx1: 0.92, qy0: 0.05 } },
    { key: 'beach_umbrella', name: '파라솔', kind: 'air', scaleHint: 0, overhang: true,
      why: '넓은 짚 파라솔 + 가는 기둥 → 갓(술 포함)만 충돌, 밑으로 슬라이드. 가는 기둥은 통과(플레이어 뒤에 그릴 것)' },
  ] },
  { id: '12_newlywed_home', name: '신혼집', obstacles: [
    { key: 'moving_boxes', name: '이삿짐 상자', kind: 'ground', scaleHint: 0.56,
      why: '상자 3개+담요 더미(1장) → 정적 지상, 점프', hb: { qx0: 0.06, qx1: 0.94, qy0: 0.08 } },
    { key: 'robot_vacuum', name: '로봇청소기', kind: 'moving-ground', scaleHint: 0.24, fps: 6,
      why: '바닥을 오른쪽으로 움직이는 납작한 로봇청소기 2모션(02=먼지 퍽) → 움직이는 낮은 지상, 점프. 먼지 구름은 충돌 제외', hb: { qx0: 0.1, qx1: 0.96, qy0: 0.08 } },
    { key: 'home_cat', name: '고양이', kind: 'moving-ground', scaleHint: 0.44, fps: 8,
      why: '오른쪽으로 뛰는 고양이 2모션 → 움직이는 지상, 점프. 꼬리는 충돌 제외', hb: { qx0: 0.26, qx1: 0.94, qy0: 0.12 } },
  ] },
];

// 캐릭터 5단계(사양서 [4]) — 전환 문구는 게임 쪽 설정값에 두고 여기선 표시명만
const CHAR_STAGES = [
  { stage: 1, key: '01_dress', label: '웨딩드레스 신부' },
  { stage: 2, key: '02_bouquet', label: '부케를 든 신부' },
  { stage: 3, key: '03_veil_tiara', label: '부케·베일·티아라 신부' },
  { stage: 4, key: '04_groom_joins', label: '신랑 합류(나란히)', ref: 'run_02', runCycle: ['run_02'],
    // run_01 은 신랑·신부 좌우가 반대 → 가장 큰 덩어리(신부)끼리 겹치게 맞춤(합류 연출 때 신부가 제자리)
    perFrame: { run_01: { mode: 'bottom', largest: true } },
    note: 'run_01 은 신랑이 신부 뒤(왼쪽), run_02·jump·slide 는 신랑이 앞(오른쪽) — 번갈아 쓰면 신랑이 앞뒤로 순간이동하므로 평소 달리기는 run_02 한 장 + 코드 바운스(위아래 2~3%·살짝 기울기). run_01 은 신부 위치만 맞춰 둠(충돌 상자는 신랑이 앞에 있는 run_02 기준이라 충돌이 켜진 동안엔 쓰지 말 것). 합류 연출은 WR_GROOM(신랑만 오려낸 2프레임)' },
  { stage: 5, key: '05_holding_hands', label: '손잡고 함께' },
];
const MOTIONS = ['run_01', 'run_02', 'jump', 'slide', 'stumble', 'celebrate'];
// 충돌 상자 분위수(캐릭터) — 뒤로 날리는 머리·드레스 자락은 빼고(왼쪽 깎음) 앞쪽은 거의 그림 끝까지
const CHAR_HB = {
  run: { qx0: 0.24, qx1: 0.95, qy0: 0.06, qy1: 0.995 },
  jump: { qx0: 0.24, qx1: 0.95, qy0: 0.08, qy1: 0.99 },
  slide: { qx0: 0.2, qx1: 0.96, qy0: 0.18, qy1: 0.995 },
};

const UI_DEF = {
  start: { file: '01_buttons/start.png', width: 640 },
  resume: { file: '01_buttons/resume.png', width: 640 },
  retry: { file: '01_buttons/retry.png', width: 640 },
  ranking: { file: '01_buttons/ranking.png', width: 640 },
  share: { file: '01_buttons/share.png', width: 640 },
  pause: { file: '02_controls/pause.png', width: 240 },
  sound: { file: '02_controls/sound.png', width: 240 },
  sound_off: { file: '02_controls/sound_off.png', width: 240 },
  home: { file: '02_controls/home.png', width: 240 },
  close: { file: '02_controls/close.png', width: 240 },
  jump: { file: '02_controls/jump.png', width: 360 },
  slide: { file: '02_controls/slide.png', width: 360 },
  score_hud: { file: '03_panels/score_hud.png', width: 640, refOnly: true },
  pause_panel: { file: '03_panels/pause_panel.png', height: 800, refOnly: true },
  result_panel: { file: '03_panels/result_panel.png', height: 800, refOnly: true },
  hud_blank: { file: '04_templates/hud_blank.png', width: 720 },
  modal_blank: { file: '04_templates/modal_blank.png', height: 1000 },
};

// ───────────────────────── 이미지 유틸 ─────────────────────────
async function load(p) {
  const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, path: p };
}
const A = (img, x, y) => img.data[(y * img.w + x) * 4 + 3];

function bbox(img, thr) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (A(img, x, y) >= thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1 };
}
// 가장 아래 불투명 행(티끌 무시: 그 행에 알파≥128 픽셀이 minCount 개 이상)
function bottomRow(img) {
  const minCount = Math.max(3, Math.round(img.w * 0.002));
  for (let y = img.h - 1; y >= 0; y--) {
    let n = 0;
    for (let x = 0; x < img.w; x++) if (A(img, x, y) >= 128 && ++n >= minCount) return y;
  }
  return img.h - 1;
}
// 알파≥128 픽셀 비율을 k×k 칸으로 모은 격자 — bb(불투명 범위) 안만, 원점 = bb 왼쪽 위
function coverage(img, k, bb) {
  const W = Math.ceil((bb.x1 - bb.x0 + 1) / k), H = Math.ceil((bb.y1 - bb.y0 + 1) / k);
  const a = new Float32Array(W * H);
  for (let y = bb.y0; y <= bb.y1; y++) {
    const row = (((y - bb.y0) / k) | 0) * W;
    for (let x = bb.x0; x <= bb.x1; x++) if (A(img, x, y) >= 128) a[row + (((x - bb.x0) / k) | 0)] += 1;
  }
  const inv = 1 / (k * k);
  for (let i = 0; i < a.length; i++) a[i] *= inv;
  return { a, W, H, k };
}
// B 를 A 격자 좌표로 (dx,dy) 칸 옮겼을 때 겹침량 Σ min(A,B)
function overlap(CA, CB, dx, dy) {
  let s = 0;
  for (let y = 0; y < CB.H; y++) {
    const ay = y + dy; if (ay < 0 || ay >= CA.H) continue;
    const bo = y * CB.W, ao = ay * CA.W;
    for (let x = 0; x < CB.W; x++) {
      const ax = x + dx; if (ax < 0 || ax >= CA.W) continue;
      const b = CB.a[bo + x]; if (b === 0) continue;
      const av = CA.a[ao + ax]; s += av < b ? av : b;
    }
  }
  return s;
}
// 프레임 정렬: ref 기준으로 img 를 옮길 (ox, oy) — src 픽셀(canvas = src + o).
//  탐색 시작점 = 불투명 범위 가운데 맞춤, 탐색 폭 = 불투명 범위 폭의 ±range. fixedDy 가 있으면 세로 고정(발바닥 정렬)·가로만 탐색
function alignTo(ref, img, fixedDy, range = 0.35, refBB = bbox(ref, 128), imgBB = bbox(img, 128)) {
  const base = { x: refBB.x0 - imgBB.x0, y: refBB.y0 - imgBB.y0 }; // 격자(0,0)끼리 맞추는 원본 offset
  const cx0 = ((refBB.x1 - refBB.x0) - (imgBB.x1 - imgBB.x0)) / 2; // 가운데 맞춤(px)
  const cy0 = fixedDy != null ? fixedDy - base.y : ((refBB.y1 - refBB.y0) - (imgBB.y1 - imgBB.y0)) / 2;
  const span = Math.max(refBB.x1 - refBB.x0, imgBB.x1 - imgBB.x0), spanY = Math.max(refBB.y1 - refBB.y0, imgBB.y1 - imgBB.y0);
  const search = (k, cx, cy, rx, ry, CA, CB) => {
    let best = { s: -1, dx: cx, dy: cy };
    for (let dy = cy - ry; dy <= cy + ry; dy++) for (let dx = cx - rx; dx <= cx + rx; dx++) {
      const sc = overlap(CA, CB, dx, dy); if (sc > best.s) best = { s: sc, dx, dy };
    }
    return best;
  };
  const k1 = 8, b1 = search(k1, R(cx0 / k1), R(cy0 / k1), R(span * range / k1), fixedDy != null ? 0 : R(spanY * range / k1), coverage(ref, k1, refBB), coverage(img, k1, imgBB));
  const k2 = 2, b2 = search(k2, b1.dx * 4, fixedDy != null ? R(cy0 / k2) : b1.dy * 4, 6, fixedDy != null ? 0 : 6, coverage(ref, k2, refBB), coverage(img, k2, imgBB));
  return { ox: base.x + b2.dx * k2, oy: fixedDy != null ? fixedDy : base.y + b2.dy * k2 };
}

// 여러 프레임(각자 offset)을 합친 알파≥128 마스크의 분위수 상자 — 캔버스(src) 좌표
function quantileBox(frames, q, clip) {
  // frames: [{img, ox, oy}] (canvas = src + o), clip: {x0,y0,x1,y1} canvas 좌표(합집합 범위)
  const W = clip.x1 - clip.x0 + 1, H = clip.y1 - clip.y0 + 1;
  const hx = new Float64Array(W), hy = new Float64Array(H);
  const seen = new Uint8Array(W * H);
  for (const f of frames) {
    for (let y = 0; y < f.img.h; y++) {
      const cy = y + f.oy - clip.y0; if (cy < 0 || cy >= H) continue;
      for (let x = 0; x < f.img.w; x++) {
        if (A(f.img, x, y) < 128) continue;
        const cx = x + f.ox - clip.x0; if (cx < 0 || cx >= W) continue;
        const i = cy * W + cx; if (seen[i]) continue; seen[i] = 1; hx[cx]++; hy[cy]++;
      }
    }
  }
  const qpos = (h, t) => { let tot = 0; for (const v of h) tot += v; let c = 0; for (let i = 0; i < h.length; i++) { c += h[i]; if (c >= tot * t) return i; } return h.length - 1; };
  const x0 = qpos(hx, q.qx0), x1 = qpos(hx, q.qx1), y0 = qpos(hy, q.qy0), y1 = qpos(hy, q.qy1 ?? 0.995);
  return { x0: x0 + clip.x0, y0: y0 + clip.y0, x1: x1 + clip.x0, y1: y1 + clip.y0, mask: seen, W, H };
}

// 걸린 장애물(아치·파라솔): 위에서부터 내려오다 처음 투명 틈이 나오는 행 = 그 열의 "처마 아래 끝"
function overhangBox(frames, clip) {
  const qb = quantileBox(frames, { qx0: 0, qx1: 1, qy0: 0, qy1: 1 }, clip);
  const { mask, W, H } = qb;
  const GAP = Math.max(6, Math.round(H * 0.03));
  const bottoms = []; const cols = [];
  for (let x = 0; x < W; x++) {
    let top = -1; for (let y = 0; y < H; y++) if (mask[y * W + x]) { top = y; break; }
    if (top < 0) continue;
    let y = top, gapStart = -1;
    while (y < H) {
      if (!mask[y * W + x]) { let g = 0; while (y + g < H && !mask[(y + g) * W + x]) g++; if (g >= GAP) { gapStart = y; break; } y += g; } else y++;
    }
    if (gapStart > 0 && gapStart < H * 0.8) { bottoms.push(gapStart); cols.push(x); }
  }
  bottoms.sort((a, b) => a - b);
  const med = bottoms[Math.floor(bottoms.length * 0.5)];
  // 처마 픽셀(위~med)만으로 가로·세로 분위수
  const hx = new Float64Array(W), hy = new Float64Array(H);
  for (let y = 0; y < med; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { hx[x]++; hy[y]++; }
  const qpos = (h, t) => { let tot = 0; for (const v of h) tot += v; let c = 0; for (let i = 0; i < h.length; i++) { c += h[i]; if (c >= tot * t) return i; } return h.length - 1; };
  const top = qpos(hy, 0.1);
  // 아래 끝은 처마 두께의 6% 만큼 올려 관대하게(늘어진 술 끝에 스치는 정도는 통과)
  return { x0: qpos(hx, 0.03) + clip.x0, x1: qpos(hx, 0.97) + clip.x0, y0: top + clip.y0, y1: med - Math.round((med - top) * 0.06) + clip.y0, overhangCols: cols.length };
}

// 여러 프레임을 한 캔버스에 맞춰 렌더 → 리사이즈 → webp
async function renderFrame(f, U, outW, outH, outPath) {
  const b = f.bb8; // 원본 알파>8 범위
  const ext = await sharp(f.img.data, { raw: { width: f.img.w, height: f.img.h, channels: 4 } }).extract({ left: b.x0, top: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 }).raw().toBuffer({ resolveWithObject: true });
  const UW = U.x1 - U.x0 + 1, UH = U.y1 - U.y0 + 1;
  const canvas = await sharp({ create: { width: UW, height: UH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: ext.data, raw: { width: ext.info.width, height: ext.info.height, channels: 4 }, left: b.x0 + f.ox - U.x0, top: b.y0 + f.oy - U.y0 }])
    .raw().toBuffer();
  await sharp(canvas, { raw: { width: UW, height: UH, channels: 4 } }).resize(outW, outH, { kernel: 'lanczos3' }).webp(WEBP_ALPHA).toFile(outPath);
}

const rel = (abs) => path.relative(OUT_PUBLIC, abs).split(path.sep).join('/');
const files = []; // {abs, url}
function hashOf(abs) { return crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 8); }
function urlOf(abs) { files.push(abs); return `${URL_BASE}/${rel(abs)}?v=${hashOf(abs)}`; }
const mk = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });
const R = Math.round;
const boxOut = (b, U, s) => ({ x: R((b.x0 - U.x0) * s), y: R((b.y0 - U.y0) * s), w: Math.max(1, R((b.x1 - b.x0 + 1) * s)), h: Math.max(1, R((b.y1 - b.y0 + 1) * s)) });

// 연결 요소(알파≥thr, 4-이웃) — 큰 순서
function components(img, thr = 16) {
  const N = img.w * img.h, lab = new Int32Array(N), comps = [];
  let n = 0; const st = [];
  for (let i = 0; i < N; i++) {
    if (lab[i] || img.data[i * 4 + 3] < thr) continue;
    n++; lab[i] = n; st.push(i); let cnt = 0, x0 = img.w, x1 = 0;
    while (st.length) {
      const j = st.pop(); cnt++; const x = j % img.w; if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (x > 0 && !lab[j - 1] && img.data[(j - 1) * 4 + 3] >= thr) { lab[j - 1] = n; st.push(j - 1); }
      if (x < img.w - 1 && !lab[j + 1] && img.data[(j + 1) * 4 + 3] >= thr) { lab[j + 1] = n; st.push(j + 1); }
      if (j >= img.w && !lab[j - img.w] && img.data[(j - img.w) * 4 + 3] >= thr) { lab[j - img.w] = n; st.push(j - img.w); }
      if (j < N - img.w && !lab[j + img.w] && img.data[(j + img.w) * 4 + 3] >= thr) { lab[j + img.w] = n; st.push(j + img.w); }
    }
    comps.push({ n, cnt, x0, x1 });
  }
  comps.sort((a, b) => b.cnt - a.cnt);
  return { lab, comps };
}
// keep(x,y)=false 인 픽셀을 투명하게 만든 사본(오려내기)
function cutout(img, keep, name) {
  const data = Buffer.from(img.data);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (!keep(x, y)) data[(y * img.w + x) * 4 + 3] = 0;
  return { data, w: img.w, h: img.h, path: name };
}
// 연결 요소 번호 n 을 r 픽셀 팽창한 마스크(가장자리 안티앨리어싱 픽셀까지 포함)
function dilatedMask(lab, w, h, n, r = 2) {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (lab[y * w + x] !== n) continue;
    for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= h) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < w) m[yy * w + xx] = 1; } }
  }
  return m;
}

// 여러 프레임 묶음(캐릭터 한 단계 / 장애물 하나) 정렬 — srcs: 경로 또는 이미 읽은 이미지
async function alignGroup(srcs, { refIndex = 0, mode = 'bottom', perFrame = {} } = {}) {
  const imgs = [];
  for (const p of srcs) imgs.push(typeof p === 'string' ? await load(p) : p);
  const ref = imgs[refIndex];
  const refBottom = bottomRow(ref);
  const frames = imgs.map((img) => ({ img, bb8: bbox(img, 9), bb128: bbox(img, 128), bottom: bottomRow(img), ox: 0, oy: 0, name: path.basename(img.path, '.png') }));
  for (let i = 0; i < frames.length; i++) {
    if (i === refIndex) continue;
    const f = frames[i];
    const pf = perFrame[f.name];
    const m = (typeof pf === 'string' ? pf : pf?.mode) || mode;
    const range = (typeof pf === 'object' && pf.range) || 0.35;
    // largest: 두 프레임의 가장 큰 덩어리(4단계=신부)끼리만 겹쳐 가로 위치를 정함
    const [ra, fa] = typeof pf === 'object' && pf.largest ? [ref, f.img].map((im) => { const { lab, comps } = components(im); const n = comps[0].n; return cutout(im, (x, y) => lab[y * im.w + x] === n, im.path); }) : [ref, f.img];
    const a = m === 'corr2d' ? alignTo(ra, fa, undefined, range) : alignTo(ra, fa, refBottom - f.bottom, range, bbox(ra, 128), bbox(fa, 128));
    f.ox = a.ox; f.oy = a.oy;
  }
  // 합집합(알파>8) + 여백 4px
  const U = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const f of frames) {
    U.x0 = Math.min(U.x0, f.bb8.x0 + f.ox); U.y0 = Math.min(U.y0, f.bb8.y0 + f.oy);
    U.x1 = Math.max(U.x1, f.bb8.x1 + f.ox); U.y1 = Math.max(U.y1, f.bb8.y1 + f.oy);
  }
  U.x0 -= 4; U.y0 -= 4; U.x1 += 4; U.y1 += 4;
  return { frames, U, refBottom, ref: frames[refIndex] };
}

// ───────────────────────── 메인 ─────────────────────────
const debug = { segments: [], char: [], ui: {}, entry: null, checks: [] };
fs.rmSync(OUT_PUBLIC, { recursive: true, force: true });
fs.mkdirSync(OUT_PUBLIC, { recursive: true });

// 1) 캐릭터
const charOut = [];
let stage1 = null;
let groomOut = null;
for (const st of CHAR_STAGES) {
  const refName = st.ref || 'run_01';
  const paths = MOTIONS.map((m) => path.join(P.char, st.key, `${m}.png`));
  const g = await alignGroup(paths, { refIndex: MOTIONS.indexOf(refName), mode: 'bottom', perFrame: st.perFrame || {} });
  const UW = g.U.x1 - g.U.x0 + 1, UH = g.U.y1 - g.U.y0 + 1;
  const s = CHAR_SCALE, outW = R(UW * s), outH = R(UH * s);
  const frames = {};
  for (const f of g.frames) {
    const out = path.join(OUT_PUBLIC, 'char', st.key, `${f.name}.webp`); mk(out);
    await renderFrame(f, g.U, outW, outH, out);
    frames[f.name] = { src: urlOf(out), w: outW, h: outH };
  }
  const byName = Object.fromEntries(g.frames.map((f) => [f.name, f]));
  const runFrames = (st.runCycle || ['run_01', 'run_02']).map((n) => byName[n]);
  const hbSrc = {
    run: quantileBox(runFrames, CHAR_HB.run, g.U),
    jump: quantileBox([byName.jump], CHAR_HB.jump, g.U),
    slide: quantileBox([byName.slide], CHAR_HB.slide, g.U),
  };
  const groundY = g.refBottom + 1; // 캔버스(src) 좌표 — 모든 프레임 발바닥이 여기
  const refTop = Math.min(...runFrames.map((f) => f.bb128.y0 + f.oy));
  const refHsrc = groundY - refTop;
  // 커플 단계: 충돌 폭을 1단계 비율 × COUPLE_HIT_WIDEN 으로 제한 — 앞(오른쪽, 장애물이 오는 쪽) 끝은 그대로 두고 뒤쪽(신부 드레스 자락)을 깎음
  if (stage1 && st.stage >= 4) {
    for (const k of ['run', 'jump', 'slide']) {
      const b = hbSrc[k];
      const maxW = (stage1.hbSrc[k].x1 - stage1.hbSrc[k].x0 + 1) / stage1.refHsrc * refHsrc * COUPLE_HIT_WIDEN;
      if (b.x1 - b.x0 + 1 > maxW) b.x0 = R(b.x1 + 1 - maxW);
    }
  }
  // 피벗 x: 1~3단계는 달리기 충돌 상자 가운데. 4·5단계는 "신부만" 같은 규칙으로 잡아 단계가 바뀌어도 신부 자리가 그대로이게
  let pivotSrcX = (hbSrc.run.x0 + hbSrc.run.x1) / 2, brideBox = null;
  if (st.stage >= 4) {
    const brideFrames = runFrames.map((f) => {
      let keep;
      if (st.stage === 4) { // 신랑·신부가 떨어져 있음 → 가장 큰 연결 요소 = 신부(드레스·베일)
        const { lab, comps } = components(f.img);
        const n = comps[0].n; keep = (x, y) => lab[y * f.img.w + x] === n;
      } else { // 5단계는 손을 잡아 붙어 있음 → 가운데~오른쪽에서 불투명 픽셀이 가장 적은 열(잡은 손)로 나눔, 왼쪽 = 신부
        const b = f.bb128; let best = { x: b.x1, v: Infinity };
        for (let x = R(b.x0 + (b.x1 - b.x0) * 0.45); x <= R(b.x0 + (b.x1 - b.x0) * 0.8); x++) {
          let v = 0; for (let y = 0; y < f.img.h; y++) if (A(f.img, x, y) >= 128) v++;
          if (v < best.v) best = { x, v };
        }
        keep = (x) => x < best.x;
      }
      return { img: cutout(f.img, keep, f.img.path), ox: f.ox, oy: f.oy };
    });
    brideBox = quantileBox(brideFrames, CHAR_HB.run, g.U);
    pivotSrcX = (brideBox.x0 + brideBox.x1) / 2;
  }
  const slideTopSrc = byName.slide.bb128.y0 + byName.slide.oy;
  const slideRatio = (groundY - slideTopSrc) / refHsrc;
  const slideScale = Math.min(1, Math.max(0.7, +(SLIDE_TOP_TARGET / slideRatio).toFixed(2)));
  const hitbox = { run: boxOut(hbSrc.run, g.U, s), jump: boxOut(hbSrc.jump, g.U, s), slide: boxOut(hbSrc.slide, g.U, s) };
  const pivot = { x: R((pivotSrcX - g.U.x0) * s), y: R((groundY - g.U.y0) * s) };
  const refH = R(refHsrc * s);
  const entry = { stage: st.stage, key: st.key, label: st.label, frames, pivot, hitbox, refH, slideScale, runCycle: st.runCycle || ['run_01', 'run_02'], note: st.note };
  charOut.push(entry);
  if (st.stage === 1) stage1 = { hbSrc, refHsrc };
  // 점검: 머리 위 장애물이 슬라이드로는 통과·달리기로는 충돌하는지(refH 단위 높이)
  const runTop = (pivot.y - hitbox.run.y) / refH, slideTop = (pivot.y - hitbox.slide.y) / refH * slideScale, jumpTop = (pivot.y - hitbox.jump.y) / refH;
  debug.checks.push({ stage: st.stage, runTop: +runTop.toFixed(3), slideTopScaled: +slideTop.toFixed(3), jumpTop: +jumpTop.toFixed(3), clearance: AIR_CLEARANCE, slideRatio: +slideRatio.toFixed(3), runW: +(hitbox.run.w / refH).toFixed(3), ok: runTop > AIR_CLEARANCE + 0.08 && slideTop < AIR_CLEARANCE - 0.04 });
  debug.char.push({ ...entry, brideBox: brideBox && boxOut(brideBox, g.U, s), offsets: g.frames.map((f) => ({ name: f.name, ox: f.ox, oy: f.oy })), files: Object.fromEntries(g.frames.map((f) => [f.name, path.join(OUT_PUBLIC, 'char', st.key, `${f.name}.webp`)])) });
  console.log('char', st.key, `${outW}x${outH}`, 'refH', refH, 'pivot', pivot, 'slideScale', slideScale, 'offsets', g.frames.map((f) => `${f.name}:${f.ox},${f.oy}`).join(' '));

  // 신랑 단독 프레임(원본에 없음) — 4단계 run_01·run_02 에서 신랑 연결 요소만 오려냄 → "신랑 합류(옆에서 뛰어 들어옴)" 연출용
  if (st.stage === 4) {
    const cuts = ['run_01', 'run_02'].map((n) => {
      const f = byName[n];
      const { lab, comps } = components(f.img);
      const gn = comps[1].n; // 두 번째로 큰 덩어리 = 신랑(신부 덩어리보다 작음)
      const m = dilatedMask(lab, f.img.w, f.img.h, gn, 2);
      const img = cutout(f.img, (x, y) => { const i = y * f.img.w + x; return m[i] && (lab[i] === 0 || lab[i] === gn); }, n);
      return img;
    });
    const gg = await alignGroup(cuts, { refIndex: 1, mode: 'bottom' });
    const GW = gg.U.x1 - gg.U.x0 + 1, GH = gg.U.y1 - gg.U.y0 + 1, gw = R(GW * s), gh = R(GH * s);
    const gframes = {};
    for (const f of gg.frames) {
      const out = path.join(OUT_PUBLIC, 'char', 'groom', `${f.name}.webp`); mk(out);
      await renderFrame(f, gg.U, gw, gh, out);
      gframes[f.name] = { src: urlOf(out), w: gw, h: gh };
    }
    const gref = gg.ref; // run_02 신랑(4단계 기준 프레임과 같은 좌표)
    const gq = quantileBox([gref], { qx0: 0.12, qx1: 0.9, qy0: 0.05, qy1: 0.995 }, gg.U);
    const gGround = gg.refBottom + 1;
    const gpivot = { x: R(((gq.x0 + gq.x1) / 2 - gg.U.x0) * s), y: R((gGround - gg.U.y0) * s) };
    // 4단계 run_02 캔버스에서 신랑 피벗 위치 − 4단계 피벗 = 합류 끝 지점(이 자리까지 뛰어 와서 4단계 프레임으로 바꾸면 이음매 없음)
    const joinOffset = { x: R(((gq.x0 + gq.x1) / 2 - g.U.x0) * s) - pivot.x, y: R((gGround - g.U.y0) * s) - pivot.y };
    groomOut = { frames: gframes, pivot: gpivot, refH: R((gGround - gref.bb128.y0) * s), joinOffset };
    debug.groom = { ...groomOut, files: Object.fromEntries(gg.frames.map((f) => [f.name, path.join(OUT_PUBLIC, 'char', 'groom', `${f.name}.webp`)])) };
    console.log('groom', `${gw}x${gh}`, 'pivot', gpivot, 'joinOffset', joinOffset, 'offsets', gg.frames.map((f) => `${f.name}:${f.ox},${f.oy}`).join(' '));
  }
}

// 2) 구간: 배경·발판·장애물
const segOut = [];
for (const seg of SEGMENTS) {
  const nn = seg.id.slice(0, 2);
  // 배경 — 불투명, trim 없음. 400KB 넘으면 품질→해상도 순으로 낮춤
  const bgSrc = path.join(P.bg, seg.id, 'background.png');
  const bgOut = path.join(OUT_PUBLIC, 'bg', `${nn}.webp`); mk(bgOut);
  const bgMeta = await sharp(bgSrc).metadata();
  let bw = bgMeta.width, bh = bgMeta.height, q = WEBP_OPAQUE.quality;
  for (;;) {
    await sharp(bgSrc).removeAlpha().resize(bw, bh, { kernel: 'lanczos3' }).webp({ ...WEBP_OPAQUE, quality: q }).toFile(bgOut);
    if (fs.statSync(bgOut).size <= BG_MAX_BYTES) break;
    if (q > 72) q -= 4; else { bw = R(bw * 0.9); bh = R(bh * 0.9); q = WEBP_OPAQUE.quality; }
  }
  // 좌우 이음새: 첫 열과 끝 열 색 차이 vs 이웃 열 차이 → 무봉제 타일 여부
  const bgRaw = await load(bgSrc);
  let edge = 0, adj = 0;
  for (let y = 0; y < bgRaw.h; y++) for (let c = 0; c < 3; c++) {
    const L = bgRaw.data[(y * bgRaw.w) * 4 + c], L1 = bgRaw.data[(y * bgRaw.w + 1) * 4 + c], Rr = bgRaw.data[(y * bgRaw.w + bgRaw.w - 1) * 4 + c];
    edge += Math.abs(L - Rr); adj += Math.abs(L - L1);
  }
  const seamless = edge < adj * 2.5;

  // 발판 — trim 후 원본 해상도 유지(가늘고 길어 용량 작음)
  const plSrc = path.join(P.platform, seg.id, 'platform.png');
  const pl = await load(plSrc);
  const pb = bbox(pl, 9);
  const tops = [];
  const colTop = new Int32Array(pl.w).fill(-1);
  for (let x = pb.x0; x <= pb.x1; x++) {
    for (let y = pb.y0; y <= pb.y1; y++) if (A(pl, x, y) >= 128) { colTop[x] = y; tops.push(y); break; }
  }
  tops.sort((a, b) => a - b);
  const topMed = tops[Math.floor(tops.length / 2)];
  const tol = Math.max(3, R((pb.y1 - pb.y0) * 0.03));
  let sx0 = -1, sx1 = -1;
  for (let x = pb.x0; x <= pb.x1; x++) if (colTop[x] >= 0 && colTop[x] <= topMed + tol) { if (sx0 < 0) sx0 = x; sx1 = x; }
  const plOut = path.join(OUT_PUBLIC, 'platform', `${nn}.webp`); mk(plOut);
  const pw = pb.x1 - pb.x0 + 1, ph = pb.y1 - pb.y0 + 1;
  await sharp(plSrc).ensureAlpha().extract({ left: pb.x0, top: pb.y0, width: pw, height: ph }).webp(WEBP_ALPHA).toFile(plOut);
  // faceY: 윗면(위에서 내려다본 면)과 앞면(옆면)의 경계 — 행 평균색이 가장 크게 바뀌는 행(topY+6 ~ 두께 70% 안)
  const rowMean = [];
  for (let y = pb.y0; y <= pb.y1; y++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let x = sx0; x <= sx1; x += 2) { const i = (y * pl.w + x) * 4; if (pl.data[i + 3] >= 128) { r += pl.data[i]; gg += pl.data[i + 1]; b += pl.data[i + 2]; n++; } }
    rowMean.push(n ? [r / n, gg / n, b / n] : null);
  }
  //  윗면 기준색 = topY+6%~15% 행들의 평균 → 그 아래로 내려가며 기준색과 RGB 합 차이가 36 넘는 행이 2줄 연속 나오면 거기가 경계
  //  (위 가장자리 외곽선·금테는 6% 안이라 건너뜀. 12장 모두 그림과 대조해 확인 — ASSETS.md)
  const ph0 = pb.y1 - pb.y0 + 1, t0 = topMed - pb.y0;
  const refRows = rowMean.slice(t0 + Math.round(ph0 * 0.06), t0 + Math.round(ph0 * 0.15) + 1).filter(Boolean);
  const refC = [0, 1, 2].map((c) => refRows.reduce((t, v) => t + v[c], 0) / refRows.length);
  const dev = (v) => (v ? Math.abs(v[0] - refC[0]) + Math.abs(v[1] - refC[1]) + Math.abs(v[2] - refC[2]) : 0);
  let faceRow = t0 + Math.round(ph0 * 0.25);
  for (let y = t0 + Math.round(ph0 * 0.15); y < ph0 * 0.7; y++) if (dev(rowMean[y]) > 36 && dev(rowMean[y + 1]) > 36) { faceRow = y; break; }
  if (FACE_Y_FIX[seg.id] != null) faceRow = FACE_Y_FIX[seg.id];
  const platform = { src: urlOf(plOut), w: pw, h: ph, topY: topMed - pb.y0, faceY: faceRow, solidX0: sx0 - pb.x0, solidX1: sx1 - pb.x0 };

  // 장애물
  const obstacles = [];
  const dbgObs = [];
  for (const o of seg.obstacles) {
    const dir = path.join(P.obs, seg.id, o.key);
    const names = fs.readdirSync(dir).filter((f) => /^\d+\.png$/.test(f)).sort();
    const g = await alignGroup(names.map((n) => path.join(dir, n)), { mode: o.kind === 'flying' ? 'corr2d' : 'bottom', perFrame: o.align || {} });
    const UW = g.U.x1 - g.U.x0 + 1, UH = g.U.y1 - g.U.y0 + 1;
    let hbSrc, scaleHint = o.scaleHint;
    const groundY = g.refBottom + 1;
    if (o.overhang) {
      hbSrc = overhangBox(g.frames, g.U);
      // 처마 아래 끝이 땅에서 refH × AIR_CLEARANCE 에 오도록 크기 결정
      scaleHint = +(AIR_CLEARANCE * UH / (groundY - (hbSrc.y1 + 1))).toFixed(3);
    } else {
      hbSrc = quantileBox(g.frames, { ...HB_DEFAULT, ...(o.hb || {}) }, g.U);
    }
    const outH = Math.max(128, Math.min(560, R(scaleHint * OBS_PX_PER_HINT)));
    const s = outH / UH, outW = R(UW * s);
    const frames = [];
    for (const f of g.frames) {
      const out = path.join(OUT_PUBLIC, 'obs', nn, o.key, `${f.name}.webp`); mk(out);
      await renderFrame(f, g.U, outW, outH, out);
      frames.push({ src: urlOf(out), w: outW, h: outH });
    }
    const hitbox = boxOut(hbSrc, g.U, s);
    const pivot = { x: R(((hbSrc.x0 + hbSrc.x1) / 2 - g.U.x0) * s), y: o.kind === 'flying' ? outH : R((groundY - g.U.y0) * s) };
    const ob = { key: o.key, name: o.name, frames, anim: frames.length > 1, kind: o.kind, hitbox, pivot, scaleHint, why: o.why };
    if (o.fps && frames.length > 1) ob.fps = o.fps;
    if (o.kind === 'air' || o.kind === 'flying') ob.clearance = AIR_CLEARANCE;
    obstacles.push(ob);
    const topRatio = (pivot.y - hitbox.y) / outH * scaleHint; // refH 단위 충돌 위끝 높이(지상 기준)
    dbgObs.push({ ...ob, files: g.frames.map((f) => path.join(OUT_PUBLIC, 'obs', nn, o.key, `${f.name}.webp`)), offsets: g.frames.map((f) => ({ name: f.name, ox: f.ox, oy: f.oy })), hitTopInRefH: +topRatio.toFixed(3) });
    console.log('obs', seg.id, o.key, `${outW}x${outH}`, o.kind, 'scaleHint', scaleHint, 'hitTop', topRatio.toFixed(2), 'offsets', g.frames.map((f) => `${f.name}:${f.ox},${f.oy}`).join(' '));
  }
  const bgEntry = { src: urlOf(bgOut), w: bw, h: bh, seamless };
  segOut.push({ id: seg.id, name: seg.name, bg: bgEntry, platform, obstacles });
  debug.segments.push({ id: seg.id, name: seg.name, bg: { ...bgEntry, file: bgOut, edgeDiff: +(edge / bgRaw.h / 3).toFixed(1), adjDiff: +(adj / bgRaw.h / 3).toFixed(1) }, platform: { ...platform, file: plOut }, obstacles: dbgObs });
  console.log('seg', seg.id, 'bg', `${bw}x${bh}`, 'q', q, Math.round(fs.statSync(bgOut).size / 1024) + 'KB', 'seamless', seamless, 'platform', `${pw}x${ph}`, 'topY', platform.topY, 'solid', platform.solidX0, platform.solidX1);
}

// 3) UI — trim(알파>8) 후 목표 크기로, hit = 알파≥128 범위
const uiOut = {};
for (const [key, d] of Object.entries(UI_DEF)) {
  const src = path.join(P.ui, d.file);
  const img = await load(src);
  const b8 = bbox(img, 9), b128 = bbox(img, 128);
  const tw = b8.x1 - b8.x0 + 1, th = b8.y1 - b8.y0 + 1;
  const s = d.width ? d.width / tw : d.height / th;
  const ow = R(tw * s), oh = R(th * s);
  const out = path.join(OUT_PUBLIC, 'ui', `${key}.webp`); mk(out);
  await sharp(src).ensureAlpha().extract({ left: b8.x0, top: b8.y0, width: tw, height: th }).resize(ow, oh, { kernel: 'lanczos3' }).webp(WEBP_ALPHA).toFile(out);
  const hit = { x: R((b128.x0 - b8.x0) * s), y: R((b128.y0 - b8.y0) * s), w: R((b128.x1 - b128.x0 + 1) * s), h: R((b128.y1 - b128.y0 + 1) * s) };
  uiOut[key] = { src: urlOf(out), w: ow, h: oh, hit, ...(d.refOnly ? { refOnly: true } : {}) };
  debug.ui[key] = { ...uiOut[key], file: out, origin: d.file };
}

// 4) 첫 진입 일러스트
{
  const src = path.join(P.entry, 'entry-illustration.png');
  const out = path.join(OUT_PUBLIC, 'entry.webp');
  const meta = await sharp(src).metadata();
  let w = meta.width, h = meta.height, q = WEBP_OPAQUE.quality;
  for (;;) {
    await sharp(src).removeAlpha().resize(w, h, { kernel: 'lanczos3' }).webp({ ...WEBP_OPAQUE, quality: q }).toFile(out);
    if (fs.statSync(out).size <= BG_MAX_BYTES) break;
    if (q > 72) q -= 4; else { w = R(w * 0.9); h = R(h * 0.9); q = WEBP_OPAQUE.quality; }
  }
  debug.entry = { src: urlOf(out), w, h, file: out };
}

// 5) assets.ts 쓰기
const totalBytes = files.reduce((t, f) => t + fs.statSync(f).size, 0);
const J = (v) => JSON.stringify(v);
const lines = [];
lines.push(`// ⚠ 자동 생성 파일 — 손으로 고치지 말 것 (261011 사장 요청: 웨딩런 2D 러너, 첨부 이미지 실제 사용)`);
lines.push(`// 다시 만들기: node apps/web/scripts/wedding-run-assets.mjs --src <원본 zip 6개 푼 폴더>`);
lines.push(`// 사람용 매핑표: apps/web/src/app/wedding-run/ASSETS.md`);
lines.push(`//`);
lines.push(`// 좌표 약속 — 모든 숫자는 각 이미지(최적화본) 픽셀 기준, 원점 = 이미지 왼쪽 위`);
lines.push(`//  • pivot  = 바닥 접점(캐릭터: 발바닥 중앙 — 같은 단계 6모션 모두 같은 캔버스·같은 피벗). Phaser 라면 setOrigin(pivot.x/w, pivot.y/h)`);
lines.push(`//  • hitbox = 실제 몸체만 남긴 충돌 상자(알파≥128 픽셀 분위수, 반투명 빛 효과·날리는 머리·꼬리 등 제외 — 약간 관대)`);
lines.push(`//  • 캐릭터 표시 크기: 단계마다 scale = 원하는 몸 높이 ÷ refH 로 맞추면 5단계 내내 신부 크기가 같음`);
lines.push(`//  • 장애물 표시 크기: (캔버스 높이 h 의 화면 높이) = scaleHint × (캐릭터 refH 의 화면 높이)`);
lines.push(`//  • clearance(air·flying): 충돌 상자 아래 끝을 땅에서 refH × clearance 높이에 두면 달리기=충돌, 슬라이드=통과`);
lines.push(`//    (air 는 scaleHint 가 이미 그 높이에 맞춰져 있어 땅에 세우기만 하면 됨 / flying 은 게임이 높이를 정해 띄움)`);
lines.push(`//  • 장애물 그림은 모두 오른쪽을 향함(원본 그대로). 플레이어 쪽으로 달려오게 하려면 setFlipX(true) — 그때 hitbox.x → w - hitbox.x - hitbox.w, pivot.x → w - pivot.x`);
lines.push(``);
lines.push(`export type WrImg = { src: string; w: number; h: number };`);
lines.push(`export type WrBox = { x: number; y: number; w: number; h: number };`);
lines.push(`export type WrObstacleKind = 'ground' | 'air' | 'moving-ground' | 'flying';`);
lines.push(`export interface WrObstacle {`);
lines.push(`  key: string;`);
lines.push(`  /** 화면·로그용 한국어 이름 */`);
lines.push(`  name: string;`);
lines.push(`  /** 모든 프레임이 같은 크기·같은 피벗 */`);
lines.push(`  frames: WrImg[];`);
lines.push(`  anim: boolean;`);
lines.push(`  /** 프레임이 여러 장일 때 권장 재생 속도 */`);
lines.push(`  fps?: number;`);
lines.push(`  kind: WrObstacleKind;`);
lines.push(`  hitbox: WrBox;`);
lines.push(`  pivot: { x: number; y: number };`);
lines.push(`  scaleHint: number;`);
lines.push(`  clearance?: number;`);
lines.push(`}`);
lines.push(`export interface WrSegment {`);
lines.push(`  id: string;`);
lines.push(`  name: string;`);
lines.push(`  /** seamless=false: 좌우 끝이 이어지지 않음 → 반복할 땐 좌우 반전(flipX) 교대로 붙이거나 다음 구간으로 교차 전환 */`);
lines.push(`  bg: WrImg & { seamless: boolean };`);
lines.push(`  /**`);
lines.push(`   * topY = 걷는 윗면 맨 위 y(열마다 첫 불투명 행의 중앙값), solidX0~solidX1 = 윗면이 평평한 범위(둥근 끝 제외) — 이어 붙일 땐 이 범위끼리 겹치게(양끝 무봉제 아님).`);
lines.push(`   * faceY = 윗면(위에서 본 면)과 앞면 경계 — 발을 topY~faceY 사이(가운데쯤)에 두면 2.5D 그림상 발판 "위"에 선 것처럼 보임(topY 에 딱 붙이면 뒤 가장자리에 선 느낌).`);
lines.push(`   */`);
lines.push(`  platform: WrImg & { topY: number; faceY: number; solidX0: number; solidX1: number };`);
lines.push(`  obstacles: WrObstacle[];`);
lines.push(`}`);
lines.push(`export type WrMotion = 'run_01' | 'run_02' | 'jump' | 'slide' | 'stumble' | 'celebrate';`);
lines.push(`export type WrCharKey = '01_dress' | '02_bouquet' | '03_veil_tiara' | '04_groom_joins' | '05_holding_hands';`);
lines.push(`export interface WrCharStage {`);
lines.push(`  stage: number;`);
lines.push(`  key: WrCharKey;`);
lines.push(`  label: string;`);
lines.push(`  frames: Record<WrMotion, WrImg>;`);
lines.push(`  pivot: { x: number; y: number };`);
lines.push(`  hitbox: Record<'run' | 'jump' | 'slide', WrBox>;`);
lines.push(`  /** 달리기 프레임의 몸 높이(발바닥~머리 위, px) — 표시 배율 기준 */`);
lines.push(`  refH: number;`);
lines.push(`  /** 슬라이드 프레임을 pivot 기준 이 배율로 줄여 그리면 머리 위 장애물 밑을 지나는 그림이 납득됨(원본 슬라이드 포즈가 생각보다 높음). hitbox.slide 도 같은 배율 적용 */`);
lines.push(`  slideScale: number;`);
lines.push(`  /** 평소 달리기에 번갈아 쓸 프레임 */`);
lines.push(`  runCycle: WrMotion[];`);
lines.push(`  note?: string;`);
lines.push(`}`);
lines.push(`export type WrUiKey = ${Object.keys(UI_DEF).map((k) => `'${k}'`).join(' | ')};`);
lines.push(`/** hit = 투명 여백 뺀 실제 버튼 영역(이미지 px). 화면에선 최소 44×44 CSS px 이 되도록 크기를 정할 것. refOnly = 디자인 참고용 예시(점수·순위가 박혀 있음 — 게임 화면에 그대로 쓰지 말 것) */`);
lines.push(`export type WrUiImg = WrImg & { hit: WrBox; refOnly?: boolean };`);
lines.push(``);
lines.push(`export const WR_SEGMENTS: WrSegment[] = [`);
for (const sg of segOut) {
  lines.push(`  {`);
  lines.push(`    id: ${J(sg.id)}, name: ${J(sg.name)},`);
  lines.push(`    bg: ${J(sg.bg)},`);
  lines.push(`    platform: ${J(sg.platform)},`);
  lines.push(`    obstacles: [`);
  for (const ob of sg.obstacles) {
    const { why, ...rest } = ob;
    lines.push(`      // ${why}`);
    lines.push(`      ${J(rest)},`);
  }
  lines.push(`    ],`);
  lines.push(`  },`);
}
lines.push(`];`);
lines.push(``);
lines.push(`export const WR_CHAR: WrCharStage[] = [`);
for (const c of charOut) {
  const { note, ...rest } = c;
  if (note) lines.push(`  // ⚠ ${note}`);
  lines.push(`  ${J(note ? { ...rest, note } : rest)},`);
}
lines.push(`];`);
lines.push(``);
lines.push(`export const WR_UI: Record<WrUiKey, WrUiImg> = {`);
for (const [k, v] of Object.entries(uiOut)) lines.push(`  ${k}: ${J(v)},`);
lines.push(`};`);
lines.push(``);
lines.push(`/**`);
lines.push(` * 신랑 단독 2프레임 — 원본에 신랑 혼자 모션이 없어 4단계 run_01·run_02 에서 신랑 덩어리만 오려냄(그림 수정 없음).`);
lines.push(` * 사양서 [10] "신랑 합류: 옆에서 뛰어 들어오는 연출" 용: 3단계 신부가 달리는 동안 화면 왼쪽 밖에서 신랑이 뛰어 들어와`);
lines.push(` * 신부 피벗 + joinOffset 자리에 닿으면 WR_CHAR[3](4단계) 프레임으로 바꾸면 이음매 없음.`);
lines.push(` * 표시 배율은 4단계와 같게: scale = (원하는 신부 몸 높이) ÷ WR_CHAR[3].refH. joinOffset 도 4단계 캔버스 px(같은 배율 곱).`);
lines.push(` */`);
lines.push(`export const WR_GROOM: { frames: Record<'run_01' | 'run_02', WrImg>; pivot: { x: number; y: number }; refH: number; joinOffset: { x: number; y: number } } = ${J(groomOut)};`);
lines.push(``);
lines.push(`/** 첫 진입 화면 일러스트(가로용, 왼쪽 빈 공간에 제목·버튼을 별도 레이어로) */`);
lines.push(`export const WR_ENTRY: WrImg = ${J({ src: debug.entry.src, w: debug.entry.w, h: debug.entry.h })};`);
lines.push(``);
lines.push(`/** 머리 위 장애물 공통 높이(refH 배수) */`);
lines.push(`export const WR_AIR_CLEARANCE = ${AIR_CLEARANCE};`);
lines.push(`export const WR_ASSET_STATS = { files: ${files.length}, bytes: ${totalBytes} };`);
lines.push(``);
lines.push(`/** 프리로딩용 — 구간 번호(0부터)까지 필요한 이미지 목록. 처음엔 0~1구간만, 이후 다음 구간을 미리 받는 식으로 쓰면 첫 로딩이 짧음 */`);
lines.push(`export function wrSegmentSrcs(index: number): string[] {`);
lines.push(`  const sg = WR_SEGMENTS[index];`);
lines.push(`  if (!sg) return [];`);
lines.push(`  return [sg.bg.src, sg.platform.src, ...sg.obstacles.flatMap((o) => o.frames.map((f) => f.src))];`);
lines.push(`}`);
lines.push(`export function wrCharSrcs(): string[] {`);
lines.push(`  return [...WR_CHAR.flatMap((c) => Object.values(c.frames).map((f) => f.src)), ...Object.values(WR_GROOM.frames).map((f) => f.src)];`);
lines.push(`}`);
lines.push(`export function wrUiSrcs(includeRefOnly = false): string[] {`);
lines.push(`  return Object.values(WR_UI).filter((u) => includeRefOnly || !u.refOnly).map((u) => u.src);`);
lines.push(`}`);
lines.push(``);
fs.writeFileSync(OUT_TS, lines.join('\n'));

console.log('\n총', files.length, '파일', (totalBytes / 1024 / 1024).toFixed(2) + 'MB');
console.table(debug.checks);
if (DEBUG_JSON) {
  debug.total = { files: files.length, bytes: totalBytes };
  fs.writeFileSync(DEBUG_JSON, JSON.stringify(debug, null, 1));
  console.log('debug json →', DEBUG_JSON);
}
