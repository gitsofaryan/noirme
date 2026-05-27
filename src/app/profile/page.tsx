"use client";

import { useAuth, getAvatarUrl } from "@/hooks/useAuth";
import { LogIn, LogOut, Loader2, Shield, X, Sparkles, Shuffle, Check, Info, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const INTEREST_TAGS = [
  "Study Grind 📚", "Specialty Coffee ☕", "Boba Runs 🧋", "Thrifting 🪵",
  "Skateboarding 🛹", "Alt Vinyls 🎵", "Heavy Lifting 🏋️", "Matcha Latte 🍵",
  "Visual Arts 🎨", "Midnight Ramen 🍜", "Lo-fi Beats 🎧", "Retro Gaming 👾",
  "Hackathon 💻", "Cycling 🚴", "Photography 📷", "Open Mic 🎤",
];

const EMOJI_OPTIONS = [
  "☕", "🎒", "🎸", "🍕", "💻", "📚", "🎨", "🛹",
  "🎧", "🍿", "🍵", "⚡", "✨", "🔥", "🎯", "🌙",
  "🎤", "📷", "🧋", "🍜", "🏋️", "🚴", "🎮", "🌿",
];

const AVATAR_STYLES = [
  { id: "adventurer", name: "Adventurer", author: "Lisa Wischofsky", license: "CC BY 4.0" },
  { id: "adventurer-neutral", name: "Adventurer Neutral", author: "Lisa Wischofsky", license: "CC BY 4.0" },
  { id: "avataaars", name: "Avataaars", author: "Pablo Stanley", license: "Free for Personal/Commercial" },
  { id: "avataaars-neutral", name: "Avataaars Neutral", author: "Pablo Stanley", license: "Free for Personal/Commercial" },
  { id: "big-ears", name: "Big Ears", author: "The Visual Team", license: "CC BY 4.0" },
  { id: "big-ears-neutral", name: "Big Ears Neutral", author: "The Visual Team", license: "CC BY 4.0" },
  { id: "big-smile", name: "Big Smile", author: "Ashley Seo", license: "CC BY 4.0" },
  { id: "bottts", name: "Bottts", author: "Pablo Stanley", license: "Free for Personal/Commercial" },
  { id: "bottts-neutral", name: "Bottts Neutral", author: "Pablo Stanley", license: "Free for Personal/Commercial" },
  { id: "croodles", name: "Croodles", author: "vijay verma", license: "CC BY 4.0" },
  { id: "croodles-neutral", name: "Croodles Neutral", author: "vijay verma", license: "CC BY 4.0" },
  { id: "dylan", name: "Dylan", author: "Natalia Spivak", license: "CC BY 4.0" },
  { id: "fun-emoji", name: "Fun Emoji", author: "Davis Uche", license: "CC BY 4.0" },
  { id: "lorelei", name: "Lorelei", author: "Lisa Wischofsky", license: "CC0 1.0" },
  { id: "lorelei-neutral", name: "Lorelei Neutral", author: "Lisa Wischofsky", license: "CC0 1.0" },
  { id: "micah", name: "Micah", author: "Micah Lanier", license: "CC BY 4.0" },
  { id: "miniavs", name: "Miniavs", author: "Webpixels", license: "CC BY 4.0" },
  { id: "notionists", name: "Notionists", author: "Zoish", license: "CC0 1.0" },
  { id: "notionists-neutral", name: "Notionists Neutral", author: "Zoish", license: "CC0 1.0" },
  { id: "open-peeps", name: "Open Peeps", author: "Pablo Stanley", license: "CC0 1.0" },
  { id: "personas", name: "Personas", author: "Draftbit", license: "CC BY 4.0" },
  { id: "pixel-art", name: "Pixel Art", author: "DiceBear", license: "CC0 1.0" },
  { id: "pixel-art-neutral", name: "Pixel Art Neutral", author: "DiceBear", license: "CC0 1.0" },
  { id: "toon-head", name: "Toon Head", author: "Toon Head", license: "CC BY 4.0" }
];

export default function ProfilePage() {
  const { isSignedIn, isLoading, user, profile, saveProfile, signIn, signOut } = useAuth();

  const [handle, setHandle] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Non-binary" | "Prefer not to say" | "">("");
  const [age, setAge] = useState<number | "">("");
  const [bio, setBio] = useState("");
  const [vibeEmoji, setVibeEmoji] = useState("☕");
  const [radarRange, setRadarRange] = useState(2);
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
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

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

  // Derive URL to preview
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
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
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
      setSelectedTags(profile.selectedTags);
      setMaskLocation(profile.maskLocation);
      setAvatarUrl(profile.avatar_url || getAvatarUrl(profile.username));
      setGender(profile.gender || "");
      setAge(profile.age || "");
    }
  }, [profile]);

  const handleSave = async () => {
    setError(null);
    if (!handle.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!gender) {
      setError("Gender is required.");
      return;
    }
    if (age === "" || isNaN(Number(age)) || Number(age) <= 0) {
      setError("Please enter a valid age.");
      return;
    }
    setIsSaving(true);
    try {
      await saveProfile({ 
        handle, 
        bio, 
        vibeEmoji, 
        radarRange, 
        selectedTags, 
        maskLocation, 
        avatar_url: avatarUrl,
        gender,
        age: Number(age)
      });
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
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 5 ? [...prev, tag] : prev
    );

  const rerollAvatar = () =>
    setAvatarUrl(getAvatarUrl(`${user?.username || "user"}-${Date.now()}`));

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
          noirme
        </motion.h1>

        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm text-zinc-400 mb-10 max-w-[240px] leading-relaxed"
        >
          Discover people nearby for activities, hangouts, and spontaneous moments.
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
    <div className="h-full overflow-y-auto bg-white text-zinc-900">

      {/* Avatar Hero */}
      <div className="px-5 pt-8 pb-6 border-b border-zinc-100 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative mb-4 group cursor-pointer" onClick={() => setShowAvatarPicker(true)}>
          <div className="w-24 h-24 rounded-full bg-white overflow-hidden border-2 border-zinc-200 shadow-sm transition-all group-hover:scale-[1.03] group-hover:border-zinc-300 relative">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="flex items-center justify-center w-full h-full text-3xl">{vibeEmoji}</span>
            )}
            {/* Edit overlay */}
            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" />
          </div>
          {/* Vibe badge */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(v => !v); }}
            className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-sm hover:bg-zinc-50 transition-colors z-10"
          >
            {vibeEmoji}
          </button>
        </div>

        {/* Emoji picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              className="absolute mt-1 z-50 bg-white border border-zinc-200 rounded-2xl p-3 grid grid-cols-8 gap-0.5 shadow-xl top-36"
            >
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => { setVibeEmoji(e); setShowEmojiPicker(false); }}
                  className="w-8 h-8 text-base flex items-center justify-center rounded-xl hover:bg-zinc-100 transition-colors"
                >
                  {e}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <h2 className="text-xl font-bold text-zinc-900">{handle || user?.username}</h2>
        <p className="text-xs text-zinc-400 mt-0.5">@{user?.username}</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setShowAvatarPicker(true)}
            className="px-4 py-1.5 rounded-full bg-zinc-900 text-[11px] font-semibold text-white hover:bg-black transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles size={11} className="text-zinc-300" /> Customize Avatar
          </button>
          <button
            onClick={signOut}
            className="px-4 py-1.5 rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1"
          >
            <LogOut size={10} /> Sign out
          </button>
        </div>
      </div>

      {/* Form body */}
      <div className="px-5 py-5 space-y-6">

        {/* Handle */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Display Name</label>
          <input
            type="text"
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder="e.g. Skyler ⚡"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors"
          />
        </div>

        {/* Age */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Age *</label>
          <input
            type="number"
            min="1"
            step="1"
            value={age}
            onChange={e => {
              const val = e.target.value;
              setAge(val === "" ? "" : parseInt(val));
            }}
            placeholder="e.g. 21"
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors"
          />
        </div>

        {/* Gender */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Gender *</label>
          <div className="flex flex-wrap gap-2">
            {(["Male", "Female", "Non-binary", "Prefer not to say"] as const).map(option => {
              const active = gender === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setGender(option)}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                    active
                      ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                      : "bg-zinc-50 border-zinc-200/80 text-zinc-550 hover:border-zinc-300"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Tagline</label>
          <div className="relative">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value.slice(0, 150))}
              placeholder="Late night ramen, vinyl records, and strong espresso."
              rows={3}
              className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-300 focus:outline-none focus:border-zinc-400 transition-colors resize-none leading-relaxed"
            />
            <span className="absolute bottom-2.5 right-3 text-[9px] text-zinc-400 font-semibold">{bio.length}/150</span>
          </div>
        </div>

        {/* Radar range */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Discovery Radius</label>
            <span className="text-sm font-bold text-zinc-900">{radarRange} km</span>
          </div>
          <input
            type="range" min="0.5" max="10" step="0.5"
            value={radarRange}
            onChange={e => setRadarRange(parseFloat(e.target.value))}
            className="w-full h-1.5 rounded-full cursor-pointer accent-zinc-900 bg-zinc-200"
          />
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Shows activity within this radius on the live map.
          </p>
        </div>

        {/* Interest Tags */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Interests</label>
            <span className="text-[10px] font-semibold text-zinc-400">{selectedTags.length}/5</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {INTEREST_TAGS.map(tag => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-all duration-150 ${
                    active
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

        {/* Location Masking Toggle */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <Shield size={13} className="text-zinc-500 shrink-0" />
              Location Masking
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed">
              Applies a ±100–200m offset so your exact location stays private.
            </p>
          </div>
          <button
            onClick={() => setMaskLocation(!maskLocation)}
            className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${maskLocation ? "bg-zinc-900" : "bg-zinc-200"}`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${maskLocation ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Save */}
        <div className="space-y-2">
          {error && (
            <p className="text-xs text-red-500 font-semibold text-center">{error}</p>
          )}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isSaving}
            className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              saveSuccess ? "bg-emerald-500 text-white" : "bg-zinc-900 text-white hover:bg-black"
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

        {/* Bottom padding for safe area */}
        <div className="h-2" />
      </div>

      {/* Avatar Picker Modal */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 select-none"
            onClick={e => { if (e.target === e.currentTarget) setShowAvatarPicker(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3 border-b border-zinc-100 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Customize Avatar</h3>
                  <p className="text-[10px] text-zinc-400 font-medium">Create your look with transparent SVGs</p>
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
                    className="w-28 h-28 rounded-2xl border border-zinc-200 shadow-inner overflow-hidden flex items-center justify-center relative group"
                    style={{ 
                      backgroundImage: 'conic-gradient(#f4f4f5 25%, white 0 50%, #f4f4f5 0 75%, white 0)',
                      backgroundSize: '16px 16px'
                    }}
                  >
                    <img 
                      src={previewAvatarUrl} 
                      alt="Avatar Preview" 
                      className="w-24 h-24 object-contain transition-transform group-hover:scale-110" 
                    />
                  </div>
                  <span className="text-[9px] text-zinc-400 mt-2 font-medium tracking-wide bg-zinc-50 px-2 py-0.5 rounded-full border border-zinc-100">
                    {uploadedImage ? "Uploaded Custom Image" : "Transparent Background"}
                  </span>
                  
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="mt-3 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all text-[11px] font-semibold text-zinc-700 flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Upload size={12} className="text-zinc-500" />
                    Upload from Device
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Seed / Character Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Select Character</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(["Felix", "Aneka", "Milo", "Luna"] as const).map(preset => {
                      const isActive = activeSeedType === preset;
                      return (
                        <button
                          key={preset}
                          onClick={() => selectPresetSeed(preset)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            isActive 
                              ? "bg-zinc-900 border-zinc-900 text-white" 
                              : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        setActiveSeedType("custom");
                        setTempSeed(customSeedText.trim() || user?.username || "user");
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        activeSeedType === "custom" 
                          ? "bg-zinc-900 border-zinc-900 text-white" 
                          : "bg-white border-zinc-200 text-zinc-600 hover:border-zinc-400"
                      }`}
                    >
                      Custom Seed
                    </button>
                  </div>

                  {activeSeedType === "custom" && (
                    <motion.div 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2 mt-2"
                    >
                      <input
                        type="text"
                        value={customSeedText}
                        onChange={e => handleCustomSeedChange(e.target.value)}
                        placeholder="Type any custom seed..."
                        className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-400 transition-colors"
                      />
                      <button
                        onClick={randomizeCustomSeed}
                        className="px-3 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors flex items-center gap-1 text-xs font-semibold shrink-0"
                      >
                        <Shuffle size={12} /> Random
                      </button>
                    </motion.div>
                  )}
                </div>

                {/* Style Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-zinc-400">Choose Style ({AVATAR_STYLES.length})</label>
                  <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[220px] pr-1 scrollbar-none">
                    {AVATAR_STYLES.map(style => {
                      const isActive = !uploadedImage && tempStyle === style.id;
                      const stylePreviewUrl = `https://api.dicebear.com/9.x/${style.id}/svg?seed=${encodeURIComponent(tempSeed)}`;
                      return (
                        <button
                          key={style.id}
                          onClick={() => handleStyleChange(style.id)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                            isActive
                              ? "bg-zinc-900 border-zinc-900 text-white shadow-sm"
                              : "bg-zinc-50 border-zinc-200/60 text-zinc-700 hover:border-zinc-300"
                          }`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-white border border-zinc-200/50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                            <img src={stylePreviewUrl} alt={style.name} className="w-8 h-8 object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold truncate leading-tight">{style.name}</p>
                            <p className={`text-[8px] truncate mt-0.5 ${isActive ? "text-zinc-300" : "text-zinc-400"}`}>
                              {style.author}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Actions Footer */}
              <div className="px-5 py-4 border-t border-zinc-100 flex gap-3 bg-zinc-50">
                <button
                  onClick={() => setShowAvatarPicker(false)}
                  className="flex-1 py-3 rounded-xl bg-white border border-zinc-200 text-zinc-600 font-semibold text-xs hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applyAvatar}
                  className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-bold text-xs hover:bg-black transition-colors flex items-center justify-center gap-1"
                >
                  <Check size={12} /> Apply Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
