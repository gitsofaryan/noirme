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
  Bell,
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

function MapController({
  lat,
  lng,
  trigger,
  followUser,
  setFollowUser,
  setZoom,
  setIsInteracting,
}: {
  lat: number;
  lng: number;
  trigger: number;
  followUser: boolean;
  setFollowUser: (val: boolean) => void;
  setZoom: (val: number) => void;
  setIsInteracting: (val: boolean) => void;
}) {
  const map = useMap();

  useEffect(() => {
    (window as any).leafletMap = map;
    return () => {
      delete (window as any).leafletMap;
    };
  }, [map]);

  // Update zoom state initially and on zoom events
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

  // Interaction handlers
  useEffect(() => {
    const onMoveStart = () => setIsInteracting(true);
    const onMoveEnd = () => setIsInteracting(false);
    const onDragStart = () => {
      setFollowUser(false);
      setIsInteracting(true);
    };
    const onDragEnd = () => setIsInteracting(false);

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

  // flyTo on trigger change (recenter compass click)
  useEffect(() => {
    map.flyTo([lat, lng], map.getZoom(), { animate: true, duration: 0.8 });
  }, [trigger, map, lat, lng]);

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
function createAvatarMarkerIcon(avatarUrl: string, vibeEmoji: string, isMe: boolean, zoom: number, userId: string = "default", isWaving: boolean = false) {
  const baseSize = isMe ? 48 : 44;
  // Scale size based on zoom Level (Reference point: zoom 15)
  const scale = Math.max(0.3, Math.min(1.4, Math.pow(1.15, zoom - 15)));
  const size = Math.round(baseSize * scale);
  const emojiSize = Math.round(18 * scale);
  const ringSize = Math.max(1, Math.round(2.5 * scale));

  // Use a simple hash of the userId to pick a consistent color for that user
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

// Creates a beautiful pulsing hotspot room marker icon
function createHotspotMarkerIcon(avatarUrl: string, vibeEmoji: string, zoom: number) {
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

export default function LiveMap() {
  const { isSignedIn, user, profile, isLoading, blockUser } = useAuth();

  const myUserId =
    user?.id ||
    user?.username ||
    (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
    "anon";
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [hasWaved, setHasWaved] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const [activeWaves, setActiveWaves] = useState<{ sender_id: string; expires_at: number }[]>([]);
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "default" | "wave" }[]>([]);
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: number; read: boolean }[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const addToast = (message: string, type: "default" | "wave" = "default") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    setHasWaved(false);
    setConfirmBlock(false);
  }, [selectedUser]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveWaves((prev) => prev.filter((w) => w.expires_at > now));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleWave = () => {
    if (!selectedUser) return;
    setHasWaved(true);
    addToast(`You waved at ${selectedUser.username}`);
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "send_wave",
          target_user_id: selectedUser.user_id,
          sender_id: myUserId,
          sender_username: handle,
        })
      );
    }
  };

  const [localBlocks, setLocalBlocks] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("noirme_local_blocks") || "[]");
      } catch {
        return [];
      }
    }
    return [];
  });

  // Sync with local storage events (for unblocking from profile page)
  useEffect(() => {
    const syncBlocks = () => {
      try {
        const local = JSON.parse(localStorage.getItem("noirme_local_blocks") || "[]");
        setLocalBlocks(local);
      } catch (e) { }
    };
    window.addEventListener("storage", syncBlocks);
    return () => window.removeEventListener("storage", syncBlocks);
  }, []);

  const [zoom, setZoom] = useState(15);
  const handleBlock = async (userId: string) => {
    await blockUser(userId);
    const newBlocks = [...localBlocks, userId];
    setLocalBlocks(newBlocks);
    localStorage.setItem("noirme_local_blocks", JSON.stringify(newBlocks));
    setSelectedUser(null);
  };
  const locationOffsetRef = useRef<{ latOffset: number; lngOffset: number } | null>(null);

  const getStableOffset = () => {
    if (!locationOffsetRef.current) {
      locationOffsetRef.current = {
        latOffset: (Math.random() - 0.5) * 0.0018,
        lngOffset: (Math.random() - 0.5) * 0.0018,
      };
    }
    return locationOffsetRef.current;
  };

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(() => {
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

  // Save successfully retrieved location to cache
  useEffect(() => {
    if (location && location.lat && location.lng) {
      localStorage.setItem("noirme_last_location", JSON.stringify(location));
    }
  }, [location?.lat, location?.lng]);

  const [locStatus, setLocStatus] = useState<"waiting" | "granted" | "denied">("waiting");
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const [socketReady, setSocketReady] = useState(false);

  const [selectedFilter, setSelectedFilter] = useState("all");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [followUser, setFollowUser] = useState(true);
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [isInteracting, setIsInteracting] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);

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

  // Sync selected user drawer with real-time active users updates
  // NOTE: Only depend on activeUsers — use a ref for selectedUser to avoid infinite loop
  const selectedUserRef = useRef<any>(null);
  selectedUserRef.current = selectedUser;
  useEffect(() => {
    const current = selectedUserRef.current;
    if (!current) return;
    const latest = activeUsers.find((u) => u.user_id === current.user_id);
    if (latest) {
      // Only update if data actually changed
      if (
        latest.age !== current.age ||
        latest.gender !== current.gender ||
        latest.bio !== current.bio ||
        latest.vibeEmoji !== current.vibeEmoji ||
        latest.avatar_url !== current.avatar_url ||
        latest.username !== current.username ||
        JSON.stringify(latest.selectedTags) !== JSON.stringify(current.selectedTags)
      ) {
        setSelectedUser(latest);
      }
    } else {
      setSelectedUser(null);
    }
  }, [activeUsers]);

  const maskLocation = profile?.maskLocation ?? true;
  const vibeEmoji = profile?.vibeEmoji ?? "☕";
  const handle = profile?.handle ?? user?.username ?? "";
  const myAvatarUrl =
    profile?.avatar_url || (user ? getAvatarUrl(user.username) : getAvatarUrl("anon"));

  // — Get and watch location with race (IP location + high-accuracy live watchPosition fallback)
  useEffect(() => {
    let finished = false;

    // Fast IP Geolocation fallback so map is never collapsed
    getIPLocation()
      .then((ipLoc) => {
        if (!finished && ipLoc) {
          const offset = maskLocation ? getStableOffset() : { latOffset: 0, lngOffset: 0 };
          const newLat = ipLoc.lat + offset.latOffset;
          const newLng = ipLoc.lng + offset.lngOffset;
          setLocation((prev) => {
            if (!prev) return { lat: newLat, lng: newLng };
            const dist = getDistanceKm(prev.lat, prev.lng, newLat, newLng);
            if (dist > 0.003) {
              return { lat: newLat, lng: newLng };
            }
            return prev;
          });
          setLocStatus("granted");
        }
      })
      .catch((err) => {
        console.warn("IP Geolocation mount error:", err);
      });

    if (!navigator.geolocation) {
      return;
    }

    // Fast OS-level cached location for near-instant map loading
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!finished) {
          const offset = maskLocation ? getStableOffset() : { latOffset: 0, lngOffset: 0 };
          const newLat = pos.coords.latitude + offset.latOffset;
          const newLng = pos.coords.longitude + offset.lngOffset;
          setLocation({ lat: newLat, lng: newLng });
          setLocStatus("granted");
        }
      },
      () => { }, // Ignore errors, watchPosition will handle it
      { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        finished = true;
        const offset = maskLocation ? getStableOffset() : { latOffset: 0, lngOffset: 0 };
        const newLat = pos.coords.latitude + offset.latOffset;
        const newLng = pos.coords.longitude + offset.lngOffset;

        setLocation((prev) => {
          if (!prev) return { lat: newLat, lng: newLng };
          const dist = getDistanceKm(prev.lat, prev.lng, newLat, newLng);
          // Update only if moved more than 3 meters (0.003 km) to filter out GPS drift
          if (dist > 0.003) {
            return { lat: newLat, lng: newLng };
          }
          return prev;
        });
        setLocStatus("granted");
      },
      () => {
        finished = true;
        // Don't override if IP geolocation already succeeded
        setLocStatus((prev) => (prev === "granted" ? "granted" : "denied"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [maskLocation]);

  // ── WebSocket: connect once, stay connected ─────────────────────────────────
  // Only reconnect when identity changes (user login/logout), NOT on profile edits
  useEffect(() => {
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
    const userId = user?.id || user?.username || finalAnonId;

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
                // New user joined!
                setNotifications(prevNotifs => [
                  {
                    id: Math.random().toString(36).substring(7),
                    text: `@${msg.data.username} is now nearby`,
                    time: Date.now(),
                    read: false
                  },
                  ...prevNotifs
                ].slice(0, 5));
                return [...prev, msg.data];
              });
            }
          } else if (msg.type === "hotspots_list") {
            setIntents(msg.hotspots || []);

            if (selectedHotspotRef.current) {
              const updated = msg.hotspots.find(
                (h: any) => h.id === selectedHotspotRef.current?.id
              );
              if (updated) {
                setSelectedHotspot(updated);
              } else {
                setSelectedHotspot(null);
              }
            }
          } else if (msg.type === "hotspot_created") {
            setSelectedHotspot(msg.hotspot);
          } else if (msg.type === "join_request_received") {
            setNotifications(prev => [
              { id: Math.random().toString(36).substring(7), text: `@${msg.username} wants to join your hotspot`, time: Date.now(), read: false },
              ...prev
            ].slice(0, 5));
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
          } else if (msg.type === "wave_received") {
            addToast(`👋 ${msg.sender_username} waved at you!`, "wave");
            setNotifications(prev => [
              { id: Math.random().toString(36).substring(7), text: `@${msg.sender_username} waved at you!`, time: Date.now(), read: false },
              ...prev
            ].slice(0, 5));
            setActiveWaves((prev) => [
              ...prev.filter((w) => w.sender_id !== msg.sender_id),
              { sender_id: msg.sender_id, expires_at: Date.now() + 10000 },
            ]);
          } else if (msg.type === "user_disconnected") {
            setActiveUsers((prev) => prev.filter((u) => u.user_id !== msg.user_id));
          }
        } catch (e) {
          console.error("[noirme] Msg parse error:", e);
        }
      };

      ws.onerror = () => { };

      ws.onclose = () => {
        if (!mounted) return;
        setSocketReady(false);
        socketRef.current = null;
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    const handleUnload = () => {
      if (ws) ws.close();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", handleUnload);
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
      socketRef.current = null;
      setSocketReady(false);
    };
    // Only reconnect on identity change — NOT on profile edits
  }, [!!location, user?.username, maskLocation]);

  // Send location + profile update to WebSocket whenever anything changes
  // This does NOT tear down the connection — it just sends a message
  useEffect(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !location) return;
    const finalAnonId = typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : "anon";
    const userId = user?.id || user?.username || finalAnonId || "anon";
    ws.send(
      JSON.stringify({
        type: "location_update",
        user_id: userId,
        username: handle,
        vibeEmoji: vibeEmoji,
        avatar_url: myAvatarUrl,
        lat: location.lat,
        lng: location.lng,
        bio: profile?.bio || "",
        selectedTags: profile?.selectedTags || [],
        gender: profile?.gender || "",
        age: profile?.age || "",
        blockedUsers: [...(profile?.blockedUsers || []), ...localBlocks],
      })
    );
  }, [
    location?.lat,
    location?.lng,
    socketReady,
    handle,
    vibeEmoji,
    myAvatarUrl,
    profile?.bio,
    profile?.selectedTags,
    profile?.gender,
    profile?.age,
    profile?.blockedUsers,
    localBlocks,
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
        host_bio: profile?.bio || "",
        host_tags: profile?.selectedTags || [],
        host_gender: profile?.gender || "",
        host_age: profile?.age || undefined,
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
    // 1. Enable follow user and recenter
    setFollowUser(true);
    setRecenterTrigger((t) => t + 1);

    let finished = false;

    // 2. Fetch fast IP location
    getIPLocation()
      .then((ipLoc) => {
        if (!finished && ipLoc) {
          const offset = maskLocation ? getStableOffset() : { latOffset: 0, lngOffset: 0 };
          const newCoords = {
            lat: ipLoc.lat + offset.latOffset,
            lng: ipLoc.lng + offset.lngOffset,
          };
          setLocation(newCoords);
          setLocStatus("granted");
        }
      })
      .catch((err) => console.warn("IP location error on refresh:", err));

    // 3. Fetch browser location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          finished = true;
          const offset = maskLocation ? getStableOffset() : { latOffset: 0, lngOffset: 0 };
          const newCoords = {
            lat: pos.coords.latitude + offset.latOffset,
            lng: pos.coords.longitude + offset.lngOffset,
          };
          setLocation(newCoords);
          setLocStatus("granted");
        },
        () => {
          finished = true;
          // If browser geo failed or permission denied, request sync anyway using current location
          const ws = socketRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "request_sync" }));
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      finished = true;
      // Request sync anyway
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "request_sync" }));
      }
    }
  };

  if (!location) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 z-[9999]">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center border-4 border-zinc-100 mb-6"
        >
          <Compass className="w-8 h-8 text-black animate-[spin_3s_linear_infinite]" />
        </motion.div>
        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Locating you...</h2>
        <p className="text-sm font-semibold text-zinc-500 mt-2">Finding nearby users</p>
      </div>
    );
  }

  // Filter nearby users (within 10km)
  const filteredUsers = activeUsers.filter((u) => {
    const blockedIds = [...(profile?.blockedUsers || []), ...localBlocks];
    const isBlocked = blockedIds.includes(u.user_id) || (u.blockedUsers || []).includes(myUserId);
    const isWithinRange = getDistanceKm(location.lat, location.lng, u.lat, u.lng) <= 10;
    return !isBlocked && isWithinRange;
  });

  // Filter nearby active hotspots (within 10km)
  const filteredHotspots = intents.filter((h) => {
    const blockedIds = [...(profile?.blockedUsers || []), ...localBlocks];
    const isBlocked = blockedIds.includes(h.host_id);
    const isWithinRange = getDistanceKm(location.lat, location.lng, h.lat, h.lng) <= 10;
    const isNotExpired = h.expires_at > Date.now();
    const isMatchesFilter = matchesFilter(h, selectedFilter);
    return !isBlocked && isWithinRange && isNotExpired && isMatchesFilter;
  });

  // Check my guest/host status for the selected room
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
        <MapController
          lat={location.lat}
          lng={location.lng}
          trigger={recenterTrigger}
          followUser={followUser}
          setFollowUser={setFollowUser}
          setZoom={setZoom}
          setIsInteracting={setIsInteracting}
        />

        {/* Me */}
        <Marker
          position={[location.lat, location.lng]}
          icon={createAvatarMarkerIcon(myAvatarUrl, vibeEmoji, true, zoom, user?.id || "me")}
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
          const isWaving = activeWaves.some((w) => w.sender_id === u.user_id);
          return (
            <Marker
              key={u.user_id || idx}
              position={[u.lat, u.lng]}
              icon={createAvatarMarkerIcon(av, u.vibeEmoji || "🙂", false, zoom, u.user_id, isWaving)}
              eventHandlers={{
                click: () => {
                  setSelectedUser(u);
                },
              }}
            />
          );
        })}

        {/* Hotspots */}
        {filteredHotspots.map((hotspot) => {
          const av = hotspot.host_avatar || getAvatarUrl(hotspot.host_username);
          return (
            <Marker
              key={hotspot.id}
              position={[hotspot.lat, hotspot.lng]}
              icon={createHotspotMarkerIcon(av, hotspot.vibeEmoji || "☕", zoom)}
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
      <AnimatePresence>
        {!isInteracting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-0 z-[400]"
          >
            {/* Vibe Filters */}
            <div className="pointer-events-auto absolute top-4 left-4 right-4">
              <div className="flex gap-2 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-0.5">
                {VIBE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setSelectedFilter(f.key)}
                    className={`px-3.5 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all duration-150 ${selectedFilter === f.key
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                      : "bg-white/95 border-zinc-200 text-zinc-600 shadow-sm"
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pointer-events-auto absolute top-[72px] left-4 flex flex-col gap-2">
              {/* Zoom Controls */}
              <div className="flex flex-col bg-white/95 backdrop-blur-sm rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <button
                  onClick={() => {
                    const map = (window as any).leafletMap;
                    if (map) map.setZoom(map.getZoom() + 1);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 border-b border-zinc-100 transition-colors font-bold text-lg"
                >
                  +
                </button>
                <button
                  onClick={() => {
                    const map = (window as any).leafletMap;
                    if (map) map.setZoom(map.getZoom() - 1);
                  }}
                  className="w-9 h-9 flex items-center justify-center text-zinc-600 hover:bg-zinc-50 transition-colors font-bold text-lg"
                >
                  −
                </button>
              </div>

              {/* Nearby Count */}
              <div className="flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-zinc-200 shadow-sm self-start">
                <span className="text-[11px] font-bold text-zinc-900 leading-none">
                  {filteredUsers.length}
                </span>
              </div>
            </div>

            {/* Notifications (Top Right) */}
            <div className="pointer-events-auto absolute top-[72px] right-4">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative w-9 h-9 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-full border border-zinc-200 shadow-sm text-zinc-600 hover:text-zinc-900 transition-colors"
              >
                <Bell size={18} />
                {notifications.some((n) => !n.read) && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
                )}
              </button>

              <AnimatePresence>
                {showNotifDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">Recent Activity</span>
                      <button
                        onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                        className="text-[10px] text-zinc-400 font-bold hover:text-zinc-900"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-[11px] font-medium text-zinc-400">No recent activity</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0">
                            <p className="text-[11px] font-medium text-zinc-800 leading-tight">{n.text}</p>
                            <p className="text-[9px] text-zinc-400 mt-1 uppercase font-bold tracking-tighter">
                              {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Action Buttons (Compass + FAB) */}
            <div className="pointer-events-auto absolute bottom-20 right-5 flex flex-col items-center gap-4">
              {/* Refresh Compass */}
              <button
                onClick={refreshRadar}
                className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md border border-zinc-200 shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors active:scale-90"
                title="Refresh Radar"
              >
                <Compass size={22} strokeWidth={2.5} />
              </button>

              {/* Post Intent Button */}
              {isSignedIn && (
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => setShowIntentModal(true)}
                  className="w-14 h-14 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black transition-colors"
                >
                  <Send className="w-6 h-6" strokeWidth={2} />
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <h3 className="text-lg font-bold text-zinc-900">Post Intent</h3>
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
                      className={`px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors ${intentText === s
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
                    <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                      {selectedHotspot.host_age ? `${selectedHotspot.host_age} y/o` : "Age not shared"} · {selectedHotspot.host_gender || "Gender not shared"}
                    </p>
                    <p className="text-[10px] text-zinc-450 mt-1 flex items-center gap-1 font-bold">
                      <MapPin size={10} className="text-zinc-400" /> {distanceStr}
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

              {/* Host Profile Info */}
              {!isHost && (
                <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-3.5 space-y-2.5 mt-3 mb-1">
                  <div className="space-y-1">
                    <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">About Host</h4>
                    <p className="text-xs text-zinc-700 leading-relaxed font-medium">
                      {selectedHotspot.host_bio || "No tagline set."}
                    </p>
                  </div>
                  {selectedHotspot.host_tags && selectedHotspot.host_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedHotspot.host_tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 bg-white border border-zinc-200/60 rounded-full text-[9px] font-semibold text-zinc-550"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                      userLocation={location}
                      hotspotTitle={selectedHotspot.title}
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
                          userLocation={location}
                          hotspotTitle={selectedHotspot.title}
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

      {/* ─── USER PROFILE DETAILS BOTTOM DRAWER ─── */}
      <AnimatePresence>
        {selectedUser && (
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

            <div className="px-5 pb-6 bg-white max-h-[70vh] overflow-y-auto scrollbar-none space-y-4">
              {/* Header Info */}
              <div className="flex justify-between items-start gap-3 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={selectedUser.avatar_url || getAvatarUrl(selectedUser.username)}
                      className="w-14 h-14 rounded-full object-cover border border-zinc-150 bg-zinc-50"
                      alt={selectedUser.username}
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-sm shadow-sm">
                      {selectedUser.vibeEmoji || "🙂"}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 leading-tight">
                      {selectedUser.username}
                    </h3>
                    <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                      {selectedUser.age ? `${selectedUser.age} y/o` : "Age not shared"} · {selectedUser.gender || "Gender not shared"}
                    </p>
                    <p className="text-[10px] text-zinc-450 mt-1 flex items-center gap-1 font-bold">
                      <MapPin size={10} className="text-zinc-400" />
                      {(() => {
                        const dist = getDistanceKm(location.lat, location.lng, selectedUser.lat, selectedUser.lng);
                        return dist < 0.1 ? "Here" : `${dist.toFixed(1)} km away`;
                      })()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-1.5 rounded-full bg-zinc-50 text-zinc-450 hover:text-zinc-650 hover:bg-zinc-100 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Tagline / Bio */}
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Tagline</h4>
                <p className="text-xs text-zinc-700 leading-relaxed font-medium bg-zinc-50 rounded-2xl p-4 border border-zinc-100">
                  {selectedUser.bio || "No tagline set."}
                </p>
              </div>

              {/* Interests / Tags */}
              {selectedUser.selectedTags && selectedUser.selectedTags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Interests</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.selectedTags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-3 py-1.5 bg-zinc-100 rounded-full text-[10px] font-semibold text-zinc-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    if (confirmBlock) {
                      handleBlock(selectedUser.user_id);
                    } else {
                      setConfirmBlock(true);
                    }
                  }}
                  className={`flex-1 py-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${confirmBlock
                    ? "border-rose-650 bg-rose-650 text-white hover:bg-rose-700"
                    : "border-rose-200 hover:bg-rose-50 text-rose-650"
                    }`}
                >
                  {confirmBlock ? "Confirm Block?" : "Block / Report"}
                </button>

                <button
                  onClick={handleWave}
                  disabled={hasWaved}
                  className={`flex-1 py-3.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${hasWaved
                    ? "bg-emerald-500 text-white"
                    : "bg-zinc-900 text-white hover:bg-black active:scale-[0.98]"
                    }`}
                >
                  {hasWaved ? "Waved! 👋" : "Wave 👋"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOASTS CONTAINER */}
      <div className="fixed top-20 left-0 right-0 z-[1000] flex flex-col items-center gap-2 pointer-events-none px-4">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ y: -20, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.9 }}
              className={`px-5 py-3 rounded-full shadow-lg text-sm font-bold flex items-center gap-2 pointer-events-auto ${toast.type === "wave" ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white"
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

// Helper ChatRoom Component
function ChatRoom({
  messages,
  myUserId,
  onSendMessage,
  userLocation,
  hotspotTitle,
}: {
  messages: any[];
  myUserId: string;
  onSendMessage: (text: string) => void;
  userLocation: { lat: number; lng: number };
  hotspotTitle: string;
}) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text);
    setText("");
  };

  const handleCopySOS = () => {
    const sosMsg = `🚨 [SOS Alert] I am meeting someone for Noirme hotspot "${hotspotTitle}". My current location is: https://maps.google.com/?q=${userLocation.lat},${userLocation.lng} (Coordinates: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)})`;
    navigator.clipboard.writeText(sosMsg);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Safety SOS Banner */}
      <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-3 text-zinc-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">🛡️</span>
            <span className="text-[11px] font-bold text-amber-900">Physical Meetup Safety</span>
          </div>
          <button
            onClick={() => setShowSafety(!showSafety)}
            className="text-[10px] font-semibold text-amber-800 underline hover:text-amber-900"
          >
            {showSafety ? "Hide Tips" : "Show Tips & SOS"}
          </button>
        </div>

        {showSafety && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2.5 pt-2.5 border-t border-amber-200/40 space-y-2 text-[10px] text-amber-950 font-medium"
          >
            <ul className="list-disc pl-3.5 space-y-1">
              <li>Meet in a busy, well-lit public space.</li>
              <li>Share this location and meetup details with a trusted friend.</li>
              <li>Keep your phone charged and in your hand.</li>
              <li>If you feel unsafe at any point, walk away immediately.</li>
            </ul>
            <button
              onClick={handleCopySOS}
              className={`w-full mt-2 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-[0.98] ${copiedCoords
                ? "bg-emerald-600 text-white"
                : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
            >
              {copiedCoords ? "✓ SOS Info Copied to Clipboard!" : "🚨 Copy SOS Coordinates & Details"}
            </button>
          </motion.div>
        )}
      </div>

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
                className={`flex gap-2 max-w-[85%] ${isMe ? "self-end flex-row-reverse" : "self-start"
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
                    className={`px-3.5 py-2 text-xs leading-normal shadow-sm ${isMe
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
