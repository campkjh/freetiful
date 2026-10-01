// 대사 데이터 — 인사·일상·부탁·보상·결혼식·기념일을 상황별로 나눈다. 같은 날 같은 인사를 반복하지 않는다(talkedToday).
// 말투: 소담 = 다정한 존댓말, 우디 = 느긋한 반말("허허"), 도담 = 명랑한 반말("~지롱", "~라구").
import type { QuestStatus } from './quests';
import { affinityLevel } from './residents';

export type Expr = 'normal' | 'smile' | 'joy' | 'surprise' | 'shy' | 'sad';

export interface Line {
  who: string; // 'sodam' | 'woody' | 'dodam' | 'me' | 'partner' | 'sys'
  text: string;
  expr?: Expr;
}

export interface Choice {
  label: string;
  action?: string;
  then?: DNode;
}

export interface DNode {
  lines: Line[];
  choices?: Choice[];
  /** 대사를 다 읽은 뒤 실행 */
  action?: string;
}

export interface DialogueCtx {
  me: string;
  partner: string;
  quest: (id: string) => QuestStatus;
  count: (item: string) => number;
  affinity: number;
  talkedToday: boolean;
  hour: number;
  day: number;
  weddings: number;
  ready: boolean;
  missing: string[];
}

const pick = <T,>(arr: T[], seed: number): T => arr[Math.abs(Math.floor(seed)) % arr.length];

function chatChoices(id: string, extra: Choice[] = []): Choice[] {
  return [...extra, { label: '선물하기', action: `gift.open:${id}` }, { label: '이야기 나누기', action: `chat:${id}` }, { label: '안녕', action: 'close' }];
}

// ── 소담 ──────────────────────────────────────────────
function sodam(c: DialogueCtx): DNode {
  const S = (text: string, expr?: Expr): Line => ({ who: 'sodam', text, expr });
  const q = c.quest;
  if (q('welcome') === 'active') {
    return {
      lines: [
        S('어머, 새로 이사 온 분이군요? 저는 꽃잎 온실의 소담이에요.', 'smile'),
        S(`${c.me} 님이랑 ${c.partner} 님 이야기는 숲 바람으로 들었어요. 여기서 결혼식을 올리실 거라면서요?`, 'joy'),
        S('결혼식엔 꽃이 꼭 필요해요. 그 전에… 작은 부탁 하나 들어줄래요?'),
      ],
      action: 'q.complete:welcome',
      choices: [
        {
          label: '좋아요, 들어 볼게요',
          action: 'q.accept:sodam_flowers',
          then: { lines: [S('숲 곳곳에 하얀 꽃이 피어 있어요. 세 송이만 따서 보여 줄래요?', 'smile'), S('꽃은 가져가지 않을게요. 얼마나 곱게 피었는지 보고 싶을 뿐이에요.')] },
        },
        { label: '조금 이따가요', then: { lines: [S('언제든 괜찮아요. 온실은 늘 열려 있어요.', 'smile')] } },
      ],
    };
  }
  if (q('sodam_flowers') === 'available') {
    return {
      lines: [S('흰 꽃 세 송이 부탁, 지금 들어줄래요?')],
      choices: [
        { label: '좋아요', action: 'q.accept:sodam_flowers', then: { lines: [S('고마워요! 길가와 광장 근처에 흰 꽃이 많아요.', 'joy')] } },
        { label: '나중에요' },
      ],
    };
  }
  if (q('sodam_flowers') === 'active' || q('sodam_flowers') === 'ready') {
    const n = c.count('white_flower');
    if (n >= 3) {
      return {
        lines: [S('와, 흰 꽃 세 송이네요!', 'surprise')],
        choices: [
          {
            label: '흰 꽃 보여주기',
            action: 'q.complete:sodam_flowers',
            then: {
              lines: [
                S('정말 곱게 따 왔어요. 꽃잎이 하나도 상하지 않았네요.', 'joy'),
                S('고마워요. 이 리본 받아요. 흰 꽃 세 송이를 이 리본으로 묶으면 부케가 돼요.', 'smile'),
                S('온실 앞 하얀 부케 테이블에서 만들 수 있어요. 첫 부케, 기대할게요!'),
              ],
            },
          },
          { label: '조금 이따가요' },
        ],
      };
    }
    return { lines: [S(`흰 꽃은 길가와 광장 근처에 많아요. 지금 ${n}송이네요. 세 송이가 되면 보여 주세요!`, 'smile')] };
  }
  if (q('first_bouquet') === 'active') {
    const n = c.count('white_flower');
    return {
      lines: [
        S('부케 테이블은 온실 앞 하얀 테이블이에요. 흰 꽃 세 송이와 리본 하나면 돼요.', 'smile'),
        ...(n < 3 ? [S(`지금 흰 꽃이 ${n}송이라 조금 더 따 오면 돼요.`)] : []),
      ],
    };
  }
  if (c.weddings > 0 && !c.talkedToday) {
    return {
      lines: [S(pick(['예식 날 꽃잎이 바람에 날리던 순간, 아직도 생각나요.', '약속의 나무는 잘 자라요? 물은 제가 몰래 주고 있어요.', '두 분이 함께 걸으면 길가 꽃들이 더 환해 보여요.'], c.day), 'joy')],
      choices: chatChoices('sodam', [{ label: '가게 둘러보기', action: 'shop.open' }]),
    };
  }
  if (q('meet_woody') === 'active') {
    return {
      lines: [S('첫 부케, 정말 예뻐요! 결혼식 장식은 공방의 우디가 잘 알아요.', 'joy'), S('광장 서쪽 길로 가면 나뭇결 공방이 나와요.')],
      choices: chatChoices('sodam', [{ label: '가게 둘러보기', action: 'shop.open' }]),
    };
  }
  const greet = c.talkedToday
    ? pick(['또 만났네요! 필요한 게 있으면 말해요.', '꽃 손질하다 보면 하루가 금방 가요.'], c.hour)
    : c.hour < 11
      ? pick(['좋은 아침이에요! 아침 이슬 맺힌 꽃이 제일 예뻐요.', '안녕하세요! 오늘은 데이지가 유난히 하얗게 피었어요.'], c.day)
      : c.hour < 18
        ? pick(['오후엔 화단을 한 바퀴 돌아요. 꽃들 표정이 다 달라요.', '햇살이 좋아서 분홍 꽃이 활짝 폈어요.'], c.day)
        : pick(['저녁 바람에 꽃향기가 실려 와요.', '오늘도 수고했어요. 꽃들도 이제 쉴 시간이에요.'], c.day);
  const lv = affinityLevel(c.affinity);
  const extra = lv >= 2 && !c.talkedToday ? [S('…사실 저, 언젠가 화이트 플라워 예식을 꾸며 보는 게 꿈이에요.', 'shy')] : [];
  return { lines: [S(greet, 'smile'), ...extra], choices: chatChoices('sodam', [{ label: '가게 둘러보기', action: 'shop.open' }]) };
}

// ── 우디 ──────────────────────────────────────────────
function woody(c: DialogueCtx): DNode {
  const W = (text: string, expr?: Expr): Line => ({ who: 'woody', text, expr });
  const q = c.quest;
  if (q('meet_woody') === 'active') {
    return {
      lines: [W('허허, 소담이 보냈구나. 나는 공방의 우디야.', 'smile'), W('결혼식에 아치가 빠지면 섭섭하지. 만드는 법을 알려 줄까?')],
      action: 'q.complete:meet_woody',
      choices: [
        {
          label: '알려 주세요!',
          action: 'q.accept:woody_arch',
          then: {
            lines: [
              W('목재 여덟 개, 흰 꽃 여섯 송이. 그게 웨딩 아치의 전부야.'),
              W('목재는 나무를 흔들거나 공방 옆 목재 더미에서 얻을 수 있어.'),
              W('하객 의자 여섯 개는 내가 미리 만들어 뒀다. 가방에 넣어 주마.', 'joy'),
              W('다 모이면 저 작업대에서 만들어 봐. 다른 장식 만드는 법도 같이 적어 뒀지.', 'smile'),
            ],
          },
        },
        { label: '조금 있다가요', then: { lines: [W('그래, 나무는 어디 안 가.')] } },
      ],
    };
  }
  if (q('woody_arch') === 'available') {
    return {
      lines: [W('아치 만드는 법, 지금 알려 줄까?')],
      choices: [{ label: '네!', action: 'q.accept:woody_arch', then: { lines: [W('목재 여덟 개, 흰 꽃 여섯 송이. 하객 의자는 내가 챙겨 두지.', 'joy')] } }, { label: '나중에요' }],
    };
  }
  if (q('woody_arch') === 'active') {
    const w = c.count('wood');
    const f = c.count('white_flower');
    if (w >= 8 && f >= 6) return { lines: [W('재료가 다 모였네! 작업대에서 아치를 만들어 보렴.', 'joy')] };
    return { lines: [W(`목재 ${Math.min(w, 8)}/8, 흰 꽃 ${Math.min(f, 6)}/6이구나. 천천히 모아 오렴.`, 'smile'), W('나무는 살살 흔들어야 가지가 상하지 않아.')] };
  }
  if (q('decorate_garden') === 'active') {
    return { lines: [W('아치를 만들었구나! 서약의 정원 표지판 앞에서 꾸미기를 시작할 수 있어.', 'joy'), W('의자는 통로 양옆에 두면 하객들이 편하지.')], choices: chatChoices('woody') };
  }
  if (c.weddings > 0 && !c.talkedToday) {
    return { lines: [W(pick(['허허, 예식 날 둘 다 참 늠름했어.', '약속의 나무가 자라는 걸 보니 내 마음이 다 뿌듯하구나.', '장식이 더 필요하면 언제든 작업대를 써.'], c.day), 'smile')], choices: chatChoices('woody') };
  }
  const greet = c.talkedToday
    ? pick(['또 왔구나. 차 한잔하고 가렴.', '나무는 천천히 다듬어야 결이 살아.'], c.hour)
    : c.hour < 12
      ? pick(['허허, 아침엔 대패 소리가 제일 맑지.', '좋은 아침. 오늘 목재 결이 아주 곱다.'], c.day)
      : c.hour < 18
        ? pick(['호수 바람 쐬러 가는 길이야. 같이 걸을래?', '점심 먹고 나니 나른하구먼.'], c.day)
        : pick(['저녁엔 공방 앞에서 별 보는 게 낙이지.', '오늘도 잘 다듬었다. 허허.'], c.day);
  const lv = affinityLevel(c.affinity);
  const extra = lv >= 2 && !c.talkedToday ? [W('사실 이 공방 의자들, 다 내 첫 의뢰인이 앉았던 모양을 본뜬 거야.', 'shy')] : [];
  return { lines: [W(greet, 'smile'), ...extra], choices: chatChoices('woody') };
}

// ── 도담 ──────────────────────────────────────────────
function dodam(c: DialogueCtx): DNode {
  const D = (text: string, expr?: Expr): Line => ({ who: 'dodam', text, expr });
  const q = c.quest;
  if (q('first_wedding') === 'active') {
    if (c.ready) {
      return {
        lines: [D('모든 준비 끝! 하객들도 벌써 두근두근 기다리고 있다구!', 'joy'), D('지금 예식을 시작할까?')],
        choices: [{ label: '시작할게요', action: 'ceremony.start' }, { label: '조금만 기다려 줘', then: { lines: [D('알았어! 준비되면 다시 불러 줘.', 'smile')] } }],
      };
    }
    return {
      lines: [D('앗, 아직 준비가 덜 됐어!', 'surprise'), ...c.missing.map((m) => D(`· ${m}`))],
      choices: [{ label: '준비 확인하기', action: 'ceremony.check' }, { label: '알겠어' }],
    };
  }
  if (c.weddings > 0) {
    return {
      lines: [D(c.talkedToday ? '또 왔네! 예식 한 번 더 올려 볼래?' : '그날 예식, 내 사회 인생 최고의 순간이었지롱!', 'joy')],
      choices: [
        { label: '예식 다시 올리기', action: 'ceremony.replay' },
        { label: '선물하기', action: 'gift.open:dodam' },
        { label: '이야기 나누기', action: 'chat:dodam' },
        { label: '안녕', action: 'close' },
      ],
    };
  }
  if (q('wedding_outfit') === 'active') {
    return { lines: [D('장식 완벽해! 이제 햇살 의상실 거울에서 웨딩 의상을 골라 와!', 'joy'), D('의상실은 광장 서쪽 끝이야. 쇼윈도에 드레스가 반짝반짝하다구!')], choices: chatChoices('dodam') };
  }
  if (q('decorate_garden') === 'active') {
    return {
      lines: [D('정원 표지판에서 꾸미기를 시작할 수 있어!', 'smile'), D('아치는 맨 안쪽, 의자는 통로 양옆! 통로는 비워 둬야 두 사람이 걸어 들어오지롱.')],
      choices: chatChoices('dodam'),
    };
  }
  const first = !c.talkedToday;
  return {
    lines: first
      ? [D('와아! 반가워! 나는 도담, 이 숲의 결혼식 사회자라구!', 'joy'), D('결혼식 준비가 되면 서약의 정원에서 나를 불러 줘. 멋지게 진행해 주지롱!')]
      : [D(pick(['오늘도 사회 연습 중! "신랑 신부 입장~!" 어때, 멋지지?', '광장 게시판에 새 소식이 붙었는지 봤어?'], c.hour), 'smile')],
    choices: chatChoices('dodam'),
  };
}

export function residentDialogue(id: string, c: DialogueCtx): DNode {
  if (id === 'sodam') return sodam(c);
  if (id === 'woody') return woody(c);
  return dodam(c);
}

/** '이야기 나누기' — 친밀도에 따라 개인 이야기가 열린다 */
export function chatLines(id: string, c: DialogueCtx): Line[] {
  const lv = affinityLevel(c.affinity);
  const pool: Record<string, string[][]> = {
    sodam: [
      ['흰 데이지의 꽃말은 "순수한 마음"이에요.', '분홍 꽃은 "사랑의 맹세"래요. 부케에 하나쯤 섞어도 예뻐요.'],
      ['비 오는 날엔 온실 유리에 빗방울이 그림을 그려요.', '꽃은 말을 걸면 더 예쁘게 핀대요. 저는 매일 인사해요.'],
      ['어릴 땐 꽃 이름을 하나도 몰랐어요. 할머니 온실에서 하나씩 배웠죠.', '언젠가 이 온실을 꽃으로 가득 채운 결혼식장으로 꾸며 보고 싶어요.'],
      ['두 분을 보면 제 꿈도 가까워진 기분이에요. 고마워요.'],
    ],
    woody: [
      ['좋은 의자는 앉는 사람을 닮아야 해.', '나무를 흔들 땐 너무 세게 말고, 살살.'],
      ['비 오는 날엔 공방에서 나무 냄새가 더 진하지.', '호숫가 데크도 내가 깔았어. 삐걱거리면 말해.'],
      ['처음 만든 의자는 다리가 하나 짧았지. 허허, 그래도 그 의자가 제일 좋아.', '마을 아치는 전부 내 손을 거쳤어. 이번 아치도 기대해.'],
      ['네 아치를 보니 젊을 때 생각이 나는구나. 고맙다.'],
    ],
    dodam: [
      ['사회는 목소리보다 타이밍이 중요하다구!', '입장할 땐 천천히! 하객들이 사진 찍을 시간을 줘야 해.'],
      ['게시판 소식은 내가 제일 먼저 알지롱.', '광장 큰 나무 아래가 연습하기 딱 좋아.'],
      ['사실 나 첫 사회 때 신랑 이름을 까먹었어… 쉿, 비밀이야!', '그 뒤로는 카드에 이름을 크게 써 두지롱.'],
      ['너희 예식은 내가 평생 자랑할 거라구!'],
    ],
  };
  const sets = pool[id] || pool.dodam;
  const unlocked = sets.slice(0, Math.min(sets.length, lv + 1)).flat();
  const text = unlocked[(c.day * 7 + c.hour) % unlocked.length];
  return [{ who: id, text, expr: 'smile' }];
}

/** 선물 반응 */
export function giftLines(id: string, itemName: string, liked: boolean, already: boolean): Line[] {
  if (already) return [{ who: id, text: '오늘은 벌써 선물을 받았어요. 마음만 받을게요!', expr: 'smile' }];
  const t: Record<string, [string, string]> = {
    sodam: [`${itemName}! 제가 정말 좋아하는 거예요. 고마워요!`, `${itemName}, 고마워요. 소중히 쓸게요.`],
    woody: [`허허, ${itemName}! 내 취향을 아는구나!`, `${itemName}? 고맙다. 잘 쓰마.`],
    dodam: [`우와아! ${itemName}! 완전 내 취향이라구!`, `${itemName}? 고마워, 잘 간직할게!`],
  };
  const [like, normal] = t[id] || t.dodam;
  return [{ who: id, text: liked ? like : normal, expr: liked ? 'joy' : 'smile' }];
}
