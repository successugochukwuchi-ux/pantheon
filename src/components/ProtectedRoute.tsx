import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  requireActivation?: boolean; 
  minLevel?: string;
  requireOnboarding?: boolean;
}> = ({ 
  children, 
  requireActivation = true,
  minLevel = '1',
  requireOnboarding = true
}) => {
  const { user, profile, loading, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="relative flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-lg tracking-tight">CoLearn</h3>
            <p className="text-xs text-muted-foreground animate-pulse">Authenticating user...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.isBanned) {
    return <Navigate to="/banned" replace />;
  }

  if (requireOnboarding && profile && profile.isOnboarded === false) {
    return <Navigate to="/onboarding" replace />;
  }

  if (requireActivation && !profile?.isActivated) {
    // Admins of level 2 and above do not need an activation pin
    // Bootstrap admin also bypasses this
    const userLevelNum = parseInt(profile?.level || '1', 10);
    const isBootstrapAdmin = user?.email === 'successugochukwuchi@gmail.com';
    
    if (userLevelNum < 2 && !isBootstrapAdmin) {
      return <Navigate to="/activate" replace />;
    }
  }

  // Simple level check (can be improved)
  if (minLevel !== '1') {
    const userLevelNum = parseInt(profile?.level || '1', 10);
    const minLevelNum = parseInt(minLevel, 10);
    const isBootstrapAdmin = user?.email === 'successugochukwuchi@gmail.com';
    
    if (userLevelNum < minLevelNum && !isBootstrapAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
