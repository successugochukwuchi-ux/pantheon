/**
 * Backend service endpoints configuration for Pantheon mobile app.
 * Provides fallback candidates for Hermes chat, voice transcription, and TTS endpoints.
 */

export function getBackendUrls(): string[] {
  const urls: string[] = [];

  // Production backend on Render
  urls.push('https://colearn-backend-tzo9.onrender.com');

  // Explicit env var if defined via app.json / EAS / .env
  if (typeof process !== 'undefined' && (process.env as any)?.EXPO_PUBLIC_BACKEND_URL) {
    urls.push((process.env as any).EXPO_PUBLIC_BACKEND_URL);
  }

  // Web/Browser fallback if running in Expo web preview
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http')) {
    const origin = window.location.origin;
    if (!origin.includes(':8081') && !origin.includes(':19000') && !origin.includes(':8082')) {
      urls.push(origin);
    }
  }

  // Remove trailing slashes and return unique non-empty URLs
  return Array.from(new Set(urls.filter(Boolean).map(u => u.replace(/\/+$/, ''))));
}

export function getDefaultBackendUrl(): string {
  const urls = getBackendUrls();
  return urls[0] || 'https://colearn-backend-tzo9.onrender.com';
}
