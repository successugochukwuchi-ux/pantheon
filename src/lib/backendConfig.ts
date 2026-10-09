/**
 * Backend service endpoints configuration for CoLearn Web Portal.
 * Provides resilient candidate URLs for Hermes AI chat, LaTeX healing, TTS, and video proxy.
 * On static hosts (e.g. Wasmer static-server, GitHub Pages, static SPA hosts),
 * requests automatically route to or fall back to the live Render backend.
 */

export const RENDER_BACKEND_URL = 'https://colearn-backend-tzo9.onrender.com';

export function isStaticHost(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname || '';
  // Detect Wasmer hosting or other known static-only deployments
  if (hostname.includes('wasmer') || hostname.includes('github.io') || hostname.includes('surge.sh')) {
    return true;
  }
  return false;
}

export function getBackendCandidates(apiPath: string): string[] {
  const cleanPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const candidates: string[] = [];

  const localUrl = (typeof window !== 'undefined' && window.location?.origin && window.location.origin.startsWith('http'))
    ? `${window.location.origin}${cleanPath}`
    : cleanPath;

  if (isStaticHost()) {
    // On static deployments like Wasmer (which use wasmer/static-server),
    // relative /api/* will return 405 or index.html due to --spa routing.
    // Prioritize the live Render backend first to avoid failed calls.
    candidates.push(`${RENDER_BACKEND_URL}${cleanPath}`);
    candidates.push(localUrl);
  } else {
    // In local development or full-stack environments (Render, local Express),
    // use the local endpoint first, with Render backend as fallback.
    candidates.push(localUrl);
    candidates.push(`${RENDER_BACKEND_URL}${cleanPath}`);
  }

  return Array.from(new Set(candidates));
}
