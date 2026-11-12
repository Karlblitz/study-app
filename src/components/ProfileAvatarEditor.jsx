import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { CLOUDINARY_AVATAR_CONFIGURED, prepareProfileAvatar } from "../cloudinaryAvatar.js";
import "../ProfileAvatar.css";

export default function ProfileAvatarEditor({ profile, onAuthenticate, onUpload, onSavePhoto, onRemovePhoto, onBusyChange = () => {} }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [pendingAsset, setPendingAsset] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInput = useRef(null);
  const avatarUrl = profile.photoURL || profile.avatarUrl || "";
  const initials = profile.name?.trim()?.slice(0, 1).toUpperCase() || "S";

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  async function chooseImage(file) {
    if (!file) return;
    setError("");
    setSuccess("");
    setPendingAsset(null);
    try {
      setSelectedImage(await prepareProfileAvatar(file));
    } catch (fileError) {
      setSelectedImage(null);
      setError(fileError.message || "This profile picture could not be used.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function uploadImage() {
    if (busy || !CLOUDINARY_AVATAR_CONFIGURED) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setSuccess("");
    try {
      if (!navigator.onLine) throw new Error("You appear to be offline. Reconnect, then upload the profile picture again.");
      await onAuthenticate();
      let asset = pendingAsset;
      if (!asset) {
        if (!selectedImage) throw new Error("Choose a profile picture first.");
        setStatus("Uploading to Cloudinary");
        setProgress(0);
        asset = await onUpload(selectedImage, setProgress);
        setPendingAsset(asset);
      }
      setStatus("Saving to your profile");
      const firestoreWaitTimer = window.setTimeout(() => {
        setStatus("Waiting for Firebase");
        setError("Cloudinary uploaded the image, but Firebase has not confirmed the profile update yet. Check your connection and keep this dialog open while it retries.");
      }, 15000);
      try {
        await onSavePhoto(asset);
      } catch (saveError) {
        throw new Error(`Cloudinary uploaded the image, but Firestore could not save it to your profile. Your photo is safe; choose Retry profile save to finish. ${saveError.message || ""}`.trim(), { cause: saveError });
      } finally {
        window.clearTimeout(firestoreWaitTimer);
      }
      setPendingAsset(null);
      setSelectedImage(null);
      setProgress(100);
      setStatus("");
      setSuccess("Profile picture updated.");
    } catch (uploadError) {
      setStatus("");
      setError(uploadError.message || "Could not update the profile picture.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function removeImage() {
    if (busy || (!avatarUrl && !pendingAsset && !selectedImage)) return;
    if (!avatarUrl && !pendingAsset) {
      setSelectedImage(null);
      setError("");
      setSuccess("");
      return;
    }
    if (!window.confirm("Remove your profile picture? This clears it from your profile but does not delete the Cloudinary image.")) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setSuccess("");
    try {
      await onAuthenticate();
      await onRemovePhoto();
      setSelectedImage(null);
      setPendingAsset(null);
      setStatus("");
      setSuccess("Profile picture removed.");
    } catch (removeError) {
      setError(removeError.message || "Could not remove the profile picture.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  const displayedUrl = pendingAsset?.secureUrl || previewUrl || avatarUrl;
  const displayUploadText = status === "Saving to your profile"
    ? "Saving to profile…"
    : status === "Waiting for Firebase"
      ? "Waiting for Firebase…"
    : status === "Uploading to Cloudinary"
      ? `Uploading… ${progress}%`
      : pendingAsset
        ? "Retry profile save"
        : "Upload image";

  return <section className="profile-avatar-editor" aria-labelledby="profile-avatar-heading">
    <div className="profile-avatar-editor-copy">
      <p className="eyebrow">PROFILE PHOTO</p>
      <h3 id="profile-avatar-heading">Profile picture</h3>
      <p>Choose a JPG, JPEG, PNG, or WebP image up to 2 MB. It will be cropped to a centered 256 × 256 square.</p>
    </div>
    <div className="profile-avatar-editor-main">
      <div className="profile-avatar-editor-preview" aria-label="Profile picture preview">
        {displayedUrl ? <img src={displayedUrl} alt="Profile picture preview" /> : <span>{initials}</span>}
      </div>
      <div className="profile-avatar-editor-actions">
        <input ref={fileInput} className="profile-avatar-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} />
        <button type="button" className="button secondary" disabled={busy} onClick={() => fileInput.current?.click()}><ImagePlus size={15} /> {avatarUrl ? "Change photo" : "Choose photo"}</button>
        <button type="button" className="button primary" disabled={busy || !CLOUDINARY_AVATAR_CONFIGURED || (!selectedImage && !pendingAsset)} onClick={uploadImage}><Upload size={15} /> {displayUploadText}</button>
        <button type="button" className="profile-avatar-remove" disabled={busy || (!avatarUrl && !pendingAsset && !selectedImage)} onClick={removeImage}><Trash2 size={14} /> Remove photo</button>
      </div>
    </div>
    {status === "Uploading to Cloudinary" && <div className="profile-avatar-progress" role="progressbar" aria-label="Profile picture upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>}
    {!CLOUDINARY_AVATAR_CONFIGURED && <p className="profile-avatar-error" role="alert">Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET, then restart the app.</p>}
    {error && (CLOUDINARY_AVATAR_CONFIGURED || !error.includes("Cloudinary is not configured")) && <p className="profile-avatar-error" role="alert">{error}</p>}
    {success && <p className="profile-avatar-success" role="status">{success}</p>}
  </section>;
}
