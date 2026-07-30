import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';

function generateSimpleUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function getDeviceUUID(): Promise<string> {
  if (Platform.OS === 'web') {
    return await getWebDeviceUUID();
  } else {
    return await getMobileDeviceUUID();
  }
}

async function getMobileDeviceUUID(): Promise<string> {
  const STORE_KEY = 'colearn_device_uuid';
  try {
    let uuid = await SecureStore.getItemAsync(STORE_KEY);
    if (!uuid) {
      let nativeId = '';
      if (Platform.OS === 'android') {
        nativeId = Application.getAndroidId() || '';
      } else if (Platform.OS === 'ios') {
        nativeId = await Application.getIosIdForVendorAsync() || '';
      }
      
      uuid = nativeId ? `${nativeId}-${generateSimpleUUID()}` : generateSimpleUUID();
      await SecureStore.setItemAsync(STORE_KEY, uuid);
    }
    return uuid;
  } catch (e) {
    console.error('Failed to get mobile device UUID:', e);
    return 'fallback-' + generateSimpleUUID();
  }
}

async function getWebDeviceUUID(): Promise<string> {
  const STORE_KEY = 'colearn_device_uuid';
  let storedUuid = await getIndexedDBItem(STORE_KEY);
  if (!storedUuid) {
    try {
      const fpPromise = import('@fingerprintjs/fingerprintjs').then(FingerprintJS => FingerprintJS.load());
      const fp = await fpPromise;
      const result = await fp.get();
      storedUuid = `${result.visitorId}-${generateSimpleUUID()}`;
    } catch (e) {
      console.error('Failed to get web fingerprint:', e);
      storedUuid = generateSimpleUUID();
    }
    await setIndexedDBItem(STORE_KEY, storedUuid);
  }
  return storedUuid as string;
}

async function getIndexedDBItem(key: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.indexedDB) return null;
  return new Promise((resolve) => {
    const request = indexedDB.open('ColearnDeviceDB', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('deviceStore');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('deviceStore')) {
        resolve(null);
        return;
      }
      const transaction = db.transaction('deviceStore', 'readonly');
      const store = transaction.objectStore('deviceStore');
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
    const request = indexedDB.open('ColearnDeviceDB', 1);
    request.onupgradeneeded = (e: any) => {
      e.target.result.createObjectStore('deviceStore');
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const transaction = db.transaction('deviceStore', 'readwrite');
      const store = transaction.objectStore('deviceStore');
      const putRequest = store.put(value, key);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}
