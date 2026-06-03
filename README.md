# cafe.ph ☕

Find your perfect cup near you — a coffee shop finder for the Philippines.

## Features

- **5,606+ coffee shops** across the Philippines
- **Map view** with Leaflet & marker clustering
- **Live navigation** with OSRM routing
- **Real-time location tracking**
- **Filters** by category, amenities (WiFi, Outdoor, etc.), radius, rating
- **Favorites** — save your go-to spots
- **Search** with debounce & history
- **Dark mode**
- **PWA** — installable on mobile
- **Offline-ready** — cached data & service worker

## Tech Stack

React + TypeScript + Vite + Leaflet

## Development

```bash
cd Healthier
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Data

Coffee shop data sourced from OpenStreetMap via Overpass API, split into 14 region files for lazy loading.
