import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import MapView from "./components/MapView";
import LocationCard from "./components/LocationCard";
import { type Location } from "./data/locations";
import { fetchAllLocations } from "./data/fetchLocations";
import { getDistance, formatDistance, renderRating, isOpenNow } from "./data/utils";
import coffeeLogo from "./assets/coffee.png";
import "./App.css";

function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem("brew_favorites");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function loadWantToTry(): Set<number> {
  try {
    const raw = localStorage.getItem("brew_wantToTry");
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function loadVisitHistory(): number[] {
  try {
    return JSON.parse(localStorage.getItem("brew_visits") || "[]");
  } catch { return []; }
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

type Tab = "explore" | "favorites" | "trending";

export default function App() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showMobileList, setShowMobileList] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [favorites, setFavorites] = useState<Set<number>>(loadFavorites);
  const [wantToTry, setWantToTry] = useState<Set<number>>(loadWantToTry);
  const [visitHistory, setVisitHistory] = useState<number[]>(loadVisitHistory);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchHistory, setSearchHistory] = useState<string[]>(loadSearchHistory);
  const [splashDone, setSplashDone] = useState(false);
  const [splashMinTime, setSplashMinTime] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [sortOpenOnly, setSortOpenOnly] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSplashMinTime(true), 800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (splashMinTime && !loading) setSplashDone(true);
  }, [splashMinTime, loading]);

  const searchRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const locationListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("brew_favorites", JSON.stringify([...favorites]));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("brew_wantToTry", JSON.stringify([...wantToTry]));
  }, [wantToTry]);

  useEffect(() => {
    localStorage.setItem("brew_visits", JSON.stringify(visitHistory.slice(0, 100)));
  }, [visitHistory]);

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
        if (selectedLocation) setSelectedLocation(null);
        else if (showMobileList) setShowMobileList(false);
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
        const all = await fetchAllLocations();
        if (!cancelled) {
          setLocations(all);
          if (all.length > 0) setSelectedLocation(all[0]);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [splashMinTime]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((c) => Math.min(c + PAGE_SIZE, visibleLocations.length));
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  });

  const toggleFavorite = useCallback((id: number) => {
    setFavorites((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const toggleWantToTry = useCallback((id: number) => {
    setWantToTry((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const handleSelectLocation = useCallback((loc: Location | null) => {
    setSelectedLocation(loc);
    if (loc) {
      setVisitHistory((prev) => {
        const filtered = prev.filter((id) => id !== loc.id);
        return [loc.id, ...filtered].slice(0, 100);
      });
    }
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

  const clearSearch = () => {
    setDebouncedQuery("");
    setSearchQuery("");
    searchRef.current?.focus();
  };

  const handleLocateUser = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationDenied(false);
        setLocationLoading(false);
      },
      () => { setLocationDenied(true); setLocationLoading(false); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  const filteredLocations = useMemo(() => {
    const lower = searchQuery.toLowerCase();
    let result = locations.filter((loc) => {
      if (searchQuery && !loc.name.toLowerCase().includes(lower) && !loc.address.toLowerCase().includes(lower)) return false;
      if (sortOpenOnly && isOpenNow(loc.opening_hours) !== true) return false;
      if (activeTab === "favorites" && !favorites.has(loc.id)) return false;
      return true;
    });

    if (userLocation) {
      result = [...result].sort((a, b) => {
        const dA = getDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const dB = getDistance(userLocation.lat, userLocation.lng, b.lat, b.lng);
        return dA - dB;
      });
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    result.sort((a, b) => {
      const aFav = favorites.has(a.id) ? 0 : 1;
      const bFav = favorites.has(b.id) ? 0 : 1;
      return aFav - bFav;
    });

    return result;
  }, [locations, searchQuery, userLocation, favorites, activeTab, sortOpenOnly]);

  const trendingLocations = useMemo(() => {
    return [...locations].sort((a, b) => b.rating - a.rating).slice(0, 10);
  }, [locations]);

  const handleNavigate = (loc: Location) => {
    const origin = userLocation ? `&origin=${userLocation.lat},${userLocation.lng}` : "";
    window.open(`https://www.google.com/maps/dir/?api=1${origin}&destination=${loc.lat},${loc.lng}`, "_blank");
  };

  const visibleLocations = filteredLocations;
  const query = debouncedQuery;

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      <header className="header">
        <div className="header-content">
          <div className="header-row">
            <h1><img src={coffeeLogo} alt="" className="coffee-logo" /> cafe<span className="brand-dot">.</span><span className="brand-ph">ph</span></h1>
            <div className="header-actions">
              <button className="theme-toggle" onClick={() => setDarkMode((p) => !p)} aria-label={darkMode ? "Light" : "Dark"}>
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <p className="subtitle">Find your perfect cup near you</p>
        </div>
      </header>

      <div className="search-bar">
        <div className="search-wrapper">
          <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input ref={searchRef} type="text" placeholder="Search coffee shop..." value={query} onChange={(e) => handleSearch(e.target.value)} aria-label="Search" />
          {query && (
            <button className="search-clear" onClick={clearSearch} aria-label="Clear">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button className={`locate-btn ${locationLoading ? "locating" : ""} ${userLocation ? "located" : ""}`} onClick={handleLocateUser} aria-label="Location">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
        <button className="mobile-list-btn" onClick={() => setShowMobileList((p) => !p)} aria-label="List">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {searchHistory.length > 0 && !query && (
          <div className="search-history">
            {searchHistory.slice(0, 5).map((s) => (
              <button key={s} className="search-history-item" onClick={() => handleSearch(s)}>{s}</button>
            ))}
          </div>
        )}
      </div>

      <div className="quick-tools">
        <button className={`tool-chip ${sortOpenOnly ? "active" : ""}`} onClick={() => setSortOpenOnly((p) => !p)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Open Now
        </button>
        <button className="tool-chip" onClick={() => { setActiveTab("trending"); setSearchQuery(""); setDebouncedQuery(""); }}>
          🔥 Trending
        </button>
        {userLocation && (
          <span className="tool-chip tool-location" title="Location active">
            <span className="locate-dot" /> Live
          </span>
        )}
      </div>

      {isOffline && (
        <div className="offline-banner" role="alert">Offline — map tiles may not load</div>
      )}

      <div className="main-layout">
        <aside className={`sidebar ${showMobileList ? "sidebar-open" : ""}`}>
          <div className="sidebar-header">
            <h3>
              {activeTab === "favorites" ? "Favorites" : activeTab === "trending" ? "Trending" : userLocation ? "Near You" : "All Cafes"}
              <span className="count-badge">{visibleLocations.length}</span>
            </h3>
            {showMobileList && <button className="close-btn" onClick={() => setShowMobileList(false)}>✕</button>}
          </div>
          <div className="sidebar-drag" />
          <div className="location-list" ref={locationListRef} role="list">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonItem key={i} />)
            ) : visibleLocations.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">☕</span>
                <p>{activeTab === "favorites" ? "No favorites yet" : "No coffee shops found"}</p>
                {activeTab === "favorites" && <p className="empty-hint">Tap the ★ on any cafe to add it</p>}
              </div>
            ) : (
              visibleLocations.map((loc) => {
                const dist = userLocation ? getDistance(userLocation.lat, userLocation.lng, loc.lat, loc.lng) : null;
                const visited = visitHistory.includes(loc.id);
                const isFav = favorites.has(loc.id);
                const isWant = wantToTry.has(loc.id);
                return (
                  <button key={loc.id}
                    className={`location-item ${selectedLocation?.id === loc.id ? "active" : ""} ${visited ? "visited" : ""}`}
                    onClick={() => { handleSelectLocation(loc); setShowMobileList(false); }}
                    role="listitem" aria-label={loc.name}>
                    <div className="location-item-top">
                      <span className="location-item-name">{highlightText(loc.name, searchQuery)}</span>
                      <div className="location-item-actions">
                        {isWant && <span className="wtt-indicator" title="Want to try">📋</span>}
                        <span className="location-item-category">{loc.category}</span>
                      </div>
                    </div>
                    <div className="location-item-rating">
                      <span className="rating-bean">{renderRating(loc.rating)}</span>
                      <span>{loc.rating}</span>
                      {isFav && <span className="fav-indicator">★</span>}
                      {dist !== null && <span className="location-item-distance">{formatDistance(dist)}</span>}
                    </div>
                    <div className="location-item-address">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      {highlightText(loc.address, searchQuery)}
                    </div>
                    {visited && <div className="visited-bar" />}
                  </button>
                );
              })
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
                locations={visibleLocations}
                selectedLocation={selectedLocation}
                onSelectLocation={handleSelectLocation}
                userLocation={userLocation}
                onLocateUser={handleLocateUser}
                locationDenied={locationDenied}
                locationLoading={locationLoading}
              />
              {selectedLocation && (
                <LocationCard
                  location={selectedLocation}
                  onClose={() => setSelectedLocation(null)}
                  onNavigate={handleNavigate}
                  userLocation={userLocation}
                  isFavorite={favorites.has(selectedLocation.id)}
                  onToggleFavorite={toggleFavorite}
                  isWantToTry={wantToTry.has(selectedLocation.id)}
                  onToggleWantToTry={toggleWantToTry}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <button className={`bnav-btn ${activeTab === "explore" ? "active" : ""}`} onClick={() => setActiveTab("explore")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
          </svg>
          <span>Explore</span>
        </button>
        <button className={`bnav-btn ${activeTab === "trending" ? "active" : ""}`} onClick={() => { setActiveTab(activeTab === "trending" ? "explore" : "trending"); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
          </svg>
          <span>Trending</span>
        </button>
        <button className={`bnav-btn ${activeTab === "favorites" ? "active" : ""}`} onClick={() => setActiveTab(activeTab === "favorites" ? "explore" : "favorites")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={activeTab === "favorites" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span>Favorites</span>
        </button>
      </nav>

      <div className={`splash-screen ${splashDone ? "splash-hidden" : ""}`}>
        <img src={coffeeLogo} alt="" className="splash-logo" />
        <div className="splash-title">cafe<span className="splash-dot">.</span><span className="splash-ph">ph</span></div>
        <div className="splash-subtitle">Find your brew</div>
        {loading && <div className="splash-spinner" />}
      </div>
    </div>
  );
}
