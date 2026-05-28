"use client";

import { useMapContext } from "../MapProvider";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin } from "lucide-react";
import { OSMPlace } from "@/hooks/useOSM";
import { useState } from "react";

const INTENT_SUGGESTIONS = [
  "Need a chai buddy ☕",
  "Anyone up for a walk? 🚶",
  "Study partner needed 📚",
  "Guitar jam session 🎸",
  "Boba run 🧋",
  "Midnight ramen? 🍜",
  "Gym buddy 🏋️",
  "Coding together? 💻",
  "Movie night? 🍿",
  "Let's play chess ♟️",
  "Coffee date? ☕💕",
  "Anime marathon 🎌",
  "Board games tonight 🎲",
  "Sunset walk 🌅",
  "Karaoke time 🎤",
  "Cooking together 🍳",
];

export function IntentModal({ osmPlaces = [] }: { osmPlaces?: OSMPlace[] }) {
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null);
  const {
    showIntentModal,
    setShowIntentModal,
    intentText,
    setIntentText,
    customHotspotRange,
    setCustomHotspotRange,
    postIntent,
    socketReady,
  } = useMapContext();

  const handleCreateClick = () => {
    const place = osmPlaces.find((p) => p.id === selectedPlaceId);
    postIntent(place);
  };

  return (
    <AnimatePresence>
      {showIntentModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/30 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIntentModal(false);
          }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-lg bg-white rounded-t-[28px] shadow-2xl"
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-zinc-200" />
            </div>

            <div className="px-5 pt-2 pb-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-zinc-900">Post Intent</h3>
                <button
                  onClick={() => setShowIntentModal(false)}
                  className="p-1.5 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Post what you are doing. Adjust the slider below to control how far away (10km - 30km) others can be to see your hotspot on their map.
              </p>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-2 mb-4 max-h-[120px] overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                {INTENT_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setIntentText(s)}
                    className={`px-3 py-1.5 rounded-full border text-[11px] font-medium transition-colors cursor-pointer ${
                      intentText === s
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Input */}
              <input
                autoFocus
                type="text"
                value={intentText}
                onChange={(e) => setIntentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateClick()}
                placeholder="Or type your own..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors mb-4"
              />

              {/* Hotspot Range Slider */}
              <div className="mb-4 bg-zinc-50/50 border border-zinc-100 p-3 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-zinc-700">Hotspot Proximity Range</span>
                  <span className="text-xs font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-full">
                    {customHotspotRange} km
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="30"
                  step="1"
                  value={customHotspotRange}
                  onChange={(e) => setCustomHotspotRange(parseInt(e.target.value))}
                  className="w-full h-1.5 rounded-full cursor-pointer accent-zinc-900 bg-zinc-200"
                />
                <p className="text-[9px] text-zinc-400 mt-1">
                  Your hotspot will only be discoverable by users physically within this radius.
                </p>
              </div>

              {/* OSM Places Picker */}
              {osmPlaces.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-bold text-zinc-900 mb-2 flex items-center gap-1">
                    <MapPin size={12} /> Attach to nearby place
                  </h4>
                  <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden bg-zinc-50/50 border border-zinc-100 p-2 rounded-xl">
                    <button
                      onClick={() => setSelectedPlaceId(null)}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        selectedPlaceId === null
                          ? "bg-zinc-900 text-white"
                          : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/50"
                      }`}
                    >
                      None (Use my exact location)
                    </button>
                    {osmPlaces.map((place) => (
                      <button
                        key={place.id}
                        onClick={() => setSelectedPlaceId(place.id)}
                        className={`text-left px-3 py-2 rounded-lg transition-colors flex flex-col gap-0.5 ${
                          selectedPlaceId === place.id
                            ? "bg-zinc-900 text-white"
                            : "bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200/50"
                        }`}
                      >
                        <span className="text-xs font-bold truncate">{place.tags.name}</span>
                        {place.tags.amenity && (
                          <span className={`text-[9px] uppercase tracking-wider ${selectedPlaceId === place.id ? "text-zinc-300" : "text-zinc-400"}`}>
                            {place.tags.amenity}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowIntentModal(false)}
                  className="flex-1 py-3.5 rounded-xl bg-zinc-100 text-zinc-600 font-semibold text-sm hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClick}
                  disabled={!intentText.trim() || !socketReady}
                  className="flex-1 py-3.5 rounded-xl bg-zinc-900 text-white font-bold text-sm disabled:opacity-40 hover:bg-black transition-colors cursor-pointer"
                >
                  Create Hotspot
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
