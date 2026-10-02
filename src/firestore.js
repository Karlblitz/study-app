import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";

function getDatabase() {
  if (!db) throw new Error("Firebase is not configured. Set the VITE_FIREBASE_* values in .env.local and restart Vite.");
  return db;
}

function getUserCollection(uid, collectionName) {
  if (!uid) throw new Error("A signed-in user is required to access study data.");
  return collection(getDatabase(), "users", uid, collectionName);
}

function getUserProfileRef(uid) {
  if (!uid) throw new Error("A signed-in user is required to access profile data.");
  return doc(getDatabase(), "users", uid, "profile", "preferences");
}

function recordData(record) {
  const { id, ...data } = record;
  return data;
}

export async function getUserRecords(uid, collectionName) {
  const snapshot = await getDocs(getUserCollection(uid, collectionName));
  return snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
}

export async function createUserRecord(uid, collectionName, record) {
  const collectionRef = getUserCollection(uid, collectionName);
  const recordRef = record.id ? doc(collectionRef, record.id) : doc(collectionRef);
  await setDoc(recordRef, recordData(record));
  return { ...record, id: recordRef.id };
}

export async function updateUserRecord(uid, collectionName, id, updates) {
  if (!id) throw new Error("A record ID is required to update study data.");
  await setDoc(doc(getUserCollection(uid, collectionName), id), recordData(updates), { merge: true });
}

export async function deleteUserRecord(uid, collectionName, id) {
  if (!id) throw new Error("A record ID is required to delete study data.");
  await deleteDoc(doc(getUserCollection(uid, collectionName), id));
}

export function subscribeToUserRecords(uid, collectionName, onRecords, onError) {
  return onSnapshot(
    getUserCollection(uid, collectionName),
    (snapshot) => onRecords(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))),
    onError,
  );
}

export async function getUserProfile(uid) {
  const snapshot = await getDoc(getUserProfileRef(uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveUserProfile(uid, profile) {
  await setDoc(getUserProfileRef(uid), profile, { merge: true });
}

export function subscribeToUserProfile(uid, onProfile, onError) {
  return onSnapshot(getUserProfileRef(uid), (snapshot) => onProfile(snapshot.exists() ? snapshot.data() : null), onError);
}
