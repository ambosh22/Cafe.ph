export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  direction?: string;
}

export interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  steps: RouteStep[];
}

function decodeDirection(modifier?: string): string {
  switch (modifier) {
    case "left": return "←";
    case "right": return "→";
    case "sharp left": return "↞";
    case "sharp right": return "↠";
    case "slight left": return "↜";
    case "slight right": return "↝";
    case "straight": return "↑";
    case "uturn": return "↩";
    default: return "↑";
  }
}

export async function fetchRoute(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<RouteData | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?geometries=geojson&overview=full&steps=true`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.routes?.length) return null;

    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates.map(
      (c: number[]) => [c[1], c[0]]
    );

    const steps: RouteStep[] = [];
    for (const leg of route.legs) {
      for (const step of leg.steps) {
        steps.push({
          instruction: step.maneuver?.type
            ? `${step.maneuver.type} ${step.maneuver.modifier || ""}`
            : step.name || "Continue",
          distance: step.distance,
          duration: step.duration,
          direction: decodeDirection(step.maneuver?.modifier),
        });
      }
    }

    return {
      coordinates: coords,
      distance: route.distance,
      duration: route.duration,
      steps,
    };
  } catch {
    return null;
  }
}
