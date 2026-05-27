"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth, getAvatarUrl } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Compass,
  Loader2,
  Shield,
  X,
  MapPin,
  MessageSquare,
  Users,
  LogOut,
  Trash2,
  Lock,
} from "lucide-react";

delete (L.Icon.Default.prototype as any)._getIconUrl;

const VIBE_FILTERS = [
  { label: "All", key: "all" },
  { label: "Café ☕", key: "cafe" },
  { label: "Study 📚", key: "study" },
  { label: "Music 🎵", key: "music" },
  { label: "Sports 🏃", key: "sports" },
];

const INTENT_SUGGESTIONS = [
  "Need a chai buddy ☕",
  "Anyone up for a walk? 🚶",
  "Study partner needed 📚",
  "Guitar jam session 🎸",
  "Boba run 🧋",
  "Midnight ramen? 🍜",
  "Gym buddy 🏋️",
  "Coding together? 💻",
];

const FALLBACK = { lat: 28.6139, lng: 77.209 }; // New Delhi fallback

function MapController({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
  }, [lat, lng, trigger, map]);
  return null;
}

// Helper to calculate distance in km using Haversine formula
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

// Creates a circular avatar marker using an img element
function createAvatarMarkerIcon(avatarUrl: string, vibeEmoji: string, isMe: boolean) {
  const ring = isMe ? "#000000" : "#e4e4e7";
  const shadow = isMe
    ? "0 0 0 3px #000, 0 4px 16px rgba(0,0,0,0.25)"
    : "0 2px 12px rgba(0,0,0,0.15)";

  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative; width:44px; height:44px;">
        <div style="
          width:44px; height:44px; border-radius:50%;
          border: 2.5px solid ${ring};
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
          width:18px; height:18px; border-radius:50%;
          background:white;
          border: 1.5px solid #e4e4e7;
          display:flex; align-items:center; justify-content:center;
          font-size:10px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.1);
        ">${vibeEmoji}</div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26],
  });
}

// Creates a beautiful pulsing hotspot room marker icon
function createHotspotMarkerIcon(avatarUrl: string, vibeEmoji: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative; width:46px; height:46px; display:flex; align-items:center; justify-content:center;">
        <!-- Pulsing ring effect -->
        <div style="
          position:absolute;
          width:44px;
          height:44px;
          border-radius:50%;
          border: 2px solid #000;
          opacity: 0.8;
          animation: pulse 1.8s infinite ease-in-out;
          z-index: 0;
        "></div>
        <div style="
          position:relative;
          width:38px;
          height:38px;
          border-radius:50%;
          border: 2.5px solid #000000;
          box-shadow: 0 3px 10px rgba(0,0,0,0.15);
          overflow: hidden;
          background: #ffffff;
          cursor: pointer;
          z-index: 1;
        ">
          <img
            src="${avatarUrl}"
            style="width:100%; height:100%; object-fit:cover;"
            onerror="this.style.display='none'"
          />
        </div>
        <div style="
          position:absolute; bottom:0px; right:0px;
          width:16px; height:16px; border-radius:50%;
          background:white;
          border: 1px solid #000000;
          display:flex; align-items:center; justify-content:center;
          font-size:9px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          z-index: 2;
        ">${vibeEmoji}</div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(0.85); opacity: 0.8; }
          100% { transform: scale(1.25); opacity: 0; }
        }
      </style>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -24],
  });
}

function matchesFilter(intent: any, key: string): boolean {
  if (key === "all") return true;
  const t = (intent.title || "").toLowerCase();
  if (key === "cafe")
    return ["coffee", "chai", "boba", "tea", "ramen", "food", "eat", "matcha", "latte"].some((k) =>
      t.includes(k)
    );
  if (key === "study")
    return ["study", "code", "coding", "book", "exam", "learn", "grind"].some((k) => t.includes(k));
  if (key === "music")
    return ["guitar", "jam", "music", "vinyl", "sing", "beat", "lofi"].some((k) => t.includes(k));
  if (key === "sports")
    return ["gym", "run", "walk", "bike", "swim", "sport", "workout", "yoga"].some((k) =>
      t.includes(k)
    );
  return true;
}

export default function LiveMap() {
  const { isSignedIn, user, profile, isLoading } = useAuth();

  const [location, setLocation] = useState<{ lat: number; lng: number }>(FALLBACK);
  const [locStatus, setLocStatus] = useState<"waiting" | "granted" | "denied">("waiting");
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const [socketReady, setSocketReady] = useState(false);

  const [selectedFilter, setSelectedFilter] = useState("all");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [intentText, setIntentText] = useState("");

  // Drawer States
  const [selectedHotspot, _setSelectedHotspot] = useState<any | null>(null);
  const selectedHotspotRef = useRef<any | null>(null);

  const setSelectedHotspot = (val: any) => {
    if (typeof val === "function") {
      const nextVal = val(selectedHotspotRef.current);
      selectedHotspotRef.current = nextVal;
      _setSelectedHotspot(nextVal);
    } else {
      selectedHotspotRef.current = val;
      _setSelectedHotspot(val);
    }
  };

  const maskLocation = profile?.maskLocation ?? true;
  const vibeEmoji = profile?.vibeEmoji ?? "☕";
  const handle = profile?.handle ?? user?.username ?? "";
  const myAvatarUrl =
    profile?.avatar_url || (user ? getAvatarUrl(user.username) : getAvatarUrl("anon"));

  // — Get location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const offset = maskLocation ? 0.0018 : 0;
        setLocation({
          lat: pos.coords.latitude + (Math.random() - 0.5) * offset,
          lng: pos.coords.longitude + (Math.random() - 0.5) * offset,
        });
        setLocStatus("granted");
      },
      () => {
        setLocStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30000 }
    );
  }, [maskLocation]);

  // ── WebSocket: connect on mount, no location required to start ─────────────
  useEffect(() => {
    // Start connecting immediately — location is sent once available
    if (!location) return;

    let mounted = true;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Build an anonymous stable ID if not signed in
    let anonId = typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null;
    if (!anonId && typeof window !== "undefined") {
      anonId = `anon_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("noirme_anon_id", anonId!);
    }
    const finalAnonId = anonId || "anon";

    // Snapshot identity at connection time (no stale closures)
    const userId = user?.id || user?.username || finalAnonId;
    const uHandle = profile?.handle || user?.username || "Anon";
    const uEmoji = profile?.vibeEmoji || "☕";
    const uAvatar =
      profile?.avatar_url || (user ? getAvatarUrl(user.username) : getAvatarUrl(finalAnonId));
    const uLat = location.lat;
    const uLng = location.lng;

    const connect = () => {
      if (!mounted) return;

      let wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (!wsUrl) {
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          wsUrl = `ws://localhost:3001`;
        } else {
          const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
          wsUrl = `${proto}//${window.location.host}`;
        }
      }

      console.log(`[noirme] Connecting to WebSocket: ${wsUrl}`);
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        setSocketReady(true);
        ws!.send(
          JSON.stringify({
            type: "location_update",
            user_id: userId,
            username: uHandle,
            vibeEmoji: uEmoji,
            avatar_url: uAvatar,
            lat: uLat,
            lng: uLng,
          })
        );
      };

      ws.onmessage = (ev) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(ev.data);

          if (msg.type === "sync") {
            setActiveUsers(msg.users.filter((u: any) => u.user_id !== userId));
            setIntents(msg.hotspots || []);
          } else if (msg.type === "location_update") {
            if (msg.data.user_id !== userId) {
              setActiveUsers((prev) => {
                const idx = prev.findIndex((u) => u.user_id === msg.data.user_id);
                if (idx >= 0) {
                  const n = [...prev];
                  n[idx] = msg.data;
                  return n;
                }
                return [...prev, msg.data];
              });
            }
          } else if (msg.type === "hotspots_list") {
            setIntents(msg.hotspots || []);

            // Keep selected hotspot updated in real-time
            if (selectedHotspotRef.current) {
              const updated = msg.hotspots.find(
                (h: any) => h.id === selectedHotspotRef.current?.id
              );
              if (updated) {
                setSelectedHotspot(updated);
              } else {
                // Hotspot deleted / host closed it
                setSelectedHotspot(null);
              }
            }
          } else if (msg.type === "hotspot_created") {
            // Automatically open the drawer for the newly created room
            setSelectedHotspot(msg.hotspot);
          } else if (msg.type === "join_request_received") {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
              setSelectedHotspot(msg.hotspot);
            }
          } else if (msg.type === "join_response") {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
              setSelectedHotspot(msg.hotspot);
            }
          } else if (msg.type === "room_sync") {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
              setSelectedHotspot(msg.hotspot);
            }
          } else if (msg.type === "new_message") {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
              setSelectedHotspot((prev: any) => {
                if (!prev) return null;
                if (prev.messages.some((m: any) => m.id === msg.message.id)) return prev;
                return {
                  ...prev,
                  messages: [...prev.messages, msg.message],
                };
              });
            }
          } else if (msg.type === "user_disconnected") {
            setActiveUsers((prev) => prev.filter((u) => u.user_id !== msg.user_id));
          }
        } catch (e) {
          console.error("[noirme] Msg parse error:", e);
        }
      };

      ws.onerror = () => {};

      ws.onclose = () => {
        if (!mounted) return;
        setSocketReady(false);
        socketRef.current = null;
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      socketRef.current = null;
      setSocketReady(false);
    };
  }, [
    !!location,
    user?.username,
    profile?.avatar_url,
    profile?.handle,
    profile?.vibeEmoji,
    maskLocation,
  ]);

  const postIntent = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !intentText.trim() || !location) return;
    const userId =
      user?.id ||
      user?.username ||
      (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
      "anon";
    ws.send(
      JSON.stringify({
        type: "create_hotspot",
        user_id: userId,
        username: handle,
        avatar_url: myAvatarUrl,
        vibeEmoji: vibeEmoji,
        title: intentText.trim(),
        lat: location.lat,
        lng: location.lng,
      })
    );
    setIntentText("");
    setShowIntentModal(false);
  };

  const requestJoin = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedHotspot) return;
    const userId =
      user?.id ||
      user?.username ||
      (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
      "anon";
    ws.send(
      JSON.stringify({
        type: "request_join",
        roomId: selectedHotspot.id,
        user_id: userId,
        username: handle,
        avatar_url: myAvatarUrl,
      })
    );
  };

  const respondRequest = (guestId: string, status: "accepted" | "declined") => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedHotspot) return;
    ws.send(
      JSON.stringify({
        type: "respond_join",
        roomId: selectedHotspot.id,
        guestId,
        status,
      })
    );
  };

  const sendMessage = (text: string) => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedHotspot || !text.trim()) return;
    const userId =
      user?.id ||
      user?.username ||
      (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
      "anon";
    ws.send(
      JSON.stringify({
        type: "send_message",
        roomId: selectedHotspot.id,
        text: text.trim(),
        sender_id: userId,
        sender_username: handle,
        sender_avatar: myAvatarUrl,
      })
    );
  };

  const leaveHotspot = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !selectedHotspot) return;
    const userId =
      user?.id ||
      user?.username ||
      (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
      "anon";
    ws.send(
      JSON.stringify({
        type: "leave_hotspot",
        roomId: selectedHotspot.id,
        user_id: userId,
      })
    );
    setSelectedHotspot(null);
  };

  const refreshRadar = () => {
    // 1. Recenter map
    setRecenterTrigger((t) => t + 1);

    // 2. Fetch latest geolocation and update coordinate on socket server
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const offset = maskLocation ? 0.0018 : 0;
          const newCoords = {
            lat: pos.coords.latitude + (Math.random() - 0.5) * offset,
            lng: pos.coords.longitude + (Math.random() - 0.5) * offset,
          };
          setLocation(newCoords);
          setLocStatus("granted");

          const ws = socketRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            const userId =
              user?.id ||
              user?.username ||
              (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
              "anon";
            ws.send(
              JSON.stringify({
                type: "location_update",
                user_id: userId,
                username: handle,
                vibeEmoji: vibeEmoji,
                avatar_url: myAvatarUrl,
                lat: newCoords.lat,
                lng: newCoords.lng,
              })
            );
          }
        },
        () => {
          setLocStatus("denied");
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 10000 }
      );
    }

    // 3. Request fresh sync from socket server
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "request_sync" }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white gap-4 px-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-350" />
        <p className="text-xs text-zinc-400 font-semibold">Loading map…</p>
      </div>
    );
  }

  // Filter nearby users (within 10km)
  const filteredUsers = activeUsers.filter((u) => {
    return getDistanceKm(location.lat, location.lng, u.lat, u.lng) <= 10;
  });

  // Filter nearby active hotspots (within 10km)
  const filteredHotspots = intents.filter((h) => {
    const isWithinRange = getDistanceKm(location.lat, location.lng, h.lat, h.lng) <= 10;
    const isNotExpired = h.expires_at > Date.now();
    const isMatchesFilter = matchesFilter(h, selectedFilter);
    return isWithinRange && isNotExpired && isMatchesFilter;
  });

  // Check my guest/host status for the selected room
  const myUserId =
    user?.id ||
    user?.username ||
    (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
    "anon";
  const isHost = selectedHotspot?.host_id === myUserId;
  const myRequest = selectedHotspot?.requests?.find((r: any) => r.user_id === myUserId);
  const guestStatus = myRequest ? myRequest.status : "none"; // 'pending' | 'accepted' | 'declined' | 'none'

  // Distance computation for the open drawer
  const distance = selectedHotspot
    ? getDistanceKm(location.lat, location.lng, selectedHotspot.lat, selectedHotspot.lng)
    : null;
  const distanceStr =
    distance !== null ? (distance < 0.1 ? "Here" : `${distance.toFixed(1)} km away`) : "";

  return (
    // Keep absolute inset-0 but give it padding bottom to avoid drawing behind BottomNav
    <div className="absolute inset-0 pb-16">
      {/* MAP */}
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        />
        <MapController lat={location.lat} lng={location.lng} trigger={recenterTrigger} />

        {/* Me */}
        <Marker
          position={[location.lat, location.lng]}
          icon={createAvatarMarkerIcon(myAvatarUrl, vibeEmoji, true)}
        >
          <Popup>
            <div className="flex items-center gap-2.5 p-2.5 pr-7 bg-white">
              <img
                src={myAvatarUrl}
                className="w-9 h-9 rounded-full object-cover bg-zinc-50 border border-zinc-100"
                alt="you"
              />
              <div>
                <p className="font-bold text-xs text-zinc-900">{handle}</p>
                <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Shield size={9} /> {maskLocation ? "Location masked" : "Exact location"}
                </p>
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Nearby Users */}
        {filteredUsers.map((u, idx) => {
          const av = u.avatar_url || getAvatarUrl(u.username || "user");
          return (
            <Marker
              key={u.user_id || idx}
              position={[u.lat, u.lng]}
              icon={createAvatarMarkerIcon(av, u.vibeEmoji || "🙂", false)}
            >
              <Popup>
                <div className="flex items-center gap-2.5 p-2.5 pr-7 bg-white">
                  <img
                    src={av}
                    className="w-9 h-9 rounded-full object-cover bg-zinc-50 border border-zinc-100"
                    alt={u.username}
                  />
                  <div>
                    <p className="font-bold text-xs text-zinc-900">{u.username}</p>
                    <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">● Online now</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Hotspots */}
        {filteredHotspots.map((hotspot) => {
          const av = hotspot.host_avatar || getAvatarUrl(hotspot.host_username);
          return (
            <Marker
              key={hotspot.id}
              position={[hotspot.lat, hotspot.lng]}
              icon={createHotspotMarkerIcon(av, hotspot.vibeEmoji || "☕")}
              eventHandlers={{
                click: () => {
                  setSelectedHotspot(hotspot);
                },
              }}
            />
          );
        })}
      </MapContainer>

      {/* ─── OVERLAYS ─── */}

      {/* Top status bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-zinc-200 shadow-sm">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              socketReady ? "bg-emerald-500 animate-pulse" : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[10px] font-bold tracking-widest text-zinc-600">
            {socketReady ? "LIVE" : "CONNECTING…"}
          </span>
          {socketReady && (
            <span className="text-[9px] font-semibold text-zinc-400 border-l border-zinc-200 pl-2">
              {filteredUsers.length === 0
                ? "You're first here"
                : `${filteredUsers.length} nearby`}
            </span>
          )}
        </div>

        <button
          onClick={refreshRadar}
          className="w-10 h-10 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors active:scale-90"
          title="Refresh Radar"
        >
          <Compass size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Vibe Filters */}
      <div className="absolute top-[72px] left-4 right-4 z-[400]">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {VIBE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setSelectedFilter(f.key)}
              className={`px-3.5 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all duration-150 ${
                selectedFilter === f.key
                  ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                  : "bg-white/95 border-zinc-200 text-zinc-600 shadow-sm"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>



      {/* FAB (above navbar) */}
      {isSignedIn && (
        <div className="absolute bottom-20 right-5 z-[400]">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowIntentModal(true)}
            className="w-14 h-14 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black transition-colors"
          >
            <Send className="w-5 h-5" strokeWidth={2} />
          </motion.button>
        </div>
      )}

      {/* ─── INTENT MODAL ─── */}
      <AnimatePresence>
        {showIntentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/30 backdrop-blur-[2px]"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIntentModal(false);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-lg bg-white rounded-t-[28px] shadow-2xl"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-zinc-200" />
              </div>

              <div className="px-5 pt-2 pb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-zinc-900">Post Hotspot Intent</h3>
                  <button
                    onClick={() => setShowIntentModal(false)}
                    className="p-1.5 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  Post what you are doing. Nearby people within 10km will see your pulsing avatar and
                  can request to join.
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {INTENT_SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => setIntentText(s)}
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${
                        intentText === s
                          ? "bg-zinc-900 border-zinc-900 text-white"
                          : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <input
                  autoFocus
                  type="text"
                  value={intentText}
                  onChange={(e) => setIntentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && postIntent()}
                  placeholder="Or type your own..."
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors mb-4"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowIntentModal(false)}
                    className="flex-1 py-3.5 rounded-xl bg-zinc-100 text-zinc-600 font-semibold text-sm hover:bg-zinc-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={postIntent}
                    disabled={!intentText.trim() || !socketReady}
                    className="flex-1 py-3.5 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-40 hover:bg-black transition-colors"
                  >
                    Create Hotspot
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── HOTSPOT ROOM BOTTOM DRAWER ─── */}
      <AnimatePresence>
        {selectedHotspot && (
          <motion.div
            initial={{ y: "100%", opacity: 0.95 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            className="fixed bottom-16 left-4 right-4 z-[900] max-w-lg mx-auto bg-white rounded-3xl border border-zinc-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1 bg-white">
              <div className="w-10 h-1 rounded-full bg-zinc-200" />
            </div>

            <div className="px-5 pb-6 bg-white max-h-[70vh] overflow-y-auto scrollbar-none">
              {/* Header Info */}
              <div className="flex justify-between items-start gap-3 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={
                        selectedHotspot.host_avatar ||
                        getAvatarUrl(selectedHotspot.host_username)
                      }
                      className="w-12 h-12 rounded-full object-cover border border-zinc-100 bg-zinc-50"
                      alt={selectedHotspot.host_username}
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-xs shadow-sm">
                      {selectedHotspot.vibeEmoji}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      {isHost ? "Your Hotspot" : `Hosted by @${selectedHotspot.host_username}`}
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900 leading-tight">
                      {selectedHotspot.title}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1 flex items-center gap-1 font-semibold">
                      <MapPin size={10} /> {distanceStr}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedHotspot(null)}
                  className="p-1.5 rounded-full bg-zinc-50 text-zinc-450 hover:text-zinc-650 hover:bg-zinc-100 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Host vs Guest Views */}
              {isHost ? (
                <div className="mt-4 flex flex-col gap-4">
                  {/* Requests */}
                  <div>
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Users size={12} /> Join Requests
                    </h4>
                    {selectedHotspot.requests.filter((r: any) => r.status === "pending").length ===
                    0 ? (
                      <p className="text-[11px] text-zinc-400 bg-zinc-50 rounded-2xl p-4 text-center border border-dashed border-zinc-100">
                        Waiting for nearby requests to join...
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-[140px] overflow-y-auto pr-1">
                        {selectedHotspot.requests
                          .filter((r: any) => r.status === "pending")
                          .map((r: any) => (
                            <div
                              key={r.user_id}
                              className="flex justify-between items-center bg-zinc-50 border border-zinc-100 rounded-2xl p-3"
                            >
                              <div className="flex items-center gap-2.5">
                                <img
                                  src={r.avatar_url}
                                  className="w-8 h-8 rounded-full border border-zinc-200"
                                  alt={r.username}
                                />
                                <span className="text-xs font-semibold text-zinc-800">
                                  @{r.username}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => respondRequest(r.user_id, "accepted")}
                                  className="px-3.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-black text-white text-[10px] font-bold transition-all active:scale-95 shadow-sm"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => respondRequest(r.user_id, "declined")}
                                  className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-300 text-zinc-650 text-[10px] font-bold transition-all active:scale-95"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Members */}
                  <div>
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                      Members (
                      {selectedHotspot.requests.filter((r: any) => r.status === "accepted").length}
                      )
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedHotspot.requests
                        .filter((r: any) => r.status === "accepted")
                        .map((r: any) => (
                          <div
                            key={r.user_id}
                            className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200/50 rounded-full pl-1.5 pr-3 py-1 text-[10px] font-semibold text-zinc-750"
                          >
                            <img
                              src={r.avatar_url}
                              className="w-5 h-5 rounded-full object-cover"
                              alt={r.username}
                            />
                            {r.user_id === myUserId ? "You (Host)" : `@${r.username}`}
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Chat */}
                  <div className="border-t border-zinc-100 pt-4">
                    <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <MessageSquare size={12} /> Live Chat
                    </h4>
                    <ChatRoom
                      messages={selectedHotspot.messages}
                      myUserId={myUserId}
                      onSendMessage={sendMessage}
                    />
                  </div>

                  <button
                    onClick={leaveHotspot}
                    className="mt-2 w-full py-3.5 rounded-2xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <Trash2 size={13} /> Delete Hotspot Room
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-4">
                  {guestStatus === "none" && (
                    <div className="flex flex-col gap-4 text-center py-4">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                        <Lock size={18} strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-800">Locked Room Chat</p>
                        <p className="text-[11px] text-zinc-450 max-w-[280px] mx-auto mt-1 leading-relaxed">
                          Request to join the hotspot. Once approved by the host, you'll join the
                          private group chat to coordinate.
                        </p>
                      </div>
                      <button
                        onClick={requestJoin}
                        className="w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
                      >
                        Request to Join Room
                      </button>
                    </div>
                  )}

                  {guestStatus === "pending" && (
                    <div className="flex flex-col gap-4 text-center py-5">
                      <motion.div
                        animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ repeat: Infinity, duration: 1.8 }}
                        className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center mx-auto text-zinc-400"
                      >
                        <Loader2 className="animate-spin text-zinc-400" size={18} strokeWidth={1.5} />
                      </motion.div>
                      <div>
                        <p className="text-xs font-bold text-zinc-800">Request Pending Approval</p>
                        <p className="text-[11px] text-zinc-400 max-w-[280px] mx-auto mt-1 leading-relaxed">
                          We notified the host. Hang tight! They will approve your request shortly.
                        </p>
                      </div>
                      <button
                        onClick={leaveHotspot}
                        className="w-full py-3 rounded-2xl border border-zinc-250 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        Cancel Request
                      </button>
                    </div>
                  )}

                  {guestStatus === "declined" && (
                    <div className="flex flex-col gap-4 text-center py-4">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto text-rose-500">
                        <X size={18} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-850">Request Declined</p>
                        <p className="text-[11px] text-zinc-400 max-w-[280px] mx-auto mt-1 leading-relaxed">
                          Your request to join this hotspot was declined by the host. Explore other
                          hotspots nearby!
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedHotspot(null)}
                        className="w-full py-3 rounded-2xl bg-zinc-100 text-zinc-650 hover:bg-zinc-200 text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        Close
                      </button>
                    </div>
                  )}

                  {guestStatus === "accepted" && (
                    <div className="flex flex-col gap-4">
                      {/* Members */}
                      <div>
                        <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                          Members (
                          {
                            selectedHotspot.requests.filter((r: any) => r.status === "accepted")
                              .length
                          }
                          )
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedHotspot.requests
                            .filter((r: any) => r.status === "accepted")
                            .map((r: any) => (
                              <div
                                key={r.user_id}
                                className="flex items-center gap-1.5 bg-zinc-100 border border-zinc-200/50 rounded-full pl-1.5 pr-3 py-1 text-[10px] font-semibold text-zinc-750"
                              >
                                <img
                                  src={r.avatar_url}
                                  className="w-5 h-5 rounded-full object-cover"
                                  alt={r.username}
                                />
                                {r.user_id === myUserId ? "You" : `@${r.username}`}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* Chat */}
                      <div className="border-t border-zinc-100 pt-4">
                        <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <MessageSquare size={12} /> Room Chat
                        </h4>
                        <ChatRoom
                          messages={selectedHotspot.messages}
                          myUserId={myUserId}
                          onSendMessage={sendMessage}
                        />
                      </div>

                      <button
                        onClick={leaveHotspot}
                        className="mt-2 w-full py-3 rounded-2xl border border-zinc-200 text-zinc-500 hover:text-rose-600 hover:bg-rose-50/50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                      >
                        <LogOut size={13} /> Leave Hotspot Room
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper ChatRoom Component
function ChatRoom({
  messages,
  myUserId,
  onSendMessage,
}: {
  messages: any[];
  myUserId: string;
  onSendMessage: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text);
    setText("");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Messages */}
      <div className="h-[180px] overflow-y-auto border border-zinc-100 bg-zinc-50/50 rounded-2xl p-3 flex flex-col gap-2.5 scrollbar-none">
        {messages.length === 0 ? (
          <p className="text-[11px] text-zinc-400 text-center my-auto font-medium">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === myUserId;
            return (
              <div
                key={m.id}
                className={`flex gap-2 max-w-[85%] ${
                  isMe ? "self-end flex-row-reverse" : "self-start"
                }`}
              >
                {!isMe && (
                  <img
                    src={m.sender_avatar}
                    className="w-6 h-6 rounded-full border border-zinc-200 mt-0.5 shrink-0 object-cover"
                    alt={m.sender_username}
                  />
                )}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {!isMe && (
                    <span className="text-[8px] font-bold text-zinc-400 ml-1 mb-0.5">
                      @{m.sender_username}
                    </span>
                  )}
                  <div
                    className={`px-3.5 py-2 text-xs leading-normal shadow-sm ${
                      isMe
                        ? "bg-zinc-900 text-white rounded-2xl rounded-tr-none font-medium"
                        : "bg-white border border-zinc-200/60 text-zinc-800 rounded-2xl rounded-tl-none font-medium"
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[7px] text-zinc-400 mt-0.5 px-1 font-semibold">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type message..."
          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-450 focus:outline-none focus:border-zinc-400 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="px-4 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
