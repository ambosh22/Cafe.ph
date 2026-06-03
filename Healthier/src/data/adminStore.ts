import type { Location } from "./locations";

const STORAGE_KEY = "healthier-admin-locations";

export function getAdminLocations(): Location[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAdminLocations(locations: Location[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
}

export function addAdminLocation(loc: Location): void {
  const all = getAdminLocations();
  all.push(loc);
  saveAdminLocations(all);
}

export function removeAdminLocation(id: number): void {
  const all = getAdminLocations();
  saveAdminLocations(all.filter((l) => l.id !== id));
}

export function exportLocationsJson(
  defaultLocations: Location[],
  adminLocations: Location[]
): void {
  const all = [...defaultLocations, ...adminLocations];
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `brew-locations-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importLocationsJson(
  file: File
): Promise<{ success: boolean; count: number; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!Array.isArray(data)) {
          resolve({ success: false, count: 0, error: "Invalid format: expected an array" });
          return;
        }
        const valid = data.filter(
          (item: unknown) =>
            item &&
            typeof (item as Location).name === "string" &&
            typeof (item as Location).lat === "number" &&
            typeof (item as Location).lng === "number"
        );
        saveAdminLocations(valid);
        resolve({ success: true, count: valid.length });
      } catch {
        resolve({ success: false, count: 0, error: "Invalid JSON file" });
      }
    };
    reader.readAsText(file);
  });
}
