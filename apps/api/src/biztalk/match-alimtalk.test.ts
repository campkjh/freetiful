import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MatchAlimtalkProvider } from './match-alimtalk-provider';
import { MATCH_ALIMTALK_CHANNEL, MATCH_ALIMTALK_TEMPLATES, chatAlimtalkKind, koreanMobile, matchTemplateVariables, nextReminderHour, reminderDecision, type MatchAlimtalkContext } from './match-alimtalk-policy';

const context: MatchAlimtalkContext = {
  recipientName: '고객', customerName: '고객', proName: '사회자',
  category: '결혼식', eventDate: '2026.12.13', eventTime: '15:00', eventLocation: '행사장',
  requestId: 'request-1', roomId: 'room-1', notice: '메시지가 도착했습니다.', path: '/chat/room-1',
};

test('six distinct templates and chat direction uses room membership, not account role', () => {
  assert.equal(new Set(Object.values(MATCH_ALIMTALK_TEMPLATES)).size, 6);
  assert.equal(chatAlimtalkKind('p', 'c', 'c', 'p'), 'pro_message');
  assert.equal(chatAlimtalkKind('c', 'p', 'c', 'p'), 'customer_reply');
  assert.equal(chatAlimtalkKind('p', 'x', 'c', 'p'), null);
  assert.equal(chatAlimtalkKind('x', 'x', 'x', 'x'), null);
});

test('only approved template placeholders are populated, including button URLs', () => {
  assert.deepEqual(matchTemplateVariables({
    content: '#{고객 이름}님, #{사회자명}의 답변입니다.',
    buttons: [{ linkMo: 'https://freetiful.com/#{채팅 링크}' }],
    highlight: { title: '#{행사일시}' },
  }, context), {
    variables: { '#{고객 이름}': '고객', '#{사회자명}': '사회자', '#{채팅 링크}': 'chat/room-1', '#{행사일시}': '2026.12.13 15:00' },
    unknown: [],
  });
  assert.deepEqual(matchTemplateVariables({ content: '#{새 변수}' }, context), { variables: {}, unknown: ['#{새 변수}'] });
  assert.deepEqual(matchTemplateVariables({ content: '#{링크}', buttons: [{ linkMo: 'https://freetiful.com/#{링크}' }] }, context).unknown, ['#{링크}']);
});

test('reminders distinguish unread and read-without-reply and respect the KST night window', () => {
  const read = new Date('2026-11-26T04:00:00Z');
  const now = new Date('2026-11-27T03:30:00Z');
  const day = 86_400_000;
  assert.equal(reminderDecision('unread_reminder', null, now, day), 'send');
  assert.equal(reminderDecision('unread_reminder', read, now, day), 'skip');
  assert.equal(reminderDecision('no_reply_reminder', null, now, day), 'skip');
  assert.deepEqual(reminderDecision('no_reply_reminder', read, now, day), new Date('2026-11-27T04:00:00Z'));
  assert.equal(reminderDecision('no_reply_reminder', read, new Date('2026-11-27T04:00:01Z'), day), 'send');
  assert.equal(nextReminderHour(now), null);
  assert.deepEqual(nextReminderHour(new Date('2026-11-26T12:05:00Z')), new Date('2026-11-27T00:00:00Z'));
  assert.deepEqual(nextReminderHour(new Date('2026-11-26T20:05:00Z')), new Date('2026-11-27T00:00:00Z'));
});

test('only Korean mobile numbers are eligible', () => {
  assert.equal(koreanMobile('+82 10-1234-5678'), '01012345678');
  assert.equal(koreanMobile('010 1234 5678'), '01012345678');
  assert.equal(koreanMobile('02-123-4567'), null);
  assert.equal(koreanMobile(undefined), null);
});

test('provider uses the selected channel and queues only an approved Kakao message, never SMS', async t => {
  const templateId = MATCH_ALIMTALK_TEMPLATES.pro_message;
  const config = new ConfigService({
    SOLAPI_API_KEY: 'fixture-key', SOLAPI_API_SECRET: 'fixture-secret', SOLAPI_FROM: '0212345678', SOLAPI_MATCH_ALIMTALK_ENABLED: 'true',
  });
  const get = t.mock.method(axios, 'get', async () => ({
    data: [{ templateId, channelId: MATCH_ALIMTALK_CHANNEL, status: 'APPROVED', content: '#{사회자명} 메시지' }],
  }));
  const post = t.mock.method(axios, 'post', async (_url: string, _payload: unknown) => ({
    data: { failedMessageList: [], messageList: [{ messageId: 'fixture' }], groupInfo: { count: { registeredSuccess: 1 } } },
  }));
  const client = new MatchAlimtalkProvider(config);
  assert.deepEqual(await client.send('pro_message', '01012345678', context, async () => false),
    { status: 'skipped', reason: 'recipient_or_state_changed' });
  assert.equal(post.mock.callCount(), 0);
  assert.deepEqual(await client.send('pro_message', '01012345678', context, async () => true),
    { status: 'accepted', providerId: 'fixture' });
  assert.equal(get.mock.callCount(), 1);
  assert.deepEqual(post.mock.calls[0].arguments[1], { messages: [{
    to: '01012345678', from: '0212345678', type: 'ATA',
    kakaoOptions: { pfId: MATCH_ALIMTALK_CHANNEL, templateId, disableSms: true, variables: { '#{사회자명}': '사회자' } },
  }] });
  assert.deepEqual(await client.send('customer_reply', '01012345678', context, async () => true),
    { status: 'failed', reason: 'template_unavailable' });
  assert.equal(post.mock.callCount(), 1);
});
