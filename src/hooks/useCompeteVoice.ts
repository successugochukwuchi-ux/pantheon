import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'weak'
  | 'reconnecting'
  | 'failed'
  | 'opponent_left';

export interface AudioInputOption {
  deviceId: string;
  label: string;
}

const MIC_STORAGE_KEY = 'colearn_compete_mic_id';
const VIRTUAL_MIC_REGEX = /droidcam|virtual|vb-audio|voicemeeter|cable output|stereo mix|obs\b|ndi\b|blackhole|soundflower/i;

interface UseCompeteVoiceOptions {
  matchId: string | null | undefined;
  userId: string | null | undefined;
  creatorId: string | null | undefined;
  opponentId: string | null | undefined;
  isActivePhase: boolean; // true during 'playing' and 'results'
}

interface TurnConfig {
  enabled: boolean;
  turnUrl: string;
  username: string;
  password: string;
}

interface SerializedIceCandidate {
  candidate: string;
  sdpMid: string;
  sdpMLineIndex: number;
}

interface VoiceSignalPayload {
  offer?: {
    type: RTCSdpType;
    sdp: string;
    epoch: number;
    offerId: string;
    candidates?: SerializedIceCandidate[];
  };
  answer?: {
    type: RTCSdpType;
    sdp: string;
    epoch: number;
    offerId: string;
    candidates?: SerializedIceCandidate[];
  };
  lateCreatorCandidates?: SerializedIceCandidate[];
  lateOpponentCandidates?: SerializedIceCandidate[];
  retryRequestedAt?: number;
  creatorUid?: string;
  opponentUid?: string;
  updatedAt?: number;
}

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const DEFAULT_TURN_CONFIG: TurnConfig = {
  enabled: true,
  turnUrl: 'free.expressturn.com:3478',
  username: '000000002110604429',
  password: 'sxIG9WI/Ghq1G61Q/qPydjqh9fY=',
};

const TURN_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedTurnConfig: { data: TurnConfig; fetchedAt: number } | null = null;

async function getTurnConfig(forceRefresh = false): Promise<TurnConfig> {
  if (!forceRefresh && cachedTurnConfig && Date.now() - cachedTurnConfig.fetchedAt < TURN_CACHE_TTL_MS) {
    return cachedTurnConfig.data;
  }
  try {
    const snap = await getDoc(doc(db, 'system', 'webrtc'));
    if (snap.exists()) {
      const d = snap.data();
      const resolved: TurnConfig = {
        enabled: typeof d.enabled === 'boolean' ? d.enabled : DEFAULT_TURN_CONFIG.enabled,
        turnUrl: typeof d.turnUrl === 'string' && d.turnUrl.trim() ? d.turnUrl.trim() : DEFAULT_TURN_CONFIG.turnUrl,
        username: typeof d.username === 'string' && d.username.trim() ? d.username.trim() : DEFAULT_TURN_CONFIG.username,
        password: typeof d.password === 'string' && d.password.trim() ? d.password.trim() : DEFAULT_TURN_CONFIG.password,
      };
      cachedTurnConfig = { data: resolved, fetchedAt: Date.now() };
      return resolved;
    }
  } catch (err) {
    console.warn('[CompeteVoice] Could not read system/webrtc, using default ExpressTURN config:', err);
  }
  cachedTurnConfig = { data: DEFAULT_TURN_CONFIG, fetchedAt: Date.now() };
  return DEFAULT_TURN_CONFIG;
}

function buildIceServers(turnCfg: TurnConfig): { iceServers: RTCIceServer[]; turnEnabled: boolean } {
  const servers: RTCIceServer[] = [...STUN_SERVERS];
  const rawUrl = (turnCfg.turnUrl || '').trim();
  const username = (turnCfg.username || '').trim();
  const credential = (turnCfg.password || '').trim();

  if (!turnCfg.enabled || !rawUrl || !username || !credential) {
    return { iceServers: servers, turnEnabled: false };
  }

  let addedTurn = false;
  const entries = rawUrl
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const clean = entry.replace(/^turns?:/i, '').split('?')[0];
    if (!clean) continue;
    if (entry.toLowerCase().startsWith('turns:')) {
      servers.push({ urls: `turns:${clean}?transport=tcp`, username, credential });
    } else {
      servers.push({ urls: `turn:${clean}?transport=udp`, username, credential });
      servers.push({ urls: `turn:${clean}?transport=tcp`, username, credential });
    }
    addedTurn = true;
  }

  return { iceServers: servers, turnEnabled: addedTurn };
}

const TARGET_OPUS_BITRATE_BPS = 24000; // ~10 MB/hr, clear continuous mono speech on 3G/4G
const MAX_ICE_GATHER_WAIT_MS = 4500; // Allow STUN + TURN relay allocation to finish
const CANDIDATE_GRACE_MS = 400; // Short grace once expected srflx/relay candidate arrives
const LATE_CANDIDATE_WINDOW_MS = 5000; // Optional single batch flush if candidate arrives after 4.5s
const MAX_ICE_RESTARTS = 2; // Cap automatic ICE restarts to minimize Firestore writes
const CONNECT_WATCHDOG_MS = 18000;

/**
 * Safely tunes the Opus codec in an SDP string without violating RFC 4566 line order:
 * - Configures mono audio, 24kbps target average bitrate, FEC, and disables DTX
 *   so quiet/mobile-web microphone speech is never gated out.
 */
function tuneOpusSdp(sdp: string, bitrateBps = TARGET_OPUS_BITRATE_BPS): string {
  if (!sdp) return sdp;
  const lineEnding = sdp.includes('\r\n') ? '\r\n' : '\n';
  const lines = sdp.split(/\r?\n/);
  const opusRtpmapRegex = /^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/i;
  let opusPt: string | null = null;

  for (const line of lines) {
    const match = line.match(opusRtpmapRegex);
    if (match) {
      opusPt = match[1];
      break;
    }
  }

  if (!opusPt) return sdp;

  const fmtpPrefix = `a=fmtp:${opusPt} `;
  let hasFmtp = false;

  const updatedLines = lines.map((line) => {
    if (line.startsWith(fmtpPrefix)) {
      hasFmtp = true;
      const existingParams = line
        .slice(fmtpPrefix.length)
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean);
      const paramMap = new Map<string, string>();

      for (const param of existingParams) {
        const eqIdx = param.indexOf('=');
        if (eqIdx > -1) {
          paramMap.set(param.slice(0, eqIdx).trim(), param.slice(eqIdx + 1).trim());
        } else {
          paramMap.set(param, '');
        }
      }

      paramMap.set('minptime', '10');
      paramMap.set('useinbandfec', '1');
      paramMap.set('usedtx', '0');
      paramMap.set('stereo', '0');
      paramMap.set('sprop-stereo', '0');
      paramMap.set('cbr', '0');
      paramMap.set('maxaveragebitrate', String(bitrateBps));

      const serialized = Array.from(paramMap.entries())
        .map(([k, v]) => (v === '' ? k : `${k}=${v}`))
        .join(';');
      return `${fmtpPrefix}${serialized}`;
    }
    return line;
  });

  const rtpmapIdx = updatedLines.findIndex((l) => l.startsWith(`a=rtpmap:${opusPt} `));
  if (rtpmapIdx !== -1 && !hasFmtp) {
    updatedLines.splice(
      rtpmapIdx + 1,
      0,
      `${fmtpPrefix}minptime=10;useinbandfec=1;usedtx=0;stereo=0;sprop-stereo=0;cbr=0;maxaveragebitrate=${bitrateBps}`
    );
  }

  return updatedLines.join(lineEnding);
}

function serializeCandidate(c: RTCIceCandidate): SerializedIceCandidate | null {
  if (!c?.candidate) return null;
  return {
    candidate: c.candidate,
    sdpMid: c.sdpMid ?? '0',
    sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : 0,
  };
}

function summarizeCandidates(candidates: SerializedIceCandidate[]): string {
  let host = 0;
  let srflx = 0;
  let relay = 0;
  for (const c of candidates) {
    if (c.candidate.includes(' typ srflx ')) srflx += 1;
    else if (c.candidate.includes(' typ relay ')) relay += 1;
    else if (c.candidate.includes(' typ host ')) host += 1;
  }
  return `total=${candidates.length} (host=${host}, srflx=${srflx}, relay=${relay})`;
}

interface SilentAudioPlaceholder {
  ctx: AudioContext | null;
  osc: OscillatorNode | null;
  stream: MediaStream;
  track: MediaStreamTrack;
}

function createSilentAudioPlaceholder(): SilentAudioPlaceholder | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    const ctx = new AudioCtx();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(dest);
    try {
      osc.start();
    } catch {
      // Ignore if AudioContext is suspended prior to user gesture
    }
    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      try {
        osc.disconnect();
        gain.disconnect();
        ctx.close().catch(() => {});
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }
    track.enabled = false;
    return { ctx, osc, stream: dest.stream, track };
  } catch {
    return null;
  }
}

function disposeSilentAudioPlaceholder(placeholder: SilentAudioPlaceholder | null) {
  if (!placeholder) return;
  try {
    placeholder.osc?.stop();
  } catch {
    // Ignore
  }
  try {
    placeholder.osc?.disconnect();
  } catch {
    // Ignore
  }
  try {
    placeholder.stream.getTracks().forEach((t) => t.stop());
  } catch {
    // Ignore
  }
  try {
    placeholder.ctx?.close().catch(() => {});
  } catch {
    // Ignore
  }
}

export function useCompeteVoice({
  matchId,
  userId,
  creatorId,
  opponentId,
  isActivePhase,
}: UseCompeteVoiceOptions) {
  const [isMicOn, setIsMicOn] = useState(false);
  const [isMicBusy, setIsMicBusy] = useState(false);
  const [isOpponentMuted, setIsOpponentMuted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [audioDevices, setAudioDevices] = useState<AudioInputOption[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => {
    try {
      return localStorage.getItem(MIC_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const silentPlaceholderRef = useRef<SilentAudioPlaceholder | null>(null);
  const placeholderBoundToSenderRef = useRef<boolean>(false);
  const hasRenegotiatedMicRef = useRef<boolean>(false);
  const publishOfferRef = useRef<((iceRestart?: boolean, isRenegotiate?: boolean) => Promise<void>) | null>(null);
  const silentChecksRef = useRef<number>(0);
  const warnedSilentMicRef = useRef<boolean>(false);

  const isOpponentMutedRef = useRef(isOpponentMuted);
  isOpponentMutedRef.current = isOpponentMuted;

  const isOfferer = Boolean(userId && creatorId && userId === creatorId);
  const isHumanMatch = Boolean(
    matchId &&
      userId &&
      creatorId &&
      opponentId &&
      opponentId !== 'bot_colearn' &&
      isActivePhase
  );

  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));
  const offerEpochRef = useRef<number>(0);
  const currentOfferIdRef = useRef<string>('');
  const appliedOfferIdRef = useRef<string>('');
  const appliedAnswerIdRef = useRef<string>('');
  const lastHandledRetryRef = useRef<number>(0);
  const restartCountRef = useRef<number>(0);
  const sawSignalDocRef = useRef<boolean>(false);
  const hasLeftExplicitlyRef = useRef<boolean>(false);
  const disconnectGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshAudioDevices = useCallback(async (): Promise<AudioInputOption[]> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const seen = new Set<string>();
      const inputs: AudioInputOption[] = [];
      let fallbackIdx = 1;
      for (const d of devices) {
        if (d.kind !== 'audioinput' || !d.deviceId || d.deviceId === 'communications') continue;
        if (seen.has(d.deviceId)) continue;
        seen.add(d.deviceId);
        const label = d.label?.trim() || (d.deviceId === 'default' ? 'System Default Mic' : `Microphone ${fallbackIdx++}`);
        inputs.push({ deviceId: d.deviceId, label });
      }
      setAudioDevices(inputs);
      return inputs;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    if (!isHumanMatch || typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    refreshAudioDevices();
    const handleDeviceChange = () => {
      refreshAudioDevices();
    };
    navigator.mediaDevices.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [isHumanMatch, refreshAudioDevices]);

  const stopLocalMicTrack = useCallback(async () => {
    if (audioSenderRef.current) {
      try {
        const placeholderTrack = silentPlaceholderRef.current?.track;
        const nextTrack = placeholderTrack && placeholderTrack.readyState === 'live' ? placeholderTrack : null;
        if (nextTrack) {
          nextTrack.enabled = false;
        }
        await audioSenderRef.current.replaceTrack(nextTrack);
      } catch {
        // Ignore if peer connection already closed
      }
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    silentChecksRef.current = 0;
    warnedSilentMicRef.current = false;
    setIsMicOn(false);
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (disconnectGraceTimerRef.current) {
      clearTimeout(disconnectGraceTimerRef.current);
      disconnectGraceTimerRef.current = null;
    }
    if (connectWatchdogRef.current) {
      clearTimeout(connectWatchdogRef.current);
      connectWatchdogRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }

    disposeSilentAudioPlaceholder(silentPlaceholderRef.current);
    silentPlaceholderRef.current = null;
    placeholderBoundToSenderRef.current = false;
    hasRenegotiatedMicRef.current = false;
    publishOfferRef.current = null;

    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onicegatheringstatechange = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    audioSenderRef.current = null;
    remoteStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    offerEpochRef.current = 0;
    currentOfferIdRef.current = '';
    appliedOfferIdRef.current = '';
    appliedAnswerIdRef.current = '';
    restartCountRef.current = 0;
    sawSignalDocRef.current = false;

    setIsMicOn(false);
    setHasRemoteAudio(false);
  }, []);

  const leaveVoice = useCallback(
    async (targetMatchId?: string | null) => {
      hasLeftExplicitlyRef.current = true;
      const idToClean = targetMatchId || matchId;
      cleanupPeerConnection();
      setVoiceStatus('idle');
      setIsOpponentMuted(false);

      if (idToClean) {
        try {
          await deleteDoc(doc(db, 'compete_voice', idToClean));
        } catch {
          // Safe to ignore if already deleted by opponent or match ended
        }
      }
    },
    [cleanupPeerConnection, matchId]
  );

  const tryPlayRemoteAudio = useCallback(() => {
    const el = remoteAudioRef.current;
    if (!el || !el.srcObject) return;
    el.muted = isOpponentMutedRef.current;
    el.play().catch(() => {
      const resumeOnGesture = () => {
        if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.muted = isOpponentMutedRef.current;
          remoteAudioRef.current.play().catch(() => {});
        }
        window.removeEventListener('pointerdown', resumeOnGesture);
        window.removeEventListener('keydown', resumeOnGesture);
      };
      window.addEventListener('pointerdown', resumeOnGesture, { once: true });
      window.addEventListener('keydown', resumeOnGesture, { once: true });
    });
  }, []);

  const attachRemoteAudioElement = useCallback(
    (el: HTMLAudioElement | null) => {
      remoteAudioRef.current = el;
      if (el && remoteStreamRef.current) {
        el.srcObject = remoteStreamRef.current;
        tryPlayRemoteAudio();
      }
    },
    [tryPlayRemoteAudio]
  );

  useEffect(() => {
    if (!isHumanMatch || !matchId || !userId) {
      cleanupPeerConnection();
      setVoiceStatus('idle');
      return;
    }

    if (typeof RTCPeerConnection === 'undefined') {
      setVoiceStatus('failed');
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    let statsInterval: ReturnType<typeof setInterval> | null = null;
    let lateFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let activeFinishGathering: (() => void) | null = null;

    sessionIdRef.current = Math.random().toString(36).slice(2, 8);
    hasLeftExplicitlyRef.current = false;
    setVoiceStatus('connecting');

    const initVoice = async () => {
      const turnCfg = await getTurnConfig(retryTrigger > 0);
      if (cancelled) return;

      const { iceServers, turnEnabled } = buildIceServers(turnCfg);
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 2,
      });
      pcRef.current = pc;

      const localCandidatesMap = new Map<string, SerializedIceCandidate>();
      let hasSrflx = false;
      let hasRelay = false;
      let gatherResolve: (() => void) | null = null;
      let gatherMaxTimer: ReturnType<typeof setTimeout> | null = null;
      let gatherGraceTimer: ReturnType<typeof setTimeout> | null = null;
      let allowLateFlush = false;
      let sentLateFlush = false;

      const finishGathering = () => {
        if (gatherMaxTimer) {
          clearTimeout(gatherMaxTimer);
          gatherMaxTimer = null;
        }
        if (gatherGraceTimer) {
          clearTimeout(gatherGraceTimer);
          gatherGraceTimer = null;
        }
        if (gatherResolve) {
          const resolve = gatherResolve;
          gatherResolve = null;
          resolve();
        }
      };
      activeFinishGathering = finishGathering;

      const waitForGatheredCandidates = () => {
        if (pc.iceGatheringState === 'complete') {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          gatherResolve = resolve;
          gatherMaxTimer = setTimeout(finishGathering, MAX_ICE_GATHER_WAIT_MS);
          const readyToGrace = turnEnabled ? hasRelay : hasSrflx;
          if (readyToGrace) {
            gatherGraceTimer = setTimeout(finishGathering, CANDIDATE_GRACE_MS);
          }
        });
      };

      const signalDocRef = doc(db, 'compete_voice', matchId);

      pc.onicecandidate = (event) => {
        if (pcRef.current !== pc) return;

        if (!event.candidate) {
          finishGathering();
          return;
        }

        const serialized = serializeCandidate(event.candidate);
        if (!serialized) return;

        const isNew = !localCandidatesMap.has(serialized.candidate);
        localCandidatesMap.set(serialized.candidate, serialized);

        const isSrflx = serialized.candidate.includes(' typ srflx ');
        const isRelay = serialized.candidate.includes(' typ relay ');
        if (isSrflx) hasSrflx = true;
        if (isRelay) hasRelay = true;

        const shouldGrace = turnEnabled ? isRelay : isSrflx;
        if (shouldGrace && gatherResolve && !gatherGraceTimer) {
          gatherGraceTimer = setTimeout(finishGathering, CANDIDATE_GRACE_MS);
        }

        const shouldFlushLate = turnEnabled ? isRelay : isSrflx;
        if (shouldFlushLate && allowLateFlush && !sentLateFlush && isNew) {
          if (lateFlushTimer) clearTimeout(lateFlushTimer);
          lateFlushTimer = setTimeout(async () => {
            if (sentLateFlush || pcRef.current !== pc || pc.iceConnectionState === 'closed') return;
            sentLateFlush = true;
            const field = isOfferer ? 'lateCreatorCandidates' : 'lateOpponentCandidates';
            try {
              await updateDoc(signalDocRef, {
                [field]: Array.from(localCandidatesMap.values()),
                updatedAt: Date.now(),
              });
              console.log('[CompeteVoice] Sent 1 batched late candidate flush');
            } catch {
              // Ignore if doc deleted
            }
          }, 250);
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          finishGathering();
        }
      };

      const addedRemoteCandidates = new Set<string>();
      const pendingRemoteCandidates: SerializedIceCandidate[] = [];

      const applyRemoteCandidates = async (candidates?: SerializedIceCandidate[]) => {
        if (!candidates || candidates.length === 0) return;
        for (const c of candidates) {
          if (!c?.candidate || addedRemoteCandidates.has(c.candidate)) continue;
          if (!pc.remoteDescription) {
            pendingRemoteCandidates.push(c);
            continue;
          }
          addedRemoteCandidates.add(c.candidate);
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {
            // Ignore duplicate/unsupported candidates
          }
        }
      };

      const drainPendingRemoteCandidates = async () => {
        if (!pc.remoteDescription || pendingRemoteCandidates.length === 0) return;
        const queued = pendingRemoteCandidates.splice(0, pendingRemoteCandidates.length);
        await applyRemoteCandidates(queued);
      };

      const setSafeRemoteDescription = async (type: RTCSdpType, sdp: string) => {
        const tuned = tuneOpusSdp(sdp);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp: tuned }));
        } catch (err) {
          console.warn('[CompeteVoice] Tuned remote SDP rejected, falling back to raw SDP:', err);
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        }
        await drainPendingRemoteCandidates();
      };

      if (!silentPlaceholderRef.current || silentPlaceholderRef.current.track.readyState !== 'live') {
        disposeSilentAudioPlaceholder(silentPlaceholderRef.current);
        silentPlaceholderRef.current = createSilentAudioPlaceholder();
      }

      if (isOfferer) {
        const placeholder = silentPlaceholderRef.current;
        const transceiver = placeholder
          ? pc.addTransceiver(placeholder.track, {
              direction: 'sendrecv',
              streams: [placeholder.stream],
            })
          : pc.addTransceiver('audio', { direction: 'sendrecv' });
        placeholderBoundToSenderRef.current = Boolean(placeholder);
        audioSenderRef.current = transceiver.sender;
      }

      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        remoteStreamRef.current = stream;
        setHasRemoteAudio(true);

        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          tryPlayRemoteAudio();
        }
      };

      const startConnectWatchdog = () => {
        if (connectWatchdogRef.current) {
          clearTimeout(connectWatchdogRef.current);
        }
        connectWatchdogRef.current = setTimeout(() => {
          connectWatchdogRef.current = null;
          if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;
          const ice = pc.iceConnectionState;
          if (ice === 'connected' || ice === 'completed') return;
          console.warn('[CompeteVoice] ICE watchdog triggered. State:', ice, 'conn:', pc.connectionState);
          if (isOfferer && restartCountRef.current < 1) {
            attemptIceRestart();
          } else {
            setVoiceStatus('failed');
          }
        }, CONNECT_WATCHDOG_MS);
      };

      const publishOffer = async (iceRestart = false, isRenegotiate = false) => {
        if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;
        if (!iceRestart && pc.signalingState !== 'stable') return;
        try {
          const nextEpoch = offerEpochRef.current + 1;
          offerEpochRef.current = nextEpoch;
          const offerId = `${nextEpoch}_${sessionIdRef.current}_${Date.now()}`;
          currentOfferIdRef.current = offerId;

          if (!isRenegotiate || iceRestart) {
            localCandidatesMap.clear();
            hasSrflx = false;
            hasRelay = false;
            allowLateFlush = false;
            sentLateFlush = false;
          }

          const rawOffer = await pc.createOffer({ iceRestart });
          await pc.setLocalDescription(rawOffer);

          if (!isRenegotiate || iceRestart) {
            await waitForGatheredCandidates();
          }
          if (cancelled || pcRef.current !== pc || (pc.iceConnectionState as string) === 'closed') return;

          const gatheredList = Array.from(localCandidatesMap.values());
          const gotRequired = turnEnabled ? hasRelay : hasSrflx;
          if (!gotRequired && (!isRenegotiate || iceRestart)) {
            allowLateFlush = true;
            setTimeout(() => {
              allowLateFlush = false;
            }, LATE_CANDIDATE_WINDOW_MS);
          }

          const rawLocalSdp = pc.localDescription?.sdp || rawOffer.sdp || '';
          const finalSdp = tuneOpusSdp(rawLocalSdp);

          console.log(
            `[CompeteVoice] Publishing offer (epoch=${nextEpoch}, renegotiate=${isRenegotiate}, turn=${turnEnabled}) candidates:`,
            summarizeCandidates(gatheredList)
          );

          const payload: VoiceSignalPayload = {
            offer: {
              type: 'offer',
              sdp: finalSdp,
              epoch: nextEpoch,
              offerId,
              candidates: gatheredList,
            },
            creatorUid: creatorId || userId,
            opponentUid: opponentId || '',
            updatedAt: Date.now(),
          };

          if (iceRestart || isRenegotiate) {
            await updateDoc(signalDocRef, {
              offer: payload.offer,
              ...(iceRestart ? { lateCreatorCandidates: [] } : {}),
              updatedAt: payload.updatedAt,
            }).catch(async () => {
              await setDoc(signalDocRef, payload);
            });
          } else {
            await setDoc(signalDocRef, payload);
          }
        } catch (err) {
          console.warn('[CompeteVoice] Offer creation failed:', err);
        }
      };
      publishOfferRef.current = publishOffer;

      const attemptIceRestart = () => {
        if (!isOfferer) {
          setVoiceStatus('failed');
          return;
        }
        if (restartCountRef.current >= MAX_ICE_RESTARTS) {
          setVoiceStatus('failed');
          return;
        }
        restartCountRef.current += 1;
        setVoiceStatus('reconnecting');
        publishOffer(true);
      };

      const handleConnectionStateUpdate = () => {
        if (pcRef.current !== pc) return;
        const iceState = pc.iceConnectionState;
        const connState = pc.connectionState;
        console.log(`[CompeteVoice] State update -> ice=${iceState}, conn=${connState}`);

        if (iceState === 'connected' || iceState === 'completed' || connState === 'connected') {
          if (disconnectGraceTimerRef.current) {
            clearTimeout(disconnectGraceTimerRef.current);
            disconnectGraceTimerRef.current = null;
          }
          if (connectWatchdogRef.current) {
            clearTimeout(connectWatchdogRef.current);
            connectWatchdogRef.current = null;
          }
          restartCountRef.current = 0;
          setVoiceStatus('connected');
        } else if (iceState === 'disconnected') {
          setVoiceStatus('reconnecting');
          if (!disconnectGraceTimerRef.current) {
            disconnectGraceTimerRef.current = setTimeout(() => {
              disconnectGraceTimerRef.current = null;
              if (pcRef.current === pc && pc.iceConnectionState === 'disconnected') {
                attemptIceRestart();
              }
            }, 3500);
          }
        } else if (iceState === 'failed' || connState === 'failed') {
          if (connectWatchdogRef.current) {
            clearTimeout(connectWatchdogRef.current);
            connectWatchdogRef.current = null;
          }
          attemptIceRestart();
        } else if (iceState === 'closed' || connState === 'closed') {
          if (!hasLeftExplicitlyRef.current) {
            setVoiceStatus('opponent_left');
          }
        }
      };

      pc.oniceconnectionstatechange = handleConnectionStateUpdate;
      pc.onconnectionstatechange = handleConnectionStateUpdate;

      unsubscribe = onSnapshot(
        signalDocRef,
        async (snapshot) => {
          if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;

          if (!snapshot.exists()) {
            if (sawSignalDocRef.current && !hasLeftExplicitlyRef.current) {
              setVoiceStatus('opponent_left');
              cleanupPeerConnection();
            }
            return;
          }

          sawSignalDocRef.current = true;
          const data = snapshot.data() as VoiceSignalPayload;

          if (!isOfferer && data.offer && data.offer.offerId !== appliedOfferIdRef.current) {
            try {
              appliedOfferIdRef.current = data.offer.offerId;
              await setSafeRemoteDescription(data.offer.type, data.offer.sdp);
              await applyRemoteCandidates(data.offer.candidates);
              await applyRemoteCandidates(data.lateCreatorCandidates);

              if (!silentPlaceholderRef.current || silentPlaceholderRef.current.track.readyState !== 'live') {
                disposeSilentAudioPlaceholder(silentPlaceholderRef.current);
                silentPlaceholderRef.current = createSilentAudioPlaceholder();
              }
              const placeholder = silentPlaceholderRef.current;

              for (const t of pc.getTransceivers()) {
                if (
                  t.receiver.track?.kind === 'audio' ||
                  t.sender.track?.kind === 'audio' ||
                  t.mid !== null
                ) {
                  t.direction = 'sendrecv';
                  if (!audioSenderRef.current) {
                    audioSenderRef.current = t.sender;
                  }
                  const activeMicTrack = localStreamRef.current?.getAudioTracks()[0];
                  if (activeMicTrack && activeMicTrack.readyState === 'live' && localStreamRef.current) {
                    try {
                      if (t.sender.track !== activeMicTrack) {
                        await t.sender.replaceTrack(activeMicTrack);
                      }
                      if (typeof t.sender.setStreams === 'function') {
                        t.sender.setStreams(localStreamRef.current);
                      }
                    } catch {
                      // Non-fatal
                    }
                  } else if (placeholder && !localStreamRef.current && !t.sender.track) {
                    try {
                      await t.sender.replaceTrack(placeholder.track);
                      if (typeof t.sender.setStreams === 'function') {
                        t.sender.setStreams(placeholder.stream);
                      }
                      placeholderBoundToSenderRef.current = true;
                    } catch {
                      // Non-fatal if browser blocks track replacement prior to answer
                    }
                  }
                }
              }

              localCandidatesMap.clear();
              hasSrflx = false;
              hasRelay = false;
              allowLateFlush = false;
              sentLateFlush = false;

              let rawAnswer = await pc.createAnswer();
              if (rawAnswer?.sdp && rawAnswer.sdp.includes('a=recvonly') && !data.offer.sdp.includes('a=sendonly')) {
                pc.getTransceivers().forEach((t) => {
                  if (t.receiver.track?.kind === 'audio' || t.sender.track?.kind === 'audio' || t.mid !== null) {
                    t.direction = 'sendrecv';
                  }
                });
                await new Promise((r) => setTimeout(r, 100));
                if (cancelled || pcRef.current !== pc || (pc.iceConnectionState as string) === 'closed') return;
                rawAnswer = await pc.createAnswer();
              }
              await pc.setLocalDescription(rawAnswer);

              await waitForGatheredCandidates();
              if (cancelled || pcRef.current !== pc || (pc.iceConnectionState as string) === 'closed') return;

              const gatheredList = Array.from(localCandidatesMap.values());
              const gotRequired = turnEnabled ? hasRelay : hasSrflx;
              if (!gotRequired) {
                allowLateFlush = true;
                setTimeout(() => {
                  allowLateFlush = false;
                }, LATE_CANDIDATE_WINDOW_MS);
              }

              const rawLocalAnswer = pc.localDescription?.sdp || rawAnswer.sdp || '';
              const finalAnswerSdp = tuneOpusSdp(rawLocalAnswer);

              console.log(
                `[CompeteVoice] Publishing answer (offerId=${data.offer.offerId}, turn=${turnEnabled}) candidates:`,
                summarizeCandidates(gatheredList)
              );

              await updateDoc(signalDocRef, {
                answer: {
                  type: 'answer',
                  sdp: finalAnswerSdp,
                  epoch: data.offer.epoch,
                  offerId: data.offer.offerId,
                  candidates: gatheredList,
                },
                lateOpponentCandidates: [],
                updatedAt: Date.now(),
              });

              startConnectWatchdog();
            } catch (err) {
              console.warn('[CompeteVoice] Answer handling failed:', err);
            }
          } else if (!isOfferer && data.lateCreatorCandidates?.length) {
            await applyRemoteCandidates(data.lateCreatorCandidates);
          }

          if (
            isOfferer &&
            data.answer &&
            data.answer.offerId === currentOfferIdRef.current &&
            data.answer.offerId !== appliedAnswerIdRef.current
          ) {
            try {
              appliedAnswerIdRef.current = data.answer.offerId;
              if (pc.signalingState === 'have-local-offer') {
                await setSafeRemoteDescription(data.answer.type, data.answer.sdp);
                await applyRemoteCandidates(data.answer.candidates);
                await applyRemoteCandidates(data.lateOpponentCandidates);
                startConnectWatchdog();
              }
            } catch (err) {
              console.warn('[CompeteVoice] Remote answer application failed:', err);
            }
          } else if (isOfferer && data.lateOpponentCandidates?.length) {
            await applyRemoteCandidates(data.lateOpponentCandidates);
          }

          if (
            isOfferer &&
            typeof data.retryRequestedAt === 'number' &&
            data.retryRequestedAt > lastHandledRetryRef.current
          ) {
            lastHandledRetryRef.current = data.retryRequestedAt;
            restartCountRef.current = 0;
            setVoiceStatus('connecting');
            publishOffer(true);
          }
        },
        (err) => {
          console.warn('[CompeteVoice] Signal listener error:', err);
        }
      );

      if (isOfferer) {
        publishOffer(false);
      }

      statsInterval = setInterval(async () => {
        const currentPc = pcRef.current;
        if (!currentPc || currentPc.iceConnectionState !== 'connected') return;
        try {
          const stats = await currentPc.getStats();
          let highLossOrRtt = false;
          let packetsSent = -1;
          let bytesSent = -1;
          let audioLevel: number | undefined;
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (typeof report.currentRoundTripTime === 'number' && report.currentRoundTripTime > 0.45) {
                highLossOrRtt = true;
              }
            }
            if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
              if (typeof report.fractionLost === 'number' && report.fractionLost > 0.1) {
                highLossOrRtt = true;
              }
            }
            if (report.type === 'outbound-rtp' && report.kind === 'audio') {
              if (typeof report.packetsSent === 'number') packetsSent = report.packetsSent;
              if (typeof report.bytesSent === 'number') bytesSent = report.bytesSent;
            }
            if (report.type === 'media-source' && report.kind === 'audio') {
              if (typeof report.audioLevel === 'number') audioLevel = report.audioLevel;
            }
          });
          if (localStreamRef.current) {
            const tx = currentPc.getTransceivers().find((t) => t.sender === audioSenderRef.current);
            const activeTrack = localStreamRef.current.getAudioTracks()[0];
            console.log(
              `[CompeteVoice] Outbound audio stats -> packetsSent=${packetsSent}, bytesSent=${bytesSent}, micLevel=${audioLevel ?? 'n/a'}, dir=${tx?.direction}, curDir=${tx?.currentDirection}`
            );
            if (typeof audioLevel === 'number') {
              if (audioLevel < 0.001) {
                silentChecksRef.current += 1;
                if (silentChecksRef.current === 2 && !warnedSilentMicRef.current) {
                  warnedSilentMicRef.current = true;
                  toast.warning(
                    `No sound detected from "${activeTrack?.label || 'current mic'}". Check your mic or switch input.`
                  );
                }
              } else {
                silentChecksRef.current = 0;
              }
            }
          }
          setVoiceStatus((prev) => {
            if (prev === 'connected' && highLossOrRtt) return 'weak';
            if (prev === 'weak' && !highLossOrRtt) return 'connected';
            return prev;
          });
        } catch {
          // Ignore transient stats errors
        }
      }, 4000);
    };

    initVoice();

    return () => {
      cancelled = true;
      if (statsInterval) clearInterval(statsInterval);
      if (lateFlushTimer) clearTimeout(lateFlushTimer);
      if (activeFinishGathering) activeFinishGathering();
      if (unsubscribe) unsubscribe();
      cleanupPeerConnection();
    };
  }, [isHumanMatch, matchId, userId, creatorId, opponentId, isOfferer, retryTrigger, cleanupPeerConnection, tryPlayRemoteAudio]);

  const activateMicStream = useCallback(
    async (requestedDeviceId?: string, persistChoice = false) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Microphone is not supported in this browser.');
        return;
      }

      setIsMicBusy(true);
      try {
        let savedMicId = '';
        try {
          savedMicId = localStorage.getItem(MIC_STORAGE_KEY) || '';
        } catch {
          savedMicId = '';
        }
        const targetId = requestedDeviceId ?? savedMicId;

        const openMic = async (devId?: string): Promise<MediaStream> => {
          const baseAudio: MediaTrackConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(devId && devId !== 'default' ? { deviceId: { exact: devId } } : {}),
          };
          try {
            return await navigator.mediaDevices.getUserMedia({ audio: baseAudio, video: false });
          } catch (primaryErr: any) {
            if (primaryErr?.name === 'NotAllowedError' || primaryErr?.name === 'PermissionDeniedError') {
              throw primaryErr;
            }
            if (devId && devId !== 'default') {
              return await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true,
                },
                video: false,
              });
            }
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          }
        };

        let stream = await openMic(targetId);
        let audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          stream.getTracks().forEach((t) => t.stop());
          toast.error('No microphone audio track detected.');
          return;
        }

        const availableMics = await refreshAudioDevices();

        // If no explicit mic was chosen and browser defaulted to a virtual mic (e.g. DroidCam Audio),
        // automatically prefer a real hardware microphone when one is available.
        if (!requestedDeviceId && !savedMicId && VIRTUAL_MIC_REGEX.test(audioTrack.label || '')) {
          const hardwareMic = availableMics.find(
            (d) =>
              d.deviceId !== 'default' &&
              d.label &&
              !VIRTUAL_MIC_REGEX.test(d.label)
          );
          if (hardwareMic) {
            try {
              const hardwareStream = await openMic(hardwareMic.deviceId);
              const hardwareTrack = hardwareStream.getAudioTracks()[0];
              if (hardwareTrack) {
                console.log(
                  `[CompeteVoice] Auto-switched from virtual mic "${audioTrack.label}" to hardware mic "${hardwareTrack.label}"`
                );
                stream.getTracks().forEach((t) => t.stop());
                stream = hardwareStream;
                audioTrack = hardwareTrack;
              } else {
                hardwareStream.getTracks().forEach((t) => t.stop());
              }
            } catch {
              // Keep initial stream if opening preferred mic failed
            }
          }
        }

        audioTrack.enabled = true;

        if (!pcRef.current || pcRef.current.signalingState === 'closed') {
          stream.getTracks().forEach((t) => t.stop());
          toast.error('Voice connection is not active right now.');
          return;
        }

        let sender = audioSenderRef.current;
        let matchingTransceiver = sender
          ? pcRef.current.getTransceivers().find((t) => t.sender === sender)
          : undefined;

        if (!sender || !matchingTransceiver) {
          const audioTransceiver = pcRef.current
            .getTransceivers()
            .find(
              (t) =>
                t.receiver.track?.kind === 'audio' ||
                t.sender.track?.kind === 'audio' ||
                t.mid !== null
            );
          if (audioTransceiver) {
            matchingTransceiver = audioTransceiver;
            sender = audioTransceiver.sender;
            audioSenderRef.current = sender;
          }
        }

        if (!sender) {
          stream.getTracks().forEach((t) => t.stop());
          toast.error('Voice channel is still negotiating. Please try again in a moment.');
          return;
        }

        if (matchingTransceiver) {
          matchingTransceiver.direction = 'sendrecv';
        }

        const previousStream = localStreamRef.current;
        localStreamRef.current = stream;
        silentChecksRef.current = 0;
        warnedSilentMicRef.current = false;

        audioTrack.onended = () => {
          if (localStreamRef.current === stream) {
            stopLocalMicTrack();
          }
        };
        audioTrack.onmute = () => {
          console.warn('[CompeteVoice] Local microphone track became hardware-muted:', audioTrack.label);
        };
        audioTrack.onunmute = () => {
          console.log('[CompeteVoice] Local microphone track unmuted:', audioTrack.label);
        };

        const activeDeviceId = audioTrack.getSettings?.().deviceId || targetId || '';
        if (activeDeviceId) {
          setSelectedMicId(activeDeviceId);
          if (persistChoice) {
            try {
              localStorage.setItem(MIC_STORAGE_KEY, activeDeviceId);
            } catch {
              // Ignore storage quota errors
            }
          }
        }

        console.log(
          `[CompeteVoice] Mic acquired: label="${audioTrack.label}", deviceId=${activeDeviceId || 'default'}, enabled=${audioTrack.enabled}, muted=${audioTrack.muted}, readyState=${audioTrack.readyState}`
        );
        if (audioTrack.muted) {
          toast.warning('Your microphone appears muted by your browser or device.');
        }

        await sender.replaceTrack(audioTrack);
        if (previousStream && previousStream !== stream) {
          previousStream.getTracks().forEach((t) => t.stop());
        }

        if (typeof sender.setStreams === 'function') {
          try {
            sender.setStreams(stream);
          } catch {
            // Ignore if browser rejects setStreams on bound sender
          }
        }

        try {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            params.encodings[0].active = true;
            params.encodings[0].maxBitrate = TARGET_OPUS_BITRATE_BPS;
            await sender.setParameters(params);
          }
        } catch {
          // Fallback to SDP maxaveragebitrate
        }

        const curDir = matchingTransceiver?.currentDirection;
        const needsDirectionFix = Boolean(curDir && curDir !== 'sendrecv' && curDir !== 'sendonly');

        if (isOfferer && (needsDirectionFix || !hasRenegotiatedMicRef.current)) {
          hasRenegotiatedMicRef.current = true;
          publishOfferRef.current?.(false, true);
        } else if (!isOfferer && needsDirectionFix && matchId) {
          hasRenegotiatedMicRef.current = true;
          updateDoc(doc(db, 'compete_voice', matchId), {
            retryRequestedAt: Date.now(),
          }).catch(() => {});
        }

        setTimeout(async () => {
          const currentPc = pcRef.current;
          if (!currentPc || localStreamRef.current !== stream || currentPc.iceConnectionState === 'closed') return;
          try {
            const stats = await currentPc.getStats();
            let packetsSent = 0;
            let audioLevel: number | undefined;
            stats.forEach((report) => {
              if (report.type === 'outbound-rtp' && report.kind === 'audio' && typeof report.packetsSent === 'number') {
                packetsSent = report.packetsSent;
              }
              if (report.type === 'media-source' && report.kind === 'audio' && typeof report.audioLevel === 'number') {
                audioLevel = report.audioLevel;
              }
            });
            console.log(
              `[CompeteVoice] Post-mic check (1.5s): packetsSent=${packetsSent}, micLevel=${audioLevel ?? 'n/a'}, curDir=${matchingTransceiver?.currentDirection}`
            );
            if (packetsSent === 0 && !hasRenegotiatedMicRef.current) {
              hasRenegotiatedMicRef.current = true;
              if (isOfferer) {
                publishOfferRef.current?.(false, true);
              } else if (matchId) {
                updateDoc(doc(db, 'compete_voice', matchId), {
                  retryRequestedAt: Date.now(),
                }).catch(() => {});
              }
            }
          } catch {
            // Ignore transient stats error
          }
        }, 1500);

        if (remoteAudioRef.current && remoteAudioRef.current.srcObject) {
          tryPlayRemoteAudio();
        }

        setIsMicOn(true);
      } catch (err: any) {
        const msg =
          err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
            ? 'Microphone permission denied. Allow mic access in your browser to speak.'
            : 'Could not access microphone.';
        toast.error(msg);
      } finally {
        setIsMicBusy(false);
      }
    },
    [isOfferer, matchId, refreshAudioDevices, stopLocalMicTrack, tryPlayRemoteAudio]
  );

  const toggleMic = useCallback(async () => {
    if (!isHumanMatch || isMicBusy) return;

    if (isMicOn) {
      setIsMicBusy(true);
      await stopLocalMicTrack();
      setIsMicBusy(false);
      return;
    }

    await activateMicStream();
  }, [activateMicStream, isHumanMatch, isMicBusy, isMicOn, stopLocalMicTrack]);

  const selectMic = useCallback(
    async (deviceId: string) => {
      setSelectedMicId(deviceId);
      try {
        localStorage.setItem(MIC_STORAGE_KEY, deviceId);
      } catch {
        // Ignore storage error
      }
      if (!isHumanMatch || isMicBusy) return;
      if (isMicOn) {
        await activateMicStream(deviceId, true);
      }
    },
    [activateMicStream, isHumanMatch, isMicBusy, isMicOn]
  );

  const toggleOpponentMute = useCallback(() => {
    setIsOpponentMuted((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = next;
        if (!next && remoteAudioRef.current.srcObject) {
          remoteAudioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  const retryVoice = useCallback(() => {
    if (!isHumanMatch || !matchId) return;
    cachedTurnConfig = null;
    if (!isOfferer) {
      updateDoc(doc(db, 'compete_voice', matchId), {
        retryRequestedAt: Date.now(),
      }).catch(() => {});
    }
    setRetryTrigger((n) => n + 1);
  }, [isHumanMatch, isOfferer, matchId]);

  return {
    isHumanMatch,
    isMicOn,
    isMicBusy,
    isOpponentMuted,
    voiceStatus,
    hasRemoteAudio,
    audioDevices,
    selectedMicId,
    selectMic,
    toggleMic,
    toggleOpponentMute,
    leaveVoice,
    retryVoice,
    attachRemoteAudioElement,
  };
}
