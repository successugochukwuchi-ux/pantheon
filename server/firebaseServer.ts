import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
// Locate firebase-applet-config.json safely in both CJS bundle and TSX/ESM dev
const possibleConfigPaths = [
  path.resolve(process.cwd(), 'firebase-applet-config.json'),
  path.resolve(process.cwd(), '../firebase-applet-config.json'),
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../firebase-applet-config.json') : '',
  typeof __dirname !== 'undefined' ? path.resolve(__dirname, 'firebase-applet-config.json') : '',
].filter(Boolean);

const configPath = possibleConfigPaths.find(p => fs.existsSync(p)) || possibleConfigPaths[0];

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
export const serverAuth = getAuth(serverApp);

// Initialize server session so serverDb operations have an authenticated context
signInAnonymously(serverAuth).catch(err => {
  console.warn('[FirebaseServer] Anonymous auth notice:', err?.message || err);
});

