"use client";

import L from "leaflet";
import { useMapContext } from "../MapProvider";
import { getAvatarUrl } from "@/hooks/useAuth";
import { SmoothMarker } from "./UserMarker";

const hotspotIconCache = new Map<string, L.DivIcon>();

function createHotspotMarkerIconRaw(avatarUrl: string, vibeEmoji: string, zoom: number) {
  const baseSize = 46;
  const scale = Math.max(0.3, Math.min(1.4, Math.pow(1.15, zoom - 15)));
  const size = Math.round(baseSize * scale);
  const coreSize = Math.round(36 * scale);
  const auraSize = Math.round(52 * scale);
  const rotatingRingSize = Math.round(44 * scale);
  const emojiSize = Math.round(18 * scale);

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
        <!-- Glowing aura -->
        <div style="
          position:absolute;
          width:${auraSize}px;
          height:${auraSize}px;
          border-radius:50%;
          background: radial-gradient(circle, rgba(255,235,59,0.3) 0%, rgba(255,193,7,0) 70%);
          animation: glow 2.5s infinite alternate ease-in-out;
          z-index: 0;
        "></div>
        
        <!-- Rotating ring -->
        <div style="
          position:absolute;
          width:${rotatingRingSize}px;
          height:${rotatingRingSize}px;
          border-radius:50%;
          border: 2px dashed #FFC107;
          animation: spin 8s linear infinite;
          z-index: 1;
        "></div>

        <!-- Pulsing core -->
        <div style="
          position:relative;
          width:${coreSize}px;
          height:${coreSize}px;
          border-radius:50%;
          border: 2px solid #000;
          box-shadow: 0 0 15px rgba(255,193,7,0.5);
          overflow: hidden;
          background: #ffffff;
          cursor: pointer;
          z-index: 2;
        ">
          <img
            src="${avatarUrl}"
            style="width:100%; height:100%; object-fit:cover;"
            onerror="this.style.display='none'"
          />
        </div>
        <div style="
          position:absolute; bottom:-1px; right:-1px;
          width:${emojiSize}px; height:${emojiSize}px; border-radius:50%;
          background: #FFC107;
          border: 1.5px solid #000;
          display:flex; align-items:center; justify-content:center;
          font-size:${Math.round(10 * scale)}px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.2);
          z-index: 3;
        ">${vibeEmoji}</div>
      </div>
      <style>
        @keyframes glow {
          0% { transform: scale(0.9); opacity: 0.4; }
          100% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

function createHotspotMarkerIcon(avatarUrl: string, vibeEmoji: string, zoom: number, hotspotId: string = "default") {
  const key = `${hotspotId}_${avatarUrl}_${vibeEmoji}_${zoom}`;
  if (hotspotIconCache.has(key)) {
    return hotspotIconCache.get(key)!;
  }
  if (hotspotIconCache.size > 1000) {
    hotspotIconCache.clear();
  }
  const icon = createHotspotMarkerIconRaw(avatarUrl, vibeEmoji, zoom);
  hotspotIconCache.set(key, icon);
  return icon;
}

interface HotspotMarkerProps {
  item: {
    key: string;
    type: "hotspot";
    lat: number;
    lng: number;
    raw: any;
  };
}

export function HotspotMarker({ item }: HotspotMarkerProps) {
  const { zoom, setSelectedHotspot } = useMapContext();
  const hotspot = item.raw;
  const av = hotspot.host_avatar || getAvatarUrl(hotspot.host_username);

  return (
    <SmoothMarker
      position={[item.lat, item.lng]}
      icon={createHotspotMarkerIcon(av, hotspot.vibeEmoji || "☕", zoom, hotspot.id)}
      eventHandlers={{
        click: () => {
          setSelectedHotspot(hotspot);
        },
      }}
    />
  );
}
