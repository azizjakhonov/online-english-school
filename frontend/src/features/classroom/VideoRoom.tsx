/**
 * VideoRoom.tsx — LiveKit PiP Video Component
 * ──────────────────────────────────────────────────
 * Migrated from Agora RTC SDK to livekit-client.
 *
 * UI components (VideoTile, LoadingSkeleton, ErrorPanel, WaitingOverlay)
 * are preserved from the original design.
 *
 * LIVEKIT LOGIC:
 *   - Room created with adaptiveStream + dynacast
 *   - room.connect(livekitUrl, token) for join
 *   - LocalParticipant camera/mic toggled via setCameraEnabled / setMicrophoneEnabled
 *   - Remote tracks subscribed via RoomEvent.TrackSubscribed / TrackUnsubscribed
 *   - Video elements attached natively via track.attach() / track.detach()
 *   - ConnectionQuality mapped to legacy NetQuality display scale
 *   - Cleanup via room.disconnect()
 */

import { useEffect, useState, useCallback, useRef, memo } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionQuality,
  type LocalParticipant,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type RemoteTrack,
} from 'livekit-client';
import { Loader2, MicOff, AlertTriangle } from 'lucide-react';

// ── Public props interface ─────────────────────────────────────────────────────
export interface VideoRoomProps {
  livekitUrl: string;
  roomName: string;
  token: string;
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
}

// ── Internal types ────────────────────────────────────────────────────────────
// Mapped from LiveKit ConnectionQuality to a 0-6 display scale:
//   0=unknown/checking, 1=excellent, 2=good, 3=fair, 4=poor, 5=bad, 6=lost
type NetQuality = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type ErrorKind = 'permission' | 'notfound' | 'unknown';
type RoleBadge = 'You' | 'Teacher' | 'Student';

function lkQualityToNet(q: ConnectionQuality): NetQuality {
  switch (q) {
    case ConnectionQuality.Excellent: return 1;
    case ConnectionQuality.Good: return 2;
    case ConnectionQuality.Poor: return 4;
    case ConnectionQuality.Lost: return 6;
    default: return 0;
  }
}

// ── Network quality display helpers ───────────────────────────────────────────
function netDotClass(q: NetQuality): string {
  if (q === 0) return 'bg-gray-500';
  if (q <= 2) return 'bg-emerald-400';
  if (q === 3) return 'bg-amber-400';
  return 'bg-red-400';
}

function netLabelText(q: NetQuality): string {
  const map: Record<NetQuality, string> = {
    0: 'Checking', 1: 'Excellent', 2: 'Good',
    3: 'Fair', 4: 'Poor', 5: 'Bad', 6: 'Lost',
  };
  return map[q];
}

// ── Role-to-style lookup tables ───────────────────────────────────────────────
const roleBadgeClass: Record<RoleBadge, string> = {
  Teacher: 'bg-violet-500/90 text-white',
  Student: 'bg-teal-500/90 text-white',
  You: 'bg-blue-500/90 text-white',
};

const roleAvatarClass: Record<RoleBadge, string> = {
  Teacher: 'bg-violet-600',
  Student: 'bg-teal-600',
  You: 'bg-blue-600',
};

// ── VideoTile ─────────────────────────────────────────────────────────────────
interface VideoTileProps {
  /** Attach function: given a container div, attach the track's video element inside it */
  attachVideo: (container: HTMLDivElement | null) => void;
  label: string;
  roleBadge: RoleBadge;
  cameraActive: boolean;
  micActive: boolean;
  netQuality?: NetQuality;
}

const VideoTile = memo(function VideoTile({
  attachVideo,
  label,
  roleBadge,
  cameraActive,
  micActive,
  netQuality,
}: VideoTileProps) {
  // Use a stable callback ref — when attachVideo identity changes (track changed),
  // React calls this with null then the new node, triggering re-attachment.
  const containerRef = useCallback(
    (node: HTMLDivElement | null) => { attachVideo(node); },
    [attachVideo],
  );

  return (
    <div className="relative w-full h-full bg-gray-800 overflow-hidden">

      {/* ── Video surface ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
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
            className={`shrink-0 w-1.5 h-1.5 rounded-full transition-colors duration-300 ${micActive ? 'bg-emerald-400' : 'bg-red-400'
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
      <div className="w-9 h-9 rounded-full bg-gray-700 animate-pulse" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <Loader2 size={10} className="animate-spin text-blue-500 shrink-0" aria-hidden="true" />
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">
          Connecting…
        </span>
      </div>
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
    notfound: 'Device not\nfound',
    unknown: 'Connection\nfailed',
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
function WaitingOverlay() {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none select-none"
      aria-live="polite"
      aria-label="Waiting for other participant to join"
    >
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

// ── Remote participant info ────────────────────────────────────────────────────
interface RemoteParticipantInfo {
  participant: RemoteParticipant;
  videoTrack: RemoteTrack | null;
  audioMuted: boolean;
  cameraMuted: boolean;
}

// ── Main VideoRoom component ──────────────────────────────────────────────────
export default function VideoRoom({
  livekitUrl,
  roomName,
  token,
  micOn,
  cameraOn,
}: VideoRoomProps) {

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [networkQuality, setNetQuality] = useState<NetQuality>(0);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [localCameraOn, setLocalCameraOn] = useState(cameraOn);
  const [localMicOn, setLocalMicOn] = useState(micOn);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipantInfo[]>([]);

  // Keep room reference stable across renders for cleanup
  const roomRef = useRef<Room | null>(null);

  // ── Connect to LiveKit room ───────────────────────────────────────────────
  useEffect(() => {
    if (!livekitUrl || !roomName || !token) return;

    let mounted = true;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
    roomRef.current = room;

    // Helper to snapshot remote participants state
    const refreshRemotes = () => {
      if (!mounted) return;
      const infos: RemoteParticipantInfo[] = [];
      room.remoteParticipants.forEach((p) => {
        const camPub = p.getTrackPublication(Track.Source.Camera);
        const micPub = p.getTrackPublication(Track.Source.Microphone);
        infos.push({
          participant: p,
          videoTrack: camPub?.track ?? null,
          cameraMuted: camPub?.isMuted ?? true,
          audioMuted: micPub?.isMuted ?? true,
        });
      });
      setRemoteParticipants(infos);
    };

    // ── Event listeners ───────────────────────────────────────────────────
    room
      .on(RoomEvent.TrackSubscribed, (_track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
        refreshRemotes();
      })
      .on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
        refreshRemotes();
      })
      .on(RoomEvent.TrackMuted, () => refreshRemotes())
      .on(RoomEvent.TrackUnmuted, () => refreshRemotes())
      .on(RoomEvent.ParticipantConnected, () => refreshRemotes())
      .on(RoomEvent.ParticipantDisconnected, () => refreshRemotes())
      .on(RoomEvent.LocalTrackPublished, () => {
        if (mounted) setLocalParticipant(room.localParticipant);
      })
      .on(RoomEvent.LocalTrackUnpublished, () => {
        if (mounted) setLocalParticipant(room.localParticipant);
      })
      .on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality, participant) => {
        // Only track local participant's quality for the network indicator
        if (participant.identity === room.localParticipant.identity) {
          if (mounted) setNetQuality(lkQualityToNet(quality));
        }
      });

    // ── Connect + publish local tracks ───────────────────────────────────
    const connect = async () => {
      try {
        await room.connect(livekitUrl, token, {
          autoSubscribe: true,
        });

        if (!mounted) return;

        // Enable camera and mic according to initial prop state
        await room.localParticipant.setCameraEnabled(cameraOn);
        await room.localParticipant.setMicrophoneEnabled(micOn);

        if (mounted) {
          setLocalParticipant(room.localParticipant);
          setLoading(false);
          refreshRemotes();
        }
      } catch (err) {
        console.error('LiveKit connection failed:', err);
        if (!mounted) return;
        const name = (err as Error)?.name ?? '';
        const msg = (err as Error)?.message ?? '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('permission');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setError('notfound');
        } else if (msg.toLowerCase().includes('permission')) {
          setError('permission');
        } else {
          setError('unknown');
        }
        setLoading(false);
      }
    };

    connect();

    return () => {
      mounted = false;
      room.disconnect();
      roomRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livekitUrl, roomName, token]);

  // ── Mic toggle effect ────────────────────────────────────────────────────
  useEffect(() => {
    setLocalMicOn(micOn);
    if (roomRef.current?.localParticipant) {
      roomRef.current.localParticipant.setMicrophoneEnabled(micOn).catch(console.error);
    }
  }, [micOn]);

  // ── Camera toggle effect ─────────────────────────────────────────────────
  useEffect(() => {
    setLocalCameraOn(cameraOn);
    if (roomRef.current?.localParticipant) {
      roomRef.current.localParticipant.setCameraEnabled(cameraOn).catch(console.error);
    }
  }, [cameraOn]);

  // ── Build attach callbacks ────────────────────────────────────────────────

  // Local camera attach: use the published camera track's HTMLVideoElement
  const localCameraTrack = localParticipant
    ?.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null;

  const attachLocalVideo = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return;
      // Clear previous children
      container.innerHTML = '';
      if (localCameraTrack && localCameraOn) {
        const el = localCameraTrack.attach();
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        el.style.position = 'absolute';
        el.style.inset = '0';
        container.appendChild(el);
      }
    },
    [localCameraTrack, localCameraOn],
  );

  // ── Render: early exit states ─────────────────────────────────────────────
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorPanel kind={error} />;

  const hasRemote = remoteParticipants.length > 0;

  return (
    <div
      className="w-full h-full relative bg-gray-900 overflow-hidden"
      role="region"
      aria-label="Video call"
    >
      <div className={`grid h-full gap-px ${hasRemote ? 'grid-cols-2' : 'grid-cols-1'}`}>

        {/* ── Local tile ─────────────────────────────────────────────── */}
        <VideoTile
          attachVideo={attachLocalVideo}
          label="You"
          roleBadge="You"
          cameraActive={localCameraOn}
          micActive={localMicOn}
          netQuality={networkQuality}
        />

        {/* ── Remote tiles ───────────────────────────────────────────── */}
        {remoteParticipants.map(({ participant, videoTrack, cameraMuted, audioMuted }) => (
          <RemoteTile
            key={participant.sid}
            videoTrack={videoTrack}
            cameraMuted={cameraMuted}
            audioMuted={audioMuted}
            label="Teacher"
            roleBadge="Teacher"
          />
        ))}
      </div>

      {/* Waiting overlay — shown when no remote participant has joined yet */}
      {!hasRemote && <WaitingOverlay />}
    </div>
  );
}

// ── RemoteTile — handles its own track attachment lifecycle ────────────────────
interface RemoteTileProps {
  videoTrack: RemoteTrack | null;
  cameraMuted: boolean;
  audioMuted: boolean;
  label: string;
  roleBadge: RoleBadge;
}

const RemoteTile = memo(function RemoteTile({
  videoTrack,
  cameraMuted,
  audioMuted,
  label,
  roleBadge,
}: RemoteTileProps) {
  const attachRemoteVideo = useCallback(
    (container: HTMLDivElement | null) => {
      if (!container) return;
      container.innerHTML = '';
      if (videoTrack && !cameraMuted) {
        const el = videoTrack.attach();
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'cover';
        el.style.position = 'absolute';
        el.style.inset = '0';
        container.appendChild(el);
      }
    },
    [videoTrack, cameraMuted],
  );

  return (
    <VideoTile
      attachVideo={attachRemoteVideo}
      label={label}
      roleBadge={roleBadge}
      cameraActive={!cameraMuted}
      micActive={!audioMuted}
    />
  );
});
