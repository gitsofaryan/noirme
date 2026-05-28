"use client";

import { useMapContext } from "../MapProvider";
import { getAvatarUrl, useAuth } from "@/hooks/useAuth";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Navigation, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";

export function UserDrawer() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const {
    location,
    selectedUser,
    setSelectedUser,
    hasWaved,
    confirmBlock,
    setConfirmBlock,
    handleWave,
    handleBlock,
    setRoutingTarget,
    chatRequests,
    myUserId,
    sendChatRequest,
    setActiveChatUser,
    startListening,
    stopListening,
    incomingStreams,
    isBroadcastingAudio,
    startBroadcast,
    stopBroadcast,
  } = useMapContext();

  const requestSent = selectedUser
    ? chatRequests.find((r: any) => r.sender_id === myUserId && r.target_id === selectedUser.user_id)
    : null;
  const requestReceived = selectedUser
    ? chatRequests.find((r: any) => r.sender_id === selectedUser.user_id && r.target_id === myUserId)
    : null;

  const isPendingSent = !!(requestSent && requestSent.status === "pending");
  const isPendingReceived = !!(requestReceived && requestReceived.status === "pending");
  const isConnected = !!(
    (requestSent && requestSent.status === "accepted") ||
    (requestReceived && requestReceived.status === "accepted")
  );



  return (
    <AnimatePresence>
      {selectedUser && (
        <>
          {/* Semi-transparent backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
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
                      if (!location) return "Unknown distance";
                      const dist = getDistanceKm(location.lat, location.lng, selectedUser.lat, selectedUser.lng);
                      return dist < 0.1 ? "Here" : `${dist.toFixed(1)} km away`;
                    })()}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUser(null)}
                className="p-1.5 rounded-full bg-zinc-50 text-zinc-450 hover:text-zinc-655 hover:bg-zinc-100 transition-colors"
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
            <div className="flex flex-col gap-3.5 pt-2">
              <button
                onClick={() => {
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate(10);
                  }
                  setRoutingTarget({
                    lat: selectedUser.lat,
                    lng: selectedUser.lng,
                    name: `@${selectedUser.username}`,
                  });
                  setSelectedUser(null);
                }}
                className="w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                <Navigation size={13} /> Get Directions
              </button>

              {/* Live Audio Controls (Speak & Listen) */}
              {isSignedIn && (
                <div className="bg-zinc-50/80 rounded-2xl p-3.5 border border-zinc-100 space-y-2">
                  <p className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">
                    Live Audio Connection
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Listen Button */}
                    {selectedUser.is_broadcasting_audio ? (
                      <button
                        onClick={() => {
                          if (incomingStreams[selectedUser.user_id]) {
                            stopListening(selectedUser.user_id);
                          } else {
                            startListening(selectedUser.user_id);
                          }
                        }}
                        className={`py-3 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer shadow-sm ${
                          incomingStreams[selectedUser.user_id]
                            ? "bg-zinc-900 border-zinc-900 text-white"
                            : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                        }`}
                      >
                        {incomingStreams[selectedUser.user_id] ? (
                          <>
                            <Volume2 size={13} className="animate-pulse" /> Listening 🎧
                          </>
                        ) : (
                          <>
                            <VolumeX size={13} /> Listen Live 🎧
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="py-3 px-2 rounded-xl text-[11px] font-semibold border border-zinc-200/60 text-zinc-400 bg-zinc-100/50 flex items-center justify-center gap-1 select-none">
                        Not Live
                      </div>
                    )}

                    {/* Speak Button */}
                    <button
                      onClick={() => {
                        if (isBroadcastingAudio) {
                          stopBroadcast();
                        } else {
                          startBroadcast();
                        }
                      }}
                      className={`py-3 px-2 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-1 active:scale-[0.98] cursor-pointer shadow-sm ${
                        isBroadcastingAudio
                          ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                          : "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                      }`}
                    >
                      {isBroadcastingAudio ? (
                        <>
                          <Mic size={13} className="text-rose-600 animate-pulse" /> Speaking 🎙️
                        </>
                      ) : (
                        <>
                          <MicOff size={13} /> Speak Live 🎙️
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Connect / Chat Button */}
              {(() => {
                if (isConnected) {
                  return (
                    <button
                      onClick={() => {
                        const friendDetails = {
                          user_id: selectedUser.user_id,
                          username: selectedUser.username,
                          avatar_url: selectedUser.avatar_url,
                          vibeEmoji: selectedUser.vibeEmoji,
                        };
                        setActiveChatUser(friendDetails);
                        setSelectedUser(null);
                        router.push("/chat");
                      }}
                      className="w-full py-3.5 rounded-2xl bg-purple-650 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm"
                    >
                      Open Chat 💬
                    </button>
                  );
                } else if (isPendingSent) {
                  return (
                    <button
                      disabled
                      className="w-full py-3.5 rounded-2xl bg-zinc-100 text-zinc-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed border border-zinc-200/50"
                    >
                      Request Pending... ✉️
                    </button>
                  );
                } else if (isPendingReceived) {
                  return (
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        router.push("/chat");
                      }}
                      className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm"
                    >
                      Respond to Request 💬
                    </button>
                  );
                } else {
                  return (
                    <button
                      onClick={() => {
                        sendChatRequest(selectedUser.user_id);
                      }}
                      className="w-full py-3.5 rounded-2xl bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
                    >
                      Request to Connect 💬
                    </button>
                  );
                }
              })()}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (confirmBlock) {
                      handleBlock(selectedUser.user_id);
                    } else {
                      setConfirmBlock(true);
                    }
                  }}
                  className={`flex-1 py-3.5 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                    confirmBlock
                      ? "border-rose-650 bg-rose-650 text-white hover:bg-rose-700"
                      : "border-rose-200 hover:bg-rose-50 text-rose-650"
                  }`}
                >
                  {confirmBlock ? "Confirm Block?" : "Block / Report"}
                </button>

                <button
                  onClick={handleWave}
                  disabled={hasWaved}
                  className={`flex-1 py-3.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    hasWaved
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-900 text-white hover:bg-black active:scale-[0.98]"
                  }`}
                >
                  {hasWaved ? "Waved! 👋" : "Wave 👋"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </>
      )}
    </AnimatePresence>
  );
}
