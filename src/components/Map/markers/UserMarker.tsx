"use client";

import { useEffect, useState, useRef, memo } from "react";
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
  isWaving: boolean = false,
  isBroadcasting: boolean = false
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
          background: ${isBroadcasting ? '#e11d48' : 'white'};
          color: ${isBroadcasting ? 'white' : 'inherit'};
          border: 1.5px solid #e4e4e7;
          display:flex; align-items:center; justify-content:center;
          font-size:${Math.round(isBroadcasting ? 8 * scale : 10 * scale)}px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
          z-index: 20;
        ">${isBroadcasting ? '🎙️' : vibeEmoji}</div>
        ${isBroadcasting ? `
        <div style="
          position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);
          width:${size}px; height:${size}px; border-radius:50%;
          border: 2px solid #e11d48;
          animation: noirme-ripple-anim 1.5s infinite ease-out;
          will-change: transform, opacity;
          backface-visibility: hidden;
          z-index: -1;
        "></div>
        <div style="
          position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);
          width:${size}px; height:${size}px; border-radius:50%;
          border: 2px solid #e11d48;
          animation: noirme-ripple-anim 1.5s infinite ease-out;
          animation-delay: 0.5s;
          will-change: transform, opacity;
          backface-visibility: hidden;
          z-index: -1;
        "></div>
        <style>
          @keyframes noirme-ripple-anim {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
          }
        </style>
        ` : ""}
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
  isWaving: boolean = false,
  isBroadcasting: boolean = false
) {
  const key = `${userId}_${avatarUrl}_${vibeEmoji}_${isMe ? "me" : "them"}_${zoom}_${isWaving ? "waving" : "static"}_${isBroadcasting ? "mic" : "nomic"}`;
  if (avatarIconCache.has(key)) {
    return avatarIconCache.get(key)!;
  }
  if (avatarIconCache.size >= 800) {
    const keysToDelete = Array.from(avatarIconCache.keys()).slice(0, 200);
    keysToDelete.forEach((k) => avatarIconCache.delete(k));
  }
  const icon = createAvatarMarkerIconRaw(avatarUrl, vibeEmoji, isMe, zoom, userId, isWaving, isBroadcasting);
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
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (position[0] !== targetPosRef.current[0] || position[1] !== targetPosRef.current[1]) {
      startPosRef.current = currentPos;
      targetPosRef.current = position;
      startTimeRef.current = performance.now();

      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const duration = 400; // 400ms transition time
        const t = Math.min(1, elapsed / duration);
        const ease = t * (2 - t); // ease-out quadratic

        const nextLat = startPosRef.current[0] + (targetPosRef.current[0] - startPosRef.current[0]) * ease;
        const nextLng = startPosRef.current[1] + (targetPosRef.current[1] - startPosRef.current[1]) * ease;

        setCurrentPos([nextLat, nextLng]);

        if (t < 1) {
          animIdRef.current = requestAnimationFrame(animate);
        } else {
          animIdRef.current = null;
        }
      };

      animIdRef.current = requestAnimationFrame(animate);
    }
  }, [position]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, []);

  return (
    <Marker position={currentPos} icon={icon} eventHandlers={eventHandlers} zIndexOffset={zIndexOffset}>
      {children}
    </Marker>
  );
}

interface MemoizedUserMarkerProps {
  type: "me" | "user";
  lat: number;
  lng: number;
  zoom: number;
  myAvatarUrl: string;
  vibeEmoji: string;
  myUserId: string;
  isWaving: boolean;
  isBroadcasting: boolean;
  rawUser?: any;
  onClick?: () => void;
}

const MemoizedUserMarkerComponent = ({
  type,
  lat,
  lng,
  zoom,
  myAvatarUrl,
  vibeEmoji,
  myUserId,
  isWaving,
  isBroadcasting,
  rawUser,
  onClick,
}: MemoizedUserMarkerProps) => {
  if (type === "me") {
    return (
      <Marker
        position={[lat, lng]}
        icon={createAvatarMarkerIcon(myAvatarUrl, vibeEmoji, true, zoom, myUserId, false, isBroadcasting)}
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

  const av = rawUser.avatar_url || getAvatarUrl(rawUser.username || "user");

  return (
    <SmoothMarker
      position={[lat, lng]}
      icon={createAvatarMarkerIcon(av, rawUser.vibeEmoji || "🙂", false, zoom, rawUser.user_id, isWaving, isBroadcasting)}
      zIndexOffset={500}
      eventHandlers={{
        click: onClick,
      }}
    />
  );
};

const MemoizedUserMarker = memo(
  MemoizedUserMarkerComponent,
  (prev, next) => {
    return (
      prev.type === next.type &&
      prev.lat === next.lat &&
      prev.lng === next.lng &&
      prev.zoom === next.zoom &&
      prev.myAvatarUrl === next.myAvatarUrl &&
      prev.vibeEmoji === next.vibeEmoji &&
      prev.myUserId === next.myUserId &&
      prev.isWaving === next.isWaving &&
      prev.isBroadcasting === next.isBroadcasting &&
      prev.rawUser?.user_id === next.rawUser?.user_id &&
      prev.rawUser?.vibeEmoji === next.rawUser?.vibeEmoji &&
      prev.rawUser?.is_broadcasting_audio === next.rawUser?.is_broadcasting_audio
    );
  }
);

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
  const { zoom, myAvatarUrl, vibeEmoji, myUserId, activeWaves, setSelectedUser, isBroadcastingAudio } = useMapContext();

  const isWaving = item.type === "user" && activeWaves.some((w) => w.sender_id === item.raw?.user_id);
  const isBroadcasting = item.type === "me" ? isBroadcastingAudio : !!item.raw?.is_broadcasting_audio;

  return (
    <MemoizedUserMarker
      type={item.type}
      lat={item.lat}
      lng={item.lng}
      zoom={zoom}
      myAvatarUrl={myAvatarUrl}
      vibeEmoji={vibeEmoji}
      myUserId={myUserId}
      isWaving={isWaving}
      isBroadcasting={isBroadcasting}
      rawUser={item.raw}
      onClick={() => {
        if (item.type === "user" && item.raw) {
          setSelectedUser(item.raw);
        }
      }}
    />
  );
}
