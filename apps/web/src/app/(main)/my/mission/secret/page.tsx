'use client';

/* 시크릿 미션 응모(261118 사장 '인스타그램 스토리에 프리티풀을 태그해서 올려주면 추첨을 통해 4만원 상당의 화장품 세트 — 완료하면 완료페이지로 바로 자동 이동').
 *  · 참여 방법 3단계 → 내 인스타 아이디 + 스토리 캡처 → [응모하기] → 성공하면 바로 /my/mission/secret/done(replace).
 *  · 열림 판정 · 중복 막기는 서버(apps/api/src/mission enterSecret). 이미 응모했으면(반려 빼고) 완료 화면으로. */
import '@/components/mission/mission.css';
import '@/components/mission/secret-mission.css';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { missionApi, type WelcomeMissionStatus } from '@/lib/api/mission.api';
import { shrinkPhoto } from '@/lib/reception/api';
import { SECRET_INSTAGRAM, SECRET_PRIZE } from '@/lib/secret-mission';
import { IcBack, IcCamera, IcGift, IcInstagram, IcLock } from '@/components/mission/icons';

export default function SecretMissionEntryPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();
  const [st, setSt] = useState<WelcomeMissionStatus | null>(null);
  const [err, setErr] = useState('');
  const [igId, setIgId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const id = igId.trim().replace(/^@+/, '');
  const ready = !!id && !!file && agree && !busy;
  const open = !!st?.eligible && !!st.completed;
  const rejected = st?.secret?.entry?.status === 'rejected' ? st.secret.entry : null;

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\//.test(f.type) && !/\.(heic|heif)$/i.test(f.name)) {
      toast.error('사진 파일만 올릴 수 있어요.');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(`@${SECRET_INSTAGRAM}`);
      toast.success('아이디를 복사했어요.');
    } catch {
      toast(`@${SECRET_INSTAGRAM}`);
    }
  };

  const submit = async () => {
    if (!ready || !file) return;
    setBusy(true);
    try {
      const { blob } = await shrinkPhoto(file);
      await missionApi.enterSecret(id, blob);
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
                    <b>올린 스토리를 캡처해서 응모해요</b>
                    <span>태그가 보이게 캡처해 주세요</span>
                  </span>
                </li>
              </ol>
            </div>

            <div className="sm-card">
              <h2>{rejected ? '다시 응모하기' : '응모하기'}</h2>
              {rejected && (
                <p className="ms-secret-state rejected" style={{ marginTop: 0, marginBottom: 18 }}>
                  <b>다시 응모해 주세요</b>
                  {rejected.adminNote || `스토리에서 @${SECRET_INSTAGRAM} 태그를 찾지 못했어요.`}
                </p>
              )}
              <div className="sm-field">
                <label className="sm-label" htmlFor="sm-ig">내 인스타그램 아이디</label>
                <div className="sm-id">
                  <span>@</span>
                  <input
                    id="sm-ig"
                    className="ft-input"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="instagram_id"
                    maxLength={40}
                    value={igId}
                    onChange={(e) => setIgId(e.target.value.replace(/\s/g, ''))}
                  />
                </div>
              </div>
              <div className="sm-field">
                <span className="sm-label">스토리 캡처</span>
                <button type="button" className={`sm-drop${preview ? ' has' : ''}`} onClick={() => fileRef.current?.click()}>
                  {preview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="올릴 스토리 캡처" />
                      <span className="sm-drop-change">바꾸기</span>
                    </>
                  ) : (
                    <>
                      <IcCamera />
                      캡처 사진 고르기
                    </>
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <label className="ms-agree" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 20, fontSize: 14, lineHeight: '20px', color: '#4e5968', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 20, height: 20, marginTop: 0, accentColor: '#3182f6', flex: 'none' }} />
                <span>응모 확인과 당첨 안내를 위해 인스타그램 아이디 · 스토리 캡처를 모으고, 이벤트가 끝나면 지우는 데 동의해요(필수)</span>
              </label>
              <button type="button" className="ft-btn primary sm-submit" disabled={!ready} onClick={submit}>
                {busy ? '올리는 중…' : '응모하기'}
              </button>
            </div>

            <div className="sm-card sm-notes">
              <h3>유의사항</h3>
              <ul>
                <li>5,000원 미션을 모두 마친 회원만 응모할 수 있어요. 한 계정에 한 번 응모할 수 있어요.</li>
                <li>스토리는 공개 계정으로 올리고, 추첨 때까지 계정을 공개로 두어야 확인할 수 있어요.</li>
                <li>당첨자는 추첨으로 정하고, 알림으로 알려드려요. 받으실 곳은 따로 연락드려요.</li>
                <li>경품은 {SECRET_PRIZE}예요. 구성은 사정에 따라 비슷한 값어치로 바뀔 수 있어요.</li>
                <li>태그가 보이지 않거나 다른 사람의 스토리를 올리면 응모가 반려될 수 있어요.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
