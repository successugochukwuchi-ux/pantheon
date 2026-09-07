import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  PanResponder,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { speakText, stopSpeech } from '../lib/ttsService';
import { getBackendUrls } from '../lib/backendConfig';
import { F, C } from './Theme';

export type CallState = 'listening' | 'recording' | 'thinking' | 'speaking';

interface HermesMobileLiveOrbProps {
  visible: boolean;
  onClose: () => void;
  onOpenChat: () => void;
  noteTitle: string;
  noteContent: string;
  onSendMessage: (text: string, isVoiceCall: boolean) => Promise<string>;
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  onUpdateChatHistory: (userMsg: string, botResponse: string) => void;
}

const ORB_SIZE = 56;
const WINDOW = Dimensions.get('window');

export function HermesMobileLiveOrb({
  visible,
  onClose,
  onOpenChat,
  noteTitle,
  noteContent,
  onSendMessage,
  chatHistory,
  onUpdateChatHistory,
}: HermesMobileLiveOrbProps) {
  const [callState, setCallState] = useState<CallState>('listening');
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Hermes Live');
  const [latestBubble, setLatestBubble] = useState<string>('');
  const [bubbleVisible, setBubbleVisible] = useState(false);

  // Position state with PanResponder for free dragging
  const pan = useRef(new Animated.ValueXY({
    x: WINDOW.width - ORB_SIZE - 16,
    y: Platform.OS === 'ios' ? 56 : 48,
  })).current;

  // Recording ref
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isPressHoldingRef = useRef(false);
  const bubbleTimeoutRef = useRef<any>(null);

  // Pulsing and glow animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim1 = useRef(new Animated.Value(1)).current;
  const rippleAnim2 = useRef(new Animated.Value(1)).current;

  // 1. Request Mic Permission on Mount / Visible
  const ensureMicPermission = async (): Promise<boolean> => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      const granted = status === 'granted';
      setHasMicPermission(granted);
      if (granted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }
      return granted;
    } catch (e) {
      console.warn('Failed to request mic permission:', e);
      setHasMicPermission(false);
      return false;
    }
  };

  useEffect(() => {
    if (visible) {
      ensureMicPermission();
      setStatusMessage('Hermes Live');
    } else {
      handleHangup();
    }
  }, [visible]);

  // 2. Pulse / Rotation Loop
  useEffect(() => {
    if (!visible) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    const rotate = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotate.start();

    return () => {
      pulse.stop();
      rotate.stop();
    };
  }, [visible]);

  // 3. Speaking Ripple Loop
  useEffect(() => {
    if (callState !== 'speaking' && callState !== 'recording') return;

    const rip1 = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim1, {
          toValue: 1.55,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim1, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const rip2 = Animated.loop(
      Animated.sequence([
        Animated.timing(rippleAnim2, {
          toValue: 1.35,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(rippleAnim2, {
          toValue: 1.0,
          duration: 1200,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    rip1.start();
    rip2.start();

    return () => {
      rip1.stop();
      rip2.stop();
    };
  }, [callState]);

  // Instant Interruption / Barge-in
  const interruptHermes = useCallback(async () => {
    try {
      await stopSpeech();
    } catch {}
    if (callState === 'speaking') {
      setCallState('listening');
      setStatusMessage('Listening...');
    }
  }, [callState]);

  // Transcribe recorded audio via backend
  const transcribeAudio = async (uri: string): Promise<string> => {
    try {
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const backendUrls = getBackendUrls();
      for (const baseUrl of backendUrls) {
        try {
          const res = await fetch(`${baseUrl}/api/hermes/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: base64Audio,
              mimeType: 'audio/m4a',
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.text) {
              return data.text.trim();
            }
          }
        } catch (err) {
          console.warn(`Transcribe failed on ${baseUrl}:`, err);
        }
      }
    } catch (e) {
      console.warn('Error reading audio for transcribe:', e);
    }
    return '';
  };

  // Start Recording
  const startRecording = async () => {
    // Interruption: cut off any speaking immediately
    await interruptHermes();

    const hasPermission = await ensureMicPermission();
    if (!hasPermission) {
      setStatusMessage('Mic permission denied');
      return;
    }

    try {
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {}
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();

      recordingRef.current = newRecording;
      setCallState('recording');
      setStatusMessage('Listening...');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setCallState('listening');
      setStatusMessage('Tap to speak');
    }
  };

  // Stop Recording & Send to Hermes
  const stopRecordingAndSend = async () => {
    if (!recordingRef.current) {
      setCallState('listening');
      return;
    }

    setCallState('thinking');
    setStatusMessage('Hermes is thinking...');

    try {
      const rec = recordingRef.current;
      recordingRef.current = null;
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();

      if (!uri) {
        setCallState('listening');
        setStatusMessage('Ready');
        return;
      }

      const transcription = await transcribeAudio(uri);

      // Clean up audio file
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});

      if (!transcription || transcription.trim().length === 0) {
        setCallState('listening');
        setStatusMessage('Ready');
        return;
      }

      // Show what student said in quick bubble
      setLatestBubble(`You: "${transcription}"`);
      setBubbleVisible(true);

      // Query Hermes
      const botResponse = await onSendMessage(transcription, true);
      onUpdateChatHistory(transcription, botResponse);

      // Display response in bubble and speak
      if (botResponse) {
        setLatestBubble(botResponse);
        setBubbleVisible(true);
        if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current);
        bubbleTimeoutRef.current = setTimeout(() => {
          setBubbleVisible(false);
        }, 6000);

        setCallState('speaking');
        setStatusMessage('Hermes is speaking');

        await speakText(botResponse, {
          voiceId: 'en-US-AriaNeural',
          rate: 1.0,
          onStart: () => {
            setCallState('speaking');
            setStatusMessage('Hermes is speaking');
          },
          onDone: () => {
            setCallState('listening');
            setStatusMessage('Ready');
          },
          onError: () => {
            setCallState('listening');
            setStatusMessage('Ready');
          },
        });
      } else {
        setCallState('listening');
        setStatusMessage('Ready');
      }
    } catch (err) {
      console.error('Error during recording process:', err);
      setCallState('listening');
      setStatusMessage('Ready');
    }
  };

  // Hangup call
  const handleHangup = async () => {
    await stopSpeech();
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setCallState('listening');
    setShowControls(false);
    setBubbleVisible(false);
    onClose();
  };

  // Draggable PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        // Clamp inside screen dimensions
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;
        const clampedX = Math.max(8, Math.min(WINDOW.width - ORB_SIZE - 8, currentX));
        const clampedY = Math.max(30, Math.min(WINDOW.height - ORB_SIZE - 50, currentY));

        pan.setValue({ x: clampedX, y: clampedY });

        // If tap (negligible movement)
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          handleOrbTap();
        }
      },
    })
  ).current;

  // Handle tap on Orb
  const handleOrbTap = async () => {
    if (callState === 'speaking') {
      // Barge-in interruption
      await interruptHermes();
      return;
    }

    if (callState === 'recording') {
      // Stop and process
      await stopRecordingAndSend();
      return;
    }

    // Toggle controls pill
    setShowControls(prev => !prev);
  };

  if (!visible) return null;

  // Dynamic colors matching Google Gemini Live
  const getOrbGlowColors = () => {
    switch (callState) {
      case 'recording':
        return ['#06b6d4', '#3b82f6', '#ef4444'];
      case 'thinking':
        return ['#f59e0b', '#ec4899', '#8b5cf6'];
      case 'speaking':
        return ['#10b981', '#06b6d4', '#3b82f6'];
      case 'listening':
      default:
        return ['#38bdf8', '#6366f1', '#a855f7'];
    }
  };

  return (
    <View style={s.fullWindowOverlay} pointerEvents="box-none">
      {/* Draggable Floating Orb Container */}
      <Animated.View
        style={[
          s.draggableWrapper,
          {
            transform: pan.getTranslateTransform(),
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Luminous Outer Ripple Waves (during speaking or recording) */}
        {(callState === 'speaking' || callState === 'recording') && (
          <Animated.View
            style={[
              s.outerRipple,
              {
                transform: [{ scale: rippleAnim1 }],
                opacity: 0.5,
              },
            ]}
          >
            <LinearGradient
              colors={getOrbGlowColors()}
              style={s.fillCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
        )}

        {/* Outer Aura Halo */}
        <Animated.View
          style={[
            s.haloGlow,
            {
              transform: [{ scale: pulseAnim }],
              opacity: callState === 'recording' ? 0.85 : 0.6,
            },
          ]}
        >
          <LinearGradient
            colors={getOrbGlowColors()}
            style={s.fillCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Core Gemini Live Circular Orb */}
        <View style={s.orbCircle}>
          <LinearGradient
            colors={['#090d16', '#131b2e', '#05070d']}
            style={s.orbInnerCore}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Iridescent Accent Ring */}
            <View style={s.iridescentRim} />

            {/* Status Content */}
            {callState === 'thinking' ? (
              <ActivityIndicator size="small" color="#38bdf8" />
            ) : callState === 'speaking' ? (
              <View style={s.waveBarRow}>
                <View style={[s.soundBar, { height: 14, backgroundColor: '#34d399' }]} />
                <View style={[s.soundBar, { height: 20, backgroundColor: '#38bdf8' }]} />
                <View style={[s.soundBar, { height: 11, backgroundColor: '#818cf8' }]} />
              </View>
            ) : callState === 'recording' ? (
              <View style={s.recordingDot} />
            ) : (
              <Text style={s.sparkleGlyph}>✦</Text>
            )}
          </LinearGradient>
        </View>

        {/* Small Active Badge Dot */}
        <View
          style={[
            s.stateBadgeDot,
            {
              backgroundColor:
                callState === 'speaking'
                  ? '#10b981'
                  : callState === 'recording'
                  ? '#ef4444'
                  : callState === 'thinking'
                  ? '#f59e0b'
                  : '#38bdf8',
            },
          ]}
        />
      </Animated.View>

      {/* Floating Micro-Pill Controls (Toggled by tap) */}
      {showControls && (
        <Animated.View
          style={[
            s.floatingControlsPill,
            {
              // Position slightly below the orb
              transform: [
                { translateX: pan.x },
                { translateY: Animated.add(pan.y, new Animated.Value(ORB_SIZE + 8)) },
              ],
            },
          ]}
          pointerEvents="auto"
        >
          {/* Hang Up Button */}
          <TouchableOpacity
            style={[s.controlBtn, s.hangupBtn]}
            onPress={handleHangup}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.hangupText}>✕</Text>
          </TouchableOpacity>

          {/* Hold / Tap to Speak Button */}
          <TouchableOpacity
            style={[
              s.controlBtn,
              s.speakBtn,
              callState === 'recording' && s.speakBtnActive,
            ]}
            onPress={async () => {
              if (callState === 'recording') {
                await stopRecordingAndSend();
              } else {
                await startRecording();
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={s.speakBtnText}>
              {callState === 'recording' ? '⏹ Stop' : '🎙 Speak'}
            </Text>
          </TouchableOpacity>

          {/* Switch to Chat Button */}
          <TouchableOpacity
            style={[s.controlBtn, s.chatBtn]}
            onPress={() => {
              handleHangup();
              onOpenChat();
            }}
            activeOpacity={0.8}
          >
            <Text style={s.chatBtnText}>💬 Chat</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Non-intrusive Floating Speech Preview Bubble */}
      {bubbleVisible && latestBubble ? (
        <Animated.View
          style={[
            s.transcriptFloatingBubble,
            {
              // Position near the top center without covering note
              top: Platform.OS === 'ios' ? 104 : 96,
            },
          ]}
          pointerEvents="auto"
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setBubbleVisible(false)}
            style={s.transcriptBubbleContent}
          >
            <Text style={s.bubbleText} numberOfLines={2}>
              {latestBubble}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  fullWindowOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  draggableWrapper: {
    position: 'absolute',
    width: ORB_SIZE,
    height: ORB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fillCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  outerRipple: {
    position: 'absolute',
    width: ORB_SIZE + 24,
    height: ORB_SIZE + 24,
    borderRadius: (ORB_SIZE + 24) / 2,
    zIndex: 1,
  },
  haloGlow: {
    position: 'absolute',
    width: ORB_SIZE + 12,
    height: ORB_SIZE + 12,
    borderRadius: (ORB_SIZE + 12) / 2,
    zIndex: 2,
  },
  orbCircle: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 3,
    backgroundColor: '#090d16',
    elevation: 8,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
  },
  orbInnerCore: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  iridescentRim: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  sparkleGlyph: {
    color: '#38bdf8',
    fontSize: 22,
    fontWeight: '700',
  },
  recordingDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444',
  },
  waveBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  soundBar: {
    width: 3,
    borderRadius: 2,
  },
  stateBadgeDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#05070d',
    zIndex: 4,
  },
  floatingControlsPill: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    zIndex: 10000,
  },
  controlBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hangupBtn: {
    backgroundColor: '#ef4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  hangupText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  speakBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  speakBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  speakBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontFamily: F.bold,
  },
  chatBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  chatBtnText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontFamily: F.medium,
  },
  transcriptFloatingBubble: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 9998,
    alignItems: 'center',
  },
  transcriptBubbleContent: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 6,
  },
  bubbleText: {
    color: '#f8fafc',
    fontSize: 12.5,
    fontFamily: F.medium,
    textAlign: 'center',
    lineHeight: 17,
  },
});
