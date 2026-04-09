'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Camera, Mic, Image as ImageIcon,
  X, Copy, Reply, Trash2, MoreVertical,
  MapPin, FileText, Music, Smile, Plus, Search, Bell, BellOff,
  Flag, Pin, TextSelect, PinOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MY_ID = 'user-1';

const PROS: Record<string, { id: string; name: string; username: string; profileImageUrl: string; isActive: boolean; lastSeen?: string }> = {
  '1': { id: 'pro-1', name: '이우영', username: 'wooyoung_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=1', isActive: true },
  '2': { id: 'pro-2', name: '이승진', username: 'seungjin_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=5', isActive: false, lastSeen: '5분 전' },
  '3': { id: 'pro-3', name: '김민준', username: 'minjun_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=3', isActive: true },
  '4': { id: 'pro-4', name: '박서연', username: 'seoyeon_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=9', isActive: false, lastSeen: '1시간 전' },
  '5': { id: 'pro-5', name: '정하린', username: 'harin_singer', profileImageUrl: 'https://i.pravatar.cc/150?img=12', isActive: true },
};

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system' | 'voice';
  createdAt: string;
  isRead: boolean;
  fileName?: string;
  duration?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  replyTo?: { id: string; name: string; content: string } | null;
  reaction?: string | null;
  isNew?: boolean;
}

declare global {
  interface Window {
    naver?: any;
  }
}

// 네이버 지도 SDK 동적 로드
let naverMapsLoadingPromise: Promise<void> | null = null;
function loadNaverMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('SSR');
  if (window.naver?.maps) return Promise.resolve();
  if (naverMapsLoadingPromise) return naverMapsLoadingPromise;

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  if (!clientId) return Promise.reject('NO_KEY');

  naverMapsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject('LOAD_ERROR');
    document.head.appendChild(script);
  });
  return naverMapsLoadingPromise;
}

// 네이버 지도 위치 피커 - 사용자가 직접 위치 선택
function NaverMapPicker({ onSelect, onClose }: { onSelect: (lat: number, lng: number) => void; onClose: () => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [hasNaverKey, setHasNaverKey] = useState<boolean | null>(null);
  const naverMapInstanceRef = useRef<any>(null);
  const naverMarkerRef = useRef<any>(null);

  // 검색 입력
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    loadNaverMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.naver?.maps) return;
        setHasNaverKey(true);
        const naver = window.naver;
        const seoul = new naver.maps.LatLng(37.5665, 126.978);
        const map = new naver.maps.Map(mapRef.current, {
          center: seoul,
          zoom: 14,
          zoomControl: true,
          zoomControlOptions: { position: naver.maps.Position.TOP_RIGHT },
          mapTypeControl: false,
          logoControl: false,
          mapDataControl: false,
          scaleControl: false,
        });
        naverMapInstanceRef.current = map;

        // 클릭 시 마커 이동
        naver.maps.Event.addListener(map, 'click', (e: any) => {
          const lat = e.coord.lat();
          const lng = e.coord.lng();
          setSelected({ lat, lng });
          if (naverMarkerRef.current) {
            naverMarkerRef.current.setPosition(e.coord);
          } else {
            naverMarkerRef.current = new naver.maps.Marker({ position: e.coord, map });
          }
        });

        // 처음에 중심점 마커
        naverMarkerRef.current = new naver.maps.Marker({ position: seoul, map });
        setSelected({ lat: 37.5665, lng: 126.978 });
      })
      .catch(() => {
        if (!cancelled) setHasNaverKey(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleSearch = () => {
    if (!searchQuery.trim() || !window.naver?.maps?.Service) {
      toast.error('네이버 지오코딩 서비스를 사용할 수 없습니다');
      return;
    }
    window.naver.maps.Service.geocode({ query: searchQuery }, (status: any, response: any) => {
      if (status !== window.naver.maps.Service.Status.OK) {
        toast.error('검색 실패');
        return;
      }
      const result = response.v2.addresses[0];
      if (!result) {
        toast.error('검색 결과가 없습니다');
        return;
      }
      const lat = parseFloat(result.y);
      const lng = parseFloat(result.x);
      const point = new window.naver.maps.LatLng(lat, lng);
      naverMapInstanceRef.current?.setCenter(point);
      naverMapInstanceRef.current?.setZoom(16);
      if (naverMarkerRef.current) {
        naverMarkerRef.current.setPosition(point);
      }
      setSelected({ lat, lng });
    });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-[fadeIn_0.2s_ease]" onClick={onClose}>
      <div
        className="w-full max-w-[520px] h-[80vh] sm:h-[600px] sm:max-h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-gray-400">LOCATION</p>
            <h3 className="text-[18px] font-black text-gray-900 mt-0.5">위치 선택</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-5 pb-3 shrink-0">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center bg-gray-100 rounded-full pl-4 pr-2 h-11">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                placeholder="장소나 주소 검색"
                className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder:text-gray-400"
              />
              <button onClick={handleSearch} className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-900 flex items-center justify-center active:scale-90 transition-transform">
                <Search size={16} className="text-white" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 px-1">지도를 탭하거나 검색하여 위치를 선택하세요</p>
        </div>

        {/* 지도 */}
        <div className="flex-1 relative bg-gray-100 mx-5 rounded-2xl overflow-hidden">
          {hasNaverKey !== false && <div ref={mapRef} className="absolute inset-0" />}
          {hasNaverKey === false && (
            <div className="absolute inset-0 flex items-center justify-center text-center p-6">
              <div>
                <MapPin size={36} className="text-gray-300 mx-auto mb-2" />
                <p className="text-[13px] text-gray-500">네이버 지도 SDK 로드 실패</p>
                <p className="text-[11px] text-gray-400 mt-1">NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 환경변수를 확인해주세요</p>
              </div>
            </div>
          )}
          {hasNaverKey === null && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-[13px] text-gray-400">지도 로딩 중...</p>
            </div>
          )}
        </div>

        {/* 선택 정보 + 전송 */}
        <div className="px-5 pt-3 pb-5 shrink-0">
          {selected && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2.5 bg-blue-50 rounded-xl">
              <MapPin size={16} className="text-[#007AFF] shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-gray-900">선택한 위치</p>
                <p className="text-[11px] text-gray-500 truncate tabular-nums">{selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => {
              if (!selected) {
                toast.error('지도에서 위치를 선택해주세요');
                return;
              }
              onSelect(selected.lat, selected.lng);
              onClose();
            }}
            disabled={!selected}
            className="w-full h-12 bg-[#007AFF] hover:bg-[#0066d9] disabled:bg-gray-300 text-white text-[15px] font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <MapPin size={16} />
            이 위치 전송하기
          </button>
        </div>
      </div>
    </div>
  );
}

// 네이버 지도 미리보기 컴포넌트
function NaverMapPreview({ lat, lng, mine }: { lat: number; lng: number; mine: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [hasNaverKey, setHasNaverKey] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadNaverMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.naver?.maps) return;
        setHasNaverKey(true);
        const naver = window.naver;
        const center = new naver.maps.LatLng(lat, lng);
        const map = new naver.maps.Map(mapRef.current, {
          center,
          zoom: 16,
          draggable: false,
          pinchZoom: false,
          scrollWheel: false,
          keyboardShortcuts: false,
          disableDoubleTapZoom: true,
          disableDoubleClickZoom: true,
          disableTwoFingerTapZoom: true,
          zoomControl: false,
          mapTypeControl: false,
          logoControl: false,
          mapDataControl: false,
          scaleControl: false,
        });
        new naver.maps.Marker({ position: center, map });
      })
      .catch(() => {
        if (!cancelled) setHasNaverKey(false);
      });
    return () => { cancelled = true; };
  }, [lat, lng]);

  const naverMapUrl = `https://map.naver.com/p/?c=${lng},${lat},16,0,0,0,0`;

  return (
    <a
      href={naverMapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-[260px] rounded-2xl overflow-hidden bg-gray-100 active:scale-[0.98] transition-transform"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 지도 영역 */}
      <div className="relative w-full h-[160px] bg-gray-200">
        {hasNaverKey !== false && (
          <div ref={mapRef} className="absolute inset-0" />
        )}
        {hasNaverKey === false && (
          // Fallback: OpenStreetMap iframe
          <iframe
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.004}%2C${lat - 0.003}%2C${lng + 0.004}%2C${lat + 0.003}&layer=mapnik&marker=${lat}%2C${lng}`}
            className="absolute inset-0 w-full h-full border-0 pointer-events-none"
            loading="lazy"
          />
        )}
        {/* 마커 (네이버 SDK가 안 그릴 때 대비) */}
        {hasNaverKey === null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin size={32} className="text-[#007AFF]" />
          </div>
        )}
      </div>
      {/* 정보 영역 */}
      <div className={`px-3 py-2.5 ${mine ? 'bg-[#0066D9]' : 'bg-white'}`}>
        <div className="flex items-center gap-2">
          <MapPin size={14} className={mine ? 'text-white' : 'text-[#007AFF]'} />
          <p className={`text-[13px] font-bold ${mine ? 'text-white' : 'text-gray-900'}`}>
            내 위치
          </p>
        </div>
        <p className={`text-[11px] mt-0.5 truncate ${mine ? 'text-white/70' : 'text-gray-500'}`}>
          {lat.toFixed(5)}, {lng.toFixed(5)} · 네이버 지도에서 열기
        </p>
      </div>
    </a>
  );
}

function makeMockMessages(proId: string, proName: string): Message[] {
  const now = Date.now();
  const yesterday = now - 24 * 3600000;
  return [
    { id: 's1', senderId: 'system', content: '견적 요청으로 대화가 시작되었습니다', type: 'system', createdAt: new Date(yesterday).toISOString(), isRead: true },
    { id: 'm1', senderId: MY_ID, content: '안녕하세요! 4월 5일 결혼식 MC 문의 드립니다.', type: 'text', createdAt: new Date(yesterday + 600000).toISOString(), isRead: true },
    { id: 'm2', senderId: proId, content: '안녕하세요! 문의 감사합니다 😊\n4월 5일 토요일 맞으신가요?', type: 'text', createdAt: new Date(yesterday + 1200000).toISOString(), isRead: true },
    { id: 'm3', senderId: MY_ID, content: '네 맞습니다! 서울 강남 더시에나호텔에서 오후 2시에 시작이에요.', type: 'text', createdAt: new Date(yesterday + 1800000).toISOString(), isRead: true },
    { id: 'm4', senderId: proId, content: '좋습니다, 해당 날짜 가능합니다.\n견적서 보내드릴게요!', type: 'text', createdAt: new Date(yesterday + 2400000).toISOString(), isRead: true },
    { id: 'm5', senderId: proId, content: '웨딩 MC 패키지 견적: 50만원\n\n포함 사항:\n• 리허설 진행\n• 본식 MC\n• 피로연 진행\n\n행사일: 2026-04-05 (토)\n\n궁금하신 점 있으시면 편하게 말씀해주세요!', type: 'text', createdAt: new Date(now - 3 * 3600000).toISOString(), isRead: true },
    { id: 'm6', senderId: MY_ID, content: '감사합니다! 확인 후 결제하겠습니다.', type: 'text', createdAt: new Date(now - 2 * 3600000).toISOString(), isRead: true, replyTo: { id: 'm5', name: proName, content: '웨딩 MC 패키지 견적: 50만원' } },
    { id: 'm7', senderId: proId, content: '네, 편하게 말씀해주세요. 궁금한 점 있으시면 언제든 연락 주세요! 😊', type: 'text', createdAt: new Date(now - 1 * 3600000).toISOString(), isRead: true, reaction: '❤️' },
  ];
}

function formatDateDivider(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = d.toDateString() === new Date(now.getTime() - 86400000).toDateString();

  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) return `(오늘) ${time}`;
  if (isYesterday) return `(어제) ${time}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

function shouldShowDateDivider(messages: Message[], index: number) {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].createdAt);
  const curr = new Date(messages[index].createdAt);
  return curr.getTime() - prev.getTime() > 30 * 60 * 1000;
}

// Highlight @mentions in text
function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[\w가-힣]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="font-bold text-[#0A84FF] bg-[#0A84FF]/15 px-1 py-0.5 rounded">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const pro = PROS[roomId] || PROS['1'];

  const [messages, setMessages] = useState<Message[]>(() => makeMockMessages(pro.id, pro.name));
  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ id: string; x: number; y: number; mine: boolean } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; content: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionList] = useState([
    { id: pro.id, name: pro.name, username: pro.username },
    ...Object.values(PROS).filter((p) => p.id !== pro.id).slice(0, 4),
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [voicePlayProgress, setVoicePlayProgress] = useState<Record<string, number>>({});
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; name: string; content: string } | null>(null);
  const [partialCopyMsg, setPartialCopyMsg] = useState<Message | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartRef = useRef<number>(0);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: input.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
      replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, content: replyTo.content } : null,
      isNew: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setReplyTo(null);
    setMentionQuery(null);
    inputRef.current?.focus();

    // 새 메시지 플래그 제거
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === newMsg.id ? { ...m, isNew: false } : m));
    }, 700);
  }, [input, replyTo]);

  // 입력 변경 + 멘션 감지
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // @ 직후의 텍스트 추출
    const cursorPos = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([\w가-힣]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    if (mentionQuery === null) return;
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const newTextBefore = textBefore.replace(/@([\w가-힣]*)$/, `@${name} `);
    const newValue = newTextBefore + textAfter;
    setInput(newValue);
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursor = newTextBefore.length;
      inputRef.current?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  // 지원하는 audio mime type 자동 감지 (iOS Safari는 webm 미지원, mp4 사용)
  const getSupportedMimeType = (): string => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    for (const type of candidates) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  };

  // ─── 음성 녹음 ─────────────────────────────────────
  const startRecording = async () => {
    try {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        toast.error('이 브라우저는 녹음을 지원하지 않습니다');
        return;
      }
      if (typeof MediaRecorder === 'undefined') {
        toast.error('이 브라우저는 녹음 기능을 지원하지 않습니다');
        return;
      }
      // HTTPS 또는 localhost가 아니면 getUserMedia 차단됨
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        toast.error('보안 연결(HTTPS)에서만 녹음할 수 있습니다');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = Math.round((Date.now() - recordingStartRef.current) / 1000);
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          senderId: MY_ID,
          content: url,
          type: 'voice',
          createdAt: new Date().toISOString(),
          isRead: false,
          duration: Math.max(1, duration),
          isNew: true,
        }]);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.onerror = (e) => {
        console.error('MediaRecorder error', e);
        toast.error('녹음 중 오류가 발생했습니다');
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = mr;
      mr.start();
      recordingStartRef.current = Date.now();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 100);
    } catch (err: any) {
      console.error('startRecording error', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        toast.error('마이크 권한이 거부되었습니다');
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        toast.error('마이크를 찾을 수 없습니다');
      } else if (err?.name === 'NotReadableError') {
        toast.error('마이크가 다른 앱에서 사용 중입니다');
      } else {
        toast.error(`녹음 시작 실패: ${err?.message || '알 수 없는 오류'}`);
      }
    }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (cancel) {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = () => {
          mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
        };
      }
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const togglePlayVoice = (msgId: string, url: string) => {
    // 다른 음성 재생 중이면 멈춤
    if (playingVoice && playingVoice !== msgId) {
      const prevAudio = audioRefs.current[playingVoice];
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      }
    }

    let audio = audioRefs.current[msgId];
    if (!audio) {
      audio = new Audio(url);
      audioRefs.current[msgId] = audio;
      audio.ontimeupdate = () => {
        if (audio.duration && isFinite(audio.duration)) {
          setVoicePlayProgress((p) => ({ ...p, [msgId]: audio.currentTime / audio.duration }));
        }
      };
      audio.onended = () => {
        setPlayingVoice(null);
        setVoicePlayProgress((p) => ({ ...p, [msgId]: 0 }));
        audio.currentTime = 0;
      };
    }

    if (playingVoice === msgId) {
      audio.pause();
      setPlayingVoice(null);
    } else {
      audio.play().catch((e) => {
        toast.error('재생할 수 없습니다');
        console.error(e);
      });
      setPlayingVoice(msgId);
    }
  };

  const formatVoiceDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleImageSend = (file: File) => {
    const url = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: url,
      type: 'image',
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
    }]);
    setShowAttach(false);
  };

  const handleFileSend = (file: File) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: file.name,
      type: 'file',
      createdAt: new Date().toISOString(),
      isRead: false,
      fileName: file.name,
      isNew: true,
    }]);
    setShowAttach(false);
    toast.success(`${file.name} 전송 완료`);
  };

  const sendLocationMessage = (lat: number, lng: number) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: '내 위치를 공유했습니다',
      type: 'location',
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
      latitude: lat,
      longitude: lng,
    }]);
    toast.success('위치 전송 완료');
  };

  const handleLocationSend = () => {
    setShowAttach(false);
    if (!('geolocation' in navigator)) {
      // 바로 지도 피커 열기
      setShowLocationPicker(true);
      return;
    }
    const loadingToast = toast.loading('위치 가져오는 중...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(loadingToast);
        const { latitude, longitude } = pos.coords;
        sendLocationMessage(latitude, longitude);
      },
      (err) => {
        toast.dismiss(loadingToast);
        // 권한 거부/실패 시 지도 피커로 fallback
        if (err.code === err.PERMISSION_DENIED) {
          toast('지도에서 위치를 선택해주세요', { icon: '📍' });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast('지도에서 위치를 선택해주세요', { icon: '📍' });
        } else if (err.code === err.TIMEOUT) {
          toast('지도에서 위치를 선택해주세요', { icon: '📍' });
        }
        setShowLocationPicker(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('복사됨');
    setActionMenu(null);
  };

  const handleReply = (msg: Message) => {
    setReplyTo({ id: msg.id, name: msg.senderId === MY_ID ? '나' : pro.name, content: msg.content });
    setActionMenu(null);
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setActionMenu(null);
  };

  const handleReport = (msg: Message) => {
    setActionMenu(null);
    if (confirm('이 메시지를 신고하시겠습니까?')) {
      toast.success('신고가 접수되었습니다');
    }
  };

  const handlePin = (msg: Message) => {
    if (msg.type !== 'text') {
      toast.error('텍스트 메시지만 공지로 등록할 수 있습니다');
      setActionMenu(null);
      return;
    }
    setPinnedMessage({
      id: msg.id,
      name: msg.senderId === MY_ID ? '나' : pro.name,
      content: msg.content,
    });
    setActionMenu(null);
    toast.success('공지로 등록되었습니다');
  };

  const handlePartialCopy = (msg: Message) => {
    if (msg.type !== 'text') {
      toast.error('텍스트 메시지만 부분복사할 수 있습니다');
      setActionMenu(null);
      return;
    }
    setPartialCopyMsg(msg);
    setActionMenu(null);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m
    ));
    setActionMenu(null);
  };

  // 길게 누르기 - 액션 메뉴 표시
  const handleLongPressStart = (e: React.PointerEvent | React.TouchEvent, msg: Message) => {
    if (msg.type === 'system') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mine = msg.senderId === MY_ID;

    longPressTimer.current = setTimeout(() => {
      // 진동 (지원 시)
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(20); } catch {}
      }
      setActionMenu({
        id: msg.id,
        x: mine ? rect.right : rect.left,
        y: rect.top,
        mine,
      });
    }, 450);
  };

  const handleLongPressCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 답장 클릭 시 원본 메시지로 스크롤
  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-[replyHighlight_1.2s_ease-out]');
      setTimeout(() => el.classList.remove('animate-[replyHighlight_1.2s_ease-out]'), 1200);
    }
  };

  const isMine = (msg: Message) => msg.senderId === MY_ID;

  const ATTACH_ITEMS = [
    { icon: <Camera size={24} className="text-white" />, bg: 'bg-gradient-to-br from-gray-700 to-gray-900', label: '카메라', action: () => cameraInputRef.current?.click() },
    { icon: <ImageIcon size={24} className="text-white" />, bg: 'bg-gradient-to-br from-green-400 to-teal-500', label: '사진', action: () => fileInputRef.current?.click() },
    { icon: <Smile size={24} className="text-white" />, bg: 'bg-gradient-to-br from-blue-400 to-blue-600', label: '스티커', action: () => { setShowAttach(false); toast('스티커 기능 준비 중', { icon: '😊' }); } },
    { icon: <FileText size={24} className="text-white" />, bg: 'bg-gradient-to-br from-purple-400 to-purple-600', label: '파일', action: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSend(f); }; inp.click(); } },
    { icon: <MapPin size={24} className="text-white" />, bg: 'bg-gradient-to-br from-red-400 to-red-600', label: '위치', action: handleLocationSend },
    { icon: <Music size={24} className="text-white" />, bg: 'bg-gradient-to-br from-orange-400 to-red-500', label: '오디오', action: () => { setShowAttach(false); toast('오디오 기능 준비 중', { icon: '🎵' }); } },
  ];

  // 멘션 필터링된 리스트
  const filteredMentions = mentionQuery !== null
    ? mentionList.filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.username.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  return (
    <div className="relative flex flex-col h-screen bg-[#F2F2F7]">
      {/* ─── 헤더 상단 그라데이션 블러 (z-20) ─── */}
      <div
        className="absolute left-0 right-0 top-0 h-[110px] z-20 pointer-events-none"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* ─── Header (Floating Pill) z-30 ─── */}
      <div className="absolute left-0 right-0 top-0 z-30 px-3 pt-3 pb-2 pt-safe pointer-events-none">
        <div className="flex items-center gap-2 max-w-[680px] mx-auto pointer-events-auto">
          {/* 뒤로가기 (별개의 동그라미) */}
          <button
            onClick={() => router.back()}
            className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
          >
            <ChevronLeft size={24} className="text-gray-600" strokeWidth={2.5} />
          </button>

          {/* 중앙 프로필 알약 */}
          <Link
            href={`/pros/${pro.id}`}
            className="flex-1 flex items-center gap-3 bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 pl-1.5 pr-4 h-12 min-w-0 active:scale-[0.98] transition-transform hover:bg-white"
          >
            <div className="relative shrink-0">
              <img src={pro.profileImageUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
              {pro.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34C759] border-2 border-white rounded-full" />}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <p className="text-[14px] font-bold text-gray-900 truncate">{pro.name}</p>
              <p className="text-[10px] text-gray-400">
                {pro.isActive ? '온라인' : pro.lastSeen ? `${pro.lastSeen} 활동` : '오프라인'}
              </p>
            </div>
          </Link>

          {/* 메뉴 (별개의 동그라미) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center active:scale-[0.88] transition-all hover:bg-white"
            >
              <MoreVertical size={20} className="text-gray-600" />
            </button>

            {/* 헤더 드롭다운 메뉴 */}
            {showHeaderMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                <div className="absolute right-0 top-[56px] z-50 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden min-w-[180px] animate-[scaleIn_0.2s_ease-out]">
                  <button onClick={() => { toast('대화 검색 준비 중', { icon: '🔍' }); setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full">
                    <Search size={16} className="text-gray-500" /> 대화 내용 검색
                  </button>
                  <button onClick={() => { setMuted(!muted); toast(muted ? '알림 켜짐' : '알림 꺼짐'); setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
                    {muted ? <Bell size={16} className="text-gray-500" /> : <BellOff size={16} className="text-gray-500" />}
                    {muted ? '알림 켜기' : '알림 끄기'}
                  </button>
                  <Link href={`/pros/${pro.id}`} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
                    <Smile size={16} className="text-gray-500" /> 프로필 보기
                  </Link>
                  <button onClick={() => { if (confirm('대화 내용을 삭제하시겠습니까?')) { setMessages([]); toast.success('대화 삭제됨'); } setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100">
                    <Trash2 size={16} /> 대화 삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── 공지 바 ─── */}
      {pinnedMessage && (
        <button
          onClick={() => scrollToMessage(pinnedMessage.id)}
          className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-amber-50/90 backdrop-blur border-b border-amber-100 active:bg-amber-100 transition-colors animate-[slideUp_0.3s_ease]"
        >
          <Pin size={16} className="text-amber-600 shrink-0 rotate-45" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-bold text-amber-700">공지 · {pinnedMessage.name}</p>
            <p className="text-[12px] text-amber-900/80 truncate">{pinnedMessage.content}</p>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setPinnedMessage(null); toast('공지 해제됨', { icon: '📌' }); }}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-100 cursor-pointer"
          >
            <PinOff size={14} className="text-amber-600" />
          </span>
        </button>
      )}

      {/* ─── Messages ─── */}
      <div
        className="flex-1 overflow-y-auto px-3 pt-[80px] pb-[88px]"
        onClick={() => { setActionMenu(null); setShowAttach(false); }}
      >
        <div className="max-w-[680px] mx-auto">
          {messages.map((msg, i) => {
            const showDate = shouldShowDateDivider(messages, i);

            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="text-center py-3">
                  <span className="text-[12px] text-gray-400 bg-gray-200/60 px-3 py-1 rounded-full">{msg.content}</span>
                </div>
              );
            }

            const mine = isMine(msg);

            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {/* 날짜/시간 구분선 */}
                {showDate && (
                  <div className="text-center py-3">
                    <span className="text-[11px] text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                  </div>
                )}

                <div
                  className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-[6px] relative select-none`}
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="max-w-[78%] relative">
                    {/* 메시지 버블 */}
                    {msg.type === 'image' ? (
                      <div
                        className={`select-none ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <img
                          src={msg.content}
                          alt=""
                          draggable={false}
                          className="rounded-2xl max-w-[260px] max-h-[340px] object-cover cursor-pointer select-none"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
                          onClick={(e) => { e.stopPropagation(); setImagePreview(msg.content); }}
                        />
                      </div>
                    ) : msg.type === 'file' ? (
                      <div
                        className={`flex items-center gap-2 px-4 py-3 rounded-[20px] select-none ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <FileText size={18} />
                        <span className="text-[15px]">{msg.fileName || msg.content}</span>
                      </div>
                    ) : msg.type === 'location' ? (
                      <div
                        className={`select-none ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ transformOrigin: mine ? 'right bottom' : 'left bottom', WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {msg.latitude !== undefined && msg.longitude !== undefined ? (
                          <NaverMapPreview lat={msg.latitude} lng={msg.longitude} mine={mine} />
                        ) : (
                          <div className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                            <MapPin size={18} />
                            <span className="text-[15px]">{msg.content}</span>
                          </div>
                        )}
                      </div>
                    ) : msg.type === 'voice' ? (
                      <div
                        className={`flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-[20px] min-w-[180px] select-none ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900 shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePlayVoice(msg.id, msg.content); }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform ${mine ? 'bg-white/20 hover:bg-white/30' : 'bg-[#007AFF] hover:bg-[#0066d9]'}`}
                        >
                          {playingVoice === msg.id ? (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="2" width="3" height="10" rx="0.5" fill={mine ? 'white' : 'white'} /><rect x="8" y="2" width="3" height="10" rx="0.5" fill={mine ? 'white' : 'white'} /></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2L11 7L3 12V2Z" fill={mine ? 'white' : 'white'} /></svg>
                          )}
                        </button>
                        <div className="flex-1 flex items-center gap-0.5 h-7 min-w-[80px]">
                          {Array.from({ length: 22 }).map((_, i) => {
                            const progress = voicePlayProgress[msg.id] || 0;
                            const filled = i / 22 < progress;
                            const heights = [40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 50, 85, 65, 55, 70, 45, 80, 60, 50, 75, 55, 65];
                            return (
                              <div
                                key={i}
                                className="flex-1 rounded-full transition-colors"
                                style={{
                                  height: `${heights[i]}%`,
                                  backgroundColor: mine
                                    ? (filled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)')
                                    : (filled ? '#007AFF' : '#C7C7CC'),
                                }}
                              />
                            );
                          })}
                        </div>
                        <span className={`text-[12px] tabular-nums shrink-0 ${mine ? 'text-white/80' : 'text-gray-500'}`}>
                          {formatVoiceDuration(msg.duration || 0)}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`whitespace-pre-wrap text-[16px] leading-[1.4] cursor-pointer select-none overflow-hidden ${
                          mine
                            ? 'bg-[#007AFF] text-white rounded-[20px] rounded-br-[6px]'
                            : 'bg-white text-gray-900 rounded-[20px] rounded-bl-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
                        } ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''} ${actionMenu?.id === msg.id ? 'ring-2 ring-[#007AFF]/40' : ''}`}
                        style={{
                          transformOrigin: mine ? 'right bottom' : 'left bottom',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                        }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {/* 답장 - 말풍선 안에 통합 (1px 하단 구분선) */}
                        {msg.replyTo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo!.id); }}
                            className={`block w-full text-left px-4 pt-2.5 pb-2 border-b ${mine ? 'border-white/25' : 'border-gray-200'}`}
                          >
                            <p className={`text-[11px] font-bold ${mine ? 'text-white' : 'text-gray-900'}`}>
                              {msg.replyTo.name}
                            </p>
                            <p className={`text-[12px] truncate ${mine ? 'text-white/85' : 'text-gray-600'}`}>
                              {msg.replyTo.content}
                            </p>
                          </button>
                        )}
                        <div className="px-4 py-[10px]">
                          {renderTextWithMentions(msg.content)}
                        </div>
                      </div>
                    )}

                    {/* 리액션 표시 */}
                    {msg.reaction && (
                      <div className={`absolute -bottom-3 ${mine ? 'right-2' : 'left-2'} bg-white shadow-md rounded-full px-1.5 py-0.5 text-[14px] border border-gray-100 animate-[reactionPop_0.4s_cubic-bezier(0.34,1.56,0.64,1)]`}>
                        {msg.reaction}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── 액션 메뉴 (롱프레스) ─── */}
      {actionMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease]" onClick={() => setActionMenu(null)} />
          <div
            className="fixed z-50 animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              left: actionMenu.mine ? undefined : Math.max(12, actionMenu.x),
              right: actionMenu.mine ? Math.max(12, window.innerWidth - actionMenu.x) : undefined,
              top: Math.max(80, actionMenu.y - 110),
              transformOrigin: actionMenu.mine ? 'right bottom' : 'left bottom',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 리액션 픽커 */}
            <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-xl border border-gray-200/60 px-2 py-1.5 mb-2 flex items-center gap-1">
              {REACTIONS.map((r, idx) => (
                <button
                  key={r}
                  onClick={() => handleReaction(actionMenu.id, r)}
                  className="text-[24px] w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-125 transition-transform"
                  style={{ animation: `reactionFade 0.3s ease ${idx * 0.04}s both` }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* 액션 메뉴 */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden min-w-[200px]">
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleReply(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full"
              >
                답장 <Reply size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleCopy(msg.content);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                복사 <Copy size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handlePartialCopy(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                부분복사 <TextSelect size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handlePin(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                공지로 등록 <Pin size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleReport(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-orange-500 hover:bg-orange-50 w-full border-t border-gray-100"
              >
                신고하기 <Flag size={18} />
              </button>
              {actionMenu.mine && (
                <button
                  onClick={() => handleDelete(actionMenu.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100"
                >
                  삭제 <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── 답장 프리뷰 ─── */}
      {replyTo && (
        <div className="px-4 py-2.5 bg-white/90 backdrop-blur border-t border-gray-200/40 flex items-center justify-between animate-[slideUp_0.2s_ease]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-9 rounded-full bg-[#007AFF] shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#007AFF]">{replyTo.name}에게 답장</p>
              <p className="text-[12px] text-gray-400 truncate">{replyTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* ─── 멘션 자동완성 ─── */}
      {mentionQuery !== null && filteredMentions.length > 0 && (
        <div className="px-4 pb-2 bg-white/95 backdrop-blur border-t border-gray-200/40 animate-[slideUp_0.2s_ease]">
          <p className="text-[10px] font-bold tracking-wider text-gray-400 pt-2 pb-1">멘션</p>
          <div className="space-y-1">
            {filteredMentions.map((m) => (
              <button
                key={m.id}
                onClick={() => insertMention(m.name)}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[13px] font-bold shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">{m.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">@{m.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 첨부 메뉴 (iMessage 스타일) ─── */}
      {showAttach && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAttach(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe"
            style={{ animation: 'sheetUp 0.3s ease-out' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 mb-4" />
            <div className="px-4 pb-6 max-h-[50vh] overflow-y-auto">
              {ATTACH_ITEMS.map((item) => (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); item.action(); setShowAttach(false); }}
                  className="flex items-center gap-4 w-full py-3.5 px-2 hover:bg-gray-100/60 rounded-xl transition-colors"
                >
                  <div className={`w-11 h-11 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="text-[17px] text-gray-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── 입력바 하단 그라데이션 블러 (z-20) ─── */}
      <div
        className="absolute left-0 right-0 bottom-0 h-[120px] z-20 pointer-events-none"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'linear-gradient(to top, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* ─── Input Bar (Floating Pill) z-30 ─── */}
      <div className="absolute left-0 right-0 bottom-0 z-30 px-3 pb-3 pt-2 pb-safe pointer-events-none">
        <div className="flex items-end gap-2 max-w-[680px] mx-auto pointer-events-auto">
          {isRecording ? (
            // 녹음 중 UI
            <>
              <button
                onClick={() => stopRecording(true)}
                className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-transform"
                title="취소"
              >
                <X size={22} className="text-gray-500" />
              </button>
              <div className="flex-1 flex items-center gap-3 bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-red-200/80 px-5 h-12 animate-[slideUp_0.2s_ease]">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-[14px] font-bold text-red-500 tabular-nums">
                  {formatVoiceDuration(recordingTime)}
                </span>
                <div className="flex-1 flex items-center gap-0.5 h-6">
                  {Array.from({ length: 22 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-red-300 rounded-full"
                      style={{
                        height: `${30 + Math.abs(Math.sin((recordingTime + i) * 0.6)) * 70}%`,
                        animation: `voiceBar 0.6s ease-in-out ${i * 0.04}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => stopRecording(false)}
                  className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-800 flex items-center justify-center shrink-0 active:scale-[0.88] transition-transform"
                  title="전송"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 9L15 3L9 15L8 10L3 9Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </>
          ) : (
            // 일반 입력 UI - 플로팅 알약
            <>
              {/* + 버튼 (별개의 동그라미) */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
                className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
              >
                <Plus size={24} className="text-gray-600" />
              </button>

              {/* 입력 알약 (음성 포함) */}
              <div className="flex-1 flex items-center bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 pl-5 pr-1.5 h-12">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="메시지 (@ 으로 멘션)"
                  className="flex-1 min-w-0 bg-transparent text-[16px] focus:outline-none placeholder:text-gray-400 leading-[1.3]"
                />
                {input.trim() ? (
                  <button
                    onClick={handleSend}
                    className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-900 flex items-center justify-center shrink-0 active:scale-[0.88] transition-transform ml-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 9L15 3L9 15L8 10L3 9Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all ml-1"
                    title="음성 메시지 녹음"
                  >
                    <Mic size={20} className="text-gray-600" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />

      {/* 이미지 프리뷰 */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setImagePreview(null)}>
          <button onClick={() => setImagePreview(null)} className="absolute top-4 right-4 text-white"><X size={28} /></button>
          <img src={imagePreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      {/* 위치 선택 모달 */}
      {showLocationPicker && (
        <NaverMapPicker
          onSelect={(lat, lng) => sendLocationMessage(lat, lng)}
          onClose={() => setShowLocationPicker(false)}
        />
      )}

      {/* 부분복사 모달 */}
      {partialCopyMsg && (
        <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-[fadeIn_0.2s_ease]" onClick={() => setPartialCopyMsg(null)}>
          <div
            className="w-full max-w-[480px] bg-white rounded-3xl shadow-2xl overflow-hidden animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-gray-400">PARTIAL COPY</p>
                <h3 className="text-[18px] font-black text-gray-900 mt-0.5">부분복사</h3>
              </div>
              <button onClick={() => setPartialCopyMsg(null)} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <p className="px-5 text-[12px] text-gray-400 mb-2">텍스트를 드래그하여 복사할 부분을 선택하세요</p>
            <div className="px-5 pb-3">
              <p
                className="text-[15px] leading-[1.7] text-gray-900 whitespace-pre-wrap bg-gray-50 rounded-2xl p-4 max-h-[40vh] overflow-y-auto select-text border border-gray-100"
                style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
              >
                {partialCopyMsg.content}
              </p>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={() => {
                  const sel = window.getSelection?.()?.toString() || '';
                  if (!sel.trim()) {
                    toast.error('선택된 텍스트가 없습니다');
                    return;
                  }
                  navigator.clipboard.writeText(sel);
                  toast.success(`${sel.length}자 복사됨`);
                  setPartialCopyMsg(null);
                }}
                className="flex-1 h-12 bg-[#007AFF] hover:bg-[#0066d9] text-white text-[15px] font-bold rounded-2xl active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                선택한 부분 복사
              </button>
              <button
                onClick={() => setPartialCopyMsg(null)}
                className="px-5 h-12 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[15px] font-medium rounded-2xl active:scale-[0.98] transition-transform"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 애니메이션 keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes bubblePop {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.08); opacity: 1; }
          70% { transform: scale(0.96); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes menuPop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes reactionPop {
          0% { transform: scale(0); }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes reactionFade {
          0% { opacity: 0; transform: translateY(8px) scale(0.5); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scaleIn {
          0% { opacity: 0; transform: scale(0.92) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes replyHighlight {
          0%, 100% { background-color: transparent; }
          30% { background-color: rgba(0, 122, 255, 0.12); }
        }
        @keyframes voiceBar {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1); }
        }
      `}} />
    </div>
  );
}
