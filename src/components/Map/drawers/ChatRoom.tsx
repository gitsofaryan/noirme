"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface ChatRoomProps {
  messages: any[];
  myUserId: string;
  onSendMessage: (text: string) => void;
  userLocation: { lat: number; lng: number } | null;
  hotspotTitle: string;
}

export function ChatRoom({
  messages,
  myUserId,
  onSendMessage,
  userLocation,
  hotspotTitle,
}: ChatRoomProps) {
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [showSafety, setShowSafety] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = () => {
    if (!text.trim()) return;
    onSendMessage(text);
    setText("");
  };

  const handleCopySOS = () => {
    if (!userLocation) return;
    const sosMsg = `🚨 [SOS Alert] I am meeting someone for Norby hotspot "${hotspotTitle}". My current location is: https://maps.google.com/?q=${userLocation.lat},${userLocation.lng} (Coordinates: ${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)})`;
    navigator.clipboard.writeText(sosMsg);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Safety SOS Banner */}
      <div className="bg-amber-50/60 border border-amber-200/50 rounded-2xl p-3 text-zinc-800">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">🛡️</span>
            <span className="text-[11px] font-bold text-amber-900">Physical Meetup Safety</span>
          </div>
          <button
            onClick={() => setShowSafety(!showSafety)}
            className="text-[10px] font-semibold text-amber-800 underline hover:text-amber-900"
          >
            {showSafety ? "Hide Tips" : "Show Tips & SOS"}
          </button>
        </div>

        {showSafety && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2.5 pt-2.5 border-t border-amber-200/40 space-y-2 text-[10px] text-amber-950 font-medium"
          >
            <ul className="list-disc pl-3.5 space-y-1">
              <li>Meet in a busy, well-lit public space.</li>
              <li>Share this location and meetup details with a trusted friend.</li>
              <li>Keep your phone charged and in your hand.</li>
              <li>If you feel unsafe at any point, walk away immediately.</li>
            </ul>
            {userLocation && (
              <button
                onClick={handleCopySOS}
                className={`w-full mt-2 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-[0.98] ${
                  copiedCoords
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-600 hover:bg-amber-700 text-white"
                }`}
              >
                {copiedCoords ? "✓ SOS Info Copied to Clipboard!" : "🚨 Copy SOS Coordinates & Details"}
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Messages */}
      <div className="h-[180px] overflow-y-auto border border-zinc-100 bg-zinc-50/50 rounded-2xl p-3 flex flex-col gap-2.5 scrollbar-none">
        {messages.length === 0 ? (
          <p className="text-[11px] text-zinc-400 text-center my-auto font-medium">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === myUserId;
            return (
              <div
                key={m.id}
                className={`flex gap-2 max-w-[85%] ${isMe ? "self-end flex-row-reverse" : "self-start"}`}
              >
                {!isMe && (
                  <img
                    src={m.sender_avatar}
                    className="w-6 h-6 rounded-full border border-zinc-200 mt-0.5 shrink-0 object-cover"
                    alt={m.sender_username}
                  />
                )}
                <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                  {!isMe && (
                    <span className="text-[8px] font-bold text-zinc-400 ml-1 mb-0.5">
                      @{m.sender_username}
                    </span>
                  )}
                  <div
                    className={`px-3.5 py-2 text-xs leading-normal shadow-sm transition-all duration-300 ${
                      isMe
                        ? "bg-zinc-900 text-white rounded-2xl rounded-tr-none font-medium"
                        : "bg-white border border-zinc-200/60 text-zinc-800 rounded-2xl rounded-tl-none font-medium"
                    } ${m.isOffline ? "opacity-50 border border-dashed border-zinc-300 bg-zinc-100" : ""}`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[7px] text-zinc-400 mt-0.5 px-1 font-semibold flex items-center gap-1">
                    {m.isOffline ? (
                      <span className="text-zinc-500 animate-pulse flex items-center gap-1 font-bold">
                        <span className="inline-block w-1 h-1 rounded-full bg-zinc-400 animate-ping" />
                        Queued
                      </span>
                    ) : (
                      new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type message..."
          className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="px-4 py-2.5 bg-zinc-900 hover:bg-black text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
