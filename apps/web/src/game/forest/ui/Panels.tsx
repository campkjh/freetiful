'use client';

// 창 — 가방(수량·사용처) · 제작(필요 재료·부족 수량) · 지도(주민 위치) · 앨범/추억 · 설정 · 가게 · 보관함 · 예식 준비 · 편지 · 선물 · 게시판 · 조작법 · 옷장.
// 빈 상태·실패·완료 상태를 각각 보여 주고, 실패 원인은 행동 가능한 문장으로 안내한다.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame, ceremonyReadiness, dayOf, hourOf, countIn } from '../state/store';
import { useUI } from '../state/ui';
import { objectiveOf } from '../state/objective';
import { ITEMS, BAG_SIZE, itemName } from '../data/items';
import { RECIPES } from '../data/recipes';
import { RESIDENTS, RESIDENT_IDS, affinityLevel } from '../data/residents';
import { BOUNDS, GARDEN, GREENHOUSE, HOME, LAKE, PATHS, PLAZA, WORKSHOP, BOUTIQUE, ZONES } from '../data/world';
import { QUESTS } from '../data/quests';
import { engineRef } from '../engine/Engine';
import { slotAt } from '../engine/actors';
import { deletePhoto, getPhoto, type PhotoRecord } from '../state/photos';
import { clearSave, saveGame } from '../state/save';
import { newGameData } from '../state/store';
import WardrobeEditor from './Wardrobe';
import { josa } from '../data/josa';
import { Icon, ItemIcon } from './icons';
import type { Appearance } from '../data/appearance';

function Modal({ title, children, wide, onClose, right }: { title: string; children: React.ReactNode; wide?: boolean; onClose?: () => void; right?: React.ReactNode }) {
  const close = () => {
    engineRef.current?.sound.close();
    onClose ? onClose() : useUI.getState().close();
  };
  return (
    <div className="wf-modal-wrap" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <div className="wf-panel wf-modal" style={wide ? { width: 'min(940px, 100%)' } : undefined} role="dialog" aria-label={title}>
        <div className="wf-modal-head">
          <div className="wf-modal-title">{title}</div>
          {right}
          <button type="button" className="wf-close" onClick={close} aria-label="닫기">
            <Icon name="x" size={22} />
          </button>
        </div>
        <div className="wf-modal-body">{children}</div>
      </div>
    </div>
  );
}

function Money() {
  const money = useGame((s) => s.money);
  return (
    <span className="wf-row" style={{ gap: 4, fontWeight: 800, padding: '6px 12px', borderRadius: 999, background: 'var(--wf-cream2)' }}>
      <Icon name="acorn" size={20} />
      {money}
    </span>
  );
}

// ── 가방 ────────────────────────────────────────────
function BagPanel() {
  const bag = useGame((s) => s.bag);
  const storage = useGame((s) => s.storage);
  const [sel, setSel] = useState<number | null>(null);
  const slot = sel !== null ? bag[sel] : null;
  const def = slot ? ITEMS[slot.id] : null;
  const used = bag.filter(Boolean).length;
  const storageKinds = Object.keys(storage).length;
  const held = engineRef.current?.player.bouquetHeld;
  return (
    <Modal title="가방" right={<Money />}>
      <p style={{ color: 'var(--wf-ink2)', fontWeight: 650, marginBottom: 10 }}>
        {used}/{BAG_SIZE}칸 · 재료는 종류별로 쌓여요{storageKinds ? ` · 집 보관함에 ${storageKinds}종` : ''}
      </p>
      {used === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--wf-ink2)', fontWeight: 650 }}>가방이 비었어요. 꽃을 따거나 나무를 흔들어 보세요.</div>
      ) : (
        <div className="wf-grid">
          {bag.map((s, i) => (
            <button key={i} type="button" className={`wf-slot ${s ? '' : 'empty'} ${sel === i ? 'on' : ''}`} onClick={() => s && setSel(i)} aria-label={s ? `${itemName(s.id)} ${s.qty}개` : '빈 칸'}>
              {s && <ItemIcon id={s.id} size={40} />}
              {s && s.qty > 1 && <span className="wf-qty">{s.qty}</span>}
            </button>
          ))}
        </div>
      )}
      {slot && def && (
        <div className="wf-card" style={{ marginTop: 14, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <ItemIcon id={slot.id} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.08em' }}>
              {def.name} <span style={{ color: 'var(--wf-ink2)', fontWeight: 650 }}>× {countIn(bag, slot.id)}</span>
            </div>
            <div style={{ marginTop: 4, lineHeight: 1.5, wordBreak: 'keep-all' }}>{def.desc}</div>
            {def.use && <div style={{ marginTop: 4, fontSize: '0.88em', color: 'var(--wf-green2)', fontWeight: 700 }}>쓰는 곳 · {def.use}</div>}
            {def.sell && <div style={{ marginTop: 2, fontSize: '0.84em', color: 'var(--wf-ink2)' }}>소담 가판대에 팔면 도토리 {def.sell}개</div>}
          </div>
          {slot.id === 'bouquet' && (
            <button type="button" className="wf-btn small" onClick={() => engineRef.current?.toggleBouquet()}>
              {held ? '내려놓기' : '손에 들기'}
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── 제작 ────────────────────────────────────────────
function CraftPanel() {
  const station = useUI((s) => s.craftStation);
  const bag = useGame((s) => s.bag);
  const recipes = useGame((s) => s.recipes);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const list = Object.values(RECIPES).filter((r) => r.station === station);
  const known = list.filter((r) => recipes.includes(r.id));
  const unknown = list.filter((r) => !recipes.includes(r.id));
  const craft = (id: string) => {
    if (busy) return;
    setBusy(id);
    const r = engineRef.current?.craft(id) || { ok: false, reason: '엔진이 준비되지 않았어요' };
    setMsg(r.ok ? { text: `${josa(RECIPES[id].name, '을/를')} 만들었어요!`, ok: true } : { text: r.reason || '만들지 못했어요', ok: false });
    // 연타로 중복 제작되지 않게 잠깐 잠근다(재료가 남으면 다시 누를 수 있다)
    setTimeout(() => setBusy(null), 450);
  };
  return (
    <Modal title={station === 'workbench' ? '나뭇결 공방 작업대' : '꽃잎 온실 부케 테이블'}>
      {msg && (
        <div className="wf-card wf-row" style={{ padding: '10px 12px', marginBottom: 12, gap: 8, borderColor: msg.ok ? '#B9D7A9' : '#EFC2B1', fontWeight: 750 }}>
          <Icon name={msg.ok ? 'check' : 'help'} size={18} color={msg.ok ? '#46774A' : '#D9785F'} />
          {msg.text}
        </div>
      )}
      {known.length === 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--wf-ink2)', fontWeight: 650, lineHeight: 1.6, wordBreak: 'keep-all' }}>
          {station === 'workbench' ? '아직 아는 제작법이 없어요. 공방의 우디에게 배워 보세요.' : '아직 아는 제작법이 없어요. 꽃잎 온실의 소담에게 배워 보세요.'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {known.map((r) => {
          const enough = r.inputs.every((i) => countIn(bag, i.id) >= i.qty);
          return (
            <div key={r.id} className="wf-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <ItemIcon id={r.output.id} size={50} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{r.name}</div>
                <div className="wf-row" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {r.inputs.map((i) => {
                    const have = countIn(bag, i.id);
                    const ok = have >= i.qty;
                    return (
                      <span key={i.id} className="wf-row" style={{ gap: 4, padding: '2px 8px 2px 4px', borderRadius: 999, background: ok ? '#EEF6E6' : '#FFF1EC', border: `2px solid ${ok ? '#CFE3BF' : '#F2C9BA'}`, fontSize: '0.86em', fontWeight: 750 }}>
                        <ItemIcon id={i.id} size={22} />
                        {itemName(i.id)} {Math.min(have, 99)}/{i.qty}
                        {!ok && <span style={{ color: 'var(--wf-warn)' }}> · {i.qty - have} 모자람</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
              <button type="button" className="wf-btn" disabled={!enough || !!busy} onClick={() => craft(r.id)}>
                {busy === r.id ? '만드는 중' : '만들기'}
              </button>
            </div>
          );
        })}
        {unknown.map((r) => (
          <div key={r.id} className="wf-card" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6 }}>
            <div style={{ width: 50, height: 50, borderRadius: 14, background: 'var(--wf-cream2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--wf-ink2)' }}>?</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800 }}>아직 모르는 제작법</div>
              <div style={{ fontSize: '0.86em', color: 'var(--wf-ink2)' }}>{r.hint}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── 지도 ────────────────────────────────────────────
function MapPanel() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const data = useGame();
  const obj = objectiveOf(data);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const e = engineRef.current;
    const draw = () => {
      const g = c.getContext('2d')!;
      const W = c.width;
      const H = c.height;
      const pad = 24;
      const sx = (W - pad * 2) / (BOUNDS.maxX - BOUNDS.minX);
      const sz = (H - pad * 2) / (BOUNDS.maxZ - BOUNDS.minZ);
      const s = Math.min(sx, sz);
      const ox = (W - (BOUNDS.maxX - BOUNDS.minX) * s) / 2;
      const oz = (H - (BOUNDS.maxZ - BOUNDS.minZ) * s) / 2;
      const X = (x: number) => ox + (x - BOUNDS.minX) * s;
      const Z = (z: number) => oz + (z - BOUNDS.minZ) * s;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#B9D69C';
      g.beginPath();
      g.roundRect(X(BOUNDS.minX), Z(BOUNDS.minZ), (BOUNDS.maxX - BOUNDS.minX) * s, (BOUNDS.maxZ - BOUNDS.minZ) * s, BOUNDS.corner * s);
      g.fill();
      // 길
      g.strokeStyle = '#EAD7B0';
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (const p of PATHS) {
        g.lineWidth = p.w * s;
        g.beginPath();
        p.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
        g.stroke();
      }
      g.fillStyle = '#EAD7B0';
      g.beginPath();
      g.arc(X(PLAZA.center[0]), Z(PLAZA.center[1]), PLAZA.radius * s, 0, Math.PI * 2);
      g.fill();
      // 호수
      g.fillStyle = '#8CC3CF';
      g.beginPath();
      g.ellipse(X(LAKE.center[0]), Z(LAKE.center[1]), LAKE.rx * s, LAKE.rz * s, 0, 0, Math.PI * 2);
      g.fill();
      // 정원
      g.fillStyle = '#CFE5B6';
      g.strokeStyle = '#7FAE62';
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(X(GARDEN.minX), Z(GARDEN.minZ), (GARDEN.maxX - GARDEN.minX) * s, (GARDEN.maxZ - GARDEN.minZ) * s, 6);
      g.fill();
      g.stroke();
      // 건물
      const bld = (c2: [number, number], size: [number, number], col: string) => {
        g.fillStyle = col;
        g.beginPath();
        g.roundRect(X(c2[0] - size[0] / 2), Z(c2[1] - size[1] / 2), size[0] * s, size[1] * s, 4);
        g.fill();
      };
      bld(HOME.house, HOME.houseSize, '#C9785B');
      bld(GREENHOUSE.center, GREENHOUSE.size, '#DCEBF0');
      bld(WORKSHOP.center, WORKSHOP.size, '#6E9A63');
      bld(BOUTIQUE.center, BOUTIQUE.size, '#E2A5B8');
      // 이름
      g.font = `700 ${Math.max(11, s * 1.6)}px Pretendard, sans-serif`;
      g.textAlign = 'center';
      g.fillStyle = '#2F4A35';
      for (const z of ZONES) g.fillText(z.name, X(z.center[0]), Z(z.center[1]) - z.radius * s * 0.45);
      // 목표
      const q = QUESTS[obj.id];
      let tgt: [number, number] | null = null;
      if (q?.target.resident && e) tgt = [e.residents[q.target.resident].pos.x, e.residents[q.target.resident].pos.z];
      else if (q?.target.pos) tgt = q.target.pos;
      if (tgt) {
        g.fillStyle = '#F6C14E';
        g.strokeStyle = '#fff';
        g.lineWidth = 2;
        const [tx, tz] = [X(tgt[0]), Z(tgt[1])];
        g.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 ? 6 : 13;
          const px = tx + Math.cos(a) * r;
          const pz = tz + Math.sin(a) * r;
          i ? g.lineTo(px, pz) : g.moveTo(px, pz);
        }
        g.closePath();
        g.fill();
        g.stroke();
      }
      // 주민·파트너·나
      if (e) {
        for (const id of RESIDENT_IDS) {
          const r = e.residents[id];
          g.fillStyle = RESIDENTS[id].color;
          g.beginPath();
          g.arc(X(r.pos.x), Z(r.pos.z), 7, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#fff';
          g.lineWidth = 2;
          g.stroke();
          g.fillStyle = '#2F4A35';
          g.fillText(RESIDENTS[id].name, X(r.pos.x), Z(r.pos.z) - 11);
        }
        g.fillStyle = '#7FA3C7';
        g.beginPath();
        g.arc(X(e.partner.pos.x), Z(e.partner.pos.z), 6, 0, Math.PI * 2);
        g.fill();
        const px = X(e.playerPos.x);
        const pz = Z(e.playerPos.z);
        const d = e.playerDir;
        g.fillStyle = '#E86F6F';
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.moveTo(px + Math.sin(d) * 12, pz + Math.cos(d) * 12);
        g.lineTo(px + Math.sin(d + 2.5) * 8, pz + Math.cos(d + 2.5) * 8);
        g.lineTo(px + Math.sin(d - 2.5) * 8, pz + Math.cos(d - 2.5) * 8);
        g.closePath();
        g.fill();
        g.stroke();
      }
    };
    draw();
    const t = setInterval(draw, 500);
    return () => clearInterval(t);
  }, [obj.id]);
  const e = engineRef.current;
  const hour = hourOf(data.clock);
  return (
    <Modal title="지도" wide>
      <canvas ref={ref} width={900} height={760} style={{ width: '100%', height: 'auto', borderRadius: 18, background: '#94BC78', display: 'block' }} aria-label="마을 지도" />
      <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {RESIDENT_IDS.map((id) => (
          <span key={id} className="wf-row" style={{ gap: 6, padding: '6px 12px', borderRadius: 999, background: '#fff', border: '2px solid var(--wf-line)', fontWeight: 700, fontSize: '0.9em' }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: RESIDENTS[id].color }} />
            {RESIDENTS[id].name} · {e?.residents[id]?.activity || slotAt(RESIDENTS[id], hour).label}
          </span>
        ))}
        <span className="wf-row" style={{ gap: 6, padding: '6px 12px', borderRadius: 999, background: '#FFF8E8', border: '2px solid #ECD29C', fontWeight: 700, fontSize: '0.9em' }}>
          <Icon name="star" size={16} /> 목표 · {obj.place}
        </span>
      </div>
    </Modal>
  );
}

// ── 앨범 · 추억 ─────────────────────────────────────
function AlbumPanel() {
  const photos = useGame((s) => s.photos);
  const memories = useGame((s) => s.memories);
  const framePhoto = useGame((s) => s.framePhoto);
  const letters = useGame((s) => s.letters);
  const [tab, setTab] = useState<'photo' | 'memory'>(photos.length ? 'photo' : 'memory');
  const [recs, setRecs] = useState<Record<string, PhotoRecord | null>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => {
    let alive = true;
    void Promise.all(photos.map((id) => getPhoto(id).then((r) => [id, r] as const))).then((list) => {
      if (alive) setRecs(Object.fromEntries(list));
    });
    return () => {
      alive = false;
    };
  }, [photos]);
  const cur = sel ? recs[sel] : null;
  const hasFrame = useGame.getState().decor.home.some((d) => d.id === 'photo_frame') || useGame.getState().count('photo_frame') > 0;
  return (
    <Modal title="추억 앨범" wide right={letters.some((l) => !l.read) ? <button type="button" className="wf-btn small pink" onClick={() => useUI.getState().open('letters')}>새 편지</button> : undefined}>
      <div className="wf-tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={`wf-tab ${tab === 'photo' ? 'on' : ''}`} onClick={() => setTab('photo')}>
          사진 {photos.length}
        </button>
        <button type="button" className={`wf-tab ${tab === 'memory' ? 'on' : ''}`} onClick={() => setTab('memory')}>
          추억 카드 {memories.length}
        </button>
      </div>
      {tab === 'photo' &&
        (photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--wf-ink2)', fontWeight: 650, lineHeight: 1.6 }}>
            아직 사진이 없어요. P 키나 사진 버튼으로 숲을 찍어 보세요.
            <div style={{ marginTop: 12 }}>
              <button type="button" className="wf-btn" onClick={() => engineRef.current?.enterPhoto()}>
                사진 찍으러 가기
              </button>
            </div>
          </div>
        ) : (
          <>
            {cur && sel && (
              <div className="wf-card" style={{ padding: 12, marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cur.full} alt={cur.caption} style={{ width: '100%', borderRadius: 14, display: 'block' }} />
                <div className="wf-row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, fontWeight: 750 }}>{cur.caption}</span>
                  {hasFrame && (
                    <button type="button" className="wf-btn small gold" disabled={framePhoto === sel} onClick={() => useGame.getState().setFramePhoto(sel)}>
                      {framePhoto === sel ? '액자에 걸려 있어요' : '액자에 걸기'}
                    </button>
                  )}
                  {confirmDel ? (
                    <>
                      <button type="button" className="wf-btn small ghost" onClick={() => setConfirmDel(false)}>
                        그만두기
                      </button>
                      <button
                        type="button"
                        className="wf-btn small pink"
                        onClick={() => {
                          void deletePhoto(sel);
                          useGame.getState().removePhoto(sel);
                          setSel(null);
                          setConfirmDel(false);
                          engineRef.current?.save('photo-del', true);
                        }}
                      >
                        정말 지우기
                      </button>
                    </>
                  ) : (
                    <button type="button" className="wf-btn small ghost" onClick={() => setConfirmDel(true)}>
                      <Icon name="trash" size={16} /> 지우기
                    </button>
                  )}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
              {photos
                .slice()
                .reverse()
                .map((id) => {
                  const r = recs[id];
                  return (
                    <button key={id} type="button" onClick={() => setSel(id)} style={{ border: sel === id ? '3px solid var(--wf-green)' : '3px solid #fff', borderRadius: 14, padding: 0, overflow: 'hidden', background: '#fff', cursor: 'pointer', position: 'relative', boxShadow: '0 4px 12px rgba(28,40,30,0.15)' }}>
                      {r ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumb} alt="" style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wf-ink2)', fontSize: 12 }}>{r === null ? '불러오지 못했어요' : '불러오는 중'}</div>
                      )}
                      {framePhoto === id && <span style={{ position: 'absolute', top: 6, left: 6, padding: '2px 8px', borderRadius: 999, background: '#FFF8E8', fontSize: 11, fontWeight: 800 }}>액자</span>}
                    </button>
                  );
                })}
            </div>
          </>
        ))}
      {tab === 'memory' &&
        (memories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--wf-ink2)', fontWeight: 650 }}>함께한 순간이 추억 카드로 남아요.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {memories.map((m) => (
              <div key={m.id} className="wf-card" style={{ padding: 14, background: '#FFFDF7' }}>
                {m.photoId && recs[m.photoId] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={recs[m.photoId]!.thumb} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 8, display: 'block' }} />
                )}
                <div className="wf-row" style={{ gap: 6 }}>
                  <Icon name="heart" size={18} />
                  <span style={{ fontWeight: 850 }}>{m.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.8em', color: 'var(--wf-ink2)', fontWeight: 700 }}>{m.day}일차</span>
                </div>
                <p style={{ marginTop: 6, lineHeight: 1.55, wordBreak: 'keep-all' }}>{m.text}</p>
              </div>
            ))}
          </div>
        ))}
    </Modal>
  );
}

// ── 설정 ────────────────────────────────────────────
function SettingsPanel() {
  const st = useGame((s) => s.settings);
  const set = (p: Partial<typeof st>) => useGame.getState().setSettings(p);
  const [confirmReset, setConfirmReset] = useState(false);
  const dev = typeof window !== 'undefined' && /[?&]dev=1/.test(window.location.search);
  const Toggle = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <div className="wf-row" style={{ justifyContent: 'space-between', minHeight: 48 }}>
      <span style={{ fontWeight: 700 }}>{label}</span>
      <div className="wf-row" style={{ gap: 6 }}>
        <button type="button" className={`wf-chip ${value ? 'on' : ''}`} onClick={() => onChange(true)}>
          켜기
        </button>
        <button type="button" className={`wf-chip ${!value ? 'on' : ''}`} onClick={() => onChange(false)}>
          끄기
        </button>
      </div>
    </div>
  );
  return (
    <Modal title="메뉴 · 설정">
      <div style={{ display: 'grid', gap: 12 }}>
        {(['master', 'music', 'sfx'] as const).map((k) => (
          <label key={k}>
            <div className="wf-label">{k === 'master' ? '전체 소리' : k === 'music' ? '음악' : '효과음'} · {Math.round(st[k] * 100)}%</div>
            <input className="wf-range" type="range" min={0} max={1} step={0.05} value={st[k]} onChange={(e) => set({ [k]: Number(e.target.value) } as any)} />
          </label>
        ))}
        <div>
          <div className="wf-label">대사 속도</div>
          <div className="wf-row" style={{ gap: 6 }}>
            {[1, 2, 3].map((v) => (
              <button key={v} type="button" className={`wf-chip ${st.textSpeed === v ? 'on' : ''}`} onClick={() => set({ textSpeed: v })}>
                {v === 1 ? '느리게' : v === 2 ? '보통' : '빠르게'}
              </button>
            ))}
          </div>
        </div>
        <Toggle label="글자 크게" value={st.bigText} onChange={(v) => set({ bigText: v })} />
        <Toggle label="카메라 흔들림" value={st.shake} onChange={(v) => set({ shake: v })} />
        <Toggle label="사진 찍을 때 화면 번쩍임" value={st.flash} onChange={(v) => set({ flash: v })} />
        <Toggle label="사진 모드 배경 흐림(심도)" value={st.dof} onChange={(v) => set({ dof: v })} />
        <div>
          <div className="wf-label">그래픽 품질 · 풀·나무 밀도는 다시 들어오면 바뀌어요</div>
          <div className="wf-row" style={{ gap: 6 }}>
            <button type="button" className={`wf-chip ${st.quality === 'high' ? 'on' : ''}`} onClick={() => set({ quality: 'high' })}>
              높음(PC)
            </button>
            <button type="button" className={`wf-chip ${st.quality === 'low' ? 'on' : ''}`} onClick={() => set({ quality: 'low' })}>
              낮음(빠르게)
            </button>
          </div>
        </div>
        <div>
          <div className="wf-label">게임 하루의 길이</div>
          <div className="wf-row" style={{ gap: 6 }}>
            {[12, 24, 48].map((m) => (
              <button key={m} type="button" className={`wf-chip ${st.dayMinutes === m ? 'on' : ''}`} onClick={() => set({ dayMinutes: m as 12 | 24 | 48 })}>
                {m}분
              </button>
            ))}
          </div>
        </div>
        {dev && (
          <div>
            <div className="wf-label">하늘 보기(개발용)</div>
            <div className="wf-row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {[
                ['아침', 7],
                ['낮', 12],
                ['노을', 17.8],
                ['밤', 22],
              ].map(([l, h]) => (
                <button key={String(l)} type="button" className="wf-chip" onClick={() => engineRef.current?.setTime(Number(h))}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="wf-sep" />
        <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="wf-btn" onClick={() => engineRef.current?.save('manual', true)}>
            <Icon name="save" size={18} /> 지금 저장
          </button>
          <button
            type="button"
            className="wf-btn ghost"
            onClick={() => {
              useUI.getState().close();
              engineRef.current?.teleportHome();
            }}
          >
            <Icon name="home" size={18} /> 집으로 돌아가기
          </button>
          <button type="button" className="wf-btn ghost" onClick={() => useUI.getState().open('help')}>
            <Icon name="help" size={18} /> 조작법
          </button>
        </div>
        <p style={{ fontSize: '0.84em', color: 'var(--wf-ink2)', lineHeight: 1.6, wordBreak: 'keep-all' }}>
          진행은 이 브라우저(기기)에만 저장돼요. 브라우저의 사이트 데이터를 지우면 진행과 사진이 함께 사라지고, 다른 기기에서는 이어할 수 없어요. 꽃 따기·제작·배치·예식 같은 중요한 순간마다 자동으로 저장돼요.
        </p>
        <div className="wf-sep" />
        {confirmReset ? (
          <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontWeight: 700, flex: 1 }}>모든 진행을 지우고 처음부터 시작할까요?</span>
            <button type="button" className="wf-btn ghost small" onClick={() => setConfirmReset(false)}>
              그만두기
            </button>
            <button
              type="button"
              className="wf-btn pink small"
              onClick={() => {
                clearSave();
                useGame.getState().hydrate(newGameData());
                useUI.getState().set({ screen: 'create', panel: null, mode: 'play' });
              }}
            >
              처음부터
            </button>
          </div>
        ) : (
          <button type="button" className="wf-btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmReset(true)}>
            처음부터 새로 시작
          </button>
        )}
      </div>
    </Modal>
  );
}

// ── 가게(소담 가판대) ───────────────────────────────
function ShopPanel() {
  const bag = useGame((s) => s.bag);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const forSale = Object.values(ITEMS).filter((i) => i.buy);
  const sellable = Array.from(new Set(bag.filter(Boolean).map((s) => s!.id))).filter((id) => ITEMS[id]?.sell);
  const act = (fn: () => { ok: boolean; reason?: string }, okText: string) => {
    const r = fn();
    setMsg(r.ok ? { text: okText, ok: true } : { text: r.reason || '할 수 없어요', ok: false });
    if (r.ok) {
      engineRef.current?.sound.reward();
      engineRef.current?.save('shop', false);
    } else engineRef.current?.sound.error();
  };
  return (
    <Modal title="꽃잎 온실 가판대" right={<Money />}>
      <div className="wf-tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={`wf-tab ${tab === 'buy' ? 'on' : ''}`} onClick={() => setTab('buy')}>
          사기
        </button>
        <button type="button" className={`wf-tab ${tab === 'sell' ? 'on' : ''}`} onClick={() => setTab('sell')}>
          팔기
        </button>
      </div>
      {msg && <div style={{ marginBottom: 10, fontWeight: 750, color: msg.ok ? 'var(--wf-green2)' : 'var(--wf-warn)' }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tab === 'buy' &&
          forSale.map((i) => (
            <div key={i.id} className="wf-card wf-row" style={{ padding: 10, gap: 12 }}>
              <ItemIcon id={i.id} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{i.name}</div>
                <div style={{ fontSize: '0.84em', color: 'var(--wf-ink2)' }}>{i.desc}</div>
              </div>
              <button type="button" className="wf-btn small" onClick={() => act(() => useGame.getState().buy(i.id, 1), `${josa(i.name, '을/를')} 샀어요`)}>
                <Icon name="acorn" size={16} /> {i.buy}
              </button>
            </div>
          ))}
        {tab === 'sell' &&
          (sellable.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--wf-ink2)', fontWeight: 650 }}>팔 수 있는 물건이 없어요.</div>
          ) : (
            sellable.map((id) => {
              const i = ITEMS[id];
              const n = countIn(bag, id);
              return (
                <div key={id} className="wf-card wf-row" style={{ padding: 10, gap: 12 }}>
                  <ItemIcon id={id} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>
                      {i.name} × {n}
                    </div>
                    <div style={{ fontSize: '0.84em', color: 'var(--wf-ink2)' }}>한 개에 도토리 {i.sell}</div>
                  </div>
                  <button type="button" className="wf-btn small ghost" onClick={() => act(() => useGame.getState().sell(id, 1), `${i.name} 1개를 팔았어요`)}>
                    1개
                  </button>
                  {n > 1 && (
                    <button type="button" className="wf-btn small ghost" onClick={() => act(() => useGame.getState().sell(id, n), `${i.name} ${n}개를 팔았어요`)}>
                      전부
                    </button>
                  )}
                </div>
              );
            })
          ))}
      </div>
      <p style={{ marginTop: 12, fontSize: '0.82em', color: 'var(--wf-ink2)', wordBreak: 'keep-all' }}>예식에 꼭 필요한 재료(흰 꽃·목재)는 숲에서 언제든 다시 얻을 수 있어요.</p>
    </Modal>
  );
}

// ── 보관함 ──────────────────────────────────────────
function StoragePanel() {
  const storage = useGame((s) => s.storage);
  const bag = useGame((s) => s.bag);
  const [msg, setMsg] = useState<string | null>(null);
  const bagIds = Array.from(new Set(bag.filter(Boolean).map((s) => s!.id)));
  return (
    <Modal title="집 보관함">
      {msg && <div style={{ marginBottom: 10, fontWeight: 750 }}>{msg}</div>}
      <div className="wf-label">보관함</div>
      {Object.keys(storage).length === 0 ? (
        <div style={{ padding: '10px 0 16px', color: 'var(--wf-ink2)', fontWeight: 650 }}>보관함이 비었어요.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {Object.entries(storage).map(([id, n]) => (
            <div key={id} className="wf-card wf-row" style={{ padding: 10, gap: 10 }}>
              <ItemIcon id={id} size={40} />
              <span style={{ flex: 1, fontWeight: 750 }}>
                {itemName(id)} × {n}
              </span>
              <button
                type="button"
                className="wf-btn small"
                onClick={() => {
                  const r = useGame.getState().takeFromStorage(id, 1);
                  setMsg(r.ok ? `${itemName(id)} 1개를 꺼냈어요` : r.reason || '');
                }}
              >
                1개 꺼내기
              </button>
              {n > 1 && (
                <button
                  type="button"
                  className="wf-btn small ghost"
                  onClick={() => {
                    const r = useGame.getState().takeFromStorage(id, n);
                    setMsg(r.ok ? `${itemName(id)} ${n}개를 꺼냈어요` : r.reason || '');
                  }}
                >
                  전부
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="wf-label">가방에서 맡기기</div>
      <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {bagIds.length === 0 && <span style={{ color: 'var(--wf-ink2)' }}>가방이 비었어요.</span>}
        {bagIds.map((id) => (
          <button
            key={id}
            type="button"
            className="wf-chip"
            onClick={() => {
              const n = countIn(useGame.getState().bag, id);
              if (useGame.getState().putToStorage(id, n)) setMsg(`${itemName(id)} ${n}개를 맡겼어요`);
              engineRef.current?.save('storage', false);
            }}
          >
            <ItemIcon id={id} size={22} />
            {itemName(id)} × {countIn(bag, id)}
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ── 예식 준비 ───────────────────────────────────────
function ReadyPanel() {
  const data = useGame();
  const r = ceremonyReadiness(data.snapshot());
  return (
    <Modal title="예식 준비 확인">
      <p style={{ color: 'var(--wf-ink2)', fontWeight: 650, marginBottom: 12, lineHeight: 1.5, wordBreak: 'keep-all' }}>장식의 수량과 배치만 확인해요. 색이나 가격은 마음대로 골라도 괜찮아요.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {r.items.map((i) => (
          <div key={i.key} className="wf-card wf-row" style={{ padding: 12, gap: 12, borderColor: i.ok ? '#CFE3BF' : i.optional ? 'var(--wf-line)' : '#F2C9BA' }}>
            <span style={{ width: 34, height: 34, borderRadius: 12, background: i.ok ? '#E3EFD9' : i.optional ? 'var(--wf-cream2)' : '#FFF1EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={i.ok ? 'check' : i.optional ? 'leaf' : 'x'} size={20} color={i.ok ? '#46774A' : i.optional ? '#7A8C70' : '#D9785F'} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800 }}>
                {i.label} {i.optional && <span style={{ fontSize: '0.8em', color: 'var(--wf-ink2)' }}>선택</span>}
              </div>
              <div style={{ fontSize: '0.88em', color: 'var(--wf-ink2)', wordBreak: 'keep-all' }}>{i.detail}</div>
            </div>
            {!i.ok && i.fix === 'decor' && (
              <button type="button" className="wf-btn small" onClick={() => engineRef.current?.enterDecor('garden')}>
                바로 고치기
              </button>
            )}
            {!i.ok && i.fix === 'wardrobe' && (
              <button
                type="button"
                className="wf-btn small"
                onClick={() => {
                  useUI.getState().set({ wardrobeMode: 'wedding', wardrobeFor: 'me' });
                  useUI.getState().open('wardrobe');
                }}
              >
                의상 고르기
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="wf-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
        <button type="button" className="wf-btn gold" disabled={!r.ok} onClick={() => engineRef.current?.startCeremony(data.wedding.count > 0)}>
          {r.ok ? '도담에게 예식 시작 부탁하기' : '준비가 끝나면 시작할 수 있어요'}
        </button>
      </div>
    </Modal>
  );
}

// ── 편지 ────────────────────────────────────────────
function LettersPanel() {
  const letters = useGame((s) => s.letters);
  const [sel, setSel] = useState<string | null>(null);
  const cur = letters.find((l) => l.id === sel);
  return (
    <Modal title="우편함">
      {letters.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--wf-ink2)', fontWeight: 650 }}>아직 도착한 편지가 없어요.</div>
      ) : cur ? (
        <div className="wf-card" style={{ padding: 18, background: '#FFFDF5' }}>
          <div style={{ fontWeight: 850, fontSize: '1.1em' }}>{cur.title}</div>
          <div style={{ fontSize: '0.84em', color: 'var(--wf-ink2)', marginTop: 2 }}>
            {cur.from} · {cur.day}일차
          </div>
          <p style={{ marginTop: 12, lineHeight: 1.8, wordBreak: 'keep-all' }}>{cur.body}</p>
          <button type="button" className="wf-btn ghost small" style={{ marginTop: 12 }} onClick={() => setSel(null)}>
            목록으로
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {letters
            .slice()
            .reverse()
            .map((l) => (
              <button
                key={l.id}
                type="button"
                className="wf-card wf-row"
                style={{ padding: 12, gap: 10, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                onClick={() => {
                  setSel(l.id);
                  useGame.getState().readLetter(l.id);
                }}
              >
                <Icon name="letter" size={26} />
                <span style={{ flex: 1, fontWeight: l.read ? 650 : 850 }}>
                  {l.title} <span style={{ color: 'var(--wf-ink2)', fontWeight: 600 }}>· {l.from}</span>
                </span>
                {!l.read && <span style={{ width: 9, height: 9, borderRadius: 9, background: '#E86F6F' }} />}
              </button>
            ))}
        </div>
      )}
    </Modal>
  );
}

// ── 선물 ────────────────────────────────────────────
function GiftPanel() {
  const resident = useUI((s) => s.panelArg) as string;
  const bag = useGame((s) => s.bag);
  const aff = useGame((s) => s.residents[resident]?.affinity || 0);
  const def = RESIDENTS[resident];
  const ids = Array.from(new Set(bag.filter(Boolean).map((s) => s!.id))).filter((id) => ITEMS[id]?.kind !== 'decor' || id === 'chair');
  return (
    <Modal title={`${def?.name ?? ''}에게 선물하기`}>
      <p style={{ color: 'var(--wf-ink2)', fontWeight: 650, marginBottom: 10 }}>
        친밀도 {affinityLevel(aff)}단계{affinityLevel(aff) >= 1 && def ? ` · 좋아하는 것: ${def.likes.map(itemName).join(', ')}` : ' · 하루에 한 번 선물할 수 있어요'}
      </p>
      {ids.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--wf-ink2)', fontWeight: 650 }}>줄 수 있는 물건이 없어요.</div>
      ) : (
        <div className="wf-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {ids.map((id) => (
            <button key={id} type="button" className="wf-chip" onClick={() => engineRef.current?.giveGift(resident, id)}>
              <ItemIcon id={id} size={24} />
              {itemName(id)}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── 게시판 ──────────────────────────────────────────
function BoardPanel() {
  const data = useGame();
  const obj = objectiveOf(data);
  const e = engineRef.current;
  const day = dayOf(data.clock);
  return (
    <Modal title={`약속의 광장 게시판 · ${day}일차`}>
      <div className="wf-card" style={{ padding: 14, background: '#FFFDF5', marginBottom: 10 }}>
        <div style={{ fontWeight: 850 }}>오늘의 소식</div>
        <p style={{ marginTop: 6, lineHeight: 1.6, wordBreak: 'keep-all' }}>
          {data.wedding.count > 0 ? `서약의 정원에서 ${josa(data.me.name, '와/과')} ${data.partner.name}의 결혼식이 열렸어요! 약속의 나무가 우리의 집 옆에서 자라고 있어요.` : `새 이웃 ${josa(data.me.name, '와/과')} ${josa(data.partner.name, '이/가')} 이사 왔어요. 서약의 정원에서 결혼식을 준비하고 있대요.`}
        </p>
      </div>
      <div className="wf-card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ fontWeight: 850 }}>지금 할 일</div>
        <p style={{ marginTop: 4 }}>
          {obj.title} — {obj.next}
        </p>
      </div>
      <div className="wf-card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 850, marginBottom: 6 }}>이웃 소식</div>
        {RESIDENT_IDS.map((id) => (
          <div key={id} className="wf-row" style={{ gap: 8, minHeight: 32 }}>
            <span style={{ width: 10, height: 10, borderRadius: 10, background: RESIDENTS[id].color }} />
            <b>{RESIDENTS[id].name}</b>
            <span style={{ color: 'var(--wf-ink2)' }}>
              {RESIDENTS[id].role} · {e?.residents[id]?.activity}
            </span>
          </div>
        ))}
        <p style={{ marginTop: 8, fontSize: '0.84em', color: 'var(--wf-ink2)', wordBreak: 'keep-all' }}>흰 꽃은 시간이 지나면 다시 피어요. 나무는 몇 시간마다 다시 흔들 수 있어요.</p>
      </div>
    </Modal>
  );
}

// ── 조작법 ──────────────────────────────────────────
function HelpPanel() {
  const rows: Array<[string, string, string]> = [
    ['이동', 'WASD 또는 방향키 · Shift 달리기', '왼쪽 아래를 끌기'],
    ['행동(따기·대화)', 'E 또는 Space', '오른쪽 행동 버튼'],
    ['가방 · 지도', 'I / M', '오른쪽 위 버튼'],
    ['앨범', 'J', '오른쪽 위 버튼'],
    ['사진', 'P · 촬영 Space · 돌리기 A/D · 높이 W/S', '사진 버튼 · 끌어서 돌리기'],
    ['꾸미기', '놓기 클릭/E · 회전 R · 회수 X · 칸 맞추기 G · 되돌리기 Ctrl+Z', '아래 버튼'],
    ['메뉴 · 닫기', 'Esc', '닫기 버튼'],
  ];
  return (
    <Modal title="조작법">
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map(([a, pc, m]) => (
          <div key={a} className="wf-card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8 }}>
            <b>{a}</b>
            <div>
              <div>PC · {pc}</div>
              <div style={{ color: 'var(--wf-ink2)', fontSize: '0.9em' }}>모바일 · {m}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ── 옷장(햇살 의상실 거울) ───────────────────────────
function WardrobePanel() {
  const mode = useUI((s) => s.wardrobeMode);
  const whoInit = useUI((s) => s.wardrobeFor);
  const me = useGame((s) => s.me);
  const partner = useGame((s) => s.partner);
  const [who, setWho] = useState<'me' | 'partner'>(whoInit);
  const [draft, setDraft] = useState<{ me: Appearance; partner: Appearance }>({ me: { ...me.look }, partner: { ...partner.look } });
  const original = who === 'me' ? me.look : partner.look;
  const changed = useMemo(() => JSON.stringify(draft.me) !== JSON.stringify(me.look) || JSON.stringify(draft.partner) !== JSON.stringify(partner.look), [draft, me.look, partner.look]);
  const apply = () => {
    const g = useGame.getState();
    g.setLook('me', draft.me);
    g.setLook('partner', draft.partner);
    engineRef.current?.sound.reward();
    engineRef.current?.save('wardrobe', true);
    useUI.getState().toast('새 모습으로 바꿨어요', 'ok');
    useUI.getState().close();
  };
  return (
    <Modal
      title={mode === 'wedding' ? '햇살 의상실 · 전신 거울' : '옷장'}
      wide
      right={
        <div className="wf-tabs" style={{ minWidth: 200 }}>
          <button type="button" className={`wf-tab ${who === 'me' ? 'on' : ''}`} onClick={() => setWho('me')}>
            {me.name}
          </button>
          <button type="button" className={`wf-tab ${who === 'partner' ? 'on' : ''}`} onClick={() => setWho('partner')}>
            {partner.name}
          </button>
        </div>
      }
    >
      <WardrobeEditor key={who} value={draft[who]} original={original} onChange={(a) => setDraft({ ...draft, [who]: a })} allowWedding={mode === 'wedding'} compact={typeof window !== 'undefined' && window.innerWidth < 760} />
      <div className="wf-row" style={{ marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {mode === 'wedding' && (!draft.me.wedding || !draft.partner.wedding) && <span style={{ flex: 1, fontSize: '0.88em', color: 'var(--wf-ink2)', fontWeight: 650 }}>예식엔 두 사람 모두 웨딩 의상이 필요해요({draft.me.wedding ? '✓' : '·'} {me.name} · {draft.partner.wedding ? '✓' : '·'} {partner.name})</span>}
        <button type="button" className="wf-btn ghost" onClick={() => useUI.getState().close()}>
          취소
        </button>
        <button type="button" className="wf-btn" disabled={!changed} onClick={apply}>
          적용
        </button>
      </div>
    </Modal>
  );
}

export default function PanelHost() {
  const panel = useUI((s) => s.panel);
  switch (panel) {
    case 'bag':
      return <BagPanel />;
    case 'craft':
      return <CraftPanel />;
    case 'map':
      return <MapPanel />;
    case 'album':
      return <AlbumPanel />;
    case 'settings':
      return <SettingsPanel />;
    case 'shop':
      return <ShopPanel />;
    case 'storage':
      return <StoragePanel />;
    case 'ready':
      return <ReadyPanel />;
    case 'letters':
      return <LettersPanel />;
    case 'gift':
      return <GiftPanel />;
    case 'board':
      return <BoardPanel />;
    case 'help':
      return <HelpPanel />;
    case 'wardrobe':
      return <WardrobePanel />;
    default:
      return null;
  }
}

void saveGame;
