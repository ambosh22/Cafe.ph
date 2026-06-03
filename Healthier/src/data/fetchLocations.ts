import type { Location } from "./locations";
import { getImageForLocation } from "./coffeeImages";

type RawLocation = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  description?: string;
  rating: number;
  image?: string | null;
  opening_hours?: string | null;
  phone?: string | null;
  website?: string | null;
  wifi?: string | null;
  outdoor_seating?: string | null;
  parking?: string | null;
  wheelchair?: string | null;
};

const chainDescriptions: Record<string, string> = {
  starbucks: "Global coffeehouse chain serving signature roasts, frappuccinos, and handcrafted coffee beverages in a cozy, familiar setting",
  "dunkin'": "Popular donut and coffee chain known for its classic brewed coffee, espresso drinks, and delicious donuts and pastries",
  "dunkin donuts": "Popular donut and coffee chain known for its classic brewed coffee, espresso drinks, and delicious donuts and pastries",
  "bo's coffee": "Homegrown Philippine coffee chain sourcing local Arabica beans, serving Filipino coffee blends and classic espresso drinks",
  figaro: "Philippine coffee chain offering premium espresso-based drinks, frappes, and pastries in a warm modern cafe setting",
  "coffee bean": "Specialty coffee and tea retailer serving handcrafted beverages, whole bean coffee, and premium tea lattes",
  "seattle's best": "Coffee chain known for its smooth, approachable roasts, signature drinks, and relaxed neighborhood cafe vibe",
  "tim hortons": "Canadian coffee and donut chain serving fresh coffee, specialty drinks, baked goods, and breakfast items",
  "coffee project": "Aesthetic cafe chain known for its stylish interiors, Instagrammable coffee creations, and refreshing frappes",
  "toby's estate": "Australian specialty coffee roaster serving single-origin brews, flat whites, and artisanal coffee in a modern space",
};

const generalDescriptions: Record<string, string[]> = {
  Chain: [
    "Popular coffee chain serving your favorite espresso drinks, frappuccinos, and pastries in a familiar setting",
    "Trusted coffee chain offering a wide selection of hot and cold beverages, from classic lattes to signature blends",
    "Well-loved coffee chain known for its consistently good coffee and welcoming atmosphere perfect for meetups",
  ],
  Local: [
    "Cozy neighborhood cafe with a warm atmosphere, great coffee, and a welcoming community vibe",
    "Charming local cafe serving carefully crafted coffee drinks in a relaxed, intimate setting",
    "Hidden gem coffee spot loved by locals for its quality brews, friendly service, and laid-back ambiance",
  ],
  Bakery: [
    "Bakery and cafe offering fresh-baked goods, artisanal pastries, and premium coffee pairings",
    "Artisan bakery cafe with freshly baked bread, cakes, and pastries alongside expertly brewed coffee",
    "Cozy bakery cafe where the aroma of fresh pastries meets the rich flavor of specialty coffee",
  ],
  Specialty: [
    "Specialty coffee shop dedicated to the art of precision-brewed coffee using single-origin beans",
    "Third-wave coffee roaster and brew bar focused on sustainable sourcing, precise extraction, and flavor clarity",
    "Artisan coffee lab featuring pour-over, cold brew, and espresso made from ethically sourced specialty beans",
  ],
};

function pick<T>(arr: T[], seed: string): T {
  return arr[Math.abs(hashCode(seed)) % arr.length];
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

function getDescription(name: string, category: string): string {
  const lower = name.toLowerCase();
  for (const [key, desc] of Object.entries(chainDescriptions)) {
    if (lower.includes(key)) return desc;
  }
  const pool = generalDescriptions[category] || generalDescriptions.Local;
  return pick(pool, name);
}

function enrichLocation(loc: RawLocation): Location {
  return {
    id: loc.id,
    name: loc.name,
    address: loc.address,
    lat: loc.lat,
    lng: loc.lng,
    category: loc.category,
    description: loc.description || getDescription(loc.name, loc.category),
    rating: loc.rating,
    image: getImageForLocation(loc.name, loc.category, loc.image),
    opening_hours: loc.opening_hours || null,
    phone: loc.phone || null,
    website: loc.website || null,
    wifi: loc.wifi || null,
    outdoor_seating: loc.outdoor_seating || null,
    parking: loc.parking || null,
    wheelchair: loc.wheelchair || null,
  };
}

export type RegionInfo = {
  name: string;
  bbox: number[];
  count: number;
};

const REGION_BOUNDS: Record<string, number[]> = {
  metro_manila: [14.250, 120.850, 14.850, 121.250],
  luzon_north: [16.000, 119.800, 19.000, 122.000],
  luzon_central: [14.850, 120.000, 16.500, 122.000],
  luzon_south: [12.500, 122.000, 14.500, 124.500],
  luzon_ilocos: [16.000, 119.800, 18.500, 121.200],
  cebu: [9.500, 123.200, 10.800, 124.200],
  visayas_west: [9.500, 122.000, 11.500, 123.800],
  visayas_east: [9.800, 124.000, 12.000, 125.800],
  mindanao_south: [5.800, 124.500, 8.000, 126.500],
  mindanao_north: [8.000, 123.500, 9.500, 125.800],
  mindanao_west: [6.500, 121.500, 8.500, 123.500],
  palawan: [8.500, 117.000, 12.000, 119.500],
  batanes: [18.000, 121.500, 21.000, 122.500],
  mindoro: [12.000, 120.500, 13.800, 122.200],
};

function inBbox(lat: number, lng: number, bbox: number[]): boolean {
  return lat >= bbox[0] && lat <= bbox[2] && lng >= bbox[1] && lng <= bbox[3];
}

export function findRegion(lat: number, lng: number): string | null {
  for (const [name, bbox] of Object.entries(REGION_BOUNDS)) {
    if (inBbox(lat, lng, bbox)) return name;
  }
  return null;
}

let cachedLocations: Location[] | null = null;
let loadingPromise: Promise<Location[]> | null = null;

export async function fetchAllLocations(): Promise<Location[]> {
  if (cachedLocations) return cachedLocations;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const res = await fetch("/data/region-index.json");
    const regions: RegionInfo[] = await res.json();

    const all: Location[] = [];
    for (const region of regions) {
      if (region.count === 0) continue;
      const fileRes = await fetch(`/data/${region.name}.json`);
      const rawLocs: RawLocation[] = await fileRes.json();
      for (const loc of rawLocs) {
        all.push(enrichLocation(loc));
      }
    }

    cachedLocations = all;
    return all;
  })();

  return loadingPromise;
}

export async function loadLocationsInRegion(lat: number, lng: number): Promise<{
  nearby: Location[];
  total: Location[];
}> {
  const regionName = findRegion(lat, lng) || "metro_manila";

  const indexRes = await fetch("/data/region-index.json");
  const regions: RegionInfo[] = await indexRes.json();

  let nearby: Location[] = [];
  const others: RawLocation[] = [];

  for (const region of regions) {
    if (region.count === 0) continue;
    const fileRes = await fetch(`/data/${region.name}.json`);
    const rawLocs: RawLocation[] = await fileRes.json();
    if (region.name === regionName) {
      nearby = rawLocs.map(enrichLocation);
    } else {
      others.push(...rawLocs);
    }
  }

  const total = [...nearby, ...others.map(enrichLocation)];
  cachedLocations = total;
  return { nearby, total };
}
