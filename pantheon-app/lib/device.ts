import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

const STORE_KEY = 'colearn_user_device_map';

function generateSimpleUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getUserDeviceUUID(userId: string): Promise<string | null> {
  const map = await getDeviceMap();
  return map[userId] || null;
}

export async function getDeviceUUID(userId?: string): Promise<string> {
  if (userId) {
    const existing = await getUserDeviceUUID(userId);
    if (existing) return existing;
    return generateNewDeviceUUID(userId);
  }
  const map = await getDeviceMap();
  const keys = Object.keys(map);
  if (keys.length > 0) return map[keys[0]];
  return 'mobile_device_' + generateSimpleUUID().substring(0, 8);
}

export async function setUserDeviceUUID(userId: string, uuid: string): Promise<void> {
  const map = await getDeviceMap();
  map[userId] = uuid;
  await saveDeviceMap(map);
}

export async function generateNewDeviceUUID(userId: string): Promise<string> {
  let nativeId = '';
  try {
    if (Platform.OS === 'android') {
      nativeId = Application.getAndroidId() || '';
    } else if (Platform.OS === 'ios') {
      nativeId = await Application.getIosIdForVendorAsync() || '';
    }
  } catch (e) {
    console.error('Failed to get native device ID:', e);
  }

  const raw = `${nativeId}-${userId}-${Date.now()}-${generateSimpleUUID()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  const uuid = `dev-${hashHex}-${generateSimpleUUID().substring(0, 8)}`;

  await setUserDeviceUUID(userId, uuid);
  return uuid;
}

export function getMobileDeviceName(): string {
  try {
    if (Platform.OS === 'web') {
      return 'Web Browser';
    }
    const brand = Device.brand || '';
    const model = Device.modelName || Device.deviceName || '';
    
    if (brand && model) {
      if (model.toLowerCase().includes(brand.toLowerCase())) {
        return model;
      }
      return `${brand} ${model}`;
    }
    if (model) return model;
    if (brand) return `${brand} Device`;
    return Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Device';
  } catch (e) {
    return Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Device';
  }
}

async function getDeviceMap(): Promise<Record<string, string>> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading device map from SecureStore:', e);
  }
  return {};
}

async function saveDeviceMap(map: Record<string, string>): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Error saving device map to SecureStore:', e);
  }
}
