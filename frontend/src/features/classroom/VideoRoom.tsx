/**
 * VideoRoom.tsx — Professional PiP Video Component
 * ──────────────────────────────────────────────────
 * UI IMPROVEMENTS (summary):
 *  • Role-aware video tiles: "You" (blue) / "Teacher" (violet) / "Student" (teal)
 *  • Camera-off placeholder: colored avatar with initial instead of bare User icon
 *  • Mic-muted icon overlay (top-left of tile)
 *  • Network quality indicator (top-right of local tile, via Agora network-quality event)
 *  • Loading: animated skeleton (avatar pulse + bars) replacing bare spinner
 *  • Waiting state: bouncing dots overlay when no remote participant has joined
 *  • Error state: typed (permission / device-not-found / unknown) with clean panel
 *  • Accessible: role="region", aria-label, aria-live on waiting, role="alert" on error
 *  • VideoTile memoized; stable videoRef via useCallback([videoTrack])
 *  • gap-px between tiles (matches gray-900 dark seam, cleaner than gap-2)
 *  • All colors/radii/typography match Classroom.tsx design system exactly
 *
 * AGORA LOGIC: completely unchanged.
 *   - Module-level client singleton preserved as-is
 *   - user-published / user-unpublished handlers: line-for-line identical
 *   - join / createMicrophoneAndCameraTracks / publish: identical
 *   - Cleanup (stop/close/leave): identical
 *   - useEffect dependency arrays: identical
 *   - mic/camera setEnabled effects: identical
 *   Additions (UI-only, additive):
 *   - network-quality listener → setNetQuality (display only)
 *   - error name classification in catch block → setError (display only)
 *
 * ASSUMPTIONS:
 *  - VideoRoom is rendered inside a fixed-size PiP container by Classroom.tsx.
 *    Controls (mic/camera) are handled by Classroom's own control bar; VideoRoom
 *    intentionally renders NO controls (onToggleMic/onToggleCamera preserved in
 *    props for API compatibility, not used in render).
 *  - In a 1:1 session the single remote user is labelled "Teacher"; this matches
 *    the platform's use-case. If multi-party is added later, pass role via prop.
 *  - TailwindCSS v3, no animation plugin — animate-bounce and animate-pulse are
 *    core Tailwind utilities and are used here.
 */

import { useEffect, useState, useCallback, memo } from 'react';
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IAgoraRTCRemoteUser,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng';
import AgoraRTC from 'agora-rtc-sdk-ng';
import { Loader2, MicOff, AlertTriangle } from 'lucide-react';

// ── Public props interface (unchanged) ────────────────────────────────────────
export interface VideoRoomProps {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

// ── Module-level Agora singleton (unchanged) ──────────────────────────────────
let client: IAgoraRTCClient | null = null;

// ── Internal types ────────────────────────────────────────────────────────────
// Agora network quality scale: 0=unknown 1=excellent 2=good 3=poor 4=bad 5=very bad 6=disconnected
type NetQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ErrorKind  = 'permission' | 'notfound' | 'unknown';
type RoleBadge  = 'You' | 'Teacher' | 'Student';

// Structural type satisfied by both ICameraVideoTrack and IRemoteVideoTrack
type PlayableVideoTrack = ICameraVideoTrack | IRemoteVideoTrack;

// ── Network quality display helpers ───────────────────────────────────────────
function netDotClass(q: NetQuality): string {
  if (q === 0) return 'bg-gray-500';
  if (q <= 2)  return 'bg-emerald-400';
  if (q === 3) return 'bg-amber-400';
  return 'bg-red-400';
}

function netLabelText(q: NetQuality): string {
  const map: Record<NetQuality, string> = {
    0: 'Checking', 1: 'Excellent', 2: 'Good',
    3: 'Fair',     4: 'Poor',     5: 'Bad', 6: 'Lost',
  };
  return map[q];
}

// ── Role-to-style lookup tables (Classroom.tsx color palette) ─────────────────
const roleBadgeClass: Record<RoleBadge, string> = {
  Teacher: 'bg-violet-500/90 text-white',
  Student: 'bg-teal-500/90 text-white',
  You:     'bg-blue-500/90 text-white',
};

const roleAvatarClass: Record<RoleBadge, string> = {
  Teacher: 'bg-violet-600',
  Student: 'bg-teal-600',
  You:     'bg-blue-600',
};

// ── VideoTile ─────────────────────────────────────────────────────────────────
interface VideoTileProps {
  videoTrack: PlayableVideoTrack | null | undefined;
  label: string;
  roleBadge: RoleBadge;
  cameraActive: boolean;
  micActive: boolean;
  /** Network quality — rendered only when provided (local tile) */
  netQuality?: NetQuality;
}

/**
 * Memoized single-participant tile.
 * Handles its own ref+play lifecycle: when `videoTrack` changes,
 * useCallback produces a new ref callback → React detaches old ref (null)
 * and re-attaches new one (DOM node) → track.play(node) fires automatically.
 */
const VideoTile = memo(function VideoTile({
  videoTrack,
  label,
  roleBadge,
  cameraActive,
  micActive,
  netQuality,
}: VideoTileProps) {
  const videoRef = useCallback(
    (node: HTMLDivElement | null) => { if (node && videoTrack) videoTrack.play(node); },
    [videoTrack],
  );

  return (
    <div className="relative w-full h-full bg-gray-800 overflow-hidden">

      {/* ── Video surface ─────────────────────────────────────────────── */}
      <div
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      />

      {/* ── Camera-off placeholder ────────────────────────────────────── */}
      {!cameraActive && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gray-800"
          aria-label={`${label} camera is off`}
        >
          <div
            className={`w-9 h-9 rounded-full ${roleAvatarClass[roleBadge]} flex items-center justify-center text-sm font-bold text-white shadow-md shrink-0`}
            aria-hidden="true"
          >
            {label.charAt(0).toUpperCase()}
          </div>
          <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-widest select-none">
            Camera off
          </span>
        </div>
      )}

      {/* ── Top-left: mic muted badge ─────────────────────────────────── */}
      {!micActive && (
        <div
          className="absolute top-1.5 left-1.5 flex items-center bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md"
          aria-label={`${label} microphone is muted`}
        >
          <MicOff size={9} className="text-red-400" aria-hidden="true" />
        </div>
      )}

      {/* ── Top-right: network quality (local tile only) ──────────────── */}
      {netQuality !== undefined && (
        <div
          className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md"
          title={`Network: ${netLabelText(netQuality)}`}
          aria-label={`Network quality: ${netLabelText(netQuality)}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${netDotClass(netQuality)}`}
            aria-hidden="true"
          />
          {/* Label only visible on the larger desktop PiP size */}
          <span className="hidden md:inline text-[8px] font-semibold text-white/60 uppercase tracking-wide select-none">
            {netLabelText(netQuality)}
          </span>
        </div>
      )}

      {/* ── Bottom: name + role badge + mic status dot ────────────────── */}
      <div className="absolute bottom-0 inset-x-0 p-1.5">
        <div className="flex items-center gap-1 w-full bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-white/[0.08] overflow-hidden">
          {/* Mic / live status dot */}
          <span
            className={`shrink-0 w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
              micActive ? 'bg-emerald-400' : 'bg-red-400'
            }`}
            aria-hidden="true"
          />
          {/* Participant name */}
          <span className="text-[9px] font-bold text-white uppercase tracking-tight truncate flex-1 min-w-0 select-none">
            {label}
          </span>
          {/* Role badge */}
          <span
            className={`shrink-0 text-[8px] font-bold px-1 py-px rounded-sm select-none ${roleBadgeClass[roleBadge]}`}
          >
            {roleBadge}
          </span>
        </div>
      </div>
    </div>
  );
});

// ── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div
      className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-2 select-none"
      aria-label="Video connecting"
      role="status"
    >
      {/* Avatar skeleton */}
      <div className="w-9 h-9 rounded-full bg-gray-700 animate-pulse" aria-hidden="true" />

      {/* Spinner + label */}
      <div className="flex items-center gap-1.5">
        <Loader2 size={10} className="animate-spin text-blue-500 shrink-0" aria-hidden="true" />
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
          Connecting…
        </span>
      </div>

      {/* Bar skeletons */}
      <div className="w-16 space-y-1 mt-0.5" aria-hidden="true">
        <div className="h-1 bg-gray-700 rounded-full animate-pulse" />
        <div className="h-1 bg-gray-700 rounded-full animate-pulse w-3/4 mx-auto" />
      </div>
    </div>
  );
}

// ── Error panel ───────────────────────────────────────────────────────────────
function ErrorPanel({ kind }: { kind: ErrorKind }) {
  const messages: Record<ErrorKind, string> = {
    permission: 'Permission\ndenied',
    notfound:   'Device not\nfound',
    unknown:    'Connection\nfailed',
  };
  return (
    <div
      className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-2 p-2 text-center select-none"
      role="alert"
      aria-label={`Video error: ${messages[kind]}`}
    >
      <div
        className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0"
        aria-hidden="true"
      >
        <AlertTriangle size={14} className="text-red-400" />
      </div>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-snug whitespace-pre-line">
        {messages[kind]}
      </p>
    </div>
  );
}

// ── Waiting overlay ───────────────────────────────────────────────────────────
// Rendered on top of the local tile when no remote participant has joined yet.
function WaitingOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none"
      aria-live="polite"
      aria-label="Waiting for other participant to join"
    >
      {/* Bouncing dots */}
      <div className="flex items-center gap-0.5" aria-hidden="true">
        {([0, 150, 300] as const).map((delay) => (
          <span
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className="text-[9px] font-bold text-gray-400/80 uppercase tracking-wider">
        Waiting…
      </span>
    </div>
  );
}

// ── Main VideoRoom component ──────────────────────────────────────────────────
export default function VideoRoom({
  appId,
  channelName,
  token,
  uid,
  micOn,
  cameraOn,
  // onToggleMic and onToggleCamera are not destructured here — controls are
  // handled entirely by Classroom.tsx's control bar. The props exist in the
  // interface for external API compatibility (matching original behaviour).
}: VideoRoomProps) {

  // ── Agora state (completely unchanged) ────────────────────────────────────
  const [loading, setLoading]         = useState(true);
  const [localTracks, setLocalTracks] = useState<[IMicrophoneAudioTrack, ICameraVideoTrack] | []>([]);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  // ── UI-only state (additive — does not touch Agora logic) ─────────────────
  const [error, setError]               = useState<ErrorKind | null>(null);
  const [networkQuality, setNetQuality] = useState<NetQuality>(0);

  // ── Agora initialization effect ───────────────────────────────────────────
  // Logic: completely unchanged (join / publish / track creation / cleanup).
  // Additions: network-quality listener (UI display only); typed error classification.
  useEffect(() => {
    let mounted = true;

    const initAgora = async () => {
      try {
        client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

        // ── Unchanged event handlers ────────────────────────────────────────
        client.on('user-published', async (user, mediaType) => {
          await client?.subscribe(user, mediaType);

          if (mediaType === 'video') {
            setRemoteUsers(prev => {
              if (prev.find(u => u.uid === user.uid)) return prev;
              return [...prev, user];
            });
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }
        });

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
          }
        });

        // ── UI-only addition: network quality monitoring ─────────────────────
        client.on('network-quality', (stats) => {
          if (mounted) setNetQuality(stats.uplinkNetworkQuality as NetQuality);
        });

        // ── Unchanged: join + create tracks + publish ───────────────────────
        await client.join(appId, channelName, token, uid);

        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

        if (mounted) {
          setLocalTracks([audioTrack, videoTrack]);
          setLoading(false);
          await client.publish([audioTrack, videoTrack]);

          if (!micOn)    await audioTrack.setEnabled(false);
          if (!cameraOn) await videoTrack.setEnabled(false);
        }
      } catch (err) {
        console.error('Agora RTC Initialization Failed:', err);
        if (mounted) {
          // UI-only: classify error for display; original console.error preserved
          const name = (err as Error)?.name ?? '';
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            setError('permission');
          } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
            setError('notfound');
          } else {
            setError('unknown');
          }
          setLoading(false);
        }
      }
    };

    if (token && channelName) initAgora();

    // ── Unchanged cleanup ───────────────────────────────────────────────────
    return () => {
      mounted = false;
      localTracks.forEach(track => { track.stop(); track.close(); });
      if (client) { client.leave(); client = null; }
    };
  // Dependency array: unchanged
  }, [appId, channelName, token, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mic toggle effect (completely unchanged) ──────────────────────────────
  useEffect(() => {
    if (localTracks[0]) localTracks[0].setEnabled(micOn);
  }, [micOn, localTracks]);

  // ── Camera toggle effect (completely unchanged) ───────────────────────────
  useEffect(() => {
    if (localTracks[1]) localTracks[1].setEnabled(cameraOn);
  }, [cameraOn, localTracks]);

  // ── Render: early exit states ─────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;
  if (error)   return <ErrorPanel kind={error} />;

  const hasRemote = remoteUsers.length > 0;

  // ── Render: main layout ───────────────────────────────────────────────────
  return (
    <div
      className="w-full h-full relative bg-gray-900 overflow-hidden"
      role="region"
      aria-label="Video call"
    >
      {/*
        Grid: gap-px creates a 1px dark seam between tiles (gray-900 bleeds through).
        Single column when alone (local only + waiting overlay).
        Two columns when remote participant is present.
      */}
      <div className={`grid h-full gap-px ${hasRemote ? 'grid-cols-2' : 'grid-cols-1'}`}>

        {/* ── Local tile ─────────────────────────────────────────────── */}
        <VideoTile
          videoTrack={localTracks[1] ?? null}
          label="You"
          roleBadge="You"
          cameraActive={cameraOn}
          micActive={micOn}
          netQuality={networkQuality}
        />

        {/* ── Remote tiles ───────────────────────────────────────────── */}
        {remoteUsers.map(user => (
          <VideoTile
            key={String(user.uid)}
            videoTrack={user.videoTrack ?? null}
            label="Teacher"
            roleBadge="Teacher"
            cameraActive={!!user.videoTrack}
            micActive={!!user.audioTrack}
          />
        ))}
      </div>

      {/* Waiting overlay — shown when no remote participant has joined yet */}
      {!hasRemote && <WaitingOverlay />}
    </div>
  );
}
