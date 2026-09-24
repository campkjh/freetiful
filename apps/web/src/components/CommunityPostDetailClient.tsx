"use client";

import { cfetch } from "@/lib/community/cfetch";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AlertModal from "@/components/AlertModal";
import ReportBlockMenu from "@/components/ReportBlockMenu";
import { clientCache } from "@/lib/clientCache";
import BlindNoiseCover from "@/components/BlindNoiseCover";
import { formatRelativeTime, formatExactTime } from "@/lib/relativeTime";
import { uploadCommunityImage, revokeUploadPreview } from "@/lib/communityUpload";
import { useKeyboardInset } from "@/lib/useKeyboardInset";
import TossPoll from "@/components/community/TossPoll";
import TossLikers, { type TossLiker } from "@/components/community/TossLikers";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  formatCount,
  TossHeartIcon,
  TossCommentIcon,
  TossRepostIcon,
  TossShareIcon,
  DotsIcon,
  BackIcon,
  SmallHeartIcon,
} from "@/components/community/TossIcons";

// Android WebView often returns gallery files with an empty/generic MIME type,
// so fall back to the file extension (same logic as the write form).
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)$/i;
function isImageFile(file: File) {
  if (file.type && file.type !== "application/octet-stream") {
    return file.type.startsWith("image/");
  }
  return IMAGE_EXT_RE.test(file.name || "");
}

interface CommunityTag {
  id: string;
  name: string;
  slug: string;
}

interface CommunityComment {
  id: string;
  parentId: string | null;
  /** 신고·차단 대상 판별용 — API(mapComment)는 예전부터 내려주고 있었다. */
  userId?: string | null;
  nickname: string;
  avatar?: string | null;
  authorTier?: string;
  authorIsAnswerKing?: boolean;
  authorIsPickKing?: boolean;
  content: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  replies: CommunityComment[];
  // 토스형 댓글 표시용
  authorRole?: string | null;
  authorBadges?: { key: string; label: string; tone: string }[];
  isPostAuthor?: boolean;
  isEdited?: boolean;
  isActive?: boolean;
  isBlocked?: boolean;
}

// 댓글 정렬(백엔드 CommentSort 키와 일치).
const COMMENT_SORTS = [
  { key: "newest", label: "최신순" },
  { key: "oldest", label: "오래된순" },
  { key: "popular", label: "인기순" },
  { key: "recommended", label: "추천순" },
] as const;
type CommentSortKey = (typeof COMMENT_SORTS)[number]["key"];
interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface CommunityPoll {
  options: PollOption[];
  totalVotes: number;
  myOptionId: string | null;
}

interface CommunityQuizQuestion {
  id: string;
  text: string;
  myAnswer: boolean | null;
  correctAnswer: boolean | null;
  oCount: number;
  xCount: number;
}

interface CommunityQuiz {
  questions: CommunityQuizQuestion[];
  solvedCount: number;
  correctCount: number;
  participantCount: number;
}

interface CommunityPostDetail {
  id: string;
  userId: string | null;
  nickname: string;
  avatar?: string | null;
  authorTier?: string;
  authorIsAnswerKing?: boolean;
  authorIsPickKing?: boolean;
  groupName: string;
  groupSlug?: string;
  title: string;
  content: string;
  type: string;
  isBlinded: boolean;
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  reactionCounts: Record<string, number>;
  myReaction: string | null;
  poll: CommunityPoll | null;
  quiz: CommunityQuiz | null;
  imageUrls: string[];
  tags: CommunityTag[];
  pinnedCommentId?: string | null;
  // 토스형 작성자 정보
  authorRole?: string | null;
  authorBadges?: { key: string; label: string; tone: string }[];
  authorFollowerCount?: number;
  authorIsFollowing?: boolean;
  isMine?: boolean;
  isEdited?: boolean;
  likers?: TossLiker[];
}

// O / X 는 글자가 아니라 도형으로 그린다(목록 카드와 같은 모양).
function OXMark({ o, size = 22 }: { o: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "block" }}>
      {o ? (
        <circle cx="12" cy="12" r="7.6" stroke="currentColor" strokeWidth="3.2" />
      ) : (
        <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
          <line x1="6.2" y1="6.2" x2="17.8" y2="17.8" />
          <line x1="17.8" y1="6.2" x2="6.2" y2="17.8" />
        </g>
      )}
    </svg>
  );
}

interface CommunityPostDetailClientProps {
  postId: string;
}

export default function CommunityPostDetailClient({ postId }: CommunityPostDetailClientProps) {
  const router = useRouter();
  const [post, setPost] = useState<CommunityPostDetail | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [replyTargetId, setReplyTargetId] = useState("");
  const [revealBlind, setRevealBlind] = useState(false);
  const [quizBusy, setQuizBusy] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // 어떤 계정으로 쓰는지 보이도록 댓글 입력 위에 내 프로필을 띄운다.
  const [me, setMe] = useState<{ nickname: string; avatar: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  // 투표 선택지 편집: id 있으면 기존 항목(표 유지), 없으면 새 항목.
  const [editPoll, setEditPoll] = useState<{ id: string | null; text: string }[]>([]);
  // 이번 편집에서 새로 올린 이미지의 로컬 프리뷰(서버 URL → objectURL).
  // 기존 이미지는 File 이 없으므로 여기 없고, 그때는 서버 URL 로 폴백한다.
  const [editPreviews, setEditPreviews] = useState<Record<string, string>>({});
  const [uploadingEdit, setUploadingEdit] = useState(false);
  // 언마운트 시 남은 프리뷰 objectURL 해제(WebView 메모리 누수 방지).
  const editPreviewsRef = useRef<Record<string, string>>({});
  editPreviewsRef.current = editPreviews;
  useEffect(
    () => () => {
      Object.values(editPreviewsRef.current).forEach(revokeUploadPreview);
    },
    []
  );
  const [actionBusy, setActionBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // 관리자 댓글 관리(수정/삭제)
  const [editingCommentId, setEditingCommentId] = useState("");
  const [editCommentContent, setEditCommentContent] = useState("");
  const [commentActionBusy, setCommentActionBusy] = useState(false);
  const [deleteCommentId, setDeleteCommentId] = useState("");
  const [pinBusy, setPinBusy] = useState(false);

  const [commentSort, setCommentSort] = useState<CommentSortKey>("popular");

  const loadDetail = useCallback(async (track = false) => {
    setLoading(true);
    try {
      // track=true 일 때만 조회수 +1 (최초 진입). 댓글/좋아요 후 재조회는 증가 안 함.
      const url = `/api/community/posts/${encodeURIComponent(postId)}${track ? "?track=1" : ""}`;
      const response = await cfetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "게시글을 불러오지 못했습니다.");
      setPost(data.post);
      setComments(data.comments || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  // 정렬만 바꿀 땐 댓글만 다시 받아 화면 전체 로딩 없이 갱신(조회수도 안 올림).
  async function changeCommentSort(s: CommentSortKey) {
    setCommentSort(s);
    try {
      const res = await cfetch(`/api/community/posts/${encodeURIComponent(postId)}?sort=${s}`);
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
    } catch {
      /* 실패해도 기존 목록 유지 */
    }
  }

  useEffect(() => {
    loadDetail(true);
  }, [loadDetail]);

  useEffect(() => {
    cfetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setCurrentUserId(d?.user?.id ?? null);
        setIsAdmin(d?.user?.role === "admin");
        setMe(d?.user ? { nickname: d.user.nickname ?? "나", avatar: d.user.avatar ?? null } : null);
      })
      .catch(() => {
        setCurrentUserId(null);
        setIsAdmin(false);
        setMe(null);
      });
  }, []);

  function startEdit() {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditImages([...post.imageUrls]);
    setEditPoll(
      post.type === "poll" && post.poll
        ? post.poll.options.map((o) => ({ id: o.id, text: o.text }))
        : []
    );
    setEditing(true);
  }

  async function uploadEditImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (editImages.length + files.length > 5) {
      setMessage("이미지는 최대 5장까지 올릴 수 있습니다.");
      return;
    }
    setUploadingEdit(true);
    setMessage("");
    try {
      const next: string[] = [];
      const previews: Record<string, string> = {};
      for (const file of files) {
        if (!isImageFile(file)) throw new Error("이미지 파일만 업로드할 수 있습니다.");
        if (file.size > 10 * 1024 * 1024) throw new Error("이미지는 10MB 이하만 업로드할 수 있습니다.");
        // 축소 → 업로드. 프리뷰는 로컬 파일로 그려 방금 올린 이미지를 되받지 않는다.
        const uploaded = await uploadCommunityImage(file);
        next.push(uploaded.url);
        previews[uploaded.url] = uploaded.previewUrl;
      }
      setEditImages((cur) => [...cur, ...next]);
      setEditPreviews((cur) => ({ ...cur, ...previews }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setUploadingEdit(false);
    }
  }

  function removeEditImage(url: string) {
    setEditImages((cur) => cur.filter((u) => u !== url));
    setEditPreviews((cur) => {
      if (!cur[url]) return cur;
      revokeUploadPreview(cur[url]);
      const next = { ...cur };
      delete next[url];
      return next;
    });
  }

  async function saveEdit() {
    if (!post) return;
    const t = editTitle.trim();
    const c = editContent.trim();
    if (!t || !c) {
      setMessage("제목과 내용을 입력해주세요.");
      return;
    }
    const isPoll = post.type === "poll";
    const trimmedPoll = editPoll
      .map((o) => ({ id: o.id, text: o.text.trim() }))
      .filter((o) => o.text.length > 0);
    if (isPoll && trimmedPoll.length < 2) {
      setMessage("투표 선택지는 2개 이상 입력해주세요.");
      return;
    }
    setActionBusy(true);
    setMessage("");
    try {
      const response = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          content: c,
          imageUrls: editImages,
          ...(isPoll ? { pollOptions: trimmedPoll } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "수정에 실패했습니다.");
      setEditing(false);
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수정에 실패했습니다.");
    } finally {
      setActionBusy(false);
    }
  }

  async function doDelete() {
    if (!post) return;
    setShowDeleteConfirm(false);
    setActionBusy(true);
    setMessage("");
    try {
      const response = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "삭제에 실패했습니다.");
      // 삭제된 글이 목록에서 사라지도록 캐시 무효화.
      clientCache.clearPrefix("community-");
      router.push("/community");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "삭제에 실패했습니다.");
      setActionBusy(false);
    }
  }


  async function react(type: string) {
    if (!post) return;
    const auth = useAuthStore.getState();
    if (!auth.accessToken || !auth.user) {
      window.dispatchEvent(new Event("freetiful:show-login"));
      showToast("로그인하면 좋아요를 누를 수 있어요");
      return;
    }
    const before = post;
    const nextType = post.myReaction === type ? null : type;
    const meLiker = { userId: auth.user.id, nickname: auth.user.name || "나", avatar: auth.user.profileImageUrl || null };
    // 낙관적 갱신 — 내 프사가 겹침 스택에 바로 붙는다.
    setPost({
      ...post,
      myReaction: nextType,
      likeCount: Math.max(0, post.likeCount + (nextType && !post.myReaction ? 1 : !nextType && post.myReaction ? -1 : 0)),
      likers: nextType
        ? [meLiker, ...(post.likers || []).filter((l) => l.userId !== meLiker.userId)].slice(0, 5)
        : (post.likers || []).filter((l) => l.userId !== meLiker.userId),
    });
    try {
      const response = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nextType }),
      });
      if (response.status === 401) {
        setPost(before);
        window.dispatchEvent(new Event("freetiful:show-login"));
        showToast("로그인하면 좋아요를 누를 수 있어요");
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || data?.error || "좋아요를 처리하지 못했어요");
      setPost((cur) =>
        cur
          ? {
              ...cur,
              myReaction: data.myReaction ?? null,
              reactionCounts: data.counts || {},
              likeCount: data.total ?? 0,
              likers: Array.isArray(data.likers) ? data.likers : cur.likers,
            }
          : cur
      );
      clientCache.clearPrefix("community-posts");
    } catch (error) {
      setPost(before);
      showToast(error instanceof Error ? error.message : "좋아요를 처리하지 못했어요");
    }
  }

  // OX 퀴즈 — 문제 하나를 풀면 서버가 갱신된 결과를 돌려준다(한 번 고르면 변경 불가).
  async function answerQuiz(questionId: string, answer: boolean) {
    if (!post || quizBusy) return;
    setQuizBusy(questionId);
    setMessage("");
    try {
      const response = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}/quiz`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, answer }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "퀴즈를 처리하지 못했습니다.");
      setPost({ ...post, quiz: data.quiz });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "퀴즈를 처리하지 못했습니다.");
    } finally {
      setQuizBusy(null);
    }
  }

  // 투표 — 화면 반영은 TossPoll 이 낙관적으로 먼저 하고, 여기선 서버 결과를 돌려준다(실패는 throw → 되돌림).
  async function votePoll(optionId: string) {
    if (!post) return null;
    const response = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    if (response.status === 401) {
      window.dispatchEvent(new Event("freetiful:show-login"));
      showToast("로그인하면 투표할 수 있어요");
      throw new Error("login required");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.poll) {
      showToast(data?.message || data?.error || "투표를 처리하지 못했어요");
      throw new Error("vote failed");
    }
    setPost((cur) => (cur ? { ...cur, poll: data.poll } : cur));
    return data.poll as CommunityPoll;
  }

  async function toggleCommentLike(commentId: string) {
    setMessage("");
    try {
      const response = await cfetch(`/api/community/comments/${encodeURIComponent(commentId)}/like`, {
        method: "POST",
        credentials: "include",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "댓글 공감을 처리하지 못했습니다.");
      setComments((current) =>
        updateComment(current, commentId, (item) => ({
          ...item,
          likedByMe: data.liked,
          likeCount: data.likeCount,
        }))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글 공감을 처리하지 못했습니다.");
    }
  }

  // 관리자: 댓글 수정 저장
  async function submitCommentEdit(commentId: string) {
    const content = editCommentContent.trim();
    if (!content || commentActionBusy) return;
    setCommentActionBusy(true);
    setMessage("");
    try {
      const response = await cfetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "댓글을 수정하지 못했습니다.");
      setEditingCommentId("");
      setEditCommentContent("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글을 수정하지 못했습니다.");
    } finally {
      setCommentActionBusy(false);
    }
  }

  // 글쓴이(또는 관리자)가 댓글을 상단 고정 / 해제. 글당 1개만 고정된다.
  async function togglePinComment(commentId: string) {
    if (!post || pinBusy) return;
    const next = post.pinnedCommentId === commentId ? null : commentId;
    setPinBusy(true);
    setMessage("");
    try {
      const response = await cfetch(`/api/community/posts/${encodeURIComponent(post.id)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commentId: next }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "댓글 고정을 처리하지 못했습니다.");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글 고정을 처리하지 못했습니다.");
    } finally {
      setPinBusy(false);
    }
  }

  // 관리자: 댓글 삭제(대댓글 포함 영구 삭제)
  async function doDeleteComment() {
    if (!deleteCommentId || commentActionBusy) return;
    setCommentActionBusy(true);
    setMessage("");
    try {
      const response = await cfetch(`/api/community/comments/${encodeURIComponent(deleteCommentId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "댓글을 삭제하지 못했습니다.");
      setDeleteCommentId("");
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "댓글을 삭제하지 못했습니다.");
    } finally {
      setCommentActionBusy(false);
    }
  }

  // ── 토스형 상세: 팔로우·공유·더보기·하단 댓글바 ──
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(0);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  // 안드로이드 WebView 는 키보드가 떠도 레이아웃 뷰포트가 안 줄어 하단 바가 가려진다 → 겹친 만큼 올린다.
  const kbMeasureRef = useRef<HTMLDivElement | null>(null);
  const keyboardInset = useKeyboardInset(inputFocused, kbMeasureRef);
  const tossTime = (d: string) => formatRelativeTime(d).replace(/ 전$/, "");

  function showToast(text: string) {
    setToast(text);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 1800);
  }

  async function toggleFollow() {
    if (!post?.userId) return;
    const prev = post;
    const next = !post.authorIsFollowing;
    setPost({
      ...post,
      authorIsFollowing: next,
      authorFollowerCount: Math.max(0, (post.authorFollowerCount || 0) + (next ? 1 : -1)),
    });
    try {
      const res = await cfetch("/api/community/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: post.userId }),
      });
      if (res.status === 401) {
        setPost(prev);
        window.dispatchEvent(new Event("freetiful:show-login"));
        showToast("로그인하면 팔로우할 수 있어요");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "팔로우하지 못했어요");
      setPost((cur) =>
        cur ? { ...cur, authorIsFollowing: data.following, authorFollowerCount: data.followerCount } : cur,
      );
      clientCache.clearPrefix("community-posts");
    } catch (error) {
      setPost(prev);
      showToast(error instanceof Error ? error.message : "팔로우하지 못했어요");
    }
  }

  const postUrl = () => `${window.location.origin}/community/${postId}`;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(postUrl());
      showToast("링크를 복사했어요");
    } catch {
      showToast("링크를 복사하지 못했어요");
    }
  }
  async function sharePost() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: post?.title ?? "프리티풀 커뮤니티", url: postUrl() });
      } catch {
        /* 사용자가 취소 */
      }
      return;
    }
    copyLink();
  }

  // 하단 댓글바 — 답글 대상이 있으면 답글로, 없으면 댓글로 등록.
  const replyTarget = replyTargetId ? findComment(comments, replyTargetId) : null;
  async function submitBottom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = comment.trim();
    if (!content || commentPosting) return;
    setCommentPosting(true);
    setMessage("");
    try {
      const res = await cfetch(`/api/community/posts/${encodeURIComponent(postId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replyTargetId ? { content, parentId: replyTargetId } : { content }),
      });
      if (res.status === 401) {
        window.dispatchEvent(new Event("freetiful:show-login"));
        showToast("로그인하면 댓글을 남길 수 있어요");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "댓글을 저장하지 못했어요");
      setComment("");
      setReplyTargetId("");
      if (inputRef.current) inputRef.current.style.height = "";
      await loadDetail();
      clientCache.clearPrefix("community-posts");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "댓글을 저장하지 못했어요");
    } finally {
      setCommentPosting(false);
    }
  }
  function startReply(target: CommunityComment) {
    setReplyTargetId(target.id);
    inputRef.current?.focus();
  }
  function focusComment() {
    setReplyTargetId("");
    inputRef.current?.focus();
  }

  const isOwner = !!post?.userId && currentUserId === post?.userId;
  const canModerate = !!post && (isOwner || isAdmin);
  const body = post
    ? post.content.trim()
      ? post.content.startsWith(post.title)
        ? post.content
        : `${post.title}\n\n${post.content}`
      : ""
    : "";
  const badge = post?.authorBadges?.[0];
  const commentTab = commentSort === "newest" || commentSort === "oldest" ? "newest" : "popular";

  return (
    <main className="tdet-page">
      <div ref={kbMeasureRef} className="tdet-kb-measure" aria-hidden="true" />
      <header className="tdet-topbar">
        <button
          type="button"
          className="tdet-icon-btn tdet-back"
          aria-label="커뮤니티 목록으로"
          onClick={() => router.push("/community")}
        >
          <BackIcon />
        </button>
        <span className="tdet-topbar-title">{post?.groupName ?? ""}</span>
        <div className="tdet-topbar-actions">
          {post && (
            <button type="button" className="tdet-icon-btn" aria-label="공유" onClick={sharePost}>
              <TossShareIcon />
            </button>
          )}
          {post && canModerate ? (
            <div className="tdet-menu-wrap">
              <button
                type="button"
                className="tdet-icon-btn"
                aria-label="더보기"
                aria-haspopup="menu"
                aria-expanded={ownerMenuOpen}
                onClick={() => setOwnerMenuOpen((v) => !v)}
              >
                <DotsIcon />
              </button>
              {ownerMenuOpen && (
                <>
                  <div className="tfeed-backdrop" onClick={() => setOwnerMenuOpen(false)} />
                  <div className="tfeed-sort-menu tdet-owner-menu" role="menu">
                    {isAdmin && !isOwner && <div className="tdet-menu-note">관리자 권한</div>}
                    <button
                      type="button"
                      role="menuitem"
                      className="tfeed-sort-item"
                      onClick={() => {
                        setOwnerMenuOpen(false);
                        startEdit();
                      }}
                    >
                      수정하기
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="tfeed-sort-item tdet-danger"
                      onClick={() => {
                        setOwnerMenuOpen(false);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      삭제하기
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : post ? (
            <span className="tdet-report">
              <ReportBlockMenu
                targetType="post"
                postId={post.id}
                targetUserId={post.userId}
                targetNickname={post.nickname}
                currentUserId={currentUserId}
                onBlocked={() => router.push("/community")}
                variant="dots"
              />
            </span>
          ) : null}
        </div>
      </header>

      <div className="tdet-shell">
        {message && <div className="tdet-message">{message}</div>}

        {loading && !post ? (
          <div className="tdet-state">게시글을 불러오는 중...</div>
        ) : post ? (
          <>
            <article className="tdet-post">
              <div className="tdet-author">
                <div className="tdet-ava-col">
                  <div className="tcard-ava" aria-hidden="true">
                    {post.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.avatar} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <span>{post.nickname.slice(0, 1)}</span>
                    )}
                  </div>
                  {post.authorRole && <span className="tcard-role">{post.authorRole}</span>}
                </div>
                <div className="tdet-who">
                  <div className="tcard-name-row">
                    <span className="tcard-name">{post.nickname}</span>
                    {badge && <span className={`tcard-badge tone-${badge.tone}`}>{badge.label}</span>}
                  </div>
                  <div className="tcard-meta">
                    <span title={formatExactTime(post.createdAt)}>
                      {tossTime(post.createdAt)}
                      {post.isEdited ? " (수정됨)" : ""}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>팔로워 {(post.authorFollowerCount || 0).toLocaleString("ko-KR")}</span>
                  </div>
                </div>
                {!post.isMine && post.userId && (
                  <button
                    type="button"
                    className={`tcard-follow${post.authorIsFollowing ? " is-on" : ""}`}
                    onClick={toggleFollow}
                  >
                    {post.authorIsFollowing ? "팔로잉" : "팔로우"}
                  </button>
                )}
              </div>

              {editing ? (
                <div style={{ display: "grid", gap: 10, margin: "12px 0" }}>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="제목"
                    style={inputStyle}
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="내용"
                    rows={6}
                    style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                  />
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2c)" }}>이미지</span>
                      <label style={{ ...ownerBtnStyle(false), position: "relative", overflow: "hidden", display: "inline-flex", alignItems: "center" }}>
                        {uploadingEdit ? "업로드 중..." : "이미지 추가"}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={uploadEditImages}
                          disabled={uploadingEdit || editImages.length >= 5}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        />
                      </label>
                    </div>
                    {editImages.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {editImages.map((url) => (
                          <div key={url} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid var(--c-bg-muted-6)", background: "var(--c-bg-soft)" }}>
                            <img
                              src={editPreviews[url] ?? url}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            />
                            <button
                              type="button"
                              onClick={() => removeEditImage(url)}
                              aria-label="이미지 삭제"
                              style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 999, border: "none", background: "rgba(17,24,39,0.78)", color: "#fff", fontSize: 16, lineHeight: "26px", cursor: "pointer" }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {post.type === "poll" && (
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-text-2c)" }}>투표 선택지</span>
                        {editPoll.length < 4 && (
                          <button
                            type="button"
                            onClick={() => setEditPoll((cur) => [...cur, { id: null, text: "" }])}
                            style={ownerBtnStyle(false)}
                          >
                            선택지 추가
                          </button>
                        )}
                      </div>
                      {editPoll.map((opt, index) => (
                        <div key={opt.id ?? `new-${index}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            value={opt.text}
                            onChange={(e) =>
                              setEditPoll((cur) => cur.map((o, i) => (i === index ? { ...o, text: e.target.value } : o)))
                            }
                            placeholder={`선택지 ${index + 1}`}
                            maxLength={80}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          {editPoll.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setEditPoll((cur) => cur.filter((_, i) => i !== index))}
                              aria-label="선택지 삭제"
                              style={{
                                flexShrink: 0,
                                width: 40,
                                height: 40,
                                borderRadius: 8,
                                border: "1px solid var(--c-border)",
                                background: "var(--c-bg)",
                                color: "var(--c-text-3)",
                                cursor: "pointer",
                                fontSize: 20,
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <span style={{ fontSize: 12, color: "var(--c-text-4)", fontWeight: 500 }}>
                        선택지를 삭제하면 그 선택지에 담긴 표도 함께 사라집니다.
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={saveEdit} disabled={actionBusy || uploadingEdit} style={ownerBtnStyle(true)}>
                      저장
                    </button>
                    <button type="button" onClick={() => setEditing(false)} disabled={actionBusy} style={ownerBtnStyle(false)}>
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {body && <p className="tdet-body">{body}</p>}

                  {post.imageUrls.length > 0 && (
                    <div className="tdet-images">
                      {post.imageUrls.map((imageUrl, index) => (
                        <div key={imageUrl} className="tdet-image">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imageUrl}
                            alt={`${post.title} 이미지 ${index + 1}`}
                            loading={index === 0 ? "eager" : "lazy"}
                            decoding="async"
                            style={post.isBlinded && !revealBlind ? { filter: "blur(24px)", transform: "scale(1.04)" } : undefined}
                          />
                          {post.isBlinded && !revealBlind && index === 0 && (
                            <BlindNoiseCover onReveal={() => setRevealBlind(true)} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="tdet-extras">
              {post.quiz && post.quiz.questions.length > 0 && (
                <div style={{ display: "grid", gap: 10 }}>
                  {post.quiz.questions.map((q) => {
                    const solved = q.myAnswer !== null;
                    const correct = solved && q.myAnswer === q.correctAnswer;
                    const answers = q.oCount + q.xCount;
                    return (
                      <div key={q.id} style={{ display: "grid", gap: 9, padding: "2px 0" }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--c-text)", lineHeight: 1.5 }}>
                          {q.text}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          {([true, false] as const).map((val) => {
                            const picked = q.myAnswer === val;
                            const isAnswer = solved && q.correctAnswer === val;
                            return (
                              <button
                                key={String(val)}
                                type="button"
                                disabled={solved || quizBusy === q.id}
                                onClick={() => answerQuiz(q.id, val)}
                                style={{
                                  // O / X 칸은 정사각(1:1)
                                  width: 48,
                                  height: 48,
                                  borderRadius: 14,
                                  border: "none",
                                  boxShadow: isAnswer
                                    ? `inset 0 0 0 2px ${val ? "var(--c-quiz-o-line)" : "var(--c-quiz-x-line)"}`
                                    : "none",
                                  background: val ? "var(--c-quiz-o-soft)" : "var(--c-quiz-x-soft)",
                                  color: val ? "var(--c-quiz-o)" : "var(--c-quiz-x)",
                                  opacity: solved && !isAnswer ? (picked ? 0.55 : 0.32) : 1,
                                  fontSize: 18,
                                  fontWeight: 700,
                                  cursor: solved ? "default" : "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <OXMark o={val} size={22} />
                              </button>
                            );
                          })}
                          {solved ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700 }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: correct ? "var(--c-quiz-o)" : "var(--c-quiz-x)" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={correct ? "/icons/emoji/quiz-correct.svg" : "/icons/emoji/quiz-wrong.svg"}
                                  alt=""
                                  width={18}
                                  height={18}
                                  style={{ display: "block" }}
                                />
                                {correct ? "정답!" : "오답"}
                              </span>
                              <span style={{ color: "var(--c-text-4)", fontWeight: 600 }}>
                                O {answers > 0 ? Math.round((q.oCount / answers) * 100) : 0}% · X {answers > 0 ? Math.round((q.xCount / answers) * 100) : 0}%
                              </span>
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--c-text-4)", fontWeight: 600 }}>O 또는 X를 골라보세요</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <span style={{ color: "var(--c-text-4)", fontSize: 13 }}>
                    {post.quiz.solvedCount > 0
                      ? `${post.quiz.questions.length}문제 중 ${post.quiz.solvedCount}문제 풀이 · ${post.quiz.correctCount}개 정답`
                      : `${post.quiz.questions.length}문제 · ${post.quiz.participantCount}명 참여`}
                  </span>
                </div>
              )}
              {post.poll && post.poll.options.length > 0 && (
                <TossPoll poll={post.poll} onVote={votePoll} />
              )}
                  </div>

                  {(post.groupName || post.tags.length > 0) && (
                    <div className="tcard-chips tdet-chips">
                      {post.groupName && <span className="tcard-cat">{post.groupName}</span>}
                      {post.tags.map((tag) => (
                        <span key={tag.id} className="tcard-tag">
                          #{tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="tdet-views">조회 {(post.viewCount ?? 0).toLocaleString("ko-KR")}</div>

                  <TossLikers likers={post.likers || []} count={post.likeCount || 0} />
                  <div className="tcard-actions tdet-actions">
                    <button
                      type="button"
                      className={`tcard-act${post.myReaction ? " is-liked" : ""}`}
                      aria-pressed={!!post.myReaction}
                      aria-label="좋아요"
                      onClick={() => react("heart")}
                    >
                      <TossHeartIcon filled={!!post.myReaction} />
                      <span>{formatCount(post.likeCount || 0)}</span>
                    </button>
                    <button type="button" className="tcard-act" aria-label="댓글 쓰기" onClick={focusComment}>
                      <TossCommentIcon />
                      <span>{formatCount(post.commentCount || 0)}</span>
                    </button>
                    <button type="button" className="tcard-act" aria-label="링크 복사" onClick={copyLink}>
                      <TossRepostIcon />
                    </button>
                    <button type="button" className="tcard-act" aria-label="공유" onClick={sharePost}>
                      <TossShareIcon />
                    </button>
                  </div>
                </>
              )}
            </article>

            <section className="tdet-comments" aria-label="댓글">
              <div className="tdet-comments-head">
                <h2>
                  댓글 <b>{post.commentCount}</b>
                </h2>
                {comments.length > 1 && (
                  <div className="tdet-sort" role="tablist" aria-label="댓글 정렬">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={commentTab === "popular"}
                      className={commentTab === "popular" ? "on" : ""}
                      onClick={() => changeCommentSort("popular")}
                    >
                      인기순
                    </button>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={commentTab === "newest"}
                      className={commentTab === "newest" ? "on" : ""}
                      onClick={() => changeCommentSort("newest")}
                    >
                      최신순
                    </button>
                  </div>
                )}
              </div>

              {comments.length === 0 ? (
                <div className="tdet-empty">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/toss/sleeping.svg" alt="" width={48} height={48} />
                  <p>
                    아직 댓글이 없어요
                    <br />
                    첫 댓글을 남겨보세요
                  </p>
                </div>
              ) : (
                <div className="tdet-comment-list">
                  {comments.map((item) => (
                    <CommentItem
                      key={item.id}
                      comment={item}
                      currentUserId={currentUserId}
                      isAdmin={isAdmin}
                      canPin={isAdmin || isOwner}
                      pinnedCommentId={post.pinnedCommentId ?? null}
                      pinBusy={pinBusy}
                      onTogglePin={togglePinComment}
                      editingCommentId={editingCommentId}
                      editCommentContent={editCommentContent}
                      commentActionBusy={commentActionBusy}
                      onStartEdit={(c) => {
                        setEditingCommentId(c.id);
                        setEditCommentContent(c.content);
                      }}
                      onEditChange={setEditCommentContent}
                      onCancelEdit={() => {
                        setEditingCommentId("");
                        setEditCommentContent("");
                      }}
                      onSubmitEdit={submitCommentEdit}
                      onDelete={(id) => setDeleteCommentId(id)}
                      onToggleLike={toggleCommentLike}
                      onReply={startReply}
                      onBlocked={() => loadDetail()}
                      tossTime={tossTime}
                    />
                  ))}
                </div>
              )}
            </section>

            <form
              className="tdet-inputbar"
              style={keyboardInset ? { bottom: keyboardInset } : undefined}
              onSubmit={submitBottom}
            >
              {replyTarget && (
                <div className="tdet-replying">
                  <span>
                    <b>{replyTarget.nickname}</b>님에게 답글 남기는 중
                  </span>
                  <button type="button" aria-label="답글 취소" onClick={() => setReplyTargetId("")}>
                    취소
                  </button>
                </div>
              )}
              <div className="tdet-inputrow">
                <span className="tdet-me" aria-hidden="true">
                  {me?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={me.avatar} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>{(me?.nickname ?? "나").slice(0, 1)}</span>
                  )}
                </span>
                <textarea
                  ref={inputRef}
                  value={comment}
                  rows={1}
                  onChange={(event) => {
                    setComment(event.target.value);
                    const el = event.target;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder={
                    currentUserId
                      ? replyTarget
                        ? "답글을 입력하세요"
                        : "댓글을 입력하세요"
                      : "로그인하고 댓글을 남겨보세요"
                  }
                />
                <button type="submit" className="tdet-send" disabled={commentPosting || !comment.trim()}>
                  {commentPosting ? "등록 중" : "등록"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="tdet-state">게시글을 찾을 수 없어요.</div>
        )}
      </div>

      {toast && (
        <div className="tfeed-toast" role="status">
          {toast}
        </div>
      )}

      {showDeleteConfirm && (
        <AlertModal
          title={"게시글을 삭제할까요?"}
          subtitle={"삭제하면 되돌릴 수 없어요."}
          onClose={() => setShowDeleteConfirm(false)}
          buttons={[
            { label: "삭제", bgColor: "var(--c-danger-b)", color: "#fff", onClick: doDelete },
            { label: "취소", bgColor: "var(--c-bg-muted-2)", color: "var(--c-text-2d)", onClick: () => setShowDeleteConfirm(false) },
          ]}
        />
      )}

      {deleteCommentId && (
        <AlertModal
          title={"댓글을 삭제할까요?"}
          subtitle={"삭제한 댓글은 되돌릴 수 없어요."}
          onClose={() => setDeleteCommentId("")}
          buttons={[
            { label: "삭제", bgColor: "var(--c-danger-b)", color: "#fff", onClick: doDeleteComment },
            { label: "취소", bgColor: "var(--c-bg-muted-2)", color: "var(--c-text-2d)", onClick: () => setDeleteCommentId("") },
          ]}
        />
      )}
    </main>
  );
}

interface CommentItemProps {
  comment: CommunityComment;
  depth?: number;
  currentUserId: string | null;
  isAdmin: boolean;
  /** 글쓴이(또는 관리자)만 댓글을 고정할 수 있다. 답글은 대상이 아니다. */
  canPin: boolean;
  pinnedCommentId: string | null;
  pinBusy: boolean;
  onTogglePin: (id: string) => void;
  editingCommentId: string;
  editCommentContent: string;
  commentActionBusy: boolean;
  onStartEdit: (comment: CommunityComment) => void;
  onEditChange: (value: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleLike: (id: string) => void;
  onReply: (comment: CommunityComment) => void;
  /** 차단 후 댓글 목록을 다시 불러온다. */
  onBlocked: () => void;
  tossTime: (d: string) => string;
}

// 토스형 댓글 — 아바타 · 이름(작성자/역할/배지) · 본문 · 시간·좋아요·답글 달기 · 더보기
function CommentItem(props: CommentItemProps) {
  const { comment: c, depth = 0 } = props;
  const isEditing = props.editingCommentId === c.id;
  const isOwn = !!props.currentUserId && c.userId === props.currentUserId;
  const dead = c.isActive === false || !!c.isBlocked;
  const canEdit = !dead && (isOwn || props.isAdmin);
  const isPinned = props.pinnedCommentId === c.id;
  const badge = c.authorBadges?.[0];
  return (
    <div className={`tcm${depth ? " is-reply" : ""}${isPinned ? " is-pinned" : ""}`}>
      <div className="tcm-row">
        <div className="tcm-ava" aria-hidden="true">
          {c.avatar && !dead ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.avatar} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span>{c.nickname.slice(0, 1)}</span>
          )}
        </div>
        <div className="tcm-main">
          {isPinned && (
            <div className="tcm-pin">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/pin-star.svg" alt="" width={14} height={14} />
              고정된 댓글
            </div>
          )}
          <div className="tcm-name-row">
            <span className="tcm-name">{c.nickname}</span>
            {c.isPostAuthor && <span className="tcm-writer">작성자</span>}
            {c.authorRole && <span className="tcm-role">{c.authorRole}</span>}
            {badge && <span className={`tcard-badge tone-${badge.tone} tcm-badge`}>{badge.label}</span>}
          </div>
          {isEditing ? (
            <div className="tcm-edit">
              <textarea
                value={props.editCommentContent}
                onChange={(event) => props.onEditChange(event.target.value)}
                rows={3}
              />
              <div className="tcm-edit-actions">
                <button type="button" className="tcm-act" onClick={props.onCancelEdit}>
                  취소
                </button>
                <button
                  type="button"
                  className="tcm-save"
                  onClick={() => props.onSubmitEdit(c.id)}
                  disabled={props.commentActionBusy || !props.editCommentContent.trim()}
                >
                  {props.commentActionBusy ? "저장 중" : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <p className={`tcm-text${dead ? " is-dead" : ""}`}>{c.content}</p>
          )}
          <div className="tcm-meta">
            <span title={formatExactTime(c.createdAt)}>
              {props.tossTime(c.createdAt)}
              {c.isEdited ? " (수정됨)" : ""}
            </span>
            {!dead && !isEditing && (
              <>
                <button
                  type="button"
                  className={`tcm-like${c.likedByMe ? " is-on" : ""}`}
                  aria-pressed={c.likedByMe}
                  onClick={() => props.onToggleLike(c.id)}
                >
                  <SmallHeartIcon filled={c.likedByMe} />
                  {c.likeCount > 0 ? c.likeCount : "좋아요"}
                </button>
                <button type="button" className="tcm-act" onClick={() => props.onReply(c)}>
                  답글 달기
                </button>
                {props.canPin && depth === 0 && (
                  <button
                    type="button"
                    className="tcm-act"
                    disabled={props.pinBusy}
                    onClick={() => props.onTogglePin(c.id)}
                  >
                    {isPinned ? "고정 해제" : "고정"}
                  </button>
                )}
                {canEdit && (
                  <>
                    <button type="button" className="tcm-act" onClick={() => props.onStartEdit(c)}>
                      수정
                    </button>
                    <button type="button" className="tcm-act tcm-danger" onClick={() => props.onDelete(c.id)}>
                      삭제
                    </button>
                  </>
                )}
                {!isOwn && (
                  <span className="tcm-report">
                    <ReportBlockMenu
                      targetType="comment"
                      commentId={c.id}
                      targetUserId={c.userId}
                      targetNickname={c.nickname}
                      currentUserId={props.currentUserId}
                      onBlocked={props.onBlocked}
                      compact
                    />
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {c.replies.length > 0 && (
        <div className="tcm-replies">
          {c.replies.map((reply) => (
            <CommentItem key={reply.id} {...props} comment={reply} depth={1} canPin={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function findComment(items: CommunityComment[], id: string): CommunityComment | null {
  for (const item of items) {
    if (item.id === id) return item;
    const hit = findComment(item.replies || [], id);
    if (hit) return hit;
  }
  return null;
}

function updateComment(
  items: CommunityComment[],
  commentId: string,
  updater: (comment: CommunityComment) => CommunityComment
): CommunityComment[] {
  return items.map((item) => {
    if (item.id === commentId) return updater(item);
    return { ...item, replies: updateComment(item.replies, commentId, updater) };
  });
}

const inputStyle = {
  width: "100%",
  border: "1px solid var(--c-border-strong)",
  borderRadius: 8,
  padding: "12px 13px",
  color: "var(--c-text)",
  background: "var(--c-bg)",
  fontSize: 16,
  boxSizing: "border-box",
} as const;

function ownerBtnStyle(primary: boolean) {
  return {
    border: primary ? "none" : "1px solid var(--c-border)",
    borderRadius: 999,
    background: primary ? "var(--c-inverse)" : "var(--c-bg)",
    color: primary ? "#fff" : "var(--c-text-2d)",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  } as const;
}

