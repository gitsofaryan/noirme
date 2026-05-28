"use client";

import { useState, useEffect, useRef } from "react";

interface UseSocketProps {
  userId: string;
  handle: string;
  vibeEmoji: string;
  avatarUrl: string;
  location: { lat: number; lng: number } | null;
  profile: any;
  localBlocks: string[];
  onSync: (data: any) => void;
  onLocationUpdate: (data: any) => void;
  onHotspotsList: (data: any) => void;
  onHotspotCreated: (data: any) => void;
  onJoinRequestReceived: (data: any) => void;
  onJoinResponse: (data: any) => void;
  onRoomSync: (data: any) => void;
  onNewMessage: (data: any) => void;
  onWaveReceived: (data: any) => void;
  onUserDisconnected: (data: any) => void;
}

export function useSocket({
  userId,
  handle,
  vibeEmoji,
  avatarUrl,
  location,
  profile,
  localBlocks,
  onSync,
  onLocationUpdate,
  onHotspotsList,
  onHotspotCreated,
  onJoinRequestReceived,
  onJoinResponse,
  onRoomSync,
  onNewMessage,
  onWaveReceived,
  onUserDisconnected,
}: UseSocketProps) {
  const [socketReady, setSocketReady] = useState(false);
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "disconnected" | "reconnecting"
  >("disconnected");
  const [offlineMessages, setOfflineMessagesState] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const offlineMessagesRef = useRef<any[]>([]);

  // Send a helper to set offline messages
  const setOfflineMessages = (msgs: any[]) => {
    offlineMessagesRef.current = msgs;
    setOfflineMessagesState(msgs);
  };

  // Connect and reconnect management
  useEffect(() => {
    if (!location) return;

    let mounted = true;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;

    const connect = () => {
      if (!mounted) return;

      setConnectionState(retryCount > 0 ? "reconnecting" : "connecting");

      let wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (!wsUrl) {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          wsUrl = `ws://localhost:3001`;
        } else {
          // Auto-map dev server port 3000 to socket server port 3001 when accessed on LAN IP
          const host = window.location.host;
          const portIndex = host.indexOf(":");
          if (portIndex !== -1) {
            const domain = host.substring(0, portIndex);
            wsUrl = `${proto}//${domain}:3001`;
          } else {
            wsUrl = `${proto}//${host}`;
          }
        }
      }

      console.log(`[noirme] Connecting to WebSocket: ${wsUrl} (Retry count: ${retryCount})`);
      ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        setSocketReady(true);
        setConnectionState("connected");
        retryCount = 0;

        const activeWs = ws;
        if (activeWs) {
          activeWs.send(JSON.stringify({ type: "request_sync" }));

          // Flush offline messages
          if (offlineMessagesRef.current.length > 0) {
            console.log(`[noirme] Offline outbox has ${offlineMessagesRef.current.length} messages. Flushing...`);
            offlineMessagesRef.current.forEach((item) => {
              activeWs.send(
                JSON.stringify({
                  type: "send_message",
                  roomId: item.roomId,
                  text: item.msg.text,
                  sender_id: item.msg.sender_id,
                  sender_username: item.msg.sender_username,
                  sender_avatar: item.msg.sender_avatar,
                })
              );
            });
            setOfflineMessages([]);
          }
        }
      };

      ws.onmessage = (ev) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(ev.data);

          switch (msg.type) {
            case "sync":
              onSync(msg);
              break;
            case "location_update":
              onLocationUpdate(msg);
              break;
            case "hotspots_list":
              onHotspotsList(msg);
              break;
            case "hotspot_created":
              onHotspotCreated(msg);
              break;
            case "join_request_received":
              onJoinRequestReceived(msg);
              break;
            case "join_response":
              onJoinResponse(msg);
              break;
            case "room_sync":
              onRoomSync(msg);
              break;
            case "new_message":
              onNewMessage(msg);
              break;
            case "wave_received":
              onWaveReceived(msg);
              break;
            case "user_disconnected":
              onUserDisconnected(msg);
              break;
            default:
              break;
          }
        } catch (e) {
          console.error("[noirme] Msg parse error:", e);
        }
      };

      ws.onerror = () => {
        console.warn(`[noirme] WebSocket connection error on URL: ${wsUrl}`);
      };

      ws.onclose = () => {
        if (!mounted) return;
        setSocketReady(false);
        setConnectionState("disconnected");
        socketRef.current = null;

        // Exponential backoff reconnect with jitter
        const delay = Math.min(10000, Math.pow(2, retryCount) * 1000) + (Math.random() - 0.5) * 1000;
        console.log(`[noirme] Socket closed. Reconnecting in ${Math.round(delay)}ms...`);
        retryCount++;
        retryTimer = setTimeout(connect, Math.max(1000, delay));
      };
    };

    connect();

    const handleUnload = () => {
      if (ws) ws.close();
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      mounted = false;
      window.removeEventListener("beforeunload", handleUnload);
      if (retryTimer) clearTimeout(retryTimer);
      if (ws) ws.close();
    };
  }, [!!location, userId]);

  // Periodic full sync to discover stationary users
  useEffect(() => {
    if (!socketReady) return;
    const interval = setInterval(() => {
      const ws = socketRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "request_sync" }));
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [socketReady]);

  // Location and profile sync
  useEffect(() => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !location) return;
    ws.send(
      JSON.stringify({
        type: "location_update",
        user_id: userId,
        username: handle,
        vibeEmoji: vibeEmoji,
        avatar_url: avatarUrl,
        lat: location.lat,
        lng: location.lng,
        bio: profile?.bio || "",
        selectedTags: profile?.selectedTags || [],
        gender: profile?.gender || "",
        age: profile?.age || "",
        blockedUsers: [...(profile?.blockedUsers || []), ...localBlocks],
        radarRange: profile?.radarRange || 15,
        hotspotRange: profile?.hotspotRange || 15,
      })
    );
  }, [
    location?.lat,
    location?.lng,
    socketReady,
    handle,
    vibeEmoji,
    avatarUrl,
    profile?.bio,
    profile?.selectedTags,
    profile?.gender,
    profile?.age,
    profile?.blockedUsers,
    localBlocks,
  ]);

  // Helper send methods
  const send = (data: any) => {
    const ws = socketRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  };

  const requestSync = () => {
    return send({ type: "request_sync" });
  };

  const sendWave = (targetUserId: string) => {
    return send({
      type: "send_wave",
      target_user_id: targetUserId,
      sender_id: userId,
      sender_username: handle,
    });
  };

  const createHotspot = (title: string, customRange: number) => {
    if (!location) return false;
    return send({
      type: "create_hotspot",
      user_id: userId,
      username: handle,
      avatar_url: avatarUrl,
      vibeEmoji: vibeEmoji,
      title: title.trim(),
      lat: location.lat,
      lng: location.lng,
      host_bio: profile?.bio || "",
      host_tags: profile?.selectedTags || [],
      host_gender: profile?.gender || "",
      host_age: profile?.age || undefined,
      hotspotRange: customRange,
    });
  };

  const requestJoin = (roomId: string) => {
    return send({
      type: "request_join",
      roomId,
      user_id: userId,
      username: handle,
      avatar_url: avatarUrl,
    });
  };

  const respondRequest = (roomId: string, guestId: string, status: "accepted" | "declined") => {
    return send({
      type: "respond_join",
      roomId,
      guestId,
      status,
    });
  };

  const leaveHotspot = (roomId: string) => {
    return send({
      type: "leave_hotspot",
      roomId,
      user_id: userId,
    });
  };

  const sendMessage = (roomId: string, text: string, onOptimisticAdd?: (msg: any) => void) => {
    // Client-side XSS tag escaping
    const sanitizedText = text
      .trim()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const ws = socketRef.current;
    const isSocketConnected = ws && ws.readyState === WebSocket.OPEN;

    if (!isSocketConnected) {
      // Local optimistic message object
      const offlineMsg = {
        id: `msg_offline_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sender_id: userId,
        sender_username: handle,
        sender_avatar: avatarUrl,
        text: sanitizedText,
        timestamp: Date.now(),
        isOffline: true,
      };

      // Buffer inside Ref queue and update React state
      const queueItem = { roomId, msg: offlineMsg };
      const newOffline = [...offlineMessagesRef.current, queueItem];
      setOfflineMessages(newOffline);

      if (onOptimisticAdd) {
        onOptimisticAdd(offlineMsg);
      }
      return false;
    }

    ws.send(
      JSON.stringify({
        type: "send_message",
        roomId,
        text: sanitizedText,
        sender_id: userId,
        sender_username: handle,
        sender_avatar: avatarUrl,
      })
    );
    return true;
  };

  return {
    socketReady,
    connectionState,
    offlineMessages,
    requestSync,
    sendWave,
    createHotspot,
    requestJoin,
    respondRequest,
    leaveHotspot,
    sendMessage,
  };
}
