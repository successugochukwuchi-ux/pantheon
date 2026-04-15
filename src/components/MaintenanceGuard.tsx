import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertTriangle } from 'lucide-react';

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { systemConfig, profile } = useAuth();

  // Only Level 4 admins can bypass maintenance mode
  const isLevel4 = profile?.level === '4';
  const isMaintenance = systemConfig?.maintenanceMode;

  if (isMaintenance && !isLevel4) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-destructive/20 blur-3xl rounded-full animate-pulse" />
            <div className="relative h-24 w-24 bg-destructive/10 rounded-3xl flex items-center justify-center mx-auto border border-destructive/20">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter">UNDER MAINTENANCE</h1>
            <p className="text-muted-foreground">
              Pantheon is currently undergoing scheduled maintenance to improve your experience.
            </p>
          </div>

          <div className="p-6 bg-muted rounded-2xl border space-y-4">
            <div className="flex items-center gap-3 text-left">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold">Security & Updates</p>
                <p className="text-xs text-muted-foreground">We are updating our core systems and security protocols.</p>
              </div>
            </div>
            <div className="pt-4 border-t text-xs text-muted-foreground">
              Please check back shortly. Thank you for your patience.
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            © 2026 PANTHEON TEAM
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
