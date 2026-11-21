import React from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { VoiceStatus } from '../hooks/useCompeteVoice';

interface CompeteVoiceControlsProps {
  isHumanMatch: boolean;
  isMicOn: boolean;
  isMicBusy: boolean;
  isOpponentMuted: boolean;
  voiceStatus: VoiceStatus;
  onToggleMic: () => void;
  onToggleOpponentMute: () => void;
  onRetry?: () => void;
  compact?: boolean;
}

export function CompeteVoiceControls({
  isHumanMatch,
  isMicOn,
  isMicBusy,
  isOpponentMuted,
  voiceStatus,
  onToggleMic,
  onToggleOpponentMute,
  onRetry,
  compact = false,
}: CompeteVoiceControlsProps) {
  if (!isHumanMatch) return null;

  const statusMeta: Record<VoiceStatus, { label: string; dotClass: string; textClass: string }> = {
    idle: { label: 'Voice Off', dotClass: 'bg-stone-400', textClass: 'text-muted-foreground' },
    connecting: { label: 'Connecting', dotClass: 'bg-amber-400 animate-pulse', textClass: 'text-amber-600 dark:text-amber-400' },
    connected: { label: 'Voice Live', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600 dark:text-emerald-400' },
    weak: { label: 'Weak Net', dotClass: 'bg-amber-500 animate-pulse', textClass: 'text-amber-600 dark:text-amber-400' },
    reconnecting: { label: 'Reconnecting', dotClass: 'bg-amber-500 animate-ping', textClass: 'text-amber-600 dark:text-amber-400' },
    failed: { label: onRetry ? 'NAT Blocked · Retry' : 'NAT Blocked', dotClass: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400' },
    opponent_left: { label: 'Peer Left', dotClass: 'bg-stone-400', textClass: 'text-muted-foreground' },
  };

  const status = statusMeta[voiceStatus];

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-xl border bg-background/80 backdrop-blur-xs ${compact ? 'px-2 py-1' : 'px-3 py-1.5 shadow-xs'}`}>
      {/* Status indicator */}
      {voiceStatus === 'failed' && onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          title="Connection blocked or timed out. Click to retry voice handshake."
          className="flex items-center gap-1.5 pr-1.5 border-r border-border/70 cursor-pointer hover:opacity-80"
        >
          <span className={`h-2 w-2 rounded-full shrink-0 ${status.dotClass}`} />
          <span className={`text-[10px] font-mono font-bold uppercase tracking-tight ${status.textClass}`}>
            {status.label}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 pr-1.5 border-r border-border/70">
          <span className={`h-2 w-2 rounded-full shrink-0 ${status.dotClass}`} />
          <span className={`text-[10px] font-mono font-bold uppercase tracking-tight hidden sm:inline ${status.textClass}`}>
            {status.label}
          </span>
        </div>
      )}

      {/* Mic Toggle (Disabled by default) */}
      <Button
        type="button"
        variant={isMicOn ? 'default' : 'ghost'}
        size="sm"
        onClick={onToggleMic}
        disabled={isMicBusy || voiceStatus === 'opponent_left' || voiceStatus === 'failed'}
        title={isMicOn ? 'Mute your microphone' : 'Unmute microphone to speak'}
        aria-label={isMicOn ? 'Mute your microphone' : 'Unmute microphone to speak'}
        className={`h-7 px-2 gap-1 text-xs font-bold cursor-pointer transition-all ${
          isMicOn
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        {isMicBusy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : isMicOn ? (
          <Mic size={14} />
        ) : (
          <MicOff size={14} />
        )}
        <span className="hidden md:inline">{isMicOn ? 'Mic On' : 'Mic Off'}</span>
      </Button>

      {/* Speaker Toggle (Mute / Unmute Opponent) */}
      <Button
        type="button"
        variant={isOpponentMuted ? 'destructive' : 'ghost'}
        size="sm"
        onClick={onToggleOpponentMute}
        disabled={voiceStatus === 'opponent_left'}
        title={isOpponentMuted ? 'Unmute opponent audio' : 'Mute opponent audio'}
        aria-label={isOpponentMuted ? 'Unmute opponent audio' : 'Mute opponent audio'}
        className={`h-7 px-2 gap-1 text-xs font-bold cursor-pointer transition-all ${
          isOpponentMuted
            ? 'bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30'
            : 'text-foreground hover:bg-muted'
        }`}
      >
        {isOpponentMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        <span className="hidden md:inline">{isOpponentMuted ? 'Muted' : 'Speaker'}</span>
      </Button>
    </div>
  );
}
