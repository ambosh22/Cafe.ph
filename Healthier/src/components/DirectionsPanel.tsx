import type { RouteData } from "../data/routing";

interface DirectionsPanelProps {
  destinationName: string;
  route: RouteData;
  onClose: () => void;
  userLocation: { lat: number; lng: number } | null;
  destinationLat: number;
  destinationLng: number;
}

function formatDist(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatDur(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getLiveDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DirectionsPanel({
  destinationName,
  route,
  onClose,
  userLocation,
  destinationLat,
  destinationLng,
}: DirectionsPanelProps) {
  const remainingDist =
    userLocation !== null
      ? getLiveDistance(
          userLocation.lat,
          userLocation.lng,
          destinationLat,
          destinationLng
        )
      : route.distance;
  const totalDurS = route.duration;
  const remainingFrac = Math.min(remainingDist / route.distance, 1);
  const remainingDur = Math.round(totalDurS * remainingFrac);

  return (
    <div className="directions-panel">
      <div className="directions-header">
        <div className="directions-close-row">
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
          <span className="directions-label">Directions</span>
        </div>
        <div className="directions-summary">
          <div className="directions-dest">{destinationName}</div>
          <div className="directions-meta">
            <span className="directions-time">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {formatDur(remainingDur)}
            </span>
            <span className="directions-divider">•</span>
            <span className="directions-dist">{formatDist(remainingDist)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
