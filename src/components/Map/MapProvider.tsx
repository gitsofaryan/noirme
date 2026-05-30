"use client";

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useAuth, getAvatarUrl, UserProfile } from "@/hooks/useAuth";
import { useGeolocation, getDistanceKm } from "@/hooks/useGeolocation";
import { useSocket } from "@/hooks/useSocket";
import { useWebRTC } from "@/hooks/useWebRTC";
import { fetchOSRMRoute, RouteData, TransportMode } from "@/lib/routing";
import { globalEventBus } from "@/lib/eventBus";
import { ChatProvider, DirectMessage } from "./ChatProvider";
export { SocialContext, DMContext, useSocialContext, useDMContext, type SocialContextType, type DMContextType } from "./ChatProvider";


interface MapContextType {
  // Auth identity
  myUserId: string;
  handle: string;
  vibeEmoji: string;
  myAvatarUrl: string;
  localBlocks: string[];

  // Geolocation state
  location: { lat: number; lng: number } | null;
  locStatus: "waiting" | "granted" | "denied";
  isStasis: boolean;
  accuracy: number | null;
  accuracySource: "gps-high" | "gps-low" | "ip-fallback" | "offline" | "waiting";
  refreshRadar: () => void;

  // Socket state
  socketReady: boolean;
  connectionState: "connecting" | "connected" | "disconnected" | "reconnecting";
  offlineMessages: any[];
  connectionFailed: boolean;

  // Map state
  zoom: number;
  setZoom: (z: number) => void;
  recenterTrigger: number;
  followUser: boolean;
  setFollowUser: (val: boolean) => void;
  isInteracting: boolean;
  setIsInteracting: (val: boolean) => void;

  // Filter state
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;

  // Selections
  selectedUser: any | null;
  setSelectedUser: (u: any | null) => void;
  selectedHotspot: any | null;
  setSelectedHotspot: (h: any | null) => void;

  // Modal / Inputs
  showIntentModal: boolean;
  setShowIntentModal: (show: boolean) => void;
  intentText: string;
  setIntentText: (text: string) => void;
  customHotspotRange: number;
  setCustomHotspotRange: (range: number) => void;

  // Interaction feedback / flags
  hasWaved: boolean;
  setHasWaved: (waved: boolean) => void;
  confirmBlock: boolean;
  setConfirmBlock: (confirm: boolean) => void;

  // Notification and Toast streams
  toasts: Array<{ id: string; message: string; type: "default" | "wave" | "request" }>;
  addToast: (message: string, type?: "default" | "wave" | "request") => void;
  notifications: Array<{ id: string; text: string; time: number; read: boolean }>;
  setNotifications: React.Dispatch<React.SetStateAction<Array<{ id: string; text: string; time: number; read: boolean }>>>;
  showNotifDropdown: boolean;
  setShowNotifDropdown: (show: boolean) => void;
  activeWaves: Array<{ sender_id: string; expires_at: number }>;

  // Action methods
  handleWave: () => void;
  handleBlock: (userId: string) => Promise<void>;
  postIntent: (osmPlace?: any) => void;
  requestJoin: (roomId?: any) => void;
  respondRequest: (guestId: string, status: "accepted" | "declined") => void;
  sendMessage: (text: string) => void;
  leaveHotspot: () => void;

  // Filtered lists
  filteredUsers: any[];
  filteredHotspots: any[];
  activeUsers: any[];


  // Routing state
  activeRoute: RouteData | null;
  activeRouteMode: TransportMode;
  setActiveRouteMode: (mode: TransportMode) => void;
  routingTarget: { lat: number; lng: number; name: string } | null;
  setRoutingTarget: (target: { lat: number; lng: number; name: string } | null) => void;
  isLoadingRoute: boolean;
  clearActiveRoute: () => void;

  // WebRTC Live Audio
  isBroadcastingAudio: boolean;
  isSpaceHost: boolean;
  startBroadcast: (isHost?: boolean) => void;
  stopBroadcast: () => void;
  startListening: (targetUserId: string) => void;
  stopListening: (targetUserId: string) => void;
  incomingStreams: Record<string, MediaStream>;
  isSpeakerMuted: boolean;
  setIsSpeakerMuted: (muted: boolean) => void;

  // Space Controls
  speakRequests: any[];
  activeSpeakers: any[];
  activeListeners: any[];
  mySpeakStatus: "listener" | "requesting" | "speaker";
  isMutedByHost: boolean;
  isLocalMicMuted: boolean;
  requestToSpeak: (hostUserId: string) => void;
  cancelSpeakRequest: (hostUserId: string) => void;
  approveSpeaker: (speakerUserId: string, username: string, avatarUrl?: string) => void;
  declineSpeaker: (speakerUserId: string) => void;
  muteSpeaker: (speakerUserId: string) => void;
  unmuteSpeaker: (speakerUserId: string) => void;
  removeSpeaker: (speakerUserId: string) => void;
  toggleLocalMic: () => void;
  leaveSpace: (hostUserId: string) => void;
  showSpaceDrawer: boolean;
  setShowSpaceDrawer: (show: boolean) => void;
  profile: any;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, user, profile, blockUser } = useAuth();

  const [anonDetails, setAnonDetails] = useState<{ id: string; handle: string } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      let anonId = localStorage.getItem("norby_anon_id");
      let anonHandle = localStorage.getItem("norby_anon_handle");

      if (!anonId) {
        anonId = `anon_${Math.random().toString(36).substring(2, 10)}`;
        localStorage.setItem("norby_anon_id", anonId);
      }

      if (!anonHandle) {
        const adjs = ["Swift", "Silent", "Neon", "Stellar", "Lunar", "Cosmic", "Urban", "Phantom", "Retro", "Vapor", "Vibrant", "Crypto"];
        const nouns = ["Ghost", "Nomad", "Rider", "Shadow", "Seeker", "Drifter", "Pulse", "Volt", "Zenith", "Spark", "Wave", "Echo"];
        const adj = adjs[Math.floor(Math.random() * adjs.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(100 + Math.random() * 900); // 100-999
        anonHandle = `${adj}${noun}_${num}`;
        localStorage.setItem("norby_anon_handle", anonHandle);
      }

      setAnonDetails({ id: anonId, handle: anonHandle });
    }
  }, []);

  const myUserId =
    user?.id ||
    user?.username ||
    anonDetails?.id ||
    "anon";

  const handle = profile?.handle || user?.username || anonDetails?.handle || "";
  const vibeEmoji = profile?.vibeEmoji || "☕";
  const myAvatarUrl =
    profile?.avatar_url || (user ? getAvatarUrl(user.username) : getAvatarUrl("anon"));

  const [localBlocks, setLocalBlocks] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("norby_local_blocks") || "[]");
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
        const local = JSON.parse(localStorage.getItem("norby_local_blocks") || "[]");
        setLocalBlocks(local);
      } catch (e) { }
    };
    window.addEventListener("storage", syncBlocks);
    return () => window.removeEventListener("storage", syncBlocks);
  }, []);

  // UI state
  const [zoom, setZoom] = useState(15);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [followUser, setFollowUser] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedHotspot, _setSelectedHotspot] = useState<any | null>(null);
  const [showSpaceDrawer, setShowSpaceDrawer] = useState(false);
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

  const [showIntentModal, setShowIntentModal] = useState(false);
  const [intentText, setIntentText] = useState("");
  const [customHotspotRange, setCustomHotspotRange] = useState(15);

  useEffect(() => {
    if (showIntentModal) {
      setCustomHotspotRange(profile?.hotspotRange || 15);
    }
  }, [showIntentModal, profile?.hotspotRange]);

  const [hasWaved, setHasWaved] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  useEffect(() => {
    setHasWaved(false);
    setConfirmBlock(false);
  }, [selectedUser]);

  // Notifications and Toast streams
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "default" | "wave" | "request" }>>([]);
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; time: number; read: boolean }>>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [activeWaves, setActiveWaves] = useState<Array<{ sender_id: string; expires_at: number }>>([]);

  const addToast = useCallback((message: string, type: "default" | "wave" | "request" = "default") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      const next = [...prev, { id, message, type }];
      if (next.length > 3) {
        return next.slice(-3);
      }
      return next;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveWaves((prev) => prev.filter((w) => w.expires_at > now));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Geolocation
  const maskLocation = profile?.maskLocation ?? true;
  const {
    location,
    status: locStatus,
    isStasis,
    accuracy,
    accuracySource,
    refreshLocation,
  } = useGeolocation(maskLocation);

  // Sync lists from socket
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);

  // Chat states have been moved to ChatProvider
  // Routing state
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [activeRouteMode, setActiveRouteMode] = useState<TransportMode>("foot");
  const [routingTarget, setRoutingTarget] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const clearActiveRoute = useCallback(() => {
    setActiveRoute(null);
    setRoutingTarget(null);
  }, []);

  const lastFetchedLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!location || !routingTarget) {
      setActiveRoute(null);
      lastFetchedLocationRef.current = null;
      return;
    }

    // Debounce location updates: only re-fetch route if user moved >50m (0.05km)
    if (lastFetchedLocationRef.current && activeRoute) {
      const movedDist = getDistanceKm(
        location.lat,
        location.lng,
        lastFetchedLocationRef.current.lat,
        lastFetchedLocationRef.current.lng
      );
      if (movedDist < 0.05) {
        return;
      }
    }

    let active = true;
    setIsLoadingRoute(true);
    fetchOSRMRoute(location.lat, location.lng, routingTarget.lat, routingTarget.lng, activeRouteMode)
      .then((data) => {
        if (active) {
          setActiveRoute(data);
          lastFetchedLocationRef.current = { lat: location.lat, lng: location.lng };
          setIsLoadingRoute(false);
        }
      })
      .catch((err) => {
        console.error("[norby] Route fetch failed:", err);
        if (active) {
          setIsLoadingRoute(false);
          addToast("Failed to calculate route", "default");
        }
      });

    return () => {
      active = false;
    };
  }, [location?.lat, location?.lng, routingTarget, activeRouteMode]);

  // Sync selected user drawer with real-time active users updates
  const selectedUserRef = useRef<any>(null);
  selectedUserRef.current = selectedUser;
  useEffect(() => {
    const current = selectedUserRef.current;
    if (!current) return;
    const latest = activeUsers.find((u) => u.user_id === current.user_id);
    if (latest) {
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

  // Socket methods Ref to pass to WebRTC without circular dependency
  const socketMethodsRef = useRef<any>(null);

  const webRTC = useWebRTC({
    myUserId,
    myUsername: handle,
    myAvatarUrl,
    sendRtcOffer: (target, offer) => socketMethodsRef.current?.sendRtcOffer(target, offer),
    sendRtcAnswer: (target, answer) => socketMethodsRef.current?.sendRtcAnswer(target, answer),
    sendRtcIceCandidate: (target, cand) => socketMethodsRef.current?.sendRtcIceCandidate(target, cand),
  });

  useEffect(() => {
    if (webRTC.isBroadcastingAudio && webRTC.isSpaceHost) {
      setShowSpaceDrawer(true);
    } else {
      setShowSpaceDrawer(false);
    }
  }, [webRTC.isBroadcastingAudio, webRTC.isSpaceHost]);

  // Socket
  const socket = useSocket({
    userId: myUserId,
    handle,
    vibeEmoji,
    avatarUrl: myAvatarUrl,
    location,
    profile,
    localBlocks,
    isBroadcastingAudio: webRTC.isBroadcastingAudio && webRTC.isSpaceHost,
    onSync: (msg) => {
      performance.mark("sync-start");
      const userMap = new Map<string, any>();
      for (const u of msg.users) {
        if (u.user_id !== myUserId) userMap.set(u.user_id, u);
      }
      setActiveUsers(Array.from(userMap.values()));
      setIntents(msg.hotspots || []);
      
      requestAnimationFrame(() => {
        performance.mark("sync-end");
        performance.measure("norby_client_sync_render_duration", "sync-start", "sync-end");
        const measures = performance.getEntriesByName("norby_client_sync_render_duration");
        const last = measures[measures.length - 1];
        if (last && last.duration > 16) {
           console.warn(`[norby metrics] Slow render detected: ${last.duration.toFixed(2)}ms for ${msg.users.length} users`);
        }
      });
    },
    onLocationUpdate: (msg) => {
      if (msg.data.user_id !== myUserId) {
        setActiveUsers((prev) => {
          const existingUser = prev.find((u) => u.user_id === msg.data.user_id);
          const filtered = prev.filter((u) => u.user_id !== msg.data.user_id);

          if (!existingUser) {
            setNotifications((prevNotifs) =>
              [
                {
                  id: Math.random().toString(36).substring(7),
                  text: `@${msg.data.username} is now nearby`,
                  time: Date.now(),
                  read: false,
                },
                ...prevNotifs,
              ].slice(0, 5)
            );
          } else if (!existingUser.is_broadcasting_audio && msg.data.is_broadcasting_audio) {
            const isFriend = true; // Everyone nearby who speaks triggers it
            if (isFriend) {
              addToast(`🎙️ @${msg.data.username} is speaking nearby!`, "default");
              setNotifications((prevNotifs) =>
                [
                  {
                    id: Math.random().toString(36).substring(7),
                    text: `🎙️ @${msg.data.username} started an audio broadcast`,
                    time: Date.now(),
                    read: false,
                  },
                  ...prevNotifs,
                ].slice(0, 5)
              );
            }
          }
          return [...filtered, msg.data];
        });
      }
    },
    onHotspotsList: (msg) => {
      setIntents(msg.hotspots || []);
      if (selectedHotspotRef.current) {
        const updated = msg.hotspots.find((h: any) => h.id === selectedHotspotRef.current?.id);
        if (updated) {
          setSelectedHotspot(updated);
        } else {
          setSelectedHotspot(null);
        }
      }
    },
    onHotspotCreated: (msg) => {
      setSelectedHotspot(msg.hotspot);
    },
    onJoinRequestReceived: (msg) => {
      setNotifications((prev) =>
        [
          {
            id: Math.random().toString(36).substring(7),
            text: `@${msg.username} wants to join your hotspot`,
            time: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 5)
      );
      if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
        setSelectedHotspot(msg.hotspot);
      }
    },
    onJoinResponse: (msg) => {
      if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
        setSelectedHotspot(msg.hotspot);
      }
    },
    onRoomSync: (msg) => {
      if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
        setSelectedHotspot(msg.hotspot);
      }
    },
    onNewMessage: (msg) => {
      if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
        setSelectedHotspot((prev: any) => {
          if (!prev) return null;
          // Filter out matching offline optimistic message from log
          const rawMsgs = prev.messages.filter(
            (m: any) => !m.id.startsWith("msg_offline_") || m.text !== msg.message.text
          );
          if (rawMsgs.some((m: any) => m.id === msg.message.id)) return prev;
          return {
            ...prev,
            messages: [...rawMsgs, msg.message],
          };
        });
      }
    },
    onWaveReceived: (msg) => {
      addToast(`👋 ${msg.sender_username} waved at you!`, "wave");
      setNotifications((prev) =>
        [
          {
            id: Math.random().toString(36).substring(7),
            text: `@${msg.sender_username} waved at you!`,
            time: Date.now(),
            read: false,
          },
          ...prev,
        ].slice(0, 5)
      );
      setActiveWaves((prev) => [
        ...prev.filter((w) => w.sender_id !== msg.sender_id),
        { sender_id: msg.sender_id, expires_at: Date.now() + 10000 },
      ]);
    },
    onUserDisconnected: (msg) => {
      setActiveUsers((prev) => prev.filter((u) => u.user_id !== msg.user_id));
    },
    onChatRequestReceived: (msg) => globalEventBus.emit("chat:chat_request", msg),
    onChatRequestResponded: (msg) => globalEventBus.emit("chat:chat_respond", msg),
    onNewDirectMessage: (msg) => globalEventBus.emit("chat:new_dm", msg),
    onDMHistory: (msg) => {},
    onTypingIndicator: (msg) => globalEventBus.emit("chat:typing_indicator", msg),
    onChatsList: (msg) => globalEventBus.emit("chat:chats_list", msg),
    onRtcOffer: webRTC.handleRtcOffer,
    onRtcAnswer: webRTC.handleRtcAnswer,
    onRtcIceCandidate: webRTC.handleRtcIceCandidate,
  });

  useEffect(() => {
    socketMethodsRef.current = socket;
  }, [socket]);

  // Action methods
  const handleWave = useCallback(() => {
    if (!selectedUser) return;
    setHasWaved(true);
    addToast(`You waved at ${selectedUser.username}`);
    socket.sendWave(selectedUser.user_id);
  }, [selectedUser, addToast, socket]);

  const handleBlock = useCallback(async (userId: string) => {
    await blockUser(userId);
    setLocalBlocks((prev) => {
      const newBlocks = [...prev, userId];
      localStorage.setItem("norby_local_blocks", JSON.stringify(newBlocks));
      return newBlocks;
    });
    setSelectedUser(null);
  }, [blockUser]);

  const postIntent = useCallback((osmPlace?: any) => {
    if (!intentText.trim()) return;
    socket.createHotspot(intentText, customHotspotRange, osmPlace);
    setIntentText("");
    setShowIntentModal(false);
  }, [intentText, customHotspotRange, socket]);

  const requestJoin = useCallback((roomId?: any) => {
    const id = typeof roomId === "string" ? roomId : selectedHotspotRef.current?.id;
    if (!id) return;
    socket.requestJoin(id);
  }, [socket]);

  const respondRequest = useCallback((guestId: string, status: "accepted" | "declined") => {
    if (!selectedHotspotRef.current) return;
    socket.respondRequest(selectedHotspotRef.current.id, guestId, status);
  }, [socket]);

  const sendMessage = useCallback((text: string) => {
    if (!selectedHotspotRef.current) return;
    socket.sendMessage(selectedHotspotRef.current.id, text, (optimisticMsg) => {
      setSelectedHotspot((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, optimisticMsg],
        };
      });
      addToast("Offline: Message queued.", "default");
    });
  }, [socket, addToast]);

  const leaveHotspot = useCallback(() => {
    if (!selectedHotspotRef.current) return;
    socket.leaveHotspot(selectedHotspotRef.current.id);
    setSelectedHotspot(null);
  }, [socket]);



  // Deprecated - history loaded directly in main effect from localStorage

  // Chat action methods have been moved to ChatProvider

  const refreshRadar = useCallback(() => {
    setFollowUser(true);
    setRecenterTrigger((t) => t + 1);
    socket.requestSync();
    refreshLocation().then(() => {
      socket.requestSync();
    });
  }, [refreshLocation, socket]);



  const FILTER_KEYWORDS: Record<string, string[]> = {
    cafe: ["coffee", "chai", "boba", "tea", "ramen", "food", "eat", "matcha", "latte", "café", "cafe", "brunch", "lunch", "dinner", "cook", "☕", "🍵", "🧋", "🍜", "🍕"],
    dating: ["date", "dating", "love", "crush", "vibe", "connection", "hangout", "chill", "flirt", "coffee date", "sunset", "romantic", "💕", "✨", "🔥"],
    gaming: ["game", "gaming", "chess", "board", "cards", "esport", "valorant", "minecraft", "ps5", "xbox", "pubg", "bgmi", "cod", "fortnite", "dice", "ludo", "🎮", "🎲", "🎯"],
    movies: ["movie", "film", "cinema", "netflix", "anime", "watch", "series", "binge", "popcorn", "marvel", "bollywood", "horror", "comedy", "thriller", "🍿", "🎬", "🎌"],
    study: ["study", "code", "coding", "book", "exam", "learn", "grind", "library", "homework", "project", "hackathon", "dsa", "leetcode", "🎒", "📚", "💻"],
    music: ["guitar", "jam", "music", "vinyl", "sing", "beat", "lofi", "karaoke", "concert", "piano", "rap", "podcast", "spotify", "🎸", "🎧", "🎤"],
    sports: ["gym", "run", "walk", "bike", "swim", "sport", "workout", "yoga", "cricket", "football", "basketball", "badminton", "trek", "hike", "🛹", "🏋️", "🚴", "🏃", "🧘"],
    chill: ["chill", "vibe", "hangout", "drive", "explore", "roam", "wander", "sunset", "night", "midnight", "smoke", "terrace", "rooftop", "🎨", "⚡", "📷", "🌿", "🍳", "🚗", "🌙"],
  };

  function matchesFilter(intent: any, key: string): boolean {
    if (key === "all") return true;
    const keywords = FILTER_KEYWORDS[key];
    if (!keywords) return true;
    const t = (intent.title || "").toLowerCase();
    return keywords.some((k) => t.includes(k));
  }

  function matchesUserFilter(u: any, key: string): boolean {
    if (key === "all") return true;
    const keywords = FILTER_KEYWORDS[key];
    if (!keywords) return true;

    // Match by vibe emoji
    const userVibe = u.vibeEmoji || "";
    if (keywords.includes(userVibe)) return true;

    // Match by bio or tags
    const bio = (u.bio || "").toLowerCase();
    const tags = u.selectedTags || [];
    if (keywords.some((k) => bio.includes(k))) return true;
    if (tags.some((tag: string) => keywords.some((k) => tag.toLowerCase().includes(k)))) return true;

    return false;
  }

  // Filter lists based on user settings and ranges
  const radarRadius = profile?.radarRange || 15;

  const filteredUsers = useMemo(() => {
    const blockedIds = [...(profile?.blockedUsers || []), ...localBlocks];
    if (!location) return [];
    return activeUsers.filter((u) => {
      const isBlocked = blockedIds.includes(u.user_id) || (u.blockedUsers || []).includes(myUserId);
      const isWithinRange = getDistanceKm(location.lat, location.lng, u.lat, u.lng) <= radarRadius;
      const isMatchesFilter = matchesUserFilter(u, selectedFilter);
      return !isBlocked && isWithinRange && isMatchesFilter;
    });
  }, [activeUsers, profile?.blockedUsers, localBlocks, location, radarRadius, selectedFilter, myUserId]);

  const filteredHotspots = useMemo(() => {
    const blockedIds = [...(profile?.blockedUsers || []), ...localBlocks];
    if (!location) return [];
    return intents.filter((h) => {
      const isBlocked = blockedIds.includes(h.host_id);
      const dist = getDistanceKm(location.lat, location.lng, h.lat, h.lng);
      const isWithinRange = dist <= radarRadius && dist <= (h.hotspotRange || 15);
      const isNotExpired = h.expires_at > Date.now();
      const isMatchesFilter = matchesFilter(h, selectedFilter);
      return !isBlocked && isWithinRange && isNotExpired && isMatchesFilter;
    });
  }, [intents, profile?.blockedUsers, localBlocks, location, radarRadius, selectedFilter]);

  const mapValue = useMemo(() => ({
    myUserId,
    handle,
    vibeEmoji,
    myAvatarUrl,
    localBlocks,

    location,
    locStatus,
    isStasis,
    accuracy,
    accuracySource,
    refreshRadar,

    socketReady: socket.socketReady,
    connectionState: socket.connectionState,
    offlineMessages: socket.offlineMessages,
    connectionFailed: socket.connectionFailed,

    zoom,
    setZoom,
    recenterTrigger,
    followUser,
    setFollowUser,
    isInteracting,
    setIsInteracting,

    selectedFilter,
    setSelectedFilter,

    selectedUser,
    setSelectedUser,
    selectedHotspot,
    setSelectedHotspot,

    showIntentModal,
    setShowIntentModal,
    intentText,
    setIntentText,
    customHotspotRange,
    setCustomHotspotRange,

    hasWaved,
    setHasWaved,
    confirmBlock,
    setConfirmBlock,

    toasts,
    addToast,
    notifications,
    setNotifications,
    showNotifDropdown,
    setShowNotifDropdown,
    activeWaves,

    handleWave,
    handleBlock,
    postIntent,
    requestJoin,
    respondRequest,
    sendMessage,
    leaveHotspot,

    isBroadcastingAudio: webRTC.isBroadcastingAudio,
    isSpaceHost: webRTC.isSpaceHost,
    startBroadcast: webRTC.startBroadcast,
    stopBroadcast: webRTC.stopBroadcast,
    startListening: webRTC.startListening,
    stopListening: webRTC.stopListening,
    incomingStreams: webRTC.incomingStreams,
    isSpeakerMuted,
    setIsSpeakerMuted,

    speakRequests: webRTC.speakRequests,
    activeSpeakers: webRTC.activeSpeakers,
    activeListeners: webRTC.activeListeners,
    mySpeakStatus: webRTC.mySpeakStatus,
    isMutedByHost: webRTC.isMutedByHost,
    isLocalMicMuted: webRTC.isLocalMicMuted,
    requestToSpeak: webRTC.requestToSpeak,
    cancelSpeakRequest: webRTC.cancelSpeakRequest,
    approveSpeaker: webRTC.approveSpeaker,
    declineSpeaker: webRTC.declineSpeaker,
    muteSpeaker: webRTC.muteSpeaker,
    unmuteSpeaker: webRTC.unmuteSpeaker,
    removeSpeaker: webRTC.removeSpeaker,
    toggleLocalMic: webRTC.toggleLocalMic,
    leaveSpace: webRTC.leaveSpace,
    showSpaceDrawer,
    setShowSpaceDrawer,
    profile,

    filteredUsers,
    filteredHotspots,
    activeUsers,

    activeRoute,
    activeRouteMode,
    setActiveRouteMode,
    routingTarget,
    setRoutingTarget,
    isLoadingRoute,
    clearActiveRoute,
  }), [
    myUserId,
    handle,
    vibeEmoji,
    myAvatarUrl,
    localBlocks,

    location,
    locStatus,
    isStasis,
    accuracy,
    accuracySource,

    socket.socketReady,
    socket.connectionState,
    socket.offlineMessages,
    socket.connectionFailed,

    zoom,
    recenterTrigger,
    followUser,
    isInteracting,

    selectedFilter,

    selectedUser,
    selectedHotspot,

    showIntentModal,
    intentText,
    customHotspotRange,

    hasWaved,
    confirmBlock,

    toasts,
    notifications,
    showNotifDropdown,
    activeWaves,

    webRTC.isBroadcastingAudio,
    webRTC.isSpaceHost,
    webRTC.incomingStreams,
    isSpeakerMuted,
    webRTC.speakRequests,
    webRTC.activeSpeakers,
    webRTC.activeListeners,
    webRTC.mySpeakStatus,
    webRTC.isMutedByHost,
    webRTC.isLocalMicMuted,
    showSpaceDrawer,
    profile,

    filteredUsers,
    filteredHotspots,
    activeUsers,

    activeRoute,
    activeRouteMode,
    routingTarget,
    isLoadingRoute,
  ]);

  return (
    <MapContext.Provider value={mapValue}>
      <ChatProvider
        socket={socket}
        myUserId={myUserId}
        handle={handle}
        myAvatarUrl={myAvatarUrl}
        addToast={addToast}
        setNotifications={setNotifications}
        activeUsers={activeUsers}
        isSignedIn={isSignedIn}
      >
        {children}
      </ChatProvider>
    </MapContext.Provider>
  );
}

export function useMapContext() {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within a MapProvider");
  }
  return context;
}
