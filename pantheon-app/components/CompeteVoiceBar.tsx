import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { F } from './Theme';
import { MicIcon, MicOffIcon, SpeakerIcon, SpeakerMutedIcon } from './Icons';
import { VoiceStatus } from '../lib/useCompeteVoice';

interface CompeteVoiceBarProps {
  isHumanMatch: boolean;
  isMicOn: boolean;
  isMicBusy: boolean;
  isOpponentMuted: boolean;
  voiceStatus: VoiceStatus;
  onToggleMic: () => void;
  onToggleOpponentMute: () => void;
  onRetry?: () => void;
}

export function CompeteVoiceBar({
  isHumanMatch,
  isMicOn,
  isMicBusy,
  isOpponentMuted,
  voiceStatus,
  onToggleMic,
  onToggleOpponentMute,
  onRetry,
}: CompeteVoiceBarProps) {
  const { colors: C } = useTheme();

  if (!isHumanMatch) return null;

  const statusMeta: Record<VoiceStatus, { label: string; dotColor: string; textColor: string }> = {
    idle: { label: 'VOICE OFF', dotColor: C.inkLight, textColor: C.inkLight },
    connecting: { label: 'CONNECTING', dotColor: '#F59E0B', textColor: '#D97706' },
    connected: { label: 'VOICE LIVE', dotColor: '#10B981', textColor: '#059669' },
    weak: { label: 'WEAK NET', dotColor: '#F59E0B', textColor: '#D97706' },
    reconnecting: { label: 'RECONNECTING', dotColor: '#F59E0B', textColor: '#D97706' },
    failed: { label: onRetry ? 'NAT BLOCKED · RETRY' : 'NAT BLOCKED', dotColor: '#EF4444', textColor: '#DC2626' },
    opponent_left: { label: 'PEER LEFT', dotColor: C.inkLight, textColor: C.inkLight },
    unavailable: { label: 'APK NEEDED', dotColor: C.inkLight, textColor: C.inkLight },
  };

  const meta = statusMeta[voiceStatus];
  const micDisabled = isMicBusy || voiceStatus === 'opponent_left' || voiceStatus === 'failed';
  const speakerDisabled = voiceStatus === 'opponent_left';

  return (
    <View style={[styles.container, { backgroundColor: C.surface, borderColor: C.border }]}>
      {voiceStatus === 'failed' && onRetry ? (
        <TouchableOpacity onPress={onRetry} activeOpacity={0.7} style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: meta.dotColor }]} />
          <Text style={[styles.statusLabel, { color: meta.textColor }]}>{meta.label}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: meta.dotColor }]} />
          <Text style={[styles.statusLabel, { color: meta.textColor }]}>{meta.label}</Text>
        </View>
      )}

      <View style={styles.buttonsRow}>
        {/* Mic Toggle (Disabled by default) */}
        <TouchableOpacity
          onPress={onToggleMic}
          disabled={micDisabled}
          activeOpacity={0.75}
          accessibilityLabel={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
          style={[
            styles.btn,
            {
              backgroundColor: isMicOn ? '#059669' : C.bgAlt,
              borderColor: isMicOn ? '#059669' : C.border,
              opacity: micDisabled ? 0.5 : 1,
            },
          ]}
        >
          {isMicBusy ? (
            <ActivityIndicator size="small" color={isMicOn ? '#FFFFFF' : C.ink} />
          ) : isMicOn ? (
            <MicIcon color="#FFFFFF" />
          ) : (
            <MicOffIcon color={C.inkMid} />
          )}
          <Text style={[styles.btnText, { color: isMicOn ? '#FFFFFF' : C.inkMid }]}>
            {isMicOn ? 'Mic On' : 'Mic Off'}
          </Text>
        </TouchableOpacity>

        {/* Speaker Toggle (Mute / Unmute Opponent) */}
        <TouchableOpacity
          onPress={onToggleOpponentMute}
          disabled={speakerDisabled}
          activeOpacity={0.75}
          accessibilityLabel={isOpponentMuted ? 'Unmute opponent' : 'Mute opponent'}
          style={[
            styles.btn,
            {
              backgroundColor: isOpponentMuted ? '#FADBD8' : C.bgAlt,
              borderColor: isOpponentMuted ? '#E74C3C' : C.border,
              opacity: speakerDisabled ? 0.5 : 1,
            },
          ]}
        >
          {isOpponentMuted ? (
            <SpeakerMutedIcon color="#C0392B" />
          ) : (
            <SpeakerIcon color={C.ink} />
          )}
          <Text style={[styles.btnText, { color: isOpponentMuted ? '#C0392B' : C.ink }]}>
            {isOpponentMuted ? 'Muted' : 'Speaker'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontFamily: F.bold,
    fontSize: 10,
    letterSpacing: 0.7,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnText: {
    fontFamily: F.bold,
    fontSize: 12,
  },
});
