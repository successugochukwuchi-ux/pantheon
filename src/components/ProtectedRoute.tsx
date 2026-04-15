import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode; requireActivation?: boolean; minLevel?: string }> = ({ 
  children, 
  requireActivation = true,
  minLevel = '1'
}) => {
  const { user, profile, loading, isAuthReady } = useAuth();
  const location = useLocation();

  if (!isAuthReady || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.isBanned) {
    return <Navigate to="/banned" replace />;
  }

  if (requireActivation && !profile?.isActivated) {
    // Admins of level 2 and above do not need an activation pin
    // Bootstrap admin also bypasses this
    const levels = ['1', '1+', '2', '3', '4'];
    const userIdx = levels.indexOf(profile?.level || '1');
    const isBootstrapAdmin = user?.email === 'successugochukwuchi@gmail.com';
    
    if (userIdx < 2 && !isBootstrapAdmin) {
      return <Navigate to="/activate" replace />;
    }
  }

  // Simple level check (can be improved)
  if (minLevel !== '1') {
    const levels = ['1', '1+', '2', '3', '4'];
    const userIdx = levels.indexOf(profile?.level || '1');
    const minIdx = levels.indexOf(minLevel);
    const isBootstrapAdmin = user?.email === 'successugochukwuchi@gmail.com';
    
    if (userIdx < minIdx && !isBootstrapAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
