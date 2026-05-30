export type TransportMode = "foot" | "bicycle" | "driving";

export interface RouteData {
  coordinates: [number, number][]; // [lat, lng] array
  distanceMeters: number;
  durationSeconds: number;
}

export async function fetchOSRMRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  mode: TransportMode = "foot"
): Promise<RouteData> {
  const url = `https://router.project-osrm.org/route/v1/${mode}/${startLng},${startLat};${endLng},${endLat}?geometries=geojson&overview=full`;

  console.log(`[norby] OSRM API routing (${mode}) from ${startLat},${startLng} to ${endLat},${endLng}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.routes || data.routes.length === 0) {
    throw new Error("No route found between coordinates");
  }

  const route = data.routes[0];
  const geojsonCoords = route.geometry.coordinates as [number, number][]; // [lng, lat]
  
  // Swap OSRM [lng, lat] coordinates to Leaflet [lat, lng]
  const coordinates = geojsonCoords.map(([lng, lat]) => [lat, lng] as [number, number]);

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hrs} hr ${remainingMins} min`;
}
