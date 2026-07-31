import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const VOICE_STORE_KEY = 'colearn_default_voice';
const BACKEND_URL = 'https://ais-dev-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app';

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

let activeSound: Audio.Sound | null = null;

export async function getDefaultVoice(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(VOICE_STORE_KEY);
    if (saved) return saved;
  } catch (e) {
    console.log('Error reading default voice from SecureStore:', e);
  }
  return 'en-US-AriaNeural';
}

export async function setDefaultVoice(voiceId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(VOICE_STORE_KEY, voiceId);
  } catch (e) {
    console.error('Error saving default voice to SecureStore:', e);
  }
}

export async function stopSpeech(): Promise<void> {
  try {
    if (activeSound) {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
      activeSound = null;
    }
  } catch (e) {}

  try {
    if (Speech && typeof Speech.stop === 'function') {
      await Speech.stop();
    }
  } catch (e) {}
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
  await stopSpeech();

  const voice = options?.voiceId || (await getDefaultVoice());
  let onlineSuccess = false;

  // Try Microsoft Natural TTS via backend server if online
  try {
    options?.onStart?.();

    const ttsUrl = `${BACKEND_URL}/api/tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}`;
    const tempFileUri = `${FileSystem.cacheDirectory}colearn_tts.mp3`;

    // Download the file locally
    const downloadResult = await FileSystem.downloadAsync(ttsUrl, tempFileUri);

    if (downloadResult.status === 200) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: downloadResult.uri },
        { shouldPlay: true }
      );

      activeSound = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            sound.unloadAsync().catch(() => {});
            activeSound = null;
            options?.onDone?.();
          }
        } else if (status.error) {
          sound.unloadAsync().catch(() => {});
          activeSound = null;
          options?.onError?.(status.error);
        }
      });

      onlineSuccess = true;
      return;
    } else {
      console.warn(`TTS Download failed with status code ${downloadResult.status}`);
    }
  } catch (err) {
    console.log('Microsoft TTS Online playback failed or offline, falling back to expo-speech:', err);
  }

  // Fallback to expo-speech if offline or server request failed
  if (!onlineSuccess) {
    try {
      Speech.speak(text, {
        language: 'en',
        rate: 0.9,
        onStart: () => options?.onStart?.(),
        onDone: () => options?.onDone?.(),
        onStopped: () => options?.onDone?.(),
        onError: (err) => {
          console.warn('Expo speech fallback error:', err);
          options?.onError?.(err);
        },
      });
    } catch (speechErr) {
      console.error('Expo Speech fallback failed:', speechErr);
      options?.onError?.(speechErr);
    }
  }
}
