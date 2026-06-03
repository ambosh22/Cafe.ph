import type { Location } from "../data/locations";

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function isOpenNow(oh: string): boolean | null {
  try {
    const now = new Date();
    const dayMap = ["su", "mo", "tu", "we", "th", "fr", "sa"];
    const today = dayMap[now.getDay()];
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const dayNames: Record<string, string> = {
      mo: "monday", tu: "tuesday", we: "wednesday", th: "thursday",
      fr: "friday", sa: "saturday", su: "sunday",
    };
    const clean = oh.toLowerCase().replace(/\s+/g, " ").trim();
    const dayPattern = new RegExp(`(${dayNames[today]}|${today})\\s+([\\d:]+)\\s*-\\s*([\\d:]+)`, "i");
    const match = clean.match(dayPattern);
    if (!match) {
      if (clean.includes("24/7") || clean.includes("24 hours")) return true;
      return null;
    }
    const toMin = (t: string) => { const [h, m = 0] = t.split(":").map(Number); return h * 60 + m; };
    const start = toMin(match[2]);
    let end = toMin(match[3]);
    if (end <= start) end += 1440;
    return currentMin >= start && currentMin < end;
  } catch { return null; }
}

function renderStatus(oh: string): { label: string; className: string } {
  const result = isOpenNow(oh);
  if (result === true) return { label: "Open now", className: "status-open" };
  if (result === false) return { label: "Closed", className: "status-closed" };
  return { label: "Hours unknown", className: "status-unknown" };
}

interface LocationCardProps {
  location: Location;
  onClose: () => void;
  onNavigate: (loc: Location) => void;
  userLocation: { lat: number; lng: number } | null;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
}

const categoryEmoji: Record<string, string> = {
  Specialty: "☕", Local: "🏠", Chain: "🏪", Bakery: "🥐",
};
const categoryHeroClass: Record<string, string> = {
  Specialty: "card-hero-specialty", Local: "card-hero-local",
  Chain: "card-hero-chain", Bakery: "card-hero-bakery",
};

export default function LocationCard({
  location, onClose, onNavigate, userLocation, isFavorite, onToggleFavorite,
}: LocationCardProps) {
  const heroClass = categoryHeroClass[location.category] || "card-hero-specialty";
  const emoji = categoryEmoji[location.category] || "☕";
  const stars = Math.round(location.rating);

  let dist: number | null = null;
  if (userLocation) {
    dist = getDistance(userLocation.lat, userLocation.lng, location.lat, location.lng);
  }

  const status = location.opening_hours ? renderStatus(location.opening_hours) : null;

  const handleShare = async () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
    const data = { title: location.name, text: `${location.name}\n${location.address}`, url };
    if (navigator.share) { try { await navigator.share(data); } catch { /* */ } }
    else { try { await navigator.clipboard.writeText(`${location.name} — ${location.address}`); } catch { /* */ } }
  };

  const amenities: { label: string; icon: string }[] = [];
  if (location.wifi) amenities.push({ label: "WiFi", icon: "📶" });
  if (location.outdoor_seating) amenities.push({ label: "Outdoor", icon: "🌿" });
  if (location.wheelchair) amenities.push({ label: "Accessible", icon: "♿" });

  return (
    <div className="location-card" role="dialog" aria-label={location.name}>
      <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
      <div className={`card-hero ${heroClass}`}>
        {location.image ? (
          <img src={location.image} alt={location.name} className="card-hero-img" loading="lazy" />
        ) : (
          <span className="card-hero-emoji">{emoji}</span>
        )}
        <div className="card-hero-overlay" />
      </div>
      <div className="card-content">
        <div className="card-row">
          <span className="card-category">{location.category}</span>
          {status && <span className={`card-status ${status.className}`}>{status.label}</span>}
        </div>
        <h2>{location.name}</h2>
        <div className="rating" aria-label={`${location.rating} out of 5 stars`}>
          {"★".repeat(stars)}{"☆".repeat(5 - stars)}
          <span className="rating-num">{location.rating}</span>
        </div>
        <p className="address">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          {location.address}
        </p>
        <p className="description">{location.description}</p>

        {amenities.length > 0 && (
          <div className="card-amenities">
            {amenities.map((a) => (
              <span key={a.label} className="amenity-tag">{a.icon} {a.label}</span>
            ))}
          </div>
        )}

        {(location.phone || location.website) && (
          <div className="card-contact">
            {location.phone && (
              <a href={`tel:${location.phone}`} className="contact-link" aria-label={`Call`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                {location.phone}
              </a>
            )}
            {location.website && (
              <a href={location.website} target="_blank" rel="noopener noreferrer" className="contact-link" aria-label={`Website`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Website
              </a>
            )}
          </div>
        )}

        <div className="card-actions">
          {dist !== null && (
            <div className="card-dist-info">
              <span className="card-dist-value">{formatDistance(dist)}</span>
              <span className="card-dist-label">away</span>
            </div>
          )}
          <button className={"fav-btn fav-card-btn" + (isFavorite ? " fav-active" : "")} onClick={() => onToggleFavorite(location.id)} aria-label={isFavorite ? "Remove favorite" : "Add favorite"}>
            {isFavorite ? "★" : "☆"}
          </button>
          <button className="share-btn" onClick={handleShare} aria-label="Share">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
          <button className="navigate-btn" onClick={() => onNavigate(location)} aria-label="Navigate">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
