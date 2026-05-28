import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";
import { z } from "zod";

// Global crash guards — never let the server process die
process.on("uncaughtException", (err) => {
  logEvent("uncaught_exception", { error: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  logEvent("unhandled_rejection", { reason: String(reason) });
});

// ── Structured Logging Helper ────────────────────────────────────────────────
function logEvent(action: string, metadata: Record<string, any> = {}) {
  const logObj = {
    timestamp: new Date().toISOString(),
    action,
    ...metadata,
  };
  console.log(JSON.stringify(logObj));
}

function sanitizeInput(input: string | undefined | null): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

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
  bio?: string;
  selectedTags?: string[];
  gender?: string;
  age?: number;
  blockedUsers?: string[];
  radarRange?: number;
  hotspotRange?: number;
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
  host_bio?: string;
  host_tags?: string[];
  host_gender?: string;
  host_age?: number;
  hotspotRange?: number;
}

// ── Zod Message Validation Schemas ───────────────────────────────────────────
const LocationUpdateSchema = z.object({
  type: z.literal("location_update"),
  user_id: z.string(),
  username: z.string(),
  avatar_url: z.string().optional(),
  vibeEmoji: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  bio: z.string().optional().nullable(),
  selectedTags: z.array(z.string()).optional().nullable(),
  gender: z.string().optional().nullable(),
  age: z.union([z.number(), z.string(), z.literal("")]).optional().nullable(),
  blockedUsers: z.array(z.string()).optional().nullable(),
  radarRange: z.number().optional().nullable(),
  hotspotRange: z.number().optional().nullable(),
});

const CreateHotspotSchema = z.object({
  type: z.literal("create_hotspot"),
  user_id: z.string(),
  username: z.string(),
  avatar_url: z.string(),
  vibeEmoji: z.string(),
  title: z.string(),
  lat: z.number(),
  lng: z.number(),
  host_bio: z.string().optional().nullable(),
  host_tags: z.array(z.string()).optional().nullable(),
  host_gender: z.string().optional().nullable(),
  host_age: z.union([z.number(), z.string(), z.literal("")]).optional().nullable(),
  hotspotRange: z.number().optional().nullable(),
});

const RequestJoinSchema = z.object({
  type: z.literal("request_join"),
  roomId: z.string(),
  user_id: z.string(),
  username: z.string(),
  avatar_url: z.string(),
});

const RespondJoinSchema = z.object({
  type: z.literal("respond_join"),
  roomId: z.string(),
  guestId: z.string(),
  status: z.enum(["accepted", "declined"]),
});

const SendMessageSchema = z.object({
  type: z.literal("send_message"),
  roomId: z.string(),
  text: z.string(),
  sender_id: z.string(),
  sender_username: z.string(),
  sender_avatar: z.string(),
});

const LeaveHotspotSchema = z.object({
  type: z.literal("leave_hotspot"),
  roomId: z.string(),
  user_id: z.string(),
});

const SendWaveSchema = z.object({
  type: z.literal("send_wave"),
  target_user_id: z.string(),
  sender_id: z.string(),
  sender_username: z.string(),
});

const IncomingMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("request_sync") }),
  LocationUpdateSchema,
  CreateHotspotSchema,
  RequestJoinSchema,
  RespondJoinSchema,
  SendMessageSchema,
  LeaveHotspotSchema,
  SendWaveSchema,
]);

// ── In-Memory Fallback State (used if Redis is inactive/not configured) ──────
const clientsLocal = new Map<WebSocket, ClientInfo>();
const hotspotsLocal = new Map<string, Hotspot>();
const lastBroadcastTime = new Map<string, number>(); // userId -> timestamp for throttle
const rateLimits = new Map<WebSocket, { count: number; resetAt: number }>();

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
          logEvent("hotspot_expired", { id });
          changed = true;
        }
      }
      if (changed) {
        publishHotspotUpdate();
      }
    } catch (e: any) {
      logEvent("redis_cleanup_error", { error: e.message });
    }
  } else {
    // In-memory fallback cleanup
    let changed = false;
    for (const [id, hotspot] of hotspotsLocal.entries()) {
      if (hotspot.expires_at < now) {
        hotspotsLocal.delete(id);
        changed = true;
        logEvent("local_hotspot_expired", { id });
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

// Health check + static endpoint server
const server = createServer(async (req, res) => {
  if (req.url === "/health") {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      redis: {
        enabled: useRedis,
        connected: useRedis && redisPub?.isOpen ? "connected" : "disconnected",
      },
      clients: wss.clients.size,
    };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health));
    return;
  }

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
    } catch (e: any) {
      logEvent("redis_publish_hotspots_error", { error: e.message });
    }
  }
}

// ── Secure Sync & Broadcast Helpers ──────────────────────────────────────────
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (Math.abs(lat1 - lat2) > 0.35 || Math.abs(lon1 - lon2) > 0.35) {
    return 999999;
  }

  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

async function sendSync(ws: WebSocket) {
  const clientInfo = clientsLocal.get(ws);
  if (!clientInfo) return;

  let allUsers: ClientInfo[] = [];
  let allHotspots: Hotspot[] = [];

  if (useRedis && redisPub) {
    try {
      // Refresh user active session TTL in Redis
      await redisPub.set(`noirme:user_session:${clientInfo.user_id}`, "active", { EX: 120 });

      const maxRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));

      // Geo-spatial query for active users
      const nearbyUserIds = await redisPub.geoSearch(
        "noirme:user_locations",
        { latitude: clientInfo.lat, longitude: clientInfo.lng },
        { radius: maxRange, unit: "km" }
      );

      if (nearbyUserIds && nearbyUserIds.length > 0) {
        const pipeline = redisPub.multi();
        nearbyUserIds.forEach((uid) => {
          pipeline.exists(`noirme:user_session:${uid}`);
        });
        const sessionExistsResults = (await pipeline.exec()) as any[];

        const validUserIds: string[] = [];
        const expiredUserIds: string[] = [];

        sessionExistsResults.forEach((resVal, idx) => {
          const uid = nearbyUserIds[idx];
          if (resVal === 1 || resVal === true || String(resVal) === "1") {
            validUserIds.push(uid);
          } else {
            expiredUserIds.push(uid);
          }
        });

        // Purge expired coordinates
        if (expiredUserIds.length > 0) {
          logEvent("redis_purge_expired_users", { count: expiredUserIds.length });
          const purgePipeline = redisPub.multi();
          expiredUserIds.forEach((uid) => {
            purgePipeline.zRem("noirme:user_locations", uid);
            purgePipeline.hDel("noirme:active_users", uid);
          });
          await purgePipeline.exec();
        }

        if (validUserIds.length > 0) {
          const rawUsers = (await redisPub.hMGet("noirme:active_users", validUserIds)) as any[];
          allUsers = rawUsers.filter(Boolean).map((u: any) => JSON.parse(u));
        }
      }

      // Geo-spatial query for hotspots
      const nearbyHotspotIds = await redisPub.geoSearch(
        "noirme:hotspot_locations",
        { latitude: clientInfo.lat, longitude: clientInfo.lng },
        { radius: maxRange, unit: "km" }
      );

      if (nearbyHotspotIds && nearbyHotspotIds.length > 0) {
        const rawHotspots = (await redisPub.hMGet("noirme:hotspots", nearbyHotspotIds)) as any[];

        const validHotspots: Hotspot[] = [];
        const expiredHotspotIds: string[] = [];

        rawHotspots.forEach((raw, idx) => {
          const rid = nearbyHotspotIds[idx];
          if (!raw) {
            expiredHotspotIds.push(rid);
            return;
          }
          try {
            const h: Hotspot = JSON.parse(raw);
            if (h.expires_at > Date.now()) {
              validHotspots.push(h);
            } else {
              expiredHotspotIds.push(rid);
            }
          } catch {
            expiredHotspotIds.push(rid);
          }
        });

        // Purge expired hotspots
        if (expiredHotspotIds.length > 0) {
          logEvent("redis_purge_expired_hotspots", { count: expiredHotspotIds.length });
          const purgePipeline = redisPub.multi();
          expiredHotspotIds.forEach((rid) => {
            purgePipeline.zRem("noirme:hotspot_locations", rid);
            purgePipeline.hDel("noirme:hotspots", rid);
          });
          await purgePipeline.exec();
        }

        allHotspots = validHotspots;
      }
    } catch (e: any) {
      logEvent("redis_geo_sync_failed", { error: e.message });
    }
  } else {
    allUsers = Array.from(clientsLocal.values());
    allHotspots = Array.from(hotspotsLocal.values());
  }

  // Filter active users: omit blocks and radar ranges
  const activeUsers = allUsers.filter((u) => {
    if (!u.lat || !u.lng) return false;
    if (u.user_id === clientInfo.user_id) return false;

    const iBlockedU = (clientInfo.blockedUsers || []).includes(u.user_id);
    const uBlockedMe = (u.blockedUsers || []).includes(clientInfo.user_id);
    if (iBlockedU || uBlockedMe) return false;

    const distance = getDistanceKm(clientInfo.lat, clientInfo.lng, u.lat, u.lng);
    const maxRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));
    return distance <= maxRange;
  });

  // Filter hotspots: omit blocked hosts and scopes
  const activeHotspots = allHotspots.filter((h) => {
    if (h.expires_at <= Date.now()) return false;

    const iBlockedHost = (clientInfo.blockedUsers || []).includes(h.host_id);
    const hostInfo = Array.from(clientsLocal.values()).find((u) => u.user_id === h.host_id);
    const hostBlockedMe = (hostInfo?.blockedUsers || []).includes(clientInfo.user_id);
    if (iBlockedHost || hostBlockedMe) return false;

    // Host always sees their own hotspot; guests must be within viewer + host ranges
    const isHost = clientInfo.user_id === h.host_id;
    if (isHost) return true;

    const distance = getDistanceKm(clientInfo.lat, clientInfo.lng, h.lat, h.lng);
    const viewerRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));
    const hostRange = Math.max(10, Math.min(30, h.hotspotRange || 15));
    return distance <= viewerRange && distance <= hostRange;
  });

  ws.send(
    JSON.stringify({
      type: "sync",
      users: activeUsers,
      hotspots: activeHotspots,
    })
  );
}

function broadcastLocationUpdate(data: ClientInfo, senderWs?: WebSocket) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (senderWs && client === senderWs) return;

      const recipientInfo = clientsLocal.get(client);
      if (recipientInfo) {
        if (recipientInfo.user_id === data.user_id) return;

        const iBlockedU = (data.blockedUsers || []).includes(recipientInfo.user_id);
        const uBlockedMe = (recipientInfo.blockedUsers || []).includes(data.user_id);
        if (iBlockedU || uBlockedMe) return;

        if (recipientInfo.lat && recipientInfo.lng && data.lat && data.lng) {
          const distance = getDistanceKm(recipientInfo.lat, recipientInfo.lng, data.lat, data.lng);
          const maxRange = Math.max(10, Math.min(30, recipientInfo.radarRange || 15));
          if (distance > maxRange) return;
        }
      }
      client.send(
        JSON.stringify({
          type: "location_update",
          data,
        })
      );
    }
  });
}

// ── Connection Handler ───────────────────────────────────────────────────────
wss.on("connection", async (ws: any) => {
  logEvent("client_connected", { connected_clients: wss.clients.size });
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", async (raw: any) => {
    // ── Connection-level Rate Limiting (max 20 msgs/sec) ─────────────────────
    const now = Date.now();
    let limit = rateLimits.get(ws);
    if (!limit || now > limit.resetAt) {
      limit = { count: 1, resetAt: now + 1000 };
      rateLimits.set(ws, limit);
    } else {
      limit.count++;
      if (limit.count > 20) {
        const info = clientsLocal.get(ws);
        logEvent("rate_limit_exceeded", { user_id: info?.user_id, username: info?.username });
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Rate limit exceeded (max 20 messages/second)",
          })
        );
        return;
      }
    }

    try {
      const parsedData = JSON.parse(raw.toString());

      // ── Zod Message Validation ─────────────────────────────────────────────
      const validation = IncomingMessageSchema.safeParse(parsedData);
      if (!validation.success) {
        logEvent("message_validation_failed", {
          error: validation.error.format(),
          rawData: parsedData,
        });
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Message validation failed",
          })
        );
        return;
      }

      const data = validation.data;

      if (data.type === "request_sync") {
        await sendSync(ws);
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
          bio: sanitizeInput(data.bio),
          selectedTags: data.selectedTags || [],
          gender: data.gender || "",
          age: typeof data.age === "number" ? data.age : undefined,
          blockedUsers: data.blockedUsers || [],
          radarRange: typeof data.radarRange === "number" ? data.radarRange : undefined,
          hotspotRange: typeof data.hotspotRange === "number" ? data.hotspotRange : undefined,
        };

        clientsLocal.set(ws, info);

        // Kick on Block relationship sync
        const infoBlocks = info.blockedUsers || [];
        if (infoBlocks.length > 0) {
          if (useRedis && redisPub) {
            try {
              const rawHotspots = await redisPub.hGetAll("noirme:hotspots");
              for (const [rid, rawH] of Object.entries(rawHotspots)) {
                const hotspot: Hotspot = JSON.parse(rawH);
                const isHostBlocker = hotspot.host_id === info.user_id;
                let changed = false;

                if (isHostBlocker) {
                  const initialLen = hotspot.requests.length;
                  hotspot.requests = hotspot.requests.filter((r) => !infoBlocks.includes(r.user_id));
                  if (hotspot.requests.length !== initialLen) changed = true;
                } else {
                  const isGuestBlocked = infoBlocks.includes(hotspot.host_id);
                  if (isGuestBlocked) {
                    const initialLen = hotspot.requests.length;
                    hotspot.requests = hotspot.requests.filter((r) => r.user_id !== info.user_id);
                    if (hotspot.requests.length !== initialLen) changed = true;
                  }
                }

                if (changed) {
                  await redisPub.hSet("noirme:hotspots", rid, JSON.stringify(hotspot));
                  await redisPub.publish(
                    "noirme:chat_messages",
                    JSON.stringify({
                      roomId: rid,
                      rosterUpdateOnly: true,
                      hotspot,
                    })
                  );
                }
              }
            } catch (e: any) {
              logEvent("kick_on_block_failed", { error: e.message });
            }
          } else {
            // Local fallback
            for (const [rid, hotspot] of hotspotsLocal.entries()) {
              const isHostBlocker = hotspot.host_id === info.user_id;
              let changed = false;
              if (isHostBlocker) {
                const initialLen = hotspot.requests.length;
                hotspot.requests = hotspot.requests.filter((r) => !infoBlocks.includes(r.user_id));
                if (hotspot.requests.length !== initialLen) changed = true;
              } else {
                const isGuestBlocked = infoBlocks.includes(hotspot.host_id);
                if (isGuestBlocked) {
                  const initialLen = hotspot.requests.length;
                  hotspot.requests = hotspot.requests.filter((r) => r.user_id !== info.user_id);
                  if (hotspot.requests.length !== initialLen) changed = true;
                }
              }

              if (changed) {
                const localUids = hotspot.requests
                  .filter((r) => r.status === "accepted")
                  .map((r) => r.user_id);
                localUids.push(hotspot.host_id);
                localUids.forEach((uid) => {
                  const cs = findLocalSocketByUserId(uid);
                  if (cs) cs.send(JSON.stringify({ type: "room_sync", roomId: rid, hotspot }));
                });
              }
            }
          }
        }

        if (useRedis && redisPub) {
          await redisPub.hSet("noirme:active_users", info.user_id, JSON.stringify(info));

          await redisPub.geoAdd("noirme:user_locations", {
            longitude: info.lng,
            latitude: info.lat,
            member: info.user_id,
          });

          await redisPub.set(`noirme:user_session:${info.user_id}`, "active", { EX: 120 });

          const nowBroadcast = Date.now();
          const lastTime = lastBroadcastTime.get(info.user_id) || 0;
          if (nowBroadcast - lastTime >= 2000) {
            lastBroadcastTime.set(info.user_id, nowBroadcast);
            await redisPub.publish(
              "noirme:location_updates",
              JSON.stringify({
                type: "location_update",
                data: info,
              })
            );
          }
        } else {
          // Local fallback — also throttle
          const nowBroadcast = Date.now();
          const lastTime = lastBroadcastTime.get(info.user_id) || 0;
          if (nowBroadcast - lastTime >= 2000) {
            lastBroadcastTime.set(info.user_id, nowBroadcast);
            broadcastLocationUpdate(info, ws);
          }
        }

        await sendSync(ws);
      } else if (data.type === "create_hotspot") {
        const roomId = `room_${Math.random().toString(36).substring(2, 8)}`;
        const hostId = data.user_id;

        const newHotspot: Hotspot = {
          id: roomId,
          host_id: hostId,
          host_username: data.username,
          host_avatar: data.avatar_url || "",
          title: sanitizeInput(data.title),
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
          host_bio: sanitizeInput(data.host_bio),
          host_tags: data.host_tags || [],
          host_gender: data.host_gender || "",
          host_age: typeof data.host_age === "number" ? data.host_age : undefined,
          hotspotRange: typeof data.hotspotRange === "number" ? data.hotspotRange : undefined,
        };

        logEvent("hotspot_created", { roomId, host_id: hostId, title: newHotspot.title });

        if (useRedis && redisPub) {
          await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(newHotspot));

          await redisPub.geoAdd("noirme:hotspot_locations", {
            longitude: newHotspot.lng,
            latitude: newHotspot.lat,
            member: roomId,
          });

          await publishHotspotUpdate();

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
        logEvent("join_requested", { roomId, user_id, username });

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

          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id: hotspot.host_id,
              payload: {
                type: "join_request_received",
                roomId,
                username,
                request,
                hotspot,
              },
            })
          );

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
              JSON.stringify({ type: "join_request_received", roomId, username, request, hotspot })
            );
          }
          ws.send(JSON.stringify({ type: "request_status", roomId, status: "pending" }));
        }
      } else if (data.type === "respond_join") {
        const { roomId, guestId, status } = data;
        logEvent("join_responded", { roomId, guestId, status });

        if (useRedis && redisPub) {
          const rawHotspot = await redisPub.hGet("noirme:hotspots", roomId);
          if (!rawHotspot) return;
          const hotspot: Hotspot = JSON.parse(rawHotspot);

          const request = hotspot.requests.find((r) => r.user_id === guestId);
          if (request) {
            request.status = status;
            await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(hotspot));
            await publishHotspotUpdate();

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
        const sanitizedText = sanitizeInput(text);
        logEvent("message_sent", { roomId, sender_id, sender_username });

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
              text: sanitizedText,
              timestamp: Date.now(),
            };

            hotspot.messages.push(newMessage);
            await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(hotspot));

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
              text: sanitizedText,
              timestamp: Date.now(),
            };

            hotspot.messages.push(newMessage);

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
        logEvent("hotspot_left", { roomId, user_id });

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
      } else if (data.type === "send_wave") {
        const { target_user_id, sender_id, sender_username } = data;
        logEvent("wave_sent", { target_user_id, sender_id, sender_username });

        if (useRedis && redisPub) {
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id,
              payload: {
                type: "wave_received",
                sender_id,
                sender_username,
              },
            })
          );
        } else {
          const targetSocket = findLocalSocketByUserId(target_user_id);
          if (targetSocket) {
            targetSocket.send(
              JSON.stringify({ type: "wave_received", sender_id, sender_username })
            );
          }
        }
      }
    } catch (e: any) {
      logEvent("message_handle_exception", { error: e.message, stack: e.stack });
    }
  });

  ws.on("close", async () => {
    rateLimits.delete(ws);
    const info = clientsLocal.get(ws);
    if (info) {
      logEvent("client_disconnected", { user_id: info.user_id, username: info.username });
      clientsLocal.delete(ws);
      lastBroadcastTime.delete(info.user_id);

      if (useRedis && redisPub) {
        try {
          await redisPub.hDel("noirme:active_users", info.user_id);
          await redisPub.zRem("noirme:user_locations", info.user_id);
          await redisPub.del(`noirme:user_session:${info.user_id}`);
          await redisPub.publish(
            "noirme:location_updates",
            JSON.stringify({
              type: "user_disconnected",
              user_id: info.user_id,
            })
          );
        } catch (e: any) {
          logEvent("redis_cleanup_exception", { error: e.message });
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
    logEvent("redis_skipped", { reason: "No REDIS_URL provided. Operating in single-instance mode." });
    return;
  }

  try {
    logEvent("redis_connecting", { url: REDIS_URL });
    redisPub = createClient({ url: REDIS_URL });
    redisSub = createClient({ url: REDIS_URL });

    redisPub.on("error", (err) => logEvent("redis_pub_error", { error: err.message }));
    redisSub.on("error", (err) => logEvent("redis_sub_error", { error: err.message }));

    await redisPub.connect();
    await redisSub.connect();

    useRedis = true;
    logEvent("redis_connected");

    await redisSub.subscribe("noirme:location_updates", (message) => {
      const payload = JSON.parse(message);
      if (payload.type === "location_update") {
        broadcastLocationUpdate(payload.data);
      } else {
        broadcastLocal(payload);
      }
    });

    await redisSub.subscribe("noirme:hotspots_updates", (message) => {
      const payload = JSON.parse(message);
      broadcastLocal(payload);
    });

    await redisSub.subscribe("noirme:chat_messages", (message) => {
      const payload = JSON.parse(message);
      if (payload.rosterUpdateOnly) {
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
  } catch (err: any) {
    logEvent("redis_init_failed", { error: err.message });
    useRedis = false;
    redisPub = null;
    redisSub = null;
  }
}

// Heartbeat check every 20 seconds to clean up dead connections faster
setInterval(() => {
  wss.clients.forEach((ws: any) => {
    if (ws.isAlive === false) {
      logEvent("terminating_dead_client");
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 20000);

// ── Graceful Shutdown Handler ────────────────────────────────────────────────
const shutdown = async () => {
  logEvent("server_shutdown_triggered");

  wss.close(() => {
    logEvent("ws_server_closed");
  });

  server.close(() => {
    logEvent("http_server_closed");
  });

  if (redisPub) {
    await redisPub.quit();
    logEvent("redis_pub_connection_closed");
  }
  if (redisSub) {
    await redisSub.quit();
    logEvent("redis_sub_connection_closed");
  }

  logEvent("server_shutdown_complete");
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Boot server
initRedis().then(() => {
  server.listen(PORT, () => {
    logEvent("server_running", { port: PORT });
  });
});
