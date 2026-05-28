import { useState, useEffect, useRef } from "react";

export interface OSMPlace {
  id: number;
  lat: number;
  lon: number;
  tags: {
    name?: string;
    amenity?: string;
    leisure?: string;
    shop?: string;
    tourism?: string;
    [key: string]: string | undefined;
  };
}

export function useOSM(mapBounds: { _southWest: { lat: number; lng: number }; _northEast: { lat: number; lng: number } } | null, zoom: number) {
  const [places, setPlaces] = useState<OSMPlace[]>([]);
  const cache = useRef<Map<string, OSMPlace[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clean up expired cache items from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const EXPIRE_TIME = 12 * 60 * 60 * 1000; // 12 hours
      const now = Date.now();
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("noirme_osm_cache_")) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (now - parsed.timestamp > EXPIRE_TIME) {
              keysToRemove.push(key);
            }
          }
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      if (keysToRemove.length > 0) {
        console.log(`[noirme-osm] Evicted ${keysToRemove.length} expired OSM cache entries.`);
      }
    } catch (e) {
      // Ignore local storage quota or privacy sandbox issues
    }
  }, []);

  useEffect(() => {
    // Only fetch if zoom is high enough to avoid massive queries
    if (!mapBounds || zoom < 14) {
      if (zoom < 14) setPlaces([]);
      return;
    }

    const { _southWest: sw, _northEast: ne } = mapBounds;
    // Round bounds to roughly 0.01 degrees to increase cache hit rate and reduce small fetch jitter
    const roundTo = 0.01;
    const cacheS = Math.floor(sw.lat / roundTo) * roundTo;
    const cacheW = Math.floor(sw.lng / roundTo) * roundTo;
    const cacheN = Math.ceil(ne.lat / roundTo) * roundTo;
    const cacheE = Math.ceil(ne.lng / roundTo) * roundTo;

    const cacheKey = `${cacheS},${cacheW},${cacheN},${cacheE}`;
    const storageKey = `noirme_osm_cache_${cacheKey}`;

    // 1. In-memory fast cache check
    if (cache.current.has(cacheKey)) {
      setPlaces(cache.current.get(cacheKey)!);
      return;
    }

    // 2. Persistent localStorage cache check
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const EXPIRE_TIME = 12 * 60 * 60 * 1000; // 12 hours
          if (Date.now() - parsed.timestamp < EXPIRE_TIME) {
            cache.current.set(cacheKey, parsed.places);
            setPlaces(parsed.places);
            return;
          } else {
            localStorage.removeItem(storageKey);
          }
        }
      } catch (e) {}
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Query Overpass API for amenities, leisure, and tourism within the rounded bounding box
    const query = `
      [out:json][timeout:5];
      (
        node["amenity"](${cacheS},${cacheW},${cacheN},${cacheE});
        node["leisure"](${cacheS},${cacheW},${cacheN},${cacheE});
        node["tourism"](${cacheS},${cacheW},${cacheN},${cacheE});
      );
      out body;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

    fetch(url, { signal: abortControllerRef.current.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Overpass API rate limit or error");
        return res.json();
      })
      .then((data) => {
        if (data && data.elements) {
          // Filter to places that actually have a name, as nameless generic buildings aren't useful for hotspots
          const namedPlaces = data.elements.filter((el: OSMPlace) => el.tags && el.tags.name) as OSMPlace[];
          
          // Cache in memory
          cache.current.set(cacheKey, namedPlaces);
          
          // Cache in persistent localStorage
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                storageKey,
                JSON.stringify({
                  places: namedPlaces,
                  timestamp: Date.now(),
                })
              );
            } catch (e) {}
          }
          
          setPlaces(namedPlaces);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.warn("[noirme] OSM fetch error:", err);
        }
      });

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [mapBounds, zoom]);

  return places;
}
