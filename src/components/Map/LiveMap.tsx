"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AnimatePresence, motion } from "framer-motion";
import { Compass } from "lucide-react";

import { useMapContext } from "./MapProvider";
import { UserMarker } from "./markers/UserMarker";
import { HotspotMarker } from "./markers/HotspotMarker";
import { UserDrawer } from "./drawers/UserDrawer";
import { HotspotDrawer } from "./drawers/HotspotDrawer";
import { SpaceDrawer } from "./drawers/SpaceDrawer";
import { VibeFilterBar } from "./overlays/VibeFilterBar";
import { FloatingControls } from "./overlays/FloatingControls";
import { IntentModal } from "./overlays/IntentModal";
import { RouteHUD } from "./overlays/RouteHUD";

// private MapController component to synchronize Leaflet instance states
function MapController({
  lat,
  lng,
  trigger,
  followUser,
  setFollowUser,
  setZoom,
  setIsInteracting,
  setBounds,
}: {
  lat: number;
  lng: number;
  trigger: number;
  followUser: boolean;
  setFollowUser: (val: boolean) => void;
  setZoom: (val: number) => void;
  setIsInteracting: (val: boolean) => void;
  setBounds: (bounds: any) => void;
}) {
  const map = useMap();

  useEffect(() => {
    (window as any).leafletMap = map;
    return () => {
      delete (window as any).leafletMap;
    };
  }, [map]);

  useEffect(() => {
    setZoom(map.getZoom());
    const onZoom = () => {
      setZoom(map.getZoom());
    };
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map, setZoom]);

  useEffect(() => {
    const onMoveStart = () => setIsInteracting(true);
    const onMoveEnd = () => {
      setIsInteracting(false);
      setBounds(map.getBounds());
    };
    const onDragStart = () => {
      setFollowUser(false);
      setIsInteracting(true);
    };
    const onDragEnd = () => {
      setIsInteracting(false);
      setBounds(map.getBounds());
    };

    map.on("movestart", onMoveStart);
    map.on("moveend", onMoveEnd);
    map.on("dragstart", onDragStart);
    map.on("dragend", onDragEnd);

    return () => {
      map.off("movestart", onMoveStart);
      map.off("moveend", onMoveEnd);
      map.off("dragstart", onDragStart);
      map.off("dragend", onDragEnd);
    };
  }, [map, setFollowUser, setIsInteracting]);

  useEffect(() => {
    if (followUser) {
      map.panTo([lat, lng], { animate: true, duration: 0.5 });
      setTimeout(() => setBounds(map.getBounds()), 600);
    }
  }, [lat, lng, followUser, map, setBounds]);

  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.8 });
    setTimeout(() => setBounds(map.getBounds()), 900);
  }, [trigger, map, lat, lng, setBounds]);

  return null;
}

import { useOSM } from "@/hooks/useOSM";
import { OSMMarker } from "./markers/OSMMarker";



function LiveMapContent() {
  const {
    location,
    zoom,
    setZoom,
    recenterTrigger,
    followUser,
    setFollowUser,
    isInteracting,
    setIsInteracting,
    toasts,
    filteredUsers,
    filteredHotspots,
    activeRoute,
    connectionFailed,
    myUserId,
    handle,
    myAvatarUrl,
    vibeEmoji,
    profile,
    setSelectedUser,
  } = useMapContext();
  
  const [bounds, setBoundsRaw] = useState<any>(null);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setBounds = useCallback((newBounds: any) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      setBoundsRaw(newBounds);
    }, 150);
  }, []);
  const osmPlaces = useOSM(bounds, zoom);

  // Calculate dispersion of markers to prevent overlapping
  const dispersedMarkers = useMemo(() => {
    if (!location) return [];

    const list: Array<{
      key: string;
      type: "me" | "user" | "hotspot";
      originalLat: number;
      originalLng: number;
      lat: number;
      lng: number;
      raw: any;
    }> = [];

    const userHostingHotspot = (userId: string) => {
      return filteredHotspots.some(h => h.host_id === userId);
    };

    if (!userHostingHotspot(myUserId)) {
      list.push({
        key: "me",
        type: "me",
        originalLat: location.lat,
        originalLng: location.lng,
        lat: location.lat,
        lng: location.lng,
        raw: {
          user_id: myUserId,
          username: handle,
          avatar_url: myAvatarUrl,
          vibeEmoji: vibeEmoji,
          lat: location.lat,
          lng: location.lng,
          bio: profile?.bio || "",
          selectedTags: profile?.selectedTags || [],
          gender: profile?.gender || "",
          age: profile?.age || "",
        },
      });
    }

    filteredUsers.forEach((u, idx) => {
      if (!userHostingHotspot(u.user_id)) {
        list.push({
          key: `user-${u.user_id || idx}`,
          type: "user",
          originalLat: u.lat,
          originalLng: u.lng,
          lat: u.lat,
          lng: u.lng,
          raw: u,
        });
      }
    });

    filteredHotspots.forEach((h) => {
      list.push({
        key: `hotspot-${h.id}`,
        type: "hotspot",
        originalLat: h.lat,
        originalLng: h.lng,
        lat: h.lat,
        lng: h.lng,
        raw: h,
      });
    });

    // Grouping threshold (approx 10 meters)
    const GRID_SIZE = 0.00009;
    const groups: Record<string, typeof list> = {};

    list.forEach((item) => {
      const gridLat = Math.round(item.originalLat / GRID_SIZE);
      const gridLng = Math.round(item.originalLng / GRID_SIZE);
      const groupKey = `${gridLat}_${gridLng}`;

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    // Apply radial dispersion to overlaps
    Object.values(groups).forEach((group) => {
      const N = group.length;
      if (N <= 1) return;

      const baseRadius = 0.00016; // base offset
      const zoomScale = Math.pow(2, 15 - zoom);
      const radius = baseRadius * Math.max(0.5, Math.min(2.0, zoomScale));

      group.forEach((item, index) => {
        const angle = (2 * Math.PI * index) / N;
        const offsetLat = radius * Math.sin(angle);
        const cosLat = Math.cos((item.originalLat * Math.PI) / 180);
        const offsetLng = (radius * Math.cos(angle)) / (cosLat || 1);

        item.lat = item.originalLat + offsetLat;
        item.lng = item.originalLng + offsetLng;
      });
    });

    // Render culling: only render markers within viewport + buffer
    if (bounds && bounds.pad) {
      const paddedBounds = bounds.pad(0.3); // 30% padding for smooth panning
      return list.filter(item => paddedBounds.contains([item.lat, item.lng]));
    }

    return list;
  }, [filteredUsers, filteredHotspots, location?.lat, location?.lng, zoom, bounds]);

  if (!location) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 z-[9999] p-6 text-center select-none">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-zinc-100 mb-6"
        >
          <Compass className="w-8 h-8 text-black animate-[spin_3s_linear_infinite]" />
        </motion.div>
        <h2 className="text-lg font-black text-zinc-900 tracking-tight text-center px-6">
          Calibrating Radar & GPS...
        </h2>
        <p className="text-xs font-semibold text-zinc-500 mt-3 text-center max-w-xs px-6 leading-relaxed">
          Please keep your device location / GPS turned on, and click "Allow" if the browser requests location access.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pb-16">
      <AnimatePresence>
        {connectionFailed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 right-4 z-[999] md:max-w-md md:mx-auto bg-amber-50/95 backdrop-blur-md border border-amber-200 rounded-2xl p-3.5 shadow-md flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-800 font-bold">
              ⚠️
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-amber-900 leading-tight">Connection Issue</h4>
              <p className="text-[10px] text-amber-700/90 font-medium mt-0.5 leading-normal">
                Reconnecting to live sync server. Check your internet connection.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" />
        <MapController
          lat={location.lat}
          lng={location.lng}
          trigger={recenterTrigger}
          followUser={followUser}
          setFollowUser={setFollowUser}
          setZoom={setZoom}
          setIsInteracting={setIsInteracting}
          setBounds={setBounds}
        />

        {dispersedMarkers.map((item) => {
          if (item.type === "me" || item.type === "user") {
            return <UserMarker key={item.key} item={item as any} />;
          } else if (item.type === "hotspot") {
            return <HotspotMarker key={item.key} item={item as any} />;
          }
          return null;
        })}

        {osmPlaces.map((place) => (
          <OSMMarker key={place.id} place={place} />
        ))}

        {activeRoute && activeRoute.coordinates && (
          <>
            <Polyline
              positions={activeRoute.coordinates}
              color="#000000"
              weight={10}
              opacity={0.15}
            />
            <Polyline
              positions={activeRoute.coordinates}
              color="#f43f5e"
              weight={6}
              opacity={0.8}
            />
            <Polyline
              positions={activeRoute.coordinates}
              color="#ffffff"
              weight={2.5}
              opacity={0.95}
              dashArray="6, 8"
            />
          </>
        )}
      </MapContainer>

      {/* Overlays */}
      <AnimatePresence>
        {!isInteracting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-[400]"
          >
            <VibeFilterBar />
            <FloatingControls />
            <RouteHUD />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drawers & Modals */}
      <IntentModal osmPlaces={osmPlaces} />
      <HotspotDrawer />
      <UserDrawer />
      <SpaceDrawer />
      


      {/* Toast Notifications */}
      <div className="fixed top-20 left-0 right-0 z-[1000] flex flex-col items-center gap-2 pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ y: -20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              className={`px-5 py-3 rounded-full shadow-xl text-sm font-bold flex items-center gap-2 pointer-events-auto ${
                toast.type === "wave" ? "bg-emerald-500 text-white" : toast.type === "request" ? "bg-black text-white" : "bg-white text-zinc-900 border border-zinc-200"
              }`}
            >
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function LiveMap() {
  return <LiveMapContent />;
}
