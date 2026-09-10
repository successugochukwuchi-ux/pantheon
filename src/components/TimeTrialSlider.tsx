import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Flame, User } from 'lucide-react';

export interface TimeTrialPlayer {
  uid: string;
  username: string;
  photoURL?: string;
  points: number;
  answersCount?: number;
  correctCount?: number;
  votedToStart?: boolean;
  isHost?: boolean;
}

interface TimeTrialSliderProps {
  players: Record<string, TimeTrialPlayer>;
  currentUserId: string;
}

export const TimeTrialSlider: React.FC<TimeTrialSliderProps> = ({ players, currentUserId }) => {
  const playerList: TimeTrialPlayer[] = Object.values(players || {}) as TimeTrialPlayer[];
  if (playerList.length === 0) return null;

  // Find range of points for slider scaling
  const pointsArray = playerList.map(p => p.points || 0);
  const minPoints = Math.min(0, ...pointsArray);
  const maxPoints = Math.max(10, ...pointsArray);
  const range = Math.max(1, maxPoints - minPoints);

  // Sort players descending to get rankings
  const rankedPlayers = [...playerList].sort((a, b) => (b.points || 0) - (a.points || 0));
  const leaderUid = rankedPlayers[0]?.uid;

  // Colors for up to 6 players
  const playerColors = [
    { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', ring: 'ring-amber-400' },
    { bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', ring: 'ring-blue-400' },
    { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', ring: 'ring-emerald-400' },
    { bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', ring: 'ring-purple-400' },
    { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', ring: 'ring-rose-400' },
    { bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500', ring: 'ring-cyan-400' },
  ];

  return (
    <div className="w-full bg-card border rounded-2xl p-4 shadow-sm space-y-3 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <Flame size={16} className="fill-amber-500" />
          </div>
          <span className="text-xs font-mono font-bold tracking-wide uppercase text-foreground">
            Time Trial Leader Track
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-muted-foreground">
          <span>{playerList.length} Competitors</span>
          <span>•</span>
          <span className="text-primary font-bold">Goal: Max Net Points</span>
        </div>
      </div>

      {/* TRACK RUNWAY */}
      <div className="relative h-16 w-full bg-muted/40 rounded-xl px-6 py-2 border flex items-center">
        {/* Track milestones / lines */}
        <div className="absolute inset-0 flex justify-between items-center px-4 pointer-events-none opacity-20">
          <div className="border-l border-foreground h-full" />
          <div className="border-l border-dashed border-foreground h-full" />
          <div className="border-l border-dashed border-foreground h-full" />
          <div className="border-l border-dashed border-foreground h-full" />
          <div className="border-l-2 border-foreground h-full" />
        </div>

        {/* PLAYERS ON TRACK */}
        <div className="relative w-full h-full">
          {rankedPlayers.map((player, idx) => {
            const isMe = player.uid === currentUserId;
            const isLeader = player.uid === leaderUid && (player.points || 0) > 0;
            const pts = player.points || 0;
            const normalizedPercent = Math.max(3, Math.min(97, ((pts - minPoints) / range) * 100));
            const color = playerColors[idx % playerColors.length];

            return (
              <motion.div
                key={player.uid}
                layout
                initial={{ left: '0%' }}
                animate={{ left: `${normalizedPercent}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 25 }}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center z-10"
                style={{ zIndex: isMe ? 30 : 20 - idx }}
              >
                {/* Crown for leader */}
                {isLeader && (
                  <Crown size={14} className="text-amber-500 fill-amber-500 -mb-1 animate-bounce" />
                )}

                {/* Avatar with photo or initials */}
                <div
                  className={`relative h-9 w-9 rounded-full border-2 ${color.border} bg-card shadow-md flex items-center justify-center overflow-hidden transition-transform ${
                    isMe ? 'ring-2 ring-primary scale-110' : ''
                  }`}
                  title={`${player.username}: ${pts} points`}
                >
                  {player.photoURL ? (
                    <img
                      src={player.photoURL}
                      alt={player.username}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`h-full w-full flex items-center justify-center text-xs font-bold ${color.bg} text-white`}>
                      {player.username?.charAt(0)?.toUpperCase() || <User size={12} />}
                    </div>
                  )}

                  {/* Rank badge */}
                  <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-foreground text-background text-[9px] font-bold flex items-center justify-center font-mono">
                    {idx + 1}
                  </span>
                </div>

                {/* Name and points tag */}
                <div className="mt-1 text-[10px] font-mono font-bold whitespace-nowrap px-1.5 py-0.5 rounded bg-background/90 border shadow-xs flex items-center gap-1">
                  <span className="truncate max-w-[60px]">
                    {isMe ? 'You' : player.username}
                  </span>
                  <span className={pts >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {pts > 0 ? `+${pts}` : pts}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* MINI LIVE STANDINGS STRIP */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t text-xs">
        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">Rank:</span>
        {rankedPlayers.map((p, rankIdx) => {
          const isMe = p.uid === currentUserId;
          return (
            <div
              key={p.uid}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono border ${
                isMe
                  ? 'bg-primary/10 border-primary/30 text-primary font-bold'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
            >
              <span className="font-extrabold text-[10px] opacity-75">#{rankIdx + 1}</span>
              <span className="truncate max-w-[70px]">{p.username}</span>
              <span className={`font-black ${p.points >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {p.points}pt
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
