import { useState, useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { Audio } from 'expo-av';
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export type VoiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'weak'
  | 'reconnecting'
  | 'failed'
  | 'opponent_left'
  | 'unavailable';

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
    type: 'offer';
    sdp: string;
    epoch: number;
    offerId: string;
    candidates?: SerializedIceCandidate[];
  };
  answer?: {
    type: 'answer';
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

const STUN_SERVERS = [
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
    console.warn('[Mobile CompeteVoice] Could not read system/webrtc, using default ExpressTURN config:', err);
  }
  cachedTurnConfig = { data: DEFAULT_TURN_CONFIG, fetchedAt: Date.now() };
  return DEFAULT_TURN_CONFIG;
}

function buildIceServers(turnCfg: TurnConfig): { iceServers: any[]; turnEnabled: boolean } {
  const servers: any[] = [...STUN_SERVERS];
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

const TARGET_OPUS_BITRATE_BPS = 18000;
const MAX_ICE_GATHER_WAIT_MS = 4500;
const CANDIDATE_GRACE_MS = 400;
const LATE_CANDIDATE_WINDOW_MS = 5000;
const MAX_ICE_RESTARTS = 2;
const CONNECT_WATCHDOG_MS = 18000;

function loadWebRTC(): any | null {
  try {
    // Lazy require prevents crashes if opened inside Expo Go (which lacks native WebRTC)
    const mod = require('react-native-webrtc');
    if (mod && mod.RTCPeerConnection && mod.RTCSessionDescription && mod.mediaDevices) {
      return mod;
    }
    return null;
  } catch {
    return null;
  }
}

function loadInCallManager(): any | null {
  try {
    // Lazy require prevents crashes if opened inside Expo Go (which lacks native InCallManager)
    const mod = require('react-native-incall-manager');
    const mgr = mod?.default || mod;
    if (mgr && typeof mgr.start === 'function' && typeof mgr.setForceSpeakerphoneOn === 'function') {
      return mgr;
    }
    return null;
  } catch {
    return null;
  }
}

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
  let hasPtime = false;
  let hasMaxPtime = false;

  const updatedLines = lines.map((line) => {
    if (line.startsWith('a=ptime:')) {
      hasPtime = true;
      return 'a=ptime:40';
    }
    if (line.startsWith('a=maxptime:')) {
      hasMaxPtime = true;
      return 'a=maxptime:60';
    }
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
      paramMap.set('usedtx', '1');
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
  if (rtpmapIdx !== -1) {
    let insertAnchor = rtpmapIdx + 1;
    if (!hasFmtp) {
      updatedLines.splice(
        insertAnchor,
        0,
        `${fmtpPrefix}minptime=10;useinbandfec=1;usedtx=1;stereo=0;sprop-stereo=0;cbr=0;maxaveragebitrate=${bitrateBps}`
      );
      insertAnchor += 1;
    } else {
      const fmtpIdx = updatedLines.findIndex((l) => l.startsWith(fmtpPrefix));
      if (fmtpIdx !== -1) insertAnchor = fmtpIdx + 1;
    }

    if (!hasPtime) {
      updatedLines.splice(insertAnchor, 0, 'a=ptime:40');
      insertAnchor += 1;
    }
    if (!hasMaxPtime) {
      updatedLines.splice(insertAnchor, 0, 'a=maxptime:60');
    }
  }

  return updatedLines.join(lineEnding);
}

function serializeCandidate(c: any): SerializedIceCandidate | null {
  if (!c?.candidate) return null;
  return {
    candidate: String(c.candidate),
    sdpMid: c.sdpMid != null ? String(c.sdpMid) : '0',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const REMOTE_SPEAKER_GAIN = 1.8;

async function configureSpeakerAudioMode(allowsRecording: boolean) {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: allowsRecording,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
  } catch {
    // Non-fatal if OS rejects audio mode change
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
  const [retryTrigger, setRetryTrigger] = useState(0);

  const pcRef = useRef<any>(null);
  const audioSenderRef = useRef<any>(null);
  const localStreamRef = useRef<any>(null);
  const remoteTracksRef = useRef<any[]>([]);

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
  const speakerReassertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inCallActiveRef = useRef<boolean>(false);

  const applyForceSpeakerphone = useCallback(() => {
    const mgr = loadInCallManager();
    if (!mgr) return;
    try {
      mgr.setForceSpeakerphoneOn(true);
      if (typeof mgr.setSpeakerphoneOn === 'function') {
        mgr.setSpeakerphoneOn(true);
      }
    } catch {
      // Non-fatal
    }
  }, []);

  const reassertLoudspeaker = useCallback(() => {
    applyForceSpeakerphone();
    if (speakerReassertTimerRef.current) {
      clearTimeout(speakerReassertTimerRef.current);
    }
    speakerReassertTimerRef.current = setTimeout(() => {
      speakerReassertTimerRef.current = null;
      applyForceSpeakerphone();
    }, 300);
  }, [applyForceSpeakerphone]);

  const enableLoudspeaker = useCallback(
    async (allowsRecording: boolean) => {
      const mgr = loadInCallManager();
      if (mgr && !inCallActiveRef.current) {
        try {
          mgr.start({ media: 'audio' });
          inCallActiveRef.current = true;
        } catch {
          // Non-fatal
        }
      }
      reassertLoudspeaker();
      await configureSpeakerAudioMode(allowsRecording);
      reassertLoudspeaker();
    },
    [reassertLoudspeaker]
  );

  const disableLoudspeaker = useCallback(() => {
    if (speakerReassertTimerRef.current) {
      clearTimeout(speakerReassertTimerRef.current);
      speakerReassertTimerRef.current = null;
    }
    const mgr = loadInCallManager();
    if (mgr && inCallActiveRef.current) {
      try {
        mgr.setForceSpeakerphoneOn(false);
        if (typeof mgr.setSpeakerphoneOn === 'function') {
          mgr.setSpeakerphoneOn(false);
        }
        mgr.stop();
      } catch {
        // Non-fatal
      }
      inCallActiveRef.current = false;
    }
    configureSpeakerAudioMode(false);
  }, []);

  const stopLocalMicTrack = useCallback(async () => {
    if (audioSenderRef.current) {
      try {
        await audioSenderRef.current.replaceTrack(null);
      } catch {
        // Ignore if peer connection already closed
      }
    }
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach((t: any) => t.stop());
      } catch {
        // Ignore
      }
      localStreamRef.current = null;
    }
    await configureSpeakerAudioMode(false);
    reassertLoudspeaker();
    setIsMicOn(false);
  }, [reassertLoudspeaker]);

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
      try {
        localStreamRef.current.getTracks().forEach((t: any) => t.stop());
      } catch {
        // Ignore
      }
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onicegatheringstatechange = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      try {
        pcRef.current.close();
      } catch {
        // Ignore
      }
      pcRef.current = null;
    }

    audioSenderRef.current = null;
    remoteTracksRef.current = [];

    offerEpochRef.current = 0;
    currentOfferIdRef.current = '';
    appliedOfferIdRef.current = '';
    appliedAnswerIdRef.current = '';
    restartCountRef.current = 0;
    sawSignalDocRef.current = false;

    setIsMicOn(false);
    disableLoudspeaker();
  }, [disableLoudspeaker]);

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
          // Safe to ignore if already deleted
        }
      }
    },
    [cleanupPeerConnection, matchId]
  );

  useEffect(() => {
    if (!isHumanMatch || !matchId || !userId) {
      cleanupPeerConnection();
      setVoiceStatus('idle');
      return;
    }

    const webrtc = loadWebRTC();
    if (!webrtc) {
      setVoiceStatus('unavailable');
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
    enableLoudspeaker(false);

    const initVoice = async () => {
      const turnCfg = await getTurnConfig(retryTrigger > 0);
      if (cancelled) return;

      const { iceServers, turnEnabled } = buildIceServers(turnCfg);
      const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = webrtc;
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

      pc.onicecandidate = (event: any) => {
        if (pcRef.current !== pc) return;

        if (!event?.candidate) {
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
              console.log('[Mobile CompeteVoice] Sent 1 batched late candidate flush');
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
            if (RTCIceCandidate) {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } else {
              await pc.addIceCandidate(c);
            }
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

      const setSafeRemoteDescription = async (type: 'offer' | 'answer', sdp: string) => {
        const tuned = tuneOpusSdp(sdp);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp: tuned }));
        } catch (err) {
          console.warn('[Mobile CompeteVoice] Tuned remote SDP rejected, falling back to raw SDP:', err);
          await pc.setRemoteDescription(new RTCSessionDescription({ type, sdp }));
        }
        await drainPendingRemoteCandidates();
      };

      if (isOfferer) {
        const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
        audioSenderRef.current = transceiver.sender;
      }

      pc.ontrack = (event: any) => {
        const tracks: any[] = [];
        if (event?.track) tracks.push(event.track);
        if (event?.streams?.[0]?.getAudioTracks) {
          event.streams[0].getAudioTracks().forEach((t: any) => {
            if (!tracks.includes(t)) tracks.push(t);
          });
        }
        tracks.forEach((t) => {
          t.enabled = !isOpponentMutedRef.current;
          if (typeof t._setVolume === 'function') {
            try {
              t._setVolume(isOpponentMutedRef.current ? 0 : REMOTE_SPEAKER_GAIN);
            } catch {
              // Ignore
            }
          }
          if (!remoteTracksRef.current.includes(t)) {
            remoteTracksRef.current.push(t);
          }
        });
        reassertLoudspeaker();
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
          console.warn('[Mobile CompeteVoice] ICE watchdog triggered. State:', ice, 'conn:', pc.connectionState);
          if (isOfferer && restartCountRef.current < 1) {
            attemptIceRestart();
          } else {
            setVoiceStatus('failed');
          }
        }, CONNECT_WATCHDOG_MS);
      };

      const publishOffer = async (iceRestart = false) => {
        if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;
        try {
          const nextEpoch = offerEpochRef.current + 1;
          offerEpochRef.current = nextEpoch;
          const offerId = `${nextEpoch}_${sessionIdRef.current}_${Date.now()}`;
          currentOfferIdRef.current = offerId;

          localCandidatesMap.clear();
          hasSrflx = false;
          hasRelay = false;
          allowLateFlush = false;
          sentLateFlush = false;

          const rawOffer = await pc.createOffer({ iceRestart });
          await pc.setLocalDescription(
            new RTCSessionDescription({ type: rawOffer.type, sdp: rawOffer.sdp })
          );

          await waitForGatheredCandidates();
          if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;

          const gatheredList = Array.from(localCandidatesMap.values());
          const gotRequired = turnEnabled ? hasRelay : hasSrflx;
          if (!gotRequired) {
            allowLateFlush = true;
            setTimeout(() => {
              allowLateFlush = false;
            }, LATE_CANDIDATE_WINDOW_MS);
          }

          const rawLocalSdp = pc.localDescription?.sdp || rawOffer.sdp || '';
          const finalSdp = tuneOpusSdp(rawLocalSdp);

          console.log(
            `[Mobile CompeteVoice] Publishing offer (epoch=${nextEpoch}, turn=${turnEnabled}) candidates:`,
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

          if (iceRestart) {
            await updateDoc(signalDocRef, {
              offer: payload.offer,
              lateCreatorCandidates: [],
              updatedAt: payload.updatedAt,
            }).catch(async () => {
              await setDoc(signalDocRef, payload);
            });
          } else {
            await setDoc(signalDocRef, payload);
          }
        } catch (err) {
          console.warn('[Mobile CompeteVoice] Offer creation failed:', err);
        }
      };

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
        console.log(`[Mobile CompeteVoice] State update -> ice=${iceState}, conn=${connState}`);

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
          reassertLoudspeaker();
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

              let touchedDirection = false;
              pc.getTransceivers().forEach((t: any) => {
                if (t.receiver?.track?.kind === 'audio' || t.mid !== null) {
                  if (t.direction !== 'sendrecv') {
                    t.direction = 'sendrecv';
                    touchedDirection = true;
                  }
                  if (!audioSenderRef.current) {
                    audioSenderRef.current = t.sender;
                  }
                }
              });

              if (touchedDirection) {
                await delay(120);
              }
              if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;

              localCandidatesMap.clear();
              hasSrflx = false;
              hasRelay = false;
              allowLateFlush = false;
              sentLateFlush = false;

              let rawAnswer = await pc.createAnswer();
              if (rawAnswer?.sdp && rawAnswer.sdp.includes('a=recvonly')) {
                await delay(150);
                if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;
                rawAnswer = await pc.createAnswer();
              }

              await pc.setLocalDescription(
                new RTCSessionDescription({ type: rawAnswer.type, sdp: rawAnswer.sdp })
              );

              await waitForGatheredCandidates();
              if (pcRef.current !== pc || pc.iceConnectionState === 'closed') return;

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
                `[Mobile CompeteVoice] Publishing answer (offerId=${data.offer.offerId}, turn=${turnEnabled}) candidates:`,
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
              console.warn('[Mobile CompeteVoice] Answer handling failed:', err);
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
              console.warn('[Mobile CompeteVoice] Remote answer application failed:', err);
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
          console.warn('[Mobile CompeteVoice] Signal listener error:', err);
        }
      );

      if (isOfferer) {
        publishOffer(false);
      }

      statsInterval = setInterval(async () => {
        if (pcRef.current !== pc || pc.iceConnectionState !== 'connected') return;
        try {
          const stats = await pc.getStats();
          let highLossOrRtt = false;
          stats?.forEach?.((report: any) => {
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
          });
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
  }, [isHumanMatch, matchId, userId, creatorId, opponentId, isOfferer, retryTrigger, cleanupPeerConnection, enableLoudspeaker, reassertLoudspeaker]);

  const toggleMic = useCallback(async () => {
    if (!isHumanMatch || isMicBusy) return;

    const webrtc = loadWebRTC();
    if (!webrtc) {
      Alert.alert(
        'Native Build Required',
        'Live voice chat requires a compiled CoLearn APK / EAS build (not Expo Go).'
      );
      return;
    }

    if (isMicOn) {
      setIsMicBusy(true);
      await stopLocalMicTrack();
      setIsMicBusy(false);
      return;
    }

    setIsMicBusy(true);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Microphone Permission',
          'Microphone access is required to talk in CoLearn Compete.'
        );
        setIsMicBusy(false);
        return;
      }

      await configureSpeakerAudioMode(true);

      const stream = await webrtc.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
        video: false,
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach((t: any) => t.stop());
        Alert.alert('Microphone Error', 'No microphone audio track detected.');
        setIsMicBusy(false);
        return;
      }

      if (!pcRef.current || pcRef.current.iceConnectionState === 'closed') {
        stream.getTracks().forEach((t: any) => t.stop());
        Alert.alert('Voice Inactive', 'Voice connection is not active right now.');
        setIsMicBusy(false);
        return;
      }

      let sender = audioSenderRef.current;
      if (!sender) {
        const audioTransceiver = pcRef.current
          .getTransceivers?.()
          ?.find((t: any) => t.receiver?.track?.kind === 'audio' || t.mid !== null);
        if (audioTransceiver) {
          audioTransceiver.direction = 'sendrecv';
          sender = audioTransceiver.sender;
          audioSenderRef.current = sender;
        } else {
          sender = pcRef.current.getSenders?.()?.find((s: any) => s.track?.kind === 'audio' || !s.track);
          if (sender) audioSenderRef.current = sender;
        }
      }

      if (!sender) {
        stream.getTracks().forEach((t: any) => t.stop());
        Alert.alert('Voice Inactive', 'Voice channel is still connecting. Please try again in a moment.');
        setIsMicBusy(false);
        return;
      }

      audioTrack.enabled = true;
      localStreamRef.current = stream;
      await sender.replaceTrack(audioTrack);

      try {
        const params = sender.getParameters();
        if (params?.encodings?.length > 0) {
          params.encodings[0].maxBitrate = TARGET_OPUS_BITRATE_BPS;
          await sender.setParameters(params);
        }
      } catch {
        // Fallback to SDP maxaveragebitrate
      }

      setIsMicOn(true);
      reassertLoudspeaker();
    } catch (err) {
      console.warn('[Mobile CompeteVoice] Mic activation error:', err);
      Alert.alert('Microphone Error', 'Could not start microphone for voice chat.');
      await configureSpeakerAudioMode(false);
      reassertLoudspeaker();
    } finally {
      setIsMicBusy(false);
    }
  }, [isHumanMatch, isMicBusy, isMicOn, stopLocalMicTrack, reassertLoudspeaker]);

  const toggleOpponentMute = useCallback(() => {
    if (voiceStatus === 'unavailable') {
      Alert.alert(
        'Native Build Required',
        'Live voice chat requires a compiled CoLearn APK / EAS build (not Expo Go).'
      );
      return;
    }

    setIsOpponentMuted((prev) => {
      const next = !prev;
      remoteTracksRef.current.forEach((track) => {
        try {
          track.enabled = !next;
          if (typeof track._setVolume === 'function') {
            track._setVolume(next ? 0 : REMOTE_SPEAKER_GAIN);
          }
        } catch {
          // Ignore
        }
      });
      return next;
    });
  }, [voiceStatus]);

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
    toggleMic,
    toggleOpponentMute,
    leaveVoice,
    retryVoice,
  };
}
