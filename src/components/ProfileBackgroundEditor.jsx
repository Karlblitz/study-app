import { useEffect, useRef, useState } from "react";
import { ImagePlus, Monitor, RotateCcw, Smartphone, Trash2, Upload } from "lucide-react";
import { ProfileShowcase } from "./ProfileShowcase.jsx";
import {
  DEFAULT_PROFILE_BACKGROUND,
  normalizeProfileBackground,
  prepareProfileBackground,
  PROFILE_BACKGROUND_MAX_UPLOAD_MB,
} from "../profileBackground.js";

export default function ProfileBackgroundEditor({ profile, value, onChange, onPreparingChange, disabled = false }) {
  const [previewUrl, setPreviewUrl] = useState(profile.profileBackgroundUrl || "");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const settings = normalizeProfileBackground(value.settings);
  const savedBackground = profile.profileBackground || DEFAULT_PROFILE_BACKGROUND;
  const hasCustomBackground = Boolean(value.blob || (!value.remove && savedBackground.url));

  useEffect(() => {
    if (value.blob) {
      const objectUrl = URL.createObjectURL(value.blob);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setPreviewUrl(value.remove ? "" : profile.profileBackgroundUrl || "");
  }, [value.blob, value.remove, profile.profileBackgroundUrl]);

  async function chooseFile(file) {
    if (disabled || !file) return;
    setError("");
    setPreparing(true);
    onPreparingChange(true);
    try {
      const blob = await prepareProfileBackground(file);
      onChange((current) => ({ ...current, blob, uploadedAsset: null, remove: false }));
    } catch (fileError) {
      setError(fileError.message || "This image could not be used.");
    } finally {
      setPreparing(false);
      onPreparingChange(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function changeSetting(key, nextValue) {
    if (disabled) return;
    onChange((current) => ({
      ...current,
      settings: normalizeProfileBackground({ ...current.settings, [key]: nextValue }),
    }));
  }

  function removeBackground() {
    if (disabled) return;
    onChange((current) => ({ ...current, blob: null, uploadedAsset: null, remove: true }));
    setError("");
  }

  function restoreDefault() {
    if (disabled) return;
    onChange((current) => ({
      ...current,
      settings: { ...DEFAULT_PROFILE_BACKGROUND },
      blob: null,
      uploadedAsset: null,
      remove: Boolean(savedBackground.url),
    }));
    setError("");
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    chooseFile(event.dataTransfer.files?.[0]);
  }

  const previewProfile = { ...profile, profileBackground: settings };

  return <section className="profile-background-editor" aria-labelledby="profile-background-heading">
    <div className="profile-background-heading">
      <div>
        <p className="eyebrow">PERSONALIZE YOUR SPACE</p>
        <h3 id="profile-background-heading">Profile Background</h3>
        <p>Choose a wide banner and tune the way it appears on your profile.</p>
      </div>
      <div className="profile-preview-switch" role="group" aria-label="Preview size">
        <button type="button" className={previewMode === "desktop" ? "selected" : ""} aria-pressed={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")} title="Desktop preview"><Monitor size={15} /><span>Desktop</span></button>
        <button type="button" className={previewMode === "mobile" ? "selected" : ""} aria-pressed={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")} title="Mobile preview"><Smartphone size={15} /><span>Mobile</span></button>
      </div>
    </div>

    <div className={`profile-showcase-preview${previewMode === "mobile" ? " is-mobile" : ""}`}>
      <ProfileShowcase profile={previewProfile} imageUrl={previewUrl} previewMode={previewMode} />
    </div>

    <div className={`profile-background-dropzone${dragging ? " is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={handleDrop}>
      <input ref={fileInput} className="profile-background-file-input" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => chooseFile(event.target.files?.[0])} />
      <span className="profile-background-upload-icon"><ImagePlus size={20} /></span>
      <div className="profile-background-upload-copy">
        <strong>{hasCustomBackground ? "Replace your background" : "Add a profile background"}</strong>
        <span>Drop an image here or choose one. JPG, JPEG, PNG, and WebP · up to {PROFILE_BACKGROUND_MAX_UPLOAD_MB} MB before optimization.</span>
      </div>
      <button type="button" className="button secondary profile-background-choose" disabled={disabled || preparing} onClick={() => fileInput.current?.click()}>
        <Upload size={15} /> {preparing ? "Preparing…" : hasCustomBackground ? "Replace image" : "Choose image"}
      </button>
    </div>
    {error && <p className="profile-background-error" role="alert">{error}</p>}
    <div className="profile-background-management">
      <span>{value.blob ? "New image ready to save" : hasCustomBackground ? "Your saved image stays unchanged until you save" : "Using the default background"}</span>
      <div>
        <button type="button" className="profile-background-text-button" disabled={disabled || !hasCustomBackground} onClick={removeBackground}><Trash2 size={14} /> Remove background</button>
        <button type="button" className="profile-background-text-button" disabled={disabled} onClick={restoreDefault}><RotateCcw size={14} /> Restore default</button>
      </div>
    </div>

    <div className="profile-background-controls">
      <label className="profile-background-control">
        <span><strong>Image position</strong><small>Choose which part of the banner stays in view.</small></span>
        <select value={settings.position} disabled={disabled} onChange={(event) => changeSetting("position", event.target.value)}>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
        </select>
      </label>
      <label className="profile-background-control profile-background-range">
        <span><strong>Zoom</strong><output>{settings.zoom}%</output></span>
        <input type="range" min="100" max="180" step="1" value={settings.zoom} disabled={disabled} onChange={(event) => changeSetting("zoom", Number(event.target.value))} aria-label="Background zoom" />
      </label>
      <label className="profile-background-control profile-background-range">
        <span><strong>Brightness</strong><output>{settings.brightness}%</output></span>
        <input type="range" min="60" max="140" step="1" value={settings.brightness} disabled={disabled} onChange={(event) => changeSetting("brightness", Number(event.target.value))} aria-label="Background brightness" />
      </label>
      <label className="profile-background-control profile-background-range">
        <span><strong>Overlay opacity</strong><output>{settings.overlayOpacity}%</output></span>
        <input type="range" min="0" max="80" step="1" value={settings.overlayOpacity} disabled={disabled} onChange={(event) => changeSetting("overlayOpacity", Number(event.target.value))} aria-label="Overlay opacity" />
      </label>
      <label className="profile-background-toggle"><input type="checkbox" checked={settings.gradient} disabled={disabled} onChange={(event) => changeSetting("gradient", event.target.checked)} /><span><strong>Gradient overlay</strong><small>Add extra contrast behind profile details.</small></span></label>
      <label className="profile-background-toggle"><input type="checkbox" checked={settings.blur} disabled={disabled} onChange={(event) => changeSetting("blur", event.target.checked)} /><span><strong>Blur background</strong><small>Soften busy images behind your profile.</small></span></label>
    </div>
  </section>;
}
