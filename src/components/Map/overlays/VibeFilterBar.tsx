"use client";

import { useMapContext } from "../MapProvider";

const VIBE_FILTERS = [
  { label: "All", key: "all" },
  { label: "Café ☕", key: "cafe" },
  { label: "Dating 💕", key: "dating" },
  { label: "Gaming 🎮", key: "gaming" },
  { label: "Movies 🎬", key: "movies" },
  { label: "Study 📚", key: "study" },
  { label: "Music 🎵", key: "music" },
  { label: "Sports 🏃", key: "sports" },
  { label: "Chill 🌙", key: "chill" },
];

export function VibeFilterBar() {
  const { selectedFilter, setSelectedFilter } = useMapContext();

  const handleFilterClick = (key: string) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
    setSelectedFilter(key);
  };

  return (
    <div className="pointer-events-auto absolute top-4 left-4 right-4 z-[410]">
      <div className="flex gap-2 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-0.5">
        {VIBE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterClick(f.key)}
            className={`px-3.5 py-1.5 rounded-full border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-all duration-150 cursor-pointer ${
              selectedFilter === f.key
                ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                : "bg-white/95 border-zinc-200 text-zinc-600 shadow-sm"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
