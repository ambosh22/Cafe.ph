#!/usr/bin/env python3
"""Fetch all coffee shops in the Philippines from Overpass API."""

import json
import time
import urllib.request
import urllib.error
import re
import random
import os

REGIONS = [
    # Metro Manila
    {"name": "metro_manila", "bbox": [14.250, 120.850, 14.850, 121.250]},
    # Luzon - North
    {"name": "luzon_north", "bbox": [16.000, 119.800, 19.000, 122.000]},
    # Luzon - Central
    {"name": "luzon_central", "bbox": [14.850, 120.000, 16.500, 122.000]},
    # Luzon - South (Bicol etc)
    {"name": "luzon_south", "bbox": [12.500, 122.000, 14.500, 124.500]},
    # Luzon - Ilocos/CAR
    {"name": "luzon_ilocos", "bbox": [16.000, 119.800, 18.500, 121.200]},
    # Cebu
    {"name": "cebu", "bbox": [9.500, 123.200, 10.800, 124.200]},
    # Negros / Panay
    {"name": "visayas_west", "bbox": [9.500, 122.000, 11.500, 123.800]},
    # Leyte / Samar / Bohol
    {"name": "visayas_east", "bbox": [9.800, 124.000, 12.000, 125.800]},
    # Davao / GenSan / SOCCSKSARGEN
    {"name": "mindanao_south", "bbox": [5.800, 124.500, 8.000, 126.500]},
    # CDO / Bukidnon / Caraga
    {"name": "mindanao_north", "bbox": [8.000, 123.500, 9.500, 125.800]},
    # Zamboanga / Basilan
    {"name": "mindanao_west", "bbox": [6.500, 121.500, 8.500, 123.500]},
    # Palawan
    {"name": "palawan", "bbox": [8.500, 117.000, 12.000, 119.500]},
    # Batanes / Babuyan
    {"name": "batanes", "bbox": [18.000, 121.500, 21.000, 122.500]},
    # Mindoro / Marinduque / Romblon
    {"name": "mindoro", "bbox": [12.000, 120.500, 13.800, 122.200]},
]

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_overpass_query(south, west, north, east):
    return f"""
    [out:json][timeout:120];
    (
      node["amenity"="cafe"]({south},{west},{north},{east});
      way["amenity"="cafe"]({south},{west},{north},{east});
      node["shop"="coffee"]({south},{west},{north},{east});
      way["shop"="coffee"]({south},{west},{north},{east});
      node["craft"="coffee_roaster"]({south},{west},{north},{east});
      way["craft"="coffee_roaster"]({south},{west},{north},{east});
      node["cuisine"="coffee_shop"]({south},{west},{north},{east});
      way["cuisine"="coffee_shop"]({south},{west},{north},{east});
    );
    out center;
    """

def fetch_region(south, west, north, east, max_retries=5):
    query = build_overpass_query(south, west, north, east)
    data = {"south": south, "west": west, "north": north, "east": east}
    
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                OVERPASS_URL,
                data=f"data={query}".encode(),
                headers={"User-Agent": "BrewPHCoffeeFinder/1.0"},
            )
            with urllib.request.urlopen(req, timeout=180) as resp:
                return json.loads(resp.read())
        except Exception as e:
            wait = 2 ** attempt * 5 + random.randint(1, 5)
            print(f"  Attempt {attempt+1} failed: {e}. Waiting {wait}s...")
            time.sleep(wait)
    return None

def classify_cafe(name, tags):
    name_lower = name.lower() if name else ""
    
    # Chain detection
    chain_keywords = [
        "starbucks", "dunkin", "coffee bean & tea leaf", "the coffee bean",
        "seattle's best", "figaro", "ucc coffee", "toby's estate",
        "st. marc", "coffee project", "kuppa", "bo's coffee", "bos coffee",
        "wildflour", "tim hortons", "mcdonald's", "mc cafe", "mccafe",
        "lotteria", "minisop", "the brew shop", "caravan coffee",
        "seattle's best", "coffee bean", "starbucks reserve",
    ]
    for kw in chain_keywords:
        if kw in name_lower:
            return "Chain"
    
    # Specialty detection
    specialty_keywords = [
        "specialty", "artisan", "single origin", "third wave", "pour over",
        "roaster", "micro-roastery", "microroastery", "craft coffee",
        "specialty coffee", "yardstick", "habitual", "the curator",
        "commune", "chapter coffee",
    ]
    for kw in specialty_keywords:
        if kw in name_lower:
            return "Specialty"
    
    # Bakery detection
    bakery_keywords = ["bakery", "bakery cafe", "bread", "pastry", "bakeshop",
                       "patisserie", "yamato bakery"]
    for kw in bakery_keywords:
        if kw in name_lower:
            return "Bakery"
    
    # Check OSM tags
    if tags:
        cuisine = (tags.get("cuisine", "") or "").lower()
        if "specialty" in cuisine:
            return "Specialty"
    
    return "Local"

def generate_rating(name, category):
    base = random.Random(name).uniform(3.0, 5.0)
    if category == "Specialty":
        base = max(base, 4.0)
    if category == "Chain":
        base = max(3.5, min(base, 4.6))
    return round(base, 1)

def extract_location(element):
    tags = element.get("tags", {})
    name = tags.get("name", "").strip()
    if not name:
        return None
    
    # Skip non-coffee places
    name_lower = name.lower()
    skip_keywords = ["restaurant", "bar ", " pub", "night", "club", "karaoke",
                     "hotel", "resort", "inn ", "lodge", "hostel", "spa",
                     "gym", "fitness", "salon", "barber", "laundry", "pharmacy",
                     "clinic", "school", "university", "college", "church",
                     "temple", "mosque", "bank", "office", "store", "shop",
                     "market", "supermarket", "grocer"]
    for kw in skip_keywords:
        if kw in name_lower:
            return None
    
    addr_parts = []
    for key in ["addr:housenumber", "addr:street", "addr:barangay",
                "addr:city", "addr:municipality", "addr:province"]:
        val = tags.get(key, "").strip()
        if val:
            addr_parts.append(val)
    address = ", ".join(addr_parts) if addr_parts else name
    
    lat = element.get("lat") or (element.get("center", {}).get("lat"))
    lng = element.get("lon") or (element.get("center", {}).get("lon"))
    if lat is None or lng is None:
        return None
    
    category = classify_cafe(name, tags)
    rating = generate_rating(name, category)
    
    # Capture extra fields from OSM tags
    image = None
    opening_hours = None
    phone = None
    website = None
    wifi = None
    outdoor = None
    parking = None
    wheelchair = None
    if tags:
        img = tags.get("image", "").strip()
        if img and ("http" in img or "wikimedia" in img):
            image = img
        oh = tags.get("opening_hours", "").strip()
        if oh:
            opening_hours = oh[:200]
        ph = tags.get("phone", "") or tags.get("contact:phone", "")
        if ph:
            phone = ph.strip()[:50]
        wb = tags.get("website", "") or tags.get("contact:website", "") or tags.get("url", "")
        if wb:
            website = wb.strip()[:200]
        wf = (tags.get("wifi", "") or tags.get("internet_access", "")).strip().lower()
        if wf and wf not in ("no", "none", ""):
            wifi = wf[:20]
        os_ = tags.get("outdoor_seating", "").strip().lower()
        if os_ == "yes" or os_ == "true":
            outdoor = "yes"
        pk = tags.get("parking", "").strip().lower()
        if pk and pk != "no":
            parking = "yes"
        wc = tags.get("wheelchair", "").strip().lower()
        if wc and wc != "no":
            wheelchair = "yes"
    
    description_map = {
        "Chain": "Popular coffee chain serving your favorite espresso drinks, frappuccinos, and pastries in a familiar setting",
        "Local": "Cozy neighborhood cafe with a warm atmosphere, great coffee, and a welcoming community vibe",
        "Bakery": "Bakery and cafe offering fresh-baked goods, artisanal pastries, and premium coffee pairings",
        "Specialty": "Specialty coffee shop dedicated to the art of precision-brewed coffee using single-origin beans",
    }
    
    return {
        "name": name[:100],
        "address": address[:200],
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "category": category,
        "description": description_map.get(category, "Coffee shop serving hot and cold beverages"),
        "rating": rating,
        "image": image,
        "opening_hours": opening_hours,
        "phone": phone,
        "website": website,
        "wifi": wifi,
        "outdoor_seating": outdoor,
        "parking": parking,
        "wheelchair": wheelchair,
    }

def deduplicate(locations, proximity_km=0.05):
    """Remove duplicates by name similarity and proximity."""
    seen = set()
    unique = []
    for loc in sorted(locations, key=lambda x: -x["rating"]):
        key = (
            loc["name"].lower().strip(),
            round(loc["lat"], 3),
            round(loc["lng"], 3),
        )
        if key not in seen:
            seen.add(key)
            unique.append(loc)
    return unique

def main():
    all_locations = []
    region_raw = {}
    
    existing_path = os.path.join(os.path.dirname(__file__),
                                 "Healthier", "src", "data", "phCafes.json")
    data_dir = os.path.join(os.path.dirname(__file__),
                            "Healthier", "public", "data")
    os.makedirs(data_dir, exist_ok=True)
    
    for i, region in enumerate(REGIONS):
        print(f"[{i+1}/{len(REGIONS)}] Fetching {region['name']}...")
        south, west, north, east = region["bbox"]
        result = fetch_region(south, west, north, east)
        
        if result is None:
            print(f"  FAILED after retries")
            continue
        
        elements = result.get("elements", [])
        print(f"  Got {len(elements)} elements")
        
        region_locs = []
        for el in elements:
            loc = extract_location(el)
            if loc:
                loc["region"] = region["name"]
                region_locs.append(loc)
                all_locations.append(loc)
        
        region_raw[region["name"]] = region_locs
        time.sleep(1)
    
    # Global sort + dedup
    all_locations.sort(key=lambda x: x["name"].lower())
    all_locations = deduplicate(all_locations)
    
    for i, loc in enumerate(all_locations):
        loc["id"] = i + 1
    
    # Re-split into regions by region field
    region_final = {r["name"]: [] for r in REGIONS}
    for loc in all_locations:
        r = loc.pop("region", None)
        if r in region_final:
            region_final[r].append(loc)
    
    # Save individual region files to public/data/ (with IDs)
    for region in REGIONS:
        locs = region_final[region["name"]]
        region_file = os.path.join(data_dir, f"{region['name']}.json")
        with open(region_file, "w", encoding="utf-8") as f:
            json.dump(locs, f, ensure_ascii=False, indent=2)
        print(f"  Saved {len(locs)} to {region_file}")
    
    # Save region index
    region_index = []
    for region in REGIONS:
        locs = region_final[region["name"]]
        region_index.append({
            "name": region["name"],
            "bbox": region["bbox"],
            "count": len(locs),
        })
    index_file = os.path.join(data_dir, "region-index.json")
    with open(index_file, "w", encoding="utf-8") as f:
        json.dump(region_index, f, ensure_ascii=False, indent=2)
    print(f"Saved region index to {index_file}")
    
    # Save combined file (fallback / static import)
    tmp_path = existing_path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(all_locations, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, existing_path)
    
    print(f"\nTotal unique locations: {len(all_locations)}")
    
    cats = {}
    for loc in all_locations:
        cats[loc["category"]] = cats.get(loc["category"], 0) + 1
    print(f"Categories: {cats}")
    
    chain_counts = {}
    for loc in all_locations:
        if loc["category"] == "Chain":
            base = loc["name"].split("(")[0].strip()
            chain_counts[base] = chain_counts.get(base, 0) + 1
    print(f"Top chains: {dict(sorted(chain_counts.items(), key=lambda x: -x[1])[:20])}")
    
    print(f"Saved combined to {existing_path}")

if __name__ == "__main__":
    main()
