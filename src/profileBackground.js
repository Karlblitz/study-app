import { uploadImageToCloudinary } from "./cloudinaryAvatar.js";

const configuredLimit = Number(import.meta.env.VITE_PROFILE_BACKGROUND_MAX_UPLOAD_MB);
export const PROFILE_BACKGROUND_MAX_UPLOAD_MB = Number.isFinite(configuredLimit) && configuredLimit > 0
  ? Math.min(configuredLimit, 8)
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
  url: null,
  publicId: null,
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
    url: typeof value.url === "string" && value.url.startsWith("https://") ? value.url : null,
    publicId: typeof value.publicId === "string" && value.publicId ? value.publicId : null,
    position,
    zoom: clamp(value.zoom, 100, 180, DEFAULT_PROFILE_BACKGROUND.zoom),
    brightness: clamp(value.brightness, 60, 140, DEFAULT_PROFILE_BACKGROUND.brightness),
    overlayOpacity: clamp(value.overlayOpacity, 0, 80, DEFAULT_PROFILE_BACKGROUND.overlayOpacity),
    gradient: typeof value.gradient === "boolean" ? value.gradient : DEFAULT_PROFILE_BACKGROUND.gradient,
    blur: Boolean(value.blur),
  };
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
    throw new Error(`Choose an image no larger than ${PROFILE_BACKGROUND_MAX_UPLOAD_MB} MB.`);
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
    throw new Error("This image could not be reduced below the 900 KB upload limit. Choose a simpler image.");
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("This image could not be opened. Choose a valid JPG, PNG, or WebP file.");
  } finally {
    bitmap?.close();
  }
}

export async function uploadProfileBackgroundToCloudinary(uid, imageBlob, onProgress) {
  if (!uid) throw new Error("Sign in before updating your profile background.");
  if (!(imageBlob instanceof Blob) || imageBlob.type !== "image/webp" || imageBlob.size > MAX_STORED_BYTES) {
    throw new Error("The prepared profile background is invalid or exceeds the 900 KB upload limit.");
  }
  return uploadImageToCloudinary(imageBlob, "studyspace-background.webp", onProgress);
}
