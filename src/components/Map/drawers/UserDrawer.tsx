"use client";

import { useMapContext, useSocialContext, useDMContext } from "../MapProvider";
import { getAvatarUrl, useAuth } from "@/hooks/useAuth";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Navigation, Mic, MicOff, Volume2 } from "lucide-react";
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
    myUserId,
    incomingStreams,
    startListening,
    stopListening,
    
    speakRequests,
    activeSpeakers,
    mySpeakStatus,
    isMutedByHost,
    isLocalMicMuted,
    requestToSpeak,
    cancelSpeakRequest,
    toggleLocalMic,
    leaveSpace,
  } = useMapContext();

  const { chatRequests, sendChatRequest } = useSocialContext();
  const { setActiveChatUser } = useDMContext();

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

              {/* Audio Space Section */}
              {isSignedIn && (
                (() => {
                  const isMe = selectedUser.user_id === myUserId;
                  
                  if (isMe) {
                    return null;
                  }
                  
                  if (selectedUser.is_broadcasting_audio) {
                    const isListening = !!incomingStreams[selectedUser.user_id];
                    
                    return (
                      <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-4 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            Live Audio Space 🎙️
                          </span>
                        </div>

                        {!isListening ? (
                          <button
                            onClick={() => startListening(selectedUser.user_id)}
                            className="w-full py-3.5 rounded-2xl bg-zinc-950 hover:bg-black text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-md"
                          >
                            <Volume2 size={13} /> Join Space as Listener 🎧
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => leaveSpace(selectedUser.user_id)}
                                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm"
                              >
                                Leave Space 🛑
                              </button>
                              
                              {mySpeakStatus === "listener" && (
                                <button
                                  onClick={() => requestToSpeak(selectedUser.user_id)}
                                  className="flex-1 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-800 hover:bg-zinc-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm"
                                >
                                  <Mic size={13} /> Request to Speak
                                </button>
                              )}

                              {mySpeakStatus === "requesting" && (
                                <button
                                  onClick={() => cancelSpeakRequest(selectedUser.user_id)}
                                  className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm animate-pulse"
                                >
                                  Pending... (Cancel)
                                </button>
                              )}
                            </div>

                            {mySpeakStatus === "speaker" && (
                              <div className="border-t border-zinc-200/60 pt-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                  <span>You are a Speaker</span>
                                  {isMutedByHost && <span className="text-rose-500 font-black">Muted by Host</span>}
                                </div>
                                <button
                                  onClick={() => !isMutedByHost && toggleLocalMic()}
                                  disabled={isMutedByHost}
                                  className={`w-full py-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                    isMutedByHost
                                      ? "bg-zinc-100 border-zinc-200 text-zinc-400 cursor-not-allowed"
                                      : isLocalMicMuted
                                      ? "bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50"
                                      : "bg-zinc-900 border-zinc-900 text-white hover:bg-black"
                                  }`}
                                >
                                  {isMutedByHost ? (
                                    <>
                                      <MicOff size={13} /> Muted by Host
                                    </>
                                  ) : isLocalMicMuted ? (
                                    <>
                                      <MicOff size={13} /> Unmute Microphone
                                    </>
                                  ) : (
                                    <>
                                      <Mic size={13} /> Mute Microphone
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()
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
