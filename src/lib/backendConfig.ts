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
  const href = window.location.href || '';

  // 1. Explicit Wasmer domain detection
  if (
    hostname.includes('wasmer') ||
    href.includes('wasmer') ||
    hostname.endsWith('.wasmer.app') ||
    hostname.endsWith('.wasmer.net') ||
    hostname.includes('github.io') ||
    hostname.includes('surge.sh') ||
    hostname.includes('pages.dev') ||
    hostname.includes('netlify.app') ||
    hostname.includes('vercel.app')
  ) {
    return true;
  }

  // 2. Any non-localhost / non-render deployment is running static-server
  // (since full-stack Express server runs only on local dev and Render)
  if (
    hostname !== 'localhost' &&
    hostname !== '127.0.0.1' &&
    !hostname.includes('onrender.com') &&
    !hostname.includes('render.com')
  ) {
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

export interface EndpointProbeResult {
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  contentType: string;
  durationMs: number;
  isHtmlSpa: boolean;
  error?: string;
}

export async function probeEndpoint(url: string, timeoutMs = 8000): Promise<EndpointProbeResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json, text/plain, */*' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    const isHtmlSpa = contentType.includes('text/html');

    return {
      url,
      ok: res.ok && !isHtmlSpa,
      status: res.status,
      statusText: res.statusText,
      contentType,
      durationMs: Date.now() - start,
      isHtmlSpa,
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return {
      url,
      ok: false,
      status: 0,
      statusText: isTimeout ? 'Timed Out' : 'Fetch Failed',
      contentType: '',
      durationMs: Date.now() - start,
      isHtmlSpa: false,
      error: isTimeout ? `Request timed out after ${timeoutMs}ms (server sleeping or unreachable)` : (err?.message || String(err)),
    };
  }
}
