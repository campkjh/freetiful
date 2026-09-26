"use client";

// /community 는 (main) 레이아웃 밖이라 'freetiful:show-login' 을 받아 줄 로그인 모달이 없다.
// 팔로우·댓글·글쓰기에서 401 이 나면 이 시트가 뜬다(앱이면 네이티브 로그인 시트 우선).
import { useEffect, useState } from "react";
import { rememberAuthReturnTo, startOAuth } from "@/lib/auth/oauth";
import { requestNativeLoginSheet } from "@/lib/auth/native-login";
import GuestLoginForm from "@/components/GuestLoginForm";

export default function CommunityLoginSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      rememberAuthReturnTo();
      if (requestNativeLoginSheet({ reason: "manual" })) return;
      setOpen(true);
    };
    window.addEventListener("freetiful:show-login", handler);
    return () => window.removeEventListener("freetiful:show-login", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="ft-scrim" onClick={() => setOpen(false)}>
      <div
        className="ft-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="로그인"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ft-grab" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="fcl-logo" src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" />
        <p className="fcl-sub">로그인하고 웨딩숲에 참여해 보세요</p>
        {/* 카카오·네이버는 브랜드 색 유지(인라인) */}
        <button
          type="button"
          className="ft-btn mb-2.5 w-full"
          style={{ background: "#FEE500", color: "#191919" }}
          onClick={() => {
            setOpen(false);
            rememberAuthReturnTo();
            startOAuth("kakao");
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z"
              fill="#191919"
            />
          </svg>
          카카오로 시작하기
        </button>
        <button
          type="button"
          className="ft-btn mb-2.5 w-full"
          style={{ background: "#03C75A", color: "#fff" }}
          onClick={() => {
            setOpen(false);
            rememberAuthReturnTo();
            startOAuth("naver");
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white" />
          </svg>
          네이버로 시작하기
        </button>
        <div className="fcl-guest">
          {/* 로그인 직후 피드·상세가 내 정보로 다시 그려지도록 새로고침한다. */}
          <GuestLoginForm onSuccess={() => window.location.reload()} />
        </div>
        <button type="button" className="ft-btn secondary mt-2 w-full" onClick={() => setOpen(false)}>
          취소
        </button>
      </div>
    </div>
  );
}
