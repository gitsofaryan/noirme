"use client";
"use strict";
exports.__esModule = true;
var MapProvider_1 = require("@/components/Map/MapProvider");
var useAuth_1 = require("@/hooks/useAuth");
var useGeolocation_1 = require("@/hooks/useGeolocation");
var navigation_1 = require("next/navigation");
var lucide_react_1 = require("lucide-react");
var react_1 = require("react");
var framer_motion_1 = require("framer-motion");
function ChatPage() {
    var router = navigation_1.useRouter();
    var _a = useAuth_1.useAuth(), isSignedIn = _a.isSignedIn, signIn = _a.signIn;
    var _b = MapProvider_1.useMapContext(), myUserId = _b.myUserId, chatRequests = _b.chatRequests, friends = _b.friends, chatMessages = _b.chatMessages, peerTyping = _b.peerTyping, activeChatUser = _b.activeChatUser, setActiveChatUser = _b.setActiveChatUser, sendChatRequest = _b.sendChatRequest, respondChatRequest = _b.respondChatRequest, sendDirectMessage = _b.sendDirectMessage, sendTypingState = _b.sendTypingState, setRoutingTarget = _b.setRoutingTarget, setFollowUser = _b.setFollowUser, addToast = _b.addToast, isLoadingHistory = _b.isLoadingHistory, activeUsers = _b.activeUsers, filteredHotspots = _b.filteredHotspots, location = _b.location, selectedHotspot = _b.selectedHotspot, setSelectedHotspot = _b.setSelectedHotspot, requestJoin = _b.requestJoin;
    var _c = react_1.useState("chats"), activeTab = _c[0], setActiveTab = _c[1];
    var _d = react_1.useState(""), typedMessage = _d[0], setTypedMessage = _d[1];
    var messagesEndRef = react_1.useRef(null);
    var typingTimeoutRef = react_1.useRef(null);
    var isTypingRef = react_1.useRef(false);
    // Auto scroll messages
    react_1.useEffect(function () {
        var _a;
        (_a = messagesEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages, peerTyping]);
    // Handle typing state broadcast
    var handleInputChange = function (e) {
        setTypedMessage(e.target.value);
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            sendTypingState(true);
        }
        if (typingTimeoutRef.current)
            clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(function () {
            isTypingRef.current = false;
            sendTypingState(false);
        }, 3000);
    };
    var handleSendMessage = function (e) {
        e.preventDefault();
        if (!typedMessage.trim())
            return;
        sendDirectMessage(typedMessage.trim());
        setTypedMessage("");
        isTypingRef.current = false;
        sendTypingState(false);
        if (typingTimeoutRef.current)
            clearTimeout(typingTimeoutRef.current);
    };
    var handleNavigateToFriend = function (friend) {
        if (friend.lat && friend.lng) {
            setRoutingTarget({
                lat: friend.lat,
                lng: friend.lng,
                name: friend.username
            });
            setFollowUser(true);
            addToast("Routing path to @" + friend.username + "...");
            router.push("/");
        }
        else {
            addToast("@" + friend.username + " is currently offline or location is not shared.");
        }
    };
    if (!isSignedIn) {
        return (React.createElement("div", { className: "absolute inset-0 flex items-center justify-center p-6 bg-zinc-50 text-zinc-900 select-none" },
            React.createElement(framer_motion_1.motion.div, { initial: { opacity: 0, scale: 0.95 }, animate: { opacity: 1, scale: 1 }, className: "w-full max-w-md p-8 rounded-3xl bg-white border border-zinc-200/80 shadow-xl text-center" },
                React.createElement("div", { className: "w-16 h-16 mx-auto mb-6 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-150" },
                    React.createElement(lucide_react_1.MessageSquare, { className: "w-8 h-8 text-zinc-400" })),
                React.createElement("h2", { className: "text-2xl font-bold tracking-tight mb-2 text-zinc-900" }, "Connect & Chat"),
                React.createElement("p", { className: "text-sm text-zinc-500 mb-8 max-w-xs mx-auto leading-relaxed" }, "Sign in to connect with nearby users, send chat requests, and start exchanging ephemeral messages."),
                React.createElement("button", { onClick: signIn, className: "w-full py-4 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-black active:scale-95 transition-all shadow-md cursor-pointer" }, "Sign In with Puter"))));
    }
    // Split requests
    var incomingRequests = chatRequests.filter(function (r) { return r.target_id === myUserId && r.status === "pending"; });
    var outgoingRequests = chatRequests.filter(function (r) { return r.sender_id === myUserId && r.status === "pending"; });
    return (React.createElement("div", { className: "absolute inset-0 bg-zinc-50 text-zinc-900 flex overflow-hidden" },
        React.createElement("div", { className: "w-full h-full flex z-10" },
            React.createElement("div", { className: "w-full md:w-[380px] h-full border-r border-zinc-150 flex flex-col bg-white " + (activeChatUser ? "hidden md:flex" : "flex") },
                React.createElement("div", { className: "p-6 border-b border-zinc-100 flex flex-col gap-4" },
                    React.createElement("h1", { className: "text-2xl font-black tracking-tight text-zinc-900" }, "Messages"),
                    React.createElement("div", { className: "flex bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/50" },
                        React.createElement("button", { onClick: function () { return setActiveTab("chats"); }, className: "flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer " + (activeTab === "chats"
                                ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/40"
                                : "text-zinc-500 hover:text-zinc-900") },
                            "Chats (",
                            friends.length,
                            ")"),
                        React.createElement("button", { onClick: function () { return setActiveTab("hotspots"); }, className: "flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer " + (activeTab === "hotspots"
                                ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/40"
                                : "text-zinc-500 hover:text-zinc-900") },
                            "Hotspots (",
                            filteredHotspots.length,
                            ")"),
                        React.createElement("button", { onClick: function () { return setActiveTab("requests"); }, className: "flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all relative cursor-pointer " + (activeTab === "requests"
                                ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/40"
                                : "text-zinc-500 hover:text-zinc-900") },
                            "Requests",
                            incomingRequests.length > 0 && (React.createElement("span", { className: "absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 rounded-full text-[9px] flex items-center justify-center font-extrabold text-white" }, incomingRequests.length))))),
                React.createElement("div", { className: "flex-1 overflow-y-auto px-4 py-2 space-y-1 bg-white" },
                    React.createElement(framer_motion_1.AnimatePresence, { mode: "popLayout" }, activeTab === "chats" ? (friends.length === 0 ? (React.createElement(framer_motion_1.motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-400 select-none" },
                        React.createElement(lucide_react_1.MessageSquare, { className: "w-8 h-8 mb-3 opacity-40 text-zinc-300" }),
                        React.createElement("p", { className: "text-sm font-bold text-zinc-700" }, "No active conversations"),
                        React.createElement("p", { className: "text-xs opacity-85 mt-1 max-w-[200px] leading-normal" }, "Wave or request chat from nearby users on the map to start chatting!"))) : (friends.map(function (friend) {
                        var isTyping = peerTyping[friend.user_id];
                        var isSelected = (activeChatUser === null || activeChatUser === void 0 ? void 0 : activeChatUser.user_id) === friend.user_id;
                        return (React.createElement(framer_motion_1.motion.button, { key: friend.user_id, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, onClick: function () {
                                setActiveChatUser(friend);
                                router.push("/chat/" + friend.username);
                            }, className: "w-full p-3.5 rounded-2xl flex items-center gap-3.5 transition-all text-left border cursor-pointer " + (isSelected
                                ? "bg-zinc-50 border-zinc-200/80 shadow-sm"
                                : "bg-transparent border-transparent hover:bg-zinc-50/60") },
                            React.createElement("div", { className: "relative" },
                                React.createElement("div", { className: "w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden border border-zinc-150" },
                                    React.createElement("img", { src: friend.avatar_url || useAuth_1.getAvatarUrl(friend.username || friend.user_id), alt: "", className: "w-full h-full object-cover" })),
                                React.createElement("div", { className: "absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center" },
                                    React.createElement("span", { className: "text-[9px] font-extrabold" }, friend.vibeEmoji))),
                            React.createElement("div", { className: "flex-1 min-w-0" },
                                React.createElement("div", { className: "flex justify-between items-baseline mb-0.5" },
                                    React.createElement("h3", { className: "font-bold text-sm tracking-tight text-zinc-900 truncate" },
                                        "@",
                                        friend.username),
                                    React.createElement("span", { className: "text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider" }, friend.status === "away" ? "Away" : "Active")),
                                React.createElement("p", { className: "text-xs text-zinc-500 truncate font-medium" }, isTyping ? (React.createElement("span", { className: "text-purple-600 font-bold animate-pulse" }, "Typing...")) : (friend.bio || "Tap to chat")))));
                    }))) : activeTab === "hotspots" ? (filteredHotspots.length === 0 ? (React.createElement(framer_motion_1.motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, className: "h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-400 select-none" },
                        React.createElement(lucide_react_1.Navigation, { className: "w-8 h-8 mb-3 opacity-40 text-zinc-300 animate-pulse" }),
                        React.createElement("p", { className: "text-sm font-bold text-zinc-700" }, "No hotspots nearby"),
                        React.createElement("p", { className: "text-xs opacity-85 mt-1 max-w-[200px] leading-normal" }, "Be the first to post a gathering intent on the map!"))) : (React.createElement("div", { className: "space-y-3 pt-2" }, filteredHotspots.map(function (hotspot) {
                        var _a, _b, _c;
                        var isHost = hotspot.host_id === myUserId;
                        var hasPending = (_a = hotspot.requests) === null || _a === void 0 ? void 0 : _a.some(function (r) { return r.user_id === myUserId && r.status === "pending"; });
                        var isMember = (_b = hotspot.requests) === null || _b === void 0 ? void 0 : _b.some(function (r) { return r.user_id === myUserId && r.status === "accepted"; });
                        var distance = location
                            ? useGeolocation_1.getDistanceKm(location.lat, location.lng, hotspot.lat, hotspot.lng)
                            : null;
                        return (React.createElement(framer_motion_1.motion.div, { key: hotspot.id, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, scale: 0.95 }, className: "p-4 bg-zinc-50 border border-zinc-150 rounded-2xl flex flex-col gap-3 shadow-sm hover:border-zinc-200 transition-all" },
                            React.createElement("div", { className: "flex items-center gap-3" },
                                React.createElement("div", { className: "relative" },
                                    React.createElement("div", { className: "w-10 h-10 rounded-xl bg-zinc-150 overflow-hidden border border-zinc-200 flex-shrink-0" },
                                        React.createElement("img", { src: hotspot.host_avatar || useAuth_1.getAvatarUrl(hotspot.host_username), alt: "", className: "w-full h-full object-cover" })),
                                    React.createElement("div", { className: "absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center" },
                                        React.createElement("span", { className: "text-[9px] font-extrabold" }, hotspot.vibeEmoji || "🔥"))),
                                React.createElement("div", { className: "flex-1 min-w-0" },
                                    React.createElement("h4", { className: "text-xs font-black text-zinc-400 uppercase tracking-widest leading-none mb-1" }, isHost ? "Your Hotspot" : "@" + hotspot.host_username),
                                    React.createElement("h3", { className: "font-extrabold text-sm text-zinc-900 truncate leading-snug" }, hotspot.title),
                                    React.createElement("p", { className: "text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mt-0.5 leading-none" },
                                        "\uD83D\uDCCD ",
                                        distance !== null ? distance.toFixed(2) + " km" : "Nearby",
                                        " \u00B7 ",
                                        ((_c = hotspot.requests) === null || _c === void 0 ? void 0 : _c.filter(function (r) { return r.status === "accepted"; }).length) || 0,
                                        " joined"))),
                            React.createElement("div", { className: "flex gap-2" }, isHost || isMember ? (React.createElement("button", { onClick: function () {
                                    setSelectedHotspot(hotspot);
                                    router.push("/");
                                }, className: "flex-1 py-2 px-3 bg-zinc-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm text-center cursor-pointer font-extrabold" }, "View on Map")) : hasPending ? (React.createElement("button", { disabled: true, className: "flex-1 py-2 px-3 bg-zinc-200 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-not-allowed text-center border border-zinc-300/30 font-extrabold" }, "Pending Request")) : (React.createElement("button", { onClick: function () {
                                    setSelectedHotspot(hotspot);
                                    requestJoin(hotspot.id);
                                    addToast("Requested to join @" + hotspot.host_username + "'s gathering!");
                                }, className: "flex-1 py-2 px-3 bg-zinc-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm text-center cursor-pointer font-extrabold" }, "Request to Join")))));
                    })))) : (
                    /* Requests tab content */
                    React.createElement("div", { className: "space-y-4 pt-2" },
                        React.createElement("div", null,
                            React.createElement("h2", { className: "text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2 flex items-center gap-1.5" },
                                React.createElement(lucide_react_1.UserPlus, { className: "w-3.5 h-3.5" }),
                                " Incoming (",
                                incomingRequests.length,
                                ")"),
                            incomingRequests.length === 0 ? (React.createElement("p", { className: "text-xs text-zinc-400 px-2 italic" }, "No pending incoming requests")) : (incomingRequests.map(function (req) { return (React.createElement(framer_motion_1.motion.div, { key: req.sender_id, initial: { opacity: 0, y: 5 }, animate: { opacity: 1, y: 0 }, className: "p-3 bg-zinc-50 border border-zinc-150 rounded-2xl flex items-center justify-between gap-3 mb-2" },
                                React.createElement("div", { className: "flex items-center gap-2.5 min-w-0" },
                                    React.createElement("div", { className: "w-10 h-10 rounded-lg bg-zinc-150 overflow-hidden flex-shrink-0 border border-zinc-200" },
                                        React.createElement("img", { src: req.sender_avatar, alt: "", className: "w-full h-full object-cover" })),
                                    React.createElement("span", { className: "text-sm font-bold text-zinc-800 truncate" },
                                        "@",
                                        req.sender_username)),
                                React.createElement("div", { className: "flex gap-1.5 flex-shrink-0" },
                                    React.createElement("button", { onClick: function () { return respondChatRequest(req.sender_id, "accepted"); }, className: "p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all active:scale-95 shadow-sm cursor-pointer" },
                                        React.createElement(lucide_react_1.Check, { className: "w-3.5 h-3.5", strokeWidth: 2.5 })),
                                    React.createElement("button", { onClick: function () { return respondChatRequest(req.sender_id, "rejected"); }, className: "p-2 rounded-xl bg-zinc-200 text-zinc-600 hover:bg-zinc-300 transition-all active:scale-95 cursor-pointer border border-zinc-300/30" },
                                        React.createElement(lucide_react_1.X, { className: "w-3.5 h-3.5", strokeWidth: 2.5 }))))); }))),
                        React.createElement("div", { className: "pt-2 border-t border-zinc-100" },
                            React.createElement("h2", { className: "text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2 flex items-center gap-1.5" },
                                React.createElement(lucide_react_1.UserCheck, { className: "w-3.5 h-3.5" }),
                                " Outgoing (",
                                outgoingRequests.length,
                                ")"),
                            outgoingRequests.length === 0 ? (React.createElement("p", { className: "text-xs text-zinc-400 px-2 italic" }, "No pending outgoing requests")) : (outgoingRequests.map(function (req) {
                                var targetUser = activeUsers.find(function (u) { return u.user_id === req.target_id; });
                                var displayName = targetUser ? "@" + targetUser.username : "User (" + req.target_id.substring(0, 8) + "...)";
                                return (React.createElement("div", { key: req.target_id, className: "p-3 bg-zinc-50/50 border border-zinc-150 rounded-2xl flex items-center justify-between" },
                                    React.createElement("span", { className: "text-xs font-bold text-zinc-500" },
                                        "Connection to ",
                                        displayName,
                                        " pending..."),
                                    React.createElement("span", { className: "text-[9px] bg-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full font-bold" }, "Sent")));
                            })))))))),
            React.createElement("div", { className: "flex-1 h-full flex flex-col bg-zinc-50 relative " + (!activeChatUser ? "hidden md:flex" : "flex") }, activeChatUser ? (React.createElement(React.Fragment, null,
                React.createElement("div", { className: "p-4 border-b border-zinc-150 bg-white shadow-sm z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4" },
                    React.createElement("div", { className: "flex items-center gap-3 min-w-0 flex-1" },
                        React.createElement("button", { onClick: function () {
                                setActiveChatUser(null);
                                router.push("/chat");
                            }, className: "p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95 md:hidden transition-all cursor-pointer flex-shrink-0" },
                            React.createElement(lucide_react_1.ArrowLeft, { className: "w-5 h-5" })),
                        React.createElement("div", { className: "relative flex-shrink-0" },
                            React.createElement("div", { className: "w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden border border-zinc-200" },
                                React.createElement("img", { src: activeChatUser.avatar_url || useAuth_1.getAvatarUrl(activeChatUser.username || activeChatUser.user_id), alt: "", className: "w-full h-full object-cover" })),
                            React.createElement("div", { className: "absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center" },
                                React.createElement("span", { className: "text-[9px] font-extrabold" }, activeChatUser.vibeEmoji))),
                        React.createElement("div", { className: "min-w-0 flex-1" },
                            React.createElement("h2", { className: "font-bold text-base text-zinc-950 truncate leading-tight" },
                                "@",
                                activeChatUser.username),
                            React.createElement("div", { className: "text-[10px] text-zinc-400 flex items-center gap-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis" },
                                React.createElement(lucide_react_1.Clock, { className: "w-2.5 h-2.5 text-zinc-300 flex-shrink-0" }),
                                " 1h vanish mode"))),
                    React.createElement("div", { className: "flex items-center gap-2 flex-shrink-0" },
                        React.createElement("button", { onClick: function () { return handleNavigateToFriend(activeChatUser); }, className: "px-4 py-2 rounded-xl bg-zinc-900 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-black active:scale-95 transition-all shadow-sm cursor-pointer whitespace-nowrap" },
                            React.createElement(lucide_react_1.Navigation, { className: "w-3.5 h-3.5 fill-white text-white" }),
                            React.createElement("span", { className: "hidden sm:inline" }, "Directions")))),
                React.createElement("div", { className: "flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 flex flex-col bg-white md:bg-zinc-50" },
                    React.createElement("div", { className: "w-full py-3 px-4 rounded-2xl bg-white border border-zinc-200/60 flex items-center justify-center gap-2 text-center select-none mb-2 shadow-sm" },
                        React.createElement(lucide_react_1.Sparkles, { className: "w-4 h-4 text-purple-500 flex-shrink-0" }),
                        React.createElement("span", { className: "text-xs font-bold text-zinc-500 leading-tight" }, "Chat history automatically vanishes 1 hour after transmission.")),
                    isLoadingHistory ? (React.createElement("div", { className: "flex-1 flex flex-col items-center justify-center py-12 text-zinc-400 select-none" },
                        React.createElement(lucide_react_1.Loader2, { className: "w-8 h-8 animate-spin text-zinc-400 mb-3" }),
                        React.createElement("p", { className: "text-sm font-bold text-zinc-700" }, "Loading chat history..."),
                        React.createElement("p", { className: "text-xs opacity-85 mt-1" }, "Fetching ephemeral messages"))) : chatMessages.length === 0 ? (React.createElement("div", { className: "flex-1 flex flex-col items-center justify-center text-zinc-400 select-none py-12" },
                        React.createElement(lucide_react_1.MessageSquare, { className: "w-10 h-10 mb-3 opacity-40 text-zinc-300" }),
                        React.createElement("p", { className: "text-sm font-bold text-zinc-700" },
                            "Say hello to @",
                            activeChatUser.username,
                            "!"),
                        React.createElement("p", { className: "text-xs opacity-85 mt-1" }, "Start typing below to connect instantly."))) : (chatMessages.map(function (msg) {
                        var isMe = msg.sender_id === myUserId;
                        var date = new Date(msg.timestamp);
                        var timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        return (React.createElement(framer_motion_1.motion.div, { key: msg.id, initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, className: "flex flex-col max-w-[85%] md:max-w-[60%] " + (isMe ? "self-end items-end" : "self-start items-start") },
                            React.createElement("div", { className: "px-4 md:px-4.5 py-3 rounded-2xl text-sm font-medium leading-relaxed break-words transition-all " + (isMe
                                    ? "bg-zinc-900 text-white rounded-br-none shadow-md hover:shadow-lg"
                                    : "bg-white border border-zinc-200/60 text-zinc-900 rounded-bl-none shadow-sm hover:shadow-md") }, msg.text),
                            React.createElement("span", { className: "text-[8px] md:text-[9px] text-zinc-400 font-extrabold mt-1 px-1.5 select-none" }, timeStr)));
                    })),
                    peerTyping[activeChatUser.user_id] && (React.createElement("div", { className: "self-start flex flex-col items-start max-w-[70%]" },
                        React.createElement("div", { className: "px-4.5 py-3.5 bg-white border border-zinc-150 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm" },
                            React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" }),
                            React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" }),
                            React.createElement("span", { className: "w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" })))),
                    React.createElement("div", { ref: messagesEndRef })),
                React.createElement("form", { onSubmit: handleSendMessage, className: "p-4 border-t border-zinc-150 bg-white flex items-center gap-3" },
                    React.createElement("input", { type: "text", value: typedMessage, onChange: handleInputChange, maxLength: 200, placeholder: "Message @" + activeChatUser.username + "...", className: "flex-1 py-3.5 px-4.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-zinc-300 focus:bg-white transition-all font-medium" }),
                    React.createElement("button", { type: "submit", disabled: !typedMessage.trim(), className: "p-3.5 rounded-2xl bg-zinc-900 text-white font-bold disabled:opacity-40 disabled:scale-100 hover:bg-black hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer" },
                        React.createElement(lucide_react_1.Send, { className: "w-4 h-4 fill-white text-white" }))))) : (
            // Desktop placeholder when no active conversation selected
            React.createElement("div", { className: "flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center text-zinc-400 select-none" },
                React.createElement("div", { className: "w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-zinc-150 mb-4 shadow-sm" },
                    React.createElement(lucide_react_1.MessageSquare, { className: "w-8 h-8 text-zinc-300" })),
                React.createElement("h3", { className: "text-base font-bold text-zinc-700 mb-1" }, "Select a Conversation"),
                React.createElement("p", { className: "text-xs text-zinc-400 max-w-xs leading-normal" }, "Choose a contact from the list or accept pending connection requests to start exchanging end-to-end 1-hour self-destructing messages.")))))));
}
exports["default"] = ChatPage;
