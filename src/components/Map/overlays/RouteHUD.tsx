"use client";

import { useMapContext } from "../MapProvider";
import { formatDistance, formatDuration, TransportMode } from "@/lib/routing";
import { motion, AnimatePresence } from "framer-motion";
import { X, Navigation, Footprints, Bike, Car, Loader2 } from "lucide-react";

export function RouteHUD() {
  const {
    activeRoute,
    activeRouteMode,
    setActiveRouteMode,
    routingTarget,
    isLoadingRoute,
    clearActiveRoute,
  } = useMapContext();

  if (!routingTarget) return null;

  const modes: Array<{ mode: TransportMode; label: string; icon: any }> = [
    { mode: "foot", label: "Walk", icon: Footprints },
    { mode: "bicycle", label: "Bike", icon: Bike },
    { mode: "driving", label: "Car", icon: Car },
  ];

  const handleModeClick = (mode: TransportMode) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
    setActiveRouteMode(mode);
  };

  return (
    <AnimatePresence>
      {routingTarget && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="pointer-events-auto absolute bottom-20 left-4 right-4 z-[420] max-w-lg mx-auto bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-3xl p-4 px-5 text-white shadow-2xl flex flex-col gap-3.5"
        >
          {/* Header row */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Navigation size={15} className="animate-pulse" />
              </div>
              <div className="leading-tight">
                <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none">
                  Routing to
                </span>
                <h4 className="text-xs font-black truncate max-w-[200px] mt-0.5 leading-none">
                  {routingTarget.name}
                </h4>
              </div>
            </div>

            <button
              onClick={clearActiveRoute}
              className="p-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-between border-y border-zinc-800 py-2.5">
            {isLoadingRoute ? (
              <div className="flex items-center justify-center w-full py-0.5 text-zinc-400 gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs font-semibold">Calculating route...</span>
              </div>
            ) : activeRoute ? (
              <>
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-wider leading-none">
                    Distance
                  </span>
                  <span className="text-sm font-black mt-1 leading-none">
                    {formatDistance(activeRoute.distanceMeters)}
                  </span>
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-[9px] font-bold text-zinc-555 uppercase tracking-wider leading-none">
                    ETA
                  </span>
                  <span className="text-sm font-black text-emerald-400 mt-1 leading-none">
                    {formatDuration(activeRoute.durationSeconds)}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center w-full py-0.5 text-rose-400">
                <span className="text-xs font-semibold">Could not fetch route geometry</span>
              </div>
            )}
          </div>

          {/* Transport mode selector */}
          <div className="flex gap-2">
            {modes.map(({ mode, label, icon: Icon }) => {
              const isActive = activeRouteMode === mode;
              return (
                <button
                  key={mode}
                  onClick={() => handleModeClick(mode)}
                  className={`flex-1 py-2.5 rounded-xl border text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                    isActive
                      ? "bg-white border-white text-zinc-950 shadow-sm"
                      : "bg-zinc-800/60 border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon size={12} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
