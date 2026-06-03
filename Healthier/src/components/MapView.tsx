import { useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { Location } from "../data/locations";

const icon = L.divIcon({
  className: "custom-marker",
  html: `<svg width="36" height="36" viewBox="0 0 36 36"><g transform="translate(2,4)"><path d="M4 6c0-2 2-4 6-4s6 2 6 4v2H4V6z" fill="#6f4e37"/><rect x="3" y="8" width="14" height="12" rx="2" fill="#a67c52"/><path d="M17 10c2 0 4 1 4 3s-2 3-4 3" fill="none" stroke="#6f4e37" stroke-width="1.5"/><ellipse cx="10" cy="8" rx="5" ry="1.5" fill="#2c1810"/><path d="M7 12h6M7 15h4" stroke="#f5e6d3" stroke-width="0.8" stroke-linecap="round"/></g></svg>`,
  iconSize: [36, 36],
  iconAnchor: [18, 32],
  popupAnchor: [0, -32],
});

const selectedIcon = L.divIcon({
  className: "custom-marker",
  html: `<svg width="44" height="44" viewBox="0 0 36 36"><g transform="translate(2,4)"><path d="M4 6c0-2 2-4 6-4s6 2 6 4v2H4V6z" fill="#2c1810"/><rect x="3" y="8" width="14" height="12" rx="2" fill="#6f4e37"/><path d="M17 10c2 0 4 1 4 3s-2 3-4 3" fill="none" stroke="#2c1810" stroke-width="1.5"/><ellipse cx="10" cy="8" rx="5" ry="1.5" fill="#2c1810"/><path d="M7 12h6M7 15h4" stroke="#f5e6d3" stroke-width="0.8" stroke-linecap="round"/></g></svg>`,
  iconSize: [44, 44],
  iconAnchor: [22, 38],
  popupAnchor: [0, -38],
});

const userIcon = L.divIcon({
  className: "custom-marker",
  html: `<svg width="40" height="40" viewBox="0 0 24 24" fill="#6f4e37" stroke="white" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="white"/></svg>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

function RouteLine({
  coordinates,
}: {
  coordinates: [number, number][] | null;
}) {
  const map = useMap();
  const layerRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    if (coordinates && coordinates.length > 0) {
      const polyline = L.polyline(coordinates, {
        color: "#6f4e37",
        weight: 5,
        opacity: 0.8,
        dashArray: "1, 12",
      }).addTo(map);

      const bounds = L.latLngBounds(coordinates);
      map.fitBounds(bounds, { padding: [50, 50], duration: 1 });

      layerRef.current = polyline;
    }
    return () => {
      if (layerRef.current) {
        layerRef.current.remove();
      }
    };
  }, [coordinates, map]);

  return null;
}

function MapController({
  userLocation,
  locationDenied,
  routingActive,
  hasSelectedLocation,
}: {
  userLocation: { lat: number; lng: number } | null;
  locationDenied: boolean;
  routingActive: boolean;
  hasSelectedLocation: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (routingActive) return;
    if (hasSelectedLocation) return;
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1.5 });
    } else if (!locationDenied) {
      map.flyTo([14.558, 121.025], 12, { duration: 1 });
    }
  }, [userLocation, locationDenied, routingActive, hasSelectedLocation, map]);
  return null;
}

function FlyToLocation({ location }: { location: Location | null }) {
  const map = useMap();
  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 16, { duration: 1 });
    }
  }, [location, map]);
  return null;
}

function Markers({
  locations,
  selectedLocation,
  onSelectLocation,
}: {
  locations: Location[];
  selectedLocation: Location | null;
  onSelectLocation: (loc: Location | null) => void;
}) {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    const mcg = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 16,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = "small";
        if (count >= 10) size = "medium";
        if (count >= 50) size = "large";
        return L.divIcon({
          html: `<div class="cluster-icon cluster-${size}"><span>${count}</span></div>`,
          className: "custom-cluster",
          iconSize: L.point(44, 44),
        });
      },
    });

    locations.forEach((loc) => {
      const mk = L.marker([loc.lat, loc.lng], {
        icon: selectedLocation?.id === loc.id ? selectedIcon : icon,
      });
      mk.bindPopup(`<strong>${loc.name}</strong><br/>${loc.address}`);
      mk.on("click", () => onSelectLocation(loc));
      mcg.addLayer(mk);
    });

    map.addLayer(mcg);
    clusterGroupRef.current = mcg;

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [locations, selectedLocation, onSelectLocation, map]);

  return null;
}

interface MapViewProps {
  locations: Location[];
  selectedLocation: Location | null;
  onSelectLocation: (loc: Location | null) => void;
  userLocation: { lat: number; lng: number } | null;
  onLocateUser: () => void;
  locationDenied: boolean;
  routeCoords: [number, number][] | null;
}

export default function MapView({
  locations,
  selectedLocation,
  onSelectLocation,
  userLocation,
  onLocateUser,
  locationDenied,
  routeCoords,
}: MapViewProps) {
  const routingActive = routeCoords !== null && routeCoords.length > 0;

  return (
    <div className="map-view">
      <MapContainer
        center={[14.558, 121.025]}
        zoom={12}
        className="map-container"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!routingActive && <FlyToLocation location={selectedLocation} />}
        <MapController
          userLocation={userLocation}
          locationDenied={locationDenied}
          routingActive={routingActive}
          hasSelectedLocation={selectedLocation !== null}
        />
        <RouteLine coordinates={routeCoords} />
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
          >
            <Popup>
              <strong>You are here</strong>
            </Popup>
          </Marker>
        )}
        <Markers
          locations={locations}
          selectedLocation={selectedLocation}
          onSelectLocation={onSelectLocation}
        />
      </MapContainer>
      <div className="locate-btn-wrap" onClick={onLocateUser} role="button" tabIndex={0} aria-label="Find my location" title={locationDenied ? "Enable location access" : "Recenter on your location"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
        </svg>
      </div>
    </div>
  );
}
