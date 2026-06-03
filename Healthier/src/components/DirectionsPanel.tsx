import type { RouteData } from "../data/routing";

interface DirectionsPanelProps {
  destinationName: string;
  route: RouteData;
  onClose: () => void;
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

export default function DirectionsPanel({
  destinationName,
  route,
  onClose,
}: DirectionsPanelProps) {
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
              {formatDur(route.duration)}
            </span>
            <span className="directions-divider">•</span>
            <span className="directions-dist">{formatDist(route.distance)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
