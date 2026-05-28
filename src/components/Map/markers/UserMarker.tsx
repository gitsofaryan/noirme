"use client";

import { useEffect, useState, useRef } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useMapContext } from "../MapProvider";
import { getAvatarUrl } from "@/hooks/useAuth";

const MARKER_COLORS = [
  "#FF5733", // Coral
  "#33FF57", // Lime
  "#3357FF", // Blue
  "#F333FF", // Pink
  "#FF33A1", // Rose
  "#33FFF6", // Cyan
  "#FFBD33", // Orange
  "#8D33FF", // Purple
  "#FF3333", // Red
  "#33FFBD", // Mint
];

const avatarIconCache = new Map<string, L.DivIcon>();

function createAvatarMarkerIconRaw(
  avatarUrl: string,
  vibeEmoji: string,
  isMe: boolean,
  zoom: number,
  userId: string = "default",
  isWaving: boolean = false
) {
  const baseSize = isMe ? 48 : 44;
  const scale = Math.max(0.3, Math.min(1.4, Math.pow(1.15, zoom - 15)));
  const size = Math.round(baseSize * scale);
  const emojiSize = Math.round(18 * scale);
  const ringSize = Math.max(1, Math.round(2.5 * scale));

  const colorIndex = Math.abs(userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % MARKER_COLORS.length;
  const randomColor = MARKER_COLORS[colorIndex];

  const ring = isMe ? "#000000" : randomColor;
  const shadow = isMe
    ? `0 0 0 ${Math.round(3 * scale)}px #000, 0 4px 16px rgba(0,0,0,0.25)`
    : `0 0 0 ${Math.round(2 * scale)}px ${randomColor}, 0 2px 12px rgba(0,0,0,0.15)`;

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative; width:${size}px; height:${size}px;">
        <div style="
          width:${size}px; height:${size}px; border-radius:50%;
          border: ${ringSize}px solid ${ring};
          box-shadow: ${shadow};
          overflow: hidden;
          background: #ffffff;
          cursor: pointer;
        ">
          <img
            src="${avatarUrl}"
            style="width:100%; height:100%; object-fit:cover;"
            onerror="this.style.display='none'"
          />
        </div>
        <div style="
          position:absolute; bottom:-2px; right:-2px;
          width:${emojiSize}px; height:${emojiSize}px; border-radius:50%;
          background:white;
          border: 1.5px solid #e4e4e7;
          display:flex; align-items:center; justify-content:center;
          font-size:${Math.round(10 * scale)}px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        ">${vibeEmoji}</div>
        ${isWaving ? `
        <div style="
          position:absolute; top:-${Math.round(16 * scale)}px; right:-${Math.round(16 * scale)}px;
          font-size: ${Math.round(24 * scale)}px;
          animation: noirme-wave-anim 1.2s infinite;
          transform-origin: bottom right;
          z-index: 10;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        ">👋</div>
        <style>
          @keyframes noirme-wave-anim {
            0% { transform: rotate(0deg); }
            20% { transform: rotate(-20deg); }
            40% { transform: rotate(10deg); }
            60% { transform: rotate(-10deg); }
            80% { transform: rotate(5deg); }
            100% { transform: rotate(0deg); }
          }
        </style>
        ` : ""}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
  });
}

function createAvatarMarkerIcon(
  avatarUrl: string,
  vibeEmoji: string,
  isMe: boolean,
  zoom: number,
  userId: string = "default",
  isWaving: boolean = false
) {
  const key = `${userId}_${avatarUrl}_${vibeEmoji}_${isMe ? "me" : "them"}_${zoom}_${isWaving ? "waving" : "static"}`;
  if (avatarIconCache.has(key)) {
    return avatarIconCache.get(key)!;
  }
  if (avatarIconCache.size > 1000) {
    avatarIconCache.clear();
  }
  const icon = createAvatarMarkerIconRaw(avatarUrl, vibeEmoji, isMe, zoom, userId, isWaving);
  avatarIconCache.set(key, icon);
  return icon;
}

export function SmoothMarker({
  position,
  icon,
  eventHandlers,
  children,
  zIndexOffset,
}: {
  position: [number, number];
  icon: L.DivIcon;
  eventHandlers?: any;
  children?: React.ReactNode;
  zIndexOffset?: number;
}) {
  const [currentPos, setCurrentPos] = useState<[number, number]>(position);
  const targetPosRef = useRef<[number, number]>(position);
  const startPosRef = useRef<[number, number]>(position);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (position[0] !== targetPosRef.current[0] || position[1] !== targetPosRef.current[1]) {
      startPosRef.current = currentPos;
      targetPosRef.current = position;
      startTimeRef.current = performance.now();

      let animId: number;
      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const duration = 400; // 400ms transition time
        const t = Math.min(1, elapsed / duration);
        const ease = t * (2 - t); // ease-out quadratic

        const nextLat = startPosRef.current[0] + (targetPosRef.current[0] - startPosRef.current[0]) * ease;
        const nextLng = startPosRef.current[1] + (targetPosRef.current[1] - startPosRef.current[1]) * ease;

        setCurrentPos([nextLat, nextLng]);

        if (t < 1) {
          animId = requestAnimationFrame(animate);
        }
      };

      animId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animId);
    }
  }, [position]);

  return (
    <Marker position={currentPos} icon={icon} eventHandlers={eventHandlers} zIndexOffset={zIndexOffset}>
      {children}
    </Marker>
  );
}

interface UserMarkerProps {
  item: {
    key: string;
    type: "me" | "user";
    lat: number;
    lng: number;
    raw: any;
  };
}

export function UserMarker({ item }: UserMarkerProps) {
  const { zoom, myAvatarUrl, vibeEmoji, myUserId, activeWaves, setSelectedUser } = useMapContext();

  if (item.type === "me") {
    return (
      <Marker
        position={[item.lat, item.lng]}
        icon={createAvatarMarkerIcon(myAvatarUrl, vibeEmoji, true, zoom, myUserId)}
        zIndexOffset={500}
      >
        <Popup className="cloudy-popup">
          <div className="flex flex-col items-center justify-center p-3 px-5 text-center text-zinc-800">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-white/60 border border-white/80 shadow-sm flex items-center justify-center mb-1.5">
              <img src={myAvatarUrl} className="w-full h-full object-cover" alt="you" />
            </div>
            <p className="font-black text-sm text-zinc-900 leading-none">Me</p>
            <p className="text-[9px] font-semibold text-zinc-500/80 mt-1 uppercase tracking-wider">@{myUserId}</p>
          </div>
        </Popup>
      </Marker>
    );
  }

  const u = item.raw;
  const av = u.avatar_url || getAvatarUrl(u.username || "user");
  const isWaving = activeWaves.some((w) => w.sender_id === u.user_id);

  return (
    <SmoothMarker
      position={[item.lat, item.lng]}
      icon={createAvatarMarkerIcon(av, u.vibeEmoji || "🙂", false, zoom, u.user_id, isWaving)}
      zIndexOffset={500}
      eventHandlers={{
        click: () => {
          setSelectedUser(u);
        },
      }}
    />
  );
}
