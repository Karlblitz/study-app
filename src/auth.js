import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "./firebase.js";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

function getAuthInstance() {
  if (!auth) throw new Error("Firebase is not configured. Replace the placeholders in the project-root .env.local with your Firebase Web App values, then restart Vite.");
  return auth;
}

async function useSessionPersistence() {
  await setPersistence(getAuthInstance(), browserSessionPersistence);
}

export async function createFirebaseAccount({ name, email, password }) {
  await useSessionPersistence();

  const credential = await createUserWithEmailAndPassword(
    getAuthInstance(),
    email.trim(),
    password
  );

  const user = credential.user;

  await updateProfile(user, { displayName: name.trim() });

  await setDoc(doc(db, "users", user.uid), {
    name: name.trim(),
    email: user.email,
    createdAt: serverTimestamp(),
  });

  return user;
}

export async function signInFirebaseAccount({ email, password }) {
  await useSessionPersistence();
  const credential = await signInWithEmailAndPassword(getAuthInstance(), email.trim(), password);
  return credential.user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await useSessionPersistence();
  const credential = await signInWithPopup(getAuthInstance(), provider);
  return credential.user;
}

export async function setFirebasePersistence(rememberUser) {
  await setPersistence(
    getAuthInstance(),
    rememberUser ? browserLocalPersistence : browserSessionPersistence,
  );
}

export async function signOutFirebaseUser() {
  await signOut(getAuthInstance());
}

export async function updateFirebaseDisplayName(name) {
  const currentUser = getAuthInstance().currentUser;
  if (!currentUser) throw new Error("You need to be signed in to update your profile.");
  await updateProfile(currentUser, { displayName: name.trim() });
}

export function getAuthErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/operation-not-allowed": "This sign-in method is not enabled in Firebase Authentication.",
    "auth/popup-closed-by-user": "The Google sign-in window was closed before completing sign-in.",
    "auth/popup-blocked": "Your browser blocked the Google sign-in window. Allow pop-ups and try again.",
    "auth/too-many-requests": "Too many attempts were made. Wait a moment and try again.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/network-request-failed": "Could not reach Firebase Authentication. Check your connection and try again.",
  };
  return messages[error?.code] || error?.message || "Could not complete sign-in. Please try again.";
}
