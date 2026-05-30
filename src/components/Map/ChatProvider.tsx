"use client";

import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { globalEventBus } from "@/lib/eventBus";

export interface DirectMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string;
  recipient_id: string;
  text: string;
  timestamp: number;
}

export interface SocialContextType {
  chatRequests: any[];
  friends: any[];
  sendChatRequest: (targetUserId: string) => void;
  respondChatRequest: (senderId: string, status: "accepted" | "rejected") => void;
}

export interface DMContextType {
  chatMessages: DirectMessage[];
  peerTyping: Record<string, boolean>;
  activeChatUser: any | null;
  setActiveChatUser: (u: any | null) => void;
  sendDirectMessage: (text: string) => void;
  sendTypingState: (isTyping: boolean) => void;
  requestDMHistory: (targetUserId: string) => void;
  isLoadingHistory: boolean;
  unreadMessagesCount: number;
  clearChatHistory: (targetUserId: string) => void;
}

export const SocialContext = createContext<SocialContextType | undefined>(undefined);
export const DMContext = createContext<DMContextType | undefined>(undefined);

export function ChatProvider({ 
  children, 
  socket,
  myUserId,
  handle,
  myAvatarUrl,
  addToast,
  setNotifications,
  activeUsers,
  isSignedIn
}: { 
  children: React.ReactNode;
  socket: any;
  myUserId: string;
  handle: string;
  myAvatarUrl: string;
  addToast: (msg: string, type?: "default"|"wave"|"request") => void;
  setNotifications: React.Dispatch<React.SetStateAction<any[]>>;
  activeUsers: any[];
  isSignedIn: boolean;
}) {
  const [chatRequests, setChatRequests] = useState<any[]>([]);
  const [activeChatUser, _setActiveChatUser] = useState<any | null>(null);
  const activeChatUserRef = useRef<any | null>(null);
  const setActiveChatUser = (val: any) => {
    activeChatUserRef.current = val;
    _setActiveChatUser(val);
  };
  const [chatMessages, setChatMessages] = useState<DirectMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState<Record<string, boolean>>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Unread messages tracking (debounced localStorage save)
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        return JSON.parse(localStorage.getItem("norby_unread_messages") || "{}");
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const unreadSaveTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (unreadSaveTimeoutRef.current) clearTimeout(unreadSaveTimeoutRef.current);
    unreadSaveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem("norby_unread_messages", JSON.stringify(unreadMessages));
      } catch (e) {}
    }, 500);
    return () => clearTimeout(unreadSaveTimeoutRef.current);
  }, [unreadMessages]);

  const unreadMessagesCount = useMemo(() => {
    return Object.values(unreadMessages).reduce((a, b) => a + b, 0);
  }, [unreadMessages]);

  useEffect(() => {
    if (activeChatUser) {
      setUnreadMessages((prev) => {
        if (!prev[activeChatUser.user_id]) return prev;
        const copy = { ...prev };
        delete copy[activeChatUser.user_id];
        return copy;
      });
    }
  }, [activeChatUser]);

  // Load / Save friends to Puter KV
  const friendsSaveTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (!isSignedIn || !myUserId || myUserId === "anon" || myUserId.startsWith("anon_")) return;
    if (typeof window !== "undefined" && (window as any).puter) {
      if (friendsSaveTimeoutRef.current) clearTimeout(friendsSaveTimeoutRef.current);
      friendsSaveTimeoutRef.current = setTimeout(() => {
        const acceptedIds = chatRequests
          .filter((r) => r.status === "accepted")
          .map((r) => (r.sender_id === myUserId ? r.target_id : r.sender_id));

        if (acceptedIds.length > 0) {
          (window as any).puter.kv.set(`friends_list_${myUserId}`, JSON.stringify(acceptedIds)).catch(() => {});
        }
      }, 1000);
    }
    return () => clearTimeout(friendsSaveTimeoutRef.current);
  }, [chatRequests, myUserId, isSignedIn]);

  const friendsLoadedRef = useRef(false);
  useEffect(() => {
    if (friendsLoadedRef.current || !isSignedIn || !myUserId || myUserId === "anon" || myUserId.startsWith("anon_")) return;
    if (typeof window !== "undefined" && (window as any).puter) {
      friendsLoadedRef.current = true;
      (window as any).puter.kv.get(`friends_list_${myUserId}`)
        .then((raw: any) => {
          if (!raw) return;
          try {
            const friendIds = JSON.parse(raw);
            if (Array.isArray(friendIds) && friendIds.length > 0) {
              setChatRequests((prev) => {
                const existingIds = new Set(prev.map(r => r.sender_id === myUserId ? r.target_id : r.sender_id));
                const newPlaceholders = friendIds
                  .filter((id: string) => !existingIds.has(id))
                  .map((id: string) => ({
                    sender_id: myUserId,
                    sender_username: handle || myUserId,
                    sender_avatar: myAvatarUrl,
                    target_id: id,
                    status: "accepted",
                    timestamp: Date.now()
                  }));
                return newPlaceholders.length > 0 ? [...prev, ...newPlaceholders] : prev;
              });
            }
          } catch (e) {}
        }).catch(() => {});
    }
  }, [myUserId, handle, myAvatarUrl, isSignedIn]);

  // Load DM history from localStorage only (device-local, no server)
  useEffect(() => {
    if (!activeChatUser || !myUserId || myUserId === "anon") {
      setChatMessages([]);
      setIsLoadingHistory(false);
      return;
    }

    const targetUserId = activeChatUser.user_id;
    const convoId = [myUserId, targetUserId].sort().join(":");

    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`chat_msgs_${convoId}`);
        if (stored) {
          const msgs = JSON.parse(stored);
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          const validMsgs = msgs.map((m: any) => ({
            ...m,
            text: typeof m.text === 'string' ? m.text : (typeof m.text === 'object' ? JSON.stringify(m.text) : String(m.text))
          })).filter((m: any) => m.timestamp > oneHourAgo);
          setChatMessages(validMsgs);
          localStorage.setItem(`chat_msgs_${convoId}`, JSON.stringify(validMsgs));
        } else {
          setChatMessages([]);
        }
      } catch (e) {
        setChatMessages([]);
      }
    }
    setIsLoadingHistory(false);
  }, [activeChatUser?.user_id, myUserId]);

  const friends = useMemo(() => {
    const beeBot = {
      user_id: "bee_ai_bot",
      username: "bee",
      avatar_url: "https://api.dicebear.com/7.x/bottts/svg?seed=bee&backgroundColor=fde047",
      vibeEmoji: "🐝",
      bio: "I'm Bee, the witty AI buzzing around Norby! Always here to share local tea, suggest cool spots, and keep the vibes immaculate.",
      selectedTags: ["ai", "guide", "smart", "friendly", "chatty", "fun"],
      gender: "bot",
      age: "Ageless",
      status: "active"
    };

    const friendIds = chatRequests
      .filter((r) => r.status === "accepted")
      .map((r) => (r.sender_id === myUserId ? r.target_id : r.sender_id));

    const activeFriends = activeUsers.filter((u) => friendIds.includes(u.user_id));
    const offlineFriendIds = friendIds.filter(id => !activeUsers.some(u => u.user_id === id));
    
    const offlineFriends = offlineFriendIds.map(id => {
      const requestData = chatRequests.find(r => r.status === "accepted" && (r.sender_id === id || r.target_id === id));
      return {
        user_id: id,
        username: requestData?.sender_id === id ? requestData.sender_username : (requestData?.target_username || "Unknown"),
        avatar_url: requestData?.sender_id === id ? requestData.sender_avatar : (requestData?.target_avatar || ""),
        vibeEmoji: "😴",
        bio: "Offline",
        status: "away",
      };
    });

    return [beeBot, ...activeFriends, ...offlineFriends];
  }, [chatRequests, activeUsers, myUserId]);

  // Event bus listeners for socket events
  useEffect(() => {
    const unsubNewDM = globalEventBus.on("chat:new_dm", (msg) => {
      if (activeChatUserRef.current && (msg.message.sender_id === activeChatUserRef.current.user_id || msg.message.recipient_id === activeChatUserRef.current.user_id)) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === msg.message.id)) return prev;
          let filtered = prev;
          if (msg.message.sender_id === myUserId) {
            filtered = prev.filter((m) => !m.id.startsWith("local_") || m.text !== msg.message.text);
          }
          const newMsgs = [...filtered, msg.message];
          const convoId = [myUserId, activeChatUserRef.current.user_id].sort().join(":");
          if (typeof window !== "undefined") {
            try {
              const oneHourAgo = Date.now() - 60 * 60 * 1000;
              const filteredStorage = newMsgs.filter((m) => m.timestamp > oneHourAgo);
              localStorage.setItem(`chat_msgs_${convoId}`, JSON.stringify(filteredStorage));
            } catch (e) {}
          }
          return newMsgs;
        });
      } else {
        const textStr = typeof msg.message.text === 'string' ? msg.message.text : (typeof msg.message.text === 'object' ? JSON.stringify(msg.message.text) : String(msg.message.text));
        if (msg.message.sender_id !== myUserId && activeChatUserRef.current?.user_id !== msg.message.sender_id) {
          addToast(`✉️ New message from @${msg.message.sender_username}: "${textStr.substring(0, 20)}${textStr.length > 20 ? "..." : ""}"`, "default");
          setUnreadMessages((prev) => ({
            ...prev,
            [msg.message.sender_id]: (prev[msg.message.sender_id] || 0) + 1,
          }));
        }
        if (typeof window !== "undefined") {
          try {
            const otherUserId = msg.message.sender_id === myUserId ? msg.message.recipient_id : msg.message.sender_id;
            const convoId = [myUserId, otherUserId].sort().join(":");
            let list: any[] = [];
            const stored = localStorage.getItem(`chat_msgs_${convoId}`);
            if (stored) {
              list = JSON.parse(stored);
            }
            if (!list.some((m: any) => m.id === msg.message.id)) {
              const safeMsg = { ...msg.message, text: typeof msg.message.text === 'string' ? msg.message.text : (typeof msg.message.text === 'object' ? JSON.stringify(msg.message.text) : String(msg.message.text)) };
              list.push(safeMsg);
              const oneHourAgo = Date.now() - 60 * 60 * 1000;
              const filtered = list.filter((m: any) => m.timestamp > oneHourAgo);
              localStorage.setItem(`chat_msgs_${convoId}`, JSON.stringify(filtered));
            }
          } catch (e) {}
        }
      }
    });

    const unsubTyping = globalEventBus.on("chat:typing_indicator", (msg) => {
      setPeerTyping((prev) => ({
        ...prev,
        [msg.sender_id]: msg.is_typing,
      }));
    });

    const unsubChatsList = globalEventBus.on("chat:chats_list", (msg) => {
      setChatRequests(msg.requests || []);
    });

    const unsubChatReq = globalEventBus.on("chat:chat_request", (msg) => {
      addToast(`💬 Chat request from @${msg.request.sender_username}!`, "request");
      setNotifications((prev: any) => [
        {
          id: Math.random().toString(36).substring(7),
          text: `@${msg.request.sender_username} wants to connect with you`,
          time: Date.now(),
          read: false,
        },
        ...prev,
      ].slice(0, 5));
      setChatRequests((prev) => {
        const filtered = prev.filter((r) => r.sender_id !== msg.request.sender_id || r.target_id !== msg.request.target_id);
        return [...filtered, msg.request];
      });
    });

    const unsubChatRes = globalEventBus.on("chat:chat_respond", (msg) => {
      const isAccepted = msg.request.status === "accepted";
      const otherUser = msg.request.sender_id === myUserId ? msg.request.target_id : msg.request.sender_id;
      const otherInfo = activeUsers.find((u: any) => u.user_id === otherUser);
      const otherHandle = otherInfo?.username || "Someone";

      if (isAccepted) {
        addToast(`✅ Connected with @${otherHandle}! You can now chat.`, "default");
      } else {
        addToast(`❌ Chat request to @${otherHandle} was declined.`, "default");
      }

      setChatRequests((prev) => {
        const filtered = prev.filter((r) => r.sender_id !== msg.request.sender_id || r.target_id !== msg.request.target_id);
        return [...filtered, msg.request];
      });
    });

    return () => {
      unsubNewDM();
      unsubTyping();
      unsubChatsList();
      unsubChatReq();
      unsubChatRes();
    };
  }, [myUserId, activeUsers, addToast, setNotifications]);

  const clearChatHistory = useCallback((targetUserId: string) => {
    const convoId = [myUserId, targetUserId].sort().join(":");
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`chat_msgs_${convoId}`);
      } catch (e) {}
    }
    if (activeChatUserRef.current?.user_id === targetUserId) {
      setChatMessages([]);
    }
  }, [myUserId]);

  const sendChatRequest = useCallback((targetUserId: string) => {
    setChatRequests((prev) => {
      if (prev.some((r) => r.target_id === targetUserId && r.status === "pending")) return prev;
      return [...prev, {
        sender_id: myUserId,
        target_id: targetUserId,
        status: "pending",
        timestamp: Date.now()
      }];
    });
    if (socket?.sendChatRequest) socket.sendChatRequest(targetUserId);
  }, [socket, myUserId]);

  const respondChatRequest = useCallback((senderId: string, status: "accepted" | "rejected") => {
    setChatRequests((prev) => prev.map((r) => {
      if (r.sender_id === senderId && r.target_id === myUserId) {
        return { ...r, status };
      }
      return r;
    }));
    if (socket?.respondChatRequest) socket.respondChatRequest(senderId, status);
  }, [socket, myUserId]);

  const sendDirectMessage = useCallback((text: string) => {
    const chatUser = activeChatUserRef.current;
    if (!chatUser || !socket) return;

    const msg: DirectMessage = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sender_id: myUserId,
      sender_username: handle,
      sender_avatar: myAvatarUrl,
      recipient_id: chatUser.user_id,
      text,
      timestamp: Date.now(),
    };

    setChatMessages((prev) => {
      const next = [...prev, msg];
      const convoId = [myUserId, chatUser.user_id].sort().join(":");
      if (typeof window !== "undefined") {
        try {
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          const filtered = next.filter((m) => m.timestamp > oneHourAgo);
          localStorage.setItem(`chat_msgs_${convoId}`, JSON.stringify(filtered));
        } catch (e) {}
      }
      return next;
    });

    if (chatUser.user_id !== "bee_ai_bot") {
      socket.sendDirectMessage(chatUser.user_id, text);
    }
    
    if (chatUser.user_id === "bee_ai_bot") {
      setPeerTyping((prev) => ({ ...prev, bee_ai_bot: true }));
      const prompt = `You are Bee, an AI assistant for the 'Norby' app (a location-based map chatting app where users connect through ephemeral messages and hotspots). 
Adopt a very human, casual, and friendly tone. Do NOT be overly professional or robotic.
Use Markdown to format your text. DO NOT use hyphens (-) anywhere in your response.
CRITICAL: If you want to send multiple separate messages (like a text message chain), separate each message with '|||'.
DO NOT send an image with every message. Analyze the conversation context first. IF and ONLY IF it makes sense to share an image, you may generate one using this markdown format: ![image](https://loremflickr.com/400/300/<keyword>) or ![avatar](https://api.dicebear.com/7.x/bottts/svg?seed=<keyword>) (replace <keyword> with a relevant single word).
Also occasionally include quirky phrases like "Someone is norbying you 👀" or "someone looking tea ☕".
The user says: ${text}`;
      
      if (typeof window !== "undefined" && (window as any).puter) {
        (window as any).puter.ai.chat(prompt, { model: 'gpt-5.4-nano' })
          .then((response: any) => {
            const getReplyText = (res: any) => {
              if (typeof res === 'string') return res;
              if (typeof res?.message === 'string') return res.message;
              if (typeof res?.text === 'string') return res.text;
              if (res?.message?.content) {
                if (typeof res.message.content === 'string') return res.message.content;
                if (Array.isArray(res.message.content)) return res.message.content[0]?.text || "Bzz...";
              }
              return "Bzz... I couldn't compute that!";
            };
            const replyText = getReplyText(response);
            const messages = replyText.split('|||').map((m: string) => m.trim()).filter(Boolean);
            
            messages.forEach((msgTxt: string, index: number) => {
              setTimeout(() => {
                const aiMsg: DirectMessage = {
                  id: `bee_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  sender_id: "bee_ai_bot",
                  sender_username: "bee",
                  sender_avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=bee&backgroundColor=fde047",
                  recipient_id: myUserId,
                  text: msgTxt,
                  timestamp: Date.now(),
                };
                
                setChatMessages((prevMsgs) => {
                  const nextMsgs = [...prevMsgs, aiMsg];
                  const convo = [myUserId, "bee_ai_bot"].sort().join(":");
                  try {
                    const oneHourAgo = Date.now() - 60 * 60 * 1000;
                    localStorage.setItem(`chat_msgs_${convo}`, JSON.stringify(nextMsgs.filter((m) => m.timestamp > oneHourAgo)));
                  } catch (e) {}
                  return nextMsgs;
                });
                
                if (index === messages.length - 1) {
                  setPeerTyping((prev) => ({ ...prev, bee_ai_bot: false }));
                }
              }, index * 1500); 
            });
          })
          .catch(() => {
            setPeerTyping((prev) => ({ ...prev, bee_ai_bot: false }));
          });
      } else {
        setTimeout(() => {
          setPeerTyping((prev) => ({ ...prev, bee_ai_bot: false }));
        }, 1000);
      }
    }
  }, [myUserId, handle, myAvatarUrl, socket]);

  const sendTypingState = useCallback((isTyping: boolean) => {
    if (activeChatUserRef.current && socket?.sendTypingState && activeChatUserRef.current.user_id !== "bee_ai_bot") {
      socket.sendTypingState(activeChatUserRef.current.user_id, isTyping);
    }
  }, [socket]);

  const requestDMHistory = useCallback((targetUserId: string) => {
    if (targetUserId === "bee_ai_bot") return;
    if (socket?.requestDMHistory) {
      setIsLoadingHistory(true);
      socket.requestDMHistory(targetUserId);
    }
  }, [socket]);

  const socialValue = useMemo(() => ({
    chatRequests,
    friends,
    sendChatRequest,
    respondChatRequest,
  }), [chatRequests, friends, sendChatRequest, respondChatRequest]);

  const dmValue = useMemo(() => ({
    chatMessages,
    peerTyping,
    activeChatUser,
    setActiveChatUser,
    sendDirectMessage,
    sendTypingState,
    requestDMHistory,
    isLoadingHistory,
    unreadMessagesCount,
    clearChatHistory,
  }), [chatMessages, peerTyping, activeChatUser, sendDirectMessage, sendTypingState, requestDMHistory, isLoadingHistory, unreadMessagesCount, clearChatHistory]);

  return (
    <SocialContext.Provider value={socialValue}>
      <DMContext.Provider value={dmValue}>
        {children}
      </DMContext.Provider>
    </SocialContext.Provider>
  );
}

export function useSocialContext() {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error("useSocialContext must be used within a ChatProvider");
  }
  return context;
}

export function useDMContext() {
  const context = useContext(DMContext);
  if (!context) {
    throw new Error("useDMContext must be used within a ChatProvider");
  }
  return context;
}
