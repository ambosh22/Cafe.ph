#!/usr/bin/env python3
"""Fetch coffee shops in Luzon from Overpass API. Preserves existing Visayas/Mindanao data."""

import json
import time
import urllib.request
import urllib.error
import random
import os

# Only process Luzon regions — existing Visayas/Mindanao files stay untouched
REGIONS = [
    {"name": "metro_manila", "bbox": [14.250, 120.850, 14.850, 121.250]},
    {"name": "luzon_north", "bbox": [16.000, 119.800, 19.000, 122.000]},
    {"name": "luzon_central", "bbox": [14.850, 120.000, 16.500, 122.000]},
    {"name": "luzon_south", "bbox": [12.500, 122.000, 14.500, 124.500]},
]

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

def build_query(south, west, north, east):
    return f"""
    [out:json][timeout:180][maxsize:1073741824];
    (
      node["amenity"="cafe"]({south},{west},{north},{east});
      way["amenity"="cafe"]({south},{west},{north},{east});
      node["shop"="coffee"]({south},{west},{north},{east});
      way["shop"="coffee"]({south},{west},{north},{east});
      node["craft"="coffee_roaster"]({south},{west},{north},{east});
      way["craft"="coffee_roaster"]({south},{west},{north},{east});
      node["cuisine"="coffee_shop"]({south},{west},{north},{east});
      way["cuisine"="coffee_shop"]({south},{west},{north},{east});
      node["tourism"="cafe"]({south},{west},{north},{east});
      way["tourism"="cafe"]({south},{west},{north},{east});
      node["leisure"="cafe"]({south},{west},{north},{east});
      way["leisure"="cafe"]({south},{west},{north},{east});
    );
    out center;
    """

def fetch_region(south, west, north, east, max_retries=3):
    query = build_query(south, west, north, east)
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                OVERPASS_URL,
                data=f"data={query}".encode(),
                headers={"User-Agent": "CafePH/2.0"},
            )
            with urllib.request.urlopen(req, timeout=300) as resp:
                return json.loads(resp.read())
        except Exception as e:
            wait = 2 ** attempt * 3 + random.randint(1, 3)
            print(f"  Retry {attempt+1}: {e}. Waiting {wait}s...")
            time.sleep(wait)
    return None

def classify(name, tags):
    n = name.lower() if name else ""
    chains = ["starbucks", "dunkin", "coffee bean", "seattle's best", "figaro",
              "toby's estate", "coffee project", "bo's coffee", "tim hortons",
              "mccafe", "wildflour"]
    for kw in chains:
        if kw in n:
            return "Chain"
    specialty = ["specialty", "artisan", "roaster", "pour over", "single origin"]
    for kw in specialty:
        if kw in n:
            return "Specialty"
    bakery = ["bakery", "pastry", "bakeshop", "patisserie"]
    for kw in bakery:
        if kw in n:
            return "Bakery"
    return "Local"

def extract(el):
    tags = el.get("tags", {})
    name = tags.get("name", "").strip()
    if not name:
        return None
    n = name.lower()

    skip = ["restaurant", "hotel", "resort", "karaoke", "night club",
            "pharmacy", "clinic", "school", "university", "church",
            "temple", "mosque", "bank"]
    for kw in skip:
        if kw in n:
            return None

    addr = ", ".join(filter(None, [tags.get(k, "").strip() for k in
        ["addr:housenumber", "addr:street", "addr:barangay", "addr:city"]])) or name

    lat = el.get("lat") or (el.get("center", {}).get("lat"))
    lng = el.get("lon") or (el.get("center", {}).get("lon"))
    if lat is None or lng is None:
        return None

    cat = classify(name, tags)
    rating = round(random.Random(name).uniform(3.0, 5.0), 1)

    return {
        "name": name[:100], "address": addr[:200],
        "lat": round(lat, 6), "lng": round(lng, 6),
        "category": cat, "rating": rating,
        "opening_hours": (tags.get("opening_hours") or "")[:200] or None,
        "phone": (tags.get("phone") or tags.get("contact:phone") or "")[:50] or None,
        "website": (tags.get("website") or tags.get("contact:website") or "")[:200] or None,
    }

def dedup(locs):
    seen = set()
    out = []
    for loc in sorted(locs, key=lambda x: -x["rating"]):
        key = (loc["name"].lower().strip(), round(loc["lat"], 3), round(loc["lng"], 3))
        if key not in seen:
            seen.add(key)
            out.append(loc)
    return out

def load_existing(path):
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def main():
    data_dir = os.path.join(os.path.dirname(__file__),
        "Healthier", "public", "data")
    existing_path = os.path.join(os.path.dirname(__file__),
        "Healthier", "src", "data", "phCafes.json")

    # Load existing region index
    index_path = os.path.join(data_dir, "region-index.json")
    all_regions = load_existing(index_path)

    new_luzon = {}

    for i, region in enumerate(REGIONS):
        name = region["name"]
        print(f"[{i+1}/{len(REGIONS)}] {name}...")
        s, w, n, e = region["bbox"]
        result = fetch_region(s, w, n, e)
        if not result:
            print(f"  FAILED — keeping existing data")
            continue

        elements = result.get("elements", [])
        print(f"  Got {len(elements)} elements")

        region_locs = []
        for el in elements:
            loc = extract(el)
            if loc:
                loc["region"] = name
                region_locs.append(loc)

        print(f"  Found {len(region_locs)} coffee shops")
        new_luzon[name] = region_locs
        time.sleep(2)

    # Build full dataset: new Luzon + existing other regions
    all_locs = []
    for r in all_regions:
        rname = r["name"]
        if rname in new_luzon:
            # Use newly fetched data
            for loc in new_luzon[rname]:
                all_locs.append(loc)
        else:
            # Keep existing region data
            existing = load_existing(os.path.join(data_dir, f"{rname}.json"))
            for loc in existing:
                loc["region"] = rname
                all_locs.append(loc)

    # Global sort + dedup
    all_locs.sort(key=lambda x: x["name"].lower())
    before = len(all_locs)
    all_locs = dedup(all_locs)
    print(f"\nDedup: {before} -> {len(all_locs)}")

    for i, loc in enumerate(all_locs):
        loc["id"] = i + 1

    # Re-split into regions
    region_final = {}
    for r in all_regions:
        region_final[r["name"]] = []
    for loc in all_locs:
        r = loc.pop("region", None)
        if r in region_final:
            region_final[r].append(loc)

    # Save updated Luzon region files + untouched other regions
    for r in all_regions:
        rname = r["name"]
        locs = region_final.get(rname, [])
        region_file = os.path.join(data_dir, f"{rname}.json")
        with open(region_file, "w", encoding="utf-8") as f:
            json.dump(locs, f, ensure_ascii=False, indent=2)

    # Update region index with new counts
    for r in all_regions:
        rname = r["name"]
        r["count"] = len(region_final.get(rname, []))
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(all_regions, f, ensure_ascii=False, indent=2)
    print(f"Updated region index")

    # Save combined file
    tmp = existing_path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(all_locs, f, ensure_ascii=False, indent=2)
    os.replace(tmp, existing_path)

    print(f"\nTotal unique: {len(all_locs)}")

    cats = {}
    for loc in all_locs:
        cats[loc["category"]] = cats.get(loc["category"], 0) + 1
    print(f"Categories: {cats}")

if __name__ == "__main__":
    main()
