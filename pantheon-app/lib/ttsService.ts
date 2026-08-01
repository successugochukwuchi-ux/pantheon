import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const VOICE_STORE_KEY = 'colearn_default_voice';
const BACKEND_URL = 'https://ais-dev-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app';

const BACKEND_URLS = [
  'https://ais-dev-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app',
  'https://ais-pre-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app'
];

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

export async function pauseSpeech(): Promise<boolean> {
  try {
    if (activeSound) {
      const status = await activeSound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await activeSound.pauseAsync();
        return true;
      }
    }
  } catch (e) {
    console.warn('Error pausing speech on mobile:', e);
  }
  return false;
}

export async function resumeSpeech(): Promise<boolean> {
  try {
    if (activeSound) {
      const status = await activeSound.getStatusAsync();
      if (status.isLoaded && !status.isPlaying) {
        await activeSound.playAsync();
        return true;
      }
    }
  } catch (e) {
    console.warn('Error resuming speech on mobile:', e);
  }
  return false;
}

export interface SpeakOptions {
  voiceId?: string;
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
  await stopSpeech();

  const voice = options?.voiceId || (await getDefaultVoice());
  let onlineSuccess = false;
  let downloadResult: any = null;
  const tempFileUri = `${FileSystem.cacheDirectory}colearn_tts.mp3`;

  options?.onPreparing?.(0);

  // Try Microsoft Natural TTS via backend server
  for (const baseUrl of BACKEND_URLS) {
    try {
      console.log(`Attempting TTS generation via POST on ${baseUrl}...`);
      // Use POST first to avoid URL length issues for long notes
      const downloadResumable = FileSystem.createDownloadResumable(
        `${baseUrl}/api/tts`,
        tempFileUri,
        {
          httpMethod: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            voice,
          }),
        },
        (downloadProgress) => {
          if (downloadProgress.totalBytesExpectedToWrite > 0) {
            const progress = Math.min(
              99,
              Math.round(
                (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
              )
            );
            options?.onPreparing?.(progress);
          } else {
            // Estimate based on text length (~450 bytes per character)
            const estimated = Math.max(6000, text.length * 450);
            const progress = Math.min(
              99,
              Math.round((downloadProgress.totalBytesWritten / estimated) * 100)
            );
            options?.onPreparing?.(progress);
          }
        }
      );

      downloadResult = await downloadResumable.downloadAsync();
      if (downloadResult && downloadResult.status === 200) {
        onlineSuccess = true;
        break;
      }
    } catch (e) {
      console.warn(`TTS POST to ${baseUrl} failed:`, e);
    }

    // Try GET if POST failed or had an issue
    try {
      console.log(`Attempting TTS generation via GET on ${baseUrl}...`);
      const getTtsUrl = `${baseUrl}/api/tts?text=${encodeURIComponent(text.substring(0, 1500))}&voice=${encodeURIComponent(voice)}`;
      const downloadResumableGet = FileSystem.createDownloadResumable(
        getTtsUrl,
        tempFileUri,
        {},
        (downloadProgress) => {
          if (downloadProgress.totalBytesExpectedToWrite > 0) {
            const progress = Math.min(
              99,
              Math.round(
                (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
              )
            );
            options?.onPreparing?.(progress);
          }
        }
      );

      downloadResult = await downloadResumableGet.downloadAsync();
      if (downloadResult && downloadResult.status === 200) {
        onlineSuccess = true;
        break;
      }
    } catch (e) {
      console.warn(`TTS GET to ${baseUrl} failed:`, e);
    }
  }

  if (onlineSuccess && downloadResult) {
    try {
      options?.onPreparing?.(100);

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
      options?.onStart?.();

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.durationMillis && status.durationMillis > 0) {
            const pct = Math.min(
              100,
              Math.round((status.positionMillis / status.durationMillis) * 100)
            );
            options?.onPlaybackProgress?.(pct);
          }
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

      return;
    } catch (playbackErr) {
      console.warn('Error during active sound initialization, falling back:', playbackErr);
    }
  }

  // Fallback to expo-speech if offline or server requests failed
  console.log('Falling back to expo-speech...');
  options?.onPreparing?.(100); // Trigger 100% to ensure UI doesn't get stuck preparing
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
