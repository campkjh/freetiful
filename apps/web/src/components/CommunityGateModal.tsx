"use client";

import { FormEvent, useState } from "react";

interface CommunityGateModalProps {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
}

export const COMMUNITY_UNLOCK_KEY = "stady_community_unlocked";
export const COMMUNITY_PASSWORD = "1234";

export default function CommunityGateModal({ open, onClose, onUnlock }: CommunityGateModalProps) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function close() {
    setPasswordOpen(false);
    setPassword("");
    setError("");
    onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === COMMUNITY_PASSWORD) {
      sessionStorage.setItem(COMMUNITY_UNLOCK_KEY, "true");
      setPasswordOpen(false);
      setPassword("");
      setError("");
      onUnlock();
      return;
    }
    setError("암호가 올바르지 않습니다.");
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="ft-scrim"
    >
      <div className="ft-sheet">
        <div className="ft-grab" aria-hidden="true" />
        <p className="ft-title">
          준비
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            aria-label="커뮤니티 암호 입력 열기"
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "inherit",
              padding: 0,
              margin: 0,
              font: "inherit",
              lineHeight: "inherit",
              cursor: "default",
              textDecoration: "none",
              outline: "none",
            }}
          >
            중
          </button>
          입니다.
        </p>
        {passwordOpen && (
          <form onSubmit={submit} style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              placeholder="암호 입력"
              autoFocus
              className="ft-input"
            />
            {error && <span style={{ color: "var(--c-danger-c)", fontSize: 13, fontWeight: 500 }}>{error}</span>}
            <button
              type="submit"
              className="ft-btn primary"
            >
              입장
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={close}
          className="ft-btn secondary mt-6 w-full"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
