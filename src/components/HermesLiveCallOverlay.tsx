import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Phone, PhoneOff, Mic, MicOff, MessageSquare, Volume2, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { chatWithHermes, ChatMessage } from '../services/aiService';
import { speakText, stopSpeech, stripDiagramsAndCleanForTTS, convertLatexToSpeakable, getCurrentSpokenText } from '../lib/ttsService';
import { AIConfig } from '../types';

// Deduplicates consecutive repeated words caused by Web Speech interim/final streaming overlap
// (e.g. "okay so okay okay okay so so now" -> "okay so now")
export function deduplicateRepeatedTokens(text: string): string {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return text;

  const result: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const prevWord = result[result.length - 1];
    // Don't repeat identical word consecutively
    if (prevWord && prevWord.toLowerCase() === word.toLowerCase()) {
      continue;
    }
    // Don't repeat 2-word phrase consecutively (e.g. "so now so now")
    if (
      result.length >= 2 &&
      result[result.length - 2].toLowerCase() === word.toLowerCase() &&
      i + 1 < words.length &&
      result[result.length - 1].toLowerCase() === words[i + 1].toLowerCase()
    ) {
      i++; // skip 2nd word of repeat
      continue;
    }
    result.push(word);
  }
  return result.join(' ');
}

// Determines if microphone input is the phone's loudspeaker echoing Hermes's own current sentence
function isEchoFromSpeaker(heardSpeech: string, currentSpoken: string): boolean {
  if (!currentSpoken || !heardSpeech) return false;

  const cleanHeard = heardSpeech.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const cleanSpoken = currentSpoken.toLowerCase().replace(/[^\w\s]/g, '').trim();

  // If user says any command or conversational cue, it is definitely user speech, NOT an echo
  if (/\b(stop|wait|hold|pause|cancel|hermes|quiet|listen|excuse|hey|hello|hi|what|why|how|can|could|please|sorry|question|repeat|explain|slow|fast|no|yes|check)\b/i.test(cleanHeard)) {
    return false;
  }

  // If heard speech is a contiguous exact substring of 3 or more words that Hermes just said, it's a speaker echo
  const heardWords = cleanHeard.split(/\s+/).filter(Boolean);
  if (heardWords.length >= 3) {
    const heardPhrase = heardWords.join(' ');
    if (cleanSpoken.includes(heardPhrase)) {
      return true; // verbatim loudspeaker echo
    }
  }

  // Check word overlap ratio against the current chunk: only consider echo if 80%+ of words match and there are at least 4 words
  if (heardWords.length >= 4) {
    const spokenWordSet = new Set(cleanSpoken.split(/\s+/));
    const matches = heardWords.filter(w => w.length > 2 && spokenWordSet.has(w)).length;
    if (matches / heardWords.length >= 0.8) {
      return true;
    }
  }

  return false;
}

// Normalizes common acoustic misrecognitions of "Hermes" (especially in diverse English accents)
export function normalizeHermesTranscript(raw: string): string {
  if (!raw) return '';
  let cleaned = deduplicateRepeatedTokens(raw);

  // Replace common phonetically confused phrases for "Hermes"
  return cleaned
    .replace(/^(time\s*is|times|tell\s*me|her\s*miss|air\s*miss|armies|homies|amis|amies|promise)\b/i, 'Hermes')
    .replace(/\b(time\s*is|her\s*miss|air\s*miss|armies|homies|amis)\b/gi, 'Hermes');
}

export type LiveCallState = 'listening' | 'thinking' | 'speaking' | 'muted';

interface HermesLiveCallOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  noteTitle: string;
  noteContent: string;
  aiConfig?: AIConfig | null;
  messages: ChatMessage[];
  onAddMessage: (msg: ChatMessage) => void;
}

export function HermesLiveCallOverlay({
  isOpen,
  onClose,
  onOpenChat,
  noteTitle,
  noteContent,
  aiConfig,
  messages,
  onAddMessage,
}: HermesLiveCallOverlayProps) {
  const [callState, setCallState] = useState<LiveCallState>('listening');
  const [transcript, setTranscript] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  // References to handle live lifecycle and interruptions cleanly
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const restartTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const isThinkingRef = useRef<boolean>(false);
  const lastRecognizedSpeechRef = useRef<string>('');
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Store latest props in refs to avoid recreating callbacks and useEffect
  const noteContentRef = useRef(noteContent);
  noteContentRef.current = noteContent;
  const aiConfigRef = useRef(aiConfig);
  aiConfigRef.current = aiConfig;
  const onAddMessageRef = useRef(onAddMessage);
  onAddMessageRef.current = onAddMessage;

  // Helper to start/resume speech recognition safely
  const startListening = useCallback(() => {
    if (!isOpen || isMicMuted) return;
    try {
      recognitionRef.current?.start();
    } catch (e: any) {
      // Ignore if already running
    }
  }, [isOpen, isMicMuted]);

  // Helper to stop speech recognition safely
  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch (e: any) {}
  }, []);

  // Cleanup all audio and recognition on close/unmount
  const stopAll = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    try {
      stopSpeech();
    } catch {}
    stopListening();
    recognitionRef.current = null;
    isSpeakingRef.current = false;
    isThinkingRef.current = false;
    lastRecognizedSpeechRef.current = '';
  }, [stopListening]);

  // Commit and dispatch question to Hermes
  const sendToHermes = useCallback(async (userText: string) => {
    const trimmed = normalizeHermesTranscript(userText);
    if (!trimmed || isThinkingRef.current) return;

    console.log('[HermesLiveCall] Dispatching to Hermes:', trimmed);

    // Switch to Thinking state
    isThinkingRef.current = true;
    setCallState('thinking');
    setErrorMessage(null);

    // Re-arm listening so user can interrupt while Hermes is thinking
    startListening();

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    onAddMessageRef.current(userMessage);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Direct DeepSeek chat with Note context (voice call mode enabled for Gemini Live brevity)
      const botResponse = await chatWithHermes(
        [...messagesRef.current, userMessage],
        noteContentRef.current,
        aiConfigRef.current || undefined,
        true
      );

      // If user interrupted during thinking, controller will be aborted
      if (controller.signal.aborted) {
        return;
      }

      console.log('[HermesLiveCall] Received answer from Hermes:', botResponse);

      isThinkingRef.current = false;
      const botMessage: ChatMessage = { role: 'assistant', content: botResponse };
      onAddMessageRef.current(botMessage);

      // Transition to Speaking state
      isSpeakingRef.current = true;
      setCallState('speaking');

      // Keep recognition armed so the user can interrupt verbally
      startListening();
      lastRecognizedSpeechRef.current = '';

      // Prepare speech text: strip diagram syntax and convert math to conversational words
      const cleaned = stripDiagramsAndCleanForTTS(convertLatexToSpeakable(botResponse));

      // Use STRICT natural EdgeTTS only (never robotic device synthesis)
      // Voice the full explanation without truncating!
      await speakText(cleaned || "I'm ready for your next question.", {
        disallowNativeFallback: true,
        onDone: () => {
          if (!isThinkingRef.current) {
            isSpeakingRef.current = false;
            setTranscript('');
            lastRecognizedSpeechRef.current = '';
            setCallState('listening');
            startListening();
          }
        },
        onError: (err) => {
          console.warn('[HermesLiveCall] TTS playback error/fallback:', err);
          if (!isThinkingRef.current) {
            isSpeakingRef.current = false;
            setTranscript('');
            lastRecognizedSpeechRef.current = '';
            setCallState('listening');
            startListening();
          }
        }
      });
    } catch (err: any) {
      if (controller.signal.aborted || err.name === 'AbortError') {
        return;
      }
      console.error('[HermesLiveCall] Error communicating with Hermes:', err);
      isThinkingRef.current = false;
      isSpeakingRef.current = false;
      setCallState('listening');
      setErrorMessage(err.message || 'Failed to connect to Hermes');
      startListening();
    }
  }, [startListening]);

  // Keep a stable ref to sendToHermes so callbacks don't break
  const sendToHermesRef = useRef(sendToHermes);
  sendToHermesRef.current = sendToHermes;

  // Handle user interrupt: called when user speaks while Hermes is thinking or speaking
  const handleUserInterruption = useCallback(() => {
    // 1. If Hermes is currently thinking, abort the pending request
    if (isThinkingRef.current && abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      isThinkingRef.current = false;
    }

    // 2. If Hermes is currently speaking, stop audio playback immediately
    if (isSpeakingRef.current) {
      try {
        stopSpeech();
      } catch {}
      isSpeakingRef.current = false;
    }

    // 3. Immediately switch visual state back to Listening and start mic
    setCallState('listening');
    setTranscript('');
    lastRecognizedSpeechRef.current = '';
    startListening();
  }, [startListening]);

  // Commit recognized speech helper
  const commitSpeech = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const speech = lastRecognizedSpeechRef.current.trim();
    if (!speech || isThinkingRef.current || isSpeakingRef.current) return;
    lastRecognizedSpeechRef.current = '';
    sendToHermesRef.current(speech);
  }, []);

  const commitSpeechRef = useRef(commitSpeech);
  commitSpeechRef.current = commitSpeech;
  const handleUserInterruptionRef = useRef(handleUserInterruption);
  handleUserInterruptionRef.current = handleUserInterruption;

  // Initialize Speech Recognition
  useEffect(() => {
    if (!isOpen) {
      stopAll();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or a WebSpeech-enabled browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    
    // Adapt to user's device locale if English (en-NG, en-GB, en-US) for high acoustic fidelity
    const preferredLang = (typeof navigator !== 'undefined' && navigator.language && navigator.language.startsWith('en'))
      ? navigator.language
      : 'en-US';
    recognition.lang = preferredLang;
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      if (isMicMuted) return;

      // Extract only the latest utterance cleanly to prevent cumulative repetitions
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript + ' ';
        } else {
          interim += item[0].transcript + ' ';
        }
      }

      const activeSpeech = normalizeHermesTranscript((final || interim).trim());
      if (!activeSpeech) return;

      // ── BARGE-IN / INTERRUPTION TRIGGER ──
      // 1. If user speaks while Hermes is thinking, abort and switch back to listening immediately!
      if (isThinkingRef.current) {
        console.log('[HermesLiveCall] User interrupted Hermes while thinking:', activeSpeech);
        handleUserInterruptionRef.current();
        setTranscript(activeSpeech);
        lastRecognizedSpeechRef.current = activeSpeech;
        return;
      }

      // 2. If user speaks while Hermes is speaking (Playback barge-in):
      if (isSpeakingRef.current) {
        const cleanLower = activeSpeech.toLowerCase().trim();
        const isInterruptCommand = /\b(stop|wait|hold\s*on|hold\s*up|pause|cancel|no\s*wait|hermes|quiet|listen|excuse\s*me|hey|hi|hello|what|why|how|sorry|can\s*you|could\s*you|question|slow\s*down)\b/i.test(cleanLower);

        // Check if the microphone is merely picking up the phone loudspeaker audio
        const currentSpoken = getCurrentSpokenText();
        const isSpeakerEcho = isEchoFromSpeaker(activeSpeech, currentSpoken);

        if (isInterruptCommand || (!isSpeakerEcho && cleanLower.length >= 2)) {
          console.log('[HermesLiveCall] Speech barge-in detected during playback:', activeSpeech);
          handleUserInterruptionRef.current();
          if (!/^(stop|wait|pause|cancel|quiet)$/i.test(cleanLower)) {
            setTranscript(activeSpeech);
            lastRecognizedSpeechRef.current = activeSpeech;
          }
          return;
        } else {
          // Acoustic echo from loudspeaker: silently ignore so it never quotes itself
          return;
        }
      }

      setTranscript(activeSpeech);
      lastRecognizedSpeechRef.current = activeSpeech;

      // Reset dynamic silence timer
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Trailing word detection: if user paused on a conjunction/preposition, wait slightly longer
      const isTrailing = /\b(and|or|because|so|that|the|a|an|to|is|in|of)\s*$/i.test(activeSpeech);
      const waitTime = isTrailing ? 1300 : 850;

      silenceTimerRef.current = setTimeout(() => {
        // Filter out accidental clicks (< 2 words and < 3 characters)
        if (activeSpeech.split(/\s+/).length >= 2 || activeSpeech.length >= 3) {
          commitSpeechRef.current();
        }
      }, waitTime);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        // Normal silence timeout from browser, ignore
        return;
      }
      if (event.error === 'not-allowed') {
        setErrorMessage('Microphone access denied. Please allow microphone permissions in your browser.');
        return;
      }
      console.warn('[HermesLiveCall] SpeechRecognition error:', event.error);
    };

    recognition.onend = () => {
      if (!isOpen) return;

      // If Hermes is speaking, do not commit any buffered speech, but keep mic re-armed for barge-in
      if (isSpeakingRef.current) {
        if (!isMicMuted && isOpen) {
          if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
          restartTimerRef.current = setTimeout(() => {
            if (!isOpen || isMicMuted) return;
            try { recognitionRef.current?.start(); } catch {}
          }, 150);
        }
        return;
      }

      console.log('[HermesLiveCall] recognition.onend fired. Current buffer:', lastRecognizedSpeechRef.current);

      // On Android Chrome, end of speech triggers onend automatically:
      // If we have recognized speech waiting and not currently thinking or speaking, commit it!
      if (!isThinkingRef.current && lastRecognizedSpeechRef.current && lastRecognizedSpeechRef.current.trim().length >= 3) {
        commitSpeechRef.current();
      }

      // Keep recognition continuously running as long as call is open and unmuted
      if (!isMicMuted && isOpen) {
        if (restartTimerRef.current) {
          clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = setTimeout(() => {
          if (!isOpen || isMicMuted) return;
          try {
            recognitionRef.current?.start();
          } catch {}
        }, 150);
      }
    };

    try {
      recognition.start();
      setCallState('listening');
    } catch (e) {
      console.warn('Could not start recognition immediately:', e);
    }

    return () => {
      stopAll();
    };
  }, [isOpen, isMicMuted, stopAll]);

  // Toggle mic mute
  const toggleMute = () => {
    if (isMicMuted) {
      setIsMicMuted(false);
      setCallState(isSpeakingRef.current ? 'speaking' : isThinkingRef.current ? 'thinking' : 'listening');
      try {
        recognitionRef.current?.start();
      } catch {}
    } else {
      setIsMicMuted(true);
      setCallState('muted');
      try {
        recognitionRef.current?.stop();
      } catch {}
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="fixed bottom-8 right-8 z-[100] select-none flex flex-col items-center"
      id="hermes-live-call-overlay"
    >
      {/* Tap-to-see-options Card (Floating above Orb) */}
      {showOptions && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          className="mb-3 p-3 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/20 shadow-2xl text-white flex flex-col gap-2 min-w-[220px]"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <span className="text-xs font-semibold tracking-wide text-slate-300 uppercase">Call Options</span>
            <button
              onClick={() => setShowOptions(false)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>

          {/* End Call Button */}
          <Button
            variant="destructive"
            onClick={() => {
              stopAll();
              setShowOptions(false);
              onClose();
            }}
            className="w-full justify-start gap-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-9 text-xs font-semibold shadow-md"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Call</span>
          </Button>

          {/* Mute Mic Toggle */}
          <Button
            variant="ghost"
            onClick={toggleMute}
            className={`w-full justify-start gap-2.5 rounded-xl h-9 text-xs text-white hover:bg-white/10 ${
              isMicMuted ? 'bg-rose-500/20 text-rose-300' : 'bg-white/5'
            }`}
          >
            {isMicMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}</span>
          </Button>

          {/* Switch to Text Chat */}
          <Button
            variant="ghost"
            onClick={() => {
              setShowOptions(false);
              onOpenChat();
            }}
            className="w-full justify-start gap-2.5 rounded-xl h-9 text-xs text-white hover:bg-white/10 bg-white/5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Switch to Text Chat</span>
          </Button>
        </motion.div>
      )}

      {/* Gemini Glowing Animated Orb Button */}
      <div className="relative flex items-center justify-center cursor-pointer group">
        {/* State-based ambient halo glow */}
        <motion.div
          animate={{
            scale: callState === 'speaking' ? [1, 1.4, 1.1, 1.5, 1] : callState === 'thinking' ? [1, 1.25, 1] : [1, 1.15, 1],
            opacity: callState === 'muted' ? 0.2 : [0.5, 0.85, 0.5],
          }}
          transition={{ duration: callState === 'speaking' ? 1.2 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute w-24 h-24 rounded-full blur-xl pointer-events-none ${
            callState === 'listening'
              ? 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600'
              : callState === 'thinking'
              ? 'bg-gradient-to-r from-amber-400 via-purple-500 to-pink-500'
              : callState === 'speaking'
              ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
              : 'bg-slate-700'
          }`}
        />

        {/* Multi-layer Concentric Orb Container */}
        <div
          onClick={() => {
            if (callState === 'speaking') {
              handleUserInterruption();
            }
            setShowOptions(prev => !prev);
          }}
          className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_35px_rgba(6,182,212,0.45)] border-2 border-white/30 bg-slate-950/80 backdrop-blur-xl transition-transform active:scale-95 hover:scale-105"
          title="Tap Orb to see options (End call, Mute, Chat)"
        >
          {/* Animated concentric acoustic wave / rotation rings */}
          {callState === 'listening' && (
            <>
              <motion.div
                animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0.15, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full border border-cyan-400/60"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 via-indigo-500 to-blue-400 opacity-90 shadow-inner flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-full bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
                  <Mic className="w-5 h-5 text-cyan-200 drop-shadow" />
                </div>
              </motion.div>
            </>
          )}

          {callState === 'thinking' && (
            <>
              {/* Rotating prismatic ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-1 rounded-full border-2 border-transparent border-t-amber-400 border-r-purple-400 border-b-cyan-400 border-l-pink-400"
              />
              <motion.div
                animate={{ scale: [0.95, 1.05, 0.95] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-amber-500 to-cyan-500 flex items-center justify-center shadow-lg"
              >
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </motion.div>
            </>
          )}

          {callState === 'speaking' && (
            <>
              {/* Fluid soundwave pulsation rings */}
              <motion.div
                animate={{ scale: [1, 1.45], opacity: [0.8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full border-2 border-emerald-400"
              />
              <motion.div
                animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
                className="absolute inset-0 rounded-full border-2 border-teal-300"
              />
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <Volume2 className="w-6 h-6 text-slate-950 animate-bounce" />
              </div>
            </>
          )}

          {callState === 'muted' && (
            <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
              <MicOff className="w-5 h-5 text-rose-400" />
            </div>
          )}

          {/* Glowing center badge */}
          <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-slate-900 border border-white/20 text-[9px] text-slate-300 font-bold uppercase tracking-wider">
            {callState === 'listening' ? 'LIVE' : callState === 'thinking' ? 'AI' : callState === 'speaking' ? 'TALK' : 'MUTE'}
          </div>
        </div>
      </div>

      {/* Subtitle / Status Capsule below Orb */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2.5 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/10 text-white text-center max-w-[280px] shadow-lg"
      >
        <p className="text-[11px] font-medium truncate">
          {transcript ? (
            <span className="italic text-cyan-200">"{transcript}"</span>
          ) : errorMessage ? (
            <span className="text-rose-400">{errorMessage}</span>
          ) : callState === 'listening' ? (
            <span className="text-slate-300">Listening... <span className="text-slate-500 text-[10px]">(tap orb for options)</span></span>
          ) : callState === 'thinking' ? (
            <span className="text-amber-300">Hermes is thinking...</span>
          ) : callState === 'speaking' ? (
            <span className="text-emerald-300">Hermes speaking (tap to interrupt)</span>
          ) : (
            <span className="text-slate-400">Microphone Muted</span>
          )}
        </p>
      </motion.div>
    </motion.div>
  );
}
