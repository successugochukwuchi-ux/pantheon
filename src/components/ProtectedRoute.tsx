import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export const ProtectedRoute: React.FC<{ 
  children: React.ReactNode; 
  requireActivation?: boolean; 
  minLevel?: string;
  requireOnboarding?: boolean;
  blockVendors?: boolean;
}> = ({ 
  children, 
  requireActivation = true,
  minLevel = '1',
  requireOnboarding = true,
  blockVendors = false
}) => {
  const { user, profile, loading, isAuthReady } = useAuth();
  const location = useLocation();

  const isLevel3Vendor = profile?.level === '3' || 
                         String(profile?.level) === '3' || 
                         profile?.academicLevel?.toLowerCase() === 'vendor' || 
                         profile?.department?.toLowerCase() === 'vendor';

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

  // Vendors do not need onboarding
  if (requireOnboarding && profile && profile.isOnboarded === false && !isLevel3Vendor) {
    return <Navigate to="/onboarding" replace />;
  }

  // Restrict Level 3 / Vendor accounts from all academic content and social features
  if (isLevel3Vendor) {
    const academicAndSocialPaths = [
      '/dashboard',
      '/activate',
      '/notes',
      '/past-questions',
      '/cbt',
      '/timetable',
      '/video-library',
      '/chat',
      '/friends',
      '/compete',
      '/discussions',
      '/flux',
      '/referrals'
    ];

    const currentPath = location.pathname.toLowerCase();
    const isRestrictedPath = blockVendors || academicAndSocialPaths.some(p => currentPath === p || currentPath.startsWith(`${p}/`));

    if (isRestrictedPath) {
      return <Navigate to="/administrator/pins" replace />;
    }
  }

  if (requireActivation && !profile?.isActivated) {
    // Level 2 and above, vendors, and bootstrap admin bypass activation pin requirement
    const userLevelNum = parseInt(profile?.level || '1', 10);
    const isBootstrapAdmin = user?.email === 'successugochukwuchi@gmail.com';
    
    if (userLevelNum < 2 && !isLevel3Vendor && !isBootstrapAdmin) {
      return <Navigate to="/activate" replace />;
    }
  }

  // Simple level check
  if (minLevel !== '1') {
    const userLevelNum = parseInt(profile?.level || '1', 10);
    const minLevelNum = parseInt(minLevel, 10);
    const isBootstrapAdmin = user?.email === 'successugochukwuchi@gmail.com';
    
    if (userLevelNum < minLevelNum && !isBootstrapAdmin) {
      return <Navigate to={isLevel3Vendor ? "/administrator/pins" : "/dashboard"} replace />;
    }
  }

  return <>{children}</>;
};

