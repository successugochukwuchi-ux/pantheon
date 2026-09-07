import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useScreenSecurity } from '../lib/useScreenSecurity';

export function ScreenSecurityHandler() {
  const { profile } = useAuth();
  useScreenSecurity(profile);
  return null;
}
