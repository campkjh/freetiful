import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ReceptionEventKey, cleanName, parseTableNo } from './reception.rules';
import {
  QuizAdmin,
  QuizAnswerRow,
  QuizPublic,
  QuizState,
  applyQuizAction,
  defaultQuizState,
  isQuizAction,
  parseQuizAnswer,
  parseQuizState,
  quizAdmin,
  quizMine,
  quizPublicShared,
  quizQuestion,
} from './reception-quiz';

/** 퀴즈 상태·답을 묶어 두는 시간 — 손님 ~150명이 3초마다 불러도 DB 는 1초에 한두 번만(쓰면 바로 버림) */
const QUIZ_CACHE_MS = 1000;
const STATE_KEY = 'quiz';

interface QuizSnapshot {
  state: QuizState;
  rows: QuizAnswerRow[];
  shared: Omit<QuizPublic, 'mine'>;
}

/**
 * 송년회 퀴즈(261122) — 규칙·문제는 reception-quiz.ts.
 * 진행 상태는 reception_state('quiz') 한 줄: 어드민 버튼은 그 줄을 잠그고(FOR UPDATE) 읽고-고치고-쓴다(두 태블릿이 겹쳐 눌러도 하나씩).
 * 손님 답은 '지금 열린 문제일 때만 넣기'를 SQL 한 문장으로 해서 마감 버튼과 겹쳐도 마감 뒤 답이 들어가지 않게 한다.
 */
@Injectable()
export class ReceptionQuizService {
  private readonly cache = new Map<string, { at: number; p: Promise<QuizSnapshot> }>();

  constructor(private readonly prisma: PrismaService) {}

  private async read(eventKey: string): Promise<QuizSnapshot> {
    const [st, rows] = await Promise.all([
      this.prisma.receptionState.findUnique({ where: { eventKey_key: { eventKey, key: STATE_KEY } }, select: { value: true } }),
      this.prisma.receptionQuizAnswer.findMany({
        where: { eventKey },
        select: { questionId: true, tableNo: true, answer: true, name: true, correct: true, updatedAt: true },
      }),
    ]);
    const state = parseQuizState(st?.value);
    return { state, rows, shared: quizPublicShared(state, rows) };
  }

  /** 묶어 둔 것 또는 새로 읽기 — 동시에 온 요청은 같은 읽기를 기다린다(만료 순간 DB 로 한꺼번에 몰리지 않게) */
  private load(eventKey: string, fresh = false): Promise<QuizSnapshot> {
    const hit = this.cache.get(eventKey);
    if (!fresh && hit && Date.now() - hit.at < QUIZ_CACHE_MS) return hit.p;
    const entry = { at: Date.now(), p: this.read(eventKey) };
    this.cache.set(eventKey, entry);
    entry.p.catch(() => {
      if (this.cache.get(eventKey) === entry) this.cache.delete(eventKey);
    });
    return entry.p;
  }

  private drop(eventKey: string) {
    this.cache.delete(eventKey);
  }

  async publicView(eventKey: ReceptionEventKey, table: number | null): Promise<QuizPublic> {
    const snap = await this.load(eventKey);
    return { ...snap.shared, mine: quizMine(snap.state, snap.rows, table) };
  }

  /** 손님 답 내기 — 테이블당 1개(나중 답이 덮어쓰고, 답이 바뀌었을 때만 어드민 판정을 지운다) */
  async answer(
    eventKey: ReceptionEventKey,
    deviceId: string,
    body: { questionId?: unknown; table?: unknown; answer?: unknown; name?: unknown },
  ): Promise<QuizPublic> {
    const question = quizQuestion(body?.questionId);
    if (!question) throw new BadRequestException('없는 문제예요.');
    if (question.kind === 'mission') throw new BadRequestException('미션 문제는 답을 내지 않아요. 운영팀이 성공·실패를 표시해요.');
    const table = parseTableNo(body?.table);
    if (table == null) throw new BadRequestException('테이블 번호를 골라 주세요.');
    const name = cleanName(body?.name);
    if (!name) throw new BadRequestException('이름을 먼저 입력해 주세요.');
    const parsed = parseQuizAnswer(question, body?.answer);
    if ('error' in parsed) throw new BadRequestException(parsed.error);

    // 상태 확인 + 넣기를 한 문장으로 — 열린 문제가 아니면 0줄.
    // 같은 답을 한 번 더 누른 거면 어드민 판정(O/X 고정)은 그대로 — adminAnswer 의 '답이 바뀌면 판정 버림'과 같은 규칙
    const n = await this.prisma.$executeRaw`
      INSERT INTO "reception_quiz_answers" ("id", "eventKey", "questionId", "tableNo", "answer", "name", "deviceId", "correct", "updatedAt")
      SELECT ${randomUUID()}::text, ${eventKey}::text, ${question.id}::text, ${table}::int, ${parsed.answer}::text, ${name}::text, ${deviceId}::text, NULL::boolean, CURRENT_TIMESTAMP
      WHERE EXISTS (
        SELECT 1 FROM "reception_state"
        WHERE "eventKey" = ${eventKey}::text AND "key" = ${STATE_KEY}::text
          AND "value"->>'currentId' = ${question.id}::text AND "value"->>'phase' = 'open'
      )
      ON CONFLICT ("eventKey", "questionId", "tableNo") DO UPDATE
        SET "answer" = EXCLUDED."answer", "name" = EXCLUDED."name", "deviceId" = EXCLUDED."deviceId",
            "correct" = CASE WHEN "reception_quiz_answers"."answer" IS NOT DISTINCT FROM EXCLUDED."answer" THEN "reception_quiz_answers"."correct" ELSE NULL END,
            "updatedAt" = CURRENT_TIMESTAMP`;
    if (!n) throw new BadRequestException('지금은 답을 낼 수 없어요.');
    this.drop(eventKey);
    const snap = await this.load(eventKey, true);
    return { ...snap.shared, mine: quizMine(snap.state, snap.rows, table) };
  }

  async adminView(eventKey: ReceptionEventKey): Promise<QuizAdmin> {
    const snap = await this.load(eventKey, true);
    return quizAdmin(snap.state, snap.rows);
  }

  /** 어드민 진행 버튼 — open · lock · reveal · unreveal · idle · board · reset */
  async adminState(eventKey: ReceptionEventKey, body: { action?: unknown; questionId?: unknown; on?: unknown }): Promise<QuizAdmin> {
    if (!isQuizAction(body?.action)) throw new BadRequestException('없는 동작이에요.');
    try {
      await this.prisma.$transaction(async (tx) => {
        // 줄이 없으면 기본값으로 만들고 잠근다 — 처음 누를 때 두 요청이 겹쳐도 한 줄
        await tx.$executeRaw`
          INSERT INTO "reception_state" ("eventKey", "key", "value")
          VALUES (${eventKey}::text, ${STATE_KEY}::text, ${JSON.stringify(defaultQuizState())}::jsonb)
          ON CONFLICT ("eventKey", "key") DO NOTHING`;
        const rows = await tx.$queryRaw<Array<{ value: unknown }>>`
          SELECT "value" FROM "reception_state" WHERE "eventKey" = ${eventKey}::text AND "key" = ${STATE_KEY}::text FOR UPDATE`;
        const next = applyQuizAction(parseQuizState(rows[0]?.value), body, new Date());
        if (typeof next === 'string') throw new BadRequestException(next);
        if (body.action === 'reset') {
          const qid = quizQuestion(body.questionId)?.id;
          await tx.receptionQuizAnswer.deleteMany({ where: { eventKey, ...(qid ? { questionId: qid } : {}) } });
        }
        await tx.receptionState.update({
          where: { eventKey_key: { eventKey, key: STATE_KEY } },
          data: { value: next as unknown as Prisma.InputJsonValue },
        });
      });
    } finally {
      this.drop(eventKey);
    }
    return this.adminView(eventKey);
  }

  /**
   * 어드민 답·판정 고치기 — 상태와 상관없이 언제든.
   * answer 키: 문자열이면 손님과 같은 검사로 저장(낸 사람 '운영팀'), null·'' 이면 답 지움. 답이 바뀌면 예전 판정은 버린다(손님이 새로 낼 때와 같게).
   * correct 키: true/false = 판정 고정, null = 자동으로. 답도 판정도 없게 되면 줄을 지운다.
   */
  async adminAnswer(
    eventKey: ReceptionEventKey,
    body: { questionId?: unknown; table?: unknown; answer?: unknown; correct?: unknown },
  ): Promise<QuizAdmin> {
    const question = quizQuestion(body?.questionId);
    if (!question) throw new BadRequestException('없는 문제예요.');
    const table = parseTableNo(body?.table);
    if (table == null) throw new BadRequestException('테이블 번호를 골라 주세요.');
    const has = (k: string) => !!body && Object.prototype.hasOwnProperty.call(body, k);
    if (!has('answer') && !has('correct')) throw new BadRequestException('바꿀 내용이 없어요.');

    let answer: string | null | undefined;
    if (has('answer')) {
      if (body.answer == null || body.answer === '') answer = null;
      else {
        const parsed = parseQuizAnswer(question, body.answer);
        if ('error' in parsed) throw new BadRequestException(parsed.error);
        answer = parsed.answer;
      }
    }
    let correct: boolean | null | undefined;
    if (has('correct')) {
      if (body.correct !== null && typeof body.correct !== 'boolean') throw new BadRequestException('O·X 판정 값이 맞지 않아요.');
      correct = body.correct as boolean | null;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const where = { eventKey_questionId_tableNo: { eventKey, questionId: question.id, tableNo: table } };
        // 그 줄을 잠그고 읽는다 — 그 사이 손님이 낸 새 답(ON CONFLICT 가 이 잠금을 기다림)을 예전 답으로 덮지 않게
        const [cur] = await tx.$queryRaw<Array<{ answer: string | null; correct: boolean | null }>>`
          SELECT "answer", "correct" FROM "reception_quiz_answers"
          WHERE "eventKey" = ${eventKey}::text AND "questionId" = ${question.id}::text AND "tableNo" = ${table}::int
          FOR UPDATE`;
        const changed = answer !== undefined && answer !== (cur?.answer ?? null);
        const nextAnswer = answer === undefined ? cur?.answer ?? null : answer;
        const nextCorrect = correct !== undefined ? correct : changed ? null : cur?.correct ?? null;
        if (nextAnswer == null && nextCorrect == null) {
          // 잠근 줄이 있을 때만 지운다 — 없던 줄이면 그 사이 손님이 막 낸 답까지 지우지 않게
          if (cur) await tx.receptionQuizAnswer.deleteMany({ where: { eventKey, questionId: question.id, tableNo: table } });
          return;
        }
        const who = changed ? { name: nextAnswer ? '운영팀' : null, deviceId: null } : {};
        await tx.receptionQuizAnswer.upsert({
          where,
          create: { eventKey, questionId: question.id, tableNo: table, answer: nextAnswer, correct: nextCorrect, name: null, deviceId: null, ...who },
          // 판정만 바꿀 땐 답·낸 사람은 안 쓴다 — 줄이 없던 사이 손님 답이 먼저 들어가도 그 답은 남는다
          update: { correct: nextCorrect, ...(answer !== undefined ? { answer: nextAnswer } : {}), ...who },
        });
      });
    } finally {
      this.drop(eventKey);
    }
    return this.adminView(eventKey);
  }
}
