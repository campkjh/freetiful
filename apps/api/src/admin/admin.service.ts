import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import * as bcrypt from 'bcrypt';

const PROS = [
  { id: '1', name: '강도현', email: 'kangdh@freetiful.com', image: '/images/pro-01/10000133881772850005043.avif', images: ['/images/pro-01/10000133881772850005043.avif', '/images/pro-01/10000269161772850296005.avif', '/images/pro-01/55111772850244842.avif', '/images/pro-01/9041772850314846.avif'], intro: '신뢰감 있는 보이스로 현직 아나운서,레크,운동회,쇼호스트 모두 가능한 남자!', career: '1억 상금 쇼호스트 오디션 방송 <보고스타워즈> 우승', price: 450000, experience: 14, gender: 'male' },
  { id: '2', name: '김동현', email: 'kimdh@freetiful.com', image: '/images/pro-02/10000365351773046135169.avif', images: ['/images/pro-02/10000365351773046135169.avif', '/images/pro-02/10000795161773046194452.avif', '/images/pro-02/10000855971773046164403.avif', '/images/pro-02/10000864531773046178640.avif'], intro: '안녕하세요 MC 김동현 입니다 :)', career: 'K리그 수원삼성블루윙즈 장외아나운서', price: 450000, experience: 8, gender: 'male' },
  { id: '3', name: '김민지', email: 'kimmj@freetiful.com', image: '/images/pro-03/IMG_06781773894450803.avif', images: ['/images/pro-03/IMG_06781773894450803.avif', '/images/pro-03/IMG_17531773894460574.avif', '/images/pro-03/IMG_44861773894475916.avif', '/images/pro-03/IMG_96081773894468666.avif'], intro: '꼼꼼하고 부드러운 진행', career: 'SBS Sports 야구 아나운서 / SBS Golf 골프 아나운서 등', price: 450000, experience: 4, gender: 'female' },
  { id: '4', name: '김솔', email: 'kimsol@freetiful.com', image: '/images/pro-04/IMG_23601771788594274.avif', images: ['/images/pro-04/IMG_23601771788594274.avif', '/images/pro-04/IMG_31471771788581868.avif', '/images/pro-04/IMG_33241771788569381.avif', '/images/pro-04/IMG_44921771788602280.avif'], intro: '자연스럽고 편안한 분위기의 웨딩 전문 MC', career: '웨딩 전문 MC', price: 450000, experience: 8, gender: 'female' },
  { id: '5', name: '김유석', email: 'kimys@freetiful.com', image: '/images/pro-05/10000029811773033474612.avif', images: ['/images/pro-05/10000029811773033474612.avif', '/images/pro-05/10000044951773033401063.avif', '/images/pro-05/10000135061773033420087.avif', '/images/pro-05/10000263401773033544287.avif'], intro: '최고의 진행자 아나운서 김유석입니다.', career: '전남CBS 앵커 / SBS광주전남(KBC) 리포터', price: 450000, experience: 8, gender: 'male', youtubeId: '6R7r1tbMbTY' },
  { id: '6', name: '김재성', email: 'kimjs@freetiful.com', image: '/images/pro-06/10000602271772960706687.avif', images: ['/images/pro-06/10000602271772960706687.avif', '/images/pro-06/10000625401772960688608.avif', '/images/pro-06/10000653321772960487396.avif', '/images/pro-06/10000666071772960530192.avif'], intro: '순간을 기억으로 만드는 사회자', career: 'MBC+ 트롯챔피언 사회자', price: 450000, experience: 7, gender: 'male' },
  { id: '7', name: '김진아', email: 'kimja@freetiful.com', image: '/images/pro-07/IMG_53011772965035335.avif', images: ['/images/pro-07/IMG_53011772965035335.avif', '/images/pro-07/IMG_61401772965618286.avif', '/images/pro-07/IMG_66501772965804174.avif', '/images/pro-07/IMG_78451772965478053.avif'], intro: '아나운서 김진아입니다', career: '한국경제TV 아나운서', price: 450000, experience: 6, gender: 'female' },
  { id: '8', name: '김호중', email: 'kimhj@freetiful.com', image: '/images/pro-08/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', images: ['/images/pro-08/0DBA6E02-BBC8-4660-8464-5B5162FAD2461773045822216.avif', '/images/pro-08/10E595A9-B36C-4A54-BE94-F6AFAA258E7D1773045761972.avif', '/images/pro-08/8CAA6337-E752-4EDF-8B1D-86C32DDCB5811773045691817.avif', '/images/pro-08/IMG_06101773045870594.avif'], intro: '기획에서 진행까지, 무대를 완성하다', career: '기업행사·공식행사 전문 MC', price: 450000, experience: 12, gender: 'male' },
  { id: '9', name: '나연지', email: 'nayj@freetiful.com', image: '/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', images: ['/images/pro-09/Facetune_10-02-2026-21-07-511772438130235.avif', '/images/pro-09/Facetune_26-12-2025-23-11-081772438046927.avif', '/images/pro-09/Facetune_26-12-2025-23-47-461772438096422.avif', '/images/pro-09/Facetune_28-12-2025-16-00-271772438073263.avif'], intro: '공식행사 전문 MC', career: '공공기관 및 대기업 세미나 진행', price: 450000, experience: 3, gender: 'female', youtubeId: 'Hue7ZLJM7oo' },
  { id: '10', name: '노유재', email: 'noyj@freetiful.com', image: '/images/pro-10/10000016211774440274171.avif', images: ['/images/pro-10/10000016211774440274171.avif', '/images/pro-10/10000080011774440452164.avif', '/images/pro-10/10000086141774440497085.avif', '/images/pro-10/10000096111774440365370.avif'], intro: '무대에서 다진 표현력과 방송에서 쌓은 전달력', career: 'SSG랜더스 장외 아나운서', price: 450000, experience: 16, gender: 'male' },
  { id: '11', name: '도준석', email: 'dojs@freetiful.com', image: '/images/pro-11/1-1231772850030951.avif', images: ['/images/pro-11/1-1231772850030951.avif', '/images/pro-11/3-1231772850058559.avif', '/images/pro-11/IMG_02501772849985994.avif', '/images/pro-11/IMG_35941772850008495.avif'], intro: '격 있는 사회자입니다.', career: '충남도청 아나운서', price: 450000, experience: 2, gender: 'male', youtubeId: '72RX9prME4I' },
  { id: '12', name: '문정은', email: 'moonje@freetiful.com', image: '/images/pro-12/IMG_27221772621229571.avif', images: ['/images/pro-12/IMG_27221772621229571.avif', '/images/pro-12/IMG_31821772621337651.avif', '/images/pro-12/IMG_61001772621448507.avif'], intro: '품격있고 고급스러운 진행', career: '서울경제TV 앵커 / CJ온스타일+ 쇼호스트', price: 450000, experience: 10, gender: 'female', youtubeId: 'D5Mx42ArNOY' },
  { id: '13', name: '박상설', email: 'parkss@freetiful.com', image: '/images/pro-13/10000077391773050357628.avif', images: ['/images/pro-13/10000077391773050357628.avif', '/images/pro-13/10000119741773050332437.avif', '/images/pro-13/10000152851773050374131.avif', '/images/pro-13/10000345831773050337824.avif'], intro: '10년 경력, 2000번의 행사 경력', career: 'G1방송국 전국 TOP10 가요쇼 행사 MC', price: 450000, experience: 10, gender: 'male', youtubeId: 'P04peAmLV7c' },
  { id: '14', name: '박은결', email: 'parkeg@freetiful.com', image: '/images/pro-14/IMG_02661773035503788.avif', images: ['/images/pro-14/IMG_02661773035503788.avif', '/images/pro-14/IMG_25661773035575396.avif', '/images/pro-14/IMG_31641773035613744.avif', '/images/pro-14/IMG_74881773035596478.avif'], intro: '아나운서 사회자 박은결입니다', career: 'SBS강원(G1) 리포터 / 팍스경제TV 앵커', price: 450000, experience: 9, gender: 'female' },
  { id: '15', name: '박인애', email: 'parkia@freetiful.com', image: '/images/pro-15/IMG_0196.avif', images: ['/images/pro-15/IMG_0196.avif', '/images/pro-15/IMG_7549.avif', '/images/pro-15/IMG_7552.avif', '/images/pro-15/IMG_8517.avif'], intro: '13년 생방송 뉴스 진행으로 다져진 품격있는 사회자', career: '연합뉴스TV / SK브로드밴드 Btv / 충주MBC', price: 450000, experience: 13, gender: 'female', youtubeId: 'UIbfieXAT0U' },
  { id: '16', name: '박주은', email: 'parkje@freetiful.com', image: '/images/pro-16/IMG_01621772973118334.avif', images: ['/images/pro-16/IMG_01621772973118334.avif', '/images/pro-16/IMG_83991772973146317.avif', '/images/pro-16/IMG_98851772973174980.avif', '/images/pro-16/IMG_98891772973162789.avif'], intro: 'SBS Sports 아나운서', career: 'SBS전북·JTV전주방송 앵커', price: 450000, experience: 4, gender: 'female', youtubeId: '_207ch4oFnU' },
  { id: '17', name: '배유정', email: 'baeyj@freetiful.com', image: '/images/pro-17/IMG_21541773026472716.avif', images: ['/images/pro-17/IMG_21541773026472716.avif', '/images/pro-17/IMG_25041773026570198.avif', '/images/pro-17/IMG_30041773026515891.avif', '/images/pro-17/IMG_54931773026493813.avif'], intro: '믿고 맡기는 행사입니다!', career: 'kt HCN 충북방송', price: 450000, experience: 4, gender: 'female' },
  { id: '18', name: '성연채', email: 'sungyc@freetiful.com', image: '/images/pro-18/20161016_161406_IMG_5921.avif', images: ['/images/pro-18/20161016_161406_IMG_5921.avif', '/images/pro-18/20161121_141359_IMG_6072.avif', '/images/pro-18/20180311_161359_IMG_8925.avif', '/images/pro-18/20180406_135859_IMG_9103.avif'], intro: '따뜻하고 다정한 아나운서 성연채입니다', career: 'KCN금강방송 아나운서', price: 450000, experience: 10, gender: 'female', youtubeId: '6YEw574Gvg8' },
  { id: '19', name: '송지은', email: 'songje@freetiful.com', image: '/images/pro-19/IMG_60741772092494350.avif', images: ['/images/pro-19/IMG_60741772092494350.avif', '/images/pro-19/IMG_70171772092524815.avif', '/images/pro-19/IMG_86861772092348488.avif'], intro: '믿고 맡기는 아나운서', career: '현대자동차 앰배서더 / KBS 넥스트 라이콘 mc', price: 450000, experience: 10, gender: 'female' },
  { id: '20', name: '유하늘', email: 'yuhan@freetiful.com', image: '/images/pro-20/IMG_05351773030634574.avif', images: ['/images/pro-20/IMG_05351773030634574.avif', '/images/pro-20/IMG_06591773030512344.avif', '/images/pro-20/IMG_50451773030183819.avif'], intro: '결혼식 전문 사회자', career: '매년 180건 이상 결혼식 진행', price: 450000, experience: 4, gender: 'female' },
  { id: '21', name: '유하영', email: 'yuhay@freetiful.com', image: '/images/pro-21/IMG_40271772967046036.avif', images: ['/images/pro-21/IMG_40271772967046036.avif', '/images/pro-21/IMG_40281772967049484.avif'], intro: 'KBS 캐스터 유하영 입니다', career: 'KBS 캐스터 / TBN 교통방송 캐스터', price: 450000, experience: 9, gender: 'female' },
  { id: '22', name: '이강문', email: 'leekm@freetiful.com', image: '/images/pro-22/10000353831773035180593.avif', images: ['/images/pro-22/10000353831773035180593.avif', '/images/pro-22/10000353841773035166256.avif', '/images/pro-22/10000353851773035190777.avif', '/images/pro-22/10000529141773035412786.avif'], intro: '10년차 베테랑 사회자', career: '오은영박사 콘서트 진행', price: 450000, experience: 11, gender: 'male' },
  { id: '23', name: '이승진', email: 'leesj@freetiful.com', image: '/images/pro-23/IMG_46511771924269213.avif', images: ['/images/pro-23/IMG_46511771924269213.avif', '/images/pro-23/IMG_46591771924566302.avif', '/images/pro-23/IMG_75131771924219656.avif', '/images/pro-23/IMG_96001771924190664.avif'], intro: '따뜻하고 깔끔한 진행의 사회자', career: '춘천MBC 라디오 리포터', price: 450000, experience: 4, gender: 'male', youtubeId: 'Nqe3UioEV8E' },
  { id: '24', name: '이용석', email: 'leeys@freetiful.com', image: '/images/pro-24/10001176941772847263491.avif', images: ['/images/pro-24/10001176941772847263491.avif', '/images/pro-24/10001176951772847270433.avif', '/images/pro-24/10001176961772847283258.avif', '/images/pro-24/10001176971772847277083.avif'], intro: '1000회 이상의 결혼식사회, 공식행사', career: 'HD현대건설기계·한국은행 MC', price: 450000, experience: 11, gender: 'male', youtubeId: 'nZhdGrZaBKU' },
  { id: '25', name: '이우영', email: 'leewy@freetiful.com', image: '/images/pro-25/2-11772248201484.avif', images: ['/images/pro-25/2-11772248201484.avif', '/images/pro-25/IMG_58821772248170290.avif'], intro: '현직 아나운서의 고품격 진행', career: '남인천방송·YTN FM 아나운서', price: 450000, experience: 8, gender: 'male', youtubeId: 'plGBzTNsdiM' },
  { id: '26', name: '이원영', email: 'leewony@freetiful.com', image: '/images/pro-26/1-1231772531708677.avif', images: ['/images/pro-26/1-1231772531708677.avif', '/images/pro-26/IMG_27231772531852387.avif', '/images/pro-26/IMG_27981772531758751.avif', '/images/pro-26/IMG_77151772531739607.avif'], intro: 'KBS 춘천방송총국 기상캐스터', career: 'KBC 기상캐스터·리포터', price: 450000, experience: 6, gender: 'female' },
  { id: '27', name: '이재원', email: 'leejw@freetiful.com', image: '/images/pro-27/17230390916981773388202648.avif', images: ['/images/pro-27/17230390916981773388202648.avif', '/images/pro-27/17366775813661773388237802.avif'], intro: '영어MC / 영어아나운서 이재원', career: '국제결혼식 전문 한/영사회 700건 이상', price: 450000, experience: 11, gender: 'male', youtubeId: 'oXBGQziegWc' },
  { id: '28', name: '이한나', email: 'leehn@freetiful.com', image: '/images/pro-28/IMG_002209_01772081523241.avif', images: ['/images/pro-28/IMG_002209_01772081523241.avif', '/images/pro-28/IMG_004350_01772081494500.avif', '/images/pro-28/IMG_010628_01772081478994.avif', '/images/pro-28/IMG_08631772081467465.avif'], intro: '현직 아나운서 이한나', career: 'TBN경인교통방송 MC', price: 450000, experience: 4, gender: 'female', youtubeId: 'v1Rz8N2AV28' },
  { id: '29', name: '임하람', email: 'limhr@freetiful.com', image: '/images/pro-29/10000118841772968813129.avif', images: ['/images/pro-29/10000118841772968813129.avif', '/images/pro-29/10000118851772968842632.avif', '/images/pro-29/10000118861772968791354.avif', '/images/pro-29/10000292381772968967622.avif'], intro: '남들과 다른 특별한 예식', career: '프리티풀 대표 사회자', price: 450000, experience: 8, gender: 'male' },
  { id: '30', name: '장윤영', email: 'jangyy@freetiful.com', image: '/images/pro-30/IMG_27051772976548211.avif', images: ['/images/pro-30/IMG_27051772976548211.avif', '/images/pro-30/IMG_27831772976505642.avif', '/images/pro-30/IMG_55911772976529887.avif', '/images/pro-30/IMG_55941772976566963.avif'], intro: '아나운서 장윤영입니다', career: 'IB SPORTS·팍스경제TV 아나운서', price: 450000, experience: 1, gender: 'female' },
  { id: '31', name: '전해별', email: 'jeonhb@freetiful.com', image: '/images/pro-31/IMG_73341772850094485.avif', images: ['/images/pro-31/025209A2-09A8-4777-9A6A-DF4751F560A71772850104015.avif', '/images/pro-31/IMG_73341772850094485.avif', '/images/pro-31/IMG_73391772850088429.avif', '/images/pro-31/IMG_92281772850158117.avif'], intro: '탄탄한 발성의 아나운서', career: '인천공항 아나운서 / 부평구청 아나운서', price: 450000, experience: 10, gender: 'female', youtubeId: 'Aooj1e0Wu2I' },
  { id: '32', name: '전혜인', email: 'jeonhi@freetiful.com', image: '/images/pro-32/IMG_19181773027236141.avif', images: ['/images/pro-32/IMG_19181773027236141.avif', '/images/pro-32/IMG_19191773027254756.avif', '/images/pro-32/IMG_19201773027246152.avif', '/images/pro-32/IMG_49261773027106589.avif'], intro: '믿고 맡기는 아나운서 전혜인', career: '한국경제TV 아나운서', price: 450000, experience: 3, gender: 'female' },
  { id: '33', name: '정미정', email: 'jungmj@freetiful.com', image: '/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', images: ['/images/pro-33/0533d0a3d5f361ad511e32dafb775319b26ce7541772100346528.avif', '/images/pro-33/0cbe948eaed4fdb569f7e202960cc01a2dc22ff91772100447466.avif'], intro: '경력 13년차 아나운서', career: 'MBC충북 아나운서 / SPOTV 스포츠 아나운서', price: 450000, experience: 13, gender: 'female' },
  { id: '34', name: '정애란', email: 'jungar@freetiful.com', image: '/images/pro-34/IMG_2920.avif', images: ['/images/pro-34/IMG_2920.avif', '/images/pro-34/IMG_5670.avif', '/images/pro-34/IMG_5841.avif', '/images/pro-34/IMG_5842.avif'], intro: '임기응변에 강한 따뜻한 목소리', career: '경기도의회·송파구 뉴스 / CMB광주방송 아나운서', price: 450000, experience: 10, gender: 'female', youtubeId: 'uZCpxPN8I0Y' },
  { id: '35', name: '정이현', email: 'jungih@freetiful.com', image: '/images/pro-35/44561772622988798.avif', images: ['/images/pro-35/44561772622988798.avif', '/images/pro-35/44571772623001970.avif', '/images/pro-35/44611772622968203.avif', '/images/pro-35/56791772622891895.avif'], intro: '정이현 사회자입니다', career: '10년차 전문사회자', price: 450000, experience: 10, gender: 'female' },
  { id: '36', name: '조하늘', email: 'johaneul@freetiful.com', image: '/images/pro-36/IMG_27041773036338469.avif', images: ['/images/pro-36/IMG_27041773036338469.avif', '/images/pro-36/IMG_32021773036578352.avif', '/images/pro-36/IMG_42491773036546456.avif', '/images/pro-36/IMG_77011773036564503.avif'], intro: '아이돌 같은 아나운서 조하늘', career: 'KTV국민방송 / JTBC골프 MC', price: 450000, experience: 5, gender: 'female' },
  { id: '37', name: '최진선', email: 'choijs@freetiful.com', image: '/images/pro-37/10001059551772371340253.avif', images: ['/images/pro-37/10001059551772371340253.avif', '/images/pro-37/10001101721772371303174.avif', '/images/pro-37/10001101751772371254806.avif', '/images/pro-37/10001127141772371327596.avif'], intro: '사회자 최진선', career: '웨딩·행사 전문 MC', price: 450000, experience: 5, gender: 'male' },
  { id: '38', name: '한가람', email: 'hangr@freetiful.com', image: '/images/pro-38/IMG_34281772111635068.avif', images: ['/images/pro-38/IMG_34281772111635068.avif', '/images/pro-38/IMG_3429.avif', '/images/pro-38/IMG_3432.avif', '/images/pro-38/IMG_3433.avif'], intro: '고급스럽고 따뜻한 보이스 사회자', career: '결혼식·공식행사 전문 MC', price: 450000, experience: 8, gender: 'male', youtubeId: 'H-u5iHpbxds' },
  { id: '39', name: '함현지', email: 'hamhj@freetiful.com', image: '/images/pro-39/11773004544652.avif', images: ['/images/pro-39/11773004544652.avif', '/images/pro-39/IMG_12081773004575812.avif', '/images/pro-39/IMG_68091773004557667.avif', '/images/pro-39/IMG_76701773004528766.avif'], intro: '깔끔하고 격식있는 진행', career: '연합뉴스TV 뉴스캐스터', price: 450000, experience: 4, gender: 'female' },
  { id: '40', name: '허수빈', email: 'heosb@freetiful.com', image: '/images/pro-40/IMG_01991772961130928.avif', images: ['/images/pro-40/IMG_01991772961130928.avif', '/images/pro-40/IMG_02001772961175115.avif', '/images/pro-40/IMG_02021772961211905.avif', '/images/pro-40/IMG_02031772961191961.avif'], intro: '순간을 놓치지 않는 센스와 따뜻한 진행', career: '결혼식 전문 사회자 / 기업행사·공식행사 진행', price: 450000, experience: 8, gender: 'female' },
  { id: '41', name: '홍현미', email: 'honghm@freetiful.com', image: '/images/pro-41/IMG_12201772513865121.avif', images: ['/images/pro-41/IMG_12201772513865121.avif', '/images/pro-41/IMG_19021772514066029.avif', '/images/pro-41/IMG_57741772513914924.avif', '/images/pro-41/IMG_60161772513816986.avif'], intro: '정부|기업 공식행사 전문아나운서', career: 'KTV국민방송 앵커 / 국가공무원인재개발원 MC', price: 450000, experience: 10, gender: 'female' },
] as const;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async seedPros(): Promise<{ created: number; skipped: number; errors: number }> {
    const passwordHash = await bcrypt.hash('Pro1234!', 12);
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const pro of PROS) {
      try {
        const existing = await this.prisma.user.findUnique({ where: { email: pro.email } });
        if (existing) {
          // If user exists but profile is pending, approve it
          await this.prisma.proProfile.updateMany({
            where: { userId: existing.id, status: 'pending' },
            data: { status: 'approved', approvedAt: new Date() },
          });
          skipped++;
          continue;
        }

        const user = await this.prisma.user.create({
          data: {
            name: pro.name,
            email: pro.email,
            role: 'pro',
            referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
            profileImageUrl: pro.image,
            authProviders: {
              create: {
                provider: 'email',
                providerUserId: pro.email,
                providerEmail: pro.email,
                accessToken: passwordHash,
              },
            },
            notificationSettings: { create: {} },
          },
        });

        const profile = await this.prisma.proProfile.create({
          data: {
            userId: user.id,
            status: 'approved',
            gender: (pro as any).gender,
            shortIntro: pro.intro,
            mainExperience: pro.career,
            careerYears: pro.experience,
            youtubeUrl: (pro as any).youtubeId ? `https://youtube.com/watch?v=${(pro as any).youtubeId}` : null,
            isFeatured: pro.experience >= 10,
            avgRating: +(4.5 + Math.random() * 0.5).toFixed(2),
            reviewCount: Math.floor(20 + Math.random() * 80),
            profileViews: Math.floor(100 + Math.random() * 900),
            puddingCount: Math.floor(Math.random() * 50),
            approvedAt: new Date(),
          },
        });

        for (let i = 0; i < pro.images.length; i++) {
          await this.prisma.proProfileImage.create({
            data: {
              proProfileId: profile.id,
              imageUrl: pro.images[i],
              displayOrder: i,
              isPrimary: i === 0,
              hasFace: true,
            },
          });
        }

        await this.prisma.proService.create({
          data: {
            proProfileId: profile.id,
            title: '행사 사회 진행',
            description: pro.intro,
            basePrice: pro.price,
            priceUnit: 'per_event',
            displayOrder: 0,
            isActive: true,
          },
        });

        this.logger.log(`Created pro: ${pro.name}`);
        created++;
      } catch (e) {
        this.logger.error(`Failed to create pro ${pro.name}: ${e}`);
        errors++;
      }
    }

    this.logger.log(`Seed complete — created: ${created}, skipped: ${skipped}, errors: ${errors}`);
    return { created, skipped, errors };
  }

  // ─── Pro 목록 조회 (관리자용) ─────────────────────────────────────────────
  async getPros(params: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.user = { name: { contains: params.search, mode: 'insensitive' } };
    }

    const [data, total] = await Promise.all([
      this.prisma.proProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, profileImageUrl: true, email: true } },
          images: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.proProfile.count({ where }),
    ]);

    return {
      data: data.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: p.user.name,
        email: p.user.email,
        image: p.images[0]?.imageUrl || p.user.profileImageUrl,
        status: p.status,
        avgRating: Number(p.avgRating),
        reviewCount: p.reviewCount,
        isFeatured: p.isFeatured,
        showPartnersLogo: p.showPartnersLogo,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── Pro 상세 조회 ─────────────────────────────────────────────────────────
  async getProDetail(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true, profileImageUrl: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        services: true,
        faqs: true,
        categories: { include: { category: true } },
      },
    });
    if (!profile) throw new NotFoundException('전문가를 찾을 수 없습니다');
    return profile;
  }

  // ─── Pro 프로필 업데이트 (어드민이 직접 수정) ────────────────────────────────
  async updatePro(proProfileId: string, data: any) {
    const allowed: any = {};
    const editableFields = [
      'shortIntro', 'mainExperience', 'careerYears', 'awards',
      'youtubeUrl', 'detailHtml', 'gender',
      'isFeatured', 'showPartnersLogo', 'status', 'basePrice',
    ];
    for (const k of editableFields) if (data[k] !== undefined) allowed[k] = data[k];

    const profile = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: allowed,
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
      },
    });

    // User 레벨 필드도 함께 수정 가능
    if (data.name !== undefined || data.phone !== undefined) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
        },
      });
    }

    return profile;
  }

  // ─── Pro 승인 ─────────────────────────────────────────────────────────────
  async approvePro(proProfileId: string) {
    const profile = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { status: 'approved', approvedAt: new Date() },
      include: { user: { select: { id: true, name: true } } },
    });

    // user.role을 'pro'로 변경
    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { role: 'pro' },
    });

    // 승인 알림
    this.notificationService.createNotification(
      profile.userId,
      'system' as any,
      '파트너 신청이 승인되었습니다! 🎉',
      '프리티풀 파트너로 등록되었습니다. 지금 바로 프로필을 확인하세요.',
      { proProfileId },
    ).catch(() => {});

    return { success: true, proProfileId };
  }

  // ─── Pro 반려 ─────────────────────────────────────────────────────────────
  async rejectPro(proProfileId: string, reason?: string) {
    const profile = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { status: 'rejected' },
      include: { user: { select: { id: true } } },
    });

    this.notificationService.createNotification(
      profile.userId,
      'system' as any,
      '파트너 신청이 반려되었습니다',
      reason || '신청 조건을 재확인 후 다시 신청해 주세요.',
      { proProfileId },
    ).catch(() => {});

    return { success: true, proProfileId };
  }

  // ─── 파트너스 로고 토글 ──────────────────────────────────────────────────
  async togglePartnersLogo(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId } });
    if (!profile) throw new Error('Pro not found');
    return this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { showPartnersLogo: !profile.showPartnersLogo },
    });
  }

  // ─── Featured 토글 ───────────────────────────────────────────────────────
  async toggleFeatured(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({ where: { id: proProfileId } });
    if (!profile) throw new Error('Pro not found');
    return this.prisma.proProfile.update({
      where: { id: proProfileId },
      data: { isFeatured: !profile.isFeatured },
    });
  }

  // ─── 통계 ────────────────────────────────────────────────────────────────
  async getStats() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, totalPros, pendingPros, totalReviews, thisMonthRevenue, totalRevenue] = await Promise.all([
      this.prisma.user.count({ where: { role: 'general' } }),
      this.prisma.proProfile.count({ where: { status: 'approved' } }),
      this.prisma.proProfile.count({ where: { status: 'pending' } }),
      this.prisma.review.count(),
      this.prisma.payment.aggregate({ where: { status: 'completed', createdAt: { gte: thisMonthStart } }, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ where: { status: 'completed' }, _sum: { amount: true } }),
    ]);

    return {
      totalUsers,
      totalPros,
      pendingPros,
      totalReviews,
      thisMonthRevenue: thisMonthRevenue._sum.amount || 0,
      totalRevenue: totalRevenue._sum.amount || 0,
    };
  }

  // ─── 유저 목록 ───────────────────────────────────────────────────────────
  async getUsers(params: { page?: number; limit?: number; search?: string; role?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    if (params.role) where.role = params.role;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          profileImageUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: data.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        profileImageUrl: u.profileImageUrl,
        createdAt: u.createdAt,
        paymentCount: 0,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── 유저 권한 변경 ──────────────────────────────────────────────────────
  async updateUserRole(userId: string, role: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { role: role as any } });
  }

  // ─── 유저 삭제 ───────────────────────────────────────────────────────────
  async deleteUser(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  // ─── 결제 목록 ───────────────────────────────────────────────────────────
  async getPayments(params: { page?: number; limit?: number; status?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    if (params.status) where.status = params.status;

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    const userIds = [...new Set(payments.map((p) => p.userId))];
    const proIds = [...new Set(payments.map((p) => p.proProfileId))];

    const [users, proProfiles] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
      this.prisma.proProfile.findMany({ where: { id: { in: proIds } }, include: { user: { select: { id: true, name: true } } } }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const proMap = new Map(proProfiles.map((p) => [p.id, p.user?.name]));

    return {
      data: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        userName: userMap.get(p.userId) || null,
        proName: proMap.get(p.proProfileId) || null,
        createdAt: p.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── 리뷰 목록 ───────────────────────────────────────────────────────────
  async getReviews(params: { page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        include: {
          reviewer: { select: { name: true } },
          proProfile: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.review.count(),
    ]);

    return {
      data: data.map((r) => ({
        id: r.id,
        reviewerName: r.reviewer?.name,
        proName: r.proProfile?.user?.name,
        avgRating: r.avgRating,
        comment: r.comment,
        createdAt: r.createdAt,
        isAnonymous: r.isAnonymous,
      })),
      total,
      page,
      limit,
    };
  }

  // ─── 리뷰 삭제 ───────────────────────────────────────────────────────────
  async deleteReview(reviewId: string) {
    await this.prisma.review.delete({ where: { id: reviewId } });
    return { success: true };
  }

  // ─── 행사일 리마인더 크론 (매일 오전 9시) ──────────────────────────────
  @Cron('0 9 * * *')
  async sendEventReminders() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const quotations = await this.prisma.quotation.findMany({
      where: {
        status: 'paid',
        eventDate: {
          gte: new Date(todayStr),
          lte: new Date(tomorrowStr + 'T23:59:59'),
        },
      },
      include: {
        proProfile: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    for (const q of quotations) {
      const eventDate = q.eventDate ? new Date(q.eventDate).toISOString().split('T')[0] : '';
      const isToday = eventDate === todayStr;
      const title = isToday ? '오늘 행사가 있습니다! 🎉' : '내일 행사가 있습니다 📅';
      const body = isToday
        ? `오늘 ${q.proProfile.user.name} 사회자와 행사가 예정되어 있습니다.`
        : `내일 ${q.proProfile.user.name} 사회자와 행사가 예정되어 있습니다.`;

      this.notificationService.createNotification(q.userId, 'system' as any, title, body, {
        quotationId: q.id,
      }).catch(() => {});

      this.notificationService.createNotification(q.proProfile.userId, 'system' as any, title, body, {
        quotationId: q.id,
      }).catch(() => {});
    }

    this.logger.log(`Event reminders sent for ${quotations.length} quotations`);
  }
}
