"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    puter: any;
  }
}

export type UserProfile = {
  id: string;
  username: string;
  avatar_url: string;
  handle: string;
  bio: string;
  vibeEmoji: string;
  radarRange: number;
  hotspotRange?: number;
  bannerGradient?: number;
  selectedTags: string[];
  maskLocation: boolean;
  gender: "Male" | "Female" | "Non-binary" | "Prefer not to say" | "";
  age: number | "";
  blockedUsers: string[];
};

type AuthContextType = {
  isSignedIn: boolean;
  isLoading: boolean;
  user: any | null;
  profile: UserProfile | null;
  saveProfile: (partial: Partial<UserProfile>) => Promise<void>;
  blockUser: (targetUserId: string) => Promise<void>;
  unblockUser: (targetUserId: string) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate a DiceBear avatar URL from a seed (username) — completely free & open source
export function getAvatarUrl(seed: string): string {
  const styles = [
    "adventurer",
    "adventurer-neutral",
    "avataaars",
    "avataaars-neutral",
    "big-ears",
    "big-ears-neutral",
    "big-smile",
    "bottts",
    "bottts-neutral",
    "croodles",
    "croodles-neutral",
    "dylan",
    "fun-emoji",
    "lorelei",
    "lorelei-neutral",
    "micah",
    "miniavs",
    "notionists",
    "notionists-neutral",
    "open-peeps",
    "personas",
    "pixel-art",
    "pixel-art-neutral",
    "toon-head"
  ];
  // Pick a style deterministically from the seed
  const idx = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % styles.length;
  const style = styles[idx];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadProfile = async (u: any) => {
    try {
      const raw = await window.puter.kv.get(`profile_v2_${u.username}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        let rRange = parsed.radarRange;
        if (typeof rRange !== "number" || rRange < 10) rRange = 15;
        if (rRange > 30) rRange = 30;

        let hRange = parsed.hotspotRange;
        if (typeof hRange !== "number" || hRange < 10) hRange = 15;
        if (hRange > 30) hRange = 30;

        setProfile({
          gender: "",
          age: "",
          blockedUsers: [],
          ...parsed,
          radarRange: rRange,
          hotspotRange: hRange,
        });
      } else {
        // First-time defaults (15km default range)
        const defaultProfile: UserProfile = {
          id: u.id || u.username,
          username: u.username,
          avatar_url: getAvatarUrl(u.username),
          handle: u.username,
          bio: "",
          vibeEmoji: "☕",
          radarRange: 15,
          hotspotRange: 15,
          selectedTags: [],
          maskLocation: true,
          gender: "",
          age: "",
          blockedUsers: [],
        };
        setProfile(defaultProfile);
        await window.puter.kv.set(`profile_v2_${u.username}`, JSON.stringify(defaultProfile));
      }
    } catch (e) {
      console.error("Failed to load profile", e);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        let retries = 0;
        while (!window.puter && retries < 20) {
          await new Promise((r) => setTimeout(r, 150));
          retries++;
        }
        if (window.puter) {
          const signedIn = window.puter.auth.isSignedIn();
          setIsSignedIn(signedIn);
          if (signedIn) {
            const userData = await window.puter.auth.getUser();
            setUser(userData);
            await loadProfile(userData);
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Reload profile from cloud KV on tab focus (debounced to avoid spam)
  const lastFocusLoadRef = useRef(0);
  useEffect(() => {
    if (!user) return;
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusLoadRef.current < 2000) return;
      lastFocusLoadRef.current = now;
      loadProfile(user);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const saveProfile = async (partial: Partial<UserProfile>) => {
    if (!user || !profile) return;
    const updated = { ...profile, ...partial };
    setProfile(updated);
    await window.puter.kv.set(`profile_v2_${user.username}`, JSON.stringify(updated));
  };

  const blockUser = async (targetUserId: string) => {
    if (!profile) return;
    const currentBlocks = profile.blockedUsers || [];
    if (currentBlocks.includes(targetUserId)) return;
    const updatedBlocks = [...currentBlocks, targetUserId];
    await saveProfile({ blockedUsers: updatedBlocks });
  };

  const unblockUser = async (targetUserId: string) => {
    if (!profile) return;
    const currentBlocks = profile.blockedUsers || [];
    if (!currentBlocks.includes(targetUserId)) {
      // Even if not in profile, check local storage (fallback for sync)
      if (typeof window !== "undefined") {
        try {
          const local = JSON.parse(localStorage.getItem("norby_local_blocks") || "[]");
          const filtered = local.filter((id: string) => id !== targetUserId);
          localStorage.setItem("norby_local_blocks", JSON.stringify(filtered));
          // Trigger a storage event for other tabs/components
          window.dispatchEvent(new Event("storage"));
        } catch (e) { }
      }
      return;
    }
    const updatedBlocks = currentBlocks.filter((id) => id !== targetUserId);
    await saveProfile({ blockedUsers: updatedBlocks });

    // Also clear from local storage if present
    if (typeof window !== "undefined") {
      try {
        const local = JSON.parse(localStorage.getItem("norby_local_blocks") || "[]");
        const filtered = local.filter((id: string) => id !== targetUserId);
        localStorage.setItem("norby_local_blocks", JSON.stringify(filtered));
        window.dispatchEvent(new Event("storage"));
      } catch (e) { }
    }
  };

  const signIn = async () => {
    if (!window.puter) return;
    setIsLoading(true);
    try {
      await window.puter.auth.signIn();
      setIsSignedIn(true);
      const userData = await window.puter.auth.getUser();
      setUser(userData);
      await loadProfile(userData);
    } catch (error) {
      console.error("Sign in failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    if (!window.puter) return;
    window.puter.auth.signOut();
    setIsSignedIn(false);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ isSignedIn, isLoading, user, profile, saveProfile, blockUser, unblockUser, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
