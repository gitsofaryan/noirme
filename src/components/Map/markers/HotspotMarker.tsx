"use client";

import L from "leaflet";
import { useMapContext } from "../MapProvider";
import { getAvatarUrl } from "@/hooks/useAuth";
import { SmoothMarker } from "./UserMarker";

const hotspotIconCache = new Map<string, L.DivIcon>();

function createHotspotMarkerIconRaw(avatarUrl: string, vibeEmoji: string, zoom: number, title: string) {
  const baseSize = 46;
  const scale = Math.max(0.3, Math.min(1.4, Math.pow(1.15, zoom - 15)));
  const size = Math.round(baseSize * scale);
  const coreSize = Math.round(36 * scale);
  const auraSize = Math.round(zoom <= 13 ? 60 * scale : 52 * scale);
  const rotatingRingSize = Math.round(zoom <= 13 ? 50 * scale : 44 * scale);
  const emojiSize = Math.round(18 * scale);

  const escapedTitle = (title || "")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
        <!-- Thinking cloud -->
        <div class="thinking-cloud" style="
          position: absolute;
          bottom: ${size + 4}px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 5;
          pointer-events: none;
        ">
          <!-- Main Cloud bubble -->
          <div style="
            background: #ffffff;
            border: 2px solid #000000;
            border-radius: ${Math.round(14 * scale)}px;
            padding: ${Math.round(4 * scale)}px ${Math.round(8 * scale)}px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.12);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: ${Math.round(8 * scale)}px;
            font-weight: 800;
            color: #000000;
            white-space: nowrap;
            max-width: ${Math.round(100 * scale)}px;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
            z-index: 2;
          ">
            ${escapedTitle}
          </div>

          <!-- Thinking cloud trail (circles) -->
          <div style="
            position: relative;
            width: 100%;
            height: ${Math.round(10 * scale)}px;
            margin-top: -1px;
            z-index: 1;
          ">
            <!-- Bubble 1 -->
            <div style="
              position: absolute;
              width: ${Math.round(6 * scale)}px;
              height: ${Math.round(6 * scale)}px;
              border-radius: 50%;
              border: 1.5px solid #000;
              background: #fff;
              top: -${Math.round(1 * scale)}px;
              left: 54%;
              transform: translateX(-50%);
            "></div>
            <!-- Bubble 2 -->
            <div style="
              position: absolute;
              width: ${Math.round(4 * scale)}px;
              height: ${Math.round(4 * scale)}px;
              border-radius: 50%;
              border: 1.5px solid #000;
              background: #fff;
              top: ${Math.round(3 * scale)}px;
              left: 49%;
              transform: translateX(-50%);
            "></div>
            <!-- Bubble 3 -->
            <div style="
              position: absolute;
              width: ${Math.round(2 * scale)}px;
              height: ${Math.round(2 * scale)}px;
              border-radius: 50%;
              border: 1px solid #000;
              background: #fff;
              top: ${Math.round(7 * scale)}px;
              left: 45%;
              transform: translateX(-50%);
            "></div>
          </div>
        </div>

        <!-- Glowing aura -->
        <div style="
          position:absolute;
          width:${auraSize}px;
          height:${auraSize}px;
          border-radius:50%;
          background: radial-gradient(circle, rgba(255,235,59,0.4) 0%, rgba(255,193,7,0) 70%);
          animation: glow 2.5s infinite alternate ease-in-out;
          z-index: 0;
        "></div>
        
        <!-- Outer pulse ring for low-zoom distinction -->
        <div style="
          position:absolute;
          width:${rotatingRingSize}px;
          height:${rotatingRingSize}px;
          border-radius:50%;
          box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7);
          animation: pulse-ring 2s infinite ease-in-out;
          z-index: 1;
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
        @keyframes pulse-ring {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 193, 7, 0.7); }
          70% { transform: scale(1.2); box-shadow: 0 0 0 12px rgba(255, 193, 7, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 193, 7, 0); }
        }
      </style>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 2],
  });
}

function createHotspotMarkerIcon(avatarUrl: string, vibeEmoji: string, zoom: number, hotspotId: string = "default", title: string = "") {
  const key = `${hotspotId}_${avatarUrl}_${vibeEmoji}_${zoom}_${title}`;
  if (hotspotIconCache.has(key)) {
    return hotspotIconCache.get(key)!;
  }
  if (hotspotIconCache.size >= 800) {
    const keysToDelete = Array.from(hotspotIconCache.keys()).slice(0, 200);
    keysToDelete.forEach((k) => hotspotIconCache.delete(k));
  }
  const icon = createHotspotMarkerIconRaw(avatarUrl, vibeEmoji, zoom, title);
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
      icon={createHotspotMarkerIcon(av, hotspot.vibeEmoji || "☕", zoom, hotspot.id, hotspot.title)}
      zIndexOffset={1000}
      eventHandlers={{
        click: () => {
          setSelectedHotspot(hotspot);
        },
      }}
    />
  );
}
