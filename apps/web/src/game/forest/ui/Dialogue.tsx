'use client';

// 대화 — 이름표 · 타자 효과(대사 속도 설정) · 주민별 짧은 말소리 · 선택지. E · Space · 클릭으로 넘긴다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUI } from '../state/ui';
import { useGame } from '../state/store';
import { RESIDENTS } from '../data/residents';
import { engineRef } from '../engine/Engine';
import { Icon } from './icons';
import type { Choice } from '../data/dialogue';

const NAME_COLORS: Record<string, string> = { me: '#6E9A63', partner: '#7FA3C7', sys: '#A77D5A' };

export default function DialogueBox() {
  const d = useUI((s) => s.dialogue);
  const textSpeed = useGame((s) => s.settings.textSpeed);
  const meName = useGame((s) => s.me.name);
  const partnerName = useGame((s) => s.partner.name);
  const [shown, setShown] = useState(0);
  const [showChoices, setShowChoices] = useState(false);
  const firedEnd = useRef(false);
  const line = d ? d.node.lines[d.index] : null;
  const full = line?.text ?? '';
  const isLast = d ? d.index >= d.node.lines.length - 1 : false;

  useEffect(() => {
    setShown(0);
    setShowChoices(false);
  }, [d?.node, d?.index]);

  useEffect(() => {
    firedEnd.current = false;
  }, [d?.node]);

  // 타자 효과 + 말소리
  useEffect(() => {
    if (!line) return;
    if (shown >= full.length) return;
    const per = textSpeed === 1 ? 52 : textSpeed === 3 ? 14 : 30;
    const t = setTimeout(() => {
      setShown((n) => Math.min(full.length, n + (textSpeed === 3 ? 2 : 1)));
      const r = RESIDENTS[line.who];
      if (r && shown % 3 === 0) engineRef.current?.sound.talk(r.voice.base, r.voice.wave);
      else if ((line.who === 'partner' || line.who === 'me') && shown % 3 === 0) engineRef.current?.sound.talk(line.who === 'partner' ? 520 : 470, 'sine');
    }, per);
    return () => clearTimeout(t);
  }, [shown, full, line, textSpeed]);

  const close = useCallback(() => {
    useUI.getState().set({ dialogue: null });
    engineRef.current?.onDialogueClosed();
  }, []);

  const reachEnd = useCallback(() => {
    if (!d) return;
    if (!firedEnd.current && d.node.action) {
      firedEnd.current = true;
      d.onAction(d.node.action);
    }
    if (d.node.choices?.length) setShowChoices(true);
    else close();
  }, [d, close]);

  const advance = useCallback(() => {
    if (!d) return;
    if (shown < full.length) {
      setShown(full.length);
      return;
    }
    if (!isLast) {
      useUI.getState().set({ dialogue: { ...d, index: d.index + 1 } });
      return;
    }
    if (!showChoices) reachEnd();
  }, [d, shown, full, isLast, showChoices, reachEnd]);

  const choose = (c: Choice) => {
    if (!d) return;
    engineRef.current?.sound.click();
    if (c.action) d.onAction(c.action);
    // 행동이 다른 창을 열었으면(가게·선물 등) 대화는 닫는다
    if (c.then) {
      useUI.getState().set({ dialogue: { node: c.then, index: 0, typed: false, onAction: d.onAction } });
    } else close();
  };

  useEffect(() => {
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (['KeyE', 'Space', 'Enter', 'NumpadEnter'].includes(e.code)) {
        e.preventDefault();
        if (showChoices && d.node.choices) {
          if (e.code === 'Enter' || e.code === 'NumpadEnter') choose(d.node.choices[0]);
          return;
        }
        advance();
      } else if (showChoices && d.node.choices && /^Digit[1-9]$/.test(e.code)) {
        const i = Number(e.code.slice(5)) - 1;
        const c = d.node.choices[i];
        if (c) choose(c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, advance, showChoices]);

  if (!d || !line) return null;
  const r = RESIDENTS[line.who];
  const name = r ? r.name : line.who === 'me' ? meName : line.who === 'partner' ? partnerName : line.who === 'sys' ? '안내' : line.who;
  const color = r ? r.color : NAME_COLORS[line.who] || '#A77D5A';
  return (
    <div className="wf-panel wf-dialogue" onClick={() => (!showChoices ? advance() : null)} role="dialog" aria-label={`${name}의 대화`}>
      <div className="wf-name" style={{ background: color }}>
        {name}
      </div>
      <div className="wf-dtext">{full.slice(0, shown)}</div>
      {showChoices && d.node.choices ? (
        <div className="wf-choices" onClick={(e) => e.stopPropagation()}>
          {d.node.choices.map((c, i) => (
            <button key={i} type="button" className={`wf-btn ${i === 0 ? '' : 'ghost'}`} onClick={() => choose(c)}>
              <span className="wf-kbd wf-pc-only" style={{ background: i === 0 ? 'rgba(0,0,0,0.25)' : undefined }}>
                {i + 1}
              </span>
              {c.label}
            </button>
          ))}
        </div>
      ) : (
        shown >= full.length && (
          <span className="wf-next">
            <Icon name="arrow" size={22} />
          </span>
        )
      )}
    </div>
  );
}
