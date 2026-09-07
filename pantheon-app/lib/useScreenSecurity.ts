import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

interface ProfileLike {
  level?: string | number | null;
  permissionLevel?: string | number | null;
  email?: string | null;
  [key: string]: any;
}

/**
 * Checks if the user is authorized to screenshot and screen record.
 * Allowed: Level 4 or Level 5 accounts, or primary master administrator.
 * Blocked: Level 1, 2, 3, guests, and unauthenticated users.
 */
export function isCaptureAllowed(profile: ProfileLike | null | undefined): boolean {
  if (!profile) return false;

  const lvl = String(profile.level ?? '').trim();
  const perm = String(profile.permissionLevel ?? '').trim();
  const email = (profile.email || '').toLowerCase().trim();

  // Super admin / master accounts always allowed
  if (email === 'successugochukwuchi@gmail.com') return true;

  // Explicit Level 4 or Level 5 accounts
  if (lvl === '4' || lvl === '5' || perm === '4' || perm === '5') {
    return true;
  }

  const numericLvl = Number(lvl);
  if (!isNaN(numericLvl) && (numericLvl === 4 || numericLvl === 5)) {
    return true;
  }

  return false;
}

/**
 * Hook to enforce dynamic screenshot and screen recording policy across iOS and Android.
 * Automatically disallows capture on Level 1-3/guests and allows on Level 4-5.
 */
export function useScreenSecurity(profile: ProfileLike | null | undefined) {
  useEffect(() => {
    let isMounted = true;
    let screenshotSubscription: { remove: () => void } | null = null;

    const applySecurity = async () => {
      try {
        const allowed = isCaptureAllowed(profile);

        if (allowed) {
          // Allow capture for Level 4 / 5 accounts
          await ScreenCapture.allowScreenCaptureAsync().catch(() => {});
          console.log('[ScreenSecurity] Capture ALLOWED for authorized account (Level 4/5).');
        } else {
          // Prevent screenshots and video recording for Level 1, 2, 3 and guests
          await ScreenCapture.preventScreenCaptureAsync().catch(() => {});
          console.log('[ScreenSecurity] Capture PREVENTED for standard/guest account.');
        }

        // On iOS & Android, optionally listen for screenshot events
        if (!allowed && ScreenCapture.addScreenshotListener) {
          screenshotSubscription = ScreenCapture.addScreenshotListener(() => {
            if (isMounted) {
              console.warn('[ScreenSecurity] Unauthorized screenshot attempted.');
            }
          });
        }
      } catch (err) {
        console.warn('[ScreenSecurity] Failed to update screen capture status:', err);
      }
    };

    applySecurity();

    return () => {
      isMounted = false;
      if (screenshotSubscription && typeof screenshotSubscription.remove === 'function') {
        screenshotSubscription.remove();
      }
    };
  }, [profile?.level, profile?.permissionLevel, profile?.email]);
}
