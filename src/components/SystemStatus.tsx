import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from './ui/badge';
import { Calendar, Gift, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export const SystemStatus: React.FC<{ className?: string, variant?: 'default' | 'compact' }> = ({ className, variant = 'default' }) => {
  const { systemConfig, promoConfig, loading, isOnline } = useAuth();

  if (loading && !systemConfig) return null;

  const isHoliday = systemConfig?.currentSemester === 'none';

  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {!isOnline && (
          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-dashed">
            OFFLINE
          </Badge>
        )}
        <Badge variant="outline" className={cn(
          "text-[10px] uppercase font-bold",
          isHoliday ? "bg-orange-500/10 text-orange-600 border-orange-500/20" : "bg-green-500/10 text-green-600 border-green-500/20"
        )}>
          {isHoliday ? 'Holiday' : `${systemConfig?.currentSemester || '...'} SEM`}
        </Badge>
        {promoConfig?.isActive && (
          <Badge className="bg-amber-500 text-white text-[10px] animate-pulse border-none">
            PROMO ACTIVE
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Calendar className="h-3 w-3" />
            Academic Status
          </div>
          {isHoliday ? (
            <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/20 px-1 py-0 uppercase">Holiday</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20 px-1 py-0 uppercase">Active</Badge>
          )}
        </div>
        
        <p className="text-sm font-bold">
          {isHoliday ? 'Semester Ended' : `${systemConfig?.currentSemester || 'Loading...'} Semester`}
        </p>
        
        {!isHoliday && (
          <p className="text-[11px] text-muted-foreground leading-tight">
            All semester courses and materials are currently accessible.
          </p>
        )}

        {!isOnline && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            <div className="h-1 w-1 rounded-full bg-orange-500 animate-pulse" />
            Displaying cached academic status
          </div>
        )}
      </div>

      {promoConfig?.isActive && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 animate-pulse">
            <Gift className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold leading-none mb-1 uppercase tracking-tight">FREE PROMO ACTIVE</p>
            <p className="text-[10px] opacity-80 leading-tight">Free activation tokens available now!</p>
          </div>
        </div>
      )}
    </div>
  );
};
