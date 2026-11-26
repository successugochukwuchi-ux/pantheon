const RELOAD_STORAGE_KEY = 'colearn_chunk_reload_at';
const RELOAD_COOLDOWN_MS = 20_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name} ${error.message}`
        : String((error as any)?.message || error);

  const lower = message.toLowerCase();

  return (
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module') ||
    lower.includes('failed to load module script') ||
    lower.includes('unable to preload css') ||
    lower.includes('loading chunk') ||
    lower.includes('loading css chunk') ||
    lower.includes('chunkloaderror')
  );
}

export function canAttemptChunkReload(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  try {
    const raw = sessionStorage.getItem(RELOAD_STORAGE_KEY);
    if (!raw) return true;
    const lastAttempt = Number(raw);
    if (!Number.isFinite(lastAttempt)) return true;
    return Date.now() - lastAttempt > RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

export function clearChunkReloadHistory(): void {
  try {
    sessionStorage.removeItem(RELOAD_STORAGE_KEY);
  } catch {}
}

export function triggerChunkRecoveryReload(bustCache = false): void {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.setItem(RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {}

  const performReload = () => {
    if (bustCache) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('_cb', String(Date.now()));
        window.location.replace(url.toString());
        return;
      } catch {}
    }
    window.location.reload();
  };

  if (bustCache && 'caches' in window && typeof window.caches?.keys === 'function') {
    window.caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => window.caches.delete(key))))
      .then(performReload, performReload);
    return;
  }

  performReload();
}
