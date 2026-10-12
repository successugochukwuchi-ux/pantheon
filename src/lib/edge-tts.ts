import { Communicate } from 'edge-tts-universal';
import WebSocket from 'isomorphic-ws';
import crypto from 'crypto';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: string;
}

export const MICROSOFT_VOICES = [
  { id: 'en-US-AriaNeural', name: 'Aria (US Female - Natural)', lang: 'en-US', gender: 'Female' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male - Natural)', lang: 'en-US', gender: 'Male' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female - Soft)', lang: 'en-US', gender: 'Female' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female - Natural)', lang: 'en-GB', gender: 'Female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male - Natural)', lang: 'en-GB', gender: 'Male' },
  { id: 'en-NG-EzinneNeural', name: 'Ezinne (Nigeria Female - Natural)', lang: 'en-NG', gender: 'Female' },
  { id: 'en-NG-AbeoNeural', name: 'Abeo (Nigeria Male - Natural)', lang: 'en-NG', gender: 'Male' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (US Male - News/Academic)', lang: 'en-US', gender: 'Male' },
  { id: 'en-US-MichelleNeural', name: 'Michelle (US Female - Conversational)', lang: 'en-US', gender: 'Female' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha (Australia Female - Natural)', lang: 'en-AU', gender: 'Female' },
  { id: 'en-IN-NeerjaNeural', name: 'Neerja (India Female - Natural)', lang: 'en-IN', gender: 'Female' },
  { id: 'en-KE-AsiliaNeural', name: 'Asilia (Kenya Female - Natural)', lang: 'en-KE', gender: 'Female' },
  { id: 'en-ZA-LeahNeural', name: 'Leah (South Africa Female - Natural)', lang: 'en-ZA', gender: 'Female' },
];

// In-memory TTS audio cache: Key -> Buffer
const ttsAudioCache = new Map<string, Buffer>();
const inFlightRequests = new Map<string, Promise<Buffer>>();
const MAX_CACHE_SIZE = 1000;
const MAX_SINGLE_WS_CHARS = 360;
const PARALLEL_SUBCHUNK_CONCURRENCY = 4;

// Edge ReadAloud WebSocket constants
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_BASE_URL = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
const CHROMIUM_FULL_VERSION = '143.0.3650.75';
const CHROMIUM_MAJOR_VERSION = '143';
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
const WIN_EPOCH = 11644473600;

function getCacheKey(text: string, voice: string, rate: string): string {
  const hash = crypto.createHash('md5').update(text).digest('hex');
  return `${voice}_${rate}_${hash}`;
}

function storeInCache(key: string, buffer: Buffer): void {
  if (ttsAudioCache.has(key)) {
    ttsAudioCache.delete(key);
  } else if (ttsAudioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ttsAudioCache.keys().next().value;
    if (firstKey) ttsAudioCache.delete(firstKey);
  }
  ttsAudioCache.set(key, buffer);
}

/**
 * Standardizes rate format to strictly match /^[+-]\d+%$/ expected by Edge TTS.
 */
function formatRate(rate?: string): string {
  if (!rate) return '+0%';
  const trimmed = rate.trim();
  if (trimmed === 'default' || trimmed === '0%' || trimmed === '0') {
    return '+0%';
  }
  if (/^[+-]\d+%$/.test(trimmed)) {
    return trimmed;
  }
  if (/^[+-]\d+$/.test(trimmed)) {
    return trimmed + '%';
  }
  if (/^\d+%$/.test(trimmed)) {
    return '+' + trimmed;
  }
  if (/^\d+$/.test(trimmed)) {
    return '+' + trimmed + '%';
  }
  return '+0%';
}

function sanitizeTextForTTS(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXmlForSSML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Clock skew adjustment (in seconds) synced from Bing server Date header on 403
let clockSkewSeconds = 0;

function updateClockSkewFromDateHeader(dateHeader: string | string[] | undefined): void {
  const raw = Array.isArray(dateHeader) ? dateHeader[0] : dateHeader;
  if (!raw || typeof raw !== 'string') return;
  const serverMs = Date.parse(raw);
  if (!Number.isNaN(serverMs) && Number.isFinite(serverMs)) {
    clockSkewSeconds = serverMs / 1000 - Date.now() / 1000;
  }
}

function generateSecMsGec(): string {
  let ticks = Math.floor(Date.now() / 1000 + clockSkewSeconds) + WIN_EPOCH;
  ticks -= ticks % 300;
  ticks *= 1e9 / 100;
  const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(strToHash, 'ascii').digest('hex').toUpperCase();
}

function generateHexId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex');
}

function formatEdgeVoiceName(shortVoice: string): string {
  const match = /^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(shortVoice.trim());
  if (match) {
    const [, lang, regionPart, namePart] = match;
    let region = regionPart;
    let name = namePart;
    if (name.includes('-')) {
      const parts = name.split('-');
      region += `-${parts[0]}`;
      name = parts[1];
    }
    return `Microsoft Server Speech Text to Speech Voice (${lang}-${region}, ${name})`;
  }
  return shortVoice;
}

/**
 * Splits long text into small sentence/clause sub-chunks (<= maxLen chars)
 * so each WebSocket turn completes in ~0.8-1.5s without stalling.
 */
function splitIntoFastSubChunks(text: string, maxLen = MAX_SINGLE_WS_CHARS): string[] {
  if (text.length <= maxLen) return [text];

  const sentences = text
    .replace(/([.?!;]+)\s+/g, '$1\n')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const pushOrSplitSentence = (sentence: string) => {
    if (sentence.length <= maxLen) {
      if (!current) {
        current = sentence;
      } else if (current.length + 1 + sentence.length <= maxLen) {
        current = `${current} ${sentence}`;
      } else {
        chunks.push(current);
        current = sentence;
      }
      return;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    // Split long sentence by clause punctuation (, : —) or words
    const clauses = sentence
      .replace(/([,:—–-]+)\s+/g, '$1\n')
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);

    let clauseBuf = '';
    for (const clause of clauses) {
      if (!clauseBuf) {
        if (clause.length <= maxLen) {
          clauseBuf = clause;
        } else {
          const words = clause.split(/\s+/);
          let wordBuf = '';
          for (const w of words) {
            if (!wordBuf) {
              wordBuf = w;
            } else if (wordBuf.length + 1 + w.length <= maxLen) {
              wordBuf = `${wordBuf} ${w}`;
            } else {
              chunks.push(wordBuf);
              wordBuf = w;
            }
          }
          if (wordBuf) clauseBuf = wordBuf;
        }
      } else if (clauseBuf.length + 1 + clause.length <= maxLen) {
        clauseBuf = `${clauseBuf} ${clause}`;
      } else {
        chunks.push(clauseBuf);
        if (clause.length <= maxLen) {
          clauseBuf = clause;
        } else {
          const words = clause.split(/\s+/);
          let wordBuf = '';
          for (const w of words) {
            if (!wordBuf) {
              wordBuf = w;
            } else if (wordBuf.length + 1 + w.length <= maxLen) {
              wordBuf = `${wordBuf} ${w}`;
            } else {
              chunks.push(wordBuf);
              wordBuf = w;
            }
          }
          clauseBuf = wordBuf;
        }
      }
    }
    if (clauseBuf) {
      chunks.push(clauseBuf);
    }
  };

  for (const s of sentences) {
    pushOrSplitSentence(s);
  }
  if (current) {
    chunks.push(current);
  }

  return chunks.length > 0 ? chunks : [text];
}

// ============================================================================
// Persistent Reusable EdgeTTS WebSocket Connection Pool & Turn Semaphore
// ============================================================================

interface PooledEdgeSocket {
  ws: any;
  createdAt: number;
  lastUsedAt: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const MAX_POOL_SIZE = 4;
const MAX_CONCURRENT_TURNS = 4;
const IDLE_SOCKET_TTL_MS = 25000;
const SOCKET_MAX_LIFETIME_MS = 180000;
const MIN_HANDSHAKE_INTERVAL_MS = 85;

const idleSockets: PooledEdgeSocket[] = [];
let activeTurns = 0;
const turnWaitQueue: Array<() => void> = [];
let lastHandshakeTime = 0;
let handshakeChain: Promise<void> = Promise.resolve();

async function acquireTurnSlot(): Promise<void> {
  if (activeTurns < MAX_CONCURRENT_TURNS) {
    activeTurns++;
    return;
  }
  await new Promise<void>((resolve) => {
    turnWaitQueue.push(resolve);
  });
}

function releaseTurnSlot(): void {
  const next = turnWaitQueue.shift();
  if (next) {
    next();
  } else {
    activeTurns = Math.max(0, activeTurns - 1);
  }
}

function destroySocket(ws: any): void {
  if (!ws) return;
  try {
    ws.removeAllListeners?.();
    ws.on?.('error', () => {});
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.terminate ? ws.terminate() : ws.close();
    }
  } catch {}
}

function releaseSocketToPool(ws: any, createdAt: number): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    destroySocket(ws);
    return;
  }
  const now = Date.now();
  if (now - createdAt > SOCKET_MAX_LIFETIME_MS || idleSockets.length >= MAX_POOL_SIZE) {
    destroySocket(ws);
    return;
  }

  ws.removeAllListeners?.();

  const entry: PooledEdgeSocket = {
    ws,
    createdAt,
    lastUsedAt: now,
    idleTimer: null,
  };

  const removeFromPool = () => {
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
    const idx = idleSockets.indexOf(entry);
    if (idx !== -1) {
      idleSockets.splice(idx, 1);
    }
    destroySocket(entry.ws);
  };

  entry.idleTimer = setTimeout(removeFromPool, IDLE_SOCKET_TTL_MS);
  ws.on('close', removeFromPool);
  ws.on('error', removeFromPool);

  idleSockets.push(entry);
}

/**
 * Paces new WebSocket handshakes so concurrent workers don't collide on Azure Front Door
 */
async function paceHandshake(): Promise<void> {
  const prev = handshakeChain;
  let release!: () => void;
  handshakeChain = new Promise<void>((r) => {
    release = r;
  });
  await prev;
  try {
    const now = Date.now();
    const elapsed = now - lastHandshakeTime;
    if (elapsed < MIN_HANDSHAKE_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_HANDSHAKE_INTERVAL_MS - elapsed));
    }
    lastHandshakeTime = Date.now();
  } finally {
    release();
  }
}

/**
 * Opens a single new EdgeTTS WebSocket connection and sends initial speech.config.
 */
function openSingleEdgeSocket(handshakeTimeoutMs = 4000): Promise<{ ws: any; createdAt: number }> {
  return new Promise((resolve, reject) => {
    const connId = generateHexId(16);
    const muid = generateHexId(16).toUpperCase();
    const secMsGec = generateSecMsGec();
    const wsUrl = `${WSS_BASE_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connId}`;

    let settled = false;
    let ws: any = null;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      destroySocket(ws);
      reject(new Error(`Edge TTS handshake timeout (${handshakeTimeoutMs}ms)`));
    }, handshakeTimeoutMs);

    try {
      ws = new WebSocket(wsUrl, {
        headers: {
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Accept-Language': 'en-US,en;q=0.9',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
          'Sec-CH-UA': `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
          'Sec-CH-UA-Mobile': '?0',
          'Sec-CH-UA-Platform': '"Windows"',
          'Cookie': `muid=${muid};`,
        },
        handshakeTimeout: handshakeTimeoutMs,
      } as any);
    } catch (err: any) {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    ws.on('unexpected-response', (_req: any, res: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const statusCode = res?.statusCode || 403;
      updateClockSkewFromDateHeader(res?.headers?.date);
      try {
        res?.resume?.();
      } catch {}
      destroySocket(ws);
      reject(new Error(`HTTP_${statusCode}`));
    });

    ws.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const timestamp = new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
        const configMsg =
          `X-Timestamp:${timestamp}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
        ws.send(configMsg);
        resolve({ ws, createdAt: Date.now() });
      } catch (sendErr: any) {
        destroySocket(ws);
        reject(sendErr instanceof Error ? sendErr : new Error(String(sendErr)));
      }
    });

    ws.on('error', (err: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      destroySocket(ws);
      reject(err instanceof Error ? err : new Error(err?.message || 'WebSocket error'));
    });

    ws.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      destroySocket(ws);
      reject(new Error('WebSocket closed during handshake'));
    });
  });
}

/**
 * Acquires a healthy open WebSocket from the pool or establishes a new one,
 * automatically retrying transient Azure Front Door 403 responses.
 */
async function acquirePooledEdgeSocket(maxHandshakeAttempts = 10): Promise<{ ws: any; createdAt: number }> {
  while (idleSockets.length > 0) {
    const entry = idleSockets.pop()!;
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer);
      entry.idleTimer = null;
    }
    entry.ws.removeAllListeners?.();
    if (
      entry.ws.readyState === WebSocket.OPEN &&
      Date.now() - entry.createdAt < SOCKET_MAX_LIFETIME_MS
    ) {
      return { ws: entry.ws, createdAt: entry.createdAt };
    }
    destroySocket(entry.ws);
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < maxHandshakeAttempts; attempt++) {
    await paceHandshake();
    try {
      return await openSingleEdgeSocket(4000);
    } catch (err: any) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      const backoffMs = 60 + Math.floor(Math.random() * 60) + attempt * 25;
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  throw lastErr || new Error('Unable to establish EdgeTTS WebSocket connection');
}

/**
 * Synthesizes a single turn over a pooled persistent WebSocket connection.
 * Returns the open socket back to the pool upon turn.end so subsequent chunks
 * require 0 new handshakes and never trigger 403 rate limits.
 */
async function synthesizeTurnOnPooledSocket(
  text: string,
  voice: string,
  rate: string,
  timeoutMs = 8500
): Promise<Buffer> {
  await acquireTurnSlot();
  let socketInfo: { ws: any; createdAt: number } | null = null;

  try {
    socketInfo = await acquirePooledEdgeSocket(10);
    const { ws, createdAt } = socketInfo;

    return await new Promise<Buffer>((resolve, reject) => {
      const reqId = generateHexId(16);
      const audioChunks: Buffer[] = [];
      let settled = false;
      let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
      let hardTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimers = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (hardTimer) clearTimeout(hardTimer);
        inactivityTimer = null;
        hardTimer = null;
      };

      const finishSuccess = (canReuseSocket: boolean) => {
        if (settled) return;
        settled = true;
        clearTimers();
        ws.removeAllListeners?.();
        if (canReuseSocket && ws.readyState === WebSocket.OPEN) {
          releaseSocketToPool(ws, createdAt);
        } else {
          destroySocket(ws);
        }
        const full = Buffer.concat(audioChunks);
        if (full.length === 0) {
          reject(new Error('No audio bytes received from Edge TTS WebSocket'));
        } else {
          resolve(full);
        }
      };

      const finishError = (err: Error) => {
        if (settled) return;
        if (audioChunks.length > 0) {
          const partial = Buffer.concat(audioChunks);
          if (partial.length > 256) {
            settled = true;
            clearTimers();
            destroySocket(ws);
            resolve(partial);
            return;
          }
        }
        settled = true;
        clearTimers();
        destroySocket(ws);
        reject(err);
      };

      const resetInactivityTimer = (ms: number) => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(() => {
          if (audioChunks.length > 0) {
            finishSuccess(false);
          } else {
            finishError(new Error(`Edge TTS turn inactivity timeout (${ms}ms)`));
          }
        }, ms);
      };

      hardTimer = setTimeout(() => {
        finishError(new Error(`Edge TTS turn hard timeout (${timeoutMs}ms)`));
      }, timeoutMs);

      resetInactivityTimer(5000);

      ws.on('message', (data: Buffer | ArrayBuffer | Buffer[], isBinary: boolean) => {
        if (settled) return;

        const buf = Buffer.isBuffer(data)
          ? data
          : Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.from(data);

        if (!isBinary) {
          const textMsg = buf.toString('utf-8');
          if (textMsg.includes('Path:turn.end')) {
            finishSuccess(true);
          }
          return;
        }

        if (buf.length < 2) return;
        const headerLen = buf.readUInt16BE(0);
        if (headerLen + 2 <= buf.length) {
          const headerStr = buf.subarray(2, headerLen + 2).toString('utf-8');
          if (headerStr.includes('Path:audio')) {
            const audioData = buf.subarray(headerLen + 2);
            if (audioData.length > 0) {
              audioChunks.push(audioData);
              resetInactivityTimer(1500);
            }
          }
        }
      });

      ws.on('error', (err: any) => {
        finishError(err instanceof Error ? err : new Error(err?.message || 'WebSocket error'));
      });

      ws.on('close', () => {
        if (audioChunks.length > 0) {
          finishSuccess(false);
        } else {
          finishError(new Error('Edge TTS WebSocket closed before audio was received'));
        }
      });

      try {
        const timestamp = new Date().toUTCString().replace('GMT', 'GMT+0000 (Coordinated Universal Time)');
        const fullVoice = formatEdgeVoiceName(voice);
        const escapedText = escapeXmlForSSML(text);
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${fullVoice}'><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapedText}</prosody></voice></speak>`;
        const ssmlMsg =
          `X-RequestId:${reqId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${timestamp}Z\r\n` +
          `Path:ssml\r\n\r\n` +
          `${ssml}`;

        ws.send(ssmlMsg);
      } catch (sendErr: any) {
        finishError(sendErr instanceof Error ? sendErr : new Error(String(sendErr)));
      }
    });
  } finally {
    releaseTurnSlot();
  }
}

/**
 * Fallback to edge-tts-universal wrapped with a strict timeout race
 */
async function synthesizeViaCommunicateFallback(
  text: string,
  voice: string,
  rate: string,
  timeoutMs = 7000
): Promise<Buffer> {
  return await Promise.race([
    (async () => {
      const communicate = new Communicate(text, { voice, rate });
      const chunks: Buffer[] = [];
      for await (const chunk of communicate.stream()) {
        if (chunk.type === 'audio' && chunk.data) {
          chunks.push(chunk.data);
        }
      }
      if (chunks.length === 0) {
        throw new Error('No audio data from Communicate fallback');
      }
      return Buffer.concat(chunks);
    })(),
    new Promise<Buffer>((_, reject) =>
      setTimeout(() => reject(new Error(`Communicate fallback timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Synthesizes a single small sub-chunk (<= 360 chars) with caching,
 * in-flight deduplication, persistent socket reuse, and multi-attempt retry.
 */
async function synthesizeSmallChunkWithRetry(
  subText: string,
  voice: string,
  rate: string
): Promise<Buffer> {
  const cleanSub = sanitizeTextForTTS(subText);
  if (!cleanSub) {
    throw new Error('Empty sub-chunk text');
  }

  const cacheKey = getCacheKey(cleanSub, voice, rate);
  const cached = ttsAudioCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    return await inFlight;
  }

  const promise = (async (): Promise<Buffer> => {
    let lastError: any = null;

    // 4 attempts using the persistent WebSocket connection pool
    for (let attempt = 0; attempt < 4; attempt++) {
      const targetVoice = attempt === 3 && voice !== 'en-US-AriaNeural' ? 'en-US-AriaNeural' : voice;
      const timeoutMs = attempt === 0 ? 7500 : 8500;
      try {
        const buf = await synthesizeTurnOnPooledSocket(cleanSub, targetVoice, rate, timeoutMs);
        if (buf && buf.length > 64) {
          storeInCache(cacheKey, buf);
          return buf;
        }
      } catch (err: any) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 120 * (attempt + 1)));
      }
    }

    // Final fallback via Communicate with strict timeout
    try {
      const buf = await synthesizeViaCommunicateFallback(cleanSub, voice, rate, 7000);
      if (buf && buf.length > 64) {
        storeInCache(cacheKey, buf);
        return buf;
      }
    } catch (fallbackErr: any) {
      lastError = fallbackErr;
    }

    throw lastError || new Error('Failed to synthesize TTS audio chunk');
  })();

  inFlightRequests.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    if (inFlightRequests.get(cacheKey) === promise) {
      inFlightRequests.delete(cacheKey);
    }
  }
}

/**
 * Streams or synthesizes TTS audio chunks with automatic parallel sub-chunking
 * for long inputs and full LRU caching.
 */
export async function streamEdgeTTS(
  options: TTSOptions,
  onAudioChunk: (chunk: Buffer) => void
): Promise<Buffer> {
  const rawText = options.text || '';
  const text = sanitizeTextForTTS(rawText);
  if (!text) {
    throw new Error('Empty text provided for TTS');
  }

  const voice = options.voice || 'en-US-AriaNeural';
  const rate = formatRate(options.rate);
  const fullCacheKey = getCacheKey(text, voice, rate);

  // Check full-text cache first
  const cachedFull = ttsAudioCache.get(fullCacheKey);
  if (cachedFull) {
    onAudioChunk(cachedFull);
    return cachedFull;
  }

  const subChunks = splitIntoFastSubChunks(text, MAX_SINGLE_WS_CHARS);

  // Fast path: single small sub-chunk
  if (subChunks.length === 1) {
    const buf = await synthesizeSmallChunkWithRetry(subChunks[0], voice, rate);
    onAudioChunk(buf);
    return buf;
  }

  // Parallel synthesis path for multi-chunk inputs while preserving strict sequential order
  const orderedResults: Buffer[] = new Array(subChunks.length);
  let nextIdx = 0;
  const workerCount = Math.min(PARALLEL_SUBCHUNK_CONCURRENCY, subChunks.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = nextIdx++;
      if (idx >= subChunks.length) break;
      orderedResults[idx] = await synthesizeSmallChunkWithRetry(subChunks[idx], voice, rate);
    }
  });

  await Promise.all(workers);

  for (const buf of orderedResults) {
    onAudioChunk(buf);
  }

  const combinedBuffer = Buffer.concat(orderedResults);
  storeInCache(fullCacheKey, combinedBuffer);
  return combinedBuffer;
}

/**
 * Robust Text-to-Speech function that uses fast parallel Edge TTS synthesis with caching.
 */
export async function generateEdgeTTS(options: TTSOptions): Promise<Buffer> {
  return await streamEdgeTTS(options, () => {});
}

