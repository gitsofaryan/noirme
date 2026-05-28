"use client";
"use strict";
exports.__esModule = true;
exports.UserDrawer = void 0;
var MapProvider_1 = require("../MapProvider");
var useAuth_1 = require("@/hooks/useAuth");
var useGeolocation_1 = require("@/hooks/useGeolocation");
var framer_motion_1 = require("framer-motion");
var lucide_react_1 = require("lucide-react");
var navigation_1 = require("next/navigation");
function UserDrawer() {
    var router = navigation_1.useRouter();
    var isSignedIn = useAuth_1.useAuth().isSignedIn;
    var _a = MapProvider_1.useMapContext(), location = _a.location, selectedUser = _a.selectedUser, setSelectedUser = _a.setSelectedUser, hasWaved = _a.hasWaved, confirmBlock = _a.confirmBlock, setConfirmBlock = _a.setConfirmBlock, handleWave = _a.handleWave, handleBlock = _a.handleBlock, setRoutingTarget = _a.setRoutingTarget, myUserId = _a.myUserId, startListening = _a.startListening, stopListening = _a.stopListening, incomingStreams = _a.incomingStreams;
    var _b = MapProvider_1.useSocialContext(), chatRequests = _b.chatRequests, sendChatRequest = _b.sendChatRequest;
    var setActiveChatUser = MapProvider_1.useDMContext().setActiveChatUser;
    var requestSent = selectedUser
        ? chatRequests.find(function (r) { return r.sender_id === myUserId && r.target_id === selectedUser.user_id; })
        : null;
    var requestReceived = selectedUser
        ? chatRequests.find(function (r) { return r.sender_id === selectedUser.user_id && r.target_id === myUserId; })
        : null;
    var isPendingSent = !!(requestSent && requestSent.status === "pending");
    var isPendingReceived = !!(requestReceived && requestReceived.status === "pending");
    var isConnected = !!((requestSent && requestSent.status === "accepted") ||
        (requestReceived && requestReceived.status === "accepted"));
    return (React.createElement(framer_motion_1.AnimatePresence, null, selectedUser && (React.createElement(React.Fragment, null,
        React.createElement(framer_motion_1.motion.div, { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, onClick: function () { return setSelectedUser(null); }, className: "fixed inset-0 bg-black/10 z-[890] backdrop-blur-[1px]" }),
        React.createElement(framer_motion_1.motion.div, { initial: { y: "100%", opacity: 0.95 }, animate: { y: 0, opacity: 1 }, exit: { y: "100%", opacity: 0.95 }, transition: { type: "spring", stiffness: 350, damping: 35 }, className: "fixed bottom-16 left-4 right-4 z-[900] max-w-lg mx-auto bg-white rounded-3xl border border-zinc-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] overflow-hidden" },
            React.createElement("div", { className: "flex justify-center pt-3 pb-1 bg-white" },
                React.createElement("div", { className: "w-10 h-1 rounded-full bg-zinc-200" })),
            React.createElement("div", { className: "px-5 pb-6 bg-white max-h-[70vh] overflow-y-auto scrollbar-none space-y-4" },
                React.createElement("div", { className: "flex justify-between items-start gap-3 border-b border-zinc-100 pb-4" },
                    React.createElement("div", { className: "flex items-center gap-3" },
                        React.createElement("div", { className: "relative" },
                            React.createElement("img", { src: selectedUser.avatar_url || useAuth_1.getAvatarUrl(selectedUser.username), className: "w-14 h-14 rounded-full object-cover border border-zinc-150 bg-zinc-50", alt: selectedUser.username }),
                            React.createElement("div", { className: "absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-sm shadow-sm" }, selectedUser.vibeEmoji || "🙂")),
                        React.createElement("div", null,
                            React.createElement("h3", { className: "text-base font-bold text-zinc-900 leading-tight" }, selectedUser.username),
                            React.createElement("p", { className: "text-[10px] text-zinc-400 font-semibold mt-0.5" },
                                selectedUser.age ? selectedUser.age + " y/o" : "Age not shared",
                                " \u00B7 ",
                                selectedUser.gender || "Gender not shared"),
                            React.createElement("p", { className: "text-[10px] text-zinc-450 mt-1 flex items-center gap-1 font-bold" },
                                React.createElement(lucide_react_1.MapPin, { size: 10, className: "text-zinc-400" }),
                                (function () {
                                    if (!location)
                                        return "Unknown distance";
                                    var dist = useGeolocation_1.getDistanceKm(location.lat, location.lng, selectedUser.lat, selectedUser.lng);
                                    return dist < 0.1 ? "Here" : dist.toFixed(1) + " km away";
                                })()))),
                    React.createElement("button", { onClick: function () { return setSelectedUser(null); }, className: "p-1.5 rounded-full bg-zinc-50 text-zinc-450 hover:text-zinc-655 hover:bg-zinc-100 transition-colors" },
                        React.createElement(lucide_react_1.X, { size: 14 }))),
                React.createElement("div", { className: "space-y-1.5" },
                    React.createElement("h4", { className: "text-[10px] font-bold tracking-widest uppercase text-zinc-400" }, "Tagline"),
                    React.createElement("p", { className: "text-xs text-zinc-700 leading-relaxed font-medium bg-zinc-50 rounded-2xl p-4 border border-zinc-100" }, selectedUser.bio || "No tagline set.")),
                selectedUser.selectedTags && selectedUser.selectedTags.length > 0 && (React.createElement("div", { className: "space-y-2" },
                    React.createElement("h4", { className: "text-[10px] font-bold tracking-widest uppercase text-zinc-400" }, "Interests"),
                    React.createElement("div", { className: "flex flex-wrap gap-1.5" }, selectedUser.selectedTags.map(function (tag) { return (React.createElement("span", { key: tag, className: "px-3 py-1.5 bg-zinc-100 rounded-full text-[10px] font-semibold text-zinc-600" }, tag)); })))),
                React.createElement("div", { className: "flex flex-col gap-3.5 pt-2" },
                    React.createElement("button", { onClick: function () {
                            if (typeof navigator !== "undefined" && navigator.vibrate) {
                                navigator.vibrate(10);
                            }
                            setRoutingTarget({
                                lat: selectedUser.lat,
                                lng: selectedUser.lng,
                                name: "@" + selectedUser.username
                            });
                            setSelectedUser(null);
                        }, className: "w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer" },
                        React.createElement(lucide_react_1.Navigation, { size: 13 }),
                        " Get Directions"),
                    isSignedIn && isConnected && selectedUser.is_broadcasting_audio && (React.createElement("div", { className: "bg-zinc-50/80 rounded-2xl p-3.5 border border-zinc-100 space-y-2" },
                        React.createElement("p", { className: "text-[9px] font-bold tracking-widest uppercase text-zinc-400" }, "Live Audio Broadcast"),
                        React.createElement("button", { onClick: function () {
                                if (incomingStreams[selectedUser.user_id]) {
                                    stopListening(selectedUser.user_id);
                                }
                                else {
                                    startListening(selectedUser.user_id);
                                }
                            }, className: "w-full py-3 px-3 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm " + (incomingStreams[selectedUser.user_id]
                                ? "bg-zinc-900 border-zinc-900 text-white"
                                : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50") }, incomingStreams[selectedUser.user_id] ? (React.createElement(React.Fragment, null,
                            React.createElement(lucide_react_1.Volume2, { size: 13, className: "animate-pulse" }),
                            " Stop Listening \uD83C\uDFA7")) : (React.createElement(React.Fragment, null,
                            React.createElement(lucide_react_1.VolumeX, { size: 13 }),
                            " Listen Live \uD83C\uDFA7"))))),
                    (function () {
                        if (isConnected) {
                            return (React.createElement("button", { onClick: function () {
                                    var friendDetails = {
                                        user_id: selectedUser.user_id,
                                        username: selectedUser.username,
                                        avatar_url: selectedUser.avatar_url,
                                        vibeEmoji: selectedUser.vibeEmoji
                                    };
                                    setActiveChatUser(friendDetails);
                                    setSelectedUser(null);
                                    router.push("/chat");
                                }, className: "w-full py-3.5 rounded-2xl bg-purple-650 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm" }, "Open Chat \uD83D\uDCAC"));
                        }
                        else if (isPendingSent) {
                            return (React.createElement("button", { disabled: true, className: "w-full py-3.5 rounded-2xl bg-zinc-100 text-zinc-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed border border-zinc-200/50" }, "Request Pending... \u2709\uFE0F"));
                        }
                        else if (isPendingReceived) {
                            return (React.createElement("button", { onClick: function () {
                                    setSelectedUser(null);
                                    router.push("/chat");
                                }, className: "w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm" }, "Respond to Request \uD83D\uDCAC"));
                        }
                        else {
                            return (React.createElement("button", { onClick: function () {
                                    sendChatRequest(selectedUser.user_id);
                                }, className: "w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer" }, "Request to Connect \uD83D\uDCAC"));
                        }
                    })(),
                    React.createElement("div", { className: "flex gap-3" },
                        React.createElement("button", { onClick: function () {
                                if (confirmBlock) {
                                    handleBlock(selectedUser.user_id);
                                }
                                else {
                                    setConfirmBlock(true);
                                }
                            }, className: "flex-1 py-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] " + (confirmBlock
                                ? "border-rose-650 bg-rose-650 text-white hover:bg-rose-700"
                                : "border-rose-200 hover:bg-rose-50 text-rose-650") }, confirmBlock ? "Confirm Block?" : "Block / Report"),
                        React.createElement("button", { onClick: handleWave, disabled: hasWaved, className: "flex-1 py-3.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 " + (hasWaved
                                ? "bg-emerald-500 text-white"
                                : "bg-zinc-900 text-white hover:bg-black active:scale-[0.98]") }, hasWaved ? "Waved! 👋" : "Wave 👋")))))))));
}
exports.UserDrawer = UserDrawer;
