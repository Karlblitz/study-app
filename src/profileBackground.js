import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase.js";

const profileBackgroundLimit = Number(import.meta.env.VITE_PROFILE_BACKGROUND_MAX_UPLOAD_MB);
export const PROFILE_BACKGROUND_MAX_UPLOAD_MB = Number.isFinite(profileBackgroundLimit) && profileBackgroundLimit > 0
  ? Math.min(profileBackgroundLimit, 32)
  : 8;

const MAX_STORED_BYTES = 900 * 1024;
const MAX_IMAGE_WIDTH = 1920;
const MAX_IMAGE_HEIGHT = 640;
const MAX_DECODED_PIXELS = 36_000_000;
const supportedImageTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export const DEFAULT_PROFILE_BACKGROUND = Object.freeze({
  storagePath: null,
  position: "center",
  zoom: 100,
  brightness: 100,
  overlayOpacity: 42,
  gradient: true,
  blur: false,
});

const clamp = (value, minimum, maximum, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};

export function normalizeProfileBackground(value = {}) {
  value ||= {};
  const position = ["left", "center", "right"].includes(value.position) ? value.position : "center";
  return {
    storagePath: typeof value.storagePath === "string" && value.storagePath ? value.storagePath : null,
    position,
    zoom: clamp(value.zoom, 100, 180, DEFAULT_PROFILE_BACKGROUND.zoom),
    brightness: clamp(value.brightness, 60, 140, DEFAULT_PROFILE_BACKGROUND.brightness),
    overlayOpacity: clamp(value.overlayOpacity, 0, 80, DEFAULT_PROFILE_BACKGROUND.overlayOpacity),
    gradient: typeof value.gradient === "boolean" ? value.gradient : DEFAULT_PROFILE_BACKGROUND.gradient,
    blur: Boolean(value.blur),
  };
}

export function getProfileBackgroundErrorMessage(error) {
  switch (error?.code) {
    case "storage/unauthorized":
      return "Firebase Storage denied this upload. Publish the rules in storage.rules to the configured bucket and confirm you are signed in to the same Firebase project.";
    case "storage/bucket-not-found":
    case "storage/no-default-bucket":
      return "The configured Firebase Storage bucket was not found. Create a Storage bucket and set VITE_FIREBASE_STORAGE_BUCKET to its exact name, then restart the app.";
    case "storage/project-not-found":
      return "Firebase Storage is not enabled for the configured project. Create a Storage bucket in Firebase Console, then restart the app.";
    case "storage/unauthenticated":
      return "Your Firebase session expired. Sign out and sign back in before saving the background.";
    case "storage/retry-limit-exceeded":
      return "The image upload timed out. Check your connection and try again.";
    default:
      return error?.message || "Could not upload the profile background.";
  }
}

function imageTypeFor(file) {
  const extension = file.name?.split(".").pop()?.toLowerCase();
  const inferredType = supportedImageTypes.get(extension);
  if (!inferredType || (file.type && file.type.toLowerCase() !== inferredType)) {
    throw new Error("Choose a JPG, JPEG, PNG, or WebP image.");
  }
  return inferredType;
}

function encodeCanvas(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("This image could not be compressed. Try another image."));
      else resolve(blob);
    }, "image/webp", quality);
  });
}

export async function prepareProfileBackground(file) {
  if (!file) throw new Error("Choose an image first.");
  imageTypeFor(file);
  const sourceLimit = PROFILE_BACKGROUND_MAX_UPLOAD_MB * 1024 * 1024;
  if (file.size > sourceLimit) {
    throw new Error(`Choose an image smaller than ${PROFILE_BACKGROUND_MAX_UPLOAD_MB} MB.`);
  }
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot resize images. Try a current version of Chrome, Edge, or Firefox.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_DECODED_PIXELS) {
      throw new Error("This image is too large to process. Choose a smaller image.");
    }

    const scale = Math.min(1, MAX_IMAGE_WIDTH / bitmap.width, MAX_IMAGE_HEIGHT / bitmap.height);
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    const qualities = [0.88, 0.8, 0.72, 0.64];

    for (let pass = 0; pass < 6; pass += 1) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Your browser could not prepare this image.");
      context.clearRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await encodeCanvas(canvas, quality);
        if (blob.type === "image/webp" && blob.size <= MAX_STORED_BYTES) return blob;
      }

      width = Math.max(1, Math.round(width * 0.82));
      height = Math.max(1, Math.round(height * 0.82));
    }
    throw new Error("This image could not be reduced below the 900 KB storage limit. Choose a simpler image.");
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("This image could not be opened. Choose a valid JPG, PNG, or WebP file.");
  } finally {
    bitmap?.close();
  }
}

function userBackgroundReference(uid, storagePath) {
  if (!storage || !uid) throw new Error("Sign in before updating your profile background.");
  if (typeof storagePath !== "string" || !storagePath.startsWith(`users/${uid}/profile/backgrounds/`)) {
    throw new Error("This profile background does not belong to the signed-in user.");
  }
  return ref(storage, storagePath);
}

export async function uploadUserProfileBackground(uid, imageBlob, onProgress) {
  if (!storage || !uid) throw new Error("Firebase Storage is unavailable. Check the Firebase storage bucket configuration.");
  if (!(imageBlob instanceof Blob) || imageBlob.type !== "image/webp" || imageBlob.size > MAX_STORED_BYTES) {
    throw new Error("The prepared profile background is invalid or exceeds the 900 KB limit.");
  }

  const storagePath = `users/${uid}/profile/backgrounds/${crypto.randomUUID()}.webp`;
  const imageRef = userBackgroundReference(uid, storagePath);
  let uploaded = false;
  try {
    storage.maxUploadRetryTime = 60_000;
    const uploadTask = uploadBytesResumable(imageRef, imageBlob, {
      contentType: "image/webp",
      cacheControl: "private, max-age=3600",
    });
    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", (snapshot) => {
        const percent = snapshot.totalBytes ? Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100) : 0;
        onProgress?.(percent);
      }, reject, resolve);
    });
    uploaded = true;
    return { storagePath, url: await getDownloadURL(imageRef) };
  } catch (error) {
    if (uploaded) await deleteObject(imageRef).catch(() => {});
    throw error;
  }
}

export async function getUserProfileBackgroundUrl(uid, storagePath) {
  if (!storagePath) return "";
  return getDownloadURL(userBackgroundReference(uid, storagePath));
}

export async function deleteUserProfileBackground(uid, storagePath) {
  if (!storagePath) return;
  try {
    await deleteObject(userBackgroundReference(uid, storagePath));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") throw error;
  }
}
