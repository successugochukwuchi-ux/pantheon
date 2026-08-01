import { Communicate } from 'edge-tts-universal';
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
];

// In-memory TTS audio cache: Key -> Buffer
const ttsAudioCache = new Map<string, Buffer>();
const MAX_CACHE_SIZE = 120;

function getCacheKey(text: string, voice: string, rate: string): string {
  const hash = crypto.createHash('md5').update(text).digest('hex');
  return `${voice}_${rate}_${hash}`;
}

/**
 * Standardizes rate format to strictly match /^[+-]\d+%$/ expected by edge-tts-universal.
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

/**
 * Streams TTS audio chunks directly via callback while populating cache.
 */
export async function streamEdgeTTS(
  options: TTSOptions,
  onAudioChunk: (chunk: Buffer) => void
): Promise<Buffer> {
  const text = options.text?.trim();
  if (!text) {
    throw new Error('Empty text provided for TTS');
  }

  const voice = options.voice || 'en-US-AriaNeural';
  const rate = formatRate(options.rate);
  const cacheKey = getCacheKey(text, voice, rate);

  // Check in-memory cache
  if (ttsAudioCache.has(cacheKey)) {
    const cachedBuffer = ttsAudioCache.get(cacheKey)!;
    onAudioChunk(cachedBuffer);
    return cachedBuffer;
  }

  const communicate = new Communicate(text, {
    voice,
    rate,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of communicate.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(chunk.data);
      onAudioChunk(chunk.data);
    }
  }

  if (chunks.length === 0) {
    throw new Error('No audio data received from Microsoft Edge TTS');
  }

  const fullBuffer = Buffer.concat(chunks);

  // Evict oldest entry if cache limit reached
  if (ttsAudioCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ttsAudioCache.keys().next().value;
    if (firstKey) ttsAudioCache.delete(firstKey);
  }
  ttsAudioCache.set(cacheKey, fullBuffer);

  return fullBuffer;
}

/**
 * Robust Text-to-Speech function that uses edge-tts-universal with caching.
 */
export async function generateEdgeTTS(options: TTSOptions): Promise<Buffer> {
  const text = options.text?.trim();
  if (!text) {
    throw new Error('Empty text provided for TTS');
  }

  const voice = options.voice || 'en-US-AriaNeural';
  const rate = formatRate(options.rate);
  const cacheKey = getCacheKey(text, voice, rate);

  if (ttsAudioCache.has(cacheKey)) {
    return ttsAudioCache.get(cacheKey)!;
  }

  return await streamEdgeTTS(options, () => {});
}
