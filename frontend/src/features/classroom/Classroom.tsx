/**
 * Classroom.tsx — Professional UI Redesign
 * ─────────────────────────────────────────
 * WHAT CHANGED (UI / layout / styling only — zero business-logic changes):
 *
 *  Layout
 *  • 2-column desktop layout: flex-1 content area + fixed 72-wide right sidebar
 *  • Fixed header (h-14): back arrow, session title, slide counter, WS status
 *    dot, role badge, End button
 *  • Fixed control bar (h-16): Mic toggle, Camera toggle, End Session
 *  • Mobile bottom nav (h-14, md:hidden): Board / Chat / Library / People tabs
 *
 *  Sidebar (desktop)
 *  • Tabs: Chat | Library (teacher-only) | People
 *  • Library moved from full-screen modal → sidebar tab / mobile tab panel
 *  • "People" tab shows online/offline state for both participants
 *
 *  Slide navigation
 *  • Moved from floating header overlay → slim strip below the board
 *  • Progress-dot rail (clickable for teacher, display-only for student)
 *  • Prev / Next buttons visible to teacher only
 *
 *  Video (Agora)
 *  • Remains as fixed PiP overlay: bottom-left on desktop, top-right on mobile
 *
 *  Polish
 *  • Redesigned loading screen (skeleton + pulse) and error card
 *  • Empty states for chat (no messages) and library (no lessons)
 *  • Auto-scroll chat to latest message via chatEndRef
 *  • CSS-only transitions (no animation library)
 *  • Accessible focus rings on all interactive elements
 *  • ChatBubble memo'd to prevent re-renders on keystroke
 *
 *  New internal UI primitives (bottom of file, same file):
 *    RoleBadge, SideTab, MediaBtn, SysMsg, ChatBubble, ParticipantRow
 *
 * ASSUMPTIONS:
 *  • TailwindCSS v3 confirmed via tailwind.config.js + postcss.config.js
 *  • No tailwindcss-animate plugin → standard Tailwind transitions only
 *  • Lucide React available (existing dependency)
 *  • Single-file approach — sub-components appended at bottom
 *
 * NOT CHANGED:
 *  • All business logic, WebSocket handlers, Agora RTC logic, YouTube sync
 *  • renderActivityContent() — only the "Open Library" button now calls
 *    openLibrary() instead of setIsLibraryOpen(true) (pure UI routing change)
 *  • All existing refs, state variables, and effects kept verbatim
 */

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ConfirmLeaveModal from '../../components/ConfirmLeaveModal';
import TeacherWrapUpModal from './TeacherWrapUpModal';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  MessageSquare, Users,
  Send, BookOpen, ChevronLeft, ChevronRight,
  Loader2, ShieldCheck, AlertCircle, MonitorPlay,
  FileText, Image as ImageIcon, Puzzle, ListChecks, Type,
  ArrowLeft, BookMarked, BookOpen as PdfIcon,
} from 'lucide-react';
import Whiteboard from './Whiteboard';
import VideoRoom from './VideoRoom';
import MatchingGame from './MatchingGame';
import PdfActivity from './PdfActivity';
import { useAuth } from '../auth/AuthContext';
import { formatTime } from '../../utils/datetime';
import api from '../../lib/api';
import GapFill from './GapFill';
import Quiz from './Quiz';

// ─── YOUTUBE IFRAME API TYPES (unchanged) ─────────────────────────────────────
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  destroy(): void;
}
declare global {
  interface Window {
    YT: {
      Player: new (
        elementOrId: HTMLIFrameElement | string,
        opts: {
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (e: { target: YTPlayer }) => void;
            onStateChange?: (e: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { PLAYING: 1; PAUSED: 2; ENDED: 0; BUFFERING: 3; CUED: 5 };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

/** Extracts a YouTube video ID from watch, short, or embed URLs. */
const extractYouTubeId = (url: string): string | null => {
  const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?]+)/, /embed\/([^?]+)/];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
};

// ─── DOMAIN TYPES ─────────────────────────────────────────────────────────────
type ActivityType = 'image' | 'video' | 'matching' | 'gap_fill' | 'quiz' | 'pdf';
/** Desktop sidebar tab */
type SidebarTab = 'chat' | 'library' | 'people';
/** Mobile bottom-nav tab */
type MobileTab = 'board' | 'chat' | 'library' | 'people';

export interface ActivityContent {
  image?: string;
  url?: string;
  imageData?: string;
  items?: Array<{ id: string; text: string }>;
  zones?: Array<{ id: string; img?: string; text?: string }>;
  solution?: Record<string, string>;
  pairs?: Array<{ id: number; left: string; right: string }>;
  videoUrl?: string;
  sentence?: string;
  missing_word?: string;
  text?: string;
  questions?: Array<{
    id: number;
    question: string;
    options: string[];
    correctIndex: number;
  }>;
  question?: string;
  options?: string[];
  correct_index?: number;
  // PDF activity fields — injected by LessonActivitySerializer.to_representation()
  pdf_id?: number;
  pdf_download_url?: string;
  pdf_title?: string;
}

interface Activity {
  id: number;
  title: string;
  activity_type: ActivityType;
  order: number;
  content: ActivityContent | string;
}

interface Lesson {
  id: number;
  title: string;
  activities: Activity[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZoneState = any;

interface ChatBubbleProps {
  name: string;
  text: string;
  time?: string;
  isMe?: boolean;
  isSystem?: boolean;
}

interface ClassroomUser {
  full_name?: string;
  email?: string;
}

// ─── STORAGE HELPERS ──────────────────────────────────────────────────────────

/**
 * Safely write to sessionStorage.
 * Swallows QuotaExceededError so the app never crashes when storage is full
 * (e.g. after uploading many images whose base64 was previously stored here).
 */
function safeSessionSet(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
      console.warn(`[storage] Quota exceeded — skipping write for "${key}".`);
    } else {
      console.error(`[storage] Unexpected error writing "${key}":`, e);
    }
  }
}

/**
 * Minimal lesson snapshot persisted to sessionStorage.
 * Contains only lesson id + title — NEVER activity content, base64 images, or blobs.
 * Full activity data is always re-fetched from the server on restore.
 */
interface LessonSnapshot {
  lessonId: number;
  lessonTitle: string;
}

// ─── STATIC HELPER ────────────────────────────────────────────────────────────
const getActivityIcon = (type: ActivityType) => {
  if (!type) return <FileText size={11} />;
  switch (type) {
    case 'image': return <ImageIcon size={11} />;
    case 'video': return <Video size={11} />;
    case 'matching': return <Puzzle size={11} />;
    case 'gap_fill': return <Type size={11} />;
    case 'quiz': return <ListChecks size={11} />;
    case 'pdf':  return <PdfIcon size={11} />;
    default: return <FileText size={11} />;
  }
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function Classroom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // DOM refs
  const whiteboardContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);   // for auto-scroll

  // YouTube player refs (unchanged)
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);
  const userRoleRef = useRef<'teacher' | 'student' | null>(null);
  const pendingVideoStateRef = useRef<{ state: string; t: number } | null>(null);

  // ── STATE ────────────────────────────────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] =
    useState<'loading' | 'connected' | 'error'>('loading');
  const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(null);

  // Agora (unchanged)
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [agoraUid, setAgoraUid] = useState<number | null>(null);
  const [agoraAppId, setAgoraAppId] = useState<string>('');
  const [channelName, setChannelName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState('');

  // Media controls (unchanged)
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);

  // Legacy UI state — kept so existing effects compile without any modification
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  // New sidebar / mobile navigation
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat');
  const [mobileTab, setMobileTab] = useState<MobileTab>('board');

  // Chat
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatBubbleProps[]>([]);

  // Lesson state (unchanged)
  const [availableLessons, setAvailableLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);
  const [activeZoneData, setActiveZoneData] = useState<ZoneState | null>(null);

  // ── Wrap-up modal (teacher only)
  const [wrapUpOpen, setWrapUpOpen] = useState(false);

  // ── Leave-confirmation modal (both roles — back arrow + browser back) ──────
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);

  function requestLeave(action: () => void) {
    setPendingNav(() => action);
    setLeaveOpen(true);
  }

  function confirmLeave() {
    setLeaveOpen(false);
    const action = pendingNav;
    setPendingNav(null);
    if (action) action();
  }

  function cancelLeave() {
    setLeaveOpen(false);
    setPendingNav(null);
  }

  // Board canvas dimensions (unchanged — Whiteboard/Konva needs pixel values)
  const [boardDimensions, setBoardDimensions] = useState({ width: 0, height: 0 });

  // YouTube iframe callback-ref state (unchanged)
  const [ytIframe, setYtIframe] = useState<HTMLIFrameElement | null>(null);

  // ── 1. SECURE ENTRY CHECK (unchanged) ────────────────────────────────────────
  useEffect(() => {
    const enterClassroom = async () => {
      try {
        setConnectionStatus('loading');
        console.log('Fetching classroom data for ID:', id);

        const response = await api.get(`/api/classroom/enter/${id}/`);
        const data = response.data;

        const token = data.agora?.token || data.token;
        const appId = data.agora?.appId || data.appId;
        const channel = data.agora?.channel || data.channel;
        const uid = data.agora?.uid || data.uid;
        const role = data.role || 'student';
        const lesson = data.lesson;

        if (!token) throw new Error('Missing Agora credentials.');

        setUserRole(role);
        setAgoraToken(token);
        setAgoraAppId(appId);
        setChannelName(channel);
        setAgoraUid(uid);

        // Migration: remove legacy over-sized lesson_data key (previously stored
        // the full lesson including base64 images, causing QuotaExceededError).
        const legacyKey = `lesson_data_${id}`;
        if (sessionStorage.getItem(legacyKey) !== null) {
          sessionStorage.removeItem(legacyKey);
          console.log('[storage] Removed stale lesson_data key (legacy migration).');
        }

        if (lesson) {
          setActiveLesson(lesson);
          setCurrentActivityIndex(0);
        } else {
          // Restore from lightweight snapshot (id + title only, never heavy content).
          const rawSnap = sessionStorage.getItem(`lesson_snap_${id}`);
          const savedIndex = sessionStorage.getItem(`lesson_index_${id}`);

          if (rawSnap) {
            let snap: LessonSnapshot | null = null;
            try {
              snap = JSON.parse(rawSnap) as LessonSnapshot;
            } catch (e) {
              // Corrupt data — clean up and continue without restore.
              console.warn('[storage] Invalid lesson snapshot JSON — removing.', e);
              sessionStorage.removeItem(`lesson_snap_${id}`);
              sessionStorage.removeItem(`lesson_index_${id}`);
            }

            if (snap) {
              try {
                // Re-fetch full lesson from server; snapshot only held id + title.
                console.log('[storage] Re-fetching lesson from server for fast restore…');
                const lessonRes = await api.get(`/api/curriculum/lessons/${snap.lessonId}/`);
                setActiveLesson(lessonRes.data);
                if (savedIndex) setCurrentActivityIndex(parseInt(savedIndex, 10));
              } catch (fetchErr) {
                // Non-fatal: WebSocket history_dump will replay the lesson on connect.
                console.warn('[storage] Could not re-fetch lesson; waiting for WS sync.', fetchErr);
              }
            }
          }
        }

        setConnectionStatus('connected');
      } catch (err: unknown) {
        console.error('Entry Denied:', err);
        setConnectionStatus('error');
        let errorMsg = 'Failed to join classroom.';
        if (err instanceof Error) {
          errorMsg = err.message;
        } else if (err && typeof err === 'object' && 'response' in err) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const axiosErr = err as { response?: { data?: { error?: string } } };
          errorMsg = axiosErr.response?.data?.error || errorMsg;
        }
        setErrorMessage(errorMsg);
      }
    };
    if (id) enterClassroom();
  }, [id]);

  // ── 2. PERSISTENCE — debounced minimal snapshot (never stores heavy content) ─
  // Debouncing via effect cleanup: each render cancels the previous timer and
  // starts a fresh 500 ms one, so storage is only written after the state settles.
  // safeSessionSet absorbs any QuotaExceededError without crashing the app.
  useEffect(() => {
    if (!activeLesson || !id) return;

    const timer = setTimeout(() => {
      // Store only lesson id + title.  Activity content (which may include base64
      // images) is intentionally excluded to prevent QuotaExceededError.
      const snapshot: LessonSnapshot = {
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
      };
      safeSessionSet(`lesson_snap_${id}`, JSON.stringify(snapshot));
      safeSessionSet(`lesson_index_${id}`, currentActivityIndex.toString());
    }, 500);

    // Cleanup cancels the pending timer on the next render (debounce mechanism).
    return () => clearTimeout(timer);
  }, [activeLesson, currentActivityIndex, id]);

  // ── Keep userRoleRef in sync (unchanged) ──────────────────────────────────────
  useEffect(() => { userRoleRef.current = userRole; }, [userRole]);

  // ── Load YouTube IFrame API script (unchanged) ────────────────────────────────
  useEffect(() => {
    if (document.getElementById('yt-iframe-api')) return;
    const script = document.createElement('script');
    script.id = 'yt-iframe-api';
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  }, []);

  // ── Initialize / destroy YouTube player (unchanged) ───────────────────────────
  useEffect(() => {
    if (!ytIframe) {
      if (ytSyncIntervalRef.current) {
        clearInterval(ytSyncIntervalRef.current);
        ytSyncIntervalRef.current = null;
      }
      ytPlayerRef.current = null;
      return;
    }

    const createPlayer = () => {
      ytPlayerRef.current = new window.YT.Player(ytIframe, {
        playerVars: {
          controls: userRoleRef.current === 'teacher' ? 1 : 0,
          disablekb: userRoleRef.current === 'student' ? 1 : 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            if (userRoleRef.current === 'student' && pendingVideoStateRef.current) {
              const { state, t } = pendingVideoStateRef.current;
              isSyncingRef.current = true;
              ytPlayerRef.current?.seekTo(t, true);
              if (state === 'playing') ytPlayerRef.current?.playVideo();
              else ytPlayerRef.current?.pauseVideo();
              setTimeout(() => { isSyncingRef.current = false; }, 1000);
              pendingVideoStateRef.current = null;
            }
          },
          onStateChange: (event: { data: number }) => {
            if (userRoleRef.current !== 'teacher') return;
            if (isSyncingRef.current) return;
            const t = ytPlayerRef.current?.getCurrentTime() ?? 0;
            if (event.data === 1) {
              socketRef.current?.send(JSON.stringify({ type: 'VIDEO_PLAY', payload: { t } }));
              if (ytSyncIntervalRef.current) clearInterval(ytSyncIntervalRef.current);
              ytSyncIntervalRef.current = setInterval(() => {
                const ct = ytPlayerRef.current?.getCurrentTime() ?? 0;
                socketRef.current?.send(JSON.stringify({ type: 'VIDEO_SYNC', payload: { t: ct } }));
              }, 7000);
            } else if (event.data === 2) {
              socketRef.current?.send(JSON.stringify({ type: 'VIDEO_PAUSE', payload: { t } }));
              if (ytSyncIntervalRef.current) {
                clearInterval(ytSyncIntervalRef.current);
                ytSyncIntervalRef.current = null;
              }
            }
          },
        },
      });
    };

    if (window.YT?.Player) createPlayer();
    else window.onYouTubeIframeAPIReady = createPlayer;

    return () => {
      if (ytSyncIntervalRef.current) {
        clearInterval(ytSyncIntervalRef.current);
        ytSyncIntervalRef.current = null;
      }
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [ytIframe]);

  // ── 3. WEBSOCKET LOGIC (unchanged) ───────────────────────────────────────────
  useEffect(() => {
    if (connectionStatus !== 'connected' || !id) return;

    const token = localStorage.getItem('access');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/lesson/${id}/?token=${token}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket Connected');
      if (userRole === 'teacher' && activeLesson) {
        socket.send(JSON.stringify({
          type: 'lesson_update',
          payload: { lesson: activeLesson, slideIndex: currentActivityIndex },
        }));
      }
    };

    socket.onerror = (e) => console.error('WebSocket Error:', e);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'history_dump' && data.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chatHistory = data.data.filter((item: any) => item.type === 'chat_message')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => ({ ...item.payload, isMe: false }));
        setMessages(chatHistory);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastLesson = data.data.slice().reverse().find((item: any) => item.type === 'lesson_update');
        if (lastLesson?.payload) {
          console.log('Restoring lesson from Server History');
          setActiveLesson(lastLesson.payload.lesson);
          setCurrentActivityIndex(lastLesson.payload.slideIndex ?? 0);
        }
      }
      else if (data.type === 'chat_message' && data.payload) {
        setMessages((prev) => [...prev, { ...data.payload, isMe: false }]);
      }
      else if ((data.type === 'lesson_state' || data.type === 'lesson_update') && data.payload) {
        console.log('Applying Lesson Update:', data.payload);
        if (data.payload.lesson) setActiveLesson(data.payload.lesson);
        if (typeof data.payload.slideIndex === 'number') {
          setCurrentActivityIndex(data.payload.slideIndex);
          setActiveZoneData(null);
        }
      }
      else if (data.type === 'ZONE_STATE_UPDATE' && data.payload) {
        setActiveZoneData(data.payload);
      }
      // VIDEO SYNC (unchanged)
      else if (data.type === 'VIDEO_PLAY' && userRoleRef.current === 'student') {
        isSyncingRef.current = true;
        ytPlayerRef.current?.seekTo(data.payload.t, true);
        ytPlayerRef.current?.playVideo();
        setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (data.type === 'VIDEO_PAUSE' && userRoleRef.current === 'student') {
        isSyncingRef.current = true;
        ytPlayerRef.current?.pauseVideo();
        setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (data.type === 'VIDEO_SEEK' && userRoleRef.current === 'student') {
        isSyncingRef.current = true;
        ytPlayerRef.current?.seekTo(data.payload.t, true);
        setTimeout(() => { isSyncingRef.current = false; }, 1000);
      }
      else if (data.type === 'VIDEO_SYNC' && userRoleRef.current === 'student') {
        if (ytPlayerRef.current) {
          const drift = Math.abs(ytPlayerRef.current.getCurrentTime() - data.payload.t);
          if (drift > 0.7) {
            isSyncingRef.current = true;
            const wasPlaying = ytPlayerRef.current.getPlayerState() === 1;
            ytPlayerRef.current.seekTo(data.payload.t, true);
            if (wasPlaying) ytPlayerRef.current.playVideo();
            setTimeout(() => { isSyncingRef.current = false; }, 1000);
          }
        }
      }
      else if (data.type === 'VIDEO_STATE' && userRoleRef.current === 'student') {
        if (ytPlayerRef.current) {
          isSyncingRef.current = true;
          ytPlayerRef.current.seekTo(data.payload.t, true);
          if (data.payload.state === 'playing') ytPlayerRef.current.playVideo();
          else ytPlayerRef.current.pauseVideo();
          setTimeout(() => { isSyncingRef.current = false; }, 1000);
        } else {
          pendingVideoStateRef.current = data.payload;
        }
      }
    };

    const handleResize = () => {
      if (window.innerWidth < 1024) setIsChatOpen(false);
      if (whiteboardContainerRef.current) {
        setBoardDimensions({
          width: whiteboardContainerRef.current.clientWidth,
          height: whiteboardContainerRef.current.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); socket.close(); };
  }, [id, connectionStatus]);

  // ── 4. LIBRARY FETCH (unchanged) ──────────────────────────────────────────────
  useEffect(() => {
    if (isLibraryOpen) {
      api.get('/api/curriculum/lessons/')
        .then(res => setAvailableLessons(res.data))
        .catch(err => console.error('Error fetching lessons:', err));
    }
  }, [isLibraryOpen]);

  // ── UI-only: auto-scroll chat ──────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── UI-only: remeasure board when switching back to board tab on mobile ────────
  useEffect(() => {
    if (mobileTab === 'board') {
      requestAnimationFrame(() => {
        if (whiteboardContainerRef.current) {
          setBoardDimensions({
            width: whiteboardContainerRef.current.clientWidth,
            height: whiteboardContainerRef.current.clientHeight,
          });
        }
      });
    }
  }, [mobileTab]);

  // ── UI-only: openLibrary — sets library open in both desktop + mobile ──────────
  const openLibrary = useCallback(() => {
    setIsLibraryOpen(true);
    setSidebarTab('library');
    setMobileTab('library');
  }, []);

  // ── 5. ACTIONS (unchanged business logic; handleLoadLesson adds UI routing) ───
  const sendMessage = () => {
    if (!message.trim() || !socketRef.current) return;
    const classroomUser = user as ClassroomUser;
    const userName = classroomUser?.full_name || classroomUser?.email || 'Me';
    const newMessage: ChatBubbleProps = {
      name: userName,
      text: message,
      time: formatTime(new Date().toISOString()),
    };
    socketRef.current.send(JSON.stringify({ type: 'chat_message', payload: newMessage }));
    setMessages((prev) => [...prev, { ...newMessage, isMe: true }]);
    setMessage('');
  };

  const handleLoadLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setCurrentActivityIndex(0);
    setIsLibraryOpen(false);
    setSidebarTab('chat');   // return sidebar to chat
    setMobileTab('board');   // return mobile to board
    socketRef.current?.send(JSON.stringify({
      type: 'lesson_update',
      payload: { lesson, slideIndex: 0 },
    }));
  };

  const changeActivity = (newIndex: number) => {
    if (!activeLesson) return;
    if (newIndex < 0 || newIndex >= activeLesson.activities.length) return;
    setCurrentActivityIndex(newIndex);
    setActiveZoneData(null);
    socketRef.current?.send(JSON.stringify({
      type: 'lesson_update',
      payload: { lesson: activeLesson, slideIndex: newIndex },
    }));
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sendZoneAction = (activityType: string, action: string, data: any = {}) => {
    if (!socketRef.current) return;
    socketRef.current.send(JSON.stringify({
      type: 'ZONE_ACTION',
      payload: { activity_type: activityType, action, ...data },
    }));
  };

  // ── Native protection for tab close / refresh (browser limitation) ───────
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [connectionStatus]);

  // ── Browser-back guard (works with BrowserRouter) ───────────────────────────
  // Strategy: push a sentinel entry so the user is never on the bottom of the
  // stack. When popstate fires (browser-back pressed), we push the sentinel back
  // and show the modal. Confirming navigates programmatically; cancelling stays.
  const pendingBackNav = useRef<string | null>(null);

  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    // Push sentinel so there is always an entry behind the current one.
    window.history.pushState({ classroomGuard: true }, '');

    const handlePopstate = () => {
      // Re-push the sentinel so we stay on the page.
      window.history.pushState({ classroomGuard: true }, '');
      // Store where we'd go on confirm (back one step from sentinel).
      pendingBackNav.current = '/dashboard';
      requestLeave(() => {
        navigate('/dashboard');
      });
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus]);

  const handleExitRequest = () => {
    if (userRole === 'teacher') {
      // Teacher opens the structured wrap-up modal (status + notes + homework)
      setWrapUpOpen(true);
    } else {
      // Student gets the simple leave-confirmation modal
      requestLeave(() => navigate('/dashboard'));
    }
  };

  // ── 6. RENDER ACTIVITY (unchanged; "Open Library" button now calls openLibrary) ─
  const renderActivityContent = () => {
    if (!activeLesson) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-5 text-gray-400 p-8">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
            <MonitorPlay size={28} className="text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-500">
              {userRole === 'teacher' ? 'No lesson loaded yet' : 'Waiting for teacher to start…'}
            </p>
            {userRole !== 'teacher' && (
              <p className="text-xs text-gray-400 mt-1.5">
                The teacher will launch the lesson shortly
              </p>
            )}
          </div>
          {userRole === 'teacher' && (
            <button
              onClick={openLibrary}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              <BookOpen size={16} /> Open Library
            </button>
          )}
        </div>
      );
    }

    const activity = activeLesson.activities[currentActivityIndex];
    if (!activity) return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        End of Lesson
      </div>
    );

    let safeContent: ActivityContent = {};
    if (typeof activity.content === 'string') {
      try { safeContent = JSON.parse(activity.content); }
      catch (e) { console.error('Content Parse Error:', e); }
    } else {
      safeContent = activity.content || {};
    }

    const type = activity.activity_type || 'unknown';

    switch (type) {
      case 'image': {
        const bgSource = safeContent.imageData || safeContent.url || safeContent.image;
        return (
          <Whiteboard
            width={boardDimensions.width}
            height={boardDimensions.height}
            backgroundImage={bgSource}
            gameState={activeZoneData}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onAction={(action: string, data: any) => sendZoneAction('whiteboard', action, data)}
            isTeacher={userRole === 'teacher'}
            isConnected={isConnected}
          />
        );
      }
      case 'matching':
        return (
          <MatchingGame
            content={safeContent}
            gameState={activeZoneData}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onAction={(action: string, data: any) => sendZoneAction('matching', action, data)}
            isTeacher={userRole === 'teacher'}
          />
        );
      case 'video': {
        const videoId = safeContent.url ? extractYouTubeId(safeContent.url) : null;
        if (videoId) {
          const iframeSrc = [
            `https://www.youtube.com/embed/${videoId}`,
            `?enablejsapi=1`,
            `&controls=${userRole === 'teacher' ? '1' : '0'}`,
            `&disablekb=${userRole === 'student' ? '1' : '0'}`,
            `&modestbranding=1&rel=0`,
          ].join('');
          return (
            <div className="h-full w-full flex items-center justify-center bg-black p-4">
              <iframe
                key={videoId}
                ref={setYtIframe}
                src={iframeSrc}
                className="w-full h-full max-w-4xl max-h-[80vh] rounded-xl shadow-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Lesson Video"
              />
            </div>
          );
        }
        return (
          <div className="h-full flex flex-col items-center justify-center bg-black gap-3">
            <MonitorPlay size={48} className="text-gray-600" />
            <p className="text-gray-400 text-sm">No video URL provided.</p>
          </div>
        );
      }
      case 'gap_fill':
        return (
          <GapFill
            key={activity.id}
            content={{ text: safeContent.text || '' }}
            isTeacher={userRole === 'teacher'}
            gameState={activeZoneData}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onAction={(action: string, data: any) => sendZoneAction('gap_fill', action, data)}
          />
        );
      case 'quiz':
        return (
          <Quiz
            key={activity.id}
            content={safeContent}
            isTeacher={userRole === 'teacher'}
          />
        );
      case 'pdf':
        // safeContent contains pdf_download_url + pdf_title injected by the serializer.
        // Page sync uses the existing ZONE_ACTION → zone_state mechanism:
        //   teacher goToPage → onAction('page_change', { page })
        //   consumer merges into zone_state → broadcasts ZONE_STATE_UPDATE
        //   student receives gameState.page → PdfActivity updates view
        return (
          <PdfActivity
            key={activity.id}
            content={safeContent}
            isTeacher={userRole === 'teacher'}
            gameState={activeZoneData}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onAction={(action: string, data: any) => sendZoneAction('pdf', action, data)}
          />
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Unknown Activity Type: {activity.activity_type}
          </div>
        );
    }
  };

  // ── LOADING SCREEN ────────────────────────────────────────────────────────────
  if (connectionStatus === 'loading') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-8">
        {/* Brand mark */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-blue-200">
            O
          </div>
          <span className="text-gray-800 font-bold text-lg tracking-tight">OnlineSchool</span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2.5 text-gray-500">
          <Loader2 size={18} className="animate-spin text-blue-500" />
          <span className="text-sm font-medium">Joining session securely…</span>
        </div>

        {/* Skeleton placeholder */}
        <div className="w-64 space-y-3">
          <div className="h-2.5 bg-gray-200 rounded-full animate-pulse w-3/4 mx-auto" />
          <div className="h-2.5 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-28 bg-gray-200 rounded-2xl animate-pulse mt-4" />
          <div className="h-2.5 bg-gray-200 rounded-full animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  // ── ERROR SCREEN ──────────────────────────────────────────────────────────────
  if (connectionStatus === 'error') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={26} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1.5">Unable to Join</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">{errorMessage}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── DERIVED VALUES ────────────────────────────────────────────────────────────
  const isConnected = socketRef.current?.readyState === 1;
  const classroomUser = user as ClassroomUser;
  const userName = classroomUser?.full_name || classroomUser?.email || 'Me';

  // ── SHARED PANEL CONTENT (rendered in both desktop sidebar and mobile panels) ─

  const chatPanel = (
    <>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <SysMsg text="Welcome to the secure classroom" />
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2.5 text-gray-400">
            <MessageSquare size={28} className="opacity-20" />
            <p className="text-xs font-semibold">No messages yet</p>
            <p className="text-[11px] text-gray-300">Say hello to start the conversation!</p>
          </div>
        )}
        {messages.map((msg, idx) => <ChatBubble key={idx} {...msg} />)}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="shrink-0 p-3 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
          <input
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none px-3 py-2.5"
            placeholder="Type a message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim()}
            className="m-1.5 p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
            title="Send message"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );

  const libraryPanel = (
    <div className="flex-1 overflow-y-auto">
      {availableLessons.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-14 gap-3 text-gray-400 px-6">
          <BookMarked size={30} className="opacity-20" />
          <p className="text-sm font-semibold">No lessons available</p>
          <p className="text-[11px] text-gray-300 text-center leading-relaxed">
            Create lessons in the admin panel and they'll appear here
          </p>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          {availableLessons.map(lesson => (
            <button
              key={lesson.id}
              onClick={() => handleLoadLesson(lesson)}
              className="w-full text-left p-3.5 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 group-hover:text-blue-700 truncate transition-colors">
                    {lesson.title}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {lesson.activities.slice(0, 4).map((act, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md"
                      >
                        {getActivityIcon(act.activity_type)}
                        <span className="ml-0.5">
                          {act.activity_type ? act.activity_type.replace('_', ' ') : 'slide'}
                        </span>
                      </span>
                    ))}
                    {lesson.activities.length > 4 && (
                      <span className="text-[10px] text-gray-400 self-center">
                        +{lesson.activities.length - 4}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md tabular-nums whitespace-nowrap">
                  {lesson.activities.length} slides
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const peoplePanel = (
    <div className="flex-1 p-4 space-y-2.5 overflow-y-auto">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">
        Participants
      </p>
      {/* Self */}
      <ParticipantRow
        initials={(userName[0] || 'Y').toUpperCase()}
        name={userName}
        role={userRole ?? 'student'}
        isOnline={true}
        isSelf
      />
      {/* Partner */}
      <ParticipantRow
        initials={userRole === 'teacher' ? 'S' : 'T'}
        name={userRole === 'teacher' ? 'Student' : 'Teacher'}
        role={userRole === 'teacher' ? 'student' : 'teacher'}
        isOnline={isConnected}
      />
      {/* Session info */}
      <div className="pt-4 flex items-center justify-center gap-1.5 text-[11px] text-gray-400 select-none">
        <ShieldCheck size={11} className="text-emerald-500" />
        End-to-end encrypted session
      </div>
    </div>
  );

  // ── MAIN RENDER ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 font-sans overflow-hidden">

      {/* ════════════════ HEADER ════════════════════════════════════════════════ */}
      <header className="shrink-0 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-3 md:px-5 z-20 shadow-sm">

        {/* Back / logo */}
        <button
          onClick={() => requestLeave(() => navigate('/dashboard'))}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
          title="Back to Dashboard"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="w-px h-5 bg-gray-200 shrink-0" />

        {/* Session title + slide counter */}
        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm font-semibold text-gray-900 truncate">
            {activeLesson ? activeLesson.title : 'Live Session'}
          </h1>
          {activeLesson && (
            <span className="shrink-0 text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full tabular-nums">
              {currentActivityIndex + 1}/{activeLesson.activities.length}
            </span>
          )}
        </div>

        {/* Right cluster: status / role / end */}
        <div className="flex items-center gap-2 shrink-0">
          {/* WS connection dot */}
          <div className="hidden sm:flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full transition-colors duration-300 ${isConnected ? 'bg-emerald-500' : 'bg-red-400'
                }`}
            />
            <span className={`text-xs font-semibold ${isConnected ? 'text-emerald-600' : 'text-red-500'}`}>
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {/* Role badge */}
          <RoleBadge role={userRole} />

          {/* End session button */}
          <button
            onClick={handleExitRequest}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
            title="End session"
          >
            <PhoneOff size={13} />
            <span className="hidden sm:inline">End</span>
          </button>
        </div>
      </header>

      {/* ════════════════ BODY ══════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── MAIN CONTENT AREA ────────────────────────────────────────────────── */}
        <main className="flex flex-col flex-1 min-h-0 overflow-hidden">

          {/* BOARD — always in DOM; hidden on mobile when another tab active */}
          <div
            className={`flex-1 flex items-center justify-center p-3 md:p-5 bg-gray-50 overflow-hidden ${mobileTab !== 'board' ? 'hidden md:flex' : 'flex'
              }`}
          >
            <div
              ref={whiteboardContainerRef}
              className="relative w-full max-w-5xl aspect-video bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
            >
              {boardDimensions.width > 0 && renderActivityContent()}
            </div>
          </div>

          {/* SLIDE NAVIGATION STRIP — below board */}
          {activeLesson && mobileTab === 'board' && (
            <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-2 flex items-center gap-3">
              {/* Progress dots */}
              <div className="flex-1 flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {activeLesson.activities.map((act, i) => (
                  <button
                    key={i}
                    onClick={() => userRole === 'teacher' ? changeActivity(i) : undefined}
                    disabled={userRole !== 'teacher'}
                    title={act.title || `Slide ${i + 1}`}
                    className={`shrink-0 h-1.5 rounded-full transition-all duration-200 focus:outline-none ${i === currentActivityIndex
                      ? 'bg-blue-600 w-5'
                      : userRole === 'teacher'
                        ? 'bg-gray-300 hover:bg-gray-400 w-1.5 cursor-pointer'
                        : 'bg-gray-300 w-1.5 cursor-default'
                      }`}
                  />
                ))}
              </div>

              {/* Prev / Next — teacher only */}
              {userRole === 'teacher' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => changeActivity(currentActivityIndex - 1)}
                    disabled={currentActivityIndex === 0}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Previous slide"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-gray-600 tabular-nums w-12 text-center select-none">
                    {currentActivityIndex + 1} / {activeLesson.activities.length}
                  </span>
                  <button
                    onClick={() => changeActivity(currentActivityIndex + 1)}
                    disabled={currentActivityIndex === activeLesson.activities.length - 1}
                    className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                    title="Next slide"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── MOBILE PANELS (switch between content areas on mobile) ── */}

          {/* Mobile: Chat */}
          <div
            className={`flex-col flex-1 min-h-0 md:hidden bg-white ${mobileTab === 'chat' ? 'flex' : 'hidden'
              }`}
          >
            {chatPanel}
          </div>

          {/* Mobile: Library */}
          <div
            className={`flex-col flex-1 min-h-0 md:hidden bg-white ${mobileTab === 'library' ? 'flex' : 'hidden'
              }`}
          >
            {userRole === 'teacher' ? libraryPanel : (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-400">
                <BookOpen size={28} className="opacity-20" />
                <p className="text-sm">Library is for teachers only</p>
              </div>
            )}
          </div>

          {/* Mobile: People */}
          <div
            className={`flex-col flex-1 min-h-0 md:hidden bg-white ${mobileTab === 'people' ? 'flex' : 'hidden'
              }`}
          >
            {peoplePanel}
          </div>
        </main>

        {/* ── DESKTOP SIDEBAR ──────────────────────────────────────────────────── */}
        <aside className="hidden md:flex flex-col w-72 shrink-0 border-l border-gray-200 bg-white">
          {/* Tab bar */}
          <div className="shrink-0 flex border-b border-gray-200" role="tablist">
            <SideTab
              icon={<MessageSquare size={14} />}
              label="Chat"
              active={sidebarTab === 'chat'}
              onClick={() => setSidebarTab('chat')}
            />
            {userRole === 'teacher' && (
              <SideTab
                icon={<BookOpen size={14} />}
                label="Library"
                active={sidebarTab === 'library'}
                onClick={() => { setSidebarTab('library'); setIsLibraryOpen(true); }}
              />
            )}
            <SideTab
              icon={<Users size={14} />}
              label="People"
              active={sidebarTab === 'people'}
              onClick={() => setSidebarTab('people')}
            />
          </div>

          {/* Tab content panels */}
          <div className={`flex flex-col flex-1 min-h-0 ${sidebarTab !== 'chat' ? 'hidden' : ''}`}>{chatPanel}</div>
          <div className={`flex flex-col flex-1 min-h-0 ${sidebarTab !== 'library' ? 'hidden' : ''}`}>{libraryPanel}</div>
          <div className={`flex flex-col flex-1 min-h-0 ${sidebarTab !== 'people' ? 'hidden' : ''}`}>{peoplePanel}</div>
        </aside>
      </div>

      {/* ════════════════ CONTROL BAR ════════════════════════════════════════════ */}
      <div className="shrink-0 h-16 bg-white border-t border-gray-200 flex items-center justify-between px-4 md:px-6 z-10">
        {/* Media toggles */}
        <div className="flex items-center gap-2">
          <MediaBtn
            isOn={isMicOn}
            onClick={() => setIsMicOn(!isMicOn)}
            onIcon={<Mic size={18} />}
            offIcon={<MicOff size={18} />}
            onLabel="Mute"
            offLabel="Unmute"
          />
          <MediaBtn
            isOn={isVideoOn}
            onClick={() => setIsVideoOn(!isVideoOn)}
            onIcon={<Video size={18} />}
            offIcon={<VideoOff size={18} />}
            onLabel="Stop Camera"
            offLabel="Start Camera"
          />
        </div>

        {/* Center: live indicator (desktop) */}
        <div className="hidden md:flex items-center gap-2 text-xs text-gray-400 select-none">
          <ShieldCheck size={13} className="text-emerald-500" />
          <span>Encrypted · Live</span>
        </div>

        {/* End session */}
        <button
          onClick={handleExitRequest}
          className="flex items-center gap-2 bg-red-500 hover:bg-red-600 active:scale-95 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm shadow-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
          title="End session"
        >
          <PhoneOff size={15} />
          <span className="hidden sm:inline">End Session</span>
        </button>
      </div>

      {/* ════════════════ MOBILE BOTTOM NAV ══════════════════════════════════════ */}
      <nav className="shrink-0 md:hidden flex bg-white border-t border-gray-100" role="tablist">
        {(
          [
            { id: 'board', icon: <MonitorPlay size={19} />, label: 'Board' },
            { id: 'chat', icon: <MessageSquare size={19} />, label: 'Chat' },
            ...(userRole === 'teacher'
              ? [{ id: 'library', icon: <BookOpen size={19} />, label: 'Library' }]
              : []
            ),
            { id: 'people', icon: <Users size={19} />, label: 'People' },
          ] as { id: MobileTab; icon: React.ReactNode; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={mobileTab === tab.id}
            onClick={() => {
              setMobileTab(tab.id);
              if (tab.id === 'library') setIsLibraryOpen(true);
            }}
            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors focus:outline-none ${mobileTab === tab.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
          >
            {/* Top indicator line */}
            {mobileTab === tab.id && (
              <span className="absolute top-0 inset-x-4 h-0.5 bg-blue-600 rounded-b-full" />
            )}
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* ════════════════ VIDEO PiP OVERLAY ══════════════════════════════════════ */}
      {/* Mobile: top-right below header. Desktop: bottom-left above control bar. */}
      <div
        className="fixed top-16 right-2 w-28 h-20 md:top-auto md:right-auto md:bottom-20 md:left-4 md:w-60 md:h-44 z-30 rounded-xl overflow-hidden shadow-xl ring-2 ring-white/60 bg-gray-900 transition-all duration-300"
      >
        {agoraToken && channelName && (
          <VideoRoom
            appId={agoraAppId}
            channelName={channelName}
            token={agoraToken}
            uid={agoraUid || 0}
            micOn={isMicOn}
            cameraOn={isVideoOn}
            onToggleMic={() => setIsMicOn(!isMicOn)}
            onToggleCamera={() => setIsVideoOn(!isVideoOn)}
          />
        )}
      </div>

      {/* ════════════════ TEACHER WRAP-UP MODAL ══════════════════════════════════ */}
      <TeacherWrapUpModal
        open={wrapUpOpen}
        lessonId={activeLesson?.id ?? ''}
        onSuccessExit={() => navigate('/dashboard')}
        onCancel={() => setWrapUpOpen(false)}
      />

      {/* ════════════════ LEAVE CONFIRMATION MODAL (both roles) ══════════════════ */}
      <ConfirmLeaveModal
        open={leaveOpen}
        title="Leave class?"
        description={
          userRole === 'teacher'
            ? 'Leaving will end the session for you. Make sure you\u2019re done before exiting.'
            : 'If you leave now, you may miss part of the lesson. You can rejoin if the lesson is still active.'
        }
        confirmText="Leave"
        cancelText="Stay"
        danger
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// UI PRIMITIVES — small, focused; all internal to this file
// ═══════════════════════════════════════════════════════════════════════════════

/** Role badge shown in the header */
function RoleBadge({ role }: { role: 'teacher' | 'student' | null }) {
  if (!role) return null;
  return (
    <span
      className={`hidden sm:inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${role === 'teacher'
        ? 'bg-violet-100 text-violet-700'
        : 'bg-teal-100 text-teal-700'
        }`}
    >
      {role === 'teacher' ? 'Teacher' : 'Student'}
    </span>
  );
}

/** Sidebar tab button */
function SideTab({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors focus:outline-none focus:ring-inset focus:ring-2 focus:ring-blue-400 ${active
        ? 'border-blue-600 text-blue-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** Mic / Camera toggle button in the control bar */
function MediaBtn({
  isOn, onClick, onIcon, offIcon, onLabel, offLabel,
}: {
  isOn: boolean;
  onClick: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      title={isOn ? onLabel : offLabel}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-1 ${isOn
        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 focus:ring-gray-300'
        : 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-400 shadow-sm shadow-red-100'
        }`}
    >
      {isOn ? onIcon : offIcon}
      <span className="hidden md:inline">{isOn ? onLabel : offLabel}</span>
    </button>
  );
}

/** Centered system / info message in chat */
function SysMsg({ text }: { text: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wide">
        <ShieldCheck size={9} />
        {text}
      </span>
    </div>
  );
}

/**
 * Chat message bubble.
 * Memo'd so the entire list doesn't re-render on every keystroke in the input.
 */
const ChatBubble = memo(function ChatBubble({
  name, text, time, isMe, isSystem,
}: ChatBubbleProps) {
  if (isSystem) return <SysMsg text={text} />;
  return (
    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }`}
      >
        {text}
      </div>
      <div className="flex items-center gap-1.5 px-1">
        {!isMe && <span className="text-[10px] font-semibold text-gray-400">{name}</span>}
        {time && <span className="text-[10px] text-gray-300">{time}</span>}
      </div>
    </div>
  );
});

/** Participant row in the People sidebar tab */
function ParticipantRow({
  initials, name, role, isOnline, isSelf = false,
}: {
  initials: string;
  name: string;
  role: string;
  isOnline: boolean;
  isSelf?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${role === 'teacher' ? 'bg-violet-500' : 'bg-teal-500'
          }`}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {name}
          {isSelf && (
            <span className="text-gray-400 font-normal ml-1.5 text-xs">(You)</span>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
          />
          <span className="text-[11px] text-gray-500 capitalize">
            {role} · {isOnline ? 'Online' : 'Waiting…'}
          </span>
        </div>
      </div>
    </div>
  );
}
