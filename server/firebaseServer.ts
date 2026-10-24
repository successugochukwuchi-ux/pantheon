import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');

let firebaseConfig: Record<string, string> = {
  projectId: 'pantheon-study',
};

try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[FirebaseServer] Could not parse firebase-applet-config.json, using defaults:', e);
}

const serverApp = getApps().find(a => a.name === 'server-app') || initializeApp(firebaseConfig, 'server-app');
export const serverDb = getFirestore(serverApp);
