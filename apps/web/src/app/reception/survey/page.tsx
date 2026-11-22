'use client';

// 설문조사 — 2차 회식 참여 · 만족도 · 가장 좋았던 순서 · 내년 참석 · 하고 싶은 말. 기기당 1건(다시 내면 고친 답으로 덮어씀).
// (261122 사장 '설문조사에 첫번째가 2차 회식 참여 여부 — 예 버튼을 누르면 어드민 참여자 명단에 2차 참여 태그 · 지도 · 현 위치로부터 길찾기')
//  · 2차 답은 누르는 순간 PUT /after-party 로 따로 저장(설문을 안 내도 어드민에 '2차 참여').
//    서버가 답을 거절(400)했을 때만 마지막으로 저장된 답으로 되돌린다. 망 · 서버 오류 · 아직 새 API 가 안 뜸(404)이면
//    고른 답은 그대로 두고 '아직 못 전함'만 표시 — 설문을 낼 때 본문에 실려 서버가 손님 표까지 맞춘다(배포 순서가 어긋나도 설문이 막히지 않게).
//    빠르게 바꿔 눌러도 순서대로 보낸다(늦게 도착한 옛 답이 새 답을 덮지 않게). 설문 보내기도 같은 줄에 서서, 보낼 때의 최신 답을 싣는다.
//  · '예'면 바로 아래 2차 장소 카드(AfterPartyPlace — 네이버 지도 · 내 위치 · 길안내). 설문을 낸 뒤 화면에도 보인다.
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import AfterPartyPlace from '@/components/reception/AfterPartyPlace';
import { NameGateModal } from '@/components/reception/NameGate';
import { CheckIcon, StarIcon } from '@/components/reception/ReceptionIcons';
import { haptic } from '@/lib/haptics';
import { receptionApi, type AfterPartyAnswer, type ReceptionApiError, type SurveyAnswers } from '@/lib/reception/api';
import { RECEPTION_SURVEY_PICKS } from '@/lib/reception/event';
import { readGuest, useReceptionGuest } from '@/lib/reception/guest';

const RATING_LABEL = ['', '아쉬웠어요', '그저 그랬어요', '괜찮았어요', '좋았어요', '최고였어요'];
const AGAIN: Array<{ value: SurveyAnswers['again']; label: string }> = [
  { value: 'yes', label: '꼭 올게요' },
  { value: 'maybe', label: '아마도요' },
  { value: 'no', label: '잘 모르겠어요' },
];
const AFTER_PARTY: Array<{ value: AfterPartyAnswer; label: string }> = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니요' },
];

export default function ReceptionSurveyPage() {
  const guest = useReceptionGuest();
  const [afterParty, setAfterParty] = useState<AfterPartyAnswer | ''>('');
  const [rating, setRating] = useState(0);
  const [best, setBest] = useState('');
  const [again, setAgain] = useState<SurveyAnswers['again'] | ''>('');
  const [comment, setComment] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askName, setAskName] = useState(false);
  /** 이름을 넣은 뒤 이어서 할 일(설문 보내기 · 2차 답 저장) */
  const afterName = useRef<((name: string) => void) | null>(null);
  /** 2차 답을 골랐지만 서버에 아직 못 전함(망 · 서버 오류) — 설문을 내면 같이 전해진다 */
  const [apUnsent, setApUnsent] = useState(false);
  /** 2차 답 — 서버에 마지막으로 저장된 값(거절되면 여기로 되돌림) · 지금 화면 값(기다린 뒤 최신 답을 읽으려고) · 누른 차례 · 보내는 줄 */
  const apSaved = useRef<AfterPartyAnswer | ''>('');
  const apPicked = useRef<AfterPartyAnswer | ''>('');
  const apSeq = useRef(0);
  const apChain = useRef<Promise<void>>(Promise.resolve());

  /** 화면 값과 apPicked 를 같이 바꾼다 */
  const showAp = useCallback((v: AfterPartyAnswer | '') => {
    apPicked.current = v;
    setAfterParty(v);
  }, []);

  useEffect(() => {
    let alive = true;
    // 예전 답을 늦게 받아도 빈 화면으로 기다리지 않게 — 1.5초 뒤엔 일단 설문을 보여 준다
    const show = setTimeout(() => { if (alive) setLoaded(true); }, 1500);
    receptionApi.survey(readGuest().deviceId)
      .then(({ survey, afterParty: ap }) => {
        if (!alive) return;
        // 2차 답 = 손님 표(설문을 안 내도 있음) → 없으면(옛 서버) 낸 설문 답. 그 사이 손님이 이미 눌렀으면 손님 것 그대로
        const savedAp = ap || survey?.answers.afterParty || '';
        apSaved.current = savedAp;
        if (apSeq.current === 0) showAp(savedAp);
        if (!survey) return;
        const a = survey.answers;
        setRating(a.rating || 0);
        setBest(a.best || '');
        setAgain(a.again || '');
        setComment(a.comment || '');
        setDone(true);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; clearTimeout(show); };
  }, [showAp]);

  const saveAfterParty = useCallback((value: AfterPartyAnswer, name: string) => {
    const my = ++apSeq.current;
    showAp(value);
    const deviceId = readGuest().deviceId;
    apChain.current = apChain.current.then(async () => {
      try {
        const r = await receptionApi.setAfterParty(deviceId, name, value);
        apSaved.current = r.afterParty;
        if (my === apSeq.current) setApUnsent(false);
      } catch (err) {
        const e = err as ReceptionApiError;
        // 마지막으로 누른 것만 다룬다(앞서 실패한 것은 뒤에 누른 답이 이미 덮음)
        if (my !== apSeq.current) return;
        // 그 사이 설문으로 같은 답이 이미 저장됐으면 그대로 끝
        if (apSaved.current === value) { setApUnsent(false); return; }
        if (e?.status === 400) {
          // 서버가 답을 거절(검증) — 마지막으로 저장된 답으로 되돌린다
          showAp(apSaved.current);
          setApUnsent(false);
          toast.error(e.message || '저장하지 못했어요. 잠시 후 다시 눌러 주세요.');
          return;
        }
        // 망 · 서버 오류 · 아직 새 API 가 안 뜸(404 — 서버 원문이 영어라 안 씀): 고른 답은 그대로 두고 '아직 못 전함'만.
        // 설문 보내기는 막지 않는다(본문에 실려 서버가 손님 표까지 맞춘다)
        setApUnsent(true);
        toast.error('2차 답을 아직 못 전했어요. 다시 누르거나 설문을 보내면 같이 전해져요.');
      }
    });
  }, [showAp]);

  const pickAfterParty = (value: AfterPartyAnswer) => {
    haptic('light');
    const g = readGuest();
    if (!g.name) {
      afterName.current = (name) => saveAfterParty(value, name);
      setAskName(true);
      return;
    }
    if (value === apPicked.current && value === apSaved.current) return;
    saveAfterParty(value, g.name);
  };

  const ready = !!afterParty && rating > 0 && !!again;

  const send = async () => {
    if (!ready || saving) return;
    const g = readGuest();
    if (!g.name) {
      afterName.current = () => { void send(); };
      setAskName(true);
      return;
    }
    const name = g.name;
    const rest = { rating, best, again: again as SurveyAnswers['again'], comment: comment.trim() };
    setSaving(true);
    // 2차 답 저장과 같은 줄에 선다 — 앞서 누른 2차 답이 다 끝난 뒤에 보내고(설문이 먼저 도착해 옛 답으로 손님 표를 되돌리지 않게),
    // 보내는 동안 새로 누른 2차 답은 설문 뒤에 보낸다(서버에 늘 마지막 답이 남게)
    const run = apChain.current.then(async () => {
      // 기다리는 사이 2차 답이 바뀌었을 수 있다(거절돼 되돌림 등) — 클릭 때 값이 아니라 지금 화면 값을 싣는다
      const sentAp = apPicked.current;
      if (!sentAp) throw new Error('2차 회식 참여 여부를 골라 주세요.');
      const seq = apSeq.current;
      const res = await receptionApi.saveSurvey(g.deviceId, name, { afterParty: sentAp, ...rest });
      // 새 서버는 손님 표 값을 돌려준다 → 화면도 그 값으로(옛 서버는 2차 칸이 없어 안 줌 — '아직 못 전함' 그대로)
      if (res.afterParty) {
        apSaved.current = res.afterParty;
        // 보내는 사이 새로 누른 답이 있으면 그 답이 화면에 남는다(설문 뒤에 따로 저장됨)
        if (apSeq.current === seq) {
          showAp(res.afterParty);
          setApUnsent(false);
        }
      }
    });
    apChain.current = run.catch(() => {});
    try {
      await run;
      haptic('success');
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(e?.message || '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const nameGate = (
    <NameGateModal
      open={askName}
      hint="설문은 성함과 함께 전달돼요."
      onClose={() => { afterName.current = null; setAskName(false); }}
      onDone={(name) => {
        setAskName(false);
        const next = afterName.current;
        afterName.current = null;
        if (next) setTimeout(() => next(name), 0);
      }}
    />
  );

  if (!loaded) return <div className="rc-page" />;

  if (done) {
    return (
      <div className="rc-page rc-survey-page">
        <section className={`rc-glass rc-survey-done rc-rise ${afterParty === 'yes' ? 'with-ap' : ''}`}>
          <span className="rc-done-ic"><CheckIcon size={30} /></span>
          <p className="rc-eyebrow">Thank you</p>
          <h1 className="rc-sheet-title">소중한 의견 고맙습니다</h1>
          <p className="rc-sheet-desc">{guest?.name ? `${guest.name} 님의 ` : ''}답변이 전달됐어요. 더 좋은 자리로 보답할게요.</p>
          {afterParty && (
            <p className="rc-sheet-desc">
              2차 회식 — <b>{afterParty === 'yes' ? '참여' : '불참'}</b>
              {afterParty === 'yes' ? '로' : '으로'}
              {apUnsent ? ' 골라 두셨는데 아직 전하지 못했어요. 답변 고치기에서 다시 눌러 주세요.' : ' 전해 드렸어요.'}
            </p>
          )}
          <button type="button" className="rc-btn-line" onClick={() => { haptic('light'); setDone(false); }}>답변 고치기</button>
        </section>
        {afterParty === 'yes' && <AfterPartyPlace />}
        {nameGate}
      </div>
    );
  }

  return (
    <div className="rc-page rc-survey-page">
      <header className="rc-event-head rc-rise">
        <p className="rc-eyebrow">Survey</p>
        <h1 className="rc-event-title">송년회 설문조사</h1>
        <p className="rc-event-desc">1분이면 끝나요. 남겨 주신 의견은 다음 행사 준비에 쓰여요.</p>
      </header>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q1</span>2차 회식에 참여하시나요?</h2>
        <div className="rc-choices row" role="radiogroup" aria-label="2차 회식 참여">
          {AFTER_PARTY.map((o) => (
            <button key={o.value} type="button" role="radio" aria-checked={afterParty === o.value} className={`rc-choice ${afterParty === o.value ? 'on' : ''}`} onClick={() => pickAfterParty(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <p className={`rc-ap-saved ${apUnsent ? 'unsent' : ''}`} role={apUnsent ? 'status' : undefined}>
          {apUnsent
            ? '아직 못 전했어요 — 다시 누르거나 설문을 보내면 같이 전해져요'
            : afterParty === 'yes' ? '고르면 바로 전해져요 · 아래에서 2차 장소와 길찾기를 볼 수 있어요' : '고르면 바로 전해져요'}
        </p>
      </section>
      {afterParty === 'yes' && <AfterPartyPlace />}

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q2</span>오늘 송년회는 어떠셨나요?</h2>
        <div className="rc-stars" role="radiogroup" aria-label="만족도">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점 ${RATING_LABEL[n]}`} className={`rc-star ${n <= rating ? 'on' : ''}`} onClick={() => { haptic('light'); setRating(n); }}>
              <StarIcon size={34} />
            </button>
          ))}
        </div>
        <p className="rc-star-label">{rating ? RATING_LABEL[rating] : '별을 눌러 골라 주세요'}</p>
      </section>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q3</span>가장 좋았던 순서는?</h2>
        <div className="rc-choices">
          {RECEPTION_SURVEY_PICKS.map((t) => (
            <button key={t} type="button" className={`rc-choice ${best === t ? 'on' : ''}`} aria-pressed={best === t} onClick={() => { haptic('light'); setBest(best === t ? '' : t); }}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 4 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q4</span>내년 송년회에도 함께하실 건가요?</h2>
        <div className="rc-choices row">
          {AGAIN.map((a) => (
            <button key={a.value} type="button" className={`rc-choice ${again === a.value ? 'on' : ''}`} aria-pressed={again === a.value} onClick={() => { haptic('light'); setAgain(a.value); }}>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 5 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q5</span>하고 싶은 말<em>(선택)</em></h2>
        <textarea className="rc-input rc-textarea" value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder="좋았던 점, 아쉬웠던 점을 자유롭게 남겨 주세요." rows={4} />
        <p className="rc-count">{comment.length}/500</p>
      </section>

      <div className="rc-survey-send rc-rise" style={{ '--i': 6 } as React.CSSProperties}>
        <button type="button" className="rc-btn-gold" disabled={!ready || saving} onClick={send}>{saving ? '보내는 중…' : '설문 보내기'}</button>
        {!ready && <p className="rc-hint">Q1 · Q2 · Q4 는 꼭 골라 주세요.</p>}
      </div>

      {nameGate}
    </div>
  );
}
