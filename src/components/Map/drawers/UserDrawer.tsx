"use client";

import { useMapContext } from "../MapProvider";
import { getAvatarUrl } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, Navigation } from "lucide-react";

export function UserDrawer() {
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
  } = useMapContext();

  function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  return (
    <AnimatePresence>
      {selectedUser && (
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
      )}
    </AnimatePresence>
  );
}
