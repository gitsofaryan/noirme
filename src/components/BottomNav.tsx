"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, User, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { useMapContext } from "@/components/Map/MapProvider";
import { useAuth } from "@/hooks/useAuth";
import { useIsLoading } from "@/hooks/useLoading";

export default function BottomNav() {
  const pathname = usePathname();
  const isLoading = useIsLoading();
  const { chatRequests, myUserId } = useMapContext();
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

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] bg-white/95 backdrop-blur-xl border-t border-zinc-200 shadow-[0_-1px_20px_rgba(0,0,0,0.06)]">
      <nav className="flex items-center justify-evenly w-full h-16 max-w-lg mx-auto px-6">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;
          const showBadge = item.name === "Chat" && pendingIncomingCount > 0;

          return (
            <Link
              key={item.name}
              href={item.path}
              id={`nav-${item.name.toLowerCase()}`}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1"
            >
              <div className="relative flex flex-col items-center gap-1">
                {/* Active pill background */}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute -inset-2 rounded-2xl bg-zinc-100"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                
                <div className="relative">
                  <Icon
                    size={22}
                    className={`relative z-10 transition-colors duration-200 ${isActive ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-extrabold text-white animate-pulse">
                      {pendingIncomingCount}
                    </span>
                  )}
                </div>

                <span
                  className={`relative z-10 text-[9px] font-bold tracking-widest uppercase transition-colors duration-200 ${isActive ? "text-zinc-900" : "text-zinc-400"
                    }`}
                >
                  {item.name}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
