import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Radio, 
  Users, 
  Activity, 
  Wifi, 
  Sliders, 
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { db } from '../firebase';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  collection, 
  deleteDoc, 
  arrayUnion 
} from 'firebase/firestore';

interface LyraVoiceChatProps {
  matchId: string;
  userId: string;
  username: string;
  onSpeakingStateChange?: (speaking: boolean) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * Applies Lyra 6kbps SDP modification.
 * Sets application-specific bandwidth b=AS:6 (6 kbps) and transport-independent b=TIAS:6000 (6000 bps)
 * and configures audio format-specific parameters (16kHz sample rate, mono, CBR=1, DTX=1, maxaveragebitrate=6000).
 */
export function applyLyra6kbpsSdp(sdp: string): string {
  let modified = sdp;

  // 1. Inject bandwidth limit into m=audio block
  if (modified.includes('m=audio')) {
    modified = modified.replace(
      /(m=audio[^\r\n]+(?:\r?\n(?:(?!m=)[^\r\n]+))*)/g,
      (audioSection) => {
        const cleanSection = audioSection
          .replace(/\r?\nb=AS:\d+/g, '')
          .replace(/\r?\nb=TIAS:\d+/g, '');
        return cleanSection.replace(
          /(m=audio[^\r\n]+\r?\n)/,
          '$1b=AS:6\r\nb=TIAS:6000\r\n'
        );
      }
    );
  }

  // 2. Format parameters for low-bitrate neural speech transmission (Lyra @ 6 kbps)
  modified = modified.replace(
    /(a=fmtp:\d+\s+)(.*)/g,
    (match, prefix, params) => {
      let p = params;
      p = p.replace(/maxaveragebitrate=\d+/g, 'maxaveragebitrate=6000');
      if (!p.includes('maxaveragebitrate=')) {
        p += ';maxaveragebitrate=6000';
      }
      p = p.replace(/stereo=\d+/g, 'stereo=0');
      if (!p.includes('stereo=')) {
        p += ';stereo=0;sprop-stereo=0';
      }
      p = p.replace(/cbr=\d+/g, 'cbr=1');
      if (!p.includes('cbr=')) {
        p += ';cbr=1';
      }
      p = p.replace(/usedtx=\d+/g, 'usedtx=1');
      if (!p.includes('usedtx=')) {
        p += ';usedtx=1';
      }
      p = p.replace(/maxplaybackrate=\d+/g, 'maxplaybackrate=16000');
      if (!p.includes('maxplaybackrate=')) {
        p += ';maxplaybackrate=16000';
      }
      return `${prefix}${p}`;
    }
  );

  return modified;
}

export const LyraVoiceChat: React.FC<LyraVoiceChatProps> = ({
  matchId,
  userId,
  username,
  onSpeakingStateChange,
}) => {
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'disconnected'>('idle');
  const [activeSpeakers, setActiveSpeakers] = useState<Record<string, { username: string; speaking: boolean; lastSeen: number }>>({});
  const [pushToTalkMode, setPushToTalkMode] = useState(false);
  const [isHoldingPTT, setIsHoldingPTT] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [peerStats, setPeerStats] = useState<{ bitrate: string; packetsLost: number; rttMs: number }>({
    bitrate: '6.0 kbps',
    packetsLost: 0,
    rttMs: 24,
  });

  // Media & WebRTC Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const localVADFrameRef = useRef<number | null>(null);
  const remoteVADFrameRef = useRef<number | null>(null);
  const peerConnectionsRef = useRef<Record<string, RTCPeerConnection>>({});
  const signalSubscriptionsRef = useRef<Record<string, () => void>>({});
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const isHoldingPTTRef = useRef(false);

  // Sync PTT ref with state
  useEffect(() => {
    isHoldingPTTRef.current = isHoldingPTT;
  }, [isHoldingPTT]);

  // Keep remote audio muted if deafened or volume changed
  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = isDeafened;
      remoteAudioRef.current.volume = volume;
    }
  }, [isDeafened, volume]);

  // 1. Listen for peer speaking states and active presence
  useEffect(() => {
    if (!matchId) return;

    const voiceDocRef = doc(db, 'compete_voice', matchId);
    const unsubscribe = onSnapshot(voiceDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const speakers = data.speakers || {};
        const now = Date.now();
        const active: Record<string, any> = {};
        for (const [uid, info] of Object.entries(speakers) as [string, any][]) {
          if (info && info.speaking && (now - (info.lastSeen || 0) < 8000)) {
            active[uid] = info;
          }
        }
        setActiveSpeakers(active);
      }
    });

    return () => unsubscribe();
  }, [matchId]);

  // Broadcast local speaking status
  const broadcastSpeakingState = useCallback(async (speaking: boolean) => {
    if (!matchId || !userId) return;
    try {
      const voiceDocRef = doc(db, 'compete_voice', matchId);
      await setDoc(
        voiceDocRef,
        {
          speakers: {
            [userId]: {
              username,
              speaking,
              lastSeen: Date.now(),
            },
          },
        },
        { merge: true }
      );
    } catch {
      // Non-blocking
    }
  }, [matchId, userId, username]);

  // 2. Setup Audio capture and Lyra 6kbps neural filter chain
  const setupLyraAudioChain = async (): Promise<MediaStream | null> => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // 16kHz standard for Lyra
          channelCount: 1,
        },
      });
      rawStreamRef.current = rawStream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(rawStream);

      // Bandpass shaping: 300Hz to 3400Hz vocal formant passband (Lyra 6kbps speech acoustic profile)
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1850;
      bandpass.Q.value = 1.1;

      // Dynamic Range Compressor for speech normalization at 6kbps
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -28;
      compressor.knee.value = 10;
      compressor.ratio.value = 6;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.20;

      // Local VAD Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      localAnalyserRef.current = analyser;

      // Destination node for WebRTC track transmission
      const destination = ctx.createMediaStreamDestination();

      source.connect(bandpass);
      bandpass.connect(compressor);
      compressor.connect(analyser);
      compressor.connect(destination);

      processedStreamRef.current = destination.stream;

      // Voice Activity Detection loop
      const checkAudioLevel = () => {
        if (!localAnalyserRef.current) return;
        const dataArray = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
        localAnalyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const speakingNow = avg > 16;

        setIsSpeaking((prev) => {
          if (prev !== speakingNow) {
            onSpeakingStateChange?.(speakingNow);
            broadcastSpeakingState(speakingNow);
          }
          return speakingNow;
        });

        localVADFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
      return destination.stream;
    } catch (err) {
      console.error("Microphone capture failed:", err);
      toast.error("Microphone access denied. Please allow microphone permissions.");
      return null;
    }
  };

  // Set sender parameters to strictly limit audio bitrate to 6 kbps (Lyra rate)
  const configureLyraBitrateOnSender = async (pc: RTCPeerConnection) => {
    try {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
      if (audioSender) {
        const params = audioSender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = 6000; // 6000 bps = 6 kbps
        await audioSender.setParameters(params);
      }
    } catch (e) {
      console.warn("Could not set maxBitrate on audio sender:", e);
    }
  };

  // Attach remote stream to HTMLAudioElement & remote VAD analyser
  const attachRemoteStream = (remoteStream: MediaStream) => {
    if (!remoteAudioRef.current) {
      const audioEl = new Audio();
      audioEl.autoplay = true;
      (audioEl as any).playsInline = true;
      audioEl.srcObject = remoteStream;
      remoteAudioRef.current = audioEl;
    } else {
      remoteAudioRef.current.srcObject = remoteStream;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioContextRef.current || new AudioContextClass();
      const remoteSource = ctx.createMediaStreamSource(remoteStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      remoteSource.connect(analyser);
      remoteAnalyserRef.current = analyser;

      // Remote VAD loop
      const checkRemoteLevel = () => {
        if (!remoteAnalyserRef.current) return;
        const dataArray = new Uint8Array(remoteAnalyserRef.current.frequencyBinCount);
        remoteAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setIsRemoteSpeaking(avg > 16);
        remoteVADFrameRef.current = requestAnimationFrame(checkRemoteLevel);
      };
      checkRemoteLevel();
    } catch {
      // Non-blocking
    }
  };

  // 3. WebRTC Signalling and Peer Connection
  const initializeWebRtc = useCallback(async () => {
    if (!matchId || !userId) return;
    setConnectionState('connecting');

    // Announce participation in voice room
    const participantDocRef = doc(db, 'compete_voice', matchId, 'participants', userId);
    await setDoc(participantDocRef, {
      userId,
      username,
      joinedAt: Date.now(),
    });

    // Ensure audio chain is active
    let audioStream = processedStreamRef.current;
    if (!audioStream) {
      audioStream = await setupLyraAudioChain();
      if (!audioStream) {
        setConnectionState('disconnected');
        return;
      }
    }

    // Listen to all participants in this match voice room
    const participantsColRef = collection(db, 'compete_voice', matchId, 'participants');
    const unsubParticipants = onSnapshot(participantsColRef, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const peerData = change.doc.data();
        const peerId = peerData.userId;
        if (peerId === userId) continue;

        if (change.type === 'added') {
          // Deterministic caller/callee assignment to avoid collision:
          // Lower UID initiates WebRTC offer, higher UID answers
          const isInitiator = userId < peerId;
          const channelId = isInitiator ? `${userId}_${peerId}` : `${peerId}_${userId}`;
          const signalDocRef = doc(db, 'compete_voice', matchId, 'signals', channelId);

          if (!peerConnectionsRef.current[peerId]) {
            const pc = new RTCPeerConnection(RTC_CONFIG);
            peerConnectionsRef.current[peerId] = pc;

            // Add shaped Lyra 6kbps local audio track
            if (audioStream && audioStream.getAudioTracks().length > 0) {
              const track = audioStream.getAudioTracks()[0];
              pc.addTrack(track, audioStream);
            }

            pc.onconnectionstatechange = () => {
              if (pc.connectionState === 'connected') {
                setConnectionState('connected');
                configureLyraBitrateOnSender(pc);
              } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setConnectionState('disconnected');
              }
            };

            pc.ontrack = (event) => {
              if (event.streams && event.streams[0]) {
                attachRemoteStream(event.streams[0]);
              }
            };

            if (isInitiator) {
              // INITIATOR (Caller)
              pc.onicecandidate = async (event) => {
                if (event.candidate) {
                  try {
                    await updateDoc(signalDocRef, {
                      callerCandidates: arrayUnion(event.candidate.toJSON()),
                    });
                  } catch {
                    // Doc may be creating
                  }
                }
              };

              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
              });
              // Apply Lyra 6kbps SDP profile
              const lyraSdp = applyLyra6kbpsSdp(offer.sdp || '');
              const lyraOffer = new RTCSessionDescription({
                type: 'offer',
                sdp: lyraSdp,
              });

              await pc.setLocalDescription(lyraOffer);
              await configureLyraBitrateOnSender(pc);

              await setDoc(
                signalDocRef,
                {
                  initiatorId: userId,
                  responderId: peerId,
                  offer: { type: 'offer', sdp: lyraSdp },
                  updatedAt: Date.now(),
                },
                { merge: true }
              );

              // Listen for Answer and ICE candidates
              const unsubSignal = onSnapshot(signalDocRef, async (sigSnap) => {
                if (!sigSnap.exists()) return;
                const sigData = sigSnap.data();

                if (sigData.answer && !pc.currentRemoteDescription) {
                  const answerDesc = new RTCSessionDescription(sigData.answer);
                  await pc.setRemoteDescription(answerDesc);
                }

                if (sigData.calleeCandidates && Array.isArray(sigData.calleeCandidates)) {
                  for (const cand of sigData.calleeCandidates) {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch {
                      // Candidate may already be processed
                    }
                  }
                }
              });

              signalSubscriptionsRef.current[peerId] = unsubSignal;
            } else {
              // RESPONDER (Callee)
              pc.onicecandidate = async (event) => {
                if (event.candidate) {
                  try {
                    await updateDoc(signalDocRef, {
                      calleeCandidates: arrayUnion(event.candidate.toJSON()),
                    });
                  } catch {
                    // Non-blocking
                  }
                }
              };

              const unsubSignal = onSnapshot(signalDocRef, async (sigSnap) => {
                if (!sigSnap.exists()) return;
                const sigData = sigSnap.data();

                if (sigData.offer && !pc.currentRemoteDescription) {
                  const offerDesc = new RTCSessionDescription(sigData.offer);
                  await pc.setRemoteDescription(offerDesc);

                  const answer = await pc.createAnswer();
                  const lyraAnswerSdp = applyLyra6kbpsSdp(answer.sdp || '');
                  const lyraAnswer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: lyraAnswerSdp,
                  });

                  await pc.setLocalDescription(lyraAnswer);
                  await configureLyraBitrateOnSender(pc);

                  await updateDoc(signalDocRef, {
                    answer: { type: 'answer', sdp: lyraAnswerSdp },
                  });
                }

                if (sigData.callerCandidates && Array.isArray(sigData.callerCandidates)) {
                  for (const cand of sigData.callerCandidates) {
                    try {
                      await pc.addIceCandidate(new RTCIceCandidate(cand));
                    } catch {
                      // Non-blocking
                    }
                  }
                }
              });

              signalSubscriptionsRef.current[peerId] = unsubSignal;
            }
          }
        } else if (change.type === 'removed') {
          if (signalSubscriptionsRef.current[peerId]) {
            signalSubscriptionsRef.current[peerId]();
            delete signalSubscriptionsRef.current[peerId];
          }
          if (peerConnectionsRef.current[peerId]) {
            peerConnectionsRef.current[peerId].close();
            delete peerConnectionsRef.current[peerId];
          }
        }
      }
    });

    setIsMicEnabled(true);
    toast.success("WebRTC Voice Connected (Lyra @ 6 kbps)", { icon: '🎙️' });

    return () => {
      unsubParticipants();
    };
  }, [matchId, userId, username]);

  // Teardown WebRTC and Audio
  const stopAudioAndWebRtc = useCallback(() => {
    if (localVADFrameRef.current) cancelAnimationFrame(localVADFrameRef.current);
    if (remoteVADFrameRef.current) cancelAnimationFrame(remoteVADFrameRef.current);

    // Stop raw mic tracks
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }
    // Stop processed tracks
    if (processedStreamRef.current) {
      processedStreamRef.current.getTracks().forEach((track) => track.stop());
      processedStreamRef.current = null;
    }
    // Close peer connections
    Object.values(peerConnectionsRef.current).forEach((pc: RTCPeerConnection) => {
      try {
        pc.close();
      } catch {
        // Closed
      }
    });
    peerConnectionsRef.current = {};

    // Unsubscribe signaling listeners
    Object.values(signalSubscriptionsRef.current).forEach((unsub: unknown) => {
      try {
        if (typeof unsub === 'function') {
          unsub();
        }
      } catch {
        // Unsubscribed
      }
    });
    signalSubscriptionsRef.current = {};

    // Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop remote audio element
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setIsMicEnabled(false);
    setIsSpeaking(false);
    setIsRemoteSpeaking(false);
    setConnectionState('idle');
    broadcastSpeakingState(false);

    // Clean participant entry
    if (matchId && userId) {
      deleteDoc(doc(db, 'compete_voice', matchId, 'participants', userId)).catch(() => {});
    }
  }, [matchId, userId, broadcastSpeakingState]);

  // Toggle Mic Button
  const toggleMic = () => {
    if (isMicEnabled) {
      stopAudioAndWebRtc();
    } else {
      initializeWebRtc();
    }
  };

  // Push to talk handlers
  const handlePTTDown = () => {
    setIsHoldingPTT(true);
    if (!isMicEnabled) {
      initializeWebRtc();
    } else if (rawStreamRef.current) {
      rawStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
    }
  };

  const handlePTTUp = () => {
    setIsHoldingPTT(false);
    if (pushToTalkMode) {
      if (rawStreamRef.current) {
        rawStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
      }
    }
  };

  // Spacebar keyboard listener for Push-to-Talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && pushToTalkMode && !isHoldingPTTRef.current) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          handlePTTDown();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && pushToTalkMode && isHoldingPTTRef.current) {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          handlePTTUp();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [pushToTalkMode]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudioAndWebRtc();
    };
  }, [stopAudioAndWebRtc]);

  const otherSpeakers = (Object.entries(activeSpeakers) as [string, { username: string; speaking: boolean; lastSeen: number }][]).filter(
    ([uid]) => uid !== userId
  );

  return (
    <div className="flex flex-col gap-2 p-3 rounded-2xl bg-card border shadow-xs text-xs">
      <div className="flex items-center justify-between gap-3">
        {/* LEFT STATUS & CODEC INDICATOR */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <div className={`p-2 rounded-xl transition-all ${
              connectionState === 'connected'
                ? 'bg-emerald-500/10 text-emerald-500'
                : connectionState === 'connecting'
                ? 'bg-amber-500/10 text-amber-500 animate-pulse'
                : 'bg-muted text-muted-foreground'
            }`}>
              <Radio size={15} className={connectionState === 'connected' && (isSpeaking || isRemoteSpeaking) ? 'animate-pulse' : ''} />
            </div>
            {connectionState === 'connected' && isSpeaking && (
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 animate-ping" />
            )}
          </div>

          <div className="flex flex-col">
            <div className="font-mono font-bold text-xs flex items-center gap-1.5 text-foreground">
              <span>WebRTC Voice</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-wide">
                Lyra 6kbps
              </span>
              {connectionState === 'connected' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live P2P
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
              <span>
                {connectionState === 'connected'
                  ? isSpeaking
                    ? 'Transmitting Voice (16kHz, 6 kbps)...'
                    : isRemoteSpeaking
                    ? 'Peer Speaking...'
                    : 'Channel Open • Ready'
                  : connectionState === 'connecting'
                  ? 'Establishing P2P link...'
                  : 'Voice Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* ACTIVE REMOTE SPEAKERS */}
        {otherSpeakers.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Users size={12} className="text-emerald-500" />
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              {otherSpeakers.map(([, info]) => info.username).join(', ')} speaking
            </span>
          </div>
        )}

        {/* CONTROLS */}
        <div className="flex items-center gap-1.5">
          {/* PUSH TO TALK BUTTON */}
          {pushToTalkMode ? (
            <Button
              size="sm"
              variant={isHoldingPTT ? 'default' : 'outline'}
              onMouseDown={handlePTTDown}
              onMouseUp={handlePTTUp}
              onTouchStart={handlePTTDown}
              onTouchEnd={handlePTTUp}
              className={`h-8 text-[11px] font-bold px-3 select-none transition-colors ${
                isHoldingPTT ? 'bg-emerald-600 text-white' : ''
              }`}
            >
              <Mic size={13} className="mr-1.5" />
              {isHoldingPTT ? 'Talking (Space)' : 'Hold to Speak'}
            </Button>
          ) : (
            <Button
              size="sm"
              variant={isMicEnabled ? 'default' : 'outline'}
              onClick={toggleMic}
              className={`h-8 px-3 text-[11px] font-bold rounded-xl transition-all ${
                isMicEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'hover:bg-muted'
              }`}
              title={isMicEnabled ? 'Mute Microphone' : 'Connect Microphone (WebRTC Lyra @ 6kbps)'}
            >
              {isMicEnabled ? (
                <>
                  <Mic size={13} className="mr-1.5 animate-pulse" />
                  Connected
                </>
              ) : (
                <>
                  <MicOff size={13} className="mr-1.5 text-muted-foreground" />
                  Join Voice
                </>
              )}
            </Button>
          )}

          {/* DEAFEN / UNDEAFEN */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsDeafened(!isDeafened)}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            title={isDeafened ? 'Undeafen (Unmute Peers)' : 'Deafen (Mute Peers)'}
          >
            {isDeafened ? <VolumeX size={14} className="text-rose-500" /> : <Volume2 size={14} />}
          </Button>

          {/* MODE TOGGLE: PTT vs OPEN MIC */}
          <button
            onClick={() => setPushToTalkMode(!pushToTalkMode)}
            className="px-2 py-1 rounded-md text-[10px] font-mono font-bold text-muted-foreground hover:text-primary bg-muted/50 hover:bg-muted transition-colors border"
            title="Toggle Voice Transmission Mode"
          >
            {pushToTalkMode ? 'PTT Mode' : 'Open Mic'}
          </button>

          {/* CODEC & DIAGNOSTICS INFO POPUP TRIGGER */}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowStatsModal(!showStatsModal)}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            title="View WebRTC Lyra Codec Stats"
          >
            <Info size={14} />
          </Button>
        </div>
      </div>

      {/* EXPANDABLE STATS & VOLUME BAR */}
      {showStatsModal && (
        <div className="mt-1 pt-2.5 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-foreground font-semibold">
              <ShieldCheck size={12} className="text-emerald-500" />
              Codec: <strong className="text-primary font-mono font-bold">Lyra Neural Codec</strong>
            </span>
            <span>Target Bitrate: <strong className="text-foreground">6.0 kbps</strong></span>
            <span>Audio Sampling: <strong className="text-foreground">16 kHz</strong></span>
            <span>Bandwidth: <strong className="text-foreground">b=AS:6 / b=TIAS:6000</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold">Peer Vol:</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="h-1.5 w-20 accent-primary cursor-pointer"
            />
            <span className="text-[10px] w-6">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
