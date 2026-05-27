"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useAuth, getAvatarUrl } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Compass, Loader2, Shield, X, MapPin } from "lucide-react";

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

function MapController({ lat, lng, trigger }: { lat: number; lng: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { animate: true, duration: 0.8 });
  }, [lat, lng, trigger, map]);
  return null;
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

function createIntentDotIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:10px; height:10px; border-radius:50%;
        background:#ef4444;
        border:2px solid white;
        box-shadow: 0 0 8px rgba(239,68,68,0.5), 0 2px 6px rgba(0,0,0,0.15);
      "></div>
    `,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    popupAnchor: [0, -8],
  });
}

function matchesFilter(intent: any, key: string): boolean {
  if (key === "all") return true;
  const t = (intent.title || "").toLowerCase();
  if (key === "cafe") return ["coffee", "chai", "boba", "tea", "ramen", "food", "eat", "matcha", "latte"].some(k => t.includes(k));
  if (key === "study") return ["study", "code", "coding", "book", "exam", "learn", "grind"].some(k => t.includes(k));
  if (key === "music") return ["guitar", "jam", "music", "vinyl", "sing", "beat", "lofi"].some(k => t.includes(k));
  if (key === "sports") return ["gym", "run", "walk", "bike", "swim", "sport", "workout", "yoga"].some(k => t.includes(k));
  return true;
}

export default function LiveMap() {
  const { isSignedIn, user, profile, isLoading } = useAuth();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const [socketReady, setSocketReady] = useState(false);

  const [selectedFilter, setSelectedFilter] = useState("all");
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [intentText, setIntentText] = useState("");

  const maskLocation = profile?.maskLocation ?? true;
  const vibeEmoji = profile?.vibeEmoji ?? "☕";
  const handle = profile?.handle ?? user?.username ?? "";
  const myAvatarUrl = profile?.avatar_url || (user ? getAvatarUrl(user.username) : "");

  // — Get location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 28.6139, lng: 77.209 });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const offset = maskLocation ? 0.0018 : 0;
        setLocation({
          lat: pos.coords.latitude + (Math.random() - 0.5) * offset,
          lng: pos.coords.longitude + (Math.random() - 0.5) * offset,
        });
      },
      () => setLocation({ lat: 28.6139, lng: 77.209 }),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 30000 }
    );
  }, [maskLocation]);

  // ── WebSocket: connect always (anonymous ok), retry on close ──────────────
  useEffect(() => {
    // Need location before we can broadcast position
    if (!location) return;

    let mounted = true;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Build an anonymous stable ID if not signed in
    let anonId = localStorage.getItem("noirme_anon_id");
    if (!anonId) {
      anonId = `anon_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("noirme_anon_id", anonId);
    }

    // Snapshot identity at connection time (no stale closures)
    const userId  = user?.id || user?.username || anonId;
    const uHandle = profile?.handle || user?.username || "Anon";
    const uEmoji  = profile?.vibeEmoji || "☕";
    const uAvatar = profile?.avatar_url || (user ? getAvatarUrl(user.username) : getAvatarUrl(anonId));
    const uLat    = location.lat;
    const uLng    = location.lng;

    const connect = async () => {
      if (!mounted) return;
      try {
        const res = await fetch("/api/socket");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        console.warn("[noirme] init failed, retry in 3s…", err);
        if (mounted) retryTimer = setTimeout(connect, 3000);
        return;
      }
      if (!mounted) return;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${proto}//${window.location.host}/api/socket`);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        setSocketReady(true);
        ws!.send(JSON.stringify({
          type: "location_update",
          user_id: userId, username: uHandle,
          vibeEmoji: uEmoji, avatar_url: uAvatar,
          lat: uLat, lng: uLng,
        }));
      };

      ws.onmessage = (ev) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "sync") {
            setActiveUsers(msg.users.filter((u: any) => u.user_id !== userId));
            setIntents(msg.intents || []);
          } else if (msg.type === "location_update") {
            if (msg.data.user_id !== userId) {
              setActiveUsers(prev => {
                const idx = prev.findIndex(u => u.user_id === msg.data.user_id);
                if (idx >= 0) { const n = [...prev]; n[idx] = msg.data; return n; }
                return [...prev, msg.data];
              });
            }
          } else if (msg.type === "new_intent") {
            setIntents(prev => [msg.data, ...prev]);
          } else if (msg.type === "user_disconnected") {
            setActiveUsers(prev => prev.filter(u => u.user_id !== msg.user_id));
          }
        } catch { /* ignore malformed frames */ }
      };

      ws.onerror = () => { /* onclose fires after onerror, handles retry */ };

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
  // Re-run when location first becomes available OR user signs in/out
  }, [!!location, user?.username]);

  const postIntent = () => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !intentText.trim() || !location) return;
    const userId = user?.id || user?.username || localStorage.getItem("noirme_anon_id") || "anon";
    const uHandle = profile?.handle || user?.username || "Anon";
    ws.send(JSON.stringify({
      type: "new_intent",
      user_id: userId,
      username: uHandle,
      title: intentText.trim(),
      lat: location.lat,
      lng: location.lng,
    }));
    setIntentText("");
    setShowIntentModal(false);
  };

  if (isLoading || !location) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-white gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        <p className="text-xs text-zinc-400 font-medium">{isLoading ? "Loading..." : "Getting your location..."}</p>
      </div>
    );
  }

  const filteredIntents = intents.filter(i => i.expires_at > Date.now() && matchesFilter(i, selectedFilter));

  return (
    // Full screen behind navbar (pb-16 already applied by parent)
    <div className="absolute inset-0">

      {/* MAP */}
      <MapContainer
        center={[location.lat, location.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='© <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
        />
        <MapController lat={location.lat} lng={location.lng} trigger={recenterTrigger} />

        {/* Me */}
        <Marker
          position={[location.lat, location.lng]}
          icon={createAvatarMarkerIcon(myAvatarUrl, vibeEmoji, true)}
        >
          <Popup>
            <div className="flex items-center gap-2.5 p-2.5 pr-7">
              <img src={myAvatarUrl} className="w-9 h-9 rounded-full object-cover bg-zinc-50 border border-zinc-100" alt="you" />
              <div>
                <p className="font-bold text-xs text-zinc-900">{handle}</p>
                <p className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Shield size={9} /> {maskLocation ? "Location masked" : "Exact location"}
                </p>
              </div>
            </div>
          </Popup>
        </Marker>

        {/* Others */}
        {activeUsers.map((u, i) => {
          const av = u.avatar_url || getAvatarUrl(u.username || "user");
          return (
            <Marker key={u.user_id || i} position={[u.lat, u.lng]} icon={createAvatarMarkerIcon(av, u.vibeEmoji || "🙂", false)}>
              <Popup>
                <div className="flex items-center gap-2.5 p-2.5 pr-7">
                  <img src={av} className="w-9 h-9 rounded-full object-cover bg-zinc-50 border border-zinc-100" alt={u.username} />
                  <div>
                    <p className="font-bold text-xs text-zinc-900">{u.username}</p>
                    <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">● Online now</p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Intents */}
        {filteredIntents.map((intent, i) => (
          <Marker key={intent.id || i} position={[intent.lat, intent.lng]} icon={createIntentDotIcon()}>
            <Popup>
              <div className="p-2.5 pr-7 max-w-[180px]">
                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">{intent.username}</p>
                <p className="text-xs text-zinc-900 font-semibold leading-snug">{intent.title}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* ─── OVERLAYS (z-index above map but below navbar) ─── */}

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex justify-between items-center gap-2">
        {/* Status chip */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-zinc-200 shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${socketReady ? "bg-emerald-500 animate-pulse" : "bg-amber-400 animate-pulse"}`} />
          <span className="text-[10px] font-bold tracking-widest text-zinc-600">
            {socketReady ? "LIVE" : "CONNECTING…"}
          </span>
          {socketReady && (
            <span className="text-[9px] font-semibold text-zinc-400 border-l border-zinc-200 pl-2">
              {activeUsers.length === 0 ? "You're first here" : `${activeUsers.length} nearby`}
            </span>
          )}
        </div>

        {/* Recenter */}
        <button
          onClick={() => setRecenterTrigger(t => t + 1)}
          className="w-10 h-10 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors active:scale-90"
        >
          <Compass size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Vibe Filter Chips */}
      <div className="absolute top-[72px] left-4 right-4 z-[400]">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
          {VIBE_FILTERS.map(f => (
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

      {/* Location mask notice */}
      {maskLocation && (
        <div className="absolute top-[118px] left-4 right-4 z-[400] bg-white/90 border border-zinc-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5 backdrop-blur-sm pointer-events-none shadow-sm">
          <Shield size={10} className="text-zinc-400 shrink-0" />
          <span className="text-[9px] font-semibold text-zinc-400">Approximate location active</span>
        </div>
      )}

      {/* FAB — positioned above the navbar (bottom-20 = 5rem = 80px, navbar is 64px = 4rem) */}
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

      {/* ─── INTENT MODAL — rendered as a fixed overlay to clear the navbar entirely ─── */}
      <AnimatePresence>
        {showIntentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // fixed so it covers the navbar
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/30 backdrop-blur-[2px]"
            onClick={e => { if (e.target === e.currentTarget) setShowIntentModal(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-lg bg-white rounded-t-[28px] shadow-2xl"
            >
              {/* Handle bar */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-zinc-200" />
              </div>

              <div className="px-5 pt-2 pb-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-zinc-900">Post Intent</h3>
                  <button onClick={() => setShowIntentModal(false)} className="p-1.5 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors">
                    <X size={15} />
                  </button>
                </div>

                <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                  What are you looking for? Nearby people will see this on the map for <strong className="text-zinc-600">1 hour</strong>.
                </p>

                {/* Suggestion chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {INTENT_SUGGESTIONS.slice(0, 4).map(s => (
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
                  onChange={e => setIntentText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && postIntent()}
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
                    Post to Map
                  </button>
                </div>

                {!socketReady && (
                  <p className="text-center text-[10px] text-zinc-400 mt-3 flex items-center justify-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Connecting to live feed...
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
