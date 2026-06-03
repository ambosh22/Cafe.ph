import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import MapView from "./components/MapView";
import LocationCard from "./components/LocationCard";
import DirectionsPanel from "./components/DirectionsPanel";
import { type Location } from "./data/locations";
import { fetchAllLocations, loadLocationsInRegion } from "./data/fetchLocations";
import { fetchRoute, type RouteData } from "./data/routing";
import { getDistance, formatDistance, renderRating, isOpenNow } from "./data/utils";
import coffeeLogo from "./assets/coffee.png";
import "./App.css";

type SortMode = "distance" | "rating" | "name";

function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem("brew_favorites");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function loadSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem("brew_searchHistory") || "[]");
  } catch { return []; }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const escaped = escapeRegex(query);
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <strong key={i}>{part}</strong>
      : part
  );
}

const PAGE_SIZE = 200;

function SkeletonItem() {
  return (
    <div className="location-item skeleton-item" aria-hidden="true">
      <div className="skeleton-line skeleton-name" />
      <div className="skeleton-line skeleton-rating" />
      <div className="skeleton-line skeleton-address" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="location-card loading-card" role="status">
      <div className="loading-spinner" />
      <p>Finding coffee shops...</p>
    </div>
  );
}

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMinRating, setFilterMinRating] = useState(0);
  const [filterRadius, setFilterRadius] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("distance");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<Location | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites);
  const [filterAmenities, setFilterAmenities] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [splashMinTime, setSplashMinTime] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTime(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (splashMinTime && !loading) setSplashDone(true);
  }, [splashMinTime, loading]);

  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const watcherRef = useRef<number | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const locationListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("brew_favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("brew_searchHistory", JSON.stringify(searchHistory.slice(0, 20)));
  }, [searchHistory]);

  useEffect(() => {
    const goOff = () => setIsOffline(true);
    const goOn = () => setIsOffline(false);
    window.addEventListener("offline", goOff);
    window.addEventListener("online", goOn);
    return () => {
      window.removeEventListener("offline", goOff);
      window.removeEventListener("online", goOn);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (navigatingTo) handleCloseNavigation();
        else if (selectedLocation) setSelectedLocation(null);
        else if (showMobileList) setShowMobileList(false);
        else if (showFilters) setShowFilters(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    if (!splashMinTime) return;
    let cancelled = false;

    async function load() {
      try {
        if (userLocation) {
          const { nearby, total } = await loadLocationsInRegion(userLocation.lat, userLocation.lng);
          if (!cancelled) {
            setLocations(total);
            setSelectedLocation(nearby[0] || total[0] || null);
            setLoading(false);
          }
        } else {
          const all = await fetchAllLocations();
          if (!cancelled) {
            setLocations(all);
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [splashMinTime, userLocation]);

  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    if (watcherRef.current !== null) {
      navigator.geolocation.clearWatch(watcherRef.current);
      watcherRef.current = null;
    }
    watcherRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationDenied(false);
        setLocationLoaded(true);
      },
      () => { setLocationDenied(true); setLocationLoaded(true); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    handleLocateUser();
    return () => {
      if (watcherRef.current !== null) navigator.geolocation.clearWatch(watcherRef.current);
    };
  }, [handleLocateUser]);

  useEffect(() => {
    if (locationLoaded && userLocation && locations.length > 0 && !navigatingTo) {
      let nearest = locations[0];
      let minDist = Infinity;
      for (const loc of locations) {
        const d = getDistance(userLocation.lat, userLocation.lng, loc.lat, loc.lng);
        if (d < minDist) { minDist = d; nearest = loc; }
      }
      setSelectedLocation(nearest);
    }
  }, [locationLoaded, userLocation, locations.length > 0]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredLocations.length));
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  });

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const loc of locations) counts[loc.category] = (counts[loc.category] || 0) + 1;
    return counts;
  }, [locations]);

  const categories = useMemo(() => {
    const cats = new Set(locations.map((l) => l.category));
    return ["All", ...cats];
  }, [locations]);

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const toggleAmenity = useCallback((amenity: string) => {
    setFilterAmenities((prev) => {
      const n = new Set(prev);
      if (n.has(amenity)) n.delete(amenity); else n.add(amenity);
      return n;
    });
  }, []);

  const handleSearch = (val: string) => {
    setDebouncedQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(val);
      if (val && val.length > 1) {
        setSearchHistory((prev) => {
          const filtered = prev.filter((s) => s !== val);
          return [val, ...filtered].slice(0, 20);
        });
      }
    }, 200);
  };

  const filteredLocations = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    let result = locations.filter((loc) => {
      const matchesSearch = !searchQuery || loc.name.toLowerCase().includes(lower) || loc.address.toLowerCase().includes(lower);
      const matchesCategory = filterCategory === "All" || loc.category === filterCategory;
      const matchesRating = loc.rating >= filterMinRating;

      const matchesAmenities = filterAmenities.size === 0 || (
        (!filterAmenities.has("wifi") || !!loc.wifi) &&
        (!filterAmenities.has("outdoor") || !!loc.outdoor_seating) &&
        (!filterAmenities.has("wheelchair") || !!loc.wheelchair) &&
        (!filterAmenities.has("parking") || !!loc.parking) &&
        (!filterAmenities.has("phone") || !!loc.phone) &&
        (!filterAmenities.has("open_now") || isOpenNow(loc.opening_hours) === true)
      );

      return matchesSearch && matchesCategory && matchesRating && matchesAmenities;
    });

    if (userLocation) {
      result = result
        .map((loc) => ({ ...loc, dist: getDistance(userLocation.lat, userLocation.lng, loc.lat, loc.lng) }))
        .filter((loc) => filterRadius === 0 || (loc as any).dist <= filterRadius)
        .sort((a, b) => {
          if (sortMode === "rating") return b.rating - a.rating;
          if (sortMode === "name") return a.name.localeCompare(b.name);
          return (a as any).dist - (b as any).dist;
        });
    } else {
      if (sortMode === "rating") result = [...result].sort((a, b) => b.rating - a.rating);
      else if (sortMode === "name") result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    result.sort((a, b) => {
      const af = favorites.has(a.id) ? 0 : 1;
      const bf = favorites.has(b.id) ? 0 : 1;
      return af - bf;
    });

    return result;
  }, [locations, searchQuery, filterCategory, filterMinRating, filterRadius, sortMode, filterAmenities, userLocation, favorites]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, filterCategory, filterMinRating, filterRadius, sortMode, filterAmenities]);

  const handleNavigate = async (loc: Location) => {
    if (!userLocation) {
      alert("Please enable location access to get directions.");
      return;
    }
    if (!navigator.onLine) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${loc.lat},${loc.lng}`;
      if (confirm("Navigation needs internet. Open in Google Maps?")) window.open(url, "_blank");
      return;
    }
    setSelectedLocation(null);
    setNavigatingTo(loc);
    setRouteLoading(true);
    setRouteData(null);
    try {
      const route = await fetchRoute(userLocation.lat, userLocation.lng, loc.lat, loc.lng);
      if (!route) { alert("Could not calculate route."); setNavigatingTo(null); }
      else setRouteData(route);
    } catch { alert("Route calculation failed."); setNavigatingTo(null); }
    finally { setRouteLoading(false); }
  };

  const handleCloseNavigation = useCallback(() => {
    setNavigatingTo(null);
    setRouteData(null);
  }, []);

  const amenityOptions = [
    { key: "wifi", label: "WiFi" },
    { key: "outdoor", label: "Outdoor" },
    { key: "wheelchair", label: "Accessible" },
    { key: "parking", label: "Parking" },
    { key: "phone", label: "Has Phone" },
    { key: "open_now", label: "Open Now" },
  ];

  const visibleLocations = filteredLocations.slice(0, visibleCount);
  const query = debouncedQuery;

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      <header className="header">
        <div className="header-content">
          <div className="header-row">
            <h1><img src={coffeeLogo} alt="" className="coffee-logo" /> cafe<span className="brand-dot">.</span><span className="brand-ph">ph</span></h1>
            <div className="header-actions">
              <button className="theme-toggle" onClick={() => setDarkMode((p) => !p)} aria-label={darkMode ? "Light mode" : "Dark mode"}>
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <p className="subtitle">Find your perfect cup near you</p>
        </div>
      </header>

      <div className="search-bar">
        <div className="search-wrapper">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchRef} type="text" placeholder="Search coffee shop... (press /)"
            value={query} onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search coffee shops"
          />
          {searchHistory.length > 0 && !query && (
            <div className="search-history">
              {searchHistory.slice(0, 5).map((s) => (
                <button key={s} className="search-history-item" onClick={() => handleSearch(s)}>{s}</button>
              ))}
            </div>
          )}
        </div>
        <button className={`locate-me-btn ${userLocation ? "active" : ""}`}
          onClick={handleLocateUser} aria-label="Find my location" title="Find my location">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
        <button className="mobile-list-btn" onClick={() => setShowMobileList((p) => !p)} aria-label="Toggle list">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <button className={`filter-toggle-btn ${showFilters ? "active" : ""}`}
          onClick={() => setShowFilters((p) => !p)} aria-label="Toggle filters">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
        </button>
        <div className={`filter-panel ${showFilters ? "filter-panel-open" : ""}`}>
          <div className="category-filters" role="tablist" aria-label="Category">
            {categories.map((cat) => (
              <button key={cat} className={`filter-chip ${filterCategory === cat ? "active" : ""}`}
                onClick={() => { setFilterCategory(cat); setShowFilters(false); }} role="tab" aria-selected={filterCategory === cat}>
                {cat}{cat !== "All" ? ` (${categoryCounts[cat] || 0})` : ""}
              </button>
            ))}
          </div>
          <div className="amenity-filters">
            {amenityOptions.map((a) => (
              <button key={a.key}
                className={`filter-chip amenity-chip ${filterAmenities.has(a.key) ? "active" : ""}`}
                onClick={() => toggleAmenity(a.key)}>{a.label}</button>
            ))}
          </div>
        </div>
      </div>

      {isOffline && (
        <div className="offline-banner" role="alert">You're offline — cafe data works, but map tiles won't load</div>
      )}

      <div className="main-layout">
        <aside className={`sidebar ${showMobileList ? "sidebar-open" : ""}`} aria-label="Coffee shop list">
          <div className="sidebar-header">
            <h3>{userLocation ? "Near You" : "All Cafes"}<span>{filteredLocations.length}</span></h3>
            <div className="sidebar-controls">
              <select className="sort-select" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} aria-label="Sort by">
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
                <option value="name">Name</option>
              </select>
              {userLocation && (
                <div className="radius-filter">
                  <input type="range" min="0" max="50" step="1" value={filterRadius}
                    onChange={(e) => setFilterRadius(parseInt(e.target.value))} aria-label="Max radius" />
                  <span className="radius-filter-label">{filterRadius === 0 ? "Any" : `${filterRadius}km`}</span>
                </div>
              )}
              <div className="rating-filter">
                <input type="range" min="0" max="5" step="0.5" value={filterMinRating}
                  onChange={(e) => setFilterMinRating(parseFloat(e.target.value))} aria-label="Min rating" />
                <span className="rating-filter-label">{filterMinRating}+ ★</span>
              </div>
            </div>
            {showMobileList && (
              <button className="close-btn mobile-close" onClick={() => setShowMobileList(false)} aria-label="Close">✕</button>
            )}
          </div>
          <div className="location-list" ref={locationListRef} role="list">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)
            ) : visibleLocations.length === 0 ? (
              <div className="empty-state">
                <span style={{ fontSize: 48, opacity: 0.4, marginBottom: 12 }}>☕</span>
                <p>No coffee shops found</p>
              </div>
            ) : (
              visibleLocations.map((loc) => (
                <button key={loc.id}
                  className={`location-item ${selectedLocation?.id === loc.id ? "active" : ""}`}
                  onClick={() => { setSelectedLocation(loc); setShowMobileList(false); }}
                  role="listitem" aria-label={loc.name}>
                  <div className="location-item-top">
                    <span className="location-item-name">{highlightText(loc.name, searchQuery)}</span>
                    <div className="location-item-actions">
                      <button className={`fav-btn ${favorites.has(loc.id) ? "fav-active" : ""}`}
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(loc.id); }}
                        aria-label={favorites.has(loc.id) ? "Remove from favorites" : "Add to favorites"}>
                        {favorites.has(loc.id) ? "★" : "☆"}
                      </button>
                      <span className="location-item-category">{loc.category}</span>
                    </div>
                  </div>
                  <div className="location-item-rating">
                    <span className="rating-bean">{renderRating(loc.rating)}</span>
                    <span>{loc.rating}</span>
                  </div>
                  <div className="location-item-address">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    {highlightText(loc.address, searchQuery)}
                    {(loc as any).dist !== undefined && (
                      <span className="location-item-distance">{formatDistance((loc as any).dist)}</span>
                    )}
                  </div>
                </button>
              ))
            )}
            {!loading && visibleCount < filteredLocations.length && <div ref={sentinelRef} className="scroll-sentinel" />}
          </div>
        </aside>

        <div className="map-wrapper">
          {loading ? (
            <SkeletonCard />
          ) : (
            <>
              <MapView
                locations={filteredLocations}
                selectedLocation={selectedLocation}
                onSelectLocation={(loc) => setSelectedLocation(loc)}
                userLocation={userLocation}
                onLocateUser={handleLocateUser}
                locationDenied={locationDenied}
                routeCoords={routeData?.coordinates ?? null}
              />
              {navigatingTo && routeData ? (
                <DirectionsPanel
                  destinationName={navigatingTo.name}
                  route={routeData}
                  onClose={handleCloseNavigation}
                  userLocation={userLocation}
                  destinationLat={navigatingTo.lat}
                  destinationLng={navigatingTo.lng}
                />
              ) : routeLoading ? (
                <div className="location-card loading-card" role="status">
                  <div className="loading-spinner" /><p>Calculating route...</p>
                </div>
              ) : selectedLocation ? (
                <LocationCard
                  location={selectedLocation}
                  onClose={() => setSelectedLocation(null)}
                  onNavigate={handleNavigate}
                  userLocation={userLocation}
                  isFavorite={favorites.has(selectedLocation.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ) : null}
            </>
          )}
        </div>
      </div>
      <div className="shortcuts-hint">Press <kbd>/</kbd> to search · <kbd>Esc</kbd> to close</div>
      <div className={`splash-screen ${splashDone ? "splash-hidden" : ""}`}>
        <img src={coffeeLogo} alt="" className="splash-logo" />
        <div className="splash-title">cafe<span className="splash-dot">.</span><span className="splash-ph">ph</span></div>
        <div className="splash-subtitle">Find your brew</div>
        {loading && <div className="splash-spinner" />}
      </div>
    </div>
  );
}
