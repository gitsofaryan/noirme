"use client";

import { createContext, useContext, useState, useEffect, useRef, useMemo } from "react";
import { useAuth, getAvatarUrl, UserProfile } from "@/hooks/useAuth";
import { useGeolocation, getDistanceKm } from "@/hooks/useGeolocation";
import { useSocket } from "@/hooks/useSocket";
import { fetchOSRMRoute, RouteData, TransportMode } from "@/lib/routing";

export interface DirectMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string;
  recipient_id: string;
  text: string;
  timestamp: number;
}

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
  requestJoin: () => void;
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

  // Chat/DM state
  chatRequests: any[];
  friends: any[];
  chatMessages: DirectMessage[];
  peerTyping: Record<string, boolean>;
  activeChatUser: any | null;
  setActiveChatUser: (u: any | null) => void;
  sendChatRequest: (targetUserId: string) => void;
  respondChatRequest: (senderId: string, status: "accepted" | "rejected") => void;
  sendDirectMessage: (text: string) => void;
  sendTypingState: (isTyping: boolean) => void;
  requestDMHistory: (targetUserId: string) => void;
  isLoadingHistory: boolean;
}

const MapContext = createContext<MapContextType | undefined>(undefined);

export function MapProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, user, profile, blockUser } = useAuth();

  const myUserId =
    user?.id ||
    user?.username ||
    (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
    "anon";

  const handle = profile?.handle || user?.username || "";
  const vibeEmoji = profile?.vibeEmoji || "☕";
  const myAvatarUrl =
    profile?.avatar_url || (user ? getAvatarUrl(user.username) : getAvatarUrl("anon"));

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
      } catch (e) {}
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

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
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

  const addToast = (message: string, type: "default" | "wave" | "request" = "default") => {
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
  };

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
    refreshLocation,
  } = useGeolocation(maskLocation);

  // Sync lists from socket
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);

  // Chat states
  const [chatRequests, setChatRequests] = useState<any[]>([]);
  const [activeChatUser, _setActiveChatUser] = useState<any | null>(null);
  const activeChatUserRef = useRef<any | null>(null);
  const setActiveChatUser = (val: any) => {
    activeChatUserRef.current = val;
    _setActiveChatUser(val);
  };
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState<Record<string, boolean>>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Automatically load DM history from local Puter cache and request fresh history from WS when activeChatUser changes
  useEffect(() => {
    if (!activeChatUser) {
      setChatMessages([]);
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    const targetUserId = activeChatUser.user_id;

    // 1. Fetch from Puter KV cache immediately to avoid empty blank screen
    const convoId = [myUserId, targetUserId].sort().join(":");
    if (typeof window !== "undefined" && window.puter) {
      window.puter.kv.get(`chat_cache_${convoId}`).then((raw: any) => {
        if (raw && activeChatUserRef.current?.user_id === targetUserId) {
          try {
            const cached = JSON.parse(raw);
            setChatMessages(cached);
          } catch (e) {}
        }
      }).catch(() => {});
    }

    // 2. Request fresh DM history from the server
    socket.requestDMHistory(targetUserId);
  }, [activeChatUser, myUserId]);

  const friends = useMemo(() => {
    return chatRequests
      .filter((r) => r.status === "accepted")
      .map((r) => {
        const friendId = r.sender_id === myUserId ? r.target_id : r.sender_id;
        const latestInfo = activeUsers.find((u) => u.user_id === friendId);
        return {
          user_id: friendId,
          username: r.sender_id === myUserId ? (latestInfo?.username || r.target_id) : r.sender_username,
          avatar_url: r.sender_id === myUserId ? (latestInfo?.avatar_url || "") : r.sender_avatar,
          vibeEmoji: latestInfo?.vibeEmoji || "☕",
          bio: latestInfo?.bio || "",
          selectedTags: latestInfo?.selectedTags || [],
          lat: latestInfo?.lat,
          lng: latestInfo?.lng,
          last_seen: latestInfo?.last_seen,
          status: latestInfo?.status || "active",
        };
      });
  }, [chatRequests, activeUsers, myUserId]);


  // Routing state
  const [activeRoute, setActiveRoute] = useState<RouteData | null>(null);
  const [activeRouteMode, setActiveRouteMode] = useState<TransportMode>("foot");
  const [routingTarget, setRoutingTarget] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);

  const clearActiveRoute = () => {
    setActiveRoute(null);
    setRoutingTarget(null);
  };

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
        console.error("[noirme] Route fetch failed:", err);
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

  // Socket
  const socket = useSocket({
    userId: myUserId,
    handle,
    vibeEmoji,
    avatarUrl: myAvatarUrl,
    location,
    profile,
    localBlocks,
    onSync: (msg) => {
      const userMap = new Map<string, any>();
      for (const u of msg.users) {
        if (u.user_id !== myUserId) userMap.set(u.user_id, u);
      }
      setActiveUsers(Array.from(userMap.values()));
      setIntents(msg.hotspots || []);
    },
    onLocationUpdate: (msg) => {
      if (msg.data.user_id !== myUserId) {
        setActiveUsers((prev) => {
          const filtered = prev.filter((u) => u.user_id !== msg.data.user_id);
          if (!prev.some((u) => u.user_id === msg.data.user_id)) {
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
    onChatRequestReceived: (msg) => {
      addToast(`💬 Chat request from @${msg.request.sender_username}!`, "request");
      setNotifications((prev) => [
        {
          id: Math.random().toString(36).substring(7),
          text: `@${msg.request.sender_username} wants to connect with you`,
          time: Date.now(),
          read: false,
        },
        ...prev,
      ].slice(0, 5));
      setChatRequests((prev) => {
        const filtered = prev.filter((r) => r.sender_id !== msg.request.sender_id || r.target_id !== msg.request.target_id);
        return [...filtered, msg.request];
      });
    },
    onChatRequestResponded: (msg) => {
      const isAccepted = msg.request.status === "accepted";
      const otherUser = msg.request.sender_id === myUserId ? msg.request.target_id : msg.request.sender_id;
      const otherInfo = activeUsers.find((u) => u.user_id === otherUser);
      const otherHandle = otherInfo?.username || "Someone";
      
      if (isAccepted) {
        addToast(`✅ Connected with @${otherHandle}! You can now chat.`, "default");
      } else {
        addToast(`❌ Chat request to @${otherHandle} was declined.`, "default");
      }

      setChatRequests((prev) => {
        const filtered = prev.filter((r) => r.sender_id !== msg.request.sender_id || r.target_id !== msg.request.target_id);
        return [...filtered, msg.request];
      });
    },
    onNewDirectMessage: (msg) => {
      if (activeChatUserRef.current && (msg.message.sender_id === activeChatUserRef.current.user_id || msg.message.recipient_id === activeChatUserRef.current.user_id)) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          const newMsgs = [...prev, msg.message];
          const convoId = [myUserId, activeChatUserRef.current.user_id].sort().join(":");
          if (typeof window !== "undefined" && window.puter) {
            const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
            const filtered = newMsgs.filter((m) => m.timestamp > dayAgo);
            window.puter.kv.set(`chat_cache_${convoId}`, JSON.stringify(filtered)).catch(() => {});
          }
          return newMsgs;
        });
      } else {
        if (msg.message.sender_id !== myUserId) {
          addToast(`✉️ New message from @${msg.message.sender_username}: "${msg.message.text.substring(0, 20)}${msg.message.text.length > 20 ? "..." : ""}"`, "default");
        }
        if (typeof window !== "undefined" && window.puter) {
          const otherUserId = msg.message.sender_id === myUserId ? msg.message.recipient_id : msg.message.sender_id;
          const convoId = [myUserId, otherUserId].sort().join(":");
          window.puter.kv.get(`chat_cache_${convoId}`).then((raw: any) => {
            let list = raw ? JSON.parse(raw) : [];
            if (!list.some((m: any) => m.id === msg.message.id)) {
              list.push(msg.message);
              const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
              window.puter.kv.set(`chat_cache_${convoId}`, JSON.stringify(list.filter((m: any) => m.timestamp > dayAgo))).catch(() => {});
            }
          }).catch(() => {});
        }
      }
    },
    onDMHistory: (msg) => {
      if (activeChatUserRef.current && msg.target_user_id === activeChatUserRef.current.user_id) {
        setChatMessages(msg.messages);
        setIsLoadingHistory(false);
        const convoId = [myUserId, activeChatUserRef.current.user_id].sort().join(":");
        if (typeof window !== "undefined" && window.puter) {
          const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
          window.puter.kv.set(`chat_cache_${convoId}`, JSON.stringify(msg.messages.filter((m: any) => m.timestamp > dayAgo))).catch(() => {});
        }
      }
    },
    onTypingIndicator: (msg) => {
      setPeerTyping((prev) => ({
        ...prev,
        [msg.sender_id]: msg.is_typing,
      }));
    },
    onChatsList: (msg) => {
      setChatRequests(msg.requests || []);
    },
  });

  // Action methods
  const handleWave = () => {
    if (!selectedUser) return;
    setHasWaved(true);
    addToast(`You waved at ${selectedUser.username}`);
    socket.sendWave(selectedUser.user_id);
  };

  const handleBlock = async (userId: string) => {
    await blockUser(userId);
    const newBlocks = [...localBlocks, userId];
    setLocalBlocks(newBlocks);
    localStorage.setItem("noirme_local_blocks", JSON.stringify(newBlocks));
    setSelectedUser(null);
  };

  const postIntent = (osmPlace?: any) => {
    if (!intentText.trim()) return;
    socket.createHotspot(intentText, customHotspotRange, osmPlace);
    setIntentText("");
    setShowIntentModal(false);
  };

  const requestJoin = () => {
    if (!selectedHotspot) return;
    socket.requestJoin(selectedHotspot.id);
  };

  const respondRequest = (guestId: string, status: "accepted" | "declined") => {
    if (!selectedHotspot) return;
    socket.respondRequest(selectedHotspot.id, guestId, status);
  };

  const sendMessage = (text: string) => {
    if (!selectedHotspot) return;
    socket.sendMessage(selectedHotspot.id, text, (optimisticMsg) => {
      setSelectedHotspot((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...prev.messages, optimisticMsg],
        };
      });
      addToast("Offline: Message queued.", "default");
    });
  };

  const leaveHotspot = () => {
    if (!selectedHotspot) return;
    socket.leaveHotspot(selectedHotspot.id);
    setSelectedHotspot(null);
  };

  // Load DM history on selecting activeChatUser
  useEffect(() => {
    if (!activeChatUser) {
      setChatMessages([]);
      return;
    }

    if (typeof window !== "undefined" && window.puter) {
      const convoId = [myUserId, activeChatUser.user_id].sort().join(":");
      window.puter.kv.get(`chat_cache_${convoId}`)
        .then((raw: string) => {
          if (raw) {
            const msgs = JSON.parse(raw);
            const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
            setChatMessages(msgs.filter((m: any) => m.timestamp > dayAgo));
          }
        })
        .catch((err: any) => console.warn("Puter KV load failed:", err));
    }

    socket.requestDMHistory(activeChatUser.user_id);
  }, [activeChatUser?.user_id]);

  const sendChatRequest = (targetUserId: string) => {
    socket.sendChatRequest(targetUserId);
  };

  const respondChatRequest = (senderId: string, status: "accepted" | "rejected") => {
    socket.respondChatRequest(senderId, status);
  };

  const sendDirectMessage = (text: string) => {
    if (!activeChatUser) return;
    socket.sendDirectMessage(activeChatUser.user_id, text);
  };

  const sendTypingState = (isTyping: boolean) => {
    if (!activeChatUser) return;
    socket.sendTypingState(activeChatUser.user_id, isTyping);
  };

  const requestDMHistory = (targetUserId: string) => {
    socket.requestDMHistory(targetUserId);
  };

  const refreshRadar = () => {
    setFollowUser(true);
    setRecenterTrigger((t) => t + 1);
    refreshLocation().then(() => {
      socket.requestSync();
    });
  };



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

  const contextValue = useMemo(() => ({
    myUserId,
    handle,
    vibeEmoji,
    myAvatarUrl,
    localBlocks,

    location,
    locStatus,
    isStasis,
    accuracy,
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

    chatRequests,
    friends,
    chatMessages,
    peerTyping,
    activeChatUser,
    setActiveChatUser,
    sendChatRequest,
    respondChatRequest,
    sendDirectMessage,
    sendTypingState,
    requestDMHistory,
    isLoadingHistory,

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

    chatRequests,
    friends,
    chatMessages,
    peerTyping,
    activeChatUser,
    isLoadingHistory,

    filteredUsers,
    filteredHotspots,
    activeUsers,

    activeRoute,
    activeRouteMode,
    routingTarget,
    isLoadingRoute,
  ]);

  return (
    <MapContext.Provider value={contextValue}>
      {children}
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
