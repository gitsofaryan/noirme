"use client";

import { useAuth, getAvatarUrl } from "@/hooks/useAuth";
import { LogIn, LogOut, Loader2, Shield, X, Sparkles, Shuffle, Check, Upload, ChevronRight } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const INTEREST_TAGS = [
  "Study Grind 📚", "Specialty Coffee ☕", "Boba Runs 🧋", "Thrifting 🪵",
  "Skateboarding 🛹", "Alt Vinyls 🎵", "Heavy Lifting 🏋️", "Matcha Latte 🍵",
  "Visual Arts 🎨", "Midnight Ramen 🍜", "Lo-fi Beats 🎧", "Retro Gaming 👾",
  "Hackathon 💻", "Cycling 🚴", "Photography 📷", "Open Mic 🎤",
  "Dating 💕", "Board Games 🎲", "Movie Night 🍿", "Cooking 🍳",
  "Anime 🎌", "Night Drive 🌙", "Karaoke 🎤", "Road Trips 🚗",
];

const EMOJI_OPTIONS = [
  "☕", "🎒", "🎸", "🍕", "💻", "📚", "🎨", "🛹",
  "🎧", "🍿", "🍵", "⚡", "✨", "🔥", "🎯", "🌙",
  "🎤", "📷", "🧋", "🍜", "🏋️", "🚴", "🎮", "🌿",
  "💕", "🎲", "🎌", "🍳", "🚗", "🎬", "🏃", "🧘",
];

const AVATAR_STYLES = [
  { id: "adventurer", name: "Adventurer" },
  { id: "adventurer-neutral", name: "Adventurer Neutral" },
  { id: "avataaars", name: "Avataaars" },
  { id: "avataaars-neutral", name: "Avataaars Neutral" },
  { id: "big-ears", name: "Big Ears" },
  { id: "big-ears-neutral", name: "Big Ears Neutral" },
  { id: "big-smile", name: "Big Smile" },
  { id: "bottts", name: "Bottts" },
  { id: "bottts-neutral", name: "Bottts Neutral" },
  { id: "croodles", name: "Croodles" },
  { id: "croodles-neutral", name: "Croodles Neutral" },
  { id: "dylan", name: "Dylan" },
  { id: "fun-emoji", name: "Fun Emoji" },
  { id: "lorelei", name: "Lorelei" },
  { id: "lorelei-neutral", name: "Lorelei Neutral" },
  { id: "micah", name: "Micah" },
  { id: "miniavs", name: "Miniavs" },
  { id: "notionists", name: "Notionists" },
  { id: "notionists-neutral", name: "Notionists Neutral" },
  { id: "open-peeps", name: "Open Peeps" },
  { id: "personas", name: "Personas" },
  { id: "pixel-art", name: "Pixel Art" },
  { id: "pixel-art-neutral", name: "Pixel Art Neutral" },
  { id: "toon-head", name: "Toon Head" },
];

const GRADIENTS = [
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", // Pink-Red
  "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)", // Cyan-Purple
  "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", // Orange-Yellow
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)", // Sky-Blue
  "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)", // Mint-Blue
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)", // Rose
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", // Indigo-Purple
  "linear-gradient(135deg, #fddb92 0%, #d1f2f2 100%)", // Gold-Mint
  "linear-gradient(135deg, #ebc0fd 0%, #d9ded8 100%)", // Lavender
];

export default function ProfilePage() {
  const { isSignedIn, isLoading, user, profile, saveProfile, signIn, signOut, unblockUser } = useAuth();

  const [gradientIdx, setGradientIdx] = useState<number>(0);
  const userGradient = GRADIENTS[gradientIdx];

  const [handle, setHandle] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Non-binary" | "Prefer not to say" | "">("");
  const [age, setAge] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [vibeEmoji, setVibeEmoji] = useState("☕");
  const [radarRange, setRadarRange] = useState(15);
  const [hotspotRange, setHotspotRange] = useState(15);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [maskLocation, setMaskLocation] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar Picker States
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [tempStyle, setTempStyle] = useState("adventurer");
  const [tempSeed, setTempSeed] = useState("Felix");
  const [activeSeedType, setActiveSeedType] = useState<"Felix" | "Aneka" | "Milo" | "Luna" | "custom">("Felix");
  const [customSeedText, setCustomSeedText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Click outside for floating vibe emoji picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  // Parse existing avatar URL on open
  useEffect(() => {
    if (showAvatarPicker && avatarUrl) {
      if (avatarUrl.startsWith("data:image/")) {
        setUploadedImage(avatarUrl);
        setTempStyle("adventurer");
        setTempSeed("Felix");
        setActiveSeedType("Felix");
      } else {
        setUploadedImage(null);
        const match = avatarUrl.match(/api\.dicebear\.com\/9\.x\/([^\/]+)\/svg\?seed=([^&]+)/);
        if (match) {
          const style = match[1];
          const seed = decodeURIComponent(match[2]);
          setTempStyle(style);
          if (["Felix", "Aneka", "Milo", "Luna"].includes(seed)) {
            setActiveSeedType(seed as any);
            setTempSeed(seed);
          } else {
            setActiveSeedType("custom");
            setCustomSeedText(seed);
            setTempSeed(seed);
          }
        }
      }
    }
  }, [showAvatarPicker, avatarUrl]);

  const previewAvatarUrl = uploadedImage || `https://api.dicebear.com/9.x/${tempStyle}/svg?seed=${encodeURIComponent(tempSeed)}`;

  const selectPresetSeed = (preset: "Felix" | "Aneka" | "Milo" | "Luna") => {
    setUploadedImage(null);
    setActiveSeedType(preset);
    setTempSeed(preset);
  };

  const handleCustomSeedChange = (val: string) => {
    setUploadedImage(null);
    setCustomSeedText(val);
    setTempSeed(val.trim() || user?.username || "user");
  };

  const randomizeCustomSeed = () => {
    setUploadedImage(null);
    const randomSeed = Math.random().toString(36).substring(7);
    setActiveSeedType("custom");
    setCustomSeedText(randomSeed);
    setTempSeed(randomSeed);
  };

  const handleStyleChange = (styleId: string) => {
    setUploadedImage(null);
    setTempStyle(styleId);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const maxDim = 200;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        } else {
          if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setUploadedImage(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const applyAvatar = () => {
    setAvatarUrl(previewAvatarUrl);
    setShowAvatarPicker(false);
  };

  useEffect(() => {
    if (profile) {
      setHandle(profile.handle);
      setBio(profile.bio);
      setVibeEmoji(profile.vibeEmoji);
      setRadarRange(profile.radarRange);
      setHotspotRange(profile.hotspotRange || 15);
      setSelectedTags(profile.selectedTags);
      setMaskLocation(profile.maskLocation);
      setAvatarUrl(profile.avatar_url || getAvatarUrl(profile.username));
      setGender(profile.gender || "");
      setAge(profile.age || "");
      if (profile.bannerGradient !== undefined) {
        setGradientIdx(profile.bannerGradient);
      } else {
        const seed = profile.username || "default";
        const initialIdx = Math.abs(seed.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0)) % GRADIENTS.length;
        setGradientIdx(initialIdx);
      }
    }
  }, [profile]);

  const handleSave = async () => {
    setError(null);
    if (!handle.trim()) { setError("Display name is required."); return; }
    if (!gender) { setError("Gender is required."); return; }
    if (age === "" || isNaN(Number(age)) || Number(age) <= 0) { setError("Please enter a valid age."); return; }
    setIsSaving(true);
    try {
      await saveProfile({ handle, bio, vibeEmoji, radarRange, hotspotRange, bannerGradient: gradientIdx, selectedTags, maskLocation, avatar_url: avatarUrl, gender, age: Number(age) });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error(e);
      setError("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTag = (tag: string) =>
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : prev.length < 6 ? [...prev, tag] : prev
    );

  // ─ Loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-300" />
      </div>
    );
  }

  // ─ Signed-out landing
  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center bg-white select-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280 }}
          className="w-20 h-20 rounded-[24px] bg-zinc-100 flex items-center justify-center mb-6 text-4xl shadow-sm"
        >
          ☕
        </motion.div>

        <motion.h1
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-3xl font-black tracking-tight mb-2 text-zinc-900"
        >
          norby
        </motion.h1>

        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-zinc-400 mb-10 max-w-[240px] leading-relaxed"
        >
          Discover people nearby for cafés, dating, gaming, movies, and spontaneous moments.
        </motion.p>

        <motion.button
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileTap={{ scale: 0.97 }}
          onClick={signIn}
          className="flex items-center justify-center w-full max-w-xs py-4 rounded-2xl bg-zinc-900 text-white font-bold text-[15px] shadow-lg gap-2 hover:bg-black transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Continue with Puter
        </motion.button>

        <p className="text-zinc-400 text-[10px] mt-5 leading-relaxed">
          Free · No email needed · Powered by Puter
        </p>
      </div>
    );
  }

  // ─ Signed-in profile
  return (
    <div className="h-full overflow-y-auto bg-zinc-50 text-zinc-900 pb-24">

      {/* ═══════════════ HERO CARD ═══════════════ */}
      <div className="bg-white mx-0 border-b border-zinc-100 relative">
        {/* Deterministic RGB Gradient Header Banner */}
        <div
          className="w-full h-28 relative"
          style={{ background: userGradient }}
        >
          {/* Double Arrow Shuffle Button inside Banner top-right */}
          <button
            onClick={async () => {
              const nextIdx = Math.floor(Math.random() * GRADIENTS.length);
              setGradientIdx(nextIdx);
              try {
                await saveProfile({ bannerGradient: nextIdx });
              } catch (e) {
                console.error("Failed to auto-save gradient:", e);
              }
            }}
            title="Randomize Gradient Banner"
            className="absolute top-3 right-3 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md transition-colors border border-white/10 active:scale-90 flex items-center justify-center cursor-pointer shadow-sm z-30"
          >
            <Shuffle size={14} />
          </button>
        </div>
        <div className="flex flex-col items-center text-center px-5 -mt-10 pb-6 relative z-10">
          {/* Avatar Container with Vibe Badge and Floating Vibe Picker */}
          <div className="relative shrink-0 mb-3">
            <div className="relative group cursor-pointer" onClick={() => setShowAvatarPicker(true)}>
              <div className="w-20 h-20 rounded-full bg-white overflow-hidden border-4 border-white shadow-md transition-all group-hover:scale-[1.03] relative">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full text-2xl bg-zinc-50">{vibeEmoji}</span>
                )}
              </div>
              {/* Vibe badge button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v); }}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-sm hover:bg-zinc-50 transition-colors z-20 active:scale-90"
              >
                {vibeEmoji}
              </button>
            </div>

            {/* Vibe Emoji Picker floating locally in the air */}
            <AnimatePresence>
              {showEmojiPicker && (
                <motion.div
                  ref={emojiPickerRef}
                  initial={{ opacity: 0, scale: 0.9, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 8 }}
                  className="absolute top-[100px] left-1/2 -translate-x-1/2 z-50 bg-white border border-zinc-200 rounded-2xl p-2.5 grid grid-cols-8 gap-1 shadow-xl w-[340px]"
                >
                  {EMOJI_OPTIONS.map(e => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => { setVibeEmoji(e); setShowEmojiPicker(false); }}
                      className={`w-9 h-9 text-lg flex items-center justify-center rounded-lg transition-colors hover:bg-zinc-100 active:scale-90 ${vibeEmoji === e ? "bg-zinc-50 border border-zinc-200 shadow-sm" : ""
                        }`}
                    >
                      {e}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Info */}
          <div className="w-full flex flex-col items-center">
            <h2 className="text-lg font-bold text-zinc-900 truncate max-w-[200px]">{handle || user?.username}</h2>
            <p className="text-xs text-zinc-400 mt-0.5">@{user?.username}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowAvatarPicker(true)}
                className="px-4 py-2 rounded-full bg-zinc-900 text-[10px] font-bold text-white hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <Sparkles size={11} /> Edit Avatar & Vibe
              </button>
            </div>
          </div>
        </div>


      </div>

      {/* ═══════════════ PERSONAL INFO ═══════════════ */}
      <div className="bg-white mx-3 mt-3 rounded-2xl border border-zinc-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-50">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Personal Info</h3>
        </div>

        <div className="divide-y divide-zinc-50">
          {/* Display Name */}
          <div className="px-4 py-3">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Display Name</label>
            <input
              type="text"
              value={handle}
              onChange={e => setHandle(e.target.value)}
              placeholder="e.g. Skyler ⚡"
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors"
            />
          </div>

          {/* Age & Gender row */}
          <div className="px-4 py-3 flex gap-3">
            <div className="w-24 shrink-0">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Age *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={age}
                onChange={e => { const val = e.target.value; setAge(val === "" ? "" : parseInt(val)); }}
                placeholder="21"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Gender *</label>
              <div className="flex flex-wrap gap-1.5">
                {(["Male", "Female", "Non-binary", "Prefer not to say"] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGender(option)}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-semibold transition-all active:scale-95 ${gender === option
                        ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                        : "bg-zinc-50 border-zinc-200 text-zinc-500 hover:border-zinc-300"
                      }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tagline */}
          <div className="px-4 py-3">
            <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Tagline</label>
            <div className="relative">
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 150))}
                placeholder="Late night ramen, vinyl records, and strong espresso."
                rows={2}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors resize-none leading-relaxed"
              />
              <span className="absolute bottom-2 right-3 text-[9px] text-zinc-400 font-semibold">{bio.length}/150</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════ INTERESTS ═══════════════ */}
      <div className="bg-white mx-3 mt-3 rounded-2xl border border-zinc-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-50 flex justify-between items-center">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Interests</h3>
          <span className="text-[10px] font-bold text-zinc-400">{selectedTags.length}/6</span>
        </div>
        <div className="px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {INTEREST_TAGS.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1.5 rounded-full border text-[10px] font-semibold transition-all active:scale-95 ${active
                      ? "bg-zinc-900 border-zinc-900 text-white"
                      : "bg-white border-zinc-200 text-zinc-500 hover:border-zinc-400"
                    }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════ DISCOVERY ═══════════════ */}
      <div className="bg-white mx-3 mt-3 rounded-2xl border border-zinc-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-50">
          <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Discovery</h3>
        </div>

        {/* Radar range */}
        <div className="px-4 py-3 border-b border-zinc-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-zinc-700">Radar Range</span>
            <span className="text-xs font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-full">{radarRange} km</span>
          </div>
          <input
            type="range" min="10" max="30" step="1"
            value={radarRange}
            onChange={e => setRadarRange(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full cursor-pointer accent-zinc-900 bg-zinc-200"
          />
          <p className="text-[10px] text-zinc-400 mt-1.5">
            How far out you scan for nearby users and activity (10km - 30km).
          </p>
        </div>

        {/* Hotspot range */}
        <div className="px-4 py-3 border-b border-zinc-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-zinc-700">Hotspot Visibility Range</span>
            <span className="text-xs font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-full">{hotspotRange} km</span>
          </div>
          <input
            type="range" min="10" max="30" step="1"
            value={hotspotRange}
            onChange={e => setHotspotRange(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full cursor-pointer accent-zinc-900 bg-zinc-200"
          />
          <p className="text-[10px] text-zinc-400 mt-1.5">
            Maximum distance others can be to see your posted hotspots (10km - 30km).
          </p>
        </div>

        {/* Location Masking */}
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0">
              <Shield size={14} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-800">Location Masking</p>
              <p className="text-[9px] text-zinc-400 leading-relaxed">±100–200m privacy offset</p>
            </div>
          </div>
          <button
            onClick={() => setMaskLocation(!maskLocation)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${maskLocation ? "bg-zinc-900" : "bg-zinc-200"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${maskLocation ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      {/* ═══════════════ BLOCKED USERS ═══════════════ */}
      {profile?.blockedUsers && profile.blockedUsers.length > 0 && (
        <div className="bg-white mx-3 mt-3 rounded-2xl border border-zinc-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-50">
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Blocked Users</h3>
          </div>
          <div className="divide-y divide-zinc-50">
            {profile.blockedUsers.map((id) => (
              <div key={id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-medium text-zinc-600 truncate">ID: {id}</span>
                <button
                  onClick={() => unblockUser(id)}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 shrink-0 active:scale-95"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════ SAVE BUTTON ═══════════════ */}
      <div className="mx-3 mt-4 mb-6">
        {error && (
          <p className="text-xs text-red-500 font-semibold text-center mb-2">{error}</p>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${saveSuccess ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white hover:bg-black"
            } disabled:opacity-50`}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saveSuccess ? (
            "✓ Saved!"
          ) : (
            "Save Profile"
          )}
        </motion.button>
      </div>

      {/* ═══════════════ SIGN OUT BUTTON ═══════════════ */}
      <div className="mx-3 mt-3 mb-4">
        <button
          onClick={signOut}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 active:scale-[0.98] shadow-sm"
        >
          <LogOut size={16} />
          Sign Out of Norby
        </button>
      </div>

      {/* ═══════════════ AVATAR PICKER MODAL ═══════════════ */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm select-none"
            onClick={e => { if (e.target === e.currentTarget) setShowAvatarPicker(false); }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-zinc-200" />
              </div>

              {/* Header */}
              <div className="px-5 pt-3 pb-3 border-b border-zinc-100 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Customize Avatar</h3>
                  <p className="text-[10px] text-zinc-400 font-medium">Choose a style or upload your own</p>
                </div>
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  className="p-1.5 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1 scrollbar-none">

                {/* Big Preview */}
                <div className="flex flex-col items-center">
                  <div
                    className="w-24 h-24 rounded-2xl border border-zinc-200 shadow-inner overflow-hidden flex items-center justify-center relative"
                    style={{
                      backgroundImage: 'conic-gradient(#f4f4f5 25%, white 0 50%, #f4f4f5 0 75%, white 0)',
                      backgroundSize: '16px 16px'
                    }}
                  >
                    <img src={previewAvatarUrl} alt="Preview" className="w-20 h-20 object-contain" />
                  </div>
                  <span className="text-[9px] text-zinc-400 mt-1.5 font-medium bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-100">
                    {uploadedImage ? "Custom Image" : "Transparent SVG"}
                  </span>

                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="mt-2.5 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-all text-[11px] font-semibold text-zinc-700 flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Upload size={12} className="text-zinc-500" />
                    Upload Photo
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                </div>

                {/* Seed Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Character</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["Felix", "Aneka", "Milo", "Luna"] as const).map(preset => (
                      <button
                        key={preset}
                        onClick={() => selectPresetSeed(preset)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${activeSeedType === preset
                            ? "bg-zinc-900 border-zinc-900 text-white"
                            : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                          }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <button
                      onClick={() => { setActiveSeedType("custom"); setTempSeed(customSeedText.trim() || user?.username || "user"); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${activeSeedType === "custom"
                          ? "bg-zinc-900 border-zinc-900 text-white"
                          : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                        }`}
                    >
                      Custom
                    </button>
                  </div>

                  {activeSeedType === "custom" && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={customSeedText}
                        onChange={e => handleCustomSeedChange(e.target.value)}
                        placeholder="Type any seed..."
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-400 transition-colors"
                      />
                      <button
                        onClick={randomizeCustomSeed}
                        className="px-3 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-1 text-xs font-semibold shrink-0 active:scale-95"
                      >
                        <Shuffle size={12} /> Random
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Style Grid */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Style ({AVATAR_STYLES.length})</label>
                  <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[200px] pr-1 scrollbar-none">
                    {AVATAR_STYLES.map(style => {
                      const isActive = !uploadedImage && tempStyle === style.id;
                      const stylePreviewUrl = `https://api.dicebear.com/9.x/${style.id}/svg?seed=${encodeURIComponent(tempSeed)}`;
                      return (
                        <button
                          key={style.id}
                          onClick={() => handleStyleChange(style.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all active:scale-95 ${isActive
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-zinc-50 border-zinc-200/60 text-zinc-700 hover:border-zinc-300"
                            }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200/50 overflow-hidden flex items-center justify-center">
                            <img src={stylePreviewUrl} alt={style.name} className="w-8 h-8 object-contain" loading="lazy" />
                          </div>
                          <p className="text-[8px] font-bold truncate w-full text-center leading-tight">{style.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-zinc-100 flex gap-3 bg-zinc-50">
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-600 font-semibold text-xs hover:bg-zinc-50 transition-colors active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={applyAvatar}
                  className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-black transition-colors flex items-center justify-center gap-1 active:scale-95"
                >
                  <Check size={12} /> Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
