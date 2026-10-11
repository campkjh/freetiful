# 웨딩런 에셋 매핑표 (261011 사장 요청 — 2D 횡스크롤 러너, 첨부 이미지 실제 사용)

> 사람용 표. 코드는 `assets.ts`(자동 생성)만 보면 된다. 숫자는 모두 **최적화본 이미지 픽셀** 기준.
> 원본은 수정하지 않았다. 아래 값은 `apps/web/scripts/wedding-run-assets.mjs` 가 원본을 열어 계산한 것이다(그림 판단은 스크립트 안 `why`·이 문서에 근거를 적음).

## 1. 한눈에

| 항목 | 원본 | 최적화본 |
|---|---|---|
| 배경 | 12장 PNG 1870×841(불투명) | `public/wedding-run/bg/NN.webp` 12장, 해상도 그대로, 76~226KB/장(상한 400KB) |
| 발판 | 12장 PNG(투명 여백 포함 2172×724 등) | `platform/NN.webp` 12장, 투명 여백 잘라냄(trim), 원본 해상도 |
| 캐릭터 | 30장 PNG 1536×1024 등(5단계 × 6모션) | `char/<단계>/<모션>.webp` 30장 + **신랑 단독 2장**(`char/groom/`, 4단계 그림에서 오려냄) |
| 장애물 | 47장 PNG(32종, 12구간) | `obs/NN/<key>/NN.webp` 47장 |
| UI | 17장 PNG | `ui/<key>.webp` 17장 |
| 첫 진입 일러스트 | 1장 PNG 1870×841 | `entry.webp` 1870×841, 200KB |
| **합계** | **119장, 181.5MB(173 MiB)** | **121장, 6.4MB(6,418,790 B = 6.12 MiB)** — 목표 20MB 이하 |

- 형식: WebP(알파 유지) 품질 82/알파 90, 배경·진입 화면은 불투명 WebP 품질 80. 주소에 `?v=<내용 해시 8자>` 를 붙여 다시 만들면 캐시가 자동으로 갈림.
- 모두 **2D 평면 일러스트**다(3D 모델·텍스처 아님). 이 폴더에 있던 예전 three.js 3D 화면·엔진은 걷어냈고(261011 통합), 지금 게임은 Phaser 3 2D 러너(`game/`)가 이 에셋을 쓴다.
- 파일명은 원본 폴더 구조를 따랐다. 사양서의 파일명과 실제 첨부 파일명이 다른 경우는 없었다(실제 파일 기준으로 연결).

## 2. 다시 만들기

```bash
# 원본 zip 6개(~/Downloads/freetiful-wedding-{backgrounds,platforms,bride-motions,obstacles,entry,ui}.zip)를 한 폴더에 푼 뒤
node apps/web/scripts/wedding-run-assets.mjs --src <그 폴더> [--debug-json <확인용 json 경로>]
```
- `public/wedding-run/` 를 지우고 새로 쓰며 `src/app/wedding-run/assets.ts` 를 덮어쓴다(손으로 고치지 말 것). 약 30초.
- WebP 인코딩은 결정적이라 원본이 같으면 결과·해시도 같다.

## 3. 좌표 약속(게임 코드가 지켜야 할 것)

- **pivot = 바닥 접점.** 캐릭터는 같은 단계 6모션이 **한 캔버스·같은 피벗**(발바닥 정렬 + 몸통 알파 마스크 겹침 최대 위치로 가로 정렬). Phaser: `setOrigin(pivot.x/w, pivot.y/h)`.
- **캐릭터 표시 배율** = 원하는 몸 높이 ÷ `refH`(단계마다). 그러면 1~5단계 내내 신부 키가 같다.
- **4·5단계 피벗은 "신부" 발밑**(1~3단계와 같은 규칙을 신부 덩어리에만 적용) → 단계가 바뀌어도 신부가 제자리, 신랑은 그 오른쪽(앞)에 붙는다.
- **장애물 표시 배율**: 캔버스 높이 `h` 가 화면에서 `scaleHint × (캐릭터 refH 의 화면 높이)` 가 되게.
- **머리 위 장애물**(`air`·`flying`): 충돌 상자 아래 끝이 땅에서 `refH × clearance(0.7)` 높이. `air`(아치·파라솔)는 scaleHint 를 이 높이에 맞춰 계산해 두었으니 땅에 세우기만 하면 된다. `flying` 은 게임이 그 높이로 띄운다.
  - 점검(스크립트 출력): 달리기 충돌 위끝 0.86~0.87 refH > 0.7 → 충돌, 슬라이드(slideScale 적용) 위끝 0.48~0.54 refH < 0.7 → 통과. 5단계 모두 통과.
- **slideScale**: 원본 슬라이드 포즈가 생각보다 높다(달리기 키의 82~96%, 3단계는 베일 때문에 96%). 슬라이드 프레임을 피벗 기준 이 배율(0.75~0.88, 가로세로 같은 배율)로 줄여 그리면 머리 위 장애물 밑을 지나는 그림이 납득된다. `hitbox.slide` 도 같은 배율로.
- **장애물은 모두 오른쪽을 향한다**(원본 그대로 — 비둘기·어린이·행렬·원숭이·고양이·로봇청소기·드라이어). 플레이어 쪽으로 달려오게 하려면 `setFlipX(true)` 하고 hitbox.x → `w - x - w박스`, pivot.x → `w - pivot.x`.
- **배경 12장 모두 좌우 끝이 이어지지 않는다**(끝 열 색 차가 이웃 열 차의 5~15배). 스크롤하며 반복할 땐 좌우 반전 교대 붙이기나 느린 시차(parallax)+구간 교차 전환으로.
- **발판도 양끝 무봉제가 아니다**(README 명시). `solidX0~solidX1`(윗면이 평평한 범위)끼리 겹쳐 이어 붙이고, 바닥 틈은 그 범위 밖을 비워 만든다. 발은 `topY~faceY` 사이(가운데쯤)에 두면 2.5D 그림상 자연스럽다.
- UI `hit` 은 투명 여백을 뺀 실제 버튼 범위다. trim 했으므로 거의 이미지 전체와 같다. **화면에서 최소 44×44 CSS px** 이 되게 크기를 정할 것(원형 컨트롤 240px 이미지를 44px 이상으로 표시).

## 4. 판단 근거

- **충돌 상자**: 알파≥128 픽셀만(반투명 빛 효과·안티앨리어싱 가장자리 제외)으로 가로·세로 **픽셀 질량 분위수 상자**를 만들었다. 기본 7%~93%(가로)·7%~99.5%(세로), 물건마다 그림을 보고 조정(빨대·든 폰·뻗은 팔·꼬리·먼지 구름·뽑은 손잡이 제외 등 — 표의 근거 칸). 캐릭터는 뒤로 날리는 머리·드레스 자락을 빼려고 가로 24%~95%(앞쪽은 거의 그림 끝까지 → 앞에서 부딪히는 그림이 맞음).
- **커플 단계(4·5)**: 사양서 [4] "커플이 됐다고 충돌 난도가 갑자기 높아지지 않게" → 충돌 폭을 1단계 폭(refH 대비)의 1.15배로 제한. **앞(오른쪽, 장애물이 오는 쪽) 끝은 그대로 두고 뒤쪽(신부 드레스 자락)을 깎았다** → 신랑 앞에서 부딪히는 그림은 맞고, 뒤쪽은 관대.
- **kind**: 지상=점프 / 머리 위(air, 땅에 서 있음)=슬라이드 / 움직이는 지상(moving-ground)=점프 / 날아다님(flying)=슬라이드. 정적·이동 구분은 "스스로 이동하는가"(바퀴·달리기·걷기) 기준, 제자리 포즈만 바뀌는 인물(시어머니·아버지·하객·사진사)은 `ground` + `anim`.
  - 꽃 아치: manifest 문구 "wide open space underneath for slide" + 그림(양 기둥 + 낮은 가로보) → 가로보만 충돌. 파라솔: 넓은 갓 + 가는 기둥 → 갓만 충돌. 둘 다 기둥은 통과하므로 **플레이어보다 뒤 레이어에 그릴 것**.
  - 이동식 TV: 기둥·받침이 바닥까지 있어 밑으로 못 지나감 → 굴러오는 지상(점프).
- **scaleHint**: 사람(치비) 0.58~0.74, 큰 물건 0.56~0.72, 작은 물건·동물 0.44~0.5, 로봇청소기 0.24, 날아다니는 것 0.42~0.5, air(아치 1.01·파라솔 1.21)는 clearance 로 자동 계산. 지상 장애물 충돌 위끝은 0.20~0.67 refH → 점프 높이는 refH 의 0.8 이상 권장. 844×390 화면에 캐릭터 refH=화면 27% 로 12구간을 배치해 크기를 눈으로 확인했다(확인 시트 `assets-scale.png`).
- **발판 topY**: 열마다 첫 불투명(알파≥128) 행의 중앙값. **faceY**: 윗면 기준색에서 크게 벗어나는 첫 행(자동) — 쪽매 사선·얇은 윗테에 속는 03·10·12 는 확대 눈금으로 보고 고정값(22·41·50).
- **모션 정렬**: 세로는 발바닥(가장 아래 불투명 행, 티끌 무시), 가로는 알파 마스크 겹침이 최대인 위치(8px 격자로 넓게 → 2px 격자로 좁게). 날아다니는 장애물은 가로·세로 모두, 어린이 03(공중 깡충)도 세로를 겹침으로 맞춰 살짝 떠 있게 했다.

## 5. 누락·특이 사항(정확히)

**사양서에는 있는데 첨부 이미지가 없는 것** — 코드로 그리거나 기존 에셋 조합으로 보완해야 함:
1. 수집 아이템 **하트**, **축의금 봉투** 이미지 없음(사양서 [1]·[9]).
2. **바닥 틈(구멍)** 전용 이미지 없음 → 발판 사이를 비워서 표현(solidX 범위 사용).
3. 이벤트 효과 이미지 없음: 꽃잎(부케 획득), 반짝임(본식 준비 완료), 플래시(웨딩 촬영 — 사진사 장애물 그림 재사용 가능), 보호막(커플 응원), **신혼집 불 켜짐**(12 배경 위에 효과로).
4. **신랑 단독 모션 없음** → 4단계 run_01·run_02 에서 신랑 덩어리(연결 요소)만 오려 `WR_GROOM` 2프레임으로 만들었다(그림 자체는 손대지 않음). "신랑 합류: 옆에서 뛰어 들어오는 연출" 용. `joinOffset`(292,−6, 4단계 캔버스 px) 자리에 닿으면 4단계 프레임으로 바꾸면 이음매 없음(확인 시트에서 원본 신랑과 정확히 겹침 확인).
5. **서 있기(대기) 모션 없음** → 진입 화면은 `entry.webp` 일러스트, 단계 전환·도착은 `celebrate`.
6. 랭킹·도움말·확인 팝업 **전용 패널 없음** → `modal_blank` 위에 동적 텍스트. 진행 표시(구간 바) 아이콘·게임 제목 로고 없음 → 텍스트/코드. 음원·효과음 파일 없음 → 사양서대로 없으면 오류 없이 무음.
7. **신혼집 '집' 그림 없음**(사양서 [10] '신혼집 도착 직전 집을 강조 · 집에 불이 켜지는 효과') → 지금 도착 연출의 집은 첨부 에셋이 아니라 **코드로 그린 단순 도형 집**(`game/textures.ts` 의 `makeHouse` → `TEX.house`·`TEX.houseLit` — 연보라 지붕·아이보리 벽·굴뚝·분홍 문·창문 둘·지붕 하트 창·'우리집' 팻말, 불 켜짐 판은 창문이 노랗게). 12 신혼집 거실 배경(소파·TV 실내) 안에 바깥에서 본 집 모양이 서 있어 **그림체·의미가 어긋난다**(261011 검증). 첨부 그림체의 '신혼집 현관문' 또는 '집 외관' 이미지 1장이 오면 같은 자리(`showHouse`)에 바꿔 끼우면 된다.
8. 코드로 그린 보조 그림 전체 목록(`game/textures.ts`): 하트·축의금 봉투(수집물) · 꽃잎·반짝임·먼지·하트 입자(효과) · 보호막 · 바닥 틈 그늘 · 신혼집 집(위 7) · 집 뒤 빛·따뜻한 빛 · 연습 장애물 위 말풍선('점프!'·'슬라이드!'). 나머지 화면 그림(배경·발판·캐릭터·장애물·UI·진입 일러스트)은 전부 첨부 에셋.

**원본의 특이점**:
- UI: 사양서 "17종" = 실제 파일 17개(README 목록과 일치, `sound_off` 는 02_controls 안). 누락 없음.
- 장애물: README "총 47장" = 실제 47장(32종: 1장짜리 정적 21종 + 여러 프레임 11종 26장). 누락 없음.
- 캐릭터 30장 = 5단계 × 6모션, 누락 없음. (03_veil_tiara manifest 는 slide·jump 순서로 적혀 있을 뿐 파일 내용은 정상.)
- **4단계 run_01 은 신랑이 신부 뒤(왼쪽)**, run_02·jump·slide·stumble·celebrate 는 신랑이 앞(오른쪽). 번갈아 쓰면 신랑이 앞뒤로 순간이동 → `runCycle: ['run_02']`(한 장 + 코드 바운스 권장). run_01 은 신부 위치만 맞춰 두었고 충돌 상자는 run_02 기준이라 **충돌이 켜진 동안엔 쓰지 말 것**. 이 때문에 4단계 캔버스만 가로가 넓다(938px).
- 장애물 원본 캔버스 크기가 프레임마다 다름(비둘기 1312×1199 vs 1536×1024, 원숭이·시어머니·아버지·하객·사진사도) → 정렬해 같은 캔버스로 맞춤.
- `03_panels`(score_hud·pause_panel·result_panel)는 **예시 숫자(1,280점·오늘 12위·최고기록 1,400점)와 버튼이 그려진 참고 이미지** → `refOnly: true`. 게임 화면에 그대로 쓰지 말고 `hud_blank`·`modal_blank` + 개별 버튼 + 동적 텍스트로.
- 진입 일러스트의 신랑은 검은 턱시도(모션 그림의 신랑은 라벤더 그레이 턱시도) — 원본 차이, 그대로 사용.
- 가전(세탁기·스탠바이미형 TV·다이슨형 드라이어)은 README 대로 "형태를 참고한 게임용 일러스트", 상표 글자 없음.
- 일부 이미지의 반투명 빛 효과는 픽셀의 0.1~0.9% 수준 — 충돌 계산에서 제외(알파<128).
- 사진사 2프레임(서기↔쪼그리기)은 충돌 상자 하나를 같이 써서 쪼그린 프레임에선 머리 위로 조금 남는다(2fps라 영향 작음).

**성능 참고**: 디코딩 후 GPU 메모리는 배경 1장 약 6.3MB(1870×841×4), 12장 다 올리면 약 75MB. 캐릭터 32장 약 41MB, 장애물 47장 약 17MB. 휴대폰에서는 처음엔 `wrSegmentSrcs(0~1)`+캐릭터+UI 만 받고 다음 구간을 미리 받는 식(구간 지연 로딩)을 권장(`assets.ts` 의 `wrSegmentSrcs`·`wrCharSrcs`·`wrUiSrcs`).

## 6. 원본 → 최적화본 → 쓰이는 곳

원본 경로 접두어 생략: `backgrounds/` = `freetiful-wedding-backgrounds/wedding-run-backgrounds/`, `platforms/` = `freetiful-wedding-platforms/wedding-run-platforms/`, `bride-motions/` = `freetiful-wedding-bride-motions/wedding-run-bride-motions/`, `obstacles/` = `freetiful-wedding-obstacles/wedding-run-obstacles/`, `ui/` = `freetiful-wedding-ui/wedding-run-ui/`. 최적화본은 `apps/web/public/wedding-run/` 아래(주소 `/wedding-run/...`).

### 배경 12장
| 구간 | 원본 | 최적화본 | 크기 | 용량 | 좌우 이음 | 쓰이는 곳 |
|---|---|---|---|---|---|---|
| 01 서울 | backgrounds/01_seoul/background.png (1870×841) | bg/01.webp | 1870×841 | 191KB | 안 이어짐(끝열 차 41.6 / 이웃열 차 5.3) | 서울 구간 배경 |
| 02 종로 | backgrounds/02_jongno/background.png (1870×841) | bg/02.webp | 1870×841 | 226KB | 안 이어짐(끝열 차 45.9 / 이웃열 차 4.3) | 종로 구간 배경 |
| 03 경복궁 | backgrounds/03_gyeongbokgung/background.png (1870×841) | bg/03.webp | 1870×841 | 215KB | 안 이어짐(끝열 차 43.3 / 이웃열 차 7.4) | 경복궁 구간 배경 |
| 04 상견례 | backgrounds/04_family_meeting/background.png (1870×841) | bg/04.webp | 1870×841 | 146KB | 안 이어짐(끝열 차 43.9 / 이웃열 차 4.1) | 상견례 구간 배경 |
| 05 드레스 매장 | backgrounds/05_bridal_boutique/background.png (1870×841) | bg/05.webp | 1870×841 | 143KB | 안 이어짐(끝열 차 35.9 / 이웃열 차 3.4) | 드레스 매장 구간 배경 |
| 06 가전 매장 | backgrounds/06_appliance_store/background.png (1870×841) | bg/06.webp | 1870×841 | 112KB | 안 이어짐(끝열 차 32.1 / 이웃열 차 4.1) | 가전 매장 구간 배경 |
| 07 웨딩플래너 상담 | backgrounds/07_planner_office/background.png (1870×841) | bg/07.webp | 1870×841 | 144KB | 안 이어짐(끝열 차 36.8 / 이웃열 차 5) | 웨딩플래너 상담 구간 배경 |
| 08 빈 웨딩홀 | backgrounds/08_empty_hall/background.png (1870×841) | bg/08.webp | 1870×841 | 137KB | 안 이어짐(끝열 차 26.6 / 이웃열 차 2.8) | 빈 웨딩홀 구간 배경 |
| 09 하객 웨딩홀 | backgrounds/09_guest_hall/background.png (1870×841) | bg/09.webp | 1870×841 | 214KB | 안 이어짐(끝열 차 50.5 / 이웃열 차 5.4) | 하객 웨딩홀 구간 배경 |
| 10 비행기 | backgrounds/10_airplane/background.png (1870×841) | bg/10.webp | 1870×841 | 97KB | 안 이어짐(끝열 차 14.5 / 이웃열 차 2.4) | 비행기 구간 배경 |
| 11 발리 | backgrounds/11_bali/background.png (1870×841) | bg/11.webp | 1870×841 | 183KB | 안 이어짐(끝열 차 41.3 / 이웃열 차 8.5) | 발리 구간 배경 |
| 12 신혼집 | backgrounds/12_newlywed_home/background.png (1870×841) | bg/12.webp | 1870×841 | 76KB | 안 이어짐(끝열 차 39.8 / 이웃열 차 2.7) | 신혼집 구간 배경 |

### 발판 12장
| 구간 | 원본(투명 여백 포함) | 최적화본(trim) | 용량 | topY | faceY | solidX0~X1 | 쓰이는 곳 |
|---|---|---|---|---|---|---|---|
| 01 서울 | platforms/01_seoul/platform.png (2019×779) | platform/01.webp 1965×169 | 46KB | 2 | 43 | 43~1921 | 서울 구간 바닥 |
| 02 종로 | platforms/02_jongno/platform.png (2172×724) | platform/02.webp 2028×126 | 34KB | 1 | 30 | 22~2003 | 종로 구간 바닥 |
| 03 경복궁 | platforms/03_gyeongbokgung/platform.png (2172×724) | platform/03.webp 1995×169 | 65KB | 2 | 22 | 19~1975 | 경복궁 구간 바닥 |
| 04 상견례 | platforms/04_family_meeting/platform.png (2172×724) | platform/04.webp 2026×150 | 43KB | 2 | 32 | 40~1984 | 상견례 구간 바닥 |
| 05 드레스 매장 | platforms/05_bridal_boutique/platform.png (2172×724) | platform/05.webp 2086×175 | 42KB | 3 | 42 | 26~2059 | 드레스 매장 구간 바닥 |
| 06 가전 매장 | platforms/06_appliance_store/platform.png (2172×724) | platform/06.webp 2111×106 | 15KB | 1 | 36 | 34~2076 | 가전 매장 구간 바닥 |
| 07 웨딩플래너 상담 | platforms/07_planner_office/platform.png (2172×724) | platform/07.webp 2068×152 | 27KB | 1 | 39 | 49~2017 | 웨딩플래너 상담 구간 바닥 |
| 08 빈 웨딩홀 | platforms/08_empty_hall/platform.png (2172×724) | platform/08.webp 2118×186 | 62KB | 4 | 50 | 47~2072 | 빈 웨딩홀 구간 바닥 |
| 09 하객 웨딩홀 | platforms/09_guest_hall/platform.png (2172×724) | platform/09.webp 2117×186 | 80KB | 6 | 63 | 65~2050 | 하객 웨딩홀 구간 바닥 |
| 10 비행기 | platforms/10_airplane/platform.png (1983×793) | platform/10.webp 1884×106 | 24KB | 2 | 41 | 27~1857 | 비행기 구간 바닥 |
| 11 발리 | platforms/11_bali/platform.png (2172×724) | platform/11.webp 2101×147 | 57KB | 8 | 39 | 27~2072 | 발리 구간 바닥 |
| 12 신혼집 | platforms/12_newlywed_home/platform.png (2170×725) | platform/12.webp 2084×157 | 31KB | 1 | 50 | 60~2023 | 신혼집 구간 바닥 |

### 캐릭터 5단계 × 6모션(30장) + 신랑 단독 2장

모션 용도: `run_01`·`run_02` 달리기(번갈아) / `jump` 점프 중 / `slide` 슬라이드 중(slideScale) / `stumble` 충돌 시 넘어짐(게임 종료 연출, 폭력 연출 없음) / `celebrate` 단계 전환 문구·신혼집 도착 환호. 단계별 사용: 1 웨딩드레스('결혼 준비, 출발!') → 2 부케('부케 장착!') → 3 베일·티아라('본식 준비 완료!') → 4 신랑 합류('신랑 합류! 이제 같이 준비해♥') → 5 손잡고('신혼집까지 함께!').

| 단계 | 원본 폴더 | 최적화본 | 캔버스 | refH | pivot | slideScale | runCycle | 충돌 run / jump / slide (x,y,w,h) |
|---|---|---|---|---|---|---|---|---|
| 1 웨딩드레스 신부 | bride-motions/01_dress/ | char/01_dress/{run_01,run_02,jump,slide,stumble,celebrate}.webp | 764×466 | 410 | 406,464 | 0.85 | run_01+run_02 | 282,108,249,346 / 288,110,239,330 / 203,228,333,227 |
| 2 부케를 든 신부 | bride-motions/02_bouquet/ | char/02_bouquet/{run_01,run_02,jump,slide,stumble,celebrate}.webp | 710×438 | 428 | 398,435 | 0.85 | run_01+run_02 | 260,68,275,349 / 268,84,256,328 / 189,196,354,230 |
| 3 부케·베일·티아라 신부 | bride-motions/03_veil_tiara/ | char/03_veil_tiara/{run_01,run_02,jump,slide,stumble,celebrate}.webp | 699×438 | 429 | 401,436 | 0.75 | run_01+run_02 | 261,67,280,356 / 261,86,283,325 / 174,147,381,278 |
| 4 신랑 합류(나란히) | bride-motions/04_groom_joins/ | char/04_groom_joins/{run_01,run_02,jump,slide,stumble,celebrate}.webp | 938×419 | 386 | 510,417 | 0.88 | run_02 | 591,83,270,319 / 592,108,259,285 / 499,186,361,223 |
| 5 손잡고 함께 | bride-motions/05_holding_hands/ | char/05_holding_hands/{run_01,run_02,jump,slide,stumble,celebrate}.webp | 691×427 | 405 | 308,424 | 0.84 | run_01+run_02 | 337,70,283,339 / 336,82,271,322 / 216,165,379,245 |
| (신랑) | bride-motions/04_groom_joins/run_01·run_02 에서 신랑 덩어리만 | char/groom/{run_01,run_02}.webp | 293×395 | 380 | 167,393 | - | run_01+run_02 | joinOffset 292,-6 |

### 장애물 47장(32종)
| 구간 | key(원본 폴더) | 이름 | 프레임 | kind | scaleHint | 충돌 위끝(refH배) | 최적화본 크기 | 판단 근거 |
|---|---|---|---|---|---|---|---|---|
| 01 | couple_selfie | 셀카 찍는 커플 | 1 | ground | 0.7 | 0.588 | 225×336 | 두 사람이 서서 셀카 — 바닥에 서 있는 정적 인물(1장) → 점프 |
| 01 | couple_photographer | 사진 찍어 주는 커플 | 1 | ground | 0.64 | 0.544 | 379×307 | 남자가 카메라로 여자를 찍는 장면, 둘 다 서 있음(1장) → 점프. 두 사람 사이 빈 공간은 충돌 상자에 포함(좌우 끝만 깎음) |
| 01 | couple_phone_pose | 폰으로 찍는 커플 | 1 | ground | 0.66 | 0.558 | 374×317 | 여자가 폰으로 남자를 찍음, 둘 다 서 있음(1장) → 점프 |
| 01 | pigeon | 비둘기 | 3 (10fps) | flying | 0.5 | 0.304 (아래끝 0.7) | 319×240 | 날개 위·수평·아래 3모션 날갯짓(오른쪽 향함) → 머리 높이로 날아오는 공중 장애물, 슬라이드. 충돌=몸통(날개 끝 제외) |
| 02 | iced_americano | 아이스 아메리카노 | 1 | ground | 0.5 | 0.34 | 140×240 | 바닥에 놓인 큰 테이크아웃 컵(1장) → 낮은 지상 장애물, 점프. 빨대는 충돌 제외 |
| 02 | running_children | 뛰어다니는 어린이 | 3 (8fps) | moving-ground | 0.6 | 0.5 | 379×288 | 두 아이가 오른쪽으로 달리는 3모션(03은 공중 깡충) → 움직이는 지상 장애물, 점프. 03은 몸통 겹침으로 세로 정렬(살짝 떠 있음) |
| 03 | hanbok_tourists | 한복 입은 외국인 관광객 | 1 | ground | 0.7 | 0.567 | 344×336 | 한복 차림 외국인 커플이 서서 셀카(1장) → 점프. 위로 든 폰은 충돌 제외 |
| 03 | royal_procession | 왕과 궁녀 행렬 | 3 (6fps) | moving-ground | 0.58 | 0.417 | 431×278 | 왕+궁녀 둘이 오른쪽으로 걷는 3모션(03=멈춰 손 듦) → 천천히 움직이는 넓은 지상 장애물, 점프 |
| 03 | haetae_statue | 해태 석상 | 1 | ground | 0.6 | 0.454 | 300×288 | 받침돌 위 해태 석상(1장) → 정적 지상 장애물, 점프 |
| 04 | scolding_mother | 호통치는 시어머니 | 2 (3fps) | ground | 0.74 | 0.652 | 264×355 | 제자리에서 허리 짚기↔손가락질 2포즈(이동 없음) → 정적 지상(포즈만 바뀜), 점프. 뻗은 팔은 충돌 제외 |
| 04 | nagging_father | 잔소리하는 아버지 | 2 (3fps) | ground | 0.74 | 0.655 | 210×355 | 제자리에서 손 들고 잔소리↔팔짱 2포즈(이동 없음) → 정적 지상(포즈만 바뀜), 점프 |
| 05 | dress_mannequin | 드레스 마네킹 | 1 | ground | 0.72 | 0.52 | 262×346 | 금색 받침의 드레스 마네킹(1장) → 정적 지상, 점프. 위쪽 목 기둥은 충돌 제외 |
| 05 | dress_rack | 드레스 행거 | 1 | ground | 0.62 | 0.506 | 335×298 | 바퀴 달린 금색 행거에 드레스 3벌(1장), 드레스가 바닥 근처까지 내려옴 → 밑으로 못 지나감, 점프 |
| 06 | bespoke_washer | 세탁기 | 1 | ground | 0.58 | 0.536 | 238×278 | 드럼 세탁기(1장) → 정적 지상, 점프 |
| 06 | lg_stanbyme | 이동식 TV | 1 | moving-ground | 0.72 | 0.674 | 195×346 | 바퀴 달린 스탠드형 TV(1장, 사양서 "이동식 TV") — 기둥·받침이 바닥까지 있어 밑으로 못 지나감 → 굴러오는 지상 장애물, 점프(1장이라 애니 없이 이동만) |
| 06 | flying_dyson | 날아다니는 헤어드라이어 | 3 (8fps) | flying | 0.42 | 0.345 (아래끝 0.7) | 294×202 | 수평·위로 20°·아래로 20° 3모션으로 날아옴(오른쪽 향함) → 공중 장애물, 슬라이드 |
| 07 | wedding_album | 웨딩 앨범 | 1 | ground | 0.46 | 0.379 | 330×221 | 낮은 받침 위 펼친 두꺼운 앨범(1장) → 낮은 지상, 점프 |
| 07 | contract_stack | 계약서 더미 | 1 | ground | 0.56 | 0.483 | 301×269 | 세워 둔 계약서 폴더 더미(1장) → 지상, 점프 |
| 07 | fabric_samples | 원단 샘플 | 1 | ground | 0.48 | 0.407 | 280×230 | 부채꼴 원단 샘플+줄자 한 덩어리(1장) → 낮은 지상, 점프 |
| 08 | floral_arch | 꽃 아치 | 1 | air | 1.009 | 0.924 (아래끝 0.7) | 891×484 | 양쪽 기둥+낮은 가로보(manifest: "wide open space underneath for slide") → 가로보만 충돌, 기둥 사이로 슬라이드. 기둥은 통과(플레이어 뒤에 그릴 것) |
| 08 | guest_chair | 하객 의자 | 1 | ground | 0.56 | 0.487 | 202×269 | 리본 단 하객 의자(1장) → 지상, 점프 |
| 08 | flower_pedestal | 꽃 장식대 | 1 | ground | 0.72 | 0.643 | 161×346 | 좁고 높은 금색 꽃 장식대(1장) → 지상, 점프. 위쪽 꽃 덩어리 폭으로 충돌 |
| 09 | clapping_guests | 박수치는 하객 | 2 (4fps) | ground | 0.72 | 0.61 | 304×346 | 제자리 하객 둘, 손 벌림↔박수 2모션(이동 없음) → 정적 지상(애니), 점프 |
| 09 | wedding_photographer | 촬영하는 사진사 | 2 (2fps) | ground | 0.68 | 0.569 | 294×326 | 서서 촬영↔쪼그려 촬영 2모션(제자리) → 정적 지상(애니), 점프. 이벤트 "웨딩 촬영" 플래시 연출에 재사용 가능 |
| 10 | service_cart | 서비스 카트 | 1 | moving-ground | 0.62 | 0.479 | 200×298 | 바퀴 달린 기내 카트(1장) → 통로를 굴러오는 지상 장애물, 점프. 위 컵은 충돌 제외 |
| 10 | travel_luggage | 여행 캐리어 | 1 | ground | 0.56 | 0.362 | 155×269 | 손잡이 뽑은 캐리어(1장) → 정적 지상, 점프. 뽑은 손잡이는 충돌 제외 |
| 11 | playful_monkey | 원숭이 | 2 (8fps) | moving-ground | 0.46 | 0.356 | 252×221 | 바나나 든 원숭이가 오른쪽으로 뛰는 2모션 → 움직이는 지상, 점프. 꼬리는 충돌 제외 |
| 11 | surfboard | 서핑보드 | 1 | ground | 0.72 | 0.637 | 147×346 | 받침에 세운 서핑보드(1장) → 좁고 높은 정적 지상, 점프 |
| 11 | beach_umbrella | 파라솔 | 1 | air | 1.208 | 0.997 (아래끝 0.7) | 507×560 | 넓은 짚 파라솔 + 가는 기둥 → 갓(술 포함)만 충돌, 밑으로 슬라이드. 가는 기둥은 통과(플레이어 뒤에 그릴 것) |
| 12 | moving_boxes | 이삿짐 상자 | 1 | ground | 0.56 | 0.477 | 362×269 | 상자 3개+담요 더미(1장) → 정적 지상, 점프 |
| 12 | robot_vacuum | 로봇청소기 | 2 (6fps) | moving-ground | 0.24 | 0.202 | 312×128 | 바닥을 오른쪽으로 움직이는 납작한 로봇청소기 2모션(02=먼지 퍽) → 움직이는 낮은 지상, 점프. 먼지 구름은 충돌 제외 |
| 12 | home_cat | 고양이 | 2 (8fps) | moving-ground | 0.44 | 0.359 | 314×211 | 오른쪽으로 뛰는 고양이 2모션 → 움직이는 지상, 점프. 꼬리는 충돌 제외 |

### UI 17종
| key | 원본 | 최적화본 크기 | hit(x,y,w,h) | 쓰이는 곳(사양서 [7]) |
|---|---|---|---|---|
| start | ui/01_buttons/start.png | ui/start.webp 640×160 | 0,0,639,159 | 진입 화면 "게임 시작" |
| resume | ui/01_buttons/resume.png | ui/resume.webp 640×157 | 0,0,640,156 | 일시정지 "계속하기" |
| retry | ui/01_buttons/retry.png | ui/retry.webp 640×183 | 0,0,639,183 | 종료·일시정지 "다시 도전" |
| ranking | ui/01_buttons/ranking.png | ui/ranking.webp 640×197 | 1,0,639,196 | 진입·종료 "랭킹" |
| share | ui/01_buttons/share.png | ui/share.webp 640×162 | 0,0,639,161 | 종료 "내 기록 공유" |
| pause | ui/02_controls/pause.png | ui/pause.webp 240×239 | 0,0,240,238 | 플레이 우측 상단 일시정지 |
| sound | ui/02_controls/sound.png | ui/sound.webp 240×240 | 0,0,239,240 | 사운드 켜짐 상태(저장) |
| sound_off | ui/02_controls/sound_off.png | ui/sound_off.webp 240×249 | 0,0,239,249 | 사운드 꺼짐 상태(저장) |
| home | ui/02_controls/home.png | ui/home.webp 240×237 | 0,0,239,237 | 메인으로(진행 중이면 종료 확인) |
| close | ui/02_controls/close.png | ui/close.webp 240×241 | 0,0,240,240 | 랭킹·도움말·확인 팝업 닫기 |
| jump | ui/02_controls/jump.png | ui/jump.webp 360×353 | 0,0,359,353 | 플레이 오른쪽 아래 점프 |
| slide | ui/02_controls/slide.png | ui/slide.webp 360×358 | 0,0,359,357 | 플레이 왼쪽 아래 슬라이드 |
| score_hud | ui/03_panels/score_hud.png | ui/score_hud.webp 640×230 | 1,1,638,229 | 점수판 디자인 참고(예시 숫자) — 화면 사용 금지 · refOnly |
| pause_panel | ui/03_panels/pause_panel.png | ui/pause_panel.webp 569×800 | 1,1,568,799 | 일시정지 디자인 참고(예시 버튼) — 화면 사용 금지 · refOnly |
| result_panel | ui/03_panels/result_panel.png | ui/result_panel.webp 509×800 | 1,1,508,799 | 종료 화면 디자인 참고(예시 1,280점·12위) — 화면 사용 금지 · refOnly |
| hud_blank | ui/04_templates/hud_blank.png | ui/hud_blank.webp 720×171 | 1,0,718,171 | 실제 플레이 점수판 바탕 |
| modal_blank | ui/04_templates/modal_blank.png | ui/modal_blank.webp 658×1000 | 1,1,656,999 | 실제 일시정지·종료·확인·랭킹 팝업 바탕 |

### 첫 진입 일러스트
| 원본 | 최적화본 | 쓰이는 곳 |
|---|---|---|
| freetiful-wedding-entry/wedding-run-entry/entry-illustration.png (1870×841) | entry.webp 1870×841, 200KB | 진입 화면 배경(왼쪽 빈 공간에 제목 '웨딩런: 신혼집까지 달려!'·시작/랭킹/사운드 버튼·최고기록을 별도 레이어로) |

## 7. 확인 자료
- 확인 시트(세션 임시 폴더, 저장소 밖): `assets-sheet.png`(모션·장애물별 피벗 점·충돌 상자·바닥선·겹쳐보기, 발판 topY/faceY/solidX, UI hit), `assets-scale.png`(844×390 화면에 12구간 배경·발판·캐릭터·장애물을 scaleHint 로 배치, 머리 위 장애물 밑 슬라이드 그림 겹쳐보기).

## 8. 아직 연결되지 않은 외부 기능(261011 기준 — 정확히)

| 기능 | 지금 상태 | 실서비스에서 보이는 것 | 연결하려면 |
|---|---|---|---|
| 랭킹 API(`apps/api/src/game/*` — 세션·점수 제출·순위·공유 기록·판 포기·운영 숨김) | 코드만 있음, **운영 API(Railway)에 미배포** | 항상 **'랭킹 준비 중'** + 개인 최고기록(가짜 순위 없음). 결과 화면 순위 칸 = '랭킹 준비 중 · 개인 기록은 저장됐어요' | API 배포(아래 마이그레이션 먼저) |
| Prisma 마이그레이션 2개 `apps/api/prisma/migrations/20261011120000_wedding_run_scores` · `20261011123000_wedding_run_sessions_bests` | **운영 DB 미적용** | — (API 가 없으니 영향 없음) | 운영 DB 에 적용(`migrate deploy`, 기존 표는 건드리지 않음) 후 API 배포 |
| 공유 링크 `?c=<기록 id>`(서버가 검증한 기록) · 링크 미리보기(OG) 개인화 `/api/wedding-run/og?c=` | 웹 코드는 있음, **서버 배포 후에야 동작** | `?c=` 로 들어와도 도전 배너·개인화 미리보기 없이 기본 화면·기본 미리보기(실패 시 가짜 기록을 만들지 않음). `?t=<점수>&n=<닉네임>`(검증 안 된 도전 목표)은 지금도 동작 | API 배포 |
| `WR_PROXY_SECRET`(속도 제한용 손님 IP 신뢰) | 웹 `src/middleware.ts`·API `game-ip.ts` 코드 있음, **양쪽 다 미설정** | 영향 없음(예전 동작: x-forwarded-for 그대로 — 직접 요청으로 우회 가능, API 가 경고 로그 1회) | ① Vercel 에 설정·배포 → 게임 API 응답 머리글 `X-WR-IP-Mode: legacy+proxy` 확인 → ② Railway API 에 같은 값 → `trusted` 확인. **순서를 거꾸로 하면 손님 전원이 한 칸으로 묶여 429** |
| 운영 화면(보류·숨김 판 관리) | API 만 있음(`GET game/wedding-run/admin/scores?hidden=1` · `POST …/scores/:id/hide` · `POST …/scores/:id/player`, AdminGuard) — **어드민 웹 화면 없음** | 자동 보류(완주 4번 이상·15분 초과·초당 46점 초과, `hiddenReason 'auto:…'`)된 판은 순위에 안 나오고 본인 결과 화면에 '기록 확인 중' | 어드민 화면을 붙이거나 x-admin-key 로 API 직접 호출 |
| Web Share API | 브라우저마다 다름 | 지원(대부분 모바일 사파리·크롬·삼성 인터넷) = 공유 시트 / 미지원(PC 크롬 일부·옛 웹뷰) = 기록+링크 복사 / 복사도 막힘 = '길게 눌러 복사' 창. 취소는 '공유를 취소했어요' | — |
| 효과음·배경음 | 음원 파일 없음 → `game/sound.ts` 가 WebAudio 로 짧은 음을 직접 만든다(첫 사용자 입력 뒤에만 AudioContext 생성) | 소리 켬/끔 저장(`wr-sound`) | 음원 파일이 오면 sound.ts 에 연결 |

## 9. 실행 방법

- **로컬**: 웹 개발 서버(apps/web 에서 `npm run dev` = 포트 3000, 다른 포트는 `npx next dev -p 3200` — 이 작업 트리는 3200 에 떠 있음) → 브라우저 `http://localhost:<포트>/wedding-run`.
  휴대폰 가로(20:9 844×390 기준)·PC 모두 같은 주소. 세로면 '휴대폰을 가로로 돌려주세요'.
  개발 서버의 `/api/v1/**` 는 운영 API 로 넘어간다(next.config.js rewrites) → 랭킹은 '랭킹 준비 중'(운영 API 에 아직 없음).
- **조작**: 모바일 = 오른쪽 아래 점프 · 왼쪽 아래 슬라이드(동시 터치 가능) · 오른쪽 위 일시정지. PC = Space/↑ 점프 · ↓ 슬라이드 · Esc 일시정지/재개 · Enter 시작/다시 도전.
- **개발 확인 훅**(개발 서버에서만, 운영 번들엔 없음): 브라우저 콘솔 `window.__wrDebug`
  - `state()` 지금 상태(구간·단계·속도·점수·장애물…) · `skip(seg, frac?)` 구간 건너뛰기(0~11) · `arrive()` 신혼집 직전으로
  - `god(true)` 무적 · `speed(2.5)` 배속 · `bot(true)` 자동 봇 · `hitboxes(true)` 충돌 상자 보기 · `die()` 넘어지기
  - 흐름만 볼 땐 `window.__WR_FAKE_ENGINE__ = { createWeddingRunGame }` 를 페이지보다 먼저 심으면 가짜 엔진을 쓴다(`ui/engine-loader.ts`).
- **에셋 다시 만들기**: 2절(`node apps/web/scripts/wedding-run-assets.mjs --src <원본 푼 폴더>`) — `public/wedding-run/`·`assets.ts` 를 덮어씀.
- **확인 명령**(빌드 대신): `cd apps/web && npx tsc --noEmit` · `cd apps/api && npx tsc --noEmit && npx prisma validate`.
- **운영 반영 순서**: 웹(Vercel)은 지금 그대로 배포 가능(랭킹 없이 '랭킹 준비 중'). 랭킹을 켜려면 8절 순서(마이그레이션 → API 배포 → 필요하면 WR_PROXY_SECRET).

