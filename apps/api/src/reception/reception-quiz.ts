/**
 * 송년회 퀴즈(261122 사장 '퀴즈고 PPT 3라운드 — 정답이 공개될때 각 테이블마다 어떤 정답을 썼는지') — 문제·채점·보여 주기 규칙 한 곳.
 * 서버가 정답의 유일한 출처: 손님 화면엔 정답 칸(answer·accept)을 절대 보내지 않고, 공개(revealed)된 문제만 정답 글·해설·테이블 답을 보낸다.
 * 답은 테이블당 1개(테이블 사람들이 상의해서 한 답, 나중에 낸 답이 덮어씀). 어드민이 O/X 를 바꾸면 그게 우선(override).
 */
import { TABLE_COUNT } from './reception.rules';

export type QuizKind = 'text' | 'ox' | 'choice' | 'match' | 'mission';

export interface QuizQuestion {
  id: string;
  round: 1 | 2 | 3;
  roundTitle: string;
  no: number;
  kind: QuizKind;
  points: number;
  prompt: string;
  /** choice 보기 / match 오른쪽 보기('A) 피자스쿨' …) */
  options?: string[];
  /** match 왼쪽 칸 이름('1)' …) */
  slots?: string[];
  /** match 칸마다 그림 */
  slotImages?: string[];
  /** 문제 그림(웹 public 경로) */
  image?: string;
  /** text 입력 안내 */
  placeholder?: string;
  /** mission 규칙 줄 */
  notes?: string[];
  /** 저장 모양과 같은 정답(text 는 대표 답) */
  answer: string;
  /** text: 정규화한 정답 후보 */
  accept?: string[];
  /** 정답 공개 때 보이는 글 */
  answerLabel: string;
  explanation?: string;
}

const ROUND_TITLES = { 1: '워밍업', 2: '브레인스토밍', 3: 'Wedding' } as const;

const q = (x: Omit<QuizQuestion, 'roundTitle'>): QuizQuestion => ({ ...x, roundTitle: ROUND_TITLES[x.round] });

/** 문제 11개(퀴즈고 PPT + 사장 txt 그대로) — 순서 = 진행 순서 */
export const QUIZ_QUESTIONS: QuizQuestion[] = [
  q({
    id: 'r1q1', round: 1, no: 1, kind: 'text', points: 100,
    prompt: '프리티풀의 영문 표기는 무엇일까요?',
    placeholder: '영어로 적어 주세요',
    answer: 'freetiful', accept: ['freetiful'], answerLabel: 'freetiful',
  }),
  q({
    id: 'r1q2', round: 1, no: 2, kind: 'ox', points: 100,
    prompt: '프리티풀에서는 별도의 검증 절차 없이 누구나 사회자로 활동할 수 있다.',
    answer: 'X', answerLabel: 'X',
    explanation: '프리티풀은 사회자의 전문성과 진행 역량을 확인하는 검증 과정을 거쳐, 기준을 충족한 사회자들과 함께하고 있습니다.',
  }),
  q({
    id: 'r1q3', round: 1, no: 3, kind: 'choice', points: 100,
    prompt: '2026년 한 해 동안 프리티풀에 접수된 문의는 총 몇 건일까요?',
    options: ['1,211건', '1,633건', '1,863건', '2,011건'],
    answer: '4', answerLabel: '④ 2,011건',
    explanation: '2026년 한 해 동안 무려 2,011건의 문의가 프리티풀에 접수되었습니다! 많은 분들이 프리티풀을 찾아주신 만큼, 앞으로도 믿고 맡길 수 있는 서비스를 만들어가겠습니다.',
  }),
  q({
    id: 'r2q1', round: 2, no: 1, kind: 'match', points: 100,
    prompt: "피자 브랜드 로고의 일부 'P'만 보고 올바르게 짝지어 주세요.",
    slots: ['1)', '2)', '3)', '4)'],
    slotImages: ['/reception/quiz/pizza-1.webp', '/reception/quiz/pizza-2.webp', '/reception/quiz/pizza-3.webp', '/reception/quiz/pizza-4.webp'],
    options: ['A) 피자스쿨', 'B) 피자헛', 'C) 미스터피자', 'D) 도미노피자'],
    answer: 'BDAC', answerLabel: '1) 피자헛 · 2) 도미노피자 · 3) 피자스쿨 · 4) 미스터피자',
  }),
  q({
    id: 'r2q2', round: 2, no: 2, kind: 'choice', points: 100,
    prompt: '스타벅스에서 2020년 출시된 이 신메뉴의 이름은 무엇일까요?',
    options: ['피스타치오 크림 프라푸치노', '제주 금귤 민트 티', '프렌치 바닐라 라떼', '돌체 콜드 브루'],
    answer: '1', answerLabel: '① 피스타치오 크림 프라푸치노',
  }),
  q({
    id: 'r2q3', round: 2, no: 3, kind: 'choice', points: 100,
    prompt: '이 과자를 만든 회사는 어디일까요?',
    image: '/reception/quiz/cookie.webp',
    options: ['해태', '크라운', '롯데', '오리온'],
    answer: '2', answerLabel: '② 크라운',
  }),
  q({
    id: 'r2q4', round: 2, no: 4, kind: 'choice', points: 100,
    prompt: '"그들은 서로 (    ) 관계다"에서 빈칸에 들어갈 올바른 맞춤법은 무엇일까요?',
    options: ['얼키고설킨', '얼키고섥힌', '얽히고설킨', '얽히고섥킨'],
    answer: '3', answerLabel: '③ 얽히고설킨',
  }),
  q({
    id: 'r2q5', round: 2, no: 5, kind: 'choice', points: 100,
    prompt: '둘 중 어느 것이 맞는 말(표준어)일까요?',
    options: ['아리까리하다', '아리송하다'],
    answer: '2', answerLabel: '아리송하다',
  }),
  q({
    id: 'r3q1', round: 3, no: 1, kind: 'text', points: 100,
    prompt: '결혼을 앞둔 신부를 축하해 주려고 신부의 친구들이 열어 주는 파티예요. 신부가 아닌 친구들이 열어요. 이것을 영어로 적어 주세요.',
    placeholder: '영어로 적어 주세요',
    answer: 'Bridal Shower', accept: ['bridalshower'], answerLabel: 'Bridal Shower',
  }),
  q({
    id: 'r3q2', round: 3, no: 2, kind: 'text', points: 100,
    prompt: '이 웨딩홀은 어디일까요?', // 261122 사장 '이 웨딩홀은 어디일까요? 하고 3초 뒤에 이미지가 작아지면서 문제화면으로'
    image: '/reception/quiz/weddinghall.webp',
    placeholder: '웨딩홀 이름',
    answer: '슈슈몽드', accept: ['슈슈몽드', '슈슈몽드웨딩홀', '슈슈몽드웨딩', 'chouchoumonde'], answerLabel: '슈슈몽드',
  }),
  q({
    id: 'r3q3', round: 3, no: 3, kind: 'mission', points: 300,
    prompt: '스페셜 미션 · 타이밍을 지배하라!',
    notes: ['각 팀 대표 1명만 도전할 수 있어요', '음악은 랜덤으로 나와요', '기회는 단 한 번!', '정확한 타이밍에 멘트를 성공하면 300점', '도전하거나 패스할 수 있어요'],
    answer: '', answerLabel: '성공한 테이블 300점',
  }),
];

const BY_ID = new Map(QUIZ_QUESTIONS.map((x) => [x.id, x]));
export const quizQuestion = (id: unknown): QuizQuestion | undefined => (typeof id === 'string' ? BY_ID.get(id) : undefined);

/**
 * 스페셜 미션 '도전'(261122 사장 '퀴즈에 도전 버튼이 있어서 그거 누르면 참여자 명단에 실패 성공 버튼이 생겨서 성공이면 몇점 올라가게 테이블에').
 *  · 손님(테이블 대표)이 도전하기를 누르면 그 테이블 답 줄에 answer = '도전' · 낸 사람 이름 · 기기가 들어간다(테이블당 1명 · 기회 한 번).
 *  · 성공 · 실패는 운영팀이 참여자 명단(또는 퀴즈 진행판)에서 correct 로 찍는다 — 성공 = 그 문제 점수(300)가 그 테이블에.
 *  · 미션은 숨길 정답이 없어서 점수판에 바로 반영한다(공개 버튼을 안 눌러도 — quizBoardIds).
 */
export const MISSION_CHALLENGE = '도전';
export const MISSION_IDS: readonly string[] = QUIZ_QUESTIONS.filter((x) => x.kind === 'mission').map((x) => x.id);
export type MissionResult = 'pending' | 'success' | 'fail';
export const missionResult = (correct: boolean | null | undefined): MissionResult => (correct === true ? 'success' : correct === false ? 'fail' : 'pending');

/** 점수판에 넣을 문제 — 정답 공개된 문제 + 미션 전부(성공을 찍는 순간 그 테이블 점수가 오르게) */
export function quizBoardIds(state: Pick<QuizState, 'revealed'>): string[] {
  return [...new Set([...state.revealed, ...MISSION_IDS])];
}

export const TEXT_ANSWER_MAX = 40;
const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

/** text 채점용 정규화 — NFKC → 소문자 → 띄어쓰기·문장부호 전부 제거('Bridal-Shower!' == 'bridalshower') */
export function normalizeQuizText(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.,!?'"·・\-_~()[\]‘’“”`]+/g, '');
}

/** 답 검사·정규화(손님·어드민 같은 규칙) — 저장할 모양 또는 이유 */
export function parseQuizAnswer(question: QuizQuestion, raw: unknown): { answer: string } | { error: string } {
  switch (question.kind) {
    case 'mission':
      return { error: '미션 문제는 답을 내지 않아요. 운영팀이 성공·실패를 표시해요.' };
    case 'text': {
      if (typeof raw !== 'string') return { error: '답을 적어 주세요.' };
      const s = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (!s) return { error: '답을 적어 주세요.' };
      if ([...s].length > TEXT_ANSWER_MAX) return { error: `답은 ${TEXT_ANSWER_MAX}자까지 쓸 수 있어요.` };
      return { answer: s };
    }
    case 'ox': {
      const s = typeof raw === 'string' ? raw.normalize('NFKC').trim().toUpperCase() : '';
      if (s !== 'O' && s !== 'X') return { error: 'O 또는 X 를 골라 주세요.' };
      return { answer: s };
    }
    case 'choice': {
      const n = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\s*\d{1,2}\s*$/.test(raw) ? Number(raw) : NaN;
      const max = question.options?.length || 0;
      if (!Number.isInteger(n) || n < 1 || n > max) return { error: '보기 중에서 골라 주세요.' };
      return { answer: String(n) };
    }
    case 'match': {
      const slots = question.slots?.length || 0;
      const letters = 'ABCDEFGHIJ'.slice(0, question.options?.length || 0);
      const joined = Array.isArray(raw) ? raw.map((x) => (typeof x === 'string' ? x : '')).join('') : typeof raw === 'string' ? raw : '';
      const s = joined.normalize('NFKC').toUpperCase().replace(/[\s,]+/g, '');
      if (s.length !== slots) return { error: `${slots}칸 모두 골라 주세요.` };
      if (![...s].every((c) => letters.includes(c))) return { error: `${letters[0]}~${letters[letters.length - 1]} 중에서 골라 주세요.` };
      return { answer: s };
    }
  }
}

/** 자동 채점 — 답 없음·미션은 false */
export function autoCorrect(question: QuizQuestion, answer: string | null): boolean {
  if (!answer) return false;
  switch (question.kind) {
    case 'text': {
      const n = normalizeQuizText(answer);
      return !!n && (question.accept || []).some((a) => normalizeQuizText(a) === n);
    }
    case 'ox':
    case 'choice':
    case 'match':
      return answer === question.answer;
    case 'mission':
      return false;
  }
}

/** 최종 O/X — 어드민 판정이 있으면 그것, 없으면 자동 채점 */
export function finalCorrect(question: QuizQuestion, answer: string | null, override: boolean | null): boolean {
  return override ?? autoCorrect(question, answer);
}

/** 사람이 읽는 답 — choice '④ 2,011건', ox 'O', match '1)B 2)D 3)A 4)C', text 그대로, 없음 null */
export function displayAnswer(question: QuizQuestion, answer: string | null): string | null {
  if (!answer) return null;
  switch (question.kind) {
    case 'choice': {
      const i = Number(answer) - 1;
      const opt = question.options?.[i];
      return opt != null ? `${CIRCLED[i] || `${i + 1}.`} ${opt}` : answer;
    }
    case 'match':
      return (question.slots || []).map((slot, i) => `${slot}${answer[i] ?? '?'}`).join(' ');
    default:
      return answer;
  }
}

/** 답 행(DB reception_quiz_answers 에서 필요한 칸만) */
export interface QuizAnswerRow {
  questionId: string;
  tableNo: number;
  answer: string | null;
  name: string | null;
  correct: boolean | null;
  updatedAt: Date;
}

export interface QuizBoardRow {
  table: number;
  score: number;
  correct: number;
}

/** 점수판 — 테이블 1~19 전부, questionIds 에 든 문제만 맞힌 점수 합. 점수 많은 순 → 테이블 번호 순 */
export function quizBoard(rows: QuizAnswerRow[], questionIds: Iterable<string>): QuizBoardRow[] {
  const ids = new Set(questionIds);
  const board = Array.from({ length: TABLE_COUNT }, (_, i) => ({ table: i + 1, score: 0, correct: 0 }));
  for (const r of rows) {
    if (!ids.has(r.questionId) || r.tableNo < 1 || r.tableNo > TABLE_COUNT) continue;
    const question = BY_ID.get(r.questionId);
    if (!question || !finalCorrect(question, r.answer, r.correct)) continue;
    board[r.tableNo - 1].score += question.points;
    board[r.tableNo - 1].correct += 1;
  }
  return board.sort((a, b) => b.score - a.score || a.table - b.table);
}

export type QuizPhase = 'idle' | 'open' | 'locked' | 'revealed';

export interface QuizState {
  currentId: string | null;
  phase: QuizPhase;
  openedAt: string | null;
  /** 제한시간에 더한 초(261123 사장 '퀴즈는 60초 추가하는거') — 문제를 새로 열면 0. 화면 시계 = QUIZ_SECONDS + extraSec */
  extraSec: number;
  revealed: string[];
  showBoard: boolean;
}

/** [+60초] 한 번에 더하는 초 · 한 문제에 더할 수 있는 최대 */
export const QUIZ_EXTEND_SEC = 60;
export const QUIZ_EXTRA_MAX = 600;

export const defaultQuizState = (): QuizState => ({ currentId: null, phase: 'idle', openedAt: null, extraSec: 0, revealed: [], showBoard: false });

const PHASES: QuizPhase[] = ['idle', 'open', 'locked', 'revealed'];

/** DB JSON → 상태(모양이 틀린 칸은 기본값으로 — 문제 목록에 없는 id 는 버린다) */
export function parseQuizState(v: unknown): QuizState {
  const o = (v && typeof v === 'object' && !Array.isArray(v) ? v : {}) as Record<string, unknown>;
  const currentId = quizQuestion(o.currentId) ? (o.currentId as string) : null;
  const phase = currentId && PHASES.includes(o.phase as QuizPhase) ? (o.phase as QuizPhase) : 'idle';
  const openedAt = typeof o.openedAt === 'string' && !Number.isNaN(Date.parse(o.openedAt)) ? o.openedAt : null;
  const revealed = Array.isArray(o.revealed) ? [...new Set(o.revealed.filter((id): id is string => !!quizQuestion(id)))] : [];
  const extraSec = typeof o.extraSec === 'number' && Number.isInteger(o.extraSec) && o.extraSec > 0 ? Math.min(o.extraSec, QUIZ_EXTRA_MAX) : 0;
  return { currentId: phase === 'idle' ? null : currentId, phase, openedAt, extraSec, revealed, showBoard: o.showBoard === true };
}

export type QuizAction = 'open' | 'lock' | 'reveal' | 'unreveal' | 'idle' | 'board' | 'reset' | 'extend';
const ACTIONS: QuizAction[] = ['open', 'lock', 'reveal', 'unreveal', 'idle', 'board', 'reset', 'extend'];
export const isQuizAction = (v: unknown): v is QuizAction => typeof v === 'string' && (ACTIONS as string[]).includes(v);

/**
 * 어드민 진행 버튼 → 다음 상태(순수 함수). 틀리면 이유.
 * reset 의 답 지우기는 서비스가 한다(여기선 전체 초기화일 때 상태만 기본값으로).
 */
export function applyQuizAction(state: QuizState, body: { action?: unknown; questionId?: unknown; on?: unknown }, now: Date): QuizState | string {
  const action = body.action;
  if (!isQuizAction(action)) return '없는 동작이에요.';
  const s: QuizState = { ...state, revealed: [...state.revealed] };
  switch (action) {
    case 'open': {
      const question = quizQuestion(body.questionId);
      if (!question) return '없는 문제예요.';
      // 다시 열면 정답도 다시 공개해야 한다(예전 공개가 남아 답이 미리 보이지 않게)
      return { ...s, currentId: question.id, phase: 'open', openedAt: now.toISOString(), extraSec: 0, revealed: s.revealed.filter((id) => id !== question.id) };
    }
    case 'extend':
      // 받는 중인 문제의 시계에 60초 더하기(시간이 다 된 뒤에도 — 다 된 시점부터가 아니라 처음 시계에 더한다)
      if (!s.currentId || s.phase !== 'open') return '답을 받는 중인 문제가 없어요.';
      if (s.extraSec + QUIZ_EXTEND_SEC > QUIZ_EXTRA_MAX) return `한 문제에 ${QUIZ_EXTRA_MAX / 60}분까지만 더할 수 있어요.`;
      return { ...s, extraSec: s.extraSec + QUIZ_EXTEND_SEC };
    case 'lock':
      if (!s.currentId) return '진행 중인 문제가 없어요.';
      return { ...s, phase: 'locked' };
    case 'reveal':
      if (!s.currentId) return '진행 중인 문제가 없어요.';
      return { ...s, phase: 'revealed', revealed: s.revealed.includes(s.currentId) ? s.revealed : [...s.revealed, s.currentId] };
    case 'unreveal': {
      const question = quizQuestion(body.questionId);
      if (!question) return '없는 문제예요.';
      const back = s.currentId === question.id && s.phase === 'revealed';
      return { ...s, revealed: s.revealed.filter((id) => id !== question.id), phase: back ? 'locked' : s.phase };
    }
    case 'idle':
      return { ...s, currentId: null, phase: 'idle' };
    case 'board':
      if (typeof body.on !== 'boolean') return '켜기·끄기를 골라 주세요.';
      return { ...s, showBoard: body.on };
    case 'reset':
      if (body.questionId != null && body.questionId !== '') {
        if (!quizQuestion(body.questionId)) return '없는 문제예요.';
        return s;
      }
      return defaultQuizState();
  }
}

/** 손님에게 보내는 문제 — 정답 칸(answer·accept)은 빼고, 공개된 문제만 정답 글·해설 */
export interface QuizQuestionPublic {
  id: string;
  round: 1 | 2 | 3;
  roundTitle: string;
  no: number;
  kind: QuizKind;
  points: number;
  prompt: string;
  options?: string[];
  slots?: string[];
  slotImages?: string[];
  image?: string;
  placeholder?: string;
  notes?: string[];
  answerLabel?: string;
  explanation?: string;
}

export function publicQuestion(question: QuizQuestion, withAnswer: boolean): QuizQuestionPublic {
  const { answer: _a, accept: _b, answerLabel, explanation, ...rest } = question;
  return withAnswer ? { ...rest, answerLabel, ...(explanation ? { explanation } : {}) } : rest;
}

export interface QuizTableResult {
  table: number;
  answer: string | null;
  display: string | null;
  name: string | null;
  correct: boolean;
}

/** 문제 하나의 테이블 1~19 답 — 안 낸 테이블은 answer null(어드민이 미션 성공만 찍은 테이블은 correct true) */
export function tableResults(question: QuizQuestion, rows: QuizAnswerRow[]): QuizTableResult[] {
  const byTable = new Map(rows.filter((r) => r.questionId === question.id).map((r) => [r.tableNo, r]));
  return Array.from({ length: TABLE_COUNT }, (_, i) => {
    const r = byTable.get(i + 1);
    const answer = r?.answer ?? null;
    return { table: i + 1, answer, display: displayAnswer(question, answer), name: r?.name ?? null, correct: finalCorrect(question, answer, r?.correct ?? null) };
  });
}

export interface QuizMine {
  questionId: string;
  answer: string;
  display: string;
  name: string;
  updatedAt: string;
  /** 미션만 — 우리 테이블 도전 결과(대기 · 성공 · 실패). 정답을 숨길 게 없는 문제라 공개 전에도 보낸다 */
  result?: MissionResult;
}

/** 손님 퀴즈 화면 — 3초마다 받는다 */
export interface QuizPublic {
  state: QuizState;
  /** 11문제 전부(정답 칸 없음, 공개된 문제만 answerLabel·explanation) */
  questions: QuizQuestionPublic[];
  /** 우리 테이블이 지금 문제에 낸 답 */
  mine: QuizMine | null;
  /** 공개된 문제만 — 테이블 1~19 답 */
  results: Record<string, { answerLabel: string; explanation?: string; tables: QuizTableResult[] }>;
  /** 공개된 문제 + 미션(성공 찍으면 바로) 채점한 점수판 */
  board: QuizBoardRow[];
  tableCount: number;
}

/** 테이블과 상관없는 부분(모든 손님 같음) — 서비스가 1초 묶어 두고 mine 만 붙인다 */
export function quizPublicShared(state: QuizState, rows: QuizAnswerRow[]): Omit<QuizPublic, 'mine'> {
  const revealed = new Set(state.revealed);
  const results: QuizPublic['results'] = {};
  for (const question of QUIZ_QUESTIONS) {
    if (!revealed.has(question.id)) continue;
    results[question.id] = {
      answerLabel: question.answerLabel,
      ...(question.explanation ? { explanation: question.explanation } : {}),
      tables: tableResults(question, rows),
    };
  }
  return {
    state,
    questions: QUIZ_QUESTIONS.map((question) => publicQuestion(question, revealed.has(question.id))),
    results,
    board: quizBoard(rows, quizBoardIds(state)),
    tableCount: TABLE_COUNT,
  };
}

/**
 * 우리 테이블 답 — table 이 1~19 이고 지금 문제에 답이 있을 때만.
 * 미션은 도전한 줄(answer '도전') 또는 운영팀이 도전 없이 결과만 찍은 줄(answer 없음 · 이름 '')도 — 결과(result)를 같이 준다.
 */
export function quizMine(state: QuizState, rows: QuizAnswerRow[], table: number | null): QuizMine | null {
  if (table == null || !state.currentId) return null;
  const question = quizQuestion(state.currentId);
  const r = rows.find((x) => x.questionId === state.currentId && x.tableNo === table);
  if (!question || !r) return null;
  if (question.kind === 'mission') {
    if (!r.answer && r.correct == null) return null;
    return {
      questionId: question.id,
      answer: r.answer || '',
      display: r.answer ? MISSION_CHALLENGE : '',
      name: r.answer ? r.name || '' : '',
      updatedAt: r.updatedAt.toISOString(),
      result: missionResult(r.correct),
    };
  }
  if (!r.answer) return null;
  return {
    questionId: question.id,
    answer: r.answer,
    display: displayAnswer(question, r.answer) || r.answer,
    name: r.name || '',
    updatedAt: r.updatedAt.toISOString(),
  };
}

export interface QuizAdminTable {
  table: number;
  answer: string | null;
  display: string | null;
  name: string | null;
  updatedAt: string | null;
  /** 자동 채점 */
  auto: boolean;
  /** 어드민 판정(null = 자동) */
  override: boolean | null;
  /** 최종 */
  correct: boolean;
}

export interface QuizAdmin {
  state: QuizState;
  /** 정답 글·해설 늘 포함(answer·accept 원값은 뺌) */
  questions: Array<QuizQuestionPublic & { answerLabel: string; explanation?: string }>;
  /** 11문제 전부 */
  results: Record<string, { tables: QuizAdminTable[]; submitted: number; correctCount: number }>;
  /** 공개된 문제 + 미션(손님과 같음) */
  board: QuizBoardRow[];
  /** 전 문제 채점(어드민 참고용) */
  boardAll: QuizBoardRow[];
  tableCount: number;
}

export function quizAdmin(state: QuizState, rows: QuizAnswerRow[]): QuizAdmin {
  const results: QuizAdmin['results'] = {};
  for (const question of QUIZ_QUESTIONS) {
    const byTable = new Map(rows.filter((r) => r.questionId === question.id).map((r) => [r.tableNo, r]));
    const tables = Array.from({ length: TABLE_COUNT }, (_, i): QuizAdminTable => {
      const r = byTable.get(i + 1);
      const answer = r?.answer ?? null;
      const override = r?.correct ?? null;
      const auto = autoCorrect(question, answer);
      return {
        table: i + 1,
        answer,
        display: displayAnswer(question, answer),
        name: r?.name ?? null,
        updatedAt: r ? r.updatedAt.toISOString() : null,
        auto,
        override,
        correct: override ?? auto,
      };
    });
    results[question.id] = {
      tables,
      submitted: tables.filter((t) => t.answer != null).length,
      correctCount: tables.filter((t) => t.correct).length,
    };
  }
  return {
    state,
    questions: QUIZ_QUESTIONS.map((question) => publicQuestion(question, true) as QuizQuestionPublic & { answerLabel: string }),
    results,
    board: quizBoard(rows, quizBoardIds(state)),
    boardAll: quizBoard(rows, QUIZ_QUESTIONS.map((question) => question.id)),
    tableCount: TABLE_COUNT,
  };
}
