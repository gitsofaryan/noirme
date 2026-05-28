"use client";

import { useMapContext } from "../MapProvider";
import { getAvatarUrl } from "@/hooks/useAuth";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Users, MessageSquare, Trash2, Lock, Loader2, LogOut } from "lucide-react";
import { ChatRoom } from "./ChatRoom";

export function HotspotDrawer() {
  const {
    location,
    myUserId,
    selectedHotspot,
    setSelectedHotspot,
    requestJoin,
    respondRequest,
    sendMessage,
    leaveHotspot,
    socketReady,
    setRoutingTarget,
    setSelectedUser,
    activeUsers,
  } = useMapContext();

  const handleUserClick = (targetUserId: string, targetUsername: string, targetAvatarUrl?: string) => {
    if (targetUserId === myUserId) return;
    const userObj = activeUsers?.find((u: any) => u.user_id === targetUserId);
    if (userObj) {
      setSelectedUser(userObj);
      setSelectedHotspot(null);
    } else {
      setSelectedUser({
        user_id: targetUserId,
        username: targetUsername,
        avatar_url: targetAvatarUrl,
        lat: selectedHotspot?.lat || 0,
        lng: selectedHotspot?.lng || 0,
      });
      setSelectedHotspot(null);
    }
  };

  const isHost = selectedHotspot?.host_id === myUserId;
  const myRequest = selectedHotspot?.requests?.find((r: any) => r.user_id === myUserId);
  const guestStatus = myRequest ? myRequest.status : "none"; // 'pending' | 'accepted' | 'declined' | 'none'

  const distance = location && selectedHotspot
    ? getDistanceKm(location.lat, location.lng, selectedHotspot.lat, selectedHotspot.lng)
    : null;
  const distanceStr =
    distance !== null ? (distance < 0.1 ? "Here" : `${distance.toFixed(1)} km away`) : "";

  return (
    <AnimatePresence>
      {selectedHotspot && (
        <>
          {/* Semi-transparent backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedHotspot(null)}
            className="fixed inset-0 bg-black/10 z-[890] backdrop-blur-[1px]"
          />
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
                <div
                  onClick={() => !isHost && handleUserClick(selectedHotspot.host_id, selectedHotspot.host_username, selectedHotspot.host_avatar)}
                  className={`relative ${!isHost ? "cursor-pointer hover:opacity-85 transition-opacity" : ""}`}
                >
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
                <div
                  onClick={() => !isHost && handleUserClick(selectedHotspot.host_id, selectedHotspot.host_username, selectedHotspot.host_avatar)}
                  className={!isHost ? "cursor-pointer group" : ""}
                >
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest group-hover:underline">
                    {isHost ? "Your Hotspot" : `Hosted by @${selectedHotspot.host_username}`}
                  </span>
                  <h3 className="text-sm font-bold text-zinc-900 leading-tight">
                    {selectedHotspot.title}
                  </h3>
                  <p className="text-[10px] text-zinc-450 mt-0.5 font-semibold">
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

            {/* Directions Action */}
            <button
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                  navigator.vibrate(10);
                }
                setRoutingTarget({
                  lat: selectedHotspot.lat,
                  lng: selectedHotspot.lng,
                  name: selectedHotspot.title,
                });
                setSelectedHotspot(null);
              }}
              className="mt-3 w-full py-3 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
            >
              <MapPin size={13} /> Get Directions
            </button>

            {/* Host Profile Info */}
            {!isHost && (
              <div
                onClick={() => handleUserClick(selectedHotspot.host_id, selectedHotspot.host_username, selectedHotspot.host_avatar)}
                className="bg-zinc-50 border border-zinc-100 rounded-2xl p-3.5 space-y-2.5 mt-3 mb-1 cursor-pointer hover:bg-zinc-100/70 transition-colors"
              >
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
                            <div
                              onClick={() => handleUserClick(r.user_id, r.username, r.avatar_url)}
                              className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <img
                                src={r.avatar_url}
                                className="w-8 h-8 rounded-full border border-zinc-200"
                                alt={r.username}
                              />
                              <span className="text-xs font-semibold text-zinc-800 hover:underline">
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
                      .map((r: any) => {
                        const isMe = r.user_id === myUserId;
                        return (
                          <div
                            key={r.user_id}
                            onClick={() => !isMe && handleUserClick(r.user_id, r.username, r.avatar_url)}
                            className={`flex items-center gap-1.5 bg-zinc-100 border border-zinc-200/50 rounded-full pl-1.5 pr-3 py-1 text-[10px] font-semibold text-zinc-750 ${
                              !isMe ? "cursor-pointer hover:bg-zinc-200 transition-colors" : ""
                            }`}
                          >
                            <img
                              src={r.avatar_url}
                              className="w-5 h-5 rounded-full object-cover"
                              alt={r.username}
                            />
                            {isMe ? "You (Host)" : `@${r.username}`}
                          </div>
                        );
                      })}
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
                          .map((r: any) => {
                            const isMe = r.user_id === myUserId;
                            return (
                              <div
                                key={r.user_id}
                                onClick={() => !isMe && handleUserClick(r.user_id, r.username, r.avatar_url)}
                                className={`flex items-center gap-1.5 bg-zinc-100 border border-zinc-200/50 rounded-full pl-1.5 pr-3 py-1 text-[10px] font-semibold text-zinc-750 ${
                                  !isMe ? "cursor-pointer hover:bg-zinc-200 transition-colors" : ""
                                }`}
                              >
                                <img
                                  src={r.avatar_url}
                                  className="w-5 h-5 rounded-full object-cover"
                                  alt={r.username}
                                />
                                {isMe ? "You" : `@${r.username}`}
                              </div>
                            );
                          })}
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
      </>
      )}
    </AnimatePresence>
  );
}
