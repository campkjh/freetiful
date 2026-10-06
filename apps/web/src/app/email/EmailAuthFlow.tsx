'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import axios from 'axios';
import type { LoginResponse } from '@prettyful/types';
import { consumeAuthReturnTo } from '@/lib/auth/oauth';
import { useAuthStore } from '@/lib/store/auth.store';
import { clearAddingMarker, readAddingMarker, rememberCurrentAccount } from '@/lib/store/accounts.store';
import { syncPushRegistration } from '@/lib/utils/push';

/* ─────────────────────────────────────────────────────────────
 * 이메일로 시작하기 — 퀵매칭 어법 그대로(261006 사장 '퀵매칭처럼 이메일 회원가입 창으로 넘어가게').
 *  · 한 화면 = 한 질문(큰 제목 · 밑줄 입력 · 아래 파란 버튼), 머리 = 뒤로 + 진행 막대 'N / 전체'.
 *  · 가입 = 이름 → 이메일 → 비밀번호 → 완료 / 로그인 = 이메일 → 비밀번호.
 *  · 마이 두 번 누름 → 계정 전환 → '계정 추가'(표식 freetiful-accounts-adding)로 오면 지금 계정은 둔 채
 *    새 계정을 만들어 바꾼다 — 지금 계정은 계정 전환 목록에 남는다. 계정 추가 = 이메일 가입만(사장 261006).
 *  · 웹 로그인 창 · 웨딩숲 로그인 시트 · iOS 네이티브 로그인 시트의 '이메일로 로그인'이 /email/login 으로 온다.
 *  · 로그인·가입 요청은 apiClient 를 안 쓴다 — 틀린 비밀번호(401)에 지금 계정 토큰 갱신·로그아웃이 따라붙지 않게.
 * ──────────────────────────────────────────────────────────── */

type Mode = 'signup' | 'login';
type Step = 'name' | 'email' | 'password' | 'done';

const FLOW: Record<Mode, Step[]> = { signup: ['name', 'email', 'password'], login: ['email', 'password'] };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// 소셜 합성 이메일 도메인 — 서버도 막는다(auth.service isSyntheticProviderEmail)
const SYNTHETIC_RE = /@(kakao|naver|google|apple)\.freetiful\.com$/i;
const ICON = (n: string) => `/quick-match/icons/${n}.svg`;
const stag = (i: number): CSSProperties => ({ animationDelay: `${0.3 + i * 0.07}s` });

function Ic({ name, size = 24, color }: { name: string; size?: number; color?: string }) {
  return <i aria-hidden className="em-ic" style={{ width: size, height: size, color, WebkitMaskImage: `url(${ICON(name)})`, maskImage: `url(${ICON(name)})` }} />;
}

function passwordRules(pw: string) {
  return [
    { k: 'len', label: '8자 이상', ok: pw.length >= 8 },
    { k: 'alpha', label: '영문 포함', ok: /[A-Za-z]/.test(pw) },
    { k: 'num', label: '숫자 포함', ok: /\d/.test(pw) },
  ];
}

function nameProblem(v: string) {
  const t = v.trim();
  if (!t) return '이름을 입력해 주세요';
  if (t.length > 30) return '이름은 30자까지 쓸 수 있어요';
  if (/^\d+$/.test(t)) return '숫자로만 된 이름은 쓸 수 없어요';
  if (/^(kakao|naver|google|apple)_/i.test(t)) return '이 이름은 쓸 수 없어요';
  return '';
}

function detectPlatform() {
  const w = window as unknown as { webkit?: { messageHandlers?: unknown }; Android?: unknown; FreetifulAndroid?: unknown };
  const ua = navigator.userAgent || '';
  if (w.webkit?.messageHandlers || /iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (w.Android || w.FreetifulAndroid || /Android/i.test(ua)) return 'android';
  return 'web';
}

const statusOf = (e: unknown) => (axios.isAxiosError(e) ? e.response?.status : undefined);
const serverMessage = (e: unknown) => {
  const m = axios.isAxiosError(e) ? (e.response?.data as { message?: unknown } | undefined)?.message : undefined;
  return typeof m === 'string' && /[가-힣]/.test(m) ? m : '';
};

export default function EmailAuthFlow({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>(FLOW[initialMode][0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  /** 가입하려는 이메일이 이미 있음 → '이 이메일로 로그인하기' */
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  /** 마이 두 번 누름 → '계정 추가'로 왔는지(로그인해 있고 표식이 있음) */
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<{ name: string; email: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<string | null>(null);

  // 첫 그림 전에 정한다 — 제목('새 계정의 이름을')이 그려진 뒤 바뀌며 번쩍이지 않게
  useLayoutEffect(() => {
    setAdding(!!readAddingMarker() && !!useAuthStore.getState().user);
  }, []);

  // 단계마다 입력칸에 바로 커서 — 버튼 누른 그 순간(같은 작업) 안에서 잡아야 iOS 가 키보드를 올려 준다
  useLayoutEffect(() => {
    if (step !== 'done') inputRef.current?.focus({ preventScroll: true });
  }, [step, mode]);

  const flow = FLOW[mode];
  const at = Math.max(1, flow.indexOf(step) + 1);

  const destination = () => {
    if (destRef.current) return destRef.current;
    const to = adding ? '/my' : consumeAuthReturnTo('/main');
    destRef.current = to.startsWith('/email') ? '/main' : to;
    return destRef.current;
  };

  const leave = () => {
    if (adding) clearAddingMarker();
    if (window.history.length > 1) window.history.back();
    else window.location.replace(adding ? '/my' : '/main');
  };

  const back = () => {
    if (busy) return;
    setError('');
    setConflict(false);
    const i = flow.indexOf(step);
    if (i > 0) { setStep(flow[i - 1]); return; }
    // 첫 화면 — 로그인에서 가입으로(또는 반대로) 넘어왔으면 처음 화면으로, 아니면 나간다
    if (mode !== initialMode) { setMode(initialMode); setStep(FLOW[initialMode][0]); return; }
    leave();
  };

  // 로그인 상태로 — 지금 계정(계정 추가 중이면)과 새 계정 둘 다 계정 전환 목록에 남긴다
  const finishLogin = (data: LoginResponse) => {
    if (adding) rememberCurrentAccount();
    useAuthStore.getState().setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
    rememberCurrentAccount();
    try {
      sessionStorage.removeItem('freetiful-auth-switching');
      localStorage.setItem('userRole', data.user.role || 'general');
    } catch {}
    void syncPushRegistration(data.user.id);
    window.dispatchEvent(new CustomEvent('freetiful:auth-changed', { detail: { user: data.user } }));
  };

  const submitSignup = async () => {
    setBusy(true);
    try {
      const res = await axios.post<LoginResponse>('/api/v1/auth/register/email', {
        email: email.trim(), password, name: name.trim(), platform: detectPlatform(),
      }, { timeout: 15000 });
      finishLogin(res.data);
      if (adding) clearAddingMarker(); // 완료 화면이 알려 준다 — 마이에서 '추가했어요'를 또 띄우지 않게
      setDone({ name: res.data.user?.name || name.trim(), email: res.data.user?.email || email.trim().toLowerCase() });
      setStep('done');
    } catch (e) {
      if (statusOf(e) === 409) {
        setStep('email');
        setConflict(true);
        setError('이미 가입된 이메일이에요');
      } else {
        setError(serverMessage(e) || (statusOf(e) ? '가입하지 못했어요. 입력한 내용을 확인해 주세요' : '연결이 불안정해요. 잠시 후 다시 시도해 주세요'));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitLogin = async () => {
    setBusy(true);
    try {
      const res = await axios.post<LoginResponse>('/api/v1/auth/login/email', {
        email: email.trim(), password, platform: detectPlatform(),
      }, { timeout: 15000 });
      finishLogin(res.data);
      // 페이지를 새로 연다 — 앞 계정(계정 추가 중)이 들고 있던 화면 데이터가 섞이지 않게. 계정 추가였으면 마이에서 '추가했어요'
      window.location.replace(destination());
    } catch (e) {
      const status = statusOf(e);
      const msg = serverMessage(e);
      if (msg && /시도 횟수/.test(msg)) setError(msg);
      else if (status === 401 || status === 400) setError('이메일 또는 비밀번호가 맞지 않아요');
      else setError(status ? '로그인하지 못했어요. 잠시 후 다시 시도해 주세요' : '연결이 불안정해요. 잠시 후 다시 시도해 주세요');
      setBusy(false);
    }
  };

  const next = async () => {
    if (busy) return;
    setError('');
    setConflict(false);
    if (step === 'name') {
      const problem = nameProblem(name);
      if (problem) { setError(problem); return; }
      setStep('email');
      return;
    }
    if (step === 'email') {
      const v = email.trim();
      if (!EMAIL_RE.test(v)) { setError('이메일 주소를 확인해 주세요'); return; }
      if (SYNTHETIC_RE.test(v)) { setError('사용할 수 없는 이메일이에요'); return; }
      setEmail(v);
      setStep('password');
      return;
    }
    if (step === 'password') {
      if (mode === 'signup') {
        if (!passwordRules(password).every((r) => r.ok)) { setError('영문과 숫자를 섞어 8자 이상으로 만들어 주세요'); return; }
        await submitSignup();
      } else {
        if (!password) { setError('비밀번호를 입력해 주세요'); return; }
        await submitLogin();
      }
    }
  };

  const toSignup = () => { setMode('signup'); setStep('name'); setPassword(''); setError(''); setConflict(false); };
  const toLogin = () => { setMode('login'); setStep('password'); setPassword(''); setError(''); setConflict(false); };

  const canNext =
    step === 'name' ? name.trim().length > 0
      : step === 'email' ? email.trim().length > 0
        : mode === 'signup' ? passwordRules(password).every((r) => r.ok)
          : password.length > 0;

  let title: ReactNode = null;
  let sub: ReactNode = null;
  let field: ReactNode = null;
  let cta = '다음';
  if (step === 'name') {
    title = adding ? <>새 계정의 이름을<br />알려주세요</> : <>이름을<br />알려주세요</>;
    sub = '사회자와 이야기할 때 보이는 이름이에요.';
    field = (
      <input
        ref={inputRef}
        className={`em-textinput em-a-item ${error ? 'err' : ''}`}
        style={stag(0)}
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
        placeholder="이름"
        autoComplete="name"
        enterKeyHint="next"
        maxLength={30}
        aria-label="이름"
      />
    );
  } else if (step === 'email') {
    title = mode === 'login' ? <>이메일을<br />입력해주세요</> : <>이메일을<br />입력해주세요</>;
    sub = mode === 'login' ? '가입할 때 쓴 이메일을 입력해 주세요.' : '로그인할 때 아이디로 써요.';
    field = (
      <input
        ref={inputRef}
        className={`em-textinput em-a-item ${error ? 'err' : ''}`}
        style={stag(0)}
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (error) { setError(''); setConflict(false); } }}
        placeholder="example@email.com"
        autoComplete={mode === 'login' ? 'username' : 'email'}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        aria-label="이메일"
      />
    );
  } else if (step === 'password') {
    title = mode === 'signup' ? <>비밀번호를<br />만들어주세요</> : <>비밀번호를<br />입력해주세요</>;
    sub = mode === 'signup' ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : email.trim();
    cta = mode === 'signup' ? (busy ? '가입 중…' : '가입하기') : (busy ? '로그인 중…' : '로그인');
    const rules = passwordRules(password);
    field = (
      <>
        {/* 비밀번호 관리 앱이 이메일과 짝지어 저장하도록(화면엔 안 보임) */}
        <input className="em-sr" type="email" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
        <div className={`em-pwfield em-a-item ${error ? 'err' : ''}`} style={stag(0)}>
          <input
            ref={inputRef}
            className="em-textinput"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
            placeholder={mode === 'signup' ? '비밀번호 만들기' : '비밀번호'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint={mode === 'signup' ? 'done' : 'go'}
            aria-label="비밀번호"
          />
          <button
            type="button"
            className="em-eye"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
            aria-pressed={showPw}
          >
            {showPw ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" /><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.9" /></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3.5 9.5C5.3 12 8.3 14 12 14s6.7-2 8.5-4.5M12 14v3M7.2 12.8l-1.7 2.6M16.8 12.8l1.7 2.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>
            )}
          </button>
        </div>
        {mode === 'signup' && (
          <div className="em-rules em-a-item" style={stag(1)}>
            {rules.map((r) => (
              <span key={r.k} className={`em-rule ${r.ok ? 'ok' : ''}`}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.3l2.9 2.8L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {r.label}
              </span>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="em-root">
      {/* ⚠ <style>{CSS}</style> 는 서버가 ' > 를 엔티티로 바꿔 hydration 이 깨진다(퀵매칭 주석 참고) */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {step === 'done' && done ? (
        <div className="em-page" key="done">
          <Header onBack={() => window.location.replace(destination())} />
          <div className="em-done-body">
            <span className="em-done-ic"><Ic name="check" size={40} color="#fff" /></span>
            <h2 className="em-h2 center">{adding ? '새 계정을 만들었어요' : '가입이 완료됐어요'}</h2>
            <p className="em-done-sub">
              {adding
                ? <>마이 탭을 두 번 누르면<br />언제든 계정을 바꿀 수 있어요.</>
                : <><b className="blue">{done.name}</b>님, 환영해요!<br />이제 딱 맞는 사회자를 찾아볼까요?</>}
            </p>
            <div className="em-summary">
              <div><span>이름</span><b>{done.name}</b></div>
              <div><span>이메일</span><b>{done.email}</b></div>
            </div>
          </div>
          <div className="em-ctawrap">
            <button type="button" className="em-cta" onClick={() => window.location.replace(destination())}>{adding ? '확인' : '시작하기'}</button>
          </div>
        </div>
      ) : (
        <form className="em-page" key={`${mode}-${step}`} noValidate onSubmit={(e) => { e.preventDefault(); void next(); }}>
          <Header onBack={back} progress={{ at, total: flow.length }} />
          <main className="em-main">
            <h1 className="em-h1 em-a-title">{title}</h1>
            <p className="em-sub em-a-sub">{sub}</p>
            {field}
            {error && <p className="em-err" role="alert">{error}</p>}
            {step === 'email' && conflict && mode === 'signup' && (
              <button type="button" className="em-link em-a-item" style={stag(0)} onClick={toLogin}>이 이메일로 로그인하기</button>
            )}
            {step === 'email' && mode === 'login' && (
              <p className="em-alt em-a-item" style={stag(1)}>
                처음이신가요? <button type="button" className="em-link inline" onClick={toSignup}>이메일로 가입하기</button>
              </p>
            )}
          </main>
          <div className="em-ctawrap">
            <button type="submit" className="em-cta" disabled={!canNext || busy}>{cta}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** 머리 — 뒤로 + 몇 단계째인지(진행 막대 + 'N / 전체'), 퀵매칭 머리와 같은 모양 */
function Header({ onBack, progress }: { onBack: () => void; progress?: { at: number; total: number } }) {
  return (
    <header className="em-header">
      <button type="button" onClick={onBack} aria-label="뒤로"><Ic name="back" size={26} color="#191F28" /></button>
      {progress && (
        <div className="em-progress" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.at} aria-label={`전체 ${progress.total}단계 중 ${progress.at}단계`}>
          <span className="em-progress-track">
            <span
              className="em-progress-fill"
              style={{ '--from': `${((progress.at - 1) / progress.total) * 100}%`, '--to': `${(progress.at / progress.total) * 100}%` } as CSSProperties}
            />
          </span>
          <span className="em-progress-t"><b>{progress.at}</b> / {progress.total}</span>
        </div>
      )}
    </header>
  );
}

const CSS = `
.em-root{--blue:#3182F6;--blue-press:#2272EB;--red:#F04452;--t-strong:#191F28;--t:#333D4B;--t-sub:#4E5968;--t-weak:#6B7684;--t-ph:#8B95A1;--t-dis:#B0B8C1;--border:#E5E8EB;--divider:#F2F4F6;--bg-gray:#F2F4F6;
 font-family:'Pretendard Variable',Pretendard,-apple-system,BlinkMacSystemFont,system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
 -webkit-font-smoothing:antialiased;background:#fff;color:var(--t-strong);min-height:100dvh;max-width:520px;margin:0 auto;}
.em-ic{display:inline-block;background-color:currentColor;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;flex:none;}
.em-root b,.em-root strong{font-weight:600;}
.em-page{display:flex;flex-direction:column;min-height:100dvh;margin:0;}
@keyframes em-fadeup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes em-slidein{from{opacity:0;transform:translateX(22px)}to{opacity:1;transform:translateX(0)}}
@keyframes em-pagefade{from{opacity:0}to{opacity:1}}
.em-a-title{animation:em-fadeup .5s cubic-bezier(.22,.61,.36,1) both;}
.em-a-sub{animation:em-fadeup .5s cubic-bezier(.22,.61,.36,1) .18s both;}
.em-a-item{animation:em-slidein .46s cubic-bezier(.22,.61,.36,1) both;}
.em-header{height:56px;display:flex;align-items:center;padding:0 8px;flex:none;}
.em-header button{width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:0;background:none;border-radius:20px;cursor:pointer;}
.em-header button:active{background:var(--divider);}
.em-progress{flex:1;display:flex;align-items:center;gap:12px;padding:0 20px 0 6px;}
.em-progress-track{flex:1;height:4px;border-radius:2px;background:var(--divider);overflow:hidden;}
.em-progress-fill{display:block;height:100%;width:var(--to);border-radius:2px;background:var(--blue);animation:em-progress .5s cubic-bezier(.22,.61,.36,1) both;}
@keyframes em-progress{from{width:var(--from)}to{width:var(--to)}}
.em-progress-t{flex:none;font-size:13px;font-weight:500;color:var(--t-ph);font-variant-numeric:tabular-nums;letter-spacing:.2px;}
.em-progress-t b{color:var(--blue);font-weight:600;}
.em-main{flex:1;padding:8px 24px 24px;}
.em-h1{font-size:24px;font-weight:600;line-height:1.4;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.em-h2{font-size:21px;font-weight:600;line-height:1.42;letter-spacing:-.4px;color:var(--t-strong);margin:0;}
.em-h2.center{margin-top:26px;}
.em-sub{font-size:15px;color:var(--t-ph);margin:10px 0 0;line-height:1.5;word-break:break-all;}
.em-textinput{margin-top:36px;width:100%;border:0;border-bottom:2px solid var(--border);border-radius:0;background:none;font-family:inherit;font-size:22px;font-weight:600;color:var(--t-strong);padding:0 2px 12px;outline:none;transition:border-color .15s;-webkit-appearance:none;appearance:none;}
.em-textinput::placeholder{color:var(--t-dis);font-weight:600;}
.em-textinput:focus{border-color:var(--blue);}
.em-textinput.err,.em-pwfield.err .em-textinput{border-color:var(--red);}
.em-pwfield{position:relative;margin-top:36px;}
.em-pwfield .em-textinput{margin-top:0;padding-right:48px;}
.em-eye{position:absolute;right:0;bottom:8px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border:0;background:none;border-radius:20px;color:var(--t-ph);cursor:pointer;-webkit-tap-highlight-color:transparent;}
.em-eye:active{background:var(--divider);}
.em-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}
.em-rules{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;}
.em-rule{display:inline-flex;align-items:center;gap:4px;height:30px;padding:0 11px 0 9px;border-radius:15px;background:var(--divider);font-size:13.5px;font-weight:600;color:var(--t-dis);transition:background-color .2s,color .2s;}
.em-rule.ok{background:#E8F3FF;color:var(--blue);}
.em-err{margin:12px 2px 0;font-size:14px;font-weight:500;line-height:1.5;color:var(--red);animation:em-pagefade .2s ease both;}
.em-link{margin-top:14px;padding:6px 2px;border:0;background:none;font-family:inherit;font-size:15px;font-weight:600;color:var(--blue);cursor:pointer;-webkit-tap-highlight-color:transparent;}
.em-link.inline{margin:0;padding:4px 2px;font-size:inherit;}
.em-link:active{opacity:.6;}
.em-alt{margin:22px 2px 0;font-size:15px;color:var(--t-ph);}
.em-ctawrap{position:sticky;bottom:0;background:#fff;padding:10px 20px calc(env(safe-area-inset-bottom,0px) + 16px);flex:none;}
.em-cta{width:100%;height:56px;border:0;border-radius:17px;background:var(--blue);color:#fff;font-size:17px;font-weight:600;cursor:pointer;transition:transform .05s,background .15s;font-family:inherit;}
.em-cta:active:not(:disabled){transform:scale(.99);background:var(--blue-press);}
.em-cta:disabled{background:var(--bg-gray);color:var(--t-dis);cursor:default;}
.em-done-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 32px 24px;animation:em-pagefade .32s ease both;}
.em-done-ic{width:84px;height:84px;border-radius:50%;background:var(--blue);display:flex;align-items:center;justify-content:center;animation:em-pop .5s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes em-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:scale(1)}}
.em-done-sub{margin-top:14px;font-size:15px;line-height:1.6;color:var(--t-weak);}
.em-root .blue{color:var(--blue);}
.em-summary{margin-top:30px;width:100%;max-width:330px;background:#F9FAFB;border-radius:16px;padding:6px 18px;}
.em-summary>div{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid var(--divider);}
.em-summary>div:last-child{border-bottom:0;}
.em-summary span{font-size:14px;color:var(--t-ph);flex:none;}
.em-summary b{font-size:14px;font-weight:600;color:var(--t);text-align:right;word-break:break-all;}
@media (prefers-reduced-motion:reduce){.em-a-title,.em-a-sub,.em-a-item,.em-done-ic,.em-progress-fill{animation:none;}}
/* ── PC(넓은 화면): 퀵매칭처럼 가운데 카드 프레임 ── */
@media (min-width:768px){
  .em-root{max-width:none;background:#EBEEF3;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px 16px;}
  .em-page{width:100%;max-width:430px;height:min(824px,94vh);min-height:0;background:#fff;border-radius:28px;box-shadow:0 16px 50px rgba(17,24,39,.14);overflow:hidden;}
  .em-main{overflow-y:auto;}
  .em-ctawrap{padding-bottom:18px;}
  .em-cta:hover:not(:disabled){background:var(--blue-press);}
  .em-header button:hover{background:var(--divider);}
}
`;
