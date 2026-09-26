"use client";

// 피드 상단 글쓰기 칸(토스 커뮤니티식). 누르면 그 자리에서 촤라락 펼쳐지며 아래 목록을 밀어낸다.
//  · 사진 첨부(최대 5장) — 공용 업로드 경로(uploadCommunityImage)
//  · 카테고리·태그는 AI 가 본문을 읽고 자동으로 채운다(POST /community/suggest). 직접 바꾸거나 뺄 수 있다.
//  · 떠 있던 '게시글 +' 버튼은 없앴다 — 글쓰기 입구는 이 칸 하나(작성 모달은 ?compose=1 딥링크로만 남음).
import { ChangeEvent, type CSSProperties, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { cfetch } from "@/lib/community/cfetch";
import { useAuthStore } from "@/lib/store/auth.store";
import { uploadCommunityImage, revokeUploadPreview, type CommunityUpload } from "@/lib/communityUpload";
import { clientCache } from "@/lib/clientCache";
import AiIcon from "@/components/icons/AiIcon";

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
  enterClassName = "",
  enterStyle,
}: {
  /** 웨딩숲 첫 진입 등장(퀵매칭) — 바깥 sticky 칸에 그대로 얹는다(감싸면 sticky 가 풀린다) */
  enterClassName?: string;
  enterStyle?: CSSProperties;
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
  // 투표 만들기(2~4개 항목)
  const [pollOn, setPollOn] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const pollFirstRef = useRef<HTMLInputElement | null>(null);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("");
  const [me, setMe] = useState<{ name: string; avatar: string | null } | null>(null);

  const authUser = useAuthStore((s) => s.user);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const foldRef = useRef<HTMLDivElement | null>(null);
  const unfoldRef = useRef<HTMLDivElement | null>(null);
  const seqRef = useRef(0);
  // 헤더 밑에 붙어 따라오는 칸(sticky). 붙어 있을 때만 아래로 배경색 그라데이션을 깐다.
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);

  // 저장소(localStorage) 복원값은 클라이언트에만 있으니 마운트 뒤에 읽는다(하이드레이션 불일치 방지).
  useEffect(() => {
    setMe(authUser ? { name: authUser.name || "나", avatar: authUser.profileImageUrl || null } : null);
  }, [authUser]);

  // 접힌 쪽은 포커스·탭 이동에서 빼 둔다.
  useEffect(() => {
    foldRef.current?.toggleAttribute("inert", open);
    unfoldRef.current?.toggleAttribute("inert", !open);
  }, [open]);

  // sticky 로 헤더 밑에 붙었는지 — 칸의 현재 top 이 sticky top 값과 같고 페이지가 내려가 있으면 붙은 것.
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = stickyRef.current;
      if (!el) return;
      const stickTop = parseFloat(getComputedStyle(el).top) || 0;
      const next = window.scrollY > 0 && el.getBoundingClientRect().top <= stickTop + 0.5;
      setStuck((cur) => (cur === next ? cur : next));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
    const unfold = () => {
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 180);
    };
    // 피드 중간에서 누르면(붙어 있는 상태) 맨 위로 부드럽게 올린 뒤 제자리에서 펼친다 —
    // 펼친 작성기를 화면에 고정해 두면 키보드가 올라올 때 등록 버튼이 가려질 수 있어서.
    if (stuck && window.scrollY > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      const t0 = performance.now();
      const wait = () => {
        if (window.scrollY <= 1 || performance.now() - t0 > 900) unfold();
        else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
      return;
    }
    unfold();
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
    setPollOn(false);
    setPollOptions(["", ""]);
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

  function togglePoll() {
    setPollOn((on) => {
      if (!on) window.setTimeout(() => pollFirstRef.current?.focus({ preventScroll: true }), 260);
      return !on;
    });
    setMessage("");
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
      const filledPoll = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (pollOn && filledPoll.length < 2) {
        setMessage("투표 항목을 2개 이상 입력해주세요");
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
          type: pollOn ? "poll" : "normal",
          isBlinded: false,
          pollOptions: pollOn ? filledPoll.slice(0, 4) : [],
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
    <div ref={stickyRef} className={`tcomp-sticky${stuck && !open ? " is-stuck" : ""}${open ? " is-open" : ""}${enterClassName}`} style={enterStyle}>
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
                    <AiIcon size={18} title="AI 추천" />
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

            <div className={`tcomp-poll${pollOn ? " on" : ""}`}>
              <div>
                <div className="tcomp-poll-in">
                  <div className="tcomp-poll-head">
                    <span>투표 항목</span>
                    <button type="button" onClick={() => setPollOn(false)}>
                      투표 빼기
                    </button>
                  </div>
                  {pollOptions.map((value, i) => (
                    <div key={i} className="tcomp-poll-row">
                      <input
                        ref={i === 0 ? pollFirstRef : undefined}
                        value={value}
                        maxLength={40}
                        placeholder={`항목 ${i + 1}`}
                        onChange={(event) =>
                          setPollOptions((prev) => prev.map((v, k) => (k === i ? event.target.value : v)))
                        }
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          className="tcomp-poll-x"
                          aria-label={`항목 ${i + 1} 빼기`}
                          onClick={() => setPollOptions((prev) => prev.filter((_, k) => k !== i))}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <button type="button" className="tcomp-poll-add" onClick={() => setPollOptions((prev) => [...prev, ""])}>
                      + 항목 추가
                    </button>
                  )}
                </div>
              </div>
            </div>

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
              <div className="tcomp-foot-l">
              <button
                type="button"
                className="tcomp-tool"
                onClick={() => fileRef.current?.click()}
                disabled={busyImages >= MAX_IMAGES}
              >
                {/* 사장 제공 토스 mono 아이콘(icon-picture-mono) */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M16.003 10.668C15.7647 10.6736 15.5277 10.6314 15.3059 10.5441C15.0841 10.4567 14.8821 10.3259 14.7116 10.1593C14.5411 9.99272 14.4057 9.79372 14.3132 9.57402C14.2207 9.35432 14.1732 9.11835 14.1732 8.87999C14.1733 8.64163 14.221 8.40568 14.3136 8.18604C14.4062 7.96639 14.5417 7.76747 14.7123 7.60097C14.8829 7.43448 15.085 7.30377 15.3069 7.21653C15.5287 7.1293 15.7657 7.0873 16.004 7.093C16.4708 7.10417 16.9146 7.29747 17.2407 7.63158C17.5669 7.96569 17.7494 8.4141 17.7492 8.88099C17.7491 9.34787 17.5663 9.79619 17.24 10.1301C16.9137 10.464 16.4698 10.6571 16.003 10.668ZM14.279 16.78H8.255C8.04261 16.7803 7.83407 16.7233 7.6513 16.6152C7.46853 16.507 7.31828 16.3515 7.21637 16.1652C7.11445 15.9789 7.06462 15.7685 7.07212 15.5562C7.07963 15.344 7.14418 15.1377 7.259 14.959L10.272 10.264C10.3789 10.097 10.5261 9.95955 10.7001 9.86435C10.8741 9.76916 11.0692 9.71926 11.2675 9.71926C11.4658 9.71926 11.6609 9.76916 11.8349 9.86435C12.0089 9.95955 12.1561 10.097 12.263 10.264L15.274 14.959C15.3888 15.1376 15.4533 15.3438 15.4609 15.556C15.4684 15.7682 15.4187 15.9785 15.3169 16.1648C15.2151 16.3511 15.065 16.5065 14.8823 16.6148C14.6997 16.723 14.4913 16.7801 14.279 16.78ZM19.287 2.25H4.713C4.05977 2.25 3.4333 2.50949 2.9714 2.9714C2.50949 3.4333 2.25 4.05977 2.25 4.713V19.287C2.25 19.9402 2.50949 20.5667 2.9714 21.0286C3.4333 21.4905 4.05977 21.75 4.713 21.75H19.287C19.9402 21.75 20.5667 21.4905 21.0286 21.0286C21.4905 20.5667 21.75 19.9402 21.75 19.287V4.713C21.75 4.05977 21.4905 3.4333 21.0286 2.9714C20.5667 2.50949 19.9402 2.25 19.287 2.25Z"
                    fill="#B0B8C1"
                  />
                </svg>
                사진
                <span className="tcomp-count">
                  {images.length}/{MAX_IMAGES}
                </span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFiles} />
              <button
                type="button"
                className={`tcomp-tool${pollOn ? " is-on" : ""}`}
                aria-pressed={pollOn}
                onClick={togglePoll}
              >
                {/* 사장 제공 토스 mono 아이콘(icon-graph-bar-dynamic-rotate-mono) */}
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 10.6196V13.3796C3 13.9196 3.42 14.3996 4.02 14.3996H10.56C11.1 14.3996 11.58 13.9796 11.58 13.3796V10.6196C11.58 10.0796 11.16 9.59961 10.56 9.59961H4.02C3.42 9.65961 3 10.0796 3 10.6196Z" fill={pollOn ? "#3182F6" : "#B0B8C1"} />
                  <path d="M3 4.02V6.78C3 7.32 3.42 7.8 4.02 7.8H15.3C15.84 7.8 16.32 7.38 16.32 6.78V4.02C16.32 3.48 15.9 3 15.3 3H4.02C3.42 3 3 3.42 3 4.02Z" fill={pollOn ? "#3182F6" : "#B0B8C1"} fillOpacity="0.4" />
                  <path d="M3 17.2802V20.0402C3 20.5802 3.42 21.0002 4.02 21.0002H20.04C20.58 21.0002 21.06 20.5802 21.06 19.9802V17.2202C21.06 16.6802 20.64 16.2002 20.04 16.2002H4.02C3.42 16.2602 3 16.7402 3 17.2802Z" fill={pollOn ? "#3182F6" : "#B0B8C1"} fillOpacity="0.7" />
                </svg>
                투표
              </button>
              </div>
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

// AI 태그 아이콘 = 공용 AiIcon(사장 지정 아이콘). 분석 중엔 별이 돌고, 결과가 오면 한 번 톡.
function AiSparkle({ state }: { state: "idle" | "thinking" | "done" }) {
  return (
    <span key={state} className={`inline-flex${state === "done" ? " ai-icon-pop" : ""}`} aria-hidden="true">
      <AiIcon size={24} spin={state === "thinking"} />
    </span>
  );
}
