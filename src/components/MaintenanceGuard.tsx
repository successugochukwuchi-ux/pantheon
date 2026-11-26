import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, AlertTriangle } from 'lucide-react';

export const MaintenanceGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { systemConfig, profile } = useAuth();

  // Only Level 4 admins can bypass maintenance mode
  const isLevel4 = profile?.level === '4' || profile?.level === '5';
  const isMaintenance = systemConfig?.maintenanceMode;

  if (isMaintenance && !isLevel4) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto border border-destructive/20">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Scheduled Maintenance</h1>
            <p className="text-muted-foreground text-sm">
              CoLearn is currently down for scheduled maintenance.
            </p>
          </div>

          <div className="p-6 bg-muted rounded-2xl border space-y-4">
            <div className="flex items-center gap-3 text-left">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold">System Update</p>
                <p className="text-xs text-muted-foreground">Access will resume shortly. Thank you for your patience.</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            © 2026 Pillara Education
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
