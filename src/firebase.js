import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isMissingConfigValue = (value) =>
  typeof value !== "string" ||
  !value.trim() ||
  /^(your-|replace-with-|paste-)/i.test(value.trim());

export const missingFirebaseConfig = Object.entries(config)
  .filter(([, value]) => isMissingConfigValue(value))
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

export const firebaseConfigured = missingFirebaseConfig.length === 0;
const existingDefaultApp = getApps().find((existingApp) => existingApp.name === "[DEFAULT]");
const app = firebaseConfigured ? existingDefaultApp || initializeApp(config) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
