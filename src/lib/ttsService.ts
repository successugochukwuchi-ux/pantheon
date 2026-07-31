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
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

export async function speakText(
  text: string,
  options?: {
    voiceId?: string;
    onStart?: () => void;
    onDone?: () => void;
    onError?: (err: any) => void;
  }
): Promise<void> {
  stopSpeech();

  const voice = options?.voiceId || (await getDefaultVoice());

  try {
    options?.onStart?.();

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });

    if (response.ok) {
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      activeAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        activeAudio = null;
        options?.onDone?.();
      };

      audio.onerror = (err) => {
        URL.revokeObjectURL(audioUrl);
        activeAudio = null;
        fallbackWebSpeech(text, options);
      };

      await audio.play();
      return;
    }
  } catch (err) {
    console.log('Online TTS failed, falling back to Web Speech Synthesis:', err);
  }

  fallbackWebSpeech(text, options);
}

function fallbackWebSpeech(
  text: string,
  options?: {
    onStart?: () => void;
    onDone?: () => void;
    onError?: (err: any) => void;
  }
) {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;

    const voices = synth.getVoices();
    const defaultVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) ||
                         voices.find(v => v.lang.startsWith('en')) ||
                         voices[0];
    if (defaultVoice) utterance.voice = defaultVoice;

    utterance.onstart = () => options?.onStart?.();
    utterance.onend = () => options?.onDone?.();
    utterance.onerror = (err) => options?.onError?.(err);

    synth.speak(utterance);
  } else {
    options?.onError?.(new Error('Speech synthesis not supported on this browser'));
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
