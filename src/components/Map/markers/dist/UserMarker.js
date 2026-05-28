"use client";
"use strict";
exports.__esModule = true;
exports.UserMarker = exports.SmoothMarker = void 0;
var react_1 = require("react");
var react_leaflet_1 = require("react-leaflet");
var leaflet_1 = require("leaflet");
var MapProvider_1 = require("../MapProvider");
var useAuth_1 = require("@/hooks/useAuth");
var MARKER_COLORS = [
    "#FF5733",
    "#33FF57",
    "#3357FF",
    "#F333FF",
    "#FF33A1",
    "#33FFF6",
    "#FFBD33",
    "#8D33FF",
    "#FF3333",
    "#33FFBD",
];
var avatarIconCache = new Map();
function createAvatarMarkerIconRaw(avatarUrl, vibeEmoji, isMe, zoom, userId, isWaving, isBroadcasting) {
    if (userId === void 0) { userId = "default"; }
    if (isWaving === void 0) { isWaving = false; }
    if (isBroadcasting === void 0) { isBroadcasting = false; }
    var baseSize = isMe ? 48 : 44;
    var scale = Math.max(0.3, Math.min(1.4, Math.pow(1.15, zoom - 15)));
    var size = Math.round(baseSize * scale);
    var emojiSize = Math.round(18 * scale);
    var ringSize = Math.max(1, Math.round(2.5 * scale));
    var colorIndex = Math.abs(userId.split("").reduce(function (a, c) { return a + c.charCodeAt(0); }, 0)) % MARKER_COLORS.length;
    var randomColor = MARKER_COLORS[colorIndex];
    var ring = isMe ? "#000000" : randomColor;
    var shadow = isMe
        ? "0 0 0 " + Math.round(3 * scale) + "px #000, 0 4px 16px rgba(0,0,0,0.25)"
        : "0 0 0 " + Math.round(2 * scale) + "px " + randomColor + ", 0 2px 12px rgba(0,0,0,0.15)";
    return leaflet_1["default"].divIcon({
        className: "",
        html: "\n      <div style=\"position:relative; width:" + size + "px; height:" + size + "px;\">\n        <div style=\"\n          width:" + size + "px; height:" + size + "px; border-radius:50%;\n          border: " + ringSize + "px solid " + ring + ";\n          box-shadow: " + shadow + ";\n          overflow: hidden;\n          background: #ffffff;\n          cursor: pointer;\n        \">\n          <img\n            src=\"" + avatarUrl + "\"\n            style=\"width:100%; height:100%; object-fit:cover;\"\n            onerror=\"this.style.display='none'\"\n          />\n        </div>\n        <div style=\"\n          position:absolute; bottom:-2px; right:-2px;\n          width:" + emojiSize + "px; height:" + emojiSize + "px; border-radius:50%;\n          background: " + (isBroadcasting ? '#e11d48' : 'white') + ";\n          color: " + (isBroadcasting ? 'white' : 'inherit') + ";\n          border: 1.5px solid #e4e4e7;\n          display:flex; align-items:center; justify-content:center;\n          font-size:" + Math.round(isBroadcasting ? 8 * scale : 10 * scale) + "px;\n          box-shadow: 0 1px 4px rgba(0,0,0,0.1);\n          z-index: 20;\n        \">" + (isBroadcasting ? '🎙️' : vibeEmoji) + "</div>\n        " + (isBroadcasting ? "\n        <div style=\"\n          position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);\n          width:" + size + "px; height:" + size + "px; border-radius:50%;\n          border: 2px solid #e11d48;\n          animation: noirme-ripple-anim 1.5s infinite ease-out;\n          will-change: transform, opacity;\n          backface-visibility: hidden;\n          z-index: -1;\n        \"></div>\n        <div style=\"\n          position:absolute; top:50%; left:50%; transform:translate(-50%, -50%);\n          width:" + size + "px; height:" + size + "px; border-radius:50%;\n          border: 2px solid #e11d48;\n          animation: noirme-ripple-anim 1.5s infinite ease-out;\n          animation-delay: 0.5s;\n          will-change: transform, opacity;\n          backface-visibility: hidden;\n          z-index: -1;\n        \"></div>\n        <style>\n          @keyframes noirme-ripple-anim {\n            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }\n            100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }\n          }\n        </style>\n        " : "") + "\n        " + (isWaving ? "\n        <div style=\"\n          position:absolute; top:-" + Math.round(16 * scale) + "px; right:-" + Math.round(16 * scale) + "px;\n          font-size: " + Math.round(24 * scale) + "px;\n          animation: noirme-wave-anim 1.2s infinite;\n          transform-origin: bottom right;\n          z-index: 10;\n          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));\n        \">\uD83D\uDC4B</div>\n        <style>\n          @keyframes noirme-wave-anim {\n            0% { transform: rotate(0deg); }\n            20% { transform: rotate(-20deg); }\n            40% { transform: rotate(10deg); }\n            60% { transform: rotate(-10deg); }\n            80% { transform: rotate(5deg); }\n            100% { transform: rotate(0deg); }\n          }\n        </style>\n        " : "") + "\n      </div>\n    ",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2 - 4]
    });
}
function createAvatarMarkerIcon(avatarUrl, vibeEmoji, isMe, zoom, userId, isWaving, isBroadcasting) {
    if (userId === void 0) { userId = "default"; }
    if (isWaving === void 0) { isWaving = false; }
    if (isBroadcasting === void 0) { isBroadcasting = false; }
    var key = userId + "_" + avatarUrl + "_" + vibeEmoji + "_" + (isMe ? "me" : "them") + "_" + zoom + "_" + (isWaving ? "waving" : "static") + "_" + (isBroadcasting ? "mic" : "nomic");
    if (avatarIconCache.has(key)) {
        return avatarIconCache.get(key);
    }
    if (avatarIconCache.size >= 800) {
        var keysToDelete = Array.from(avatarIconCache.keys()).slice(0, 200);
        keysToDelete.forEach(function (k) { return avatarIconCache["delete"](k); });
    }
    var icon = createAvatarMarkerIconRaw(avatarUrl, vibeEmoji, isMe, zoom, userId, isWaving, isBroadcasting);
    avatarIconCache.set(key, icon);
    return icon;
}
function SmoothMarker(_a) {
    var position = _a.position, icon = _a.icon, eventHandlers = _a.eventHandlers, children = _a.children, zIndexOffset = _a.zIndexOffset;
    var _b = react_1.useState(position), currentPos = _b[0], setCurrentPos = _b[1];
    var targetPosRef = react_1.useRef(position);
    var startPosRef = react_1.useRef(position);
    var startTimeRef = react_1.useRef(0);
    var animIdRef = react_1.useRef(null);
    react_1.useEffect(function () {
        if (position[0] !== targetPosRef.current[0] || position[1] !== targetPosRef.current[1]) {
            startPosRef.current = currentPos;
            targetPosRef.current = position;
            startTimeRef.current = performance.now();
            if (animIdRef.current) {
                cancelAnimationFrame(animIdRef.current);
            }
            var animate_1 = function (now) {
                var elapsed = now - startTimeRef.current;
                var duration = 400; // 400ms transition time
                var t = Math.min(1, elapsed / duration);
                var ease = t * (2 - t); // ease-out quadratic
                var nextLat = startPosRef.current[0] + (targetPosRef.current[0] - startPosRef.current[0]) * ease;
                var nextLng = startPosRef.current[1] + (targetPosRef.current[1] - startPosRef.current[1]) * ease;
                setCurrentPos([nextLat, nextLng]);
                if (t < 1) {
                    animIdRef.current = requestAnimationFrame(animate_1);
                }
                else {
                    animIdRef.current = null;
                }
            };
            animIdRef.current = requestAnimationFrame(animate_1);
        }
    }, [position]);
    // Clean up animation frame on unmount
    react_1.useEffect(function () {
        return function () {
            if (animIdRef.current) {
                cancelAnimationFrame(animIdRef.current);
            }
        };
    }, []);
    return (React.createElement(react_leaflet_1.Marker, { position: currentPos, icon: icon, eventHandlers: eventHandlers, zIndexOffset: zIndexOffset }, children));
}
exports.SmoothMarker = SmoothMarker;
var MemoizedUserMarkerComponent = function (_a) {
    var type = _a.type, lat = _a.lat, lng = _a.lng, zoom = _a.zoom, myAvatarUrl = _a.myAvatarUrl, vibeEmoji = _a.vibeEmoji, myUserId = _a.myUserId, isWaving = _a.isWaving, isBroadcasting = _a.isBroadcasting, rawUser = _a.rawUser, onClick = _a.onClick;
    if (type === "me") {
        return (React.createElement(react_leaflet_1.Marker, { position: [lat, lng], icon: createAvatarMarkerIcon(myAvatarUrl, vibeEmoji, true, zoom, myUserId, false, isBroadcasting), zIndexOffset: 500 },
            React.createElement(react_leaflet_1.Popup, { className: "cloudy-popup" },
                React.createElement("div", { className: "flex flex-col items-center justify-center p-3 px-5 text-center text-zinc-800" },
                    React.createElement("div", { className: "w-12 h-12 rounded-full overflow-hidden bg-white/60 border border-white/80 shadow-sm flex items-center justify-center mb-1.5" },
                        React.createElement("img", { src: myAvatarUrl, className: "w-full h-full object-cover", alt: "you" })),
                    React.createElement("p", { className: "font-black text-sm text-zinc-900 leading-none" }, "Me"),
                    React.createElement("p", { className: "text-[9px] font-semibold text-zinc-500/80 mt-1 uppercase tracking-wider" },
                        "@",
                        myUserId)))));
    }
    var av = rawUser.avatar_url || useAuth_1.getAvatarUrl(rawUser.username || "user");
    return (React.createElement(SmoothMarker, { position: [lat, lng], icon: createAvatarMarkerIcon(av, rawUser.vibeEmoji || "🙂", false, zoom, rawUser.user_id, isWaving, isBroadcasting), zIndexOffset: 500, eventHandlers: {
            click: onClick
        } }));
};
var MemoizedUserMarker = react_1.memo(MemoizedUserMarkerComponent, function (prev, next) {
    var _a, _b, _c, _d, _e, _f;
    return (prev.type === next.type &&
        prev.lat === next.lat &&
        prev.lng === next.lng &&
        prev.zoom === next.zoom &&
        prev.myAvatarUrl === next.myAvatarUrl &&
        prev.vibeEmoji === next.vibeEmoji &&
        prev.myUserId === next.myUserId &&
        prev.isWaving === next.isWaving &&
        prev.isBroadcasting === next.isBroadcasting &&
        ((_a = prev.rawUser) === null || _a === void 0 ? void 0 : _a.user_id) === ((_b = next.rawUser) === null || _b === void 0 ? void 0 : _b.user_id) &&
        ((_c = prev.rawUser) === null || _c === void 0 ? void 0 : _c.vibeEmoji) === ((_d = next.rawUser) === null || _d === void 0 ? void 0 : _d.vibeEmoji) &&
        ((_e = prev.rawUser) === null || _e === void 0 ? void 0 : _e.is_broadcasting_audio) === ((_f = next.rawUser) === null || _f === void 0 ? void 0 : _f.is_broadcasting_audio));
});
function UserMarker(_a) {
    var _b;
    var item = _a.item;
    var _c = MapProvider_1.useMapContext(), zoom = _c.zoom, myAvatarUrl = _c.myAvatarUrl, vibeEmoji = _c.vibeEmoji, myUserId = _c.myUserId, activeWaves = _c.activeWaves, setSelectedUser = _c.setSelectedUser, isBroadcastingAudio = _c.isBroadcastingAudio;
    var friends = MapProvider_1.useSocialContext().friends;
    var isWaving = item.type === "user" && activeWaves.some(function (w) { var _a; return w.sender_id === ((_a = item.raw) === null || _a === void 0 ? void 0 : _a.user_id); });
    var isFriend = item.type === "user" && friends.some(function (f) { var _a; return f.user_id === ((_a = item.raw) === null || _a === void 0 ? void 0 : _a.user_id); });
    var isBroadcasting = item.type === "me"
        ? isBroadcastingAudio
        : (isFriend ? !!((_b = item.raw) === null || _b === void 0 ? void 0 : _b.is_broadcasting_audio) : false);
    return (React.createElement(MemoizedUserMarker, { type: item.type, lat: item.lat, lng: item.lng, zoom: zoom, myAvatarUrl: myAvatarUrl, vibeEmoji: vibeEmoji, myUserId: myUserId, isWaving: isWaving, isBroadcasting: isBroadcasting, rawUser: item.raw, onClick: function () {
            if (item.type === "user" && item.raw) {
                setSelectedUser(item.raw);
            }
        } }));
}
exports.UserMarker = UserMarker;
