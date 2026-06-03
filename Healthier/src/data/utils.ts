export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

export function renderRating(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return "🫘".repeat(full) + (half ? "🫘" : "") + "•".repeat(empty);
}

export function isOpenNow(hours: string | null | undefined): boolean | null {
  if (!hours) return null;
  const now = new Date();
  const dayNames = ["su", "mo", "tu", "we", "th", "fr", "sa"];
  const day = dayNames[now.getDay()];
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const normalized = hours.toLowerCase().replace(/\s+/g, " ").trim();

  const dayPatterns: Record<string, RegExp> = {
    mo: /mo[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
    tu: /tu[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
    we: /we[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
    th: /th[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
    fr: /fr[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
    sa: /sa[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
    su: /su[\s\-–]*([\d:]+)\s*[-–]\s*([\d:]+)/gi,
  };

  function parseTime(t: string): number {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  }

  const rangePattern = /(mo|tu|we|th|fr|sa|su)\s*[-–]\s*(mo|tu|we|th|fr|sa|su)\s+([\d:]+)\s*[-–]\s*([\d:]+)/gi;
  for (const match of normalized.matchAll(rangePattern)) {
    const [, d1, d2, startStr, endStr] = match;
    const start = parseTime(startStr);
    const end = parseTime(endStr);
    const d1Idx = dayNames.indexOf(d1.toLowerCase());
    const d2Idx = dayNames.indexOf(d2.toLowerCase());
    const currentDayIdx = dayNames.indexOf(day);
    if (currentDayIdx >= d1Idx && currentDayIdx <= d2Idx) {
      if (currentMin >= start && currentMin < end) return true;
    }
  }

  for (const [d, pattern] of Object.entries(dayPatterns)) {
    for (const match of normalized.matchAll(pattern)) {
      if (d !== day) continue;
      const start = parseTime(match[1]);
      const end = parseTime(match[2]);
      return currentMin >= start && currentMin < end;
    }
  }

  // Hours data exists but no matching rule found for today — assume closed
  const hasAnyDayPattern = /(mo|tu|we|th|fr|sa|su)/i.test(normalized);
  if (hasAnyDayPattern) return false;

  return null;
}
