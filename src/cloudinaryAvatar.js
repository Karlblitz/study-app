const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() || "";
export const CLOUDINARY_AVATAR_CONFIGURED = Boolean(cloudName);
export const CLOUDINARY_AVATAR_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() || "studyspace_avatars";

const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_DECODED_PIXELS = 36_000_000;
const AVATAR_SIZE = 256;
const avatarTypes = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

function validateAvatarFile(file) {
  if (!file) throw new Error("Choose a profile picture first.");
  const extension = file.name?.split(".").pop()?.toLowerCase();
  const expectedType = avatarTypes.get(extension);
  if (!expectedType || (file.type && file.type.toLowerCase() !== expectedType)) {
    throw new Error("Choose a JPG, JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Profile pictures must be 2 MB or smaller.");
  }
}

function canvasToWebp(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") reject(new Error("This browser could not prepare the profile picture. Try another image or a current browser."));
      else resolve(blob);
    }, "image/webp", 0.88);
  });
}

export async function prepareProfileAvatar(file) {
  validateAvatarFile(file);
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot prepare profile pictures. Try a current version of Chrome, Edge, or Firefox.");
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_DECODED_PIXELS) {
      throw new Error("This image is too large to process. Choose a smaller image.");
    }

    const cropSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.floor((bitmap.width - cropSize) / 2);
    const sourceY = Math.floor((bitmap.height - cropSize) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Your browser could not prepare this profile picture.");
    context.drawImage(bitmap, sourceX, sourceY, cropSize, cropSize, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return await canvasToWebp(canvas);
  } catch (error) {
    if (error instanceof Error && error.message) throw error;
    throw new Error("This image could not be opened. Choose a valid JPG, PNG, or WebP file.");
  } finally {
    bitmap?.close();
  }
}

function optimizedDeliveryUrl(secureUrl) {
  return secureUrl.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
}

export async function uploadProfileAvatarToCloudinary(imageBlob, onProgress) {
  if (!cloudName) throw new Error("Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and restart the app.");
  if (!CLOUDINARY_AVATAR_UPLOAD_PRESET) throw new Error("Set VITE_CLOUDINARY_UPLOAD_PRESET to the unsigned studyspace_avatars preset.");
  if (!(imageBlob instanceof Blob) || imageBlob.type !== "image/webp" || imageBlob.size > MAX_SOURCE_BYTES) {
    throw new Error("The prepared profile picture is invalid or exceeds the 2 MB limit.");
  }

  const formData = new FormData();
  formData.append("file", imageBlob, "studyspace-avatar.webp");
  formData.append("upload_preset", CLOUDINARY_AVATAR_UPLOAD_PRESET);

  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`;
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.responseType = "text";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("Could not reach Cloudinary. Check your connection and try again.")));
    request.addEventListener("abort", () => reject(new Error("The Cloudinary upload was canceled.")));
    request.addEventListener("load", () => {
      let response = null;
      try { response = JSON.parse(request.responseText); } catch { /* Use the HTTP status below for non-JSON responses. */ }
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(response?.error?.message || `Cloudinary rejected the upload (HTTP ${request.status}). Check the unsigned preset configuration.`));
        return;
      }
      if (!response?.secure_url || !response?.public_id) {
        reject(new Error("Cloudinary uploaded the file but did not return a secure URL and public ID."));
        return;
      }
      resolve({ secureUrl: optimizedDeliveryUrl(response.secure_url), publicId: response.public_id });
    });
    request.send(formData);
  });
}
