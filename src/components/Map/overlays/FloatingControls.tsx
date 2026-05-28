"use client";

import { useMapContext } from "../MapProvider";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Send, Bell } from "lucide-react";

export function FloatingControls() {
  const { isSignedIn } = useAuth();
  const {
    filteredUsers,
    socketReady,
    showNotifDropdown,
    setShowNotifDropdown,
    notifications,
    setNotifications,
    refreshRadar,
    setShowIntentModal,
  } = useMapContext();

  const handleRecenterClick = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
    refreshRadar();
  };

  return (
    <>
      {/* Nearby Count Indicator (Top Left) */}
      <div className="pointer-events-auto absolute top-[72px] left-4 flex flex-col gap-2 z-[410]">
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-zinc-200 shadow-sm self-start">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              socketReady ? "bg-emerald-500 animate-pulse" : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[11px] font-bold text-zinc-900 leading-none">
            {filteredUsers.length}
          </span>
          <span className="text-[9px] font-semibold text-zinc-400 leading-none">nearby</span>
        </div>
      </div>

      {/* Notifications Panel (Top Right) */}
      <div className="pointer-events-auto absolute top-[72px] right-4 z-[410]">
        <button
          onClick={() => setShowNotifDropdown(!showNotifDropdown)}
          className="relative w-9 h-9 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-full border border-zinc-200 shadow-sm text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
        >
          <Bell size={18} />
          {notifications.some((n) => !n.read) && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
          )}
        </button>

        <AnimatePresence>
          {showNotifDropdown && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setShowNotifDropdown(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-zinc-200 shadow-xl overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-zinc-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-zinc-900 uppercase tracking-tight">
                    Recent Activity
                  </span>
                  <button
                    onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                    className="text-[10px] text-zinc-400 font-bold hover:text-zinc-900 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-[11px] font-medium text-zinc-400">No recent activity</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className="px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0"
                      >
                        <p className="text-[11px] font-medium text-zinc-800 leading-tight">
                          {n.text}
                        </p>
                        <p className="text-[9px] text-zinc-400 mt-1 uppercase font-bold tracking-tighter">
                          {new Date(n.time).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Action Controls (Bottom Right) */}
      <div className="pointer-events-auto absolute bottom-20 right-5 flex flex-col items-center gap-4 z-[410]">
        {/* Recenter/Compass */}
        <button
          onClick={handleRecenterClick}
          className="w-12 h-12 rounded-full bg-white/95 backdrop-blur-md border border-zinc-200 shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex items-center justify-center text-zinc-500 hover:text-zinc-900 transition-colors active:scale-90 cursor-pointer"
          title="Refresh Radar"
        >
          <Compass size={22} strokeWidth={2.5} />
        </button>

        {/* Post Intent FAB */}
        {isSignedIn && (
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => setShowIntentModal(true)}
            className="w-14 h-14 bg-zinc-900 text-white rounded-2xl flex items-center justify-center shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:bg-black transition-colors cursor-pointer"
          >
            <Send className="w-6 h-6" strokeWidth={2} />
          </motion.button>
        )}
      </div>
    </>
  );
}
