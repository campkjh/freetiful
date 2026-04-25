import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { ProService } from '../pro/pro.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { ImageService } from '../image/image.service';
import { UsersService } from '../users/users.service';
import { randomUUID } from 'crypto';
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
    private proService: ProService,
    private discoveryService: DiscoveryService,
    private imageService: ImageService,
    private usersService: UsersService,
  ) {}

  /** 어드민이 특정 유저(또는 다수 유저)에게 쿠폰 발급 — UsersService 헬퍼 위임 */
  async grantCoupon(userIds: string[], couponId: string) {
    const results = await Promise.allSettled(
      userIds.map((uid) => this.usersService.awardCoupon(uid, couponId)),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    return { requested: userIds.length, succeeded, failed: userIds.length - succeeded };
  }

  // ─── 웨딩 파트너 업체 (BusinessProfile) CRUD ────────────────────────────
  // 어드민이 직접 업체를 등록/수정/삭제. 소유 유저가 없으면 placeholder User 자동 생성.
  async getBusinesses(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const where: any = {};
    if (params.search) {
      where.OR = [
        { businessName: { contains: params.search, mode: 'insensitive' } },
        { businessType: { contains: params.search, mode: 'insensitive' } },
        { address: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        include: {
          images: { orderBy: { displayOrder: 'asc' }, take: 1, select: { imageUrl: true } },
          categories: { include: { category: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      data: data.map((b) => ({
        id: b.id,
        businessName: b.businessName,
        businessType: b.businessType,
        address: b.address,
        phone: b.phone,
        status: b.status,
        createdAt: b.createdAt,
        images: b.images.map((i) => ({ imageUrl: i.imageUrl })),
        categories: b.categories.map((c) => ({ category: { name: c.category.name } })),
      })),
      total,
      page,
      limit,
    };
  }

  async getBusinessDetail(id: string) {
    const business = await this.prisma.businessProfile.findUnique({
      where: { id },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    if (!business) throw new NotFoundException('업체를 찾을 수 없습니다');
    return business;
  }

  async createBusiness(data: {
    businessName: string;
    businessType?: string;
    address?: string;
    addressDetail?: string;
    phone?: string;
    lat?: number | string;
    lng?: number | string;
    descriptionHtml?: string;
    instagramUrl?: string;
    websiteUrl?: string;
    videoUrl?: string;
    categoryNames?: string[];
    status?: string;
  }) {
    if (!data.businessName || !data.businessName.trim()) {
      throw new NotFoundException('업체명은 필수입니다');
    }

    // placeholder User (role=business) 자동 생성 — BusinessProfile.userId 제약 때문
    const placeholderEmail = `biz-${randomUUID()}@freetiful.internal`;
    const user = await this.prisma.user.create({
      data: {
        name: data.businessName,
        email: placeholderEmail,
        role: 'business',
        referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      },
    });

    // 카테고리 이름 → id 매핑 (type=business 에 한해)
    const categoryIds: string[] = [];
    if (Array.isArray(data.categoryNames) && data.categoryNames.length > 0) {
      const cats = await this.prisma.category.findMany({
        where: { type: 'business', name: { in: data.categoryNames } },
        select: { id: true },
      });
      categoryIds.push(...cats.map((c) => c.id));
    }

    const profile = await this.prisma.businessProfile.create({
      data: {
        userId: user.id,
        businessName: data.businessName,
        status: (data.status as any) || 'approved',
        businessType: data.businessType || null,
        address: data.address || null,
        addressDetail: data.addressDetail || null,
        phone: data.phone || null,
        lat: data.lat !== undefined && data.lat !== null && data.lat !== '' ? Number(data.lat) : null,
        lng: data.lng !== undefined && data.lng !== null && data.lng !== '' ? Number(data.lng) : null,
        descriptionHtml: data.descriptionHtml || null,
        instagramUrl: data.instagramUrl || null,
        websiteUrl: data.websiteUrl || null,
        videoUrl: data.videoUrl || null,
        approvedAt: (data.status as any) === 'approved' || !data.status ? new Date() : null,
        categories: categoryIds.length
          ? { create: categoryIds.map((categoryId) => ({ categoryId })) }
          : undefined,
      },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    return profile;
  }

  async updateBusiness(
    id: string,
    data: {
      businessName?: string;
      businessType?: string;
      address?: string;
      addressDetail?: string;
      phone?: string;
      lat?: number | string | null;
      lng?: number | string | null;
      descriptionHtml?: string;
      instagramUrl?: string;
      websiteUrl?: string;
      videoUrl?: string;
      categoryNames?: string[];
      status?: string;
    },
  ) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('업체를 찾을 수 없습니다');

    const allowed: any = {};
    if (data.businessName !== undefined) allowed.businessName = data.businessName;
    if (data.businessType !== undefined) allowed.businessType = data.businessType || null;
    if (data.address !== undefined) allowed.address = data.address || null;
    if (data.addressDetail !== undefined) allowed.addressDetail = data.addressDetail || null;
    if (data.phone !== undefined) allowed.phone = data.phone || null;
    if (data.lat !== undefined) allowed.lat = data.lat === null || data.lat === '' ? null : Number(data.lat);
    if (data.lng !== undefined) allowed.lng = data.lng === null || data.lng === '' ? null : Number(data.lng);
    if (data.descriptionHtml !== undefined) allowed.descriptionHtml = data.descriptionHtml || null;
    if (data.instagramUrl !== undefined) allowed.instagramUrl = data.instagramUrl || null;
    if (data.websiteUrl !== undefined) allowed.websiteUrl = data.websiteUrl || null;
    if (data.videoUrl !== undefined) allowed.videoUrl = data.videoUrl || null;
    if (data.status !== undefined) {
      allowed.status = data.status as any;
      if (data.status === 'approved' && !existing.approvedAt) allowed.approvedAt = new Date();
    }

    // 카테고리 갱신 — 전체 치환 방식 (요청에 categoryNames 포함된 경우에만)
    if (Array.isArray(data.categoryNames)) {
      const cats = await this.prisma.category.findMany({
        where: { type: 'business', name: { in: data.categoryNames } },
        select: { id: true },
      });
      await this.prisma.businessCategory.deleteMany({ where: { businessProfileId: id } });
      if (cats.length > 0) {
        await this.prisma.businessCategory.createMany({
          data: cats.map((c) => ({ businessProfileId: id, categoryId: c.id })),
          skipDuplicates: true,
        });
      }
    }

    const profile = await this.prisma.businessProfile.update({
      where: { id },
      data: allowed,
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
      },
    });
    return profile;
  }

  async deleteBusiness(id: string) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('업체를 찾을 수 없습니다');
    // cascade 가 images/categories 를 자동 삭제 — placeholder user 도 함께 정리
    const userId = existing.userId;
    await this.prisma.businessProfile.delete({ where: { id } });
    // placeholder biz-*@freetiful.internal 유저만 삭제 (실제 유저 보호)
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user?.email?.startsWith('biz-') && user.email.endsWith('@freetiful.internal')) {
      await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
    return { success: true };
  }

  async uploadBusinessImage(businessId: string, file: Express.Multer.File) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { id: businessId } });
    if (!existing) throw new NotFoundException('업체를 찾을 수 없습니다');

    const processed = await this.imageService.processImage(file, {
      maxWidth: 1600,
      maxHeight: 1600,
      quality: 85,
      requireFace: false,
    });

    const last = await this.prisma.businessImage.findFirst({
      where: { businessProfileId: businessId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    const nextOrder = (last?.displayOrder ?? -1) + 1;

    const img = await this.prisma.businessImage.create({
      data: {
        businessProfileId: businessId,
        imageUrl: processed.path,
        displayOrder: nextOrder,
      },
    });
    return img;
  }

  async deleteBusinessImage(businessId: string, imageId: string) {
    const img = await this.prisma.businessImage.findUnique({ where: { id: imageId } });
    if (!img || img.businessProfileId !== businessId) {
      throw new NotFoundException('이미지를 찾을 수 없습니다');
    }
    await this.prisma.businessImage.delete({ where: { id: imageId } });
    return { success: true };
  }

  async reorderBusinessImages(businessId: string, imageIds: string[]) {
    const images = await this.prisma.businessImage.findMany({
      where: { businessProfileId: businessId, id: { in: imageIds } },
      select: { id: true },
    });
    const validIds = new Set(images.map((i) => i.id));
    await this.prisma.$transaction(
      imageIds
        .filter((id) => validIds.has(id))
        .map((id, idx) =>
          this.prisma.businessImage.update({
            where: { id },
            data: { displayOrder: idx },
          }),
        ),
    );
    return { success: true };
  }

  async getBusinessCategories() {
    return this.prisma.category.findMany({
      where: { type: 'business', isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: { id: true, name: true, nameEn: true, iconUrl: true, displayOrder: true },
    });
  }

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
        puddingCount: p.puddingCount,
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
        user: { select: { id: true, email: true, name: true, phone: true, profileImageUrl: true, role: true, isActive: true, isBanned: true } },
        images: { orderBy: { displayOrder: 'asc' } },
        services: { orderBy: { displayOrder: 'asc' } },
        faqs: { orderBy: { displayOrder: 'asc' } },
        categories: { include: { category: true } },
        regions: { include: { region: true } },
        languages: true,
        _count: {
          select: {
            images: true,
            services: true,
            reviews: true,
            quotations: true,
            chatRooms: true,
            schedules: true,
            matchDeliveries: true,
            puddingTransactions: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('전문가를 찾을 수 없습니다');
    const adminRelations = await this.getProAdminRelations(proProfileId);
    return { ...profile, adminRelations };
  }

  private async getProAdminRelations(proProfileId: string) {
    const [
      favorites,
      chatRooms,
      quotations,
      payments,
      schedules,
      reviews,
      matchDeliveries,
      puddingTransactions,
      settlementLogs,
    ] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { targetType: 'pro', targetId: proProfileId },
        include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.chatRoom.findMany({
        where: { proProfileId },
        include: {
          user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
          matchRequest: { select: { id: true, eventDate: true, eventLocation: true, status: true } },
          _count: { select: { messages: true, quotations: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 50,
      }),
      this.prisma.quotation.findMany({
        where: { proProfileId },
        include: {
          payment: { select: { id: true, amount: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.payment.findMany({
        where: { proProfileId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.proSchedule.findMany({
        where: { proProfileId },
        include: { payment: { select: { id: true, amount: true, status: true } } },
        orderBy: { date: 'desc' },
        take: 80,
      }),
      this.prisma.review.findMany({
        where: { proProfileId },
        include: {
          reviewer: { select: { id: true, name: true, email: true } },
          payment: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.matchDelivery.findMany({
        where: { proProfileId },
        include: {
          matchRequest: {
            include: {
              user: { select: { id: true, name: true, email: true, phone: true } },
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { deliveredAt: 'desc' },
        take: 50,
      }),
      this.prisma.puddingTransaction.findMany({
        where: { proProfileId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.settlementLog.findMany({
        where: { proProfileId },
        include: { payment: { select: { id: true, amount: true, status: true, createdAt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const userIds = Array.from(new Set([...quotations.map((q) => q.userId), ...payments.map((p) => p.userId)].filter(Boolean)));
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, phone: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      favorites,
      chatRooms,
      quotations: quotations.map((q) => ({ ...q, user: userMap.get(q.userId) || null })),
      payments: payments.map((p) => ({ ...p, user: userMap.get(p.userId) || null })),
      schedules,
      reviews,
      matchDeliveries,
      puddingTransactions,
      settlementLogs,
    };
  }

  // ─── Pro 프로필 업데이트 (어드민이 직접 수정) ────────────────────────────────
  async updatePro(proProfileId: string, data: any) {
    const allowed: any = {};
    const editableFields = [
      'shortIntro', 'mainExperience', 'careerYears', 'awards',
      'youtubeUrl', 'detailHtml', 'gender',
      'isFeatured', 'showPartnersLogo', 'status',
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

    this.discoveryService.invalidateCache(proProfileId);
    return profile;
  }

  // ─── Pro 프로필 전체 수정 (submitRegistration 재사용) ────────────────────
  // 사진, 서비스, FAQ, 언어 등 전체 필드를 어드민이 수정 가능
  async fullUpdatePro(proProfileId: string, data: any) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: { userId: true, status: true },
    });
    if (!profile) throw new NotFoundException('전문가를 찾을 수 없습니다');

    // submitRegistration 호출 (name 은 제외 — 어드민은 아래에서 User 직접 수정)
    await this.proService.submitRegistration(profile.userId, {
      phone: data.phone,
      gender: data.gender,
      shortIntro: data.shortIntro,
      mainExperience: data.mainExperience,
      careerYears: data.careerYears !== undefined ? Number(data.careerYears) : undefined,
      awards: data.awards,
      youtubeUrl: data.youtubeUrl,
      detailHtml: data.detailHtml,
      photos: Array.isArray(data.photos) ? data.photos : undefined,
      mainPhotoIndex: data.mainPhotoIndex,
      services: Array.isArray(data.services) ? data.services : undefined,
      faqs: Array.isArray(data.faqs) ? data.faqs : undefined,
      languages: Array.isArray(data.languages) ? data.languages : undefined,
      category: typeof data.category === 'string' ? data.category : undefined,
      regions: Array.isArray(data.regions) ? data.regions : undefined,
      tags: Array.isArray(data.tags) ? data.tags : undefined,
    });

    // 어드민은 User.name 을 직접 바꿀 수 있음 (일반 pro-edit 에서는 불가)
    if (data.name !== undefined) {
      await this.prisma.user.update({
        where: { id: profile.userId },
        data: { name: data.name },
      });
    }

    // 어드민만 수정 가능한 flag 필드
    const adminOnly: any = {};
    if (data.isFeatured !== undefined) adminOnly.isFeatured = data.isFeatured;
    if (data.showPartnersLogo !== undefined) adminOnly.showPartnersLogo = data.showPartnersLogo;
    if (data.status !== undefined) {
      adminOnly.status = data.status;
      if (data.status === 'approved') adminOnly.approvedAt = new Date();
    }
    if (Object.keys(adminOnly).length > 0) {
      await this.prisma.proProfile.update({
        where: { id: proProfileId },
        data: adminOnly,
      });
    }

    this.discoveryService.invalidateCache(proProfileId);
    return this.getProDetail(proProfileId);
  }

  // ─── 더미 계정 → 실제 계정으로 프로 프로필 이관 ─────────────────────────
  // sourceEmail 의 ProProfile(+이미지/서비스/FAQ/리뷰 등 연관 데이터)을
  // targetEmail 계정으로 통째로 옮기고, source 계정은 비활성화(email 변경)
  async transferProProfile(sourceEmail: string, targetEmail: string) {
    if (!sourceEmail || !targetEmail) {
      throw new NotFoundException('sourceEmail, targetEmail 필요');
    }

    const source = await this.prisma.user.findUnique({
      where: { email: sourceEmail },
      include: { proProfile: true },
    });
    if (!source) throw new NotFoundException(`source 계정 없음: ${sourceEmail}`);
    if (!source.proProfile) throw new NotFoundException(`source 계정에 프로필 없음`);

    const target = await this.prisma.user.findUnique({
      where: { email: targetEmail },
      include: { proProfile: true },
    });
    if (!target) throw new NotFoundException(`target 계정 없음: ${targetEmail}`);

    // target에 기존 proProfile이 있다면 삭제 (userId @unique 제약 때문)
    if (target.proProfile) {
      await this.prisma.proProfile.delete({ where: { id: target.proProfile.id } });
    }

    // ProProfile.userId를 target으로 변경 (연관 데이터는 FK로 따라옴)
    const transferred = await this.prisma.proProfile.update({
      where: { id: source.proProfile.id },
      data: { userId: target.id },
    });

    // target 유저 정보 업데이트: role='pro' 로, 프로필 이미지가 없으면 source 값으로 보완.
    // 이름(User.name)은 target 것을 유지 — 실계정 이름이 덮어쓰이지 않도록.
    await this.prisma.user.update({
      where: { id: target.id },
      data: {
        role: 'pro',
        ...(target.profileImageUrl ? {} : { profileImageUrl: source.profileImageUrl }),
      },
    });

    // source 계정 비활성화: 이메일을 archived-{ts}-... 로 변경해 재시딩/충돌 방지
    await this.prisma.user.update({
      where: { id: source.id },
      data: { email: `archived-${Date.now()}-${sourceEmail}` },
    });

    // 캐시 무효화
    this.discoveryService.invalidateCache(transferred.id);

    return {
      success: true,
      sourceEmail,
      targetEmail,
      transferredProfileId: transferred.id,
      newOwnerUserId: target.id,
    };
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

  /** 어드민 수동 푸딩 지급 (양수=적립, 음수=차감) + 트랜잭션 로그 */
  async awardPudding(proProfileId: string, amount: number, note?: string) {
    if (!Number.isFinite(amount) || amount === 0) {
      throw new Error('amount는 0이 아닌 숫자여야 합니다.');
    }
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: { id: true, puddingCount: true },
    });
    if (!profile) throw new Error('Pro not found');
    const nextCount = Math.max(0, profile.puddingCount + amount);
    await this.prisma.$transaction([
      this.prisma.proProfile.update({
        where: { id: proProfileId },
        data: { puddingCount: nextCount },
      }),
      this.prisma.puddingTransaction.create({
        data: {
          proProfileId,
          type: amount > 0 ? 'admin_grant' : 'admin_deduct',
          amount,
          balanceAfter: nextCount,
          note: note ?? '어드민 수동 지급',
        },
      }),
    ]);
    return { proProfileId, previousBalance: profile.puddingCount, amount, newBalance: nextCount };
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
          proProfile: {
            select: {
              id: true,
              status: true,
              shortIntro: true,
              images: { select: { id: true }, take: 1 },
              _count: { select: { images: true, services: true } },
            },
          },
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
        proProfile: u.proProfile
          ? {
              id: u.proProfile.id,
              status: u.proProfile.status,
              hasIntro: !!u.proProfile.shortIntro,
              imageCount: u.proProfile._count.images,
              serviceCount: u.proProfile._count.services,
              isEmpty:
                !u.proProfile.shortIntro &&
                u.proProfile._count.images === 0 &&
                u.proProfile._count.services === 0,
            }
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        authProviders: { select: { id: true, provider: true, providerEmail: true, createdAt: true } },
        notificationSettings: true,
        refundAccount: true,
        businessProfile: {
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 3 },
            categories: { include: { category: true } },
          },
        },
        proProfile: {
          include: {
            images: { orderBy: { displayOrder: 'asc' }, take: 5 },
            services: { orderBy: { displayOrder: 'asc' } },
            categories: { include: { category: true } },
            regions: { include: { region: true } },
            languages: true,
            _count: {
              select: {
                reviews: true,
                quotations: true,
                chatRooms: true,
                schedules: true,
                matchDeliveries: true,
                puddingTransactions: true,
              },
            },
          },
        },
        _count: {
          select: {
            favorites: true,
            chatRooms: true,
            sentMessages: true,
            notifications: true,
            reviews: true,
            matchRequests: true,
            pointTransactions: true,
            userCoupons: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다');

    const [
      favorites,
      chatRooms,
      matchRequests,
      quotations,
      payments,
      reviews,
      notifications,
      pointTransactions,
      userCoupons,
    ] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.chatRoom.findMany({
        where: { userId },
        include: {
          proProfile: {
            include: {
              user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
              images: { orderBy: { displayOrder: 'asc' }, take: 1 },
            },
          },
          matchRequest: { select: { id: true, eventDate: true, eventLocation: true, status: true } },
          _count: { select: { messages: true, quotations: true } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 80,
      }),
      this.prisma.matchRequest.findMany({
        where: { userId },
        include: {
          category: { select: { id: true, name: true } },
          eventCategory: { select: { id: true, name: true } },
          deliveries: {
            include: {
              proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
            },
            take: 20,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.quotation.findMany({
        where: { userId },
        include: {
          proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
          payment: { select: { id: true, amount: true, status: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.payment.findMany({
        where: { userId },
        include: {
          schedules: true,
          quotations: { select: { id: true, title: true, eventDate: true, eventLocation: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.review.findMany({
        where: { reviewerId: userId },
        include: {
          proProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
          payment: { select: { id: true, amount: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 80,
      }),
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.userCoupon.findMany({
        where: { userId },
        include: { coupon: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const favoriteProIds = favorites.filter((f) => f.targetType === 'pro').map((f) => f.targetId);
    const favoriteBusinessIds = favorites.filter((f) => f.targetType === 'business').map((f) => f.targetId);
    const [favoritePros, favoriteBusinesses, paymentPros] = await Promise.all([
      favoriteProIds.length
        ? this.prisma.proProfile.findMany({
            where: { id: { in: favoriteProIds } },
            include: {
              user: { select: { id: true, name: true, email: true, profileImageUrl: true } },
              images: { orderBy: { displayOrder: 'asc' }, take: 1 },
            },
          })
        : Promise.resolve([]),
      favoriteBusinessIds.length
        ? this.prisma.businessProfile.findMany({
            where: { id: { in: favoriteBusinessIds } },
            include: { images: { orderBy: { displayOrder: 'asc' }, take: 1 } },
          })
        : Promise.resolve([]),
      payments.length
        ? this.prisma.proProfile.findMany({
            where: { id: { in: Array.from(new Set(payments.map((p) => p.proProfileId))) } },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
    ]);
    const favoriteProMap = new Map(favoritePros.map((p) => [p.id, p]));
    const favoriteBusinessMap = new Map(favoriteBusinesses.map((b) => [b.id, b]));
    const paymentProMap = new Map(paymentPros.map((p) => [p.id, p]));

    return {
      user,
      relations: {
        favorites: favorites.map((f) => ({
          ...f,
          target:
            f.targetType === 'pro'
              ? favoriteProMap.get(f.targetId) || null
              : favoriteBusinessMap.get(f.targetId) || null,
        })),
        chatRooms,
        matchRequests,
        quotations,
        payments: payments.map((p) => ({ ...p, proProfile: paymentProMap.get(p.proProfileId) || null })),
        reviews,
        notifications,
        pointTransactions,
        userCoupons,
      },
    };
  }

  async updateUser(userId: string, data: any) {
    const allowed: any = {};
    const editableFields = [
      'name',
      'email',
      'phone',
      'role',
      'profileImageUrl',
      'isActive',
      'isBanned',
      'banReason',
      'pointBalance',
      'referralCode',
    ];
    for (const field of editableFields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    if (allowed.pointBalance !== undefined) allowed.pointBalance = Number(allowed.pointBalance) || 0;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: allowed,
    });

    if (data.notificationSettings && typeof data.notificationSettings === 'object') {
      const settingsFields = [
        'chatPush',
        'bookingPush',
        'paymentPush',
        'reviewPush',
        'systemPush',
        'marketingPush',
        'marketingSms',
        'marketingEmail',
      ];
      const settings: any = {};
      for (const field of settingsFields) {
        if (data.notificationSettings[field] !== undefined) {
          settings[field] = Boolean(data.notificationSettings[field]);
        }
      }
      if (Object.keys(settings).length > 0) {
        await this.prisma.notificationSettings.upsert({
          where: { userId },
          update: settings,
          create: { userId, ...settings },
        });
      }
    }

    return this.getUserDetail(user.id);
  }

  // ─── 유저 권한 변경 ──────────────────────────────────────────────────────
  async updateUserRole(userId: string, role: string) {
    return this.prisma.user.update({ where: { id: userId }, data: { role: role as any } });
  }

  // ─── 이메일 중복 유저 진단 / 정리 ─────────────────────────────────────────
  // 검색어 포함 이메일의 모든 유저와 프로프로필을 반환 → 어드민이 눈으로 판단 가능
  async findUsersByEmail(searchEmail: string) {
    if (!searchEmail) return [];
    const users = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { contains: searchEmail, mode: 'insensitive' } },
          { name: { contains: searchEmail, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        profileImageUrl: true,
        proProfile: {
          select: {
            id: true,
            status: true,
            shortIntro: true,
            _count: { select: { images: true, services: true, reviews: true, quotations: true } },
            createdAt: true,
            updatedAt: true,
          },
        },
        authProviders: { select: { provider: true, providerEmail: true, createdAt: true } },
        _count: { select: { chatRooms: true, sentMessages: true, reviews: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((u) => ({
      ...u,
      proProfileScore: u.proProfile
        ? (u.proProfile._count.images + u.proProfile._count.services + u.proProfile._count.reviews * 2)
        : 0,
    }));
  }

  // 빈 ProProfile 일괄 정리: 이미지 0장이고 shortIntro 없는 프로필을 draft 로 강등
  // (approved 된 빈 프로필이 공개 목록에 잡혀 있던 문제 일괄 수정)
  async cleanupEmptyProProfiles() {
    const empty = await this.prisma.proProfile.findMany({
      where: {
        status: 'approved',
        images: { none: {} },
      },
      select: { id: true, userId: true, user: { select: { name: true, email: true } } },
    });
    const ids = empty.map((p) => p.id);
    if (ids.length === 0) return { archivedCount: 0, archived: [] };
    await this.prisma.proProfile.updateMany({
      where: { id: { in: ids } },
      data: { status: 'draft' },
    });
    this.discoveryService.invalidateCache();
    return {
      archivedCount: ids.length,
      archived: empty.map((p) => ({ id: p.id, userId: p.userId, name: p.user.name, email: p.user.email })),
    };
  }

  // 지정 유저를 소프트 삭제 (email → archived-{ts}-{email}, role→archived)
  // 연관 데이터 (ChatRoom, Payment, Message 등)는 유지 → 참조 무결성 보장
  async archiveUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저 없음');
    const ts = Date.now();
    const newEmail = user.email ? `archived-${ts}-${user.email}` : null;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        isActive: false,
      },
    });
    return { success: true, userId, archivedEmail: newEmail };
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

  async updateQuotation(id: string, data: any) {
    const allowed: any = {};
    const fields = ['amount', 'title', 'description', 'eventLocation', 'validUntil', 'status'];
    for (const field of fields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    if (allowed.amount !== undefined) allowed.amount = Number(allowed.amount) || 0;
    if (data.eventDate !== undefined) allowed.eventDate = data.eventDate ? new Date(data.eventDate) : null;
    if (data.eventTime !== undefined) allowed.eventTime = data.eventTime ? new Date(`1970-01-01T${data.eventTime}`) : null;
    return this.prisma.quotation.update({ where: { id }, data: allowed });
  }

  async deleteQuotation(id: string) {
    await this.prisma.quotation.delete({ where: { id } });
    return { success: true };
  }

  async updatePayment(id: string, data: any) {
    const allowed: any = {};
    const fields = ['amount', 'platformFee', 'netAmount', 'method', 'status', 'refundAmount', 'refundReason'];
    for (const field of fields) {
      if (data[field] !== undefined) allowed[field] = data[field] === '' ? null : data[field];
    }
    for (const field of ['amount', 'platformFee', 'netAmount', 'refundAmount']) {
      if (allowed[field] !== undefined && allowed[field] !== null) allowed[field] = Number(allowed[field]) || 0;
    }
    if (allowed.status === 'refunded' && !data.refundedAt) allowed.refundedAt = new Date();
    if (data.refundedAt !== undefined) allowed.refundedAt = data.refundedAt ? new Date(data.refundedAt) : null;
    if (data.escrowReleasedAt !== undefined) allowed.escrowReleasedAt = data.escrowReleasedAt ? new Date(data.escrowReleasedAt) : null;
    if (data.settledAt !== undefined) allowed.settledAt = data.settledAt ? new Date(data.settledAt) : null;
    return this.prisma.payment.update({ where: { id }, data: allowed });
  }

  async deletePayment(id: string) {
    await this.prisma.$transaction([
      this.prisma.quotation.updateMany({ where: { paymentId: id }, data: { paymentId: null } }),
      this.prisma.proSchedule.updateMany({ where: { paymentId: id }, data: { paymentId: null } }),
      this.prisma.review.deleteMany({ where: { paymentId: id } }),
      this.prisma.payment.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async updateSchedule(id: string, data: any) {
    const allowed: any = {};
    if (data.date !== undefined) allowed.date = data.date ? new Date(data.date) : undefined;
    if (data.status !== undefined) allowed.status = data.status;
    if (data.note !== undefined) allowed.note = data.note || null;
    if (data.source !== undefined) allowed.source = data.source || 'admin';
    if (data.paymentId !== undefined) allowed.paymentId = data.paymentId || null;
    return this.prisma.proSchedule.update({ where: { id }, data: allowed });
  }

  async deleteSchedule(id: string) {
    await this.prisma.proSchedule.delete({ where: { id } });
    return { success: true };
  }

  async updateMatchDelivery(id: string, data: any) {
    const allowed: any = {};
    if (data.status !== undefined) allowed.status = data.status;
    if (data.viewedAt !== undefined) allowed.viewedAt = data.viewedAt ? new Date(data.viewedAt) : null;
    if (data.repliedAt !== undefined) allowed.repliedAt = data.repliedAt ? new Date(data.repliedAt) : null;
    return this.prisma.matchDelivery.update({ where: { id }, data: allowed });
  }

  async deleteMatchDelivery(id: string) {
    await this.prisma.matchDelivery.delete({ where: { id } });
    return { success: true };
  }

  async updateMatchRequest(id: string, data: any) {
    const allowed: any = {};
    if (data.status !== undefined) allowed.status = data.status;
    if (data.eventLocation !== undefined) allowed.eventLocation = data.eventLocation || null;
    if (data.eventDate !== undefined) allowed.eventDate = data.eventDate ? new Date(data.eventDate) : null;
    if (data.budgetMin !== undefined) allowed.budgetMin = data.budgetMin === '' ? null : Number(data.budgetMin);
    if (data.budgetMax !== undefined) allowed.budgetMax = data.budgetMax === '' ? null : Number(data.budgetMax);
    return this.prisma.matchRequest.update({ where: { id }, data: allowed });
  }

  async deleteMatchRequest(id: string) {
    await this.prisma.matchRequest.delete({ where: { id } });
    return { success: true };
  }

  async deleteFavorite(id: string) {
    await this.prisma.favorite.delete({ where: { id } });
    return { success: true };
  }

  async deleteNotification(id: string) {
    await this.prisma.notification.delete({ where: { id } });
    return { success: true };
  }

  async updateNotification(id: string, data: any) {
    const isRead = Boolean(data.isRead);
    return this.prisma.notification.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title || null } : {}),
        ...(data.body !== undefined ? { body: data.body || null } : {}),
        ...(data.isRead !== undefined ? { isRead, readAt: isRead ? new Date() : null } : {}),
      },
    });
  }

  async deleteChatRoom(id: string) {
    const now = new Date();
    return this.prisma.chatRoom.update({
      where: { id },
      data: { userDeletedAt: now, proDeletedAt: now },
    });
  }

  async deleteMessage(id: string) {
    return this.prisma.message.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), content: null },
    });
  }

  // ─── 행사일 리마인더 크론 (한국시간 매일 오전 9시 — 당일 + D-3) ────────
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async sendEventReminders() {
    const todayStr = new Date().toISOString().split('T')[0];
    const threeDaysLater = new Date();
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

    const quotations = await this.prisma.quotation.findMany({
      where: {
        status: 'paid',
        eventDate: { in: [new Date(todayStr), new Date(threeDaysStr)] },
      },
      include: {
        proProfile: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    for (const q of quotations) {
      const eventDate = q.eventDate ? new Date(q.eventDate).toISOString().split('T')[0] : '';
      const isToday = eventDate === todayStr;
      const title = isToday ? '오늘 행사가 있습니다! 🎉' : '3일 뒤 행사가 예정되어 있습니다 📅';
      const body = isToday
        ? `오늘 ${q.proProfile.user.name} 사회자와 행사가 예정되어 있습니다.`
        : `3일 뒤 ${q.proProfile.user.name} 사회자와 행사가 예정되어 있습니다. 준비하세요!`;

      this.notificationService.createNotification(q.userId, 'system' as any, title, body, {
        quotationId: q.id,
      }).catch(() => {});

      this.notificationService.createNotification(q.proProfile.userId, 'system' as any, title, body, {
        quotationId: q.id,
      }).catch(() => {});
    }

    this.logger.log(`Event reminders sent for ${quotations.length} quotations (today + D-3)`);
  }

  // ─── 후기 요청 크론 (한국시간 매일 오전 10시 — 행사 1일 후, 리뷰 없는 건) ──
  @Cron('0 10 * * *', { timeZone: 'Asia/Seoul' })
  async sendReviewRequestReminders() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const quotations = await this.prisma.quotation.findMany({
      where: {
        status: 'paid',
        eventDate: new Date(yesterdayStr),
        paymentId: { not: null },
      },
      include: {
        proProfile: { include: { user: { select: { name: true } } } },
        payment: { include: { review: { select: { id: true } } } },
      },
    });

    const pending = quotations.filter((q) => q.payment && !q.payment.review);
    for (const q of pending) {
      const proName = q.proProfile.user.name;
      this.notificationService
        .createNotification(
          q.userId,
          'review' as any,
          '행사는 어떠셨나요? ⭐',
          `${proName} 사회자와의 행사 후기를 남겨주세요.`,
          { quotationId: q.id, proProfileId: q.proProfileId },
        )
        .catch(() => {});
    }

    this.logger.log(`Review request reminders sent for ${pending.length} quotations`);
  }

  // ─── 사회자 출석체크 크론 (한국시간 매일 오전 9시) ─────────────────────
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async sendProDailyAttendanceReminder() {
    const pros = await this.prisma.proProfile.findMany({
      where: { status: 'approved' },
      select: { userId: true },
    });

    for (const p of pros) {
      this.notificationService
        .createNotification(
          p.userId,
          'system' as any,
          '오늘도 출석체크 하셨나요? 🍮',
          '프리티풀에 접속해 푸딩을 받아보세요!',
          { type: 'pro_attendance' },
        )
        .catch(() => {});
    }

    this.logger.log(`Pro daily attendance reminders sent to ${pros.length} pros`);
  }
}
