"use client";

import { useEffect, useRef, memo, useCallback } from "react";
import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useMapContext, useSocialContext } from "../MapProvider";
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
  // Round zoom to nearest integer to reduce cache key proliferation during smooth zoom
  const roundedZoom = Math.round(zoom);
  const key = `${userId}_${avatarUrl}_${vibeEmoji}_${isMe ? "me" : "them"}_${roundedZoom}_${isWaving ? "waving" : "static"}_${isBroadcasting ? "mic" : "nomic"}`;
  if (avatarIconCache.has(key)) {
    // LRU: move to end by re-inserting
    const icon = avatarIconCache.get(key)!;
    avatarIconCache.delete(key);
    avatarIconCache.set(key, icon);
    return icon;
  }
  if (avatarIconCache.size >= 600) {
    // Evict oldest 150 entries (LRU)
    const keysToDelete = Array.from(avatarIconCache.keys()).slice(0, 150);
    keysToDelete.forEach((k) => avatarIconCache.delete(k));
  }
  const icon = createAvatarMarkerIconRaw(avatarUrl, vibeEmoji, isMe, roundedZoom, userId, isWaving, isBroadcasting);
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
  const markerRef = useRef<any>(null);
  const targetPosRef = useRef<[number, number]>(position);
  const currentPosRef = useRef<[number, number]>(position);
  const startPosRef = useRef<[number, number]>(position);
  const startTimeRef = useRef<number>(0);
  const animIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (position[0] !== targetPosRef.current[0] || position[1] !== targetPosRef.current[1]) {
      startPosRef.current = currentPosRef.current;
      targetPosRef.current = position;
      startTimeRef.current = performance.now();

      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }

      const animate = (now: number) => {
        const elapsed = now - startTimeRef.current;
        const duration = 400;
        const t = Math.min(1, elapsed / duration);
        const ease = t * (2 - t);

        const nextLat = startPosRef.current[0] + (targetPosRef.current[0] - startPosRef.current[0]) * ease;
        const nextLng = startPosRef.current[1] + (targetPosRef.current[1] - startPosRef.current[1]) * ease;

        currentPosRef.current = [nextLat, nextLng];

        // Imperatively update the Leaflet marker — zero React re-renders
        if (markerRef.current) {
          markerRef.current.setLatLng([nextLat, nextLng]);
        }

        if (t < 1) {
          animIdRef.current = requestAnimationFrame(animate);
        } else {
          animIdRef.current = null;
        }
      };

      animIdRef.current = requestAnimationFrame(animate);
    }
  }, [position]);

  useEffect(() => {
    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, []);

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      eventHandlers={eventHandlers}
      zIndexOffset={zIndexOffset}
    >
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
        eventHandlers={{
          click: onClick,
        }}
      >
        <Popup className="cloudy-popup" closeButton={false}>
          <div className="p-4 w-48 text-center flex flex-col items-center gap-2.5 select-none font-sans">
            <div className="relative">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-zinc-900 bg-zinc-50 shadow-sm flex items-center justify-center">
                <img
                  src={myAvatarUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-xs shadow-sm">
                {vibeEmoji}
              </div>
            </div>

            <div className="space-y-0.5">
              <h4 className="text-xs font-black text-zinc-900 leading-none">You (Me)</h4>
              <p className="text-[9px] font-extrabold text-zinc-400">@{rawUser?.username || "me"}</p>
            </div>

            {rawUser?.bio && (
              <p className="text-[10px] font-semibold text-zinc-600 leading-relaxed max-w-full line-clamp-2 px-1">
                "{rawUser.bio}"
              </p>
            )}

            <div className="w-full py-1.5 px-2 bg-zinc-900/5 rounded-xl border border-zinc-900/5">
              <span className="text-[8px] font-extrabold tracking-wider uppercase text-zinc-500 leading-none flex items-center justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live & Syncing
              </span>
            </div>
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
  const { zoom, myAvatarUrl, vibeEmoji, myUserId, activeWaves, setSelectedUser, isBroadcastingAudio, setShowSpaceDrawer } = useMapContext();
  const { friends } = useSocialContext();

  const isWaving = item.type === "user" && activeWaves.some((w) => w.sender_id === item.raw?.user_id);
  const isFriend = item.type === "user" && friends.some((f) => f.user_id === item.raw?.user_id);
  const isBroadcasting = item.type === "me" 
    ? isBroadcastingAudio 
    : (isFriend ? !!item.raw?.is_broadcasting_audio : false);

  // Fix Leaflet stale closure bug by saving latest parameters in a Ref
  const onClickRef = useRef<any>(null);
  onClickRef.current = () => {
    if ((item.type === "user" || item.type === "me") && item.raw) {
      if (item.type === "me") {
        if (isBroadcastingAudio) {
          setShowSpaceDrawer(true);
        }
        // Let Leaflet Popup open naturally on me marker click—do not show UserDrawer
      } else {
        setSelectedUser(item.raw);
      }
    }
  };

  const handleMarkerClick = useCallback(() => {
    if (onClickRef.current) {
      onClickRef.current();
    }
  }, []);

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
      onClick={handleMarkerClick}
    />
  );
}
