'use client';

// 외형 편집 — 피부·헤어·헤어색·눈·눈썹·볼터치·안경·액세서리·의상·신발 + (의상실 거울) 웨딩 의상.
// 성별과 상관없이 모든 항목을 조합. 바꾸기 전/후를 같은 3D 미리보기에서 비교하고 '적용'해야 반영된다.
import { useMemo, useState } from 'react';
import AvatarPreview from './AvatarPreview';
import { ACCESSORIES, BLUSHES, BROW_STYLES, DAILY_OUTFITS, EYE_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, SHOES, SKINS, WEDDING_OUTFITS, type Appearance } from '../data/appearance';

type Cat = 'skin' | 'hair' | 'eyes' | 'outfit' | 'shoes' | 'acc' | 'wedding';

export default function WardrobeEditor({
  value,
  original,
  onChange,
  allowWedding,
  compact = false,
}: {
  value: Appearance;
  original: Appearance;
  onChange: (a: Appearance) => void;
  allowWedding: boolean;
  compact?: boolean;
}) {
  const [cat, setCat] = useState<Cat>(allowWedding ? 'wedding' : 'hair');
  const [compare, setCompare] = useState(false);
  const shown = compare ? original : value;
  const set = (p: Partial<Appearance>) => onChange({ ...value, ...p });
  const cats: Array<{ id: Cat; label: string }> = useMemo(
    () => [
      ...(allowWedding ? [{ id: 'wedding' as Cat, label: '웨딩' }] : []),
      { id: 'hair', label: '헤어' },
      { id: 'skin', label: '얼굴' },
      { id: 'eyes', label: '눈·눈썹' },
      { id: 'outfit', label: '의상' },
      { id: 'shoes', label: '신발' },
      { id: 'acc', label: '액세서리' },
    ],
    [allowWedding],
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 16 }}>
      <div>
        <AvatarPreview look={shown} height={compact ? 240 : 320} pose={value.wedding ? 'wave' : 'idle'} />
        <div className="wf-row" style={{ marginTop: 10, justifyContent: 'center' }}>
          <button type="button" className={`wf-chip ${compare ? 'on' : ''}`} onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}>
            꾹 눌러 바꾸기 전 보기
          </button>
        </div>
      </div>
      <div>
        <div className="wf-row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {cats.map((c) => (
            <button key={c.id} type="button" className={`wf-chip ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        {cat === 'wedding' && (
          <div>
            <p className="wf-label">웨딩 의상 — 고르면 일상 의상 위에 입어요</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className={`wf-chip ${!value.wedding ? 'on' : ''}`} onClick={() => set({ wedding: null })}>
                벗기(일상 의상)
              </button>
              {WEDDING_OUTFITS.map((id) => (
                <button key={id} type="button" className={`wf-chip ${value.wedding === id ? 'on' : ''}`} onClick={() => set({ wedding: id })}>
                  <span style={{ width: 16, height: 16, borderRadius: 6, background: OUTFITS[id].top, border: '2px solid #E6D9BF' }} />
                  {OUTFITS[id].name}
                </button>
              ))}
            </div>
            <p style={{ marginTop: 10, fontSize: '0.88em', color: 'var(--wf-ink2)', lineHeight: 1.5 }}>드레스와 턱시도 모두 누구나 입을 수 있어요. 예식엔 두 사람 모두 웨딩 의상이 필요해요.</p>
          </div>
        )}
        {cat === 'hair' && (
          <div>
            <p className="wf-label">헤어스타일</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {HAIR_STYLES.map((h) => (
                <button key={h.id} type="button" className={`wf-chip ${value.hair === h.id ? 'on' : ''}`} onClick={() => set({ hair: h.id })}>
                  {h.name}
                </button>
              ))}
            </div>
            <p className="wf-label" style={{ marginTop: 14 }}>헤어 색</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              {HAIR_COLORS.map((c, i) => (
                <button key={c} type="button" aria-label={`헤어 색 ${i + 1}`} className={`wf-swatch ${value.hairColor === i ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ hairColor: i })} />
              ))}
            </div>
          </div>
        )}
        {cat === 'skin' && (
          <div>
            <p className="wf-label">피부색</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 10 }}>
              {SKINS.map((c, i) => (
                <button key={c} type="button" aria-label={`피부색 ${i + 1}`} className={`wf-swatch ${value.skin === i ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ skin: i })} />
              ))}
            </div>
            <p className="wf-label" style={{ marginTop: 14 }}>볼터치</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {BLUSHES.map((b, i) => (
                <button key={b} type="button" className={`wf-chip ${value.blush === i ? 'on' : ''}`} onClick={() => set({ blush: i })}>
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}
        {cat === 'eyes' && (
          <div>
            <p className="wf-label">눈 모양</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {EYE_STYLES.map((e) => (
                <button key={e.id} type="button" className={`wf-chip ${value.eyes === e.id ? 'on' : ''}`} onClick={() => set({ eyes: e.id })}>
                  {e.name}
                </button>
              ))}
            </div>
            <p className="wf-label" style={{ marginTop: 14 }}>눈썹</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {BROW_STYLES.map((b) => (
                <button key={b.id} type="button" className={`wf-chip ${value.brows === b.id ? 'on' : ''}`} onClick={() => set({ brows: b.id })}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {cat === 'outfit' && (
          <div>
            <p className="wf-label">일상 의상{value.wedding ? ' — 지금은 웨딩 의상을 입고 있어요' : ''}</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {DAILY_OUTFITS.map((id) => (
                <button key={id} type="button" className={`wf-chip ${value.outfit === id && !value.wedding ? 'on' : ''}`} onClick={() => set({ outfit: id, wedding: null })}>
                  <span style={{ width: 16, height: 16, borderRadius: 6, background: `linear-gradient(135deg, ${OUTFITS[id].top} 50%, ${OUTFITS[id].bottom} 50%)`, border: '2px solid #E6D9BF' }} />
                  {OUTFITS[id].name}
                </button>
              ))}
            </div>
          </div>
        )}
        {cat === 'shoes' && (
          <div>
            <p className="wf-label">신발</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {SHOES.map((s, i) => (
                <button key={s.name} type="button" className={`wf-chip ${value.shoes === i ? 'on' : ''}`} onClick={() => set({ shoes: i })}>
                  <span style={{ width: 16, height: 16, borderRadius: 8, background: s.color, border: '2px solid #E6D9BF' }} />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {cat === 'acc' && (
          <div>
            <p className="wf-label">머리 장식</p>
            <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {ACCESSORIES.map((a) => (
                <button key={a.id} type="button" className={`wf-chip ${value.accessory === a.id ? 'on' : ''}`} onClick={() => set({ accessory: a.id })}>
                  {a.name}
                </button>
              ))}
            </div>
            <p className="wf-label" style={{ marginTop: 14 }}>안경</p>
            <div className="wf-row" style={{ gap: 8 }}>
              <button type="button" className={`wf-chip ${!value.glasses ? 'on' : ''}`} onClick={() => set({ glasses: false })}>
                쓰지 않기
              </button>
              <button type="button" className={`wf-chip ${value.glasses ? 'on' : ''}`} onClick={() => set({ glasses: true })}>
                둥근 안경
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
