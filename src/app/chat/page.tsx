"use client";

import { useMapContext } from "@/components/Map/MapProvider";
import { useAuth, getAvatarUrl } from "@/hooks/useAuth";
import { getDistanceKm } from "@/hooks/useGeolocation";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ArrowLeft,
  Send,
  Navigation,
  Check,
  X,
  Clock,
  Sparkles,
  UserCheck,
  UserPlus,
  Loader2
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const router = useRouter();
  const { isSignedIn, signIn } = useAuth();
  
  const {
    myUserId,
    chatRequests,
    friends,
    chatMessages,
    peerTyping,
    activeChatUser,
    setActiveChatUser,
    sendChatRequest,
    respondChatRequest,
    sendDirectMessage,
    sendTypingState,
    setRoutingTarget,
    setFollowUser,
    addToast,
    isLoadingHistory,
    activeUsers,
    filteredHotspots,
    location,
    selectedHotspot,
    setSelectedHotspot,
    requestJoin
  } = useMapContext();

  const [activeTab, setActiveTab] = useState<"chats" | "hotspots" | "requests">("chats");
  const [typedMessage, setTypedMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, peerTyping]);

  // Handle typing state broadcast
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTypedMessage(e.target.value);
    sendTypingState(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingState(false);
    }, 2000);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim()) return;

    sendDirectMessage(typedMessage.trim());
    setTypedMessage("");
    sendTypingState(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleNavigateToFriend = (friend: any) => {
    if (friend.lat && friend.lng) {
      setRoutingTarget({
        lat: friend.lat,
        lng: friend.lng,
        name: friend.username
      });
      setFollowUser(true);
      addToast(`Routing path to @${friend.username}...`);
      router.push("/");
    } else {
      addToast(`@${friend.username} is currently offline or location is not shared.`);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="absolute inset-0 flex items-center justify-center p-6 bg-zinc-50 text-zinc-900 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md p-8 rounded-3xl bg-white border border-zinc-200/80 shadow-xl text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 bg-zinc-50 rounded-2xl flex items-center justify-center border border-zinc-150">
            <MessageSquare className="w-8 h-8 text-zinc-400" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-zinc-900">Connect & Chat</h2>
          <p className="text-sm text-zinc-500 mb-8 max-w-xs mx-auto leading-relaxed">
            Sign in to connect with nearby users, send chat requests, and start exchanging ephemeral messages.
          </p>
          <button
            onClick={signIn}
            className="w-full py-4 rounded-2xl bg-zinc-900 text-white font-bold hover:bg-black active:scale-95 transition-all shadow-md cursor-pointer"
          >
            Sign In with Puter
          </button>
        </motion.div>
      </div>
    );
  }

  // Split requests
  const incomingRequests = chatRequests.filter(
    (r) => r.target_id === myUserId && r.status === "pending"
  );
  const outgoingRequests = chatRequests.filter(
    (r) => r.sender_id === myUserId && r.status === "pending"
  );

  return (
    <div className="absolute inset-0 bg-zinc-50 text-zinc-900 flex overflow-hidden">
      
      {/* Main Container */}
      <div className="w-full h-full flex z-10">
        
        {/* Left pane: Chats and Requests list */}
        <div
          className={`w-full md:w-[380px] h-full border-r border-zinc-150 flex flex-col bg-white ${
            activeChatUser ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="p-6 border-b border-zinc-100 flex flex-col gap-4">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Messages</h1>
            
            {/* Tabs */}
            <div className="flex bg-zinc-100/80 p-1 rounded-xl border border-zinc-200/50">
              <button
                onClick={() => setActiveTab("chats")}
                className={`flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  activeTab === "chats"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/40"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Chats ({friends.length})
              </button>
              <button
                onClick={() => setActiveTab("hotspots")}
                className={`flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer ${
                  activeTab === "hotspots"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/40"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Hotspots ({filteredHotspots.length})
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`flex-1 py-2 text-[10px] font-extrabold rounded-lg transition-all relative cursor-pointer ${
                  activeTab === "requests"
                    ? "bg-white text-zinc-900 shadow-sm border border-zinc-200/40"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                Requests
                {incomingRequests.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 rounded-full text-[9px] flex items-center justify-center font-extrabold text-white">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* List Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 bg-white">
            <AnimatePresence mode="popLayout">
              {activeTab === "chats" ? (
                friends.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-400 select-none"
                  >
                    <MessageSquare className="w-8 h-8 mb-3 opacity-40 text-zinc-300" />
                    <p className="text-sm font-bold text-zinc-700">No active conversations</p>
                    <p className="text-xs opacity-85 mt-1 max-w-[200px] leading-normal">
                      Wave or request chat from nearby users on the map to start chatting!
                    </p>
                  </motion.div>
                ) : (
                  friends.map((friend) => {
                    const isTyping = peerTyping[friend.user_id];
                    const isSelected = activeChatUser?.user_id === friend.user_id;

                    return (
                      <motion.button
                        key={friend.user_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        onClick={() => setActiveChatUser(friend)}
                        className={`w-full p-3.5 rounded-2xl flex items-center gap-3.5 transition-all text-left border cursor-pointer ${
                          isSelected
                            ? "bg-zinc-50 border-zinc-200/80 shadow-sm"
                            : "bg-transparent border-transparent hover:bg-zinc-50/60"
                        }`}
                      >
                        {/* Avatar container */}
                        <div className="relative">
                          <div className="w-12 h-12 rounded-xl bg-zinc-100 overflow-hidden border border-zinc-150">
                            <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                          </div>
                          {/* Live halo ring */}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center">
                            <span className="text-[9px] font-extrabold">{friend.vibeEmoji}</span>
                          </div>
                        </div>

                        {/* Name and Snippet */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h3 className="font-bold text-sm tracking-tight text-zinc-900 truncate">
                              @{friend.username}
                            </h3>
                            <span className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-wider">
                              {friend.status === "away" ? "Away" : "Active"}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 truncate font-medium">
                            {isTyping ? (
                              <span className="text-purple-600 font-bold animate-pulse">Typing...</span>
                            ) : (
                              friend.bio || "Tap to chat"
                            )}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })
                )
              ) : activeTab === "hotspots" ? (
                filteredHotspots.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-64 flex flex-col items-center justify-center text-center p-6 text-zinc-400 select-none"
                  >
                    <Navigation className="w-8 h-8 mb-3 opacity-40 text-zinc-300 animate-pulse" />
                    <p className="text-sm font-bold text-zinc-700">No hotspots nearby</p>
                    <p className="text-xs opacity-85 mt-1 max-w-[200px] leading-normal">
                      Be the first to post a gathering intent on the map!
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {filteredHotspots.map((hotspot) => {
                      const isHost = hotspot.host_id === myUserId;
                      const hasPending = hotspot.requests?.some(
                        (r: any) => r.user_id === myUserId && r.status === "pending"
                      );
                      const isMember = hotspot.requests?.some(
                        (r: any) => r.user_id === myUserId && r.status === "accepted"
                      );
                      
                      const distance = location
                        ? getDistanceKm(location.lat, location.lng, hotspot.lat, hotspot.lng)
                        : null;

                      return (
                        <motion.div
                          key={hotspot.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="p-4 bg-zinc-50 border border-zinc-150 rounded-2xl flex flex-col gap-3 shadow-sm hover:border-zinc-200 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            {/* Host Avatar */}
                            <div className="relative">
                              <div className="w-10 h-10 rounded-xl bg-zinc-150 overflow-hidden border border-zinc-200 flex-shrink-0">
                                <img
                                  src={hotspot.host_avatar || getAvatarUrl(hotspot.host_username)}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center">
                                <span className="text-[9px] font-extrabold">{hotspot.vibeEmoji || "🔥"}</span>
                              </div>
                            </div>

                            {/* Hostname & Distance */}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest leading-none mb-1">
                                {isHost ? "Your Hotspot" : `@${hotspot.host_username}`}
                              </h4>
                              <h3 className="font-extrabold text-sm text-zinc-900 truncate leading-snug">
                                {hotspot.title}
                              </h3>
                              <p className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mt-0.5 leading-none">
                                📍 {distance !== null ? `${distance.toFixed(2)} km` : "Nearby"} · {hotspot.requests?.filter((r: any) => r.status === "accepted").length || 0} joined
                              </p>
                            </div>
                          </div>

                          {/* Action Bar */}
                          <div className="flex gap-2">
                            {isHost || isMember ? (
                              <button
                                onClick={() => {
                                  setSelectedHotspot(hotspot);
                                  router.push("/");
                                }}
                                className="flex-1 py-2 px-3 bg-zinc-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm text-center cursor-pointer font-extrabold"
                              >
                                View on Map
                              </button>
                            ) : hasPending ? (
                              <button
                                disabled
                                className="flex-1 py-2 px-3 bg-zinc-200 text-zinc-400 text-[10px] font-black uppercase tracking-wider rounded-xl cursor-not-allowed text-center border border-zinc-300/30 font-extrabold"
                              >
                                Pending Request
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedHotspot(hotspot);
                                  requestJoin(hotspot.id);
                                  addToast(`Requested to join @${hotspot.host_username}'s gathering!`);
                                }}
                                className="flex-1 py-2 px-3 bg-zinc-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all active:scale-95 shadow-sm text-center cursor-pointer font-extrabold"
                              >
                                Request to Join
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )
              ) : (
                /* Requests tab content */
                <div className="space-y-4 pt-2">
                  {/* Incoming */}
                  <div>
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5" /> Incoming ({incomingRequests.length})
                    </h2>
                    {incomingRequests.length === 0 ? (
                      <p className="text-xs text-zinc-400 px-2 italic">No pending incoming requests</p>
                    ) : (
                      incomingRequests.map((req) => (
                        <motion.div
                          key={req.sender_id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-3 bg-zinc-50 border border-zinc-150 rounded-2xl flex items-center justify-between gap-3 mb-2"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-zinc-150 overflow-hidden flex-shrink-0 border border-zinc-200">
                              <img src={req.sender_avatar} alt="" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-sm font-bold text-zinc-800 truncate">@{req.sender_username}</span>
                          </div>
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => respondChatRequest(req.sender_id, "accepted")}
                              className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-all active:scale-95 shadow-sm cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={() => respondChatRequest(req.sender_id, "rejected")}
                              className="p-2 rounded-xl bg-zinc-200 text-zinc-600 hover:bg-zinc-300 transition-all active:scale-95 cursor-pointer border border-zinc-300/30"
                            >
                              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                            </button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Outgoing */}
                  <div className="pt-2 border-t border-zinc-100">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Outgoing ({outgoingRequests.length})
                    </h2>
                    {outgoingRequests.length === 0 ? (
                      <p className="text-xs text-zinc-400 px-2 italic">No pending outgoing requests</p>
                    ) : (
                      outgoingRequests.map((req) => {
                        const targetUser = activeUsers.find((u: any) => u.user_id === req.target_id);
                        const displayName = targetUser ? `@${targetUser.username}` : `User (${req.target_id.substring(0, 8)}...)`;
                        return (
                          <div
                            key={req.target_id}
                            className="p-3 bg-zinc-50/50 border border-zinc-150 rounded-2xl flex items-center justify-between"
                          >
                            <span className="text-xs font-bold text-zinc-500">Connection to {displayName} pending...</span>
                            <span className="text-[9px] bg-zinc-200 text-zinc-600 px-2.5 py-1 rounded-full font-bold">
                              Sent
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right pane: Active DM Chat window */}
        <div
          className={`flex-1 h-full flex flex-col bg-zinc-50 relative ${
            !activeChatUser ? "hidden md:flex" : "flex"
          }`}
        >
          {activeChatUser ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-zinc-150 flex items-center justify-between bg-white shadow-sm z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setActiveChatUser(null)}
                    className="p-2 -ml-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 active:scale-95 md:hidden transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 overflow-hidden border border-zinc-200">
                      <img src={activeChatUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-zinc-200 shadow-sm flex items-center justify-center">
                      <span className="text-[9px] font-extrabold">{activeChatUser.vibeEmoji}</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <h2 className="font-bold text-sm text-zinc-950 truncate leading-tight">
                      @{activeChatUser.username}
                    </h2>
                    <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1 font-bold">
                      <Clock className="w-2.5 h-2.5 text-zinc-300" /> 24h vanish mode
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleNavigateToFriend(activeChatUser)}
                    className="px-4.5 py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-xs flex items-center gap-1.5 hover:bg-black active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 fill-white text-white" />
                    <span>Directions</span>
                  </button>
                </div>
              </div>

              {/* Message History window */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col">
                
                {/* Ephemeral Warning Banner */}
                <div className="w-full py-3 px-4 rounded-2xl bg-white border border-zinc-200/60 flex items-center justify-center gap-2 text-center select-none mb-2 shadow-sm">
                  <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-zinc-500 leading-tight">
                    Chat history automatically vanishes 24 hours after transmission.
                  </span>
                </div>

                {isLoadingHistory ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-12 text-zinc-400 select-none">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mb-3" />
                    <p className="text-sm font-bold text-zinc-700">Loading chat history...</p>
                    <p className="text-xs opacity-85 mt-1">Fetching ephemeral messages</p>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 select-none py-12">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-40 text-zinc-300" />
                    <p className="text-sm font-bold text-zinc-700">Say hello to @{activeChatUser.username}!</p>
                    <p className="text-xs opacity-85 mt-1">Start typing below to connect instantly.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.sender_id === myUserId;
                    const date = new Date(msg.timestamp);
                    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[70%] ${
                          isMe ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        {/* Bubble */}
                        <div
                          className={`px-4.5 py-3 rounded-2xl text-sm font-medium leading-relaxed break-words shadow-sm ${
                            isMe
                              ? "bg-zinc-900 text-white rounded-tr-none"
                              : "bg-white border border-zinc-150/80 text-zinc-900 rounded-tl-none"
                          }`}
                        >
                          {msg.text}
                        </div>
                        {/* Time */}
                        <span className="text-[9px] text-zinc-400 font-extrabold mt-1.5 px-1 select-none">
                          {timeStr}
                        </span>
                      </div>
                    );
                  })
                )}

                {/* Peer Typing Indicator */}
                {peerTyping[activeChatUser.user_id] && (
                  <div className="self-start flex flex-col items-start max-w-[70%]">
                    <div className="px-4.5 py-3.5 bg-white border border-zinc-150 rounded-2xl rounded-tl-none flex items-center gap-1.5 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Composer */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-zinc-150 bg-white flex items-center gap-3"
              >
                <input
                  type="text"
                  value={typedMessage}
                  onChange={handleInputChange}
                  maxLength={200}
                  placeholder={`Message @${activeChatUser.username}...`}
                  className="flex-1 py-3.5 px-4.5 rounded-2xl bg-zinc-50 border border-zinc-200 text-zinc-900 text-sm placeholder-zinc-400 focus:outline-none focus:border-zinc-300 focus:bg-white transition-all font-medium"
                />
                
                <button
                  type="submit"
                  disabled={!typedMessage.trim()}
                  className="p-3.5 rounded-2xl bg-zinc-900 text-white font-bold disabled:opacity-40 disabled:scale-100 hover:bg-black hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-4 h-4 fill-white text-white" />
                </button>
              </form>
            </>
          ) : (
            // Desktop placeholder when no active conversation selected
            <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center text-zinc-400 select-none">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center border border-zinc-150 mb-4 shadow-sm">
                <MessageSquare className="w-8 h-8 text-zinc-300" />
              </div>
              <h3 className="text-base font-bold text-zinc-700 mb-1">Select a Conversation</h3>
              <p className="text-xs text-zinc-400 max-w-xs leading-normal">
                Choose a contact from the list or accept pending connection requests to start exchanging end-to-end 24-hour self-destructing messages.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
