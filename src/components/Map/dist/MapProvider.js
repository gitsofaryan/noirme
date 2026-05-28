"use client";
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.useMapContext = exports.MapProvider = void 0;
var react_1 = require("react");
var useAuth_1 = require("@/hooks/useAuth");
var useGeolocation_1 = require("@/hooks/useGeolocation");
var useSocket_1 = require("@/hooks/useSocket");
var useWebRTC_1 = require("@/hooks/useWebRTC");
var routing_1 = require("@/lib/routing");
var MapContext = react_1.createContext(undefined);
function MapProvider(_a) {
    var _this = this;
    var _b;
    var children = _a.children;
    var _c = useAuth_1.useAuth(), isSignedIn = _c.isSignedIn, user = _c.user, profile = _c.profile, blockUser = _c.blockUser;
    var myUserId = (user === null || user === void 0 ? void 0 : user.id) || (user === null || user === void 0 ? void 0 : user.username) ||
        (typeof window !== "undefined" ? localStorage.getItem("noirme_anon_id") : null) ||
        "anon";
    var handle = (profile === null || profile === void 0 ? void 0 : profile.handle) || (user === null || user === void 0 ? void 0 : user.username) || "";
    var vibeEmoji = (profile === null || profile === void 0 ? void 0 : profile.vibeEmoji) || "☕";
    var myAvatarUrl = (profile === null || profile === void 0 ? void 0 : profile.avatar_url) || (user ? useAuth_1.getAvatarUrl(user.username) : useAuth_1.getAvatarUrl("anon"));
    var _d = react_1.useState(function () {
        if (typeof window !== "undefined") {
            try {
                return JSON.parse(localStorage.getItem("noirme_local_blocks") || "[]");
            }
            catch (_a) {
                return [];
            }
        }
        return [];
    }), localBlocks = _d[0], setLocalBlocks = _d[1];
    // Sync with local storage events (for unblocking from profile page)
    react_1.useEffect(function () {
        var syncBlocks = function () {
            try {
                var local = JSON.parse(localStorage.getItem("noirme_local_blocks") || "[]");
                setLocalBlocks(local);
            }
            catch (e) { }
        };
        window.addEventListener("storage", syncBlocks);
        return function () { return window.removeEventListener("storage", syncBlocks); };
    }, []);
    // UI state
    var _e = react_1.useState(15), zoom = _e[0], setZoom = _e[1];
    var _f = react_1.useState(0), recenterTrigger = _f[0], setRecenterTrigger = _f[1];
    var _g = react_1.useState(true), followUser = _g[0], setFollowUser = _g[1];
    var _h = react_1.useState(false), isInteracting = _h[0], setIsInteracting = _h[1];
    var _j = react_1.useState("all"), selectedFilter = _j[0], setSelectedFilter = _j[1];
    var _k = react_1.useState(false), isSpeakerMuted = _k[0], setIsSpeakerMuted = _k[1];
    var _l = react_1.useState(null), selectedUser = _l[0], setSelectedUser = _l[1];
    var _m = react_1.useState(null), selectedHotspot = _m[0], _setSelectedHotspot = _m[1];
    var selectedHotspotRef = react_1.useRef(null);
    var setSelectedHotspot = function (val) {
        if (typeof val === "function") {
            var nextVal = val(selectedHotspotRef.current);
            selectedHotspotRef.current = nextVal;
            _setSelectedHotspot(nextVal);
        }
        else {
            selectedHotspotRef.current = val;
            _setSelectedHotspot(val);
        }
    };
    var _o = react_1.useState(false), showIntentModal = _o[0], setShowIntentModal = _o[1];
    var _p = react_1.useState(""), intentText = _p[0], setIntentText = _p[1];
    var _q = react_1.useState(15), customHotspotRange = _q[0], setCustomHotspotRange = _q[1];
    react_1.useEffect(function () {
        if (showIntentModal) {
            setCustomHotspotRange((profile === null || profile === void 0 ? void 0 : profile.hotspotRange) || 15);
        }
    }, [showIntentModal, profile === null || profile === void 0 ? void 0 : profile.hotspotRange]);
    var _r = react_1.useState(false), hasWaved = _r[0], setHasWaved = _r[1];
    var _s = react_1.useState(false), confirmBlock = _s[0], setConfirmBlock = _s[1];
    react_1.useEffect(function () {
        setHasWaved(false);
        setConfirmBlock(false);
    }, [selectedUser]);
    // Notifications and Toast streams
    var _t = react_1.useState([]), toasts = _t[0], setToasts = _t[1];
    var _u = react_1.useState([]), notifications = _u[0], setNotifications = _u[1];
    var _v = react_1.useState(false), showNotifDropdown = _v[0], setShowNotifDropdown = _v[1];
    var _w = react_1.useState([]), activeWaves = _w[0], setActiveWaves = _w[1];
    var addToast = function (message, type) {
        if (type === void 0) { type = "default"; }
        var id = Math.random().toString(36).substring(2, 9);
        setToasts(function (prev) {
            var next = __spreadArrays(prev, [{ id: id, message: message, type: type }]);
            if (next.length > 3) {
                return next.slice(-3);
            }
            return next;
        });
        setTimeout(function () {
            setToasts(function (prev) { return prev.filter(function (t) { return t.id !== id; }); });
        }, 4000);
    };
    react_1.useEffect(function () {
        var interval = setInterval(function () {
            var now = Date.now();
            setActiveWaves(function (prev) { return prev.filter(function (w) { return w.expires_at > now; }); });
        }, 1000);
        return function () { return clearInterval(interval); };
    }, []);
    // Geolocation
    var maskLocation = (_b = profile === null || profile === void 0 ? void 0 : profile.maskLocation) !== null && _b !== void 0 ? _b : true;
    var _x = useGeolocation_1.useGeolocation(maskLocation), location = _x.location, locStatus = _x.status, isStasis = _x.isStasis, accuracy = _x.accuracy, accuracySource = _x.accuracySource, refreshLocation = _x.refreshLocation;
    // Sync lists from socket
    var _y = react_1.useState([]), activeUsers = _y[0], setActiveUsers = _y[1];
    var _z = react_1.useState([]), intents = _z[0], setIntents = _z[1];
    // Chat states
    var _0 = react_1.useState([]), chatRequests = _0[0], setChatRequests = _0[1];
    var chatRequestsRef = react_1.useRef([]);
    react_1.useEffect(function () {
        chatRequestsRef.current = chatRequests;
    }, [chatRequests]);
    var _1 = react_1.useState(null), activeChatUser = _1[0], _setActiveChatUser = _1[1];
    var activeChatUserRef = react_1.useRef(null);
    var setActiveChatUser = function (val) {
        activeChatUserRef.current = val;
        _setActiveChatUser(val);
    };
    var _2 = react_1.useState([]), chatMessages = _2[0], setChatMessages = _2[1];
    var _3 = react_1.useState({}), peerTyping = _3[0], setPeerTyping = _3[1];
    var _4 = react_1.useState(false), isLoadingHistory = _4[0], setIsLoadingHistory = _4[1];
    // Unread messages tracking (debounced localStorage save)
    var _5 = react_1.useState(function () {
        if (typeof window !== "undefined") {
            try {
                return JSON.parse(localStorage.getItem("noirme_unread_messages") || "{}");
            }
            catch (e) {
                return {};
            }
        }
        return {};
    }), unreadMessages = _5[0], setUnreadMessages = _5[1];
    var unreadSaveTimeoutRef = react_1.useRef(null);
    react_1.useEffect(function () {
        if (unreadSaveTimeoutRef.current) {
            clearTimeout(unreadSaveTimeoutRef.current);
        }
        unreadSaveTimeoutRef.current = setTimeout(function () {
            try {
                localStorage.setItem("noirme_unread_messages", JSON.stringify(unreadMessages));
            }
            catch (e) {
                console.warn("[noirme] Failed to save unread messages to localStorage");
            }
        }, 500);
        return function () {
            if (unreadSaveTimeoutRef.current) {
                clearTimeout(unreadSaveTimeoutRef.current);
            }
        };
    }, [unreadMessages]);
    var unreadMessagesCount = react_1.useMemo(function () {
        return Object.values(unreadMessages).reduce(function (a, b) { return a + b; }, 0);
    }, [unreadMessages]);
    // Clear unread count when activeChatUser changes
    react_1.useEffect(function () {
        if (activeChatUser) {
            setUnreadMessages(function (prev) {
                if (!prev[activeChatUser.user_id])
                    return prev;
                var copy = __assign({}, prev);
                delete copy[activeChatUser.user_id];
                return copy;
            });
        }
    }, [activeChatUser]);
    // Save accepted friends to Puter KV as a string array (debounced)
    var friendsSaveTimeoutRef = react_1.useRef(null);
    react_1.useEffect(function () {
        if (!myUserId || myUserId === "anon")
            return;
        if (typeof window !== "undefined" && window.puter) {
            if (friendsSaveTimeoutRef.current) {
                clearTimeout(friendsSaveTimeoutRef.current);
            }
            friendsSaveTimeoutRef.current = setTimeout(function () {
                var acceptedIds = chatRequests
                    .filter(function (r) { return r.status === "accepted"; })
                    .map(function (r) { return (r.sender_id === myUserId ? r.target_id : r.sender_id); });
                if (acceptedIds.length > 0) {
                    window.puter.kv.set("friends_list_" + myUserId, JSON.stringify(acceptedIds))["catch"](function (err) { return console.warn("[noirme] Failed to save friends list"); });
                }
            }, 1000);
        }
        return function () {
            if (friendsSaveTimeoutRef.current) {
                clearTimeout(friendsSaveTimeoutRef.current);
            }
        };
    }, [chatRequests, myUserId]);
    // Load accepted friends from Puter KV on login (instant load, runs once per session)
    var friendsLoadedRef = react_1.useRef(false);
    react_1.useEffect(function () {
        if (friendsLoadedRef.current || !myUserId || myUserId === "anon")
            return;
        if (typeof window !== "undefined" && window.puter) {
            friendsLoadedRef.current = true;
            window.puter.kv.get("friends_list_" + myUserId)
                .then(function (raw) {
                if (!raw)
                    return;
                try {
                    var friendIds_1 = JSON.parse(raw);
                    if (Array.isArray(friendIds_1) && friendIds_1.length > 0) {
                        setChatRequests(function (prev) {
                            var existingIds = new Set(prev.map(function (r) { return r.sender_id === myUserId ? r.target_id : r.sender_id; }));
                            var newPlaceholders = friendIds_1
                                .filter(function (id) { return !existingIds.has(id); })
                                .map(function (id) { return ({
                                sender_id: myUserId,
                                sender_username: handle || myUserId,
                                sender_avatar: myAvatarUrl,
                                target_id: id,
                                status: "accepted",
                                timestamp: Date.now()
                            }); });
                            return newPlaceholders.length > 0 ? __spreadArrays(prev, newPlaceholders) : prev;
                        });
                    }
                }
                catch (e) {
                    console.warn("[noirme] Failed to parse friends list from Puter KV");
                }
            })["catch"](function (err) { return console.warn("[noirme] Failed to load friends list from Puter KV"); });
        }
    }, [myUserId, handle, myAvatarUrl]);
    // Load DM history from localStorage only (device-local, no server)
    react_1.useEffect(function () {
        if (!activeChatUser || !myUserId || myUserId === "anon") {
            setChatMessages([]);
            setIsLoadingHistory(false);
            return;
        }
        var targetUserId = activeChatUser.user_id;
        var convoId = [myUserId, targetUserId].sort().join(":");
        if (typeof window !== "undefined") {
            try {
                var stored = localStorage.getItem("chat_msgs_" + convoId);
                if (stored) {
                    var msgs = JSON.parse(stored);
                    var oneHourAgo_1 = Date.now() - 60 * 60 * 1000;
                    var validMsgs = msgs.filter(function (m) { return m.timestamp > oneHourAgo_1; });
                    setChatMessages(validMsgs);
                    localStorage.setItem("chat_msgs_" + convoId, JSON.stringify(validMsgs));
                }
                else {
                    setChatMessages([]);
                }
            }
            catch (e) {
                console.warn("[noirme] Failed to load chat from localStorage");
                setChatMessages([]);
            }
        }
        setIsLoadingHistory(false);
    }, [activeChatUser === null || activeChatUser === void 0 ? void 0 : activeChatUser.user_id, myUserId]);
    var friends = react_1.useMemo(function () {
        return chatRequests
            .filter(function (r) { return r.status === "accepted"; })
            .map(function (r) {
            var friendId = r.sender_id === myUserId ? r.target_id : r.sender_id;
            var latestInfo = activeUsers.find(function (u) { return u.user_id === friendId; });
            return {
                user_id: friendId,
                username: r.sender_id === myUserId ? ((latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.username) || r.target_id) : r.sender_username,
                avatar_url: r.sender_id === myUserId ? ((latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.avatar_url) || "") : r.sender_avatar,
                vibeEmoji: (latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.vibeEmoji) || "☕",
                bio: (latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.bio) || "",
                selectedTags: (latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.selectedTags) || [],
                lat: latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.lat,
                lng: latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.lng,
                last_seen: latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.last_seen,
                status: (latestInfo === null || latestInfo === void 0 ? void 0 : latestInfo.status) || "active"
            };
        });
    }, [chatRequests, activeUsers, myUserId]);
    // Routing state
    var _6 = react_1.useState(null), activeRoute = _6[0], setActiveRoute = _6[1];
    var _7 = react_1.useState("foot"), activeRouteMode = _7[0], setActiveRouteMode = _7[1];
    var _8 = react_1.useState(null), routingTarget = _8[0], setRoutingTarget = _8[1];
    var _9 = react_1.useState(false), isLoadingRoute = _9[0], setIsLoadingRoute = _9[1];
    var clearActiveRoute = function () {
        setActiveRoute(null);
        setRoutingTarget(null);
    };
    var lastFetchedLocationRef = react_1.useRef(null);
    react_1.useEffect(function () {
        if (!location || !routingTarget) {
            setActiveRoute(null);
            lastFetchedLocationRef.current = null;
            return;
        }
        // Debounce location updates: only re-fetch route if user moved >50m (0.05km)
        if (lastFetchedLocationRef.current && activeRoute) {
            var movedDist = useGeolocation_1.getDistanceKm(location.lat, location.lng, lastFetchedLocationRef.current.lat, lastFetchedLocationRef.current.lng);
            if (movedDist < 0.05) {
                return;
            }
        }
        var active = true;
        setIsLoadingRoute(true);
        routing_1.fetchOSRMRoute(location.lat, location.lng, routingTarget.lat, routingTarget.lng, activeRouteMode)
            .then(function (data) {
            if (active) {
                setActiveRoute(data);
                lastFetchedLocationRef.current = { lat: location.lat, lng: location.lng };
                setIsLoadingRoute(false);
            }
        })["catch"](function (err) {
            console.error("[noirme] Route fetch failed:", err);
            if (active) {
                setIsLoadingRoute(false);
                addToast("Failed to calculate route", "default");
            }
        });
        return function () {
            active = false;
        };
    }, [location === null || location === void 0 ? void 0 : location.lat, location === null || location === void 0 ? void 0 : location.lng, routingTarget, activeRouteMode]);
    // Sync selected user drawer with real-time active users updates
    var selectedUserRef = react_1.useRef(null);
    selectedUserRef.current = selectedUser;
    react_1.useEffect(function () {
        var current = selectedUserRef.current;
        if (!current)
            return;
        var latest = activeUsers.find(function (u) { return u.user_id === current.user_id; });
        if (latest) {
            if (latest.age !== current.age ||
                latest.gender !== current.gender ||
                latest.bio !== current.bio ||
                latest.vibeEmoji !== current.vibeEmoji ||
                latest.avatar_url !== current.avatar_url ||
                latest.username !== current.username ||
                JSON.stringify(latest.selectedTags) !== JSON.stringify(current.selectedTags)) {
                setSelectedUser(latest);
            }
        }
        else {
            setSelectedUser(null);
        }
    }, [activeUsers]);
    // Socket methods Ref to pass to WebRTC without circular dependency
    var socketMethodsRef = react_1.useRef(null);
    var webRTC = useWebRTC_1.useWebRTC({
        myUserId: myUserId,
        sendRtcOffer: function (target, offer) { var _a; return (_a = socketMethodsRef.current) === null || _a === void 0 ? void 0 : _a.sendRtcOffer(target, offer); },
        sendRtcAnswer: function (target, answer) { var _a; return (_a = socketMethodsRef.current) === null || _a === void 0 ? void 0 : _a.sendRtcAnswer(target, answer); },
        sendRtcIceCandidate: function (target, cand) { var _a; return (_a = socketMethodsRef.current) === null || _a === void 0 ? void 0 : _a.sendRtcIceCandidate(target, cand); }
    });
    // Socket
    var socket = useSocket_1.useSocket({
        userId: myUserId,
        handle: handle,
        vibeEmoji: vibeEmoji,
        avatarUrl: myAvatarUrl,
        location: location,
        profile: profile,
        localBlocks: localBlocks,
        isBroadcastingAudio: webRTC.isBroadcastingAudio,
        onSync: function (msg) {
            var userMap = new Map();
            for (var _i = 0, _a = msg.users; _i < _a.length; _i++) {
                var u = _a[_i];
                if (u.user_id !== myUserId)
                    userMap.set(u.user_id, u);
            }
            setActiveUsers(Array.from(userMap.values()));
            setIntents(msg.hotspots || []);
        },
        onLocationUpdate: function (msg) {
            if (msg.data.user_id !== myUserId) {
                setActiveUsers(function (prev) {
                    var existingUser = prev.find(function (u) { return u.user_id === msg.data.user_id; });
                    var filtered = prev.filter(function (u) { return u.user_id !== msg.data.user_id; });
                    if (!existingUser) {
                        setNotifications(function (prevNotifs) {
                            return __spreadArrays([
                                {
                                    id: Math.random().toString(36).substring(7),
                                    text: "@" + msg.data.username + " is now nearby",
                                    time: Date.now(),
                                    read: false
                                }
                            ], prevNotifs).slice(0, 5);
                        });
                    }
                    else if (!existingUser.is_broadcasting_audio && msg.data.is_broadcasting_audio) {
                        var isFriend = chatRequestsRef.current.some(function (r) {
                            return r.status === "accepted" &&
                                (r.sender_id === msg.data.user_id || r.target_id === msg.data.user_id);
                        });
                        if (isFriend) {
                            addToast("\uD83C\uDF99\uFE0F @" + msg.data.username + " is speaking nearby!", "default");
                            setNotifications(function (prevNotifs) {
                                return __spreadArrays([
                                    {
                                        id: Math.random().toString(36).substring(7),
                                        text: "\uD83C\uDF99\uFE0F @" + msg.data.username + " started an audio broadcast",
                                        time: Date.now(),
                                        read: false
                                    }
                                ], prevNotifs).slice(0, 5);
                            });
                        }
                    }
                    return __spreadArrays(filtered, [msg.data]);
                });
            }
        },
        onHotspotsList: function (msg) {
            setIntents(msg.hotspots || []);
            if (selectedHotspotRef.current) {
                var updated = msg.hotspots.find(function (h) { var _a; return h.id === ((_a = selectedHotspotRef.current) === null || _a === void 0 ? void 0 : _a.id); });
                if (updated) {
                    setSelectedHotspot(updated);
                }
                else {
                    setSelectedHotspot(null);
                }
            }
        },
        onHotspotCreated: function (msg) {
            setSelectedHotspot(msg.hotspot);
        },
        onJoinRequestReceived: function (msg) {
            setNotifications(function (prev) {
                return __spreadArrays([
                    {
                        id: Math.random().toString(36).substring(7),
                        text: "@" + msg.username + " wants to join your hotspot",
                        time: Date.now(),
                        read: false
                    }
                ], prev).slice(0, 5);
            });
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
                setSelectedHotspot(msg.hotspot);
            }
        },
        onJoinResponse: function (msg) {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
                setSelectedHotspot(msg.hotspot);
            }
        },
        onRoomSync: function (msg) {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
                setSelectedHotspot(msg.hotspot);
            }
        },
        onNewMessage: function (msg) {
            if (selectedHotspotRef.current && selectedHotspotRef.current.id === msg.roomId) {
                setSelectedHotspot(function (prev) {
                    if (!prev)
                        return null;
                    // Filter out matching offline optimistic message from log
                    var rawMsgs = prev.messages.filter(function (m) { return !m.id.startsWith("msg_offline_") || m.text !== msg.message.text; });
                    if (rawMsgs.some(function (m) { return m.id === msg.message.id; }))
                        return prev;
                    return __assign(__assign({}, prev), { messages: __spreadArrays(rawMsgs, [msg.message]) });
                });
            }
        },
        onWaveReceived: function (msg) {
            addToast("\uD83D\uDC4B " + msg.sender_username + " waved at you!", "wave");
            setNotifications(function (prev) {
                return __spreadArrays([
                    {
                        id: Math.random().toString(36).substring(7),
                        text: "@" + msg.sender_username + " waved at you!",
                        time: Date.now(),
                        read: false
                    }
                ], prev).slice(0, 5);
            });
            setActiveWaves(function (prev) { return __spreadArrays(prev.filter(function (w) { return w.sender_id !== msg.sender_id; }), [
                { sender_id: msg.sender_id, expires_at: Date.now() + 10000 },
            ]); });
        },
        onUserDisconnected: function (msg) {
            setActiveUsers(function (prev) { return prev.filter(function (u) { return u.user_id !== msg.user_id; }); });
        },
        onChatRequestReceived: function (msg) {
            addToast("\uD83D\uDCAC Chat request from @" + msg.request.sender_username + "!", "request");
            setNotifications(function (prev) { return __spreadArrays([
                {
                    id: Math.random().toString(36).substring(7),
                    text: "@" + msg.request.sender_username + " wants to connect with you",
                    time: Date.now(),
                    read: false
                }
            ], prev).slice(0, 5); });
            setChatRequests(function (prev) {
                var filtered = prev.filter(function (r) { return r.sender_id !== msg.request.sender_id || r.target_id !== msg.request.target_id; });
                return __spreadArrays(filtered, [msg.request]);
            });
        },
        onChatRequestResponded: function (msg) {
            var isAccepted = msg.request.status === "accepted";
            var otherUser = msg.request.sender_id === myUserId ? msg.request.target_id : msg.request.sender_id;
            var otherInfo = activeUsers.find(function (u) { return u.user_id === otherUser; });
            var otherHandle = (otherInfo === null || otherInfo === void 0 ? void 0 : otherInfo.username) || "Someone";
            if (isAccepted) {
                addToast("\u2705 Connected with @" + otherHandle + "! You can now chat.", "default");
            }
            else {
                addToast("\u274C Chat request to @" + otherHandle + " was declined.", "default");
            }
            setChatRequests(function (prev) {
                var filtered = prev.filter(function (r) { return r.sender_id !== msg.request.sender_id || r.target_id !== msg.request.target_id; });
                return __spreadArrays(filtered, [msg.request]);
            });
        },
        onNewDirectMessage: function (msg) {
            if (activeChatUserRef.current && (msg.message.sender_id === activeChatUserRef.current.user_id || msg.message.recipient_id === activeChatUserRef.current.user_id)) {
                setChatMessages(function (prev) {
                    if (prev.some(function (m) { return m.id === msg.message.id; }))
                        return prev;
                    var newMsgs = __spreadArrays(prev, [msg.message]);
                    var convoId = [myUserId, activeChatUserRef.current.user_id].sort().join(":");
                    if (typeof window !== "undefined") {
                        try {
                            var oneHourAgo_2 = Date.now() - 60 * 60 * 1000;
                            var filtered = newMsgs.filter(function (m) { return m.timestamp > oneHourAgo_2; });
                            localStorage.setItem("chat_msgs_" + convoId, JSON.stringify(filtered));
                        }
                        catch (e) {
                            console.warn("[noirme] Failed to save chat to localStorage");
                        }
                    }
                    return newMsgs;
                });
            }
            else {
                if (msg.message.sender_id !== myUserId) {
                    addToast("\u2709\uFE0F New message from @" + msg.message.sender_username + ": \"" + msg.message.text.substring(0, 20) + (msg.message.text.length > 20 ? "..." : "") + "\"", "default");
                    setUnreadMessages(function (prev) {
                        var _a;
                        return (__assign(__assign({}, prev), (_a = {}, _a[msg.message.sender_id] = (prev[msg.message.sender_id] || 0) + 1, _a)));
                    });
                }
                if (typeof window !== "undefined") {
                    try {
                        var otherUserId = msg.message.sender_id === myUserId ? msg.message.recipient_id : msg.message.sender_id;
                        var convoId = [myUserId, otherUserId].sort().join(":");
                        var list = [];
                        var stored = localStorage.getItem("chat_msgs_" + convoId);
                        if (stored) {
                            list = JSON.parse(stored);
                        }
                        if (!list.some(function (m) { return m.id === msg.message.id; })) {
                            list.push(msg.message);
                            var oneHourAgo_3 = Date.now() - 60 * 60 * 1000;
                            var filtered = list.filter(function (m) { return m.timestamp > oneHourAgo_3; });
                            localStorage.setItem("chat_msgs_" + convoId, JSON.stringify(filtered));
                        }
                    }
                    catch (e) {
                        console.warn("[noirme] Failed to cache message");
                    }
                }
            }
        },
        onDMHistory: function (msg) {
            // Server history no longer used - all messages stored locally
        },
        onTypingIndicator: function (msg) {
            setPeerTyping(function (prev) {
                var _a;
                return (__assign(__assign({}, prev), (_a = {}, _a[msg.sender_id] = msg.is_typing, _a)));
            });
        },
        onChatsList: function (msg) {
            setChatRequests(msg.requests || []);
        },
        onRtcOffer: webRTC.handleRtcOffer,
        onRtcAnswer: webRTC.handleRtcAnswer,
        onRtcIceCandidate: webRTC.handleRtcIceCandidate
    });
    react_1.useEffect(function () {
        socketMethodsRef.current = socket;
    }, [socket]);
    // Action methods
    var handleWave = function () {
        if (!selectedUser)
            return;
        setHasWaved(true);
        addToast("You waved at " + selectedUser.username);
        socket.sendWave(selectedUser.user_id);
    };
    var handleBlock = function (userId) { return __awaiter(_this, void 0, void 0, function () {
        var newBlocks;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, blockUser(userId)];
                case 1:
                    _a.sent();
                    newBlocks = __spreadArrays(localBlocks, [userId]);
                    setLocalBlocks(newBlocks);
                    localStorage.setItem("noirme_local_blocks", JSON.stringify(newBlocks));
                    setSelectedUser(null);
                    return [2 /*return*/];
            }
        });
    }); };
    var postIntent = function (osmPlace) {
        if (!intentText.trim())
            return;
        socket.createHotspot(intentText, customHotspotRange, osmPlace);
        setIntentText("");
        setShowIntentModal(false);
    };
    var requestJoin = function (roomId) {
        var id = typeof roomId === "string" ? roomId : selectedHotspot === null || selectedHotspot === void 0 ? void 0 : selectedHotspot.id;
        if (!id)
            return;
        socket.requestJoin(id);
    };
    var respondRequest = function (guestId, status) {
        if (!selectedHotspot)
            return;
        socket.respondRequest(selectedHotspot.id, guestId, status);
    };
    var sendMessage = function (text) {
        if (!selectedHotspot)
            return;
        socket.sendMessage(selectedHotspot.id, text, function (optimisticMsg) {
            setSelectedHotspot(function (prev) {
                if (!prev)
                    return null;
                return __assign(__assign({}, prev), { messages: __spreadArrays(prev.messages, [optimisticMsg]) });
            });
            addToast("Offline: Message queued.", "default");
        });
    };
    var leaveHotspot = function () {
        if (!selectedHotspot)
            return;
        socket.leaveHotspot(selectedHotspot.id);
        setSelectedHotspot(null);
    };
    // Deprecated - history loaded directly in main effect from localStorage
    var sendChatRequest = function (targetUserId) {
        socket.sendChatRequest(targetUserId);
    };
    var respondChatRequest = function (senderId, status) {
        socket.respondChatRequest(senderId, status);
    };
    var sendDirectMessage = function (text) {
        if (!activeChatUser || !myUserId || myUserId === "anon")
            return;
        var optimisticMsg = {
            id: "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            sender_id: myUserId,
            sender_username: handle || myUserId,
            sender_avatar: myAvatarUrl,
            recipient_id: activeChatUser.user_id,
            text: text,
            timestamp: Date.now()
        };
        setChatMessages(function (prev) {
            var next = __spreadArrays(prev, [optimisticMsg]);
            var convoId = [myUserId, activeChatUser.user_id].sort().join(":");
            if (typeof window !== "undefined") {
                try {
                    var oneHourAgo_4 = Date.now() - 60 * 60 * 1000;
                    var filtered = next.filter(function (m) { return m.timestamp > oneHourAgo_4; });
                    localStorage.setItem("chat_msgs_" + convoId, JSON.stringify(filtered));
                }
                catch (e) {
                    console.warn("[noirme] Failed to save chat to localStorage");
                }
            }
            return next;
        });
        socket.sendDirectMessage(activeChatUser.user_id, text);
    };
    var sendTypingState = function (isTyping) {
        if (!activeChatUser)
            return;
        socket.sendTypingState(activeChatUser.user_id, isTyping);
    };
    var requestDMHistory = function (targetUserId) {
        socket.requestDMHistory(targetUserId);
    };
    var refreshRadar = function () {
        setFollowUser(true);
        setRecenterTrigger(function (t) { return t + 1; });
        refreshLocation().then(function () {
            socket.requestSync();
        });
    };
    var FILTER_KEYWORDS = {
        cafe: ["coffee", "chai", "boba", "tea", "ramen", "food", "eat", "matcha", "latte", "café", "cafe", "brunch", "lunch", "dinner", "cook", "☕", "🍵", "🧋", "🍜", "🍕"],
        dating: ["date", "dating", "love", "crush", "vibe", "connection", "hangout", "chill", "flirt", "coffee date", "sunset", "romantic", "💕", "✨", "🔥"],
        gaming: ["game", "gaming", "chess", "board", "cards", "esport", "valorant", "minecraft", "ps5", "xbox", "pubg", "bgmi", "cod", "fortnite", "dice", "ludo", "🎮", "🎲", "🎯"],
        movies: ["movie", "film", "cinema", "netflix", "anime", "watch", "series", "binge", "popcorn", "marvel", "bollywood", "horror", "comedy", "thriller", "🍿", "🎬", "🎌"],
        study: ["study", "code", "coding", "book", "exam", "learn", "grind", "library", "homework", "project", "hackathon", "dsa", "leetcode", "🎒", "📚", "💻"],
        music: ["guitar", "jam", "music", "vinyl", "sing", "beat", "lofi", "karaoke", "concert", "piano", "rap", "podcast", "spotify", "🎸", "🎧", "🎤"],
        sports: ["gym", "run", "walk", "bike", "swim", "sport", "workout", "yoga", "cricket", "football", "basketball", "badminton", "trek", "hike", "🛹", "🏋️", "🚴", "🏃", "🧘"],
        chill: ["chill", "vibe", "hangout", "drive", "explore", "roam", "wander", "sunset", "night", "midnight", "smoke", "terrace", "rooftop", "🎨", "⚡", "📷", "🌿", "🍳", "🚗", "🌙"]
    };
    function matchesFilter(intent, key) {
        if (key === "all")
            return true;
        var keywords = FILTER_KEYWORDS[key];
        if (!keywords)
            return true;
        var t = (intent.title || "").toLowerCase();
        return keywords.some(function (k) { return t.includes(k); });
    }
    function matchesUserFilter(u, key) {
        if (key === "all")
            return true;
        var keywords = FILTER_KEYWORDS[key];
        if (!keywords)
            return true;
        // Match by vibe emoji
        var userVibe = u.vibeEmoji || "";
        if (keywords.includes(userVibe))
            return true;
        // Match by bio or tags
        var bio = (u.bio || "").toLowerCase();
        var tags = u.selectedTags || [];
        if (keywords.some(function (k) { return bio.includes(k); }))
            return true;
        if (tags.some(function (tag) { return keywords.some(function (k) { return tag.toLowerCase().includes(k); }); }))
            return true;
        return false;
    }
    // Filter lists based on user settings and ranges
    var radarRadius = (profile === null || profile === void 0 ? void 0 : profile.radarRange) || 15;
    var filteredUsers = react_1.useMemo(function () {
        var blockedIds = __spreadArrays(((profile === null || profile === void 0 ? void 0 : profile.blockedUsers) || []), localBlocks);
        if (!location)
            return [];
        return activeUsers.filter(function (u) {
            var isBlocked = blockedIds.includes(u.user_id) || (u.blockedUsers || []).includes(myUserId);
            var isWithinRange = useGeolocation_1.getDistanceKm(location.lat, location.lng, u.lat, u.lng) <= radarRadius;
            var isMatchesFilter = matchesUserFilter(u, selectedFilter);
            return !isBlocked && isWithinRange && isMatchesFilter;
        });
    }, [activeUsers, profile === null || profile === void 0 ? void 0 : profile.blockedUsers, localBlocks, location, radarRadius, selectedFilter, myUserId]);
    var filteredHotspots = react_1.useMemo(function () {
        var blockedIds = __spreadArrays(((profile === null || profile === void 0 ? void 0 : profile.blockedUsers) || []), localBlocks);
        if (!location)
            return [];
        return intents.filter(function (h) {
            var isBlocked = blockedIds.includes(h.host_id);
            var dist = useGeolocation_1.getDistanceKm(location.lat, location.lng, h.lat, h.lng);
            var isWithinRange = dist <= radarRadius && dist <= (h.hotspotRange || 15);
            var isNotExpired = h.expires_at > Date.now();
            var isMatchesFilter = matchesFilter(h, selectedFilter);
            return !isBlocked && isWithinRange && isNotExpired && isMatchesFilter;
        });
    }, [intents, profile === null || profile === void 0 ? void 0 : profile.blockedUsers, localBlocks, location, radarRadius, selectedFilter]);
    var contextValue = react_1.useMemo(function () { return ({
        myUserId: myUserId,
        handle: handle,
        vibeEmoji: vibeEmoji,
        myAvatarUrl: myAvatarUrl,
        localBlocks: localBlocks,
        location: location,
        locStatus: locStatus,
        isStasis: isStasis,
        accuracy: accuracy,
        accuracySource: accuracySource,
        refreshRadar: refreshRadar,
        socketReady: socket.socketReady,
        connectionState: socket.connectionState,
        offlineMessages: socket.offlineMessages,
        connectionFailed: socket.connectionFailed,
        zoom: zoom,
        setZoom: setZoom,
        recenterTrigger: recenterTrigger,
        followUser: followUser,
        setFollowUser: setFollowUser,
        isInteracting: isInteracting,
        setIsInteracting: setIsInteracting,
        selectedFilter: selectedFilter,
        setSelectedFilter: setSelectedFilter,
        selectedUser: selectedUser,
        setSelectedUser: setSelectedUser,
        selectedHotspot: selectedHotspot,
        setSelectedHotspot: setSelectedHotspot,
        showIntentModal: showIntentModal,
        setShowIntentModal: setShowIntentModal,
        intentText: intentText,
        setIntentText: setIntentText,
        customHotspotRange: customHotspotRange,
        setCustomHotspotRange: setCustomHotspotRange,
        hasWaved: hasWaved,
        setHasWaved: setHasWaved,
        confirmBlock: confirmBlock,
        setConfirmBlock: setConfirmBlock,
        toasts: toasts,
        addToast: addToast,
        notifications: notifications,
        setNotifications: setNotifications,
        showNotifDropdown: showNotifDropdown,
        setShowNotifDropdown: setShowNotifDropdown,
        activeWaves: activeWaves,
        handleWave: handleWave,
        handleBlock: handleBlock,
        postIntent: postIntent,
        requestJoin: requestJoin,
        respondRequest: respondRequest,
        sendMessage: sendMessage,
        leaveHotspot: leaveHotspot,
        chatRequests: chatRequests,
        friends: friends,
        chatMessages: chatMessages,
        peerTyping: peerTyping,
        activeChatUser: activeChatUser,
        setActiveChatUser: setActiveChatUser,
        sendChatRequest: sendChatRequest,
        respondChatRequest: respondChatRequest,
        sendDirectMessage: sendDirectMessage,
        sendTypingState: sendTypingState,
        requestDMHistory: requestDMHistory,
        isLoadingHistory: isLoadingHistory,
        unreadMessagesCount: unreadMessagesCount,
        isBroadcastingAudio: webRTC.isBroadcastingAudio,
        startBroadcast: webRTC.startBroadcast,
        stopBroadcast: webRTC.stopBroadcast,
        startListening: webRTC.startListening,
        stopListening: webRTC.stopListening,
        incomingStreams: webRTC.incomingStreams,
        isSpeakerMuted: isSpeakerMuted,
        setIsSpeakerMuted: setIsSpeakerMuted,
        filteredUsers: filteredUsers,
        filteredHotspots: filteredHotspots,
        activeUsers: activeUsers,
        activeRoute: activeRoute,
        activeRouteMode: activeRouteMode,
        setActiveRouteMode: setActiveRouteMode,
        routingTarget: routingTarget,
        setRoutingTarget: setRoutingTarget,
        isLoadingRoute: isLoadingRoute,
        clearActiveRoute: clearActiveRoute
    }); }, [
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
        chatRequests,
        friends,
        chatMessages,
        peerTyping,
        activeChatUser,
        isLoadingHistory,
        unreadMessagesCount,
        webRTC.isBroadcastingAudio,
        webRTC.incomingStreams,
        isSpeakerMuted,
        filteredUsers,
        filteredHotspots,
        activeUsers,
        activeRoute,
        activeRouteMode,
        routingTarget,
        isLoadingRoute,
    ]);
    return (React.createElement(MapContext.Provider, { value: contextValue }, children));
}
exports.MapProvider = MapProvider;
function useMapContext() {
    var context = react_1.useContext(MapContext);
    if (!context) {
        throw new Error("useMapContext must be used within a MapProvider");
    }
    return context;
}
exports.useMapContext = useMapContext;
