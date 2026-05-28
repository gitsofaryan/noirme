"use client";

import { useMapContext } from "../MapProvider";
import { getAvatarUrl, useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Radio, Check, Trash } from "lucide-react";

export function SpaceDrawer() {
  const { isSignedIn } = useAuth();
  const {
    isBroadcastingAudio,
    stopBroadcast,
    
    speakRequests,
    activeSpeakers,
    activeListeners,
    approveSpeaker,
    declineSpeaker,
    muteSpeaker,
    unmuteSpeaker,
    removeSpeaker,
    
    showSpaceDrawer,
    setShowSpaceDrawer,
  } = useMapContext();

  if (!isSignedIn) return null;

  return (
    <AnimatePresence>
      {showSpaceDrawer && isBroadcastingAudio && (
        <>
          {/* Semi-transparent backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSpaceDrawer(false)}
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

            <div className="px-5 pb-6 bg-white max-h-[70vh] overflow-y-auto scrollbar-none space-y-5">
              {/* Header Info */}
              <div className="flex justify-between items-start gap-3 border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-zinc-900 tracking-tight flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse shrink-0" />
                    Host Control Console 🎙️
                  </h3>
                  <p className="text-[10px] text-zinc-400 font-bold mt-1">
                    Manage your live Audio Space connection & speakers
                  </p>
                </div>

                <button
                  onClick={() => setShowSpaceDrawer(false)}
                  className="p-1.5 rounded-full bg-zinc-50 text-zinc-450 hover:text-zinc-655 hover:bg-zinc-100 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Space Information Cards */}
              <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-4 space-y-4 shadow-sm">
                
                {/* Speaker Requests list */}
                <div className="space-y-1.5">
                  <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">
                    Speaker Requests ({speakRequests.length})
                  </h4>
                  {speakRequests.length === 0 ? (
                    <p className="text-[11px] text-zinc-450 italic">No pending speak requests.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {speakRequests.map((req) => (
                        <div key={req.user_id} className="flex items-center justify-between bg-white border border-zinc-200/60 p-2.5 rounded-xl shadow-xs">
                          <div className="flex items-center gap-2">
                            <img
                              src={req.avatar_url || getAvatarUrl(req.username)}
                              className="w-5 h-5 rounded-full object-cover border border-zinc-100"
                              alt={req.username}
                            />
                            <span className="text-xs font-bold text-zinc-800">@{req.username}</span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => approveSpeaker(req.user_id, req.username, req.avatar_url)}
                              className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-[10px] font-bold hover:bg-black transition-all active:scale-95 cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => declineSpeaker(req.user_id)}
                              className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-zinc-500 text-[10px] font-bold hover:bg-zinc-55 transition-all active:scale-95 cursor-pointer"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active Speakers list */}
                <div className="space-y-1.5">
                  <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">
                    Speakers ({activeSpeakers.length + 1})
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {/* You (Host) */}
                    <div className="flex items-center justify-between bg-white border border-zinc-200/60 p-2 rounded-xl shadow-xs">
                      <span className="text-xs font-bold text-zinc-800">You (Host)</span>
                      <span className="text-[9px] font-extrabold uppercase text-rose-500 tracking-wider flex items-center gap-1">
                        🎙️ Broadcasting
                      </span>
                    </div>

                    {/* Guest Speakers */}
                    {activeSpeakers.map((spk) => (
                      <div key={spk.user_id} className="flex items-center justify-between bg-white border border-zinc-200/60 p-2 rounded-xl shadow-xs">
                        <div className="flex items-center gap-2">
                          <img
                            src={spk.avatar_url || getAvatarUrl(spk.username)}
                            className="w-5 h-5 rounded-full object-cover border border-zinc-100"
                            alt={spk.username}
                          />
                          <span className="text-xs font-bold text-zinc-800">@{spk.username}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => spk.isMuted ? unmuteSpeaker(spk.user_id) : muteSpeaker(spk.user_id)}
                            className={`p-1.5 rounded-lg border transition-all active:scale-95 cursor-pointer flex items-center justify-center ${
                              spk.isMuted
                                ? "bg-rose-500 border-rose-500 text-white"
                                : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50"
                            }`}
                            title={spk.isMuted ? "Unmute Speaker" : "Mute Speaker"}
                          >
                            {spk.isMuted ? <MicOff size={11} /> : <Mic size={11} />}
                          </button>
                          <button
                            onClick={() => removeSpeaker(spk.user_id)}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                            title="Remove Speaker"
                          >
                            <Trash size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Listeners list */}
                <div className="space-y-1.5">
                  <h4 className="text-[9px] font-bold tracking-widest uppercase text-zinc-400">
                    Listeners ({activeListeners?.length || 0})
                  </h4>
                  {!activeListeners || activeListeners.length === 0 ? (
                    <p className="text-[11px] text-zinc-450 italic">No listeners yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {activeListeners.map((lst) => (
                        <div key={lst.user_id} className="flex items-center justify-between bg-white border border-zinc-200/60 p-2 rounded-xl shadow-xs">
                          <div className="flex items-center gap-2">
                            <img
                              src={lst.avatar_url || getAvatarUrl(lst.username)}
                              className="w-5 h-5 rounded-full object-cover border border-zinc-100 bg-zinc-50"
                              alt={lst.username}
                            />
                            <span className="text-xs font-bold text-zinc-800">@{lst.username}</span>
                          </div>
                          <span className="text-[9px] font-extrabold uppercase text-zinc-400 tracking-wider flex items-center gap-1">
                            🎧 Listening
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* End Broadcast Action Button */}
                <button
                  onClick={() => {
                    stopBroadcast();
                    setShowSpaceDrawer(false);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer shadow-sm"
                >
                  <Radio size={13} className="animate-pulse" /> End Audio Space
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
