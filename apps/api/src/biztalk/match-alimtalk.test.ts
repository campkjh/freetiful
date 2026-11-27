import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MatchAlimtalkProvider } from './match-alimtalk-provider';
import { NCP_MATCH_TEMPLATES, chatAlimtalkKind, koreanMobile, matchTemplateVariables, nextReminderHour, reminderDecision, type MatchAlimtalkContext } from './match-alimtalk-policy';

const context: MatchAlimtalkContext = {
  recipientName: '고객', customerName: '고객', proName: '사회자',
  category: '결혼식', eventDate: '2026.12.13', eventTime: '15:00', eventLocation: '행사장',
  requestId: 'request-1', roomId: 'room-1', notice: '메시지가 도착했습니다.', path: '/chat/room-1',
};

test('six distinct event mappings and chat direction uses room membership, not account role', () => {
  assert.equal(new Set(Object.values(NCP_MATCH_TEMPLATES).map(t => t.key)).size, 6);
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

test('SENS uses the approved template, substitutes the content and links, and disables SMS', async t => {
  const templateCode = 'A0009';
  const config = new ConfigService({
    NCP_ACCESS_KEY: 'fixture-key', NCP_SECRET_KEY: 'fixture-secret', NCP_ALIMTALK_CHANNEL_ID: '@freetiful',
    NCP_ALIMTALK_SERVICE_ID: 'ncp:example', NCP_MATCH_ALIMTALK_ENABLED: 'true',
  });
  const button = { type: 'WL', name: '확인하기', linkMobile: 'https://freetiful.com/#{채팅 링크}', linkPc: 'https://freetiful.com/chat' };
  const get = t.mock.method(axios, 'get', async () => ({
    data: [{ templateCode, channelId: '@freetiful', templateStatus: 'ACTIVE', templateInspectionStatus: 'COMPLETE', content: '#{Username}님, #{사회자명} 메시지', buttons: [button] }],
  }));
  const post = t.mock.method(axios, 'post', async (_url: string, _payload: unknown) => ({
    data: { statusCode: '202', messages: [{ requestStatusCode: 'A000', messageId: 'fixture' }] },
  }));
  const client = new MatchAlimtalkProvider(config);
  assert.deepEqual(await client.send('unread_reminder', '01012345678', context, async () => true),
    { status: 'skipped', reason: 'template_not_configured' });
  assert.equal(get.mock.callCount(), 0);
  assert.deepEqual(await client.send('pro_message', '01012345678', context, async () => false),
    { status: 'skipped', reason: 'recipient_or_state_changed' });
  assert.equal(post.mock.callCount(), 0);
  assert.deepEqual(await client.send('pro_message', '01012345678', context, async () => true),
    { status: 'accepted', providerId: 'fixture' });
  assert.equal(get.mock.callCount(), 1);
  assert.deepEqual(post.mock.calls[0].arguments[1], { plusFriendId: '@freetiful', templateCode, messages: [{
    to: '01012345678', countryCode: '82', content: '고객님, 사회자 메시지', useSmsFailover: false,
    buttons: [{ ...button, linkMobile: 'https://freetiful.com/chat/room-1' }],
  }] });
  assert.deepEqual(await client.send('customer_reply', '01012345678', context, async () => true),
    { status: 'failed', reason: 'template_unavailable' });
  assert.equal(post.mock.callCount(), 1);
});

test('SENS will not post a dormant or unapproved template, or treat a failed recipient as accepted', async t => {
  const config = new ConfigService({
    NCP_ACCESS_KEY: 'fixture-key', NCP_SECRET_KEY: 'fixture-secret', NCP_ALIMTALK_CHANNEL_ID: '@freetiful',
    NCP_ALIMTALK_SERVICE_ID: 'fixture', NCP_MATCH_ALIMTALK_ENABLED: 'true', NCP_MATCH_TEMPLATE_RECEIPT: 'FT_RECEIPT',
  });
  t.mock.method(axios, 'get', async (url: string) => {
    const templateCode = new URL(url).searchParams.get('templateCode');
    return { data: { templateCode, channelId: '@freetiful', templateStatus: templateCode === 'A0009' ? 'DORMANT' : 'ACTIVE',
      templateInspectionStatus: templateCode === 'FT_RECEIPT' ? 'REGISTER' : 'COMPLETE', content: '확인해 주세요.' } };
  });
  const post = t.mock.method(axios, 'post', async () => ({
    data: { statusCode: '202', messages: [{ messageId: 'rejected', requestStatusCode: 'A002' }] },
  }));
  const client = new MatchAlimtalkProvider(config);
  assert.deepEqual(await client.send('request_received', '01012345678', context, async () => true),
    { status: 'failed', reason: 'template_unavailable' });
  assert.deepEqual(await client.send('pro_message', '01012345678', context, async () => true),
    { status: 'failed', reason: 'template_unavailable' });
  assert.equal(post.mock.callCount(), 0);
  assert.deepEqual(await client.send('new_quote_request', '01012345678', context, async () => true),
    { status: 'failed', reason: 'ncp_A002' });
});
