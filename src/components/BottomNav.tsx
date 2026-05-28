"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, User, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMapContext } from "@/components/Map/MapProvider";
import { useAuth } from "@/hooks/useAuth";
import { useIsLoading } from "@/hooks/useLoading";

export default function BottomNav() {
  const pathname = usePathname();
  const isLoading = useIsLoading();
  const { chatRequests, myUserId, isInteracting, activeChatUser, selectedUser, selectedHotspot, unreadMessagesCount, filteredHotspots } = useMapContext();
  const { isSignedIn, user } = useAuth();

  const pendingIncomingCount = chatRequests.filter(
    (r) => r.target_id === myUserId && r.status === "pending"
  ).length;

  const navItems = [
    { name: "Live", path: "/", icon: Compass },
    ...(isSignedIn === true && user !== null ? [{ name: "Chat", path: "/chat", icon: MessageSquare }] : []),
    { name: "Profile", path: "/profile", icon: User },
  ];

  if (isLoading) {
    return null;
  }

  const shouldHide =
    isInteracting ||
    (pathname?.startsWith("/chat") && activeChatUser !== null) ||
    selectedUser !== null ||
    selectedHotspot !== null;

  return (
    <AnimatePresence>
      {!shouldHide && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] w-[calc(100%-32px)] max-w-sm bg-white/90 backdrop-blur-lg rounded-full border border-zinc-200 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition-all"
        >
          <nav className="flex items-center justify-evenly w-full h-14 px-3">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  id={`nav-${item.name.toLowerCase()}`}
                  className="relative flex flex-col items-center justify-center flex-1 h-full cursor-pointer"
                >
                  <div className="relative flex flex-col items-center gap-0.5 py-1">
                    {/* Active pill background */}
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute -inset-y-1 -inset-x-5 rounded-full bg-zinc-100"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}

                    <div className="relative">
                      <Icon
                        size={18}
                        className={`relative z-10 transition-colors duration-200 ${isActive ? "text-zinc-900" : "text-zinc-400"
                          }`}
                        strokeWidth={isActive ? 2.5 : 1.8}
                      />

                      {/* Badge Indicators - Compact Stacked Layout */}
                      {item.name === "Chat" && (
                        <div className="absolute -top-2 -right-1 flex flex-col items-end gap-0.5 z-20 pointer-events-none select-none">
                          {unreadMessagesCount > 0 && (
                            <span key="dm" className="flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-emerald-500 text-[7px] font-extrabold text-white animate-bounce shadow-sm transition-transform">
                              {unreadMessagesCount}
                            </span>
                          )}
                          {pendingIncomingCount > 0 && (
                            <span key="req" className="flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-rose-500 text-[7px] font-extrabold text-white animate-pulse shadow-sm transition-transform">
                              {pendingIncomingCount}
                            </span>
                          )}
                          {filteredHotspots.length > 0 && (
                            <span key="hotspot" className="flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-amber-500 text-[7px] font-extrabold text-white shadow-sm transition-transform">
                              {filteredHotspots.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className={`relative z-10 text-[8px] font-extrabold tracking-widest uppercase transition-colors duration-200 ${isActive ? "text-zinc-900" : "text-zinc-400"
                        }`}
                    >
                      {item.name}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
