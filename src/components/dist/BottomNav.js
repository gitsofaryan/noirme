"use client";
"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var lucide_react_1 = require("lucide-react");
var framer_motion_1 = require("framer-motion");
var MapProvider_1 = require("@/components/Map/MapProvider");
var useAuth_1 = require("@/hooks/useAuth");
var useLoading_1 = require("@/hooks/useLoading");
function BottomNav() {
    var pathname = navigation_1.usePathname();
    var isLoading = useLoading_1.useIsLoading();
    var _a = MapProvider_1.useMapContext(), myUserId = _a.myUserId, isInteracting = _a.isInteracting, selectedUser = _a.selectedUser, selectedHotspot = _a.selectedHotspot, filteredHotspots = _a.filteredHotspots;
    var chatRequests = MapProvider_1.useSocialContext().chatRequests;
    var _b = MapProvider_1.useDMContext(), activeChatUser = _b.activeChatUser, unreadMessagesCount = _b.unreadMessagesCount;
    var _c = useAuth_1.useAuth(), isSignedIn = _c.isSignedIn, user = _c.user;
    var pendingIncomingCount = chatRequests.filter(function (r) { return r.target_id === myUserId && r.status === "pending"; }).length;
    var navItems = __spreadArrays([
        { name: "Live", path: "/", icon: lucide_react_1.Compass }
    ], (isSignedIn === true && user !== null ? [{ name: "Chat", path: "/chat", icon: lucide_react_1.MessageSquare }] : []), [
        { name: "Profile", path: "/profile", icon: lucide_react_1.User },
    ]);
    if (isLoading) {
        return null;
    }
    var shouldHide = isInteracting ||
        ((pathname === null || pathname === void 0 ? void 0 : pathname.startsWith("/chat")) && activeChatUser !== null) ||
        selectedUser !== null ||
        selectedHotspot !== null;
    return (React.createElement(framer_motion_1.AnimatePresence, null, !shouldHide && (React.createElement(framer_motion_1.motion.div, { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 30 }, transition: { duration: 0.2, ease: "easeOut" }, className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-32px)] max-w-sm bg-white/90 backdrop-blur-lg rounded-full border border-zinc-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-all" },
        React.createElement("nav", { className: "flex items-center justify-evenly w-full h-14 px-3" }, navItems.map(function (item) {
            var isActive = pathname === item.path;
            var Icon = item.icon;
            return (React.createElement(link_1["default"], { key: item.name, href: item.path, id: "nav-" + item.name.toLowerCase(), className: "relative flex flex-col items-center justify-center flex-1 h-full cursor-pointer" },
                React.createElement("div", { className: "relative flex flex-col items-center gap-0.5 py-1" },
                    isActive && (React.createElement(framer_motion_1.motion.div, { layoutId: "nav-pill", className: "absolute -inset-y-1 -inset-x-5 rounded-full bg-zinc-100", transition: { type: "spring", stiffness: 380, damping: 30 } })),
                    React.createElement("div", { className: "relative" },
                        React.createElement(Icon, { size: 18, className: "relative z-10 transition-colors duration-200 " + (isActive ? "text-zinc-900" : "text-zinc-400"), strokeWidth: isActive ? 2.5 : 1.8 }),
                        item.name === "Chat" && (React.createElement("div", { className: "absolute -top-2 -right-1 flex flex-col items-end gap-0.5 z-20 pointer-events-none select-none" },
                            unreadMessagesCount > 0 && (React.createElement("span", { key: "dm", className: "flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-emerald-500 text-[7px] font-extrabold text-white animate-bounce shadow-sm transition-transform" }, unreadMessagesCount)),
                            pendingIncomingCount > 0 && (React.createElement("span", { key: "req", className: "flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-rose-500 text-[7px] font-extrabold text-white animate-pulse shadow-sm transition-transform" }, pendingIncomingCount)),
                            filteredHotspots.length > 0 && (React.createElement("span", { key: "hotspot", className: "flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-extrabold text-white shadow-sm transition-transform" }, filteredHotspots.length))))),
                    React.createElement("span", { className: "relative z-10 text-[8px] font-extrabold tracking-widest uppercase transition-colors duration-200 " + (isActive ? "text-zinc-900" : "text-zinc-400") }, item.name))));
        }))))));
}
exports["default"] = BottomNav;
