'use client';

// 설문조사 — 만족도 · 가장 좋았던 순서 · 내년 참석 · 하고 싶은 말. 기기당 1건(다시 내면 고친 답으로 덮어씀).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { NameGateModal } from '@/components/reception/NameGate';
import { CheckIcon, StarIcon } from '@/components/reception/ReceptionIcons';
import { receptionApi, type SurveyAnswers } from '@/lib/reception/api';
import { RECEPTION_SURVEY_PICKS } from '@/lib/reception/event';
import { readGuest, useReceptionGuest } from '@/lib/reception/guest';

const RATING_LABEL = ['', '아쉬웠어요', '그저 그랬어요', '괜찮았어요', '좋았어요', '최고였어요'];
const AGAIN: Array<{ value: SurveyAnswers['again']; label: string }> = [
  { value: 'yes', label: '꼭 올게요' },
  { value: 'maybe', label: '아마도요' },
  { value: 'no', label: '잘 모르겠어요' },
];

export default function ReceptionSurveyPage() {
  const guest = useReceptionGuest();
  const [rating, setRating] = useState(0);
  const [best, setBest] = useState('');
  const [again, setAgain] = useState<SurveyAnswers['again'] | ''>('');
  const [comment, setComment] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [askName, setAskName] = useState(false);

  useEffect(() => {
    let alive = true;
    // 예전 답을 늦게 받아도 빈 화면으로 기다리지 않게 — 1.5초 뒤엔 일단 설문을 보여 준다
    const show = setTimeout(() => { if (alive) setLoaded(true); }, 1500);
    receptionApi.survey(readGuest().deviceId)
      .then(({ survey }) => {
        if (!alive || !survey) return;
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
  }, []);

  const ready = rating > 0 && !!again;

  const send = async () => {
    if (!ready || saving) return;
    const g = readGuest();
    if (!g.name) { setAskName(true); return; }
    setSaving(true);
    try {
      await receptionApi.saveSurvey(g.deviceId, g.name, { rating, best, again: again as SurveyAnswers['again'], comment: comment.trim() });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      toast.error(e?.message || '잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <div className="rc-page" />;

  if (done) {
    return (
      <div className="rc-page rc-survey-page">
        <section className="rc-glass rc-survey-done rc-rise">
          <span className="rc-done-ic"><CheckIcon size={30} /></span>
          <p className="rc-eyebrow">Thank you</p>
          <h1 className="rc-sheet-title">소중한 의견 고맙습니다</h1>
          <p className="rc-sheet-desc">{guest?.name ? `${guest.name} 님의 ` : ''}답변이 전달됐어요. 더 좋은 자리로 보답할게요.</p>
          <button type="button" className="rc-btn-line" onClick={() => setDone(false)}>답변 고치기</button>
        </section>
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
        <h2 className="rc-q-title"><span>Q1</span>오늘 송년회는 어떠셨나요?</h2>
        <div className="rc-stars" role="radiogroup" aria-label="만족도">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점 ${RATING_LABEL[n]}`} className={`rc-star ${n <= rating ? 'on' : ''}`} onClick={() => setRating(n)}>
              <StarIcon size={34} />
            </button>
          ))}
        </div>
        <p className="rc-star-label">{rating ? RATING_LABEL[rating] : '별을 눌러 골라 주세요'}</p>
      </section>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q2</span>가장 좋았던 순서는?</h2>
        <div className="rc-choices">
          {RECEPTION_SURVEY_PICKS.map((t) => (
            <button key={t} type="button" className={`rc-choice ${best === t ? 'on' : ''}`} aria-pressed={best === t} onClick={() => setBest(best === t ? '' : t)}>
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q3</span>내년 송년회에도 함께하실 건가요?</h2>
        <div className="rc-choices row">
          {AGAIN.map((a) => (
            <button key={a.value} type="button" className={`rc-choice ${again === a.value ? 'on' : ''}`} aria-pressed={again === a.value} onClick={() => setAgain(a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rc-glass rc-q rc-rise" style={{ '--i': 4 } as React.CSSProperties}>
        <h2 className="rc-q-title"><span>Q4</span>하고 싶은 말<em>(선택)</em></h2>
        <textarea className="rc-input rc-textarea" value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder="좋았던 점, 아쉬웠던 점을 자유롭게 남겨 주세요." rows={4} />
        <p className="rc-count">{comment.length}/500</p>
      </section>

      <div className="rc-survey-send rc-rise" style={{ '--i': 5 } as React.CSSProperties}>
        <button type="button" className="rc-btn-gold" disabled={!ready || saving} onClick={send}>{saving ? '보내는 중…' : '설문 보내기'}</button>
        {!ready && <p className="rc-hint">Q1 · Q3 은 꼭 골라 주세요.</p>}
      </div>

      <NameGateModal open={askName} hint="설문은 성함과 함께 전달돼요." onClose={() => setAskName(false)} onDone={() => { setAskName(false); setTimeout(send, 0); }} />
    </div>
  );
}
