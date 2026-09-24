"use client";

// 피드 상단 글쓰기 칸(토스 커뮤니티식). 누르면 그 자리에서 촤라락 펼쳐지며 아래 목록을 밀어낸다.
//  · 사진 첨부(최대 5장) — 공용 업로드 경로(uploadCommunityImage)
//  · 카테고리·태그는 AI 가 본문을 읽고 자동으로 채운다(POST /community/suggest). 직접 바꾸거나 뺄 수 있다.
//  · 떠 있던 '게시글 +' 버튼은 없앴다 — 글쓰기 입구는 이 칸 하나(작성 모달은 ?compose=1 딥링크로만 남음).
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { cfetch } from "@/lib/community/cfetch";
import { useAuthStore } from "@/lib/store/auth.store";
import { uploadCommunityImage, revokeUploadPreview, type CommunityUpload } from "@/lib/communityUpload";
import { clientCache } from "@/lib/clientCache";

interface GroupNode {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  tags?: { id: string; name: string; slug: string }[];
  children?: GroupNode[];
}

interface SuggestTag {
  id: string;
  name: string;
}

const MAX_IMAGES = 5;
const PLACEHOLDER = "오늘 결혼 준비 어떠세요?";
const MIN_SUGGEST_CHARS = 8;

function deriveTitle(content: string) {
  const firstLine = content.split("\n").map((s) => s.trim()).find((s) => s.length > 0) || content.trim();
  return firstLine.slice(0, 40) || "새 글";
}

function errorText(data: unknown, fallback: string) {
  const d = data as { message?: unknown; error?: unknown } | null;
  const m = Array.isArray(d?.message) ? d?.message[0] : d?.message;
  return (typeof m === "string" && m) || (typeof d?.error === "string" && d.error) || fallback;
}

export default function TossComposer({
  groups,
  contextGroupId,
  onPosted,
  onToast,
}: {
  groups: GroupNode[];
  /** 피드에서 보고 있는 카테고리 — 소분류면 기본값으로 쓴다. */
  contextGroupId?: string;
  onPosted: () => void;
  onToast?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<(CommunityUpload & { key: string })[]>([]);
  const [uploading, setUploading] = useState(0);
  const [groupId, setGroupId] = useState("");
  // context=보던 카테고리, manual=직접 고름(둘 다 AI 가 안 바꾼다), ai=AI 가 고름
  const [groupSource, setGroupSource] = useState<"" | "context" | "manual" | "ai">("");
  const [tags, setTags] = useState<SuggestTag[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedKey, setAnalyzedKey] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [me, setMe] = useState<{ name: string; avatar: string | null } | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const foldRef = useRef<HTMLDivElement | null>(null);
  const unfoldRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0);

  // 저장소(localStorage) 복원값은 클라이언트에만 있으니 마운트 뒤에 읽는다(하이드레이션 불일치 방지).
  useEffect(() => {
    setMe(authUser ? { name: authUser.name || "나", avatar: authUser.profileImageUrl || null } : null);
  }, [authUser]);

  // 접힌 쪽은 포커스·탭 이동에서 빼 둔다.
  useEffect(() => {
    foldRef.current?.toggleAttribute("inert", open);
    unfoldRef.current?.toggleAttribute("inert", !open);
  }, [open]);

  const subs = useMemo(
    () => groups.flatMap((m) => (m.children || []).map((c) => ({ id: c.id, name: c.name, majorName: m.name }))),
    [groups],
  );
  const currentSub = subs.find((s) => s.id === groupId) || null;
  const lockedGroupId = groupSource === "manual" || groupSource === "context" ? groupId : "";
  const trimmed = content.trim();

  function openComposer() {
    if (!useAuthStore.getState().accessToken) {
      window.dispatchEvent(new Event("freetiful:show-login"));
      return;
    }
    if (!groupId && contextGroupId && subs.some((s) => s.id === contextGroupId)) {
      setGroupId(contextGroupId);
      setGroupSource("context");
    }
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 180);
  }

  function collapse() {
    setOpen(false);
    setPickerOpen(false);
    setMessage("");
  }

  function reset() {
    images.forEach((i) => revokeUploadPreview(i.previewUrl));
    setImages([]);
    setContent("");
    setGroupId("");
    setGroupSource("");
    setTags([]);
    setDismissed([]);
    setAnalyzedKey("");
    setPickerOpen(false);
    setMessage("");
    if (inputRef.current) inputRef.current.style.height = "";
  }

  // AI 추천 — 본문이 바뀌고 잠시 멈추면 한 번. 직접 고른 카테고리가 있으면 그 안에서 태그만.
  async function suggest(text: string, locked: string): Promise<{ groupId: string; tags: SuggestTag[] } | null> {
    const seq = ++seqRef.current;
    setAnalyzing(true);
    try {
      const res = await cfetch("/api/community/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, groupId: locked || undefined }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const nextTags: SuggestTag[] = (data?.tags || []).filter((t: SuggestTag) => !dismissed.includes(t.id));
      if (seq === seqRef.current) {
        setAnalyzedKey(`${locked}|${text}`);
        if (!locked && data?.groupId) {
          setGroupId(data.groupId);
          setGroupSource("ai");
        }
        setTags(nextTags);
      }
      return { groupId: locked || data?.groupId || "", tags: nextTags };
    } catch {
      return null;
    } finally {
      if (seq === seqRef.current) setAnalyzing(false);
    }
  }

  useEffect(() => {
    if (!open || trimmed.length < MIN_SUGGEST_CHARS) return;
    if (analyzedKey === `${lockedGroupId}|${trimmed}`) return;
    const t = window.setTimeout(() => {
      suggest(trimmed, lockedGroupId);
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, trimmed, lockedGroupId, analyzedKey]);

  function chooseGroup(id: string) {
    setGroupId(id);
    setGroupSource("manual");
    setPickerOpen(false);
    // 대분류가 바뀌면 태그 후보도 바뀐다 → 다시 추천받게 비운다.
    setTags([]);
    setAnalyzedKey("");
    setMessage("");
  }

  function removeTag(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setDismissed((prev) => [...prev, id]);
  }

  async function onPickFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const room = MAX_IMAGES - images.length - uploading;
    const take = files.slice(0, Math.max(0, room));
    if (files.length > take.length) onToast?.(`사진은 최대 ${MAX_IMAGES}장까지 올릴 수 있어요`);
    if (!take.length) return;
    setMessage("");
    setUploading((n) => n + take.length);
    await Promise.all(
      take.map(async (file) => {
        try {
          const up = await uploadCommunityImage(file);
          setImages((prev) => [...prev, { ...up, key: `${up.url}-${Math.random().toString(36).slice(2)}` }]);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "사진을 올리지 못했어요");
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
  }

  function removeImage(key: string) {
    setImages((prev) => {
      const hit = prev.find((i) => i.key === key);
      if (hit) revokeUploadPreview(hit.previewUrl);
      return prev.filter((i) => i.key !== key);
    });
  }

  async function submit() {
    if (!trimmed || posting || uploading > 0) return;
    setPosting(true);
    setMessage("");
    try {
      let gid = groupId;
      let tagList = tags;
      if (!gid) {
        // 추천이 아직 안 왔으면 한 번 기다린다(짧은 글도 카테고리는 필요).
        const r = await suggest(trimmed, "");
        gid = r?.groupId || "";
        tagList = r?.tags || tagList;
      }
      if (!gid) {
        setPickerOpen(true);
        setMessage("카테고리를 골라주세요");
        return;
      }
      const res = await cfetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: gid,
          title: deriveTitle(trimmed),
          content: trimmed,
          tagIds: tagList.map((t) => t.id).slice(0, 5),
          imageUrls: images.map((i) => i.url),
          type: "normal",
          isBlinded: false,
          pollOptions: [],
          quizItems: [],
        }),
      });
      if (res.status === 401) {
        window.dispatchEvent(new Event("freetiful:show-login"));
        setMessage("로그인하면 글을 올릴 수 있어요");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(errorText(data, "글을 올리지 못했어요"));
      clientCache.clearPrefix("community-");
      collapse();
      // 접히는 애니메이션이 끝난 뒤 비운다(내용이 먼저 사라지면 접힘이 덜컥거린다).
      window.setTimeout(reset, 520);
      onToast?.("글을 올렸어요");
      onPosted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "글을 올리지 못했어요");
    } finally {
      setPosting(false);
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      collapse();
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  }

  const draftLine = trimmed ? trimmed.split("\n")[0] : "";
  const busyImages = images.length + uploading;

  return (
    <div className={`tcomp${open ? " is-open" : ""}`}>
      {/* 접힌 모습: 토스식 한 줄 입력 칸 */}
      <div className="tcomp-fold" ref={foldRef}>
        <div>
          <button type="button" className="tcomp-bar" onClick={openComposer} aria-label="게시글 작성하기">
            <Avatar me={me} />
            <span className={`tcomp-ph${draftLine ? " has-draft" : ""}`}>{draftLine || PLACEHOLDER}</span>
            <span className="tcomp-cta">의견 남기기</span>
          </button>
        </div>
      </div>

      {/* 펼친 모습: 작성기 */}
      <div className="tcomp-unfold" ref={unfoldRef}>
        <div>
          <div className="tcomp-editor">
            <div className="tcomp-head">
              <Avatar me={me} />
              <div className="tcomp-who">
                <span className="tcomp-name">{me?.name ?? "나"}</span>
                <button
                  type="button"
                  className={`tcomp-cat${currentSub ? " is-set" : ""}`}
                  aria-expanded={pickerOpen}
                  onClick={() => setPickerOpen((v) => !v)}
                >
                  {groupSource === "ai" && currentSub && (
                    <span className="tcomp-ai-mini" aria-label="AI 추천">
                      <AiStarSvg gradientId="tcompStarGradMini" />
                    </span>
                  )}
                  <span className="tcomp-cat-label">
                    {currentSub ? `${currentSub.majorName} · ${currentSub.name}` : analyzing ? "카테고리 찾는 중…" : "카테고리 선택"}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="tcomp-cat-caret">
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <button type="button" className="tcomp-close" aria-label="작성 칸 접기" onClick={collapse}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={`tcomp-picker${pickerOpen ? " on" : ""}`}>
              <div>
                <div className="tcomp-picker-in">
                  {groups.map((m) => (
                    <div key={m.id} className="tcomp-picker-sec">
                      <div className="tcomp-picker-h">
                        {m.icon && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/icons/community/cat/${m.icon}.svg`} alt="" width={18} height={18} />
                        )}
                        {m.name}
                      </div>
                      <div className="tcomp-picker-row">
                        {(m.children || []).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`tcomp-pick${c.id === groupId ? " on" : ""}`}
                            onClick={() => chooseGroup(c.id)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <textarea
              ref={inputRef}
              className="tcomp-input"
              value={content}
              rows={3}
              placeholder={`${PLACEHOLDER} 자유롭게 이야기를 나눠 보세요.`}
              onChange={(event) => {
                setContent(event.target.value);
                const el = event.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
              }}
              onKeyDown={onInputKeyDown}
            />

            {busyImages > 0 && (
              <div className="tcomp-images">
                {images.map((img) => (
                  <div key={img.key} className="tcomp-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl || img.url} alt={img.name} />
                    <button type="button" className="tcomp-thumb-x" aria-label="사진 빼기" onClick={() => removeImage(img.key)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ))}
                {Array.from({ length: uploading }).map((_, i) => (
                  <div key={`up-${i}`} className="tcomp-thumb is-loading" aria-label="사진 올리는 중">
                    <span className="tcomp-spin" />
                  </div>
                ))}
              </div>
            )}

            <div className="tcomp-tags" aria-live="polite">
              <span className="tcomp-tags-label">
                <AiSparkle state={analyzing ? "thinking" : analyzedKey ? "done" : "idle"} />
                AI 태그
              </span>
              {tags.map((t, i) => (
                <span key={t.id} className="tcomp-tag" style={{ animationDelay: `${120 + i * 70}ms` }}>
                  #{t.name}
                  <button type="button" aria-label={`${t.name} 태그 빼기`} onClick={() => removeTag(t.id)}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
              {analyzing ? (
                <>
                  <span className="tcomp-skel" />
                  {tags.length === 0 && <span className="tcomp-skel w2" />}
                </>
              ) : (
                tags.length === 0 && (
                  <span className="tcomp-tags-hint">
                    {trimmed.length < MIN_SUGGEST_CHARS ? "글을 쓰면 AI가 태그를 달아드려요" : "어울리는 태그가 없어요"}
                  </span>
                )
              )}
            </div>

            {message && <p className="tcomp-msg">{message}</p>}

            <div className="tcomp-foot">
              <button
                type="button"
                className="tcomp-tool"
                onClick={() => fileRef.current?.click()}
                disabled={busyImages >= MAX_IMAGES}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="9" cy="10" r="1.8" fill="currentColor" />
                  <path d="M4.5 17l4.6-4.4a1.6 1.6 0 0 1 2.2 0L15 16l1.9-1.8a1.6 1.6 0 0 1 2.2 0l1.4 1.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                사진
                <span className="tcomp-count">
                  {images.length}/{MAX_IMAGES}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
              <div className="tcomp-foot-r">
                <button type="button" className="tcomp-cancel" onClick={collapse}>
                  취소
                </button>
                <button
                  type="button"
                  className="tcomp-submit"
                  onClick={submit}
                  disabled={!trimmed || posting || uploading > 0}
                >
                  {posting ? "올리는 중" : "올리기"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ me }: { me: { name: string; avatar: string | null } | null }) {
  return (
    <span className="tcomp-ava" aria-hidden="true">
      {me?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={me.avatar} alt="" referrerPolicy="no-referrer" />
      ) : (
        <svg width="100%" height="100%" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="16" r="6.5" fill="#fff" />
          <path d="M8.5 34c1.4-6.2 6-9.5 11.5-9.5S30.1 27.8 31.5 34" fill="#fff" />
        </svg>
      )}
    </span>
  );
}

// 4각 별(오목한 변) — 삼성 갤럭시 AI 느낌의 반짝이.
const STAR_PATH =
  "M12 1.6C12.62 7.3 16.7 11.38 22.4 12C16.7 12.62 12.62 16.7 12 22.4C11.38 16.7 7.3 12.62 1.6 12C7.3 11.38 11.38 7.3 12 1.6Z";

function AiStarSvg({ gradientId, twin = false }: { gradientId: string; twin?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4B8DFF" />
          <stop offset="0.55" stopColor="#6C74FF" />
          <stop offset="1" stopColor="#9A5CF6" />
        </linearGradient>
      </defs>
      {twin && <path className="tcomp-star tcomp-star-b" d={STAR_PATH} fill={`url(#${gradientId})`} />}
      <path className="tcomp-star tcomp-star-a" d={STAR_PATH} fill={`url(#${gradientId})`} />
    </svg>
  );
}

// AI 태그 아이콘: 평소엔 별 하나(은은히 숨쉬기) → 분석 중엔 두 개로 갈라져 서로 자리를 바꾸며 돈다
// → 결과가 오면 하나로 합쳐지며 살짝 번쩍.
function AiSparkle({ state }: { state: "idle" | "thinking" | "done" }) {
  return (
    <span className={`tcomp-ai-ico is-${state}`} aria-hidden="true">
      <span className="tcomp-ai-star">
        <AiStarSvg gradientId="tcompStarGrad" twin />
      </span>
    </span>
  );
}
