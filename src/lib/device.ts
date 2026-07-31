import FingerprintJS from '@fingerprintjs/fingerprintjs';

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
  return 'web_device_' + Math.random().toString(36).substring(2, 10);
}

export async function setUserDeviceUUID(userId: string, uuid: string): Promise<void> {
  const map = await getDeviceMap();
  map[userId] = uuid;
  await saveDeviceMap(map);
}

export async function generateNewDeviceUUID(userId: string): Promise<string> {
  let visitorId = '';
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    visitorId = result.visitorId;
  } catch (e) {
    visitorId = Math.random().toString(36).substring(2, 10);
  }

  // Create hashed unique ID combining visitorId, userId, timestamp, and random entropy
  const raw = `${visitorId}-${userId}-${Date.now()}-${Math.random()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
  const uuid = `dev-${hashHex}-${Math.random().toString(36).substring(2, 10)}`;

  await setUserDeviceUUID(userId, uuid);
  return uuid;
}

export function getWebDeviceName(): string {
  if (typeof window === 'undefined' || !navigator) return 'Web Browser';
  const ua = navigator.userAgent;

  let browser = 'Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Opera/') || ua.includes('OPR/')) browser = 'Opera';

  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

async function getDeviceMap(): Promise<Record<string, string>> {
  if (typeof window === 'undefined' || !window.indexedDB) return {};
  return new Promise((resolve) => {
    const request = indexedDB.open('ColearnDeviceDB', 2);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('deviceStore')) {
        db.createObjectStore('deviceStore');
      }
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('deviceStore')) {
        resolve({});
        return;
      }
      const transaction = db.transaction('deviceStore', 'readonly');
      const store = transaction.objectStore('deviceStore');
      const getRequest = store.get('user_device_map');
      getRequest.onsuccess = () => resolve(getRequest.result || {});
      getRequest.onerror = () => resolve({});
    };
    request.onerror = () => resolve({});
  });
}

async function saveDeviceMap(map: Record<string, string>): Promise<void> {
  if (typeof window === 'undefined' || !window.indexedDB) return;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ColearnDeviceDB', 2);
    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('deviceStore')) {
        db.createObjectStore('deviceStore');
      }
    };
    request.onsuccess = (e: any) => {
      const db = e.target.result;
      const transaction = db.transaction('deviceStore', 'readwrite');
      const store = transaction.objectStore('deviceStore');
      const putRequest = store.put(map, 'user_device_map');
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}
