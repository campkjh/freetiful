// ⚠ 자동 생성 파일 — 손으로 고치지 말 것 (261011 사장 요청: 웨딩런 2D 러너, 첨부 이미지 실제 사용)
// 다시 만들기: node apps/web/scripts/wedding-run-assets.mjs --src <원본 zip 6개 푼 폴더>
// 사람용 매핑표: apps/web/src/app/wedding-run/ASSETS.md
//
// 좌표 약속 — 모든 숫자는 각 이미지(최적화본) 픽셀 기준, 원점 = 이미지 왼쪽 위
//  • pivot  = 바닥 접점(캐릭터: 발바닥 중앙 — 같은 단계 6모션 모두 같은 캔버스·같은 피벗). Phaser 라면 setOrigin(pivot.x/w, pivot.y/h)
//  • hitbox = 실제 몸체만 남긴 충돌 상자(알파≥128 픽셀 분위수, 반투명 빛 효과·날리는 머리·꼬리 등 제외 — 약간 관대)
//  • 캐릭터 표시 크기: 단계마다 scale = 원하는 몸 높이 ÷ refH 로 맞추면 5단계 내내 신부 크기가 같음
//  • 장애물 표시 크기: (캔버스 높이 h 의 화면 높이) = scaleHint × (캐릭터 refH 의 화면 높이)
//  • clearance(air·flying): 충돌 상자 아래 끝을 땅에서 refH × clearance 높이에 두면 달리기=충돌, 슬라이드=통과
//    (air 는 scaleHint 가 이미 그 높이에 맞춰져 있어 땅에 세우기만 하면 됨 / flying 은 게임이 높이를 정해 띄움)
//  • 장애물 그림은 모두 오른쪽을 향함(원본 그대로). 플레이어 쪽으로 달려오게 하려면 setFlipX(true) — 그때 hitbox.x → w - hitbox.x - hitbox.w, pivot.x → w - pivot.x

export type WrImg = { src: string; w: number; h: number };
export type WrBox = { x: number; y: number; w: number; h: number };
export type WrObstacleKind = 'ground' | 'air' | 'moving-ground' | 'flying';
export interface WrObstacle {
  key: string;
  /** 화면·로그용 한국어 이름 */
  name: string;
  /** 모든 프레임이 같은 크기·같은 피벗 */
  frames: WrImg[];
  anim: boolean;
  /** 프레임이 여러 장일 때 권장 재생 속도 */
  fps?: number;
  kind: WrObstacleKind;
  hitbox: WrBox;
  pivot: { x: number; y: number };
  scaleHint: number;
  clearance?: number;
}
export interface WrSegment {
  id: string;
  name: string;
  /** seamless=false: 좌우 끝이 이어지지 않음 → 반복할 땐 좌우 반전(flipX) 교대로 붙이거나 다음 구간으로 교차 전환 */
  bg: WrImg & { seamless: boolean };
  /**
   * topY = 걷는 윗면 맨 위 y(열마다 첫 불투명 행의 중앙값), solidX0~solidX1 = 윗면이 평평한 범위(둥근 끝 제외) — 이어 붙일 땐 이 범위끼리 겹치게(양끝 무봉제 아님).
   * faceY = 윗면(위에서 본 면)과 앞면 경계 — 발을 topY~faceY 사이(가운데쯤)에 두면 2.5D 그림상 발판 "위"에 선 것처럼 보임(topY 에 딱 붙이면 뒤 가장자리에 선 느낌).
   */
  platform: WrImg & { topY: number; faceY: number; solidX0: number; solidX1: number };
  obstacles: WrObstacle[];
}
export type WrMotion = 'run_01' | 'run_02' | 'jump' | 'slide' | 'stumble' | 'celebrate';
export type WrCharKey = '01_dress' | '02_bouquet' | '03_veil_tiara' | '04_groom_joins' | '05_holding_hands';
export interface WrCharStage {
  stage: number;
  key: WrCharKey;
  label: string;
  frames: Record<WrMotion, WrImg>;
  pivot: { x: number; y: number };
  hitbox: Record<'run' | 'jump' | 'slide', WrBox>;
  /** 달리기 프레임의 몸 높이(발바닥~머리 위, px) — 표시 배율 기준 */
  refH: number;
  /** 슬라이드 프레임을 pivot 기준 이 배율로 줄여 그리면 머리 위 장애물 밑을 지나는 그림이 납득됨(원본 슬라이드 포즈가 생각보다 높음). hitbox.slide 도 같은 배율 적용 */
  slideScale: number;
  /** 평소 달리기에 번갈아 쓸 프레임 */
  runCycle: WrMotion[];
  note?: string;
}
export type WrUiKey = 'start' | 'resume' | 'retry' | 'ranking' | 'share' | 'pause' | 'sound' | 'sound_off' | 'home' | 'close' | 'jump' | 'slide' | 'score_hud' | 'pause_panel' | 'result_panel' | 'hud_blank' | 'modal_blank';
/** hit = 투명 여백 뺀 실제 버튼 영역(이미지 px). 화면에선 최소 44×44 CSS px 이 되도록 크기를 정할 것. refOnly = 디자인 참고용 예시(점수·순위가 박혀 있음 — 게임 화면에 그대로 쓰지 말 것) */
export type WrUiImg = WrImg & { hit: WrBox; refOnly?: boolean };

export const WR_SEGMENTS: WrSegment[] = [
  {
    id: "01_seoul", name: "서울",
    bg: {"src":"/wedding-run/bg/01.webp?v=6a4d4edf","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/01.webp?v=0a8d6abd","w":1965,"h":169,"topY":2,"faceY":43,"solidX0":43,"solidX1":1921},
    obstacles: [
      // 두 사람이 서서 셀카 — 바닥에 서 있는 정적 인물(1장) → 점프
      {"key":"couple_selfie","name":"셀카 찍는 커플","frames":[{"src":"/wedding-run/obs/01/couple_selfie/01.webp?v=52d1fbe4","w":225,"h":336}],"anim":false,"kind":"ground","hitbox":{"x":42,"y":52,"w":145,"h":277},"pivot":{"x":115,"y":334},"scaleHint":0.7},
      // 남자가 카메라로 여자를 찍는 장면, 둘 다 서 있음(1장) → 점프. 두 사람 사이 빈 공간은 충돌 상자에 포함(좌우 끝만 깎음)
      {"key":"couple_photographer","name":"사진 찍어 주는 커플","frames":[{"src":"/wedding-run/obs/01/couple_photographer/01.webp?v=b1dbf306","w":379,"h":307}],"anim":false,"kind":"ground","hitbox":{"x":39,"y":45,"w":296,"h":255},"pivot":{"x":187,"y":306},"scaleHint":0.64},
      // 여자가 폰으로 남자를 찍음, 둘 다 서 있음(1장) → 점프
      {"key":"couple_phone_pose","name":"폰으로 찍는 커플","frames":[{"src":"/wedding-run/obs/01/couple_phone_pose/01.webp?v=d747086b","w":374,"h":317}],"anim":false,"kind":"ground","hitbox":{"x":38,"y":47,"w":298,"h":261},"pivot":{"x":187,"y":315},"scaleHint":0.66},
      // 날개 위·수평·아래 3모션 날갯짓(오른쪽 향함) → 머리 높이로 날아오는 공중 장애물, 슬라이드. 충돌=몸통(날개 끝 제외)
      {"key":"pigeon","name":"비둘기","frames":[{"src":"/wedding-run/obs/01/pigeon/01.webp?v=dd72d4d5","w":319,"h":240},{"src":"/wedding-run/obs/01/pigeon/02.webp?v=fb8a088b","w":319,"h":240},{"src":"/wedding-run/obs/01/pigeon/03.webp?v=d1c40e54","w":319,"h":240}],"anim":true,"kind":"flying","hitbox":{"x":62,"y":94,"w":171,"h":102},"pivot":{"x":148,"y":240},"scaleHint":0.5,"fps":10,"clearance":0.7},
    ],
  },
  {
    id: "02_jongno", name: "종로",
    bg: {"src":"/wedding-run/bg/02.webp?v=af05cae0","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/02.webp?v=686cc6c4","w":2028,"h":126,"topY":1,"faceY":30,"solidX0":22,"solidX1":2003},
    obstacles: [
      // 바닥에 놓인 큰 테이크아웃 컵(1장) → 낮은 지상 장애물, 점프. 빨대는 충돌 제외
      {"key":"iced_americano","name":"아이스 아메리카노","frames":[{"src":"/wedding-run/obs/02/iced_americano/01.webp?v=66d9c9b1","w":140,"h":240}],"anim":false,"kind":"ground","hitbox":{"x":25,"y":76,"w":90,"h":160},"pivot":{"x":70,"y":239},"scaleHint":0.5},
      // 두 아이가 오른쪽으로 달리는 3모션(03은 공중 깡충) → 움직이는 지상 장애물, 점프. 03은 몸통 겹침으로 세로 정렬(살짝 떠 있음)
      {"key":"running_children","name":"뛰어다니는 어린이","frames":[{"src":"/wedding-run/obs/02/running_children/01.webp?v=de81ae0a","w":379,"h":288},{"src":"/wedding-run/obs/02/running_children/02.webp?v=c90e5c37","w":379,"h":288},{"src":"/wedding-run/obs/02/running_children/03.webp?v=54e90a5d","w":379,"h":288}],"anim":true,"kind":"moving-ground","hitbox":{"x":62,"y":47,"w":275,"h":231},"pivot":{"x":199,"y":287},"scaleHint":0.6,"fps":8},
    ],
  },
  {
    id: "03_gyeongbokgung", name: "경복궁",
    bg: {"src":"/wedding-run/bg/03.webp?v=6edaa81e","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/03.webp?v=29f6861a","w":1995,"h":169,"topY":2,"faceY":22,"solidX0":19,"solidX1":1975},
    obstacles: [
      // 한복 차림 외국인 커플이 서서 셀카(1장) → 점프. 위로 든 폰은 충돌 제외
      {"key":"hanbok_tourists","name":"한복 입은 외국인 관광객","frames":[{"src":"/wedding-run/obs/03/hanbok_tourists/01.webp?v=4a339e91","w":344,"h":336}],"anim":false,"kind":"ground","hitbox":{"x":72,"y":62,"w":208,"h":268},"pivot":{"x":176,"y":334},"scaleHint":0.7},
      // 왕+궁녀 둘이 오른쪽으로 걷는 3모션(03=멈춰 손 듦) → 천천히 움직이는 넓은 지상 장애물, 점프
      {"key":"royal_procession","name":"왕과 궁녀 행렬","frames":[{"src":"/wedding-run/obs/03/royal_procession/01.webp?v=3777e34a","w":431,"h":278},{"src":"/wedding-run/obs/03/royal_procession/02.webp?v=2984c522","w":431,"h":278},{"src":"/wedding-run/obs/03/royal_procession/03.webp?v=e2020802","w":431,"h":278}],"anim":true,"kind":"moving-ground","hitbox":{"x":55,"y":77,"w":338,"h":195},"pivot":{"x":224,"y":277},"scaleHint":0.58,"fps":6},
      // 받침돌 위 해태 석상(1장) → 정적 지상 장애물, 점프
      {"key":"haetae_statue","name":"해태 석상","frames":[{"src":"/wedding-run/obs/03/haetae_statue/01.webp?v=ce543ef4","w":300,"h":288}],"anim":false,"kind":"ground","hitbox":{"x":40,"y":69,"w":228,"h":214},"pivot":{"x":154,"y":287},"scaleHint":0.6},
    ],
  },
  {
    id: "04_family_meeting", name: "상견례",
    bg: {"src":"/wedding-run/bg/04.webp?v=47274eb0","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/04.webp?v=d319ee1b","w":2026,"h":150,"topY":2,"faceY":32,"solidX0":40,"solidX1":1984},
    obstacles: [
      // 제자리에서 허리 짚기↔손가락질 2포즈(이동 없음) → 정적 지상(포즈만 바뀜), 점프. 뻗은 팔은 충돌 제외
      {"key":"scolding_mother","name":"호통치는 시어머니","frames":[{"src":"/wedding-run/obs/04/scolding_mother/01.webp?v=d7230bb4","w":264,"h":355},{"src":"/wedding-run/obs/04/scolding_mother/02.webp?v=07a133d5","w":264,"h":355}],"anim":true,"kind":"ground","hitbox":{"x":47,"y":41,"w":129,"h":309},"pivot":{"x":112,"y":354},"scaleHint":0.74,"fps":3},
      // 제자리에서 손 들고 잔소리↔팔짱 2포즈(이동 없음) → 정적 지상(포즈만 바뀜), 점프
      {"key":"nagging_father","name":"잔소리하는 아버지","frames":[{"src":"/wedding-run/obs/04/nagging_father/01.webp?v=5be370ae","w":210,"h":355},{"src":"/wedding-run/obs/04/nagging_father/02.webp?v=de77532c","w":210,"h":355}],"anim":true,"kind":"ground","hitbox":{"x":47,"y":39,"w":106,"h":311},"pivot":{"x":100,"y":353},"scaleHint":0.74,"fps":3},
    ],
  },
  {
    id: "05_bridal_boutique", name: "드레스 매장",
    bg: {"src":"/wedding-run/bg/05.webp?v=69d644f3","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/05.webp?v=a5867905","w":2086,"h":175,"topY":3,"faceY":42,"solidX0":26,"solidX1":2059},
    obstacles: [
      // 금색 받침의 드레스 마네킹(1장) → 정적 지상, 점프. 위쪽 목 기둥은 충돌 제외
      {"key":"dress_mannequin","name":"드레스 마네킹","frames":[{"src":"/wedding-run/obs/05/dress_mannequin/01.webp?v=4c5d33b3","w":262,"h":346}],"anim":false,"kind":"ground","hitbox":{"x":57,"y":95,"w":153,"h":237},"pivot":{"x":133,"y":345},"scaleHint":0.72},
      // 바퀴 달린 금색 행거에 드레스 3벌(1장), 드레스가 바닥 근처까지 내려옴 → 밑으로 못 지나감, 점프
      {"key":"dress_rack","name":"드레스 행거","frames":[{"src":"/wedding-run/obs/05/dress_rack/01.webp?v=fecea106","w":335,"h":298}],"anim":false,"kind":"ground","hitbox":{"x":30,"y":53,"w":256,"h":232},"pivot":{"x":158,"y":296},"scaleHint":0.62},
    ],
  },
  {
    id: "06_appliance_store", name: "가전 매장",
    bg: {"src":"/wedding-run/bg/06.webp?v=2feabb9f","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/06.webp?v=c1afa11f","w":2111,"h":106,"topY":1,"faceY":36,"solidX0":34,"solidX1":2076},
    obstacles: [
      // 드럼 세탁기(1장) → 정적 지상, 점프
      {"key":"bespoke_washer","name":"세탁기","frames":[{"src":"/wedding-run/obs/06/bespoke_washer/01.webp?v=b5af34c5","w":238,"h":278}],"anim":false,"kind":"ground","hitbox":{"x":14,"y":20,"w":210,"h":246},"pivot":{"x":119,"y":277},"scaleHint":0.58},
      // 바퀴 달린 스탠드형 TV(1장, 사양서 "이동식 TV") — 기둥·받침이 바닥까지 있어 밑으로 못 지나감 → 굴러오는 지상 장애물, 점프(1장이라 애니 없이 이동만)
      {"key":"lg_stanbyme","name":"이동식 TV","frames":[{"src":"/wedding-run/obs/06/lg_stanbyme/01.webp?v=f5c96065","w":195,"h":346}],"anim":false,"kind":"moving-ground","hitbox":{"x":26,"y":21,"w":141,"h":316},"pivot":{"x":96,"y":345},"scaleHint":0.72},
      // 수평·위로 20°·아래로 20° 3모션으로 날아옴(오른쪽 향함) → 공중 장애물, 슬라이드
      {"key":"flying_dyson","name":"날아다니는 헤어드라이어","frames":[{"src":"/wedding-run/obs/06/flying_dyson/01.webp?v=b63965fc","w":294,"h":202},{"src":"/wedding-run/obs/06/flying_dyson/02.webp?v=e74f654c","w":294,"h":202},{"src":"/wedding-run/obs/06/flying_dyson/03.webp?v=1d876ddd","w":294,"h":202}],"anim":true,"kind":"flying","hitbox":{"x":37,"y":36,"w":234,"h":115},"pivot":{"x":154,"y":202},"scaleHint":0.42,"fps":8,"clearance":0.7},
    ],
  },
  {
    id: "07_planner_office", name: "웨딩플래너 상담",
    bg: {"src":"/wedding-run/bg/07.webp?v=110963fb","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/07.webp?v=7abe70e3","w":2068,"h":152,"topY":1,"faceY":39,"solidX0":49,"solidX1":2017},
    obstacles: [
      // 낮은 받침 위 펼친 두꺼운 앨범(1장) → 낮은 지상, 점프
      {"key":"wedding_album","name":"웨딩 앨범","frames":[{"src":"/wedding-run/obs/07/wedding_album/01.webp?v=9592695c","w":330,"h":221}],"anim":false,"kind":"ground","hitbox":{"x":35,"y":38,"w":256,"h":171},"pivot":{"x":163,"y":220},"scaleHint":0.46},
      // 세워 둔 계약서 폴더 더미(1장) → 지상, 점프
      {"key":"contract_stack","name":"계약서 더미","frames":[{"src":"/wedding-run/obs/07/contract_stack/01.webp?v=02a0f3ac","w":301,"h":269}],"anim":false,"kind":"ground","hitbox":{"x":66,"y":36,"w":202,"h":226},"pivot":{"x":167,"y":268},"scaleHint":0.56},
      // 부채꼴 원단 샘플+줄자 한 덩어리(1장) → 낮은 지상, 점프
      {"key":"fabric_samples","name":"원단 샘플","frames":[{"src":"/wedding-run/obs/07/fabric_samples/01.webp?v=73d32e82","w":280,"h":230}],"anim":false,"kind":"ground","hitbox":{"x":41,"y":34,"w":206,"h":185},"pivot":{"x":144,"y":229},"scaleHint":0.48},
    ],
  },
  {
    id: "08_empty_hall", name: "빈 웨딩홀",
    bg: {"src":"/wedding-run/bg/08.webp?v=84219107","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/08.webp?v=389956c5","w":2118,"h":186,"topY":4,"faceY":50,"solidX0":47,"solidX1":2072},
    obstacles: [
      // 양쪽 기둥+낮은 가로보(manifest: "wide open space underneath for slide") → 가로보만 충돌, 기둥 사이로 슬라이드. 기둥은 통과(플레이어 뒤에 그릴 것)
      {"key":"floral_arch","name":"꽃 아치","frames":[{"src":"/wedding-run/obs/08/floral_arch/01.webp?v=74a139b2","w":891,"h":484}],"anim":false,"kind":"air","hitbox":{"x":50,"y":38,"w":792,"h":107},"pivot":{"x":446,"y":481},"scaleHint":1.009,"clearance":0.7},
      // 리본 단 하객 의자(1장) → 지상, 점프
      {"key":"guest_chair","name":"하객 의자","frames":[{"src":"/wedding-run/obs/08/guest_chair/01.webp?v=2b460f94","w":202,"h":269}],"anim":false,"kind":"ground","hitbox":{"x":31,"y":34,"w":147,"h":225},"pivot":{"x":104,"y":268},"scaleHint":0.56},
      // 좁고 높은 금색 꽃 장식대(1장) → 지상, 점프. 위쪽 꽃 덩어리 폭으로 충돌
      {"key":"flower_pedestal","name":"꽃 장식대","frames":[{"src":"/wedding-run/obs/08/flower_pedestal/01.webp?v=8d7fa403","w":161,"h":346}],"anim":false,"kind":"ground","hitbox":{"x":39,"y":36,"w":90,"h":304},"pivot":{"x":84,"y":345},"scaleHint":0.72},
    ],
  },
  {
    id: "09_guest_hall", name: "하객 웨딩홀",
    bg: {"src":"/wedding-run/bg/09.webp?v=facbf6f7","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/09.webp?v=1457ad18","w":2117,"h":186,"topY":6,"faceY":63,"solidX0":65,"solidX1":2050},
    obstacles: [
      // 제자리 하객 둘, 손 벌림↔박수 2모션(이동 없음) → 정적 지상(애니), 점프
      {"key":"clapping_guests","name":"박수치는 하객","frames":[{"src":"/wedding-run/obs/09/clapping_guests/01.webp?v=e656700a","w":304,"h":346},{"src":"/wedding-run/obs/09/clapping_guests/02.webp?v=6cc45752","w":304,"h":346}],"anim":true,"kind":"ground","hitbox":{"x":45,"y":51,"w":212,"h":290},"pivot":{"x":151,"y":344},"scaleHint":0.72,"fps":4},
      // 서서 촬영↔쪼그려 촬영 2모션(제자리) → 정적 지상(애니), 점프. 이벤트 "웨딩 촬영" 플래시 연출에 재사용 가능
      {"key":"wedding_photographer","name":"촬영하는 사진사","frames":[{"src":"/wedding-run/obs/09/wedding_photographer/01.webp?v=b1c1920e","w":294,"h":326},{"src":"/wedding-run/obs/09/wedding_photographer/02.webp?v=7e864572","w":294,"h":326}],"anim":true,"kind":"ground","hitbox":{"x":58,"y":52,"w":163,"h":269},"pivot":{"x":140,"y":325},"scaleHint":0.68,"fps":2},
    ],
  },
  {
    id: "10_airplane", name: "비행기",
    bg: {"src":"/wedding-run/bg/10.webp?v=9dea9a27","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/10.webp?v=ed712021","w":1884,"h":106,"topY":2,"faceY":41,"solidX0":27,"solidX1":1857},
    obstacles: [
      // 바퀴 달린 기내 카트(1장) → 통로를 굴러오는 지상 장애물, 점프. 위 컵은 충돌 제외
      {"key":"service_cart","name":"서비스 카트","frames":[{"src":"/wedding-run/obs/10/service_cart/01.webp?v=75bf205b","w":200,"h":298}],"anim":false,"kind":"moving-ground","hitbox":{"x":29,"y":67,"w":155,"h":221},"pivot":{"x":106,"y":297},"scaleHint":0.62},
      // 손잡이 뽑은 캐리어(1장) → 정적 지상, 점프. 뽑은 손잡이는 충돌 제외
      {"key":"travel_luggage","name":"여행 캐리어","frames":[{"src":"/wedding-run/obs/10/travel_luggage/01.webp?v=07056eba","w":155,"h":269}],"anim":false,"kind":"ground","hitbox":{"x":18,"y":94,"w":116,"h":168},"pivot":{"x":77,"y":268},"scaleHint":0.56},
    ],
  },
  {
    id: "11_bali", name: "발리",
    bg: {"src":"/wedding-run/bg/11.webp?v=d168553d","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/11.webp?v=bddfbc3d","w":2101,"h":147,"topY":8,"faceY":39,"solidX0":27,"solidX1":2072},
    obstacles: [
      // 바나나 든 원숭이가 오른쪽으로 뛰는 2모션 → 움직이는 지상, 점프. 꼬리는 충돌 제외
      {"key":"playful_monkey","name":"원숭이","frames":[{"src":"/wedding-run/obs/11/playful_monkey/01.webp?v=1d3b31c1","w":252,"h":221},{"src":"/wedding-run/obs/11/playful_monkey/02.webp?v=0c4e4a5e","w":252,"h":221}],"anim":true,"kind":"moving-ground","hitbox":{"x":106,"y":49,"w":121,"h":164},"pivot":{"x":167,"y":220},"scaleHint":0.46,"fps":8},
      // 받침에 세운 서핑보드(1장) → 좁고 높은 정적 지상, 점프
      {"key":"surfboard","name":"서핑보드","frames":[{"src":"/wedding-run/obs/11/surfboard/01.webp?v=d8d19214","w":147,"h":346}],"anim":false,"kind":"ground","hitbox":{"x":36,"y":39,"w":93,"h":297},"pivot":{"x":82,"y":345},"scaleHint":0.72},
      // 넓은 짚 파라솔 + 가는 기둥 → 갓(술 포함)만 충돌, 밑으로 슬라이드. 가는 기둥은 통과(플레이어 뒤에 그릴 것)
      {"key":"beach_umbrella","name":"파라솔","frames":[{"src":"/wedding-run/obs/11/beach_umbrella/01.webp?v=a8441edb","w":507,"h":560}],"anim":false,"kind":"air","hitbox":{"x":40,"y":96,"w":426,"h":137},"pivot":{"x":252,"y":558},"scaleHint":1.208,"clearance":0.7},
    ],
  },
  {
    id: "12_newlywed_home", name: "신혼집",
    bg: {"src":"/wedding-run/bg/12.webp?v=25f54ad5","w":1870,"h":841,"seamless":false},
    platform: {"src":"/wedding-run/platform/12.webp?v=7a362e5e","w":2084,"h":157,"topY":1,"faceY":50,"solidX0":60,"solidX1":2023},
    obstacles: [
      // 상자 3개+담요 더미(1장) → 정적 지상, 점프
      {"key":"moving_boxes","name":"이삿짐 상자","frames":[{"src":"/wedding-run/obs/12/moving_boxes/01.webp?v=5bddb07a","w":362,"h":269}],"anim":false,"kind":"ground","hitbox":{"x":40,"y":38,"w":288,"h":219},"pivot":{"x":184,"y":267},"scaleHint":0.56},
      // 바닥을 오른쪽으로 움직이는 납작한 로봇청소기 2모션(02=먼지 퍽) → 움직이는 낮은 지상, 점프. 먼지 구름은 충돌 제외
      {"key":"robot_vacuum","name":"로봇청소기","frames":[{"src":"/wedding-run/obs/12/robot_vacuum/01.webp?v=46489887","w":312,"h":128},{"src":"/wedding-run/obs/12/robot_vacuum/02.webp?v=7d5221ce","w":312,"h":128}],"anim":true,"kind":"moving-ground","hitbox":{"x":54,"y":19,"w":234,"h":104},"pivot":{"x":171,"y":127},"scaleHint":0.24,"fps":6},
      // 오른쪽으로 뛰는 고양이 2모션 → 움직이는 지상, 점프. 꼬리는 충돌 제외
      {"key":"home_cat","name":"고양이","frames":[{"src":"/wedding-run/obs/12/home_cat/01.webp?v=c9c814dc","w":314,"h":211},{"src":"/wedding-run/obs/12/home_cat/02.webp?v=35a70bde","w":314,"h":211}],"anim":true,"kind":"moving-ground","hitbox":{"x":101,"y":38,"w":172,"h":167},"pivot":{"x":186,"y":210},"scaleHint":0.44,"fps":8},
    ],
  },
];

export const WR_CHAR: WrCharStage[] = [
  {"stage":1,"key":"01_dress","label":"웨딩드레스 신부","frames":{"run_01":{"src":"/wedding-run/char/01_dress/run_01.webp?v=b85fb634","w":764,"h":466},"run_02":{"src":"/wedding-run/char/01_dress/run_02.webp?v=e88aab4b","w":764,"h":466},"jump":{"src":"/wedding-run/char/01_dress/jump.webp?v=bd11f4f0","w":764,"h":466},"slide":{"src":"/wedding-run/char/01_dress/slide.webp?v=ab8ec6e5","w":764,"h":466},"stumble":{"src":"/wedding-run/char/01_dress/stumble.webp?v=0b60e1cb","w":764,"h":466},"celebrate":{"src":"/wedding-run/char/01_dress/celebrate.webp?v=b35fa3f6","w":764,"h":466}},"pivot":{"x":406,"y":464},"hitbox":{"run":{"x":282,"y":108,"w":249,"h":346},"jump":{"x":288,"y":110,"w":239,"h":330},"slide":{"x":203,"y":228,"w":333,"h":227}},"refH":410,"slideScale":0.85,"runCycle":["run_01","run_02"]},
  {"stage":2,"key":"02_bouquet","label":"부케를 든 신부","frames":{"run_01":{"src":"/wedding-run/char/02_bouquet/run_01.webp?v=5a1a1172","w":710,"h":438},"run_02":{"src":"/wedding-run/char/02_bouquet/run_02.webp?v=ad6b262c","w":710,"h":438},"jump":{"src":"/wedding-run/char/02_bouquet/jump.webp?v=7da4d135","w":710,"h":438},"slide":{"src":"/wedding-run/char/02_bouquet/slide.webp?v=6c1dfa63","w":710,"h":438},"stumble":{"src":"/wedding-run/char/02_bouquet/stumble.webp?v=cad8ea83","w":710,"h":438},"celebrate":{"src":"/wedding-run/char/02_bouquet/celebrate.webp?v=89e05248","w":710,"h":438}},"pivot":{"x":398,"y":435},"hitbox":{"run":{"x":260,"y":68,"w":275,"h":349},"jump":{"x":268,"y":84,"w":256,"h":328},"slide":{"x":189,"y":196,"w":354,"h":230}},"refH":428,"slideScale":0.85,"runCycle":["run_01","run_02"]},
  {"stage":3,"key":"03_veil_tiara","label":"부케·베일·티아라 신부","frames":{"run_01":{"src":"/wedding-run/char/03_veil_tiara/run_01.webp?v=c84c9ef6","w":699,"h":438},"run_02":{"src":"/wedding-run/char/03_veil_tiara/run_02.webp?v=b0a9c7dd","w":699,"h":438},"jump":{"src":"/wedding-run/char/03_veil_tiara/jump.webp?v=7511ba66","w":699,"h":438},"slide":{"src":"/wedding-run/char/03_veil_tiara/slide.webp?v=98158291","w":699,"h":438},"stumble":{"src":"/wedding-run/char/03_veil_tiara/stumble.webp?v=1e16b349","w":699,"h":438},"celebrate":{"src":"/wedding-run/char/03_veil_tiara/celebrate.webp?v=c9bba925","w":699,"h":438}},"pivot":{"x":401,"y":436},"hitbox":{"run":{"x":261,"y":67,"w":280,"h":356},"jump":{"x":261,"y":86,"w":283,"h":325},"slide":{"x":174,"y":147,"w":381,"h":278}},"refH":429,"slideScale":0.75,"runCycle":["run_01","run_02"]},
  // ⚠ run_01 은 신랑이 신부 뒤(왼쪽), run_02·jump·slide 는 신랑이 앞(오른쪽) — 번갈아 쓰면 신랑이 앞뒤로 순간이동하므로 평소 달리기는 run_02 한 장 + 코드 바운스(위아래 2~3%·살짝 기울기). run_01 은 신부 위치만 맞춰 둠(충돌 상자는 신랑이 앞에 있는 run_02 기준이라 충돌이 켜진 동안엔 쓰지 말 것). 합류 연출은 WR_GROOM(신랑만 오려낸 2프레임)
  {"stage":4,"key":"04_groom_joins","label":"신랑 합류(나란히)","frames":{"run_01":{"src":"/wedding-run/char/04_groom_joins/run_01.webp?v=52100625","w":938,"h":419},"run_02":{"src":"/wedding-run/char/04_groom_joins/run_02.webp?v=3a05b9aa","w":938,"h":419},"jump":{"src":"/wedding-run/char/04_groom_joins/jump.webp?v=29e475ad","w":938,"h":419},"slide":{"src":"/wedding-run/char/04_groom_joins/slide.webp?v=1a5e2fd7","w":938,"h":419},"stumble":{"src":"/wedding-run/char/04_groom_joins/stumble.webp?v=f6fe477c","w":938,"h":419},"celebrate":{"src":"/wedding-run/char/04_groom_joins/celebrate.webp?v=0a03f9df","w":938,"h":419}},"pivot":{"x":510,"y":417},"hitbox":{"run":{"x":591,"y":83,"w":270,"h":319},"jump":{"x":592,"y":108,"w":259,"h":285},"slide":{"x":499,"y":186,"w":361,"h":223}},"refH":386,"slideScale":0.88,"runCycle":["run_02"],"note":"run_01 은 신랑이 신부 뒤(왼쪽), run_02·jump·slide 는 신랑이 앞(오른쪽) — 번갈아 쓰면 신랑이 앞뒤로 순간이동하므로 평소 달리기는 run_02 한 장 + 코드 바운스(위아래 2~3%·살짝 기울기). run_01 은 신부 위치만 맞춰 둠(충돌 상자는 신랑이 앞에 있는 run_02 기준이라 충돌이 켜진 동안엔 쓰지 말 것). 합류 연출은 WR_GROOM(신랑만 오려낸 2프레임)"},
  {"stage":5,"key":"05_holding_hands","label":"손잡고 함께","frames":{"run_01":{"src":"/wedding-run/char/05_holding_hands/run_01.webp?v=cd24e7b1","w":691,"h":427},"run_02":{"src":"/wedding-run/char/05_holding_hands/run_02.webp?v=a731654e","w":691,"h":427},"jump":{"src":"/wedding-run/char/05_holding_hands/jump.webp?v=401c1669","w":691,"h":427},"slide":{"src":"/wedding-run/char/05_holding_hands/slide.webp?v=292761a6","w":691,"h":427},"stumble":{"src":"/wedding-run/char/05_holding_hands/stumble.webp?v=327f2262","w":691,"h":427},"celebrate":{"src":"/wedding-run/char/05_holding_hands/celebrate.webp?v=f6973df4","w":691,"h":427}},"pivot":{"x":308,"y":424},"hitbox":{"run":{"x":337,"y":70,"w":283,"h":339},"jump":{"x":336,"y":82,"w":271,"h":322},"slide":{"x":216,"y":165,"w":379,"h":245}},"refH":405,"slideScale":0.84,"runCycle":["run_01","run_02"]},
];

export const WR_UI: Record<WrUiKey, WrUiImg> = {
  start: {"src":"/wedding-run/ui/start.webp?v=8d5d50f1","w":640,"h":160,"hit":{"x":0,"y":0,"w":639,"h":159}},
  resume: {"src":"/wedding-run/ui/resume.webp?v=6c75f8e3","w":640,"h":157,"hit":{"x":0,"y":0,"w":640,"h":156}},
  retry: {"src":"/wedding-run/ui/retry.webp?v=d933aea5","w":640,"h":183,"hit":{"x":0,"y":0,"w":639,"h":183}},
  ranking: {"src":"/wedding-run/ui/ranking.webp?v=65861b4e","w":640,"h":197,"hit":{"x":1,"y":0,"w":639,"h":196}},
  share: {"src":"/wedding-run/ui/share.webp?v=4b1f5ecb","w":640,"h":162,"hit":{"x":0,"y":0,"w":639,"h":161}},
  pause: {"src":"/wedding-run/ui/pause.webp?v=0f0c13b4","w":240,"h":239,"hit":{"x":0,"y":0,"w":240,"h":238}},
  sound: {"src":"/wedding-run/ui/sound.webp?v=3ee546d7","w":240,"h":240,"hit":{"x":0,"y":0,"w":239,"h":240}},
  sound_off: {"src":"/wedding-run/ui/sound_off.webp?v=615c54b0","w":240,"h":249,"hit":{"x":0,"y":0,"w":239,"h":249}},
  home: {"src":"/wedding-run/ui/home.webp?v=1282e4b1","w":240,"h":237,"hit":{"x":0,"y":0,"w":239,"h":237}},
  close: {"src":"/wedding-run/ui/close.webp?v=5a2dc609","w":240,"h":241,"hit":{"x":0,"y":0,"w":240,"h":240}},
  jump: {"src":"/wedding-run/ui/jump.webp?v=28d1e090","w":360,"h":353,"hit":{"x":0,"y":0,"w":359,"h":353}},
  slide: {"src":"/wedding-run/ui/slide.webp?v=badf4377","w":360,"h":358,"hit":{"x":0,"y":0,"w":359,"h":357}},
  score_hud: {"src":"/wedding-run/ui/score_hud.webp?v=7ba5f08f","w":640,"h":230,"hit":{"x":1,"y":1,"w":638,"h":229},"refOnly":true},
  pause_panel: {"src":"/wedding-run/ui/pause_panel.webp?v=73810492","w":569,"h":800,"hit":{"x":1,"y":1,"w":568,"h":799},"refOnly":true},
  result_panel: {"src":"/wedding-run/ui/result_panel.webp?v=5459dc89","w":509,"h":800,"hit":{"x":1,"y":1,"w":508,"h":799},"refOnly":true},
  hud_blank: {"src":"/wedding-run/ui/hud_blank.webp?v=28df18be","w":720,"h":171,"hit":{"x":1,"y":0,"w":718,"h":171}},
  modal_blank: {"src":"/wedding-run/ui/modal_blank.webp?v=270cfe8e","w":658,"h":1000,"hit":{"x":1,"y":1,"w":656,"h":999}},
};

/**
 * 신랑 단독 2프레임 — 원본에 신랑 혼자 모션이 없어 4단계 run_01·run_02 에서 신랑 덩어리만 오려냄(그림 수정 없음).
 * 사양서 [10] "신랑 합류: 옆에서 뛰어 들어오는 연출" 용: 3단계 신부가 달리는 동안 화면 왼쪽 밖에서 신랑이 뛰어 들어와
 * 신부 피벗 + joinOffset 자리에 닿으면 WR_CHAR[3](4단계) 프레임으로 바꾸면 이음매 없음.
 * 표시 배율은 4단계와 같게: scale = (원하는 신부 몸 높이) ÷ WR_CHAR[3].refH. joinOffset 도 4단계 캔버스 px(같은 배율 곱).
 */
export const WR_GROOM: { frames: Record<'run_01' | 'run_02', WrImg>; pivot: { x: number; y: number }; refH: number; joinOffset: { x: number; y: number } } = {"frames":{"run_01":{"src":"/wedding-run/char/groom/run_01.webp?v=804c8275","w":293,"h":395},"run_02":{"src":"/wedding-run/char/groom/run_02.webp?v=76b32d73","w":293,"h":395}},"pivot":{"x":167,"y":393},"refH":380,"joinOffset":{"x":292,"y":-6}};

/** 첫 진입 화면 일러스트(가로용, 왼쪽 빈 공간에 제목·버튼을 별도 레이어로) */
export const WR_ENTRY: WrImg = {"src":"/wedding-run/entry.webp?v=b79ebcde","w":1870,"h":841};

/** 머리 위 장애물 공통 높이(refH 배수) */
export const WR_AIR_CLEARANCE = 0.7;
export const WR_ASSET_STATS = { files: 121, bytes: 6418790 };

/** 프리로딩용 — 구간 번호(0부터)까지 필요한 이미지 목록. 처음엔 0~1구간만, 이후 다음 구간을 미리 받는 식으로 쓰면 첫 로딩이 짧음 */
export function wrSegmentSrcs(index: number): string[] {
  const sg = WR_SEGMENTS[index];
  if (!sg) return [];
  return [sg.bg.src, sg.platform.src, ...sg.obstacles.flatMap((o) => o.frames.map((f) => f.src))];
}
export function wrCharSrcs(): string[] {
  return [...WR_CHAR.flatMap((c) => Object.values(c.frames).map((f) => f.src)), ...Object.values(WR_GROOM.frames).map((f) => f.src)];
}
export function wrUiSrcs(includeRefOnly = false): string[] {
  return Object.values(WR_UI).filter((u) => includeRefOnly || !u.refOnly).map((u) => u.src);
}
