import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const REDIS_URL = process.env.REDIS_URL;

interface ClientInfo {
  user_id: string;
  username: string;
  avatar_url: string;
  vibeEmoji: string;
  lat: number;
  lng: number;
  last_seen: number;
}

interface Message {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string;
  text: string;
  timestamp: number;
}

interface JoinRequest {
  user_id: string;
  username: string;
  avatar_url: string;
  status: "pending" | "accepted" | "declined";
}

interface Hotspot {
  id: string;
  host_id: string;
  host_username: string;
  host_avatar: string;
  title: string;
  vibeEmoji: string;
  lat: number;
  lng: number;
  created_at: number;
  expires_at: number;
  requests: JoinRequest[];
  messages: Message[];
}

// ── In-Memory Fallback State (used if Redis is inactive/not configured) ──────
const clientsLocal = new Map<WebSocket, ClientInfo>();
const hotspotsLocal = new Map<string, Hotspot>();

// ── Redis Clients ────────────────────────────────────────────────────────────
let redisPub: ReturnType<typeof createClient> | null = null;
let redisSub: ReturnType<typeof createClient> | null = null;
let useRedis = false;

// ── Clean Expired Hotspots Loop ──────────────────────────────────────────────
setInterval(async () => {
  const now = Date.now();
  if (useRedis && redisPub) {
    try {
      const allHotspots = await redisPub.hGetAll("noirme:hotspots");
      let changed = false;
      for (const [id, raw] of Object.entries(allHotspots)) {
        const hotspot: Hotspot = JSON.parse(raw);
        if (hotspot.expires_at < now) {
          await redisPub.hDel("noirme:hotspots", id);
          console.log(`[noirme] Redis hotspot expired and deleted: ${id}`);
          changed = true;
        }
      }
      if (changed) {
        publishHotspotUpdate();
      }
    } catch (e) {
      console.error("[noirme] Redis cleanup error:", e);
    }
  } else {
    // In-memory fallback cleanup
    let changed = false;
    for (const [id, hotspot] of hotspotsLocal.entries()) {
      if (hotspot.expires_at < now) {
        hotspotsLocal.delete(id);
        changed = true;
        console.log(`[noirme] Local hotspot expired and deleted: ${id}`);
      }
    }
    if (changed) {
      broadcastLocal({
        type: "hotspots_list",
        hotspots: Array.from(hotspotsLocal.values()),
      });
    }
  }
}, 60 * 1000);

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Noirme WebSocket server is running.");
});

const wss = new WebSocketServer({ server });

// ── Local Broadcast ──────────────────────────────────────────────────────────
function broadcastLocal(msg: object) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ── Find Local Socket by User ID ─────────────────────────────────────────────
function findLocalSocketByUserId(userId: string): WebSocket | null {
  for (const [ws, info] of clientsLocal.entries()) {
    if (info.user_id === userId && ws.readyState === WebSocket.OPEN) {
      return ws;
    }
  }
  return null;
}

// ── Redis Communication Helpers ──────────────────────────────────────────────
async function publishHotspotUpdate() {
  if (redisPub) {
    try {
      const all = await redisPub.hGetAll("noirme:hotspots");
      const list = Object.values(all).map((h) => JSON.parse(h));
      await redisPub.publish(
        "noirme:hotspots_updates",
        JSON.stringify({
          type: "hotspots_list",
          hotspots: list,
        })
      );
    } catch (e) {
      console.error("[noirme] Redis publish hotspots error:", e);
    }
  }
}

// ── Connection Handler ───────────────────────────────────────────────────────
wss.on("connection", async (ws: any) => {
  console.log("[noirme] Client connected");
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  // Initial Sync: Send current snapshot
  if (useRedis && redisPub) {
    try {
      // 1. Fetch active users
      const rawUsers = await redisPub.hGetAll("noirme:active_users");
      const activeUsers = Object.values(rawUsers).map((u) => JSON.parse(u));

      // 2. Fetch active hotspots
      const rawHotspots = await redisPub.hGetAll("noirme:hotspots");
      const activeHotspots = Object.values(rawHotspots).map((h) => JSON.parse(h));

      ws.send(
        JSON.stringify({
          type: "sync",
          users: activeUsers,
          hotspots: activeHotspots,
        })
      );
    } catch (e) {
      console.error("[noirme] Redis initial sync failed:", e);
    }
  } else {
    // In-memory fallback sync
    const activeUsers = Array.from(clientsLocal.values()).filter((u) => u.lat && u.lng);
    const activeHotspots = Array.from(hotspotsLocal.values()).filter(
      (h) => h.expires_at > Date.now()
    );
    ws.send(
      JSON.stringify({
        type: "sync",
        users: activeUsers,
        hotspots: activeHotspots,
      })
    );
  }

  ws.on("message", async (raw: any) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "request_sync") {
        if (useRedis && redisPub) {
          try {
            const rawUsers = await redisPub.hGetAll("noirme:active_users");
            const activeUsers = Object.values(rawUsers).map((u) => JSON.parse(u));
            const rawHotspots = await redisPub.hGetAll("noirme:hotspots");
            const activeHotspots = Object.values(rawHotspots).map((h) => JSON.parse(h));
            ws.send(
              JSON.stringify({
                type: "sync",
                users: activeUsers,
                hotspots: activeHotspots,
              })
            );
          } catch (e) {
            console.error("[noirme] Redis sync request failed:", e);
          }
        } else {
          const activeUsers = Array.from(clientsLocal.values()).filter((u) => u.lat && u.lng);
          const activeHotspots = Array.from(hotspotsLocal.values()).filter(
            (h) => h.expires_at > Date.now()
          );
          ws.send(
            JSON.stringify({
              type: "sync",
              users: activeUsers,
              hotspots: activeHotspots,
            })
          );
        }
        return;
      }

      if (data.type === "location_update") {
        const info: ClientInfo = {
          user_id: data.user_id,
          username: data.username,
          avatar_url: data.avatar_url || "",
          vibeEmoji: data.vibeEmoji || "☕",
          lat: data.lat,
          lng: data.lng,
          last_seen: Date.now(),
        };

        // Cache locally for connection management
        clientsLocal.set(ws, info);

        if (useRedis && redisPub) {
          // Store globally in Redis and publish update
          await redisPub.hSet("noirme:active_users", info.user_id, JSON.stringify(info));
          await redisPub.publish(
            "noirme:location_updates",
            JSON.stringify({
              type: "location_update",
              data: info,
            })
          );
        } else {
          // Local fallback
          broadcastLocal({
            type: "location_update",
            data: info,
          });
        }
      } else if (data.type === "create_hotspot") {
        const roomId = `room_${Math.random().toString(36).substring(2, 8)}`;
        const hostId = data.user_id;

        const newHotspot: Hotspot = {
          id: roomId,
          host_id: hostId,
          host_username: data.username,
          host_avatar: data.avatar_url || "",
          title: data.title,
          vibeEmoji: data.vibeEmoji || "☕",
          lat: data.lat,
          lng: data.lng,
          created_at: Date.now(),
          expires_at: Date.now() + 60 * 60 * 1000,
          requests: [
            {
              user_id: hostId,
              username: data.username,
              avatar_url: data.avatar_url || "",
              status: "accepted",
            },
          ],
          messages: [],
        };

        if (useRedis && redisPub) {
          await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(newHotspot));
          await publishHotspotUpdate();

          // Direct reply to host
          ws.send(
            JSON.stringify({
              type: "hotspot_created",
              roomId,
              hotspot: newHotspot,
            })
          );
        } else {
          hotspotsLocal.set(roomId, newHotspot);
          broadcastLocal({
            type: "hotspots_list",
            hotspots: Array.from(hotspotsLocal.values()),
          });
          ws.send(
            JSON.stringify({
              type: "hotspot_created",
              roomId,
              hotspot: newHotspot,
            })
          );
        }
      } else if (data.type === "request_join") {
        const { roomId, user_id, username, avatar_url } = data;

        if (useRedis && redisPub) {
          const rawHotspot = await redisPub.hGet("noirme:hotspots", roomId);
          if (!rawHotspot) return;
          const hotspot: Hotspot = JSON.parse(rawHotspot);

          let request = hotspot.requests.find((r) => r.user_id === user_id);
          if (request) {
            request.status = "pending";
          } else {
            request = { user_id, username, avatar_url: avatar_url || "", status: "pending" };
            hotspot.requests.push(request);
          }

          await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(hotspot));
          await publishHotspotUpdate();

          // Notify Host globally
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id: hotspot.host_id,
              payload: {
                type: "join_request_received",
                roomId,
                request,
                hotspot,
              },
            })
          );

          // Direct reply to guest
          ws.send(JSON.stringify({ type: "request_status", roomId, status: "pending" }));
        } else {
          const hotspot = hotspotsLocal.get(roomId);
          if (!hotspot) return;

          let request = hotspot.requests.find((r) => r.user_id === user_id);
          if (request) {
            request.status = "pending";
          } else {
            request = { user_id, username, avatar_url: avatar_url || "", status: "pending" };
            hotspot.requests.push(request);
          }

          broadcastLocal({
            type: "hotspots_list",
            hotspots: Array.from(hotspotsLocal.values()),
          });

          const hostSocket = findLocalSocketByUserId(hotspot.host_id);
          if (hostSocket) {
            hostSocket.send(
              JSON.stringify({ type: "join_request_received", roomId, request, hotspot })
            );
          }
          ws.send(JSON.stringify({ type: "request_status", roomId, status: "pending" }));
        }
      } else if (data.type === "respond_join") {
        const { roomId, guestId, status } = data;

        if (useRedis && redisPub) {
          const rawHotspot = await redisPub.hGet("noirme:hotspots", roomId);
          if (!rawHotspot) return;
          const hotspot: Hotspot = JSON.parse(rawHotspot);

          const request = hotspot.requests.find((r) => r.user_id === guestId);
          if (request) {
            request.status = status;
            await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(hotspot));
            await publishHotspotUpdate();

            // Direct notify Guest globally
            await redisPub.publish(
              "noirme:direct_notifications",
              JSON.stringify({
                target_user_id: guestId,
                payload: {
                  type: "join_response",
                  roomId,
                  status,
                  hotspot,
                },
              })
            );

            // Sync room messages to Guest globally if approved
            if (status === "accepted") {
              await redisPub.publish(
                "noirme:direct_notifications",
                JSON.stringify({
                  target_user_id: guestId,
                  payload: {
                    type: "room_sync",
                    roomId,
                    hotspot,
                  },
                })
              );
            }

            // Sync room messages back to Host
            ws.send(JSON.stringify({ type: "room_sync", roomId, hotspot }));
          }
        } else {
          const hotspot = hotspotsLocal.get(roomId);
          if (!hotspot) return;

          const request = hotspot.requests.find((r) => r.user_id === guestId);
          if (request) {
            request.status = status;
            broadcastLocal({
              type: "hotspots_list",
              hotspots: Array.from(hotspotsLocal.values()),
            });

            const guestSocket = findLocalSocketByUserId(guestId);
            if (guestSocket) {
              guestSocket.send(JSON.stringify({ type: "join_response", roomId, status, hotspot }));
              if (status === "accepted") {
                guestSocket.send(JSON.stringify({ type: "room_sync", roomId, hotspot }));
              }
            }
            ws.send(JSON.stringify({ type: "room_sync", roomId, hotspot }));
          }
        }
      } else if (data.type === "send_message") {
        const { roomId, text, sender_id, sender_username, sender_avatar } = data;

        if (useRedis && redisPub) {
          const rawHotspot = await redisPub.hGet("noirme:hotspots", roomId);
          if (!rawHotspot) return;
          const hotspot: Hotspot = JSON.parse(rawHotspot);

          const member = hotspot.requests.find(
            (r) => r.user_id === sender_id && r.status === "accepted"
          );
          const isHost = hotspot.host_id === sender_id;

          if (member || isHost) {
            const newMessage: Message = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sender_id,
              sender_username,
              sender_avatar: sender_avatar || "",
              text,
              timestamp: Date.now(),
            };

            hotspot.messages.push(newMessage);
            await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(hotspot));

            // Publish message globally to all instances
            await redisPub.publish(
              "noirme:chat_messages",
              JSON.stringify({
                roomId,
                message: newMessage,
                members: hotspot.requests.filter((r) => r.status === "accepted").map((r) => r.user_id),
                host_id: hotspot.host_id,
              })
            );
          }
        } else {
          const hotspot = hotspotsLocal.get(roomId);
          if (!hotspot) return;

          const member = hotspot.requests.find(
            (r) => r.user_id === sender_id && r.status === "accepted"
          );
          const isHost = hotspot.host_id === sender_id;

          if (member || isHost) {
            const newMessage: Message = {
              id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              sender_id,
              sender_username,
              sender_avatar: sender_avatar || "",
              text,
              timestamp: Date.now(),
            };

            hotspot.messages.push(newMessage);

            // Relay message to local accepted members and host
            const recipientIds = hotspot.requests
              .filter((r) => r.status === "accepted")
              .map((r) => r.user_id);
            if (!recipientIds.includes(hotspot.host_id)) {
              recipientIds.push(hotspot.host_id);
            }

            recipientIds.forEach((uid) => {
              const clientSocket = findLocalSocketByUserId(uid);
              if (clientSocket) {
                clientSocket.send(
                  JSON.stringify({
                    type: "new_message",
                    roomId,
                    message: newMessage,
                  })
                );
              }
            });
          }
        }
      } else if (data.type === "leave_hotspot") {
        const { roomId, user_id } = data;

        if (useRedis && redisPub) {
          const rawHotspot = await redisPub.hGet("noirme:hotspots", roomId);
          if (!rawHotspot) return;
          const hotspot: Hotspot = JSON.parse(rawHotspot);

          if (hotspot.host_id === user_id) {
            await redisPub.hDel("noirme:hotspots", roomId);
            await publishHotspotUpdate();
          } else {
            hotspot.requests = hotspot.requests.filter((r) => r.user_id !== user_id);
            await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(hotspot));
            await publishHotspotUpdate();

            // Sync updated room roster globally
            await redisPub.publish(
              "noirme:chat_messages",
              JSON.stringify({
                roomId,
                rosterUpdateOnly: true,
                hotspot,
              })
            );
          }
        } else {
          const hotspot = hotspotsLocal.get(roomId);
          if (!hotspot) return;

          if (hotspot.host_id === user_id) {
            hotspotsLocal.delete(roomId);
            broadcastLocal({
              type: "hotspots_list",
              hotspots: Array.from(hotspotsLocal.values()),
            });
          } else {
            hotspot.requests = hotspot.requests.filter((r) => r.user_id !== user_id);
            broadcastLocal({
              type: "hotspots_list",
              hotspots: Array.from(hotspotsLocal.values()),
            });

            // Send local room syncs
            const localUids = hotspot.requests
              .filter((r) => r.status === "accepted")
              .map((r) => r.user_id);
            localUids.push(hotspot.host_id);
            localUids.forEach((uid) => {
              const cs = findLocalSocketByUserId(uid);
              if (cs) cs.send(JSON.stringify({ type: "room_sync", roomId, hotspot }));
            });
          }
        }
      }
    } catch (e) {
      console.error("[noirme] Message handle exception:", e);
    }
  });

  ws.on("close", async () => {
    const info = clientsLocal.get(ws);
    if (info) {
      console.log(`[noirme] Local client closed: ${info.username}`);
      clientsLocal.delete(ws);

      if (useRedis && redisPub) {
        try {
          await redisPub.hDel("noirme:active_users", info.user_id);
          await redisPub.publish(
            "noirme:location_updates",
            JSON.stringify({
              type: "user_disconnected",
              user_id: info.user_id,
            })
          );
        } catch (e) {
          console.error("[noirme] Redis client cleanup exception:", e);
        }
      } else {
        broadcastLocal({
          type: "user_disconnected",
          user_id: info.user_id,
        });
      }
    }
  });
});

// ── Redis Connection Initialization ──────────────────────────────────────────
async function initRedis() {
  if (!REDIS_URL) {
    console.log("[noirme] No REDIS_URL provided. Operating in single-instance in-memory mode.");
    return;
  }

  try {
    console.log(`[noirme] Initializing Redis connection: ${REDIS_URL}`);
    redisPub = createClient({ url: REDIS_URL });
    redisSub = createClient({ url: REDIS_URL });

    redisPub.on("error", (err) => console.error("[noirme] Redis Pub Error:", err));
    redisSub.on("error", (err) => console.error("[noirme] Redis Sub Error:", err));

    await redisPub.connect();
    await redisSub.connect();

    useRedis = true;
    console.log("[noirme] Redis connected. Multi-instance horizontal scaling enabled.");

    // Subscribe to distributed sync channels
    await redisSub.subscribe("noirme:location_updates", (message) => {
      const payload = JSON.parse(message);
      broadcastLocal(payload);
    });

    await redisSub.subscribe("noirme:hotspots_updates", (message) => {
      const payload = JSON.parse(message);
      broadcastLocal(payload);
    });

    await redisSub.subscribe("noirme:chat_messages", (message) => {
      const payload = JSON.parse(message);
      if (payload.rosterUpdateOnly) {
        // Roster changes sync
        const recipientIds = payload.hotspot.requests
          .filter((r: any) => r.status === "accepted")
          .map((r: any) => r.user_id);
        recipientIds.push(payload.hotspot.host_id);

        recipientIds.forEach((uid: string) => {
          const localSocket = findLocalSocketByUserId(uid);
          if (localSocket) {
            localSocket.send(
              JSON.stringify({
                type: "room_sync",
                roomId: payload.roomId,
                hotspot: payload.hotspot,
              })
            );
          }
        });
      } else {
        // Message relay
        const recipientIds: string[] = payload.members;
        if (!recipientIds.includes(payload.host_id)) {
          recipientIds.push(payload.host_id);
        }

        recipientIds.forEach((uid) => {
          const localSocket = findLocalSocketByUserId(uid);
          if (localSocket) {
            localSocket.send(
              JSON.stringify({
                type: "new_message",
                roomId: payload.roomId,
                message: payload.message,
              })
            );
          }
        });
      }
    });

    await redisSub.subscribe("noirme:direct_notifications", (message) => {
      const { target_user_id, payload } = JSON.parse(message);
      const localSocket = findLocalSocketByUserId(target_user_id);
      if (localSocket) {
        localSocket.send(JSON.stringify(payload));
      }
    });
  } catch (err) {
    console.error("[noirme] Redis initialization failed. Falling back to in-memory mode.", err);
    useRedis = false;
    redisPub = null;
    redisSub = null;
  }
}

// Heartbeat check every 30 seconds to clean up dead connections
setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      console.log("[noirme] Terminating dead client connection");
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Boot server
initRedis().then(() => {
  server.listen(PORT, () => {
    console.log(`[noirme] Server running on port ${PORT}`);
  });
});
