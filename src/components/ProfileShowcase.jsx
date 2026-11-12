import { normalizeProfileBackground } from "../profileBackground.js";
import { Pencil } from "lucide-react";
import "../ProfileBackground.css";

function profileHandle(profile, name) {
  if (profile.username?.trim()) return profile.username.trim().replace(/^@/, "");
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "student";
}

export function ProfileShowcase({ profile = {}, imageUrl, previewMode = "desktop", onEditProfile }) {
  const settings = normalizeProfileBackground(profile.profileBackground || {});
  const bannerUrl = imageUrl ?? profile.profileBackgroundUrl ?? "";
  const name = profile.name?.trim() || "Student";
  const context = [profile.program, profile.school, profile.yearLevel].filter(Boolean).join(" · ");
  const about = profile.bio?.trim() || profile.studyGoal?.trim() || "Welcome to my study space.";
  const imageStyle = bannerUrl ? {
    backgroundImage: `url(${JSON.stringify(bannerUrl)})`,
    backgroundPosition: `${settings.position} center`,
    transformOrigin: `${settings.position} center`,
    transform: `scale(${settings.zoom / 100})`,
    filter: `brightness(${settings.brightness}%) blur(${settings.blur ? 4 : 0}px)`,
  } : undefined;
  const overlayStyle = {
    opacity: settings.overlayOpacity / 100,
    background: settings.gradient
      ? "linear-gradient(112deg, rgba(5, 13, 29, .96) 0%, rgba(10, 22, 42, .34) 64%, rgba(5, 13, 29, .72) 100%)"
      : "rgba(5, 13, 29, .7)",
  };
  const avatarUrl = profile.photoURL || profile.avatarUrl || "";

  return <section className={`profile-showcase${previewMode === "mobile" ? " profile-showcase-mobile" : ""}`} aria-label="Profile header preview">
    <div className={`profile-showcase-banner${bannerUrl ? " has-custom-background" : ""}`} aria-label={bannerUrl ? "Custom profile background" : "Default profile background"}>
      {bannerUrl && <div className="profile-showcase-image" style={imageStyle} aria-hidden="true" />}
      <div className="profile-showcase-overlay" style={overlayStyle} aria-hidden="true" />
      <span className="profile-showcase-banner-label">STUDYSPACE</span>
      {!bannerUrl && <span className="profile-showcase-decoration profile-showcase-decoration-one" aria-hidden="true" />}
      {!bannerUrl && <span className="profile-showcase-decoration profile-showcase-decoration-two" aria-hidden="true" />}
    </div>
    <div className="profile-showcase-identity">
      <div className="profile-showcase-avatar">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="profile-showcase-name">
        <h3>{name}</h3>
        <span>@{profileHandle(profile, name)}</span>
      </div>
      <span className="profile-showcase-badge">Studyspace learner</span>
      {onEditProfile && <button type="button" className="profile-showcase-edit" onClick={onEditProfile}><Pencil size={14} /> Edit profile</button>}
    </div>
    <p className="profile-showcase-bio">{about}</p>
    {context && <p className="profile-showcase-context">{context}</p>}
  </section>;
}
