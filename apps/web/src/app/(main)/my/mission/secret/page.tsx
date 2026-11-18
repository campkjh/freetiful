'use client';

/* 시크릿 미션 응모(261118 사장 '인스타그램 스토리에 프리티풀을 태그해서 올려주면 추첨을 통해 4만원 상당의 화장품 세트 — 완료하면 완료페이지로 바로 자동 이동').
 *  · 같은 날 '캡처사진 필요없고 그냥 인스타아이디만 넣으면 됨' → 참여 방법 3단계 + 내 인스타 아이디 하나 → [응모하기] → 성공하면 바로 /my/mission/secret/done(replace).
 *  · 열림 판정 · 중복 막기(계정당 1 · 같은 아이디 다른 계정 X)는 서버(apps/api/src/mission enterSecret). 이미 응모했으면(반려 빼고) 완료 화면으로. */
import '@/components/mission/mission.css';
import '@/components/mission/secret-mission.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { missionApi, type WelcomeMissionStatus } from '@/lib/api/mission.api';
import { SECRET_INSTAGRAM, SECRET_PRIZE } from '@/lib/secret-mission';
import { IcBack, IcCamera, IcGift, IcInstagram, IcLock } from '@/components/mission/icons';

/** 서버 parseInstagramId 와 같은 기준(영문 소문자 · 숫자 · 마침표 · 밑줄 30자) — 버튼을 켤지만 정한다. 최종 판정은 서버 */
const cleanId = (v: string) =>
  v.trim().replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, '').toLowerCase();
const idOk = (s: string) => /^[a-z0-9._]{1,30}$/.test(s) && !s.startsWith('.') && !s.endsWith('.') && !s.includes('..');

export default function SecretMissionEntryPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [st, setSt] = useState<WelcomeMissionStatus | null>(null);
  const [err, setErr] = useState('');
  const [igId, setIgId] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/my/mission');
      return;
    }
    missionApi
      .status()
      .then((s) => {
        const e = s.secret?.entry;
        if (e && e.status !== 'rejected') {
          router.replace('/my/mission/secret/done');
          return;
        }
        if (e?.instagramId) setIgId(e.instagramId);
        setSt(s);
      })
      .catch(() => setErr('미션을 불러오지 못했어요. 잠시 뒤 다시 들어와 주세요.'));
  }, [hasHydrated, user, router]);

  const id = cleanId(igId);
  const valid = idOk(id);
  const ready = valid && agree && !busy;
  const open = !!st?.eligible && !!st.completed;
  const rejected = st?.secret?.entry?.status === 'rejected' ? st.secret.entry : null;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(`@${SECRET_INSTAGRAM}`);
      toast.success('아이디를 복사했어요.');
    } catch {
      toast(`@${SECRET_INSTAGRAM}`);
    }
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await missionApi.enterSecret(id);
      // 응모되면 바로 완료 화면으로(뒤로 가기로 응모 화면에 돌아오지 않게 replace)
      router.replace('/my/mission/secret/done');
    } catch (e: any) {
      const m = e?.response?.data?.message;
      toast.error((Array.isArray(m) ? m[0] : m) || '응모하지 못했어요. 잠시 뒤 다시 해 주세요.');
      setBusy(false);
    }
  };

  return (
    <div className="sm-page">
      <header className="ms-head" data-native-back-header>
        <button type="button" className="ms-head-btn" aria-label="뒤로가기" onClick={() => (window.history.length > 1 ? router.back() : router.push('/my/mission'))}>
          <IcBack className="h-6 w-6" />
        </button>
      </header>

      {err && <div className="sm-body"><div className="sm-card sm-closed">{err}</div></div>}

      {st && !open && (
        <div className="sm-body">
          <div className="sm-card sm-closed">
            {'5,000원 미션을 모두 마치면\n시크릿 미션이 열려요.'}
            <button type="button" className="ft-btn primary" onClick={() => router.replace('/my/mission')}>미션 하러 가기</button>
          </div>
        </div>
      )}

      {st && open && (
        <>
          <section className="sm-hero">
            <span className="sm-hero-tag"><IcLock />시크릿 미션</span>
            <h1>인스타 스토리에{'\n'}<em>프리티풀</em>을 태그해 주세요</h1>
            <p>추첨으로 {SECRET_PRIZE}를 드려요</p>
          </section>

          <div className="sm-body">
            <div className="sm-card">
              <h2>참여 방법</h2>
              <ol className="sm-steps">
                <li className="sm-step">
                  <span className="sm-step-icon"><IcCamera /></span>
                  <span className="sm-step-text">
                    <b>인스타그램 스토리를 올려요</b>
                    <span>프리티풀 화면이나 결혼 준비 사진 무엇이든 좋아요</span>
                  </span>
                </li>
                <li className="sm-step">
                  <span className="sm-step-icon"><IcInstagram /></span>
                  <span className="sm-step-text">
                    <b>스토리에 @{SECRET_INSTAGRAM} 을 태그해요</b>
                    <span>공개 계정으로 올려야 확인할 수 있어요</span>
                    <button type="button" className="sm-copy" onClick={copyId}>@{SECRET_INSTAGRAM} 복사</button>
                  </span>
                </li>
                <li className="sm-step">
                  <span className="sm-step-icon"><IcGift /></span>
                  <span className="sm-step-text">
                    <b>아래에 내 인스타 아이디를 적고 응모해요</b>
                    <span>운영팀이 스토리를 확인하고 추첨해요</span>
                  </span>
                </li>
              </ol>
            </div>

            <div className="sm-card">
              <h2>{rejected ? '다시 응모하기' : '응모하기'}</h2>
              {rejected && (
                <p className="sm-reject">
                  <b>다시 응모해 주세요</b>
                  {rejected.adminNote || `스토리에서 @${SECRET_INSTAGRAM} 태그를 찾지 못했어요.`}
                </p>
              )}
              <label className="sm-label" htmlFor="sm-ig">내 인스타그램 아이디</label>
              <div className="sm-id">
                <span>@</span>
                <input
                  id="sm-ig"
                  className="ft-input"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="done"
                  placeholder="instagram_id"
                  maxLength={80}
                  value={igId}
                  onChange={(e) => setIgId(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                />
              </div>
              {igId && !valid && <p className="sm-hint">영문 · 숫자 · 마침표(.) · 밑줄(_)로 된 아이디를 적어 주세요</p>}
              <label className="sm-agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>응모 확인과 당첨 안내를 위해 인스타그램 아이디를 모으고, 이벤트가 끝나면 지우는 데 동의해요(필수)</span>
              </label>
              <button type="button" className="ft-btn primary sm-submit" disabled={!ready} onClick={submit}>
                {busy ? '응모하는 중…' : '응모하기'}
              </button>
            </div>

            <div className="sm-card sm-notes">
              <h3>유의사항</h3>
              <ul>
                <li>5,000원 미션을 모두 마친 회원만 응모할 수 있어요. 한 계정에 한 번 응모할 수 있어요.</li>
                <li>스토리는 공개 계정으로 올리고, 추첨 때까지 계정을 공개로 두어야 확인할 수 있어요.</li>
                <li>당첨자는 추첨으로 정하고, 알림으로 알려드려요. 받으실 곳은 따로 연락드려요.</li>
                <li>경품은 {SECRET_PRIZE}예요. 구성은 사정에 따라 비슷한 값어치로 바뀔 수 있어요.</li>
                <li>스토리에서 태그를 찾을 수 없거나 다른 사람의 아이디로 응모하면 반려될 수 있어요.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
