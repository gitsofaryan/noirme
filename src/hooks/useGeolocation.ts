"use client";

import { useState, useEffect, useRef } from "react";

const FALLBACK = { lat: 28.6139, lng: 77.209 }; // New Delhi fallback

// Helper to calculate distance in km using Haversine formula
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getStableOffset(actualLat: number, actualLng: number) {
  const gridScale = 0.0045; // ~500m grid cell boundaries
  const cellLat = Math.floor(actualLat / gridScale);
  const cellLng = Math.floor(actualLng / gridScale);

  // Seed-based deterministic hashing to get a stable offset per grid cell
  const seed1 = (cellLat * 73856093) ^ (cellLng * 19349663);
  const rand1 = (Math.abs(Math.sin(seed1) * 1000) % 1) - 0.5;
  const latOffset = rand1 * 0.0018;

  const seed2 = (cellLat * 83492791) ^ (cellLng * 73856093);
  const rand2 = (Math.abs(Math.sin(seed2) * 1000) % 1) - 0.5;
  const lngOffset = rand2 * 0.0018;

  return { latOffset, lngOffset };
}

async function getIPLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch("https://freeipapi.com/api/json");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { lat: data.latitude, lng: data.longitude };
      }
    }
  } catch (err) {
    // Try backup
  }

  try {
    const res = await fetch("https://ipwho.is/");
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return { lat: data.latitude, lng: data.longitude };
      }
    }
  } catch (err) {
    // Silent fallback
  }

  return null;
}

export function useGeolocation(maskLocation: boolean = true) {
  const [location, setLocationState] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("noirme_last_location");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            return parsed;
          }
        } catch (e) {
          // Ignore
        }
      }
    }
    return null;
  });

  const [status, setStatus] = useState<"waiting" | "granted" | "denied">("waiting");
  const [isStasis, setIsStasis] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Use refs to avoid re-running effects on location updates
  const locationRef = useRef<{ lat: number; lng: number } | null>(location);
  locationRef.current = location;

  const setLocation = (newLoc: { lat: number; lng: number }) => {
    setLocationState(newLoc);
    if (typeof window !== "undefined") {
      localStorage.setItem("noirme_last_location", JSON.stringify(newLoc));
    }
  };

  useEffect(() => {
    let finished = false;
    let watchId: number | null = null;
    let passivePollInterval: ReturnType<typeof setInterval> | null = null;

    let localIsStasis = false;
    let lastMoveTime = Date.now();
    let lastLatitude: number | null = null;
    let lastLongitude: number | null = null;

    // Fast IP Geolocation fallback so map is never collapsed
    getIPLocation()
      .then((ipLoc) => {
        if (!finished && ipLoc) {
          const offset = maskLocation ? getStableOffset(ipLoc.lat, ipLoc.lng) : { latOffset: 0, lngOffset: 0 };
          const newLat = ipLoc.lat + offset.latOffset;
          const newLng = ipLoc.lng + offset.lngOffset;
          if (!locationRef.current) {
            setLocation({ lat: newLat, lng: newLng });
          }
          setStatus("granted");
        }
      })
      .catch((err) => {
        console.warn("IP Geolocation mount error:", err);
      });

    if (!navigator.geolocation) {
      setStatus("denied");
      return;
    }

    // Fast OS-level cached location for near-instant map loading
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!finished) {
          const offset = maskLocation ? getStableOffset(pos.coords.latitude, pos.coords.longitude) : { latOffset: 0, lngOffset: 0 };
          const newLat = pos.coords.latitude + offset.latOffset;
          const newLng = pos.coords.longitude + offset.lngOffset;
          setLocation({ lat: newLat, lng: newLng });
          setAccuracy(pos.coords.accuracy);
          setStatus("granted");
        }
      },
      () => { }, // Ignore errors, watchPosition will handle it
      { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
    );

    const startHighAccuracyWatch = () => {
      if (watchId !== null) return;
      if (passivePollInterval !== null) {
        clearInterval(passivePollInterval);
        passivePollInterval = null;
      }
      localIsStasis = false;
      setIsStasis(false);
      lastMoveTime = Date.now();

      console.log("[noirme] Starting high-power GPS watchPosition driver.");
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          finished = true;
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setAccuracy(pos.coords.accuracy);
          const offset = maskLocation ? getStableOffset(lat, lng) : { latOffset: 0, lngOffset: 0 };
          const newLat = lat + offset.latOffset;
          const newLng = lng + offset.lngOffset;

          const prev = locationRef.current;
          if (!prev) {
            lastLatitude = lat;
            lastLongitude = lng;
            setLocation({ lat: newLat, lng: newLng });
            setStatus("granted");
            return;
          }

          const dist = getDistanceKm(prev.lat, prev.lng, newLat, newLng);
          if (dist > 0.003) {
            // User is moving! Update coordinates & reset stasis timer
            lastLatitude = lat;
            lastLongitude = lng;
            lastMoveTime = Date.now();
            setLocation({ lat: newLat, lng: newLng });
          } else {
            // If user has been stationary for more than 3 minutes, transition to passive battery saver!
            if (Date.now() - lastMoveTime > 180000 && !localIsStasis) {
              console.log("[noirme] User is stationary. Transitioning to low-power stasis GPS poll.");
              localIsStasis = true;
              setIsStasis(true);
              switchToPassivePoll();
            }
          }
          setStatus("granted");
        },
        () => {
          finished = true;
          setStatus((prev) => (prev === "granted" ? "granted" : "denied"));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    };

    const switchToPassivePoll = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (passivePollInterval !== null) return;

      // Poll low-power location every 2 minutes
      passivePollInterval = setInterval(() => {
        console.log("[noirme] Low-power stasis GPS check-in.");
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setAccuracy(pos.coords.accuracy);

            if (lastLatitude !== null && lastLongitude !== null) {
              const movedDist = getDistanceKm(lastLatitude, lastLongitude, lat, lng);
              if (movedDist > 0.005) {
                // User has started moving! Exit stasis and restore active high-power GPS watch
                console.log("[noirme] Movement detected during stasis. Waking up high-power GPS watch.");
                startHighAccuracyWatch();

                const offset = maskLocation ? getStableOffset(lat, lng) : { latOffset: 0, lngOffset: 0 };
                setLocation({ lat: lat + offset.latOffset, lng: lng + offset.lngOffset });
              }
            } else {
              lastLatitude = lat;
              lastLongitude = lng;
            }
          },
          () => { },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      }, 120000);
    };

    // Initialize with high-accuracy active watch position
    startHighAccuracyWatch();

    // Listen to user map interactions to wake up from stasis instantly
    const handleUserWakeup = () => {
      if (localIsStasis) {
        console.log("[noirme] User interaction detected. Waking up high-power GPS watch.");
        startHighAccuracyWatch();
      } else {
        lastMoveTime = Date.now(); // reset timer on click/activity
      }
    };

    window.addEventListener("click", handleUserWakeup);
    window.addEventListener("touchstart", handleUserWakeup);

    return () => {
      finished = true;
      window.removeEventListener("click", handleUserWakeup);
      window.removeEventListener("touchstart", handleUserWakeup);
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (passivePollInterval !== null) {
        clearInterval(passivePollInterval);
      }
    };
  }, [maskLocation]);

  const refreshLocation = () => {
    return new Promise<{ lat: number; lng: number } | null>((resolve, reject) => {
      let finished = false;

      getIPLocation()
        .then((ipLoc) => {
          if (!finished && ipLoc) {
            const offset = maskLocation ? getStableOffset(ipLoc.lat, ipLoc.lng) : { latOffset: 0, lngOffset: 0 };
            const newCoords = {
              lat: ipLoc.lat + offset.latOffset,
              lng: ipLoc.lng + offset.lngOffset,
            };
            setLocation(newCoords);
            setStatus("granted");
          }
        })
        .catch((err) => console.warn("IP location error on refresh:", err));

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            finished = true;
            const offset = maskLocation ? getStableOffset(pos.coords.latitude, pos.coords.longitude) : { latOffset: 0, lngOffset: 0 };
            const newCoords = {
              lat: pos.coords.latitude + offset.latOffset,
              lng: pos.coords.longitude + offset.lngOffset,
            };
            setLocation(newCoords);
            setStatus("granted");
            resolve(newCoords);
          },
          (err) => {
            finished = true;
            resolve(locationRef.current);
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      } else {
        finished = true;
        resolve(locationRef.current);
      }
    });
  };

  return {
    location,
    status,
    accuracy,
    isStasis,
    refreshLocation,
  };
}
