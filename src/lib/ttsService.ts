export interface TTSVoice {
  id: string;
  name: string;
  lang: string;
  gender: string;
}

export const MICROSOFT_VOICES: TTSVoice[] = [
  { id: 'en-US-AriaNeural', name: 'Aria (US Female - Natural)', lang: 'en-US', gender: 'Female' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male - Natural)', lang: 'en-US', gender: 'Male' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female - Soft)', lang: 'en-US', gender: 'Female' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female - Natural)', lang: 'en-GB', gender: 'Female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male - Natural)', lang: 'en-GB', gender: 'Male' },
  { id: 'en-NG-EzinneNeural', name: 'Ezinne (Nigeria Female - Natural)', lang: 'en-NG', gender: 'Female' },
  { id: 'en-NG-AbeoNeural', name: 'Abeo (Nigeria Male - Natural)', lang: 'en-NG', gender: 'Male' },
];

const VOICE_STORE_KEY = 'colearn_default_voice';
let activeAudio: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;

export async function getDefaultVoice(): Promise<string> {
  if (typeof window === 'undefined') return 'en-US-AriaNeural';
  const idbVal = await getIndexedDBItem(VOICE_STORE_KEY);
  if (idbVal) return idbVal;
  return localStorage.getItem(VOICE_STORE_KEY) || 'en-US-AriaNeural';
}

export async function setDefaultVoice(voiceId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem(VOICE_STORE_KEY, voiceId);
  await setIndexedDBItem(VOICE_STORE_KEY, voiceId).catch(() => {});
}

export function stopSpeech(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export function pauseSpeech(): void {
  if (activeAudio && !activeAudio.paused) {
    activeAudio.pause();
  }
}

export function resumeSpeech(): void {
  if (activeAudio && activeAudio.paused) {
    activeAudio.play().catch((err) => console.error('Resume playback error:', err));
  }
}

export function isSpeechPaused(): boolean {
  return activeAudio ? activeAudio.paused : false;
}

export interface SpeakOptions {
  voiceId?: string;
  rate?: string;
  onPreparing?: (progressPercent: number) => void;
  onStart?: () => void;
  onPlaybackProgress?: (playbackPercent: number) => void;
  onDone?: () => void;
  onError?: (err: any) => void;
}

export async function speakText(
  text: string,
  options?: SpeakOptions
): Promise<void> {
  stopSpeech();

  const voice = options?.voiceId || (await getDefaultVoice());
  const abortController = new AbortController();
  currentAbortController = abortController;

  try {
    options?.onPreparing?.(0);

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate: options?.rate }),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server responded with status ${response.status}`);
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;
    const textLength = text.length;
    // Estimate total audio bytes (~450 bytes per character of text for 48kbps MP3)
    const estimatedTotalBytes = Math.max(6000, textLength * 450);

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          const prepPercent = Math.min(98, Math.round((receivedBytes / estimatedTotalBytes) * 100));
          options?.onPreparing?.(prepPercent);
        }
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      chunks.push(new Uint8Array(arrayBuffer));
    }

    if (abortController.signal.aborted) return;

    options?.onPreparing?.(100);

    const blob = new Blob(chunks, { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    activeAudio = audio;

    audio.onplay = () => {
      options?.onStart?.();
    };

    audio.ontimeupdate = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const pct = Math.min(100, Math.round((audio.currentTime / audio.duration) * 100));
        options?.onPlaybackProgress?.(pct);
      }
    };

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      activeAudio = null;
      options?.onDone?.();
    };

    audio.onerror = (err) => {
      console.error('HTMLAudioElement playback error:', err);
      URL.revokeObjectURL(audioUrl);
      activeAudio = null;
      options?.onError?.(err);
    };

    await audio.play();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return;
    }
    console.error('Online TTS failed:', err);
    options?.onError?.(err);
  } finally {
    if (currentAbortController === abortController) {
      currentAbortController = null;
    }
  }
}

async function getIndexedDBItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    const request = indexedDB.open('ColearnVoiceDB', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('voiceStore');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('voiceStore')) {
        resolve(null);
        return;
      }
      const transaction = db.transaction('voiceStore', 'readonly');
      const store = transaction.objectStore('voiceStore');
      const getRequest = store.get(key);
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    request.onerror = () => resolve(null);
  });
}

async function setIndexedDBItem(key: string, value: string): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ColearnVoiceDB', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('voiceStore');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const transaction = db.transaction('voiceStore', 'readwrite');
      const store = transaction.objectStore('voiceStore');
      const putRequest = store.put(value, key);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}
