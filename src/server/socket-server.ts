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
  is_broadcasting_audio?: boolean;
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
  osm_place_id?: number;
  osm_place_name?: string;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  sender_username: string;
  sender_avatar: string;
  recipient_id: string;
  text: string;
  timestamp: number;
}

interface ChatRequest {
  sender_id: string;
  sender_username: string;
  sender_avatar: string;
  target_id: string;
  status: "pending" | "accepted" | "rejected";
  timestamp: number;
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
  bio: z.string().max(200).optional().nullable(),
  selectedTags: z.array(z.string().max(50)).max(6).optional().nullable(),
  gender: z.string().optional().nullable(),
  age: z
    .union([z.number(), z.string(), z.literal("")])
    .optional()
    .nullable(),
  blockedUsers: z.array(z.string()).optional().nullable(),
  radarRange: z.number().optional().nullable(),
  hotspotRange: z.number().optional().nullable(),
  is_broadcasting_audio: z.boolean().optional().nullable(),
});

const CreateHotspotSchema = z.object({
  type: z.literal("create_hotspot"),
  user_id: z.string(),
  username: z.string(),
  avatar_url: z.string(),
  vibeEmoji: z.string(),
  title: z.string().min(1).max(100),
  lat: z.number(),
  lng: z.number(),
  host_bio: z.string().max(200).optional().nullable(),
  host_tags: z.array(z.string().max(50)).max(6).optional().nullable(),
  host_gender: z.string().optional().nullable(),
  host_age: z
    .union([z.number(), z.string(), z.literal("")])
    .optional()
    .nullable(),
  hotspotRange: z.number().optional().nullable(),
  osm_place_id: z.number().optional().nullable(),
  osm_place_name: z.string().optional().nullable(),
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
  text: z.string().min(1).max(500),
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

const SendChatRequestSchema = z.object({
  type: z.literal("send_chat_request"),
  target_user_id: z.string(),
});

const RespondChatRequestSchema = z.object({
  type: z.literal("respond_chat_request"),
  sender_id: z.string(),
  status: z.enum(["accepted", "rejected"]),
});

const SendDirectMessageSchema = z.object({
  type: z.literal("send_direct_message"),
  recipient_id: z.string(),
  text: z.string().min(1).max(500),
});

const DirectMessageTypingSchema = z.object({
  type: z.literal("direct_message_typing"),
  recipient_id: z.string(),
  is_typing: z.boolean(),
});

const RequestChatsSchema = z.object({
  type: z.literal("request_chats"),
  user_id: z.string().optional(),
});

const RequestDMHistorySchema = z.object({
  type: z.literal("request_dm_history"),
  target_user_id: z.string(),
});

// ── WebRTC Signaling Schemas ──
const RTCOfferSchema = z.object({
  type: z.literal("rtc_offer"),
  target_user_id: z.string(),
  sender_id: z.string(),
  offer: z.any(),
});

const RTCAnswerSchema = z.object({
  type: z.literal("rtc_answer"),
  target_user_id: z.string(),
  sender_id: z.string(),
  answer: z.any(),
});

const RTCICECandidateSchema = z.object({
  type: z.literal("rtc_ice_candidate"),
  target_user_id: z.string(),
  sender_id: z.string(),
  candidate: z.any(),
});

const IncomingMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("request_sync"), user_id: z.string().optional() }),
  LocationUpdateSchema,
  CreateHotspotSchema,
  RequestJoinSchema,
  RespondJoinSchema,
  SendMessageSchema,
  LeaveHotspotSchema,
  SendWaveSchema,
  SendChatRequestSchema,
  RespondChatRequestSchema,
  SendDirectMessageSchema,
  DirectMessageTypingSchema,
  RequestChatsSchema,
  RequestDMHistorySchema,
  RTCOfferSchema,
  RTCAnswerSchema,
  RTCICECandidateSchema,
]);

// ── In-Memory Fallback State (used if Redis is inactive/not configured) ──────
const clientsLocal = new Map<WebSocket, ClientInfo>();
const hotspotsLocal = new Map<string, Hotspot>();
const lastBroadcastTime = new Map<string, number>(); // userId -> timestamp for throttle
const lastSyncTime = new Map<WebSocket, number>(); // ws -> timestamp for sync throttle
const rateLimits = new Map<WebSocket, { count: number; resetAt: number }>();

// Chat state (local fallback)
const chatRequestsLocal = new Map<string, ChatRequest>(); // key: "senderId:targetId"
const directMessagesLocal = new Map<string, DirectMessage[]>(); // key: "sortedUserA:sortedUserB"

// ── Redis Clients ────────────────────────────────────────────────────────────
let redisPub: ReturnType<typeof createClient> | null = null;
let redisSub: ReturnType<typeof createClient> | null = null;
let useRedis = false;

// ── Clean Expired Data Loop (1 min) ──────────────────────────────────────────
setInterval(async () => {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  if (useRedis && redisPub) {
    try {
      // Hotspots cleanup
      const allHotspots = await redisPub.hGetAll("noirme:hotspots");
      let changed = false;
      for (const [id, raw] of Object.entries(allHotspots)) {
        const hotspot: Hotspot = JSON.parse(raw);
        if (hotspot.expires_at < now) {
          await redisPub.hDel("noirme:hotspots", id);
          await redisPub.zRem("noirme:hotspot_locations", id);
          logEvent("hotspot_expired", { id });
          changed = true;
        }
      }
      if (changed) {
        publishHotspotUpdate();
      }

      // Chat requests cleanup
      const allRequests = await redisPub.hGetAll("noirme:chat_requests");
      for (const [key, raw] of Object.entries(allRequests)) {
        const req: ChatRequest = JSON.parse(raw);
        if (req.timestamp < dayAgo) {
          await redisPub.hDel("noirme:chat_requests", key);
          logEvent("redis_chat_request_expired", { key });
        }
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

    // Prune local expired chat requests
    for (const [key, req] of chatRequestsLocal.entries()) {
      if (req.timestamp < dayAgo) {
        chatRequestsLocal.delete(key);
        logEvent("local_chat_request_expired", { key });
      }
    }

    // Prune local expired direct messages
    for (const [convoId, msgs] of directMessagesLocal.entries()) {
      const filtered = msgs.filter((m) => m.timestamp > dayAgo);
      if (filtered.length !== msgs.length) {
        if (filtered.length === 0) {
          directMessagesLocal.delete(convoId);
        } else {
          directMessagesLocal.set(convoId, filtered);
        }
        logEvent("local_dms_expired", {
          convoId,
          deleted_count: msgs.length - filtered.length,
        });
      }
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

// ── Chat Synchronization Helpers ─────────────────────────────────────────────
async function sendChatsSync(ws: WebSocket, userId: string) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  let allRequests: ChatRequest[] = [];

  if (useRedis && redisPub) {
    try {
      const raw = await redisPub.hGetAll("noirme:chat_requests");
      for (const [key, rawVal] of Object.entries(raw)) {
        const req: ChatRequest = JSON.parse(rawVal);
        if (req.timestamp < dayAgo) {
          await redisPub.hDel("noirme:chat_requests", key);
        } else {
          allRequests.push(req);
        }
      }
    } catch (e: any) {
      logEvent("redis_sync_chats_error", { error: e.message });
    }
  } else {
    // Local fallback
    for (const [key, req] of chatRequestsLocal.entries()) {
      if (req.timestamp < dayAgo) {
        chatRequestsLocal.delete(key);
      } else {
        allRequests.push(req);
      }
    }
  }

  // Filter requests involving the current user
  const userRequests = allRequests.filter(
    (r) => r.sender_id === userId || r.target_id === userId,
  );

  ws.send(
    JSON.stringify({
      type: "chats_list",
      requests: userRequests,
    }),
  );
}

async function triggerChatsSync(userId: string) {
  const localSocket = findLocalSocketByUserId(userId);
  if (localSocket) {
    await sendChatsSync(localSocket, userId);
  }

  if (useRedis && redisPub) {
    try {
      await redisPub.publish(
        "noirme:direct_notifications",
        JSON.stringify({
          target_user_id: userId,
          payload: {
            type: "chats_sync_needed",
          },
        }),
      );
    } catch (e: any) {
      logEvent("redis_trigger_chats_sync_failed", { error: e.message });
    }
  }
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
        }),
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
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
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
      await redisPub.set(
        `noirme:user_session:${clientInfo.user_id}`,
        (ws as any).socketId || "default",
        { EX: 120 },
      );

      const maxRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));

      // Geo-spatial query for active users
      const nearbyUserIds = await redisPub.geoSearch(
        "noirme:user_locations",
        { latitude: clientInfo.lat, longitude: clientInfo.lng },
        { radius: maxRange, unit: "km" },
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
          logEvent("redis_purge_expired_users", {
            count: expiredUserIds.length,
          });
          const purgePipeline = redisPub.multi();
          expiredUserIds.forEach((uid) => {
            purgePipeline.zRem("noirme:user_locations", uid);
            purgePipeline.hDel("noirme:active_users", uid);
          });
          await purgePipeline.exec();
        }

        if (validUserIds.length > 0) {
          const rawUsers = (await redisPub.hmGet(
            "noirme:active_users",
            validUserIds,
          )) as any[];
          allUsers = rawUsers.filter(Boolean).map((u: any) => JSON.parse(u));
        }
      }

      // Get all active hotspots (matching broadcast state to prevent blinking)
      const allHotspotsRaw = await redisPub.hGetAll("noirme:hotspots");
      const validHotspots: Hotspot[] = [];
      const expiredHotspotIds: string[] = [];

      for (const [rid, raw] of Object.entries(allHotspotsRaw)) {
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
      }

      // Purge expired hotspots
      if (expiredHotspotIds.length > 0) {
        logEvent("redis_purge_expired_hotspots", {
          count: expiredHotspotIds.length,
        });
        const purgePipeline = redisPub.multi();
        expiredHotspotIds.forEach((rid) => {
          purgePipeline.zRem("noirme:hotspot_locations", rid);
          purgePipeline.hDel("noirme:hotspots", rid);
        });
        await purgePipeline.exec();
      }

      allHotspots = validHotspots;
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

    const distance = getDistanceKm(
      clientInfo.lat,
      clientInfo.lng,
      u.lat,
      u.lng,
    );
    const maxRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));
    return distance <= maxRange;
  });

  // Filter hotspots: omit blocked hosts, letting client handle location/distance filters to prevent blinking
  const activeHotspots = allHotspots.filter((h) => {
    if (h.expires_at <= Date.now()) return false;

    const iBlockedHost = (clientInfo.blockedUsers || []).includes(h.host_id);
    const hostInfo = Array.from(clientsLocal.values()).find(
      (u) => u.user_id === h.host_id,
    );
    const hostBlockedMe = (hostInfo?.blockedUsers || []).includes(
      clientInfo.user_id,
    );
    if (iBlockedHost || hostBlockedMe) return false;
    return true;
  });

  ws.send(
    JSON.stringify({
      type: "sync",
      users: activeUsers,
      hotspots: activeHotspots,
    }),
  );
}

function broadcastLocationUpdate(data: ClientInfo, senderWs?: WebSocket) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (senderWs && client === senderWs) return;

      const recipientInfo = clientsLocal.get(client);
      if (recipientInfo) {
        if (recipientInfo.user_id === data.user_id) return;

        const iBlockedU = (data.blockedUsers || []).includes(
          recipientInfo.user_id,
        );
        const uBlockedMe = (recipientInfo.blockedUsers || []).includes(
          data.user_id,
        );
        if (iBlockedU || uBlockedMe) return;

        if (recipientInfo.lat && recipientInfo.lng && data.lat && data.lng) {
          const distance = getDistanceKm(
            recipientInfo.lat,
            recipientInfo.lng,
            data.lat,
            data.lng,
          );
          const maxRange = Math.max(
            10,
            Math.min(30, recipientInfo.radarRange || 15),
          );
          if (distance > maxRange) return;
        }
      }
      client.send(
        JSON.stringify({
          type: "location_update",
          data,
        }),
      );
    }
  });
}

// ── Connection Handler ───────────────────────────────────────────────────────
wss.on("connection", async (ws: any) => {
  ws.socketId = Math.random().toString(36).substring(2, 10);
  logEvent("client_connected", { connected_clients: wss.clients.size, socket_id: ws.socketId });
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
        logEvent("rate_limit_exceeded", {
          user_id: info?.user_id,
          username: info?.username,
        });
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Rate limit exceeded (max 20 messages/second)",
          }),
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
          }),
        );
        return;
      }

      const data = validation.data;

      // Identity verification: Ensure client registers location first and verify matching user_id/sender_id
      const boundClient = clientsLocal.get(ws);
      if (boundClient) {
        const incomingUserId =
          data.type === "respond_chat_request"
            ? null
            : (data as any).user_id || (data as any).sender_id;

        if (incomingUserId && incomingUserId !== boundClient.user_id) {
          logEvent("identity_mismatch_rejected", {
            bound_id: boundClient.user_id,
            incoming_id: incomingUserId,
            type: data.type,
          });
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Identity mismatch",
            }),
          );
          return;
        }
      } else if (
        data.type !== "location_update" &&
        data.type !== "request_chats" &&
        data.type !== "request_sync"
      ) {
        logEvent("unregistered_client_action_rejected", { type: data.type });
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Client must register location first",
          }),
        );
        return;
      }

      if (data.type === "request_sync") {
        const userId = (data as any).user_id;
        if (userId && !clientsLocal.has(ws)) {
          clientsLocal.set(ws, {
            user_id: userId,
            username: "",
            avatar_url: "",
            vibeEmoji: "☕",
            lat: 0,
            lng: 0,
            last_seen: Date.now(),
          });
        }
        await sendSync(ws);
        return;
      }

      if (data.type === "location_update") {
        const existing = clientsLocal.get(ws);
        const info: ClientInfo = {
          user_id: data.user_id,
          username: data.username,
          avatar_url: data.avatar_url || existing?.avatar_url || "",
          vibeEmoji: data.vibeEmoji || existing?.vibeEmoji || "☕",
          lat: data.lat,
          lng: data.lng,
          last_seen: Date.now(),
          bio: data.bio !== undefined ? sanitizeInput(data.bio) : (existing?.bio || ""),
          selectedTags: data.selectedTags !== undefined ? (data.selectedTags || []) : (existing?.selectedTags || []),
          gender: data.gender !== undefined ? (data.gender || "") : (existing?.gender || ""),
          age: typeof data.age === "number" ? data.age : existing?.age,
          blockedUsers: data.blockedUsers !== undefined ? (data.blockedUsers || []) : (existing?.blockedUsers || []),
          radarRange:
            typeof data.radarRange === "number" ? data.radarRange : (existing?.radarRange || 15),
          hotspotRange:
            typeof data.hotspotRange === "number"
              ? data.hotspotRange
              : (existing?.hotspotRange || 15),
          is_broadcasting_audio: data.is_broadcasting_audio !== undefined ? !!data.is_broadcasting_audio : (existing?.is_broadcasting_audio || false),
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
                  hotspot.requests = hotspot.requests.filter(
                    (r) => !infoBlocks.includes(r.user_id),
                  );
                  if (hotspot.requests.length !== initialLen) changed = true;
                } else {
                  const isGuestBlocked = infoBlocks.includes(hotspot.host_id);
                  if (isGuestBlocked) {
                    const initialLen = hotspot.requests.length;
                    hotspot.requests = hotspot.requests.filter(
                      (r) => r.user_id !== info.user_id,
                    );
                    if (hotspot.requests.length !== initialLen) changed = true;
                  }
                }

                if (changed) {
                  await redisPub.hSet(
                    "noirme:hotspots",
                    rid,
                    JSON.stringify(hotspot),
                  );
                  await redisPub.publish(
                    "noirme:chat_messages",
                    JSON.stringify({
                      roomId: rid,
                      rosterUpdateOnly: true,
                      hotspot,
                    }),
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
                hotspot.requests = hotspot.requests.filter(
                  (r) => !infoBlocks.includes(r.user_id),
                );
                if (hotspot.requests.length !== initialLen) changed = true;
              } else {
                const isGuestBlocked = infoBlocks.includes(hotspot.host_id);
                if (isGuestBlocked) {
                  const initialLen = hotspot.requests.length;
                  hotspot.requests = hotspot.requests.filter(
                    (r) => r.user_id !== info.user_id,
                  );
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
                  if (cs)
                    cs.send(
                      JSON.stringify({
                        type: "room_sync",
                        roomId: rid,
                        hotspot,
                      }),
                    );
                });
              }
            }
          }
        }

        if (useRedis && redisPub) {
          await redisPub.hSet(
            "noirme:active_users",
            info.user_id,
            JSON.stringify(info),
          );

          await redisPub.geoAdd("noirme:user_locations", {
            longitude: info.lng,
            latitude: info.lat,
            member: info.user_id,
          });

          await redisPub.set(`noirme:user_session:${info.user_id}`, ws.socketId || "default", {
            EX: 120,
          });

          const nowBroadcast = Date.now();
          const lastTime = lastBroadcastTime.get(info.user_id) || 0;
          if (nowBroadcast - lastTime >= 2000) {
            lastBroadcastTime.set(info.user_id, nowBroadcast);
            await redisPub.publish(
              "noirme:location_updates",
              JSON.stringify({
                type: "location_update",
                data: info,
              }),
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

        // Throttled sync: max 1 full sync per 3 seconds per client to prevent Redis hammering
        const nowSync = Date.now();
        const lastSync = lastSyncTime.get(ws) || 0;
        if (nowSync - lastSync >= 3000) {
          lastSyncTime.set(ws, nowSync);
          await sendSync(ws);
        }
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
          host_age:
            typeof data.host_age === "number" ? data.host_age : undefined,
          hotspotRange:
            typeof data.hotspotRange === "number"
              ? data.hotspotRange
              : undefined,
          osm_place_id:
            typeof data.osm_place_id === "number"
              ? data.osm_place_id
              : undefined,
          osm_place_name:
            typeof data.osm_place_name === "string"
              ? data.osm_place_name
              : undefined,
        };

        logEvent("hotspot_created", {
          roomId,
          host_id: hostId,
          title: newHotspot.title,
        });

        if (useRedis && redisPub) {
          await redisPub.hSet(
            "noirme:hotspots",
            roomId,
            JSON.stringify(newHotspot),
          );

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
            }),
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
            }),
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
            request = {
              user_id,
              username,
              avatar_url: avatar_url || "",
              status: "pending",
            };
            hotspot.requests.push(request);
          }

          await redisPub.hSet(
            "noirme:hotspots",
            roomId,
            JSON.stringify(hotspot),
          );
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
            }),
          );

          ws.send(
            JSON.stringify({
              type: "request_status",
              roomId,
              status: "pending",
            }),
          );
        } else {
          const hotspot = hotspotsLocal.get(roomId);
          if (!hotspot) return;

          let request = hotspot.requests.find((r) => r.user_id === user_id);
          if (request) {
            request.status = "pending";
          } else {
            request = {
              user_id,
              username,
              avatar_url: avatar_url || "",
              status: "pending",
            };
            hotspot.requests.push(request);
          }

          broadcastLocal({
            type: "hotspots_list",
            hotspots: Array.from(hotspotsLocal.values()),
          });

          const hostSocket = findLocalSocketByUserId(hotspot.host_id);
          if (hostSocket) {
            hostSocket.send(
              JSON.stringify({
                type: "join_request_received",
                roomId,
                username,
                request,
                hotspot,
              }),
            );
          }
          ws.send(
            JSON.stringify({
              type: "request_status",
              roomId,
              status: "pending",
            }),
          );
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
            await redisPub.hSet(
              "noirme:hotspots",
              roomId,
              JSON.stringify(hotspot),
            );
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
              }),
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
                }),
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
              guestSocket.send(
                JSON.stringify({
                  type: "join_response",
                  roomId,
                  status,
                  hotspot,
                }),
              );
              if (status === "accepted") {
                guestSocket.send(
                  JSON.stringify({ type: "room_sync", roomId, hotspot }),
                );
              }
            }
            ws.send(JSON.stringify({ type: "room_sync", roomId, hotspot }));
          }
        }
      } else if (data.type === "send_message") {
        const { roomId, text, sender_id, sender_username, sender_avatar } =
          data;
        const sanitizedText = sanitizeInput(text);
        logEvent("message_sent", { roomId, sender_id, sender_username });

        if (useRedis && redisPub) {
          const rawHotspot = await redisPub.hGet("noirme:hotspots", roomId);
          if (!rawHotspot) return;
          const hotspot: Hotspot = JSON.parse(rawHotspot);

          const member = hotspot.requests.find(
            (r) => r.user_id === sender_id && r.status === "accepted",
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
            if (hotspot.messages.length > 100) {
              hotspot.messages = hotspot.messages.slice(-100);
            }
            await redisPub.hSet(
              "noirme:hotspots",
              roomId,
              JSON.stringify(hotspot),
            );

            await redisPub.publish(
              "noirme:chat_messages",
              JSON.stringify({
                roomId,
                message: newMessage,
                members: hotspot.requests
                  .filter((r) => r.status === "accepted")
                  .map((r) => r.user_id),
                host_id: hotspot.host_id,
              }),
            );
          }
        } else {
          const hotspot = hotspotsLocal.get(roomId);
          if (!hotspot) return;

          const member = hotspot.requests.find(
            (r) => r.user_id === sender_id && r.status === "accepted",
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
            if (hotspot.messages.length > 100) {
              hotspot.messages = hotspot.messages.slice(-100);
            }

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
                  }),
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
            hotspot.requests = hotspot.requests.filter(
              (r) => r.user_id !== user_id,
            );
            await redisPub.hSet(
              "noirme:hotspots",
              roomId,
              JSON.stringify(hotspot),
            );
            await publishHotspotUpdate();

            await redisPub.publish(
              "noirme:chat_messages",
              JSON.stringify({
                roomId,
                rosterUpdateOnly: true,
                hotspot,
              }),
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
            hotspot.requests = hotspot.requests.filter(
              (r) => r.user_id !== user_id,
            );
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
              if (cs)
                cs.send(JSON.stringify({ type: "room_sync", roomId, hotspot }));
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
            }),
          );
        } else {
          const targetSocket = findLocalSocketByUserId(target_user_id);
          if (targetSocket) {
            targetSocket.send(
              JSON.stringify({
                type: "wave_received",
                sender_id,
                sender_username,
              }),
            );
          }
        }
      } else if (data.type === "send_chat_request") {
        const { target_user_id } = data;
        const senderInfo = clientsLocal.get(ws);
        if (!senderInfo) return;

        const reqKey = `${senderInfo.user_id}:${target_user_id}`;

        // Prevent duplicate pending chat requests (anti-spam)
        let existingRequest: ChatRequest | null = null;
        if (useRedis && redisPub) {
          const raw = await redisPub.hGet("noirme:chat_requests", reqKey);
          if (raw) existingRequest = JSON.parse(raw);
        } else {
          existingRequest = chatRequestsLocal.get(reqKey) || null;
        }

        if (existingRequest && existingRequest.status === "pending") {
          logEvent("chat_request_spam_prevented", {
            sender_id: senderInfo.user_id,
            target_id: target_user_id,
          });
          ws.send(
            JSON.stringify({
              type: "error",
              message: "A pending chat request already exists.",
            }),
          );
          return;
        }

        const newRequest: ChatRequest = {
          sender_id: senderInfo.user_id,
          sender_username: senderInfo.username,
          sender_avatar: senderInfo.avatar_url,
          target_id: target_user_id,
          status: "pending",
          timestamp: Date.now(),
        };

        logEvent("chat_request_sent", {
          sender_id: senderInfo.user_id,
          target_id: target_user_id,
        });

        if (useRedis && redisPub) {
          await redisPub.hSet(
            "noirme:chat_requests",
            reqKey,
            JSON.stringify(newRequest),
          );
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id,
              payload: {
                type: "chat_request_received",
                request: newRequest,
              },
            }),
          );
        } else {
          chatRequestsLocal.set(reqKey, newRequest);
          const targetSocket = findLocalSocketByUserId(target_user_id);
          if (targetSocket) {
            targetSocket.send(
              JSON.stringify({
                type: "chat_request_received",
                request: newRequest,
              }),
            );
          }
        }

        await sendChatsSync(ws, senderInfo.user_id);
      } else if (data.type === "respond_chat_request") {
        const { sender_id, status } = data;
        const responderInfo = clientsLocal.get(ws);
        if (!responderInfo) return;

        const reqKey = `${sender_id}:${responderInfo.user_id}`;
        let request: ChatRequest | null = null;

        if (useRedis && redisPub) {
          const raw = await redisPub.hGet("noirme:chat_requests", reqKey);
          if (raw) request = JSON.parse(raw);
        } else {
          request = chatRequestsLocal.get(reqKey) || null;
        }

        if (!request) return;

        request.status = status;
        logEvent("chat_request_responded", {
          sender_id,
          target_id: responderInfo.user_id,
          status,
        });

        if (useRedis && redisPub) {
          await redisPub.hSet(
            "noirme:chat_requests",
            reqKey,
            JSON.stringify(request),
          );
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id: sender_id,
              payload: {
                type: "chat_request_responded",
                request,
              },
            }),
          );
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id: responderInfo.user_id,
              payload: {
                type: "chat_request_responded",
                request,
              },
            }),
          );
        } else {
          chatRequestsLocal.set(reqKey, request);
          const senderSocket = findLocalSocketByUserId(sender_id);
          if (senderSocket) {
            senderSocket.send(
              JSON.stringify({
                type: "chat_request_responded",
                request,
              }),
            );
          }
          ws.send(
            JSON.stringify({
              type: "chat_request_responded",
              request,
            }),
          );
        }

        await sendChatsSync(ws, responderInfo.user_id);
        const senderSocket = findLocalSocketByUserId(sender_id);
        if (senderSocket) {
          await sendChatsSync(senderSocket, sender_id);
        }
        await triggerChatsSync(sender_id);
        await triggerChatsSync(responderInfo.user_id);
      } else if (data.type === "send_direct_message") {
        const { recipient_id, text } = data;
        const senderInfo = clientsLocal.get(ws);
        if (!senderInfo) return;

        const keyA = `${senderInfo.user_id}:${recipient_id}`;
        const keyB = `${recipient_id}:${senderInfo.user_id}`;
        let requestA: ChatRequest | null = null;
        let requestB: ChatRequest | null = null;

        if (useRedis && redisPub) {
          const rawA = await redisPub.hGet("noirme:chat_requests", keyA);
          const rawB = await redisPub.hGet("noirme:chat_requests", keyB);
          if (rawA) requestA = JSON.parse(rawA);
          if (rawB) requestB = JSON.parse(rawB);
        } else {
          requestA = chatRequestsLocal.get(keyA) || null;
          requestB = chatRequestsLocal.get(keyB) || null;
        }

        // NOTE: Acceptable race window exists if user A sends a DM at the exact moment user B rejects the chat request.
        const isFriend =
          (requestA && requestA.status === "accepted") ||
          (requestB && requestB.status === "accepted");

        if (!isFriend) {
          logEvent("send_dm_blocked_not_friends", {
            sender_id: senderInfo.user_id,
            recipient_id,
          });
          ws.send(
            JSON.stringify({
              type: "error",
              message:
                "Cannot send direct message. You must be connected first.",
            }),
          );
          return;
        }

        const msgId = `dm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const directMsg: DirectMessage = {
          id: msgId,
          sender_id: senderInfo.user_id,
          sender_username: senderInfo.username,
          sender_avatar: senderInfo.avatar_url,
          recipient_id,
          text: sanitizeInput(text),
          timestamp: Date.now(),
        };

        const convoId = [senderInfo.user_id, recipient_id].sort().join(":");
        logEvent("direct_message_sent", {
          convoId,
          sender_id: senderInfo.user_id,
        });

        if (useRedis && redisPub) {
          await redisPub.zAdd(`noirme:dm_history:${convoId}`, {
            score: directMsg.timestamp,
            value: JSON.stringify(directMsg),
          });
          await redisPub.expire(`noirme:dm_history:${convoId}`, 24 * 60 * 60);

          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id: recipient_id,
              payload: {
                type: "new_direct_message",
                message: directMsg,
              },
            }),
          );
        } else {
          const list = directMessagesLocal.get(convoId) || [];
          list.push(directMsg);
          directMessagesLocal.set(convoId, list);

          const recipientSocket = findLocalSocketByUserId(recipient_id);
          if (recipientSocket) {
            recipientSocket.send(
              JSON.stringify({
                type: "new_direct_message",
                message: directMsg,
              }),
            );
          }
        }

        ws.send(
          JSON.stringify({
            type: "new_direct_message",
            message: directMsg,
          }),
        );
      } else if (data.type === "direct_message_typing") {
        const { recipient_id, is_typing } = data;
        const senderInfo = clientsLocal.get(ws);
        if (!senderInfo) return;

        if (useRedis && redisPub) {
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id: recipient_id,
              payload: {
                type: "direct_message_typing",
                sender_id: senderInfo.user_id,
                is_typing,
              },
            }),
          );
        } else {
          const recipientSocket = findLocalSocketByUserId(recipient_id);
          if (recipientSocket) {
            recipientSocket.send(
              JSON.stringify({
                type: "direct_message_typing",
                sender_id: senderInfo.user_id,
                is_typing,
              }),
            );
          }
        }
      } else if (data.type === "request_chats") {
        const userId = data.user_id || clientsLocal.get(ws)?.user_id;
        if (userId) {
          if (!clientsLocal.has(ws)) {
            clientsLocal.set(ws, {
              user_id: userId,
              username: "",
              avatar_url: "",
              vibeEmoji: "☕",
              lat: 0,
              lng: 0,
              last_seen: Date.now(),
            });
          }
          await sendChatsSync(ws, userId);
        }
      } else if (data.type === "request_dm_history") {
        // DEPRECATED: Client now stores all chat in localStorage with 1h auto-expiry
        // Server no longer maintains chat history - send empty response
        const { target_user_id } = data;
        ws.send(
          JSON.stringify({
            type: "dm_history",
            target_user_id,
            messages: [],
          }),
        );
      } else if (
        data.type === "rtc_offer" ||
        data.type === "rtc_answer" ||
        data.type === "rtc_ice_candidate"
      ) {
        const { target_user_id } = data;
        if (useRedis && redisPub) {
          await redisPub.publish(
            "noirme:direct_notifications",
            JSON.stringify({
              target_user_id,
              payload: data,
            }),
          );
        } else {
          const targetSocket = findLocalSocketByUserId(target_user_id);
          if (targetSocket) {
            targetSocket.send(JSON.stringify(data));
          }
        }
      }
    } catch (e: any) {
      logEvent("message_handle_exception", {
        error: e.message,
        stack: e.stack,
      });
    }
  });

  ws.on("close", async () => {
    rateLimits.delete(ws);
    lastSyncTime.delete(ws);
    const info = clientsLocal.get(ws);
    if (info) {
      logEvent("client_disconnected_scheduled", {
        user_id: info.user_id,
        username: info.username,
        socket_id: ws.socketId,
      });
      clientsLocal.delete(ws);
      lastBroadcastTime.delete(info.user_id);

      // Schedule session cleanup after a grace period of 15 seconds.
      // This prevents blinking off-and-on when reloading the page or recovering from brief network drops.
      setTimeout(async () => {
        // Only clean up session if no other active local sockets for this user ID remain open.
        let hasOtherLocal = false;
        for (const [otherWs, otherInfo] of clientsLocal.entries()) {
          if (otherInfo.user_id === info.user_id && otherWs.readyState === WebSocket.OPEN) {
            hasOtherLocal = true;
            break;
          }
        }

        if (useRedis && redisPub) {
          try {
            const activeSocketId = await redisPub.get(`noirme:user_session:${info.user_id}`);
            // Delete session from Redis only if this socket is the one currently stored in Redis (no newer reconnection overtook it)
            // and no other local socket is active.
            if (!hasOtherLocal && (!activeSocketId || activeSocketId === ws.socketId)) {
              await redisPub.hDel("noirme:active_users", info.user_id);
              await redisPub.zRem("noirme:user_locations", info.user_id);
              await redisPub.del(`noirme:user_session:${info.user_id}`);
              await redisPub.publish(
                "noirme:location_updates",
                JSON.stringify({
                  type: "user_disconnected",
                  user_id: info.user_id,
                }),
              );
              logEvent("client_session_deleted", {
                user_id: info.user_id,
                socket_id: ws.socketId,
              });
            } else {
              logEvent("client_session_retained", {
                user_id: info.user_id,
                socket_id: ws.socketId,
                active_socket_id: activeSocketId,
                has_other_local: hasOtherLocal,
              });
            }
          } catch (e: any) {
            logEvent("redis_cleanup_exception", { error: e.message });
          }
        } else {
          if (!hasOtherLocal) {
            broadcastLocal({
              type: "user_disconnected",
              user_id: info.user_id,
            });
            logEvent("local_client_session_deleted", {
              user_id: info.user_id,
              socket_id: ws.socketId,
            });
          } else {
            logEvent("local_client_session_retained", {
              user_id: info.user_id,
              socket_id: ws.socketId,
            });
          }
        }
      }, 15000); // 15 seconds grace period
    }
  });
});

// ── Redis Connection Initialization ──────────────────────────────────────────
async function initRedis() {
  if (!REDIS_URL) {
    logEvent("redis_skipped", {
      reason: "No REDIS_URL provided. Operating in single-instance mode.",
    });
    return;
  }

  try {
    logEvent("redis_connecting", { url: REDIS_URL });
    redisPub = createClient({ url: REDIS_URL });
    redisSub = createClient({ url: REDIS_URL });

    redisPub.on("error", (err) =>
      logEvent("redis_pub_error", { error: err.message }),
    );
    redisSub.on("error", (err) =>
      logEvent("redis_sub_error", { error: err.message }),
    );

    await redisPub.connect();
    await redisSub.connect();

    useRedis = true;
    logEvent("redis_connected");

    await redisSub.subscribe("noirme:location_updates", (message) => {
      try {
        const payload = JSON.parse(message);
        if (payload.type === "location_update") {
          broadcastLocationUpdate(payload.data);
        } else {
          broadcastLocal(payload);
        }
      } catch (err: any) {
        logEvent("redis_subscriber_error", {
          channel: "noirme:location_updates",
          error: err.message,
        });
      }
    });

    await redisSub.subscribe("noirme:hotspots_updates", (message) => {
      try {
        const payload = JSON.parse(message);
        broadcastLocal(payload);
      } catch (err: any) {
        logEvent("redis_subscriber_error", {
          channel: "noirme:hotspots_updates",
          error: err.message,
        });
      }
    });

    await redisSub.subscribe("noirme:chat_messages", (message) => {
      try {
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
                }),
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
                }),
              );
            }
          });
        }
      } catch (err: any) {
        logEvent("redis_subscriber_error", {
          channel: "noirme:chat_messages",
          error: err.message,
        });
      }
    });

    await redisSub.subscribe("noirme:direct_notifications", (message) => {
      try {
        const { target_user_id, payload } = JSON.parse(message);
        const localSocket = findLocalSocketByUserId(target_user_id);
        if (localSocket) {
          if (payload.type === "chats_sync_needed") {
            sendChatsSync(localSocket, target_user_id);
          } else {
            localSocket.send(JSON.stringify(payload));
          }
        }
      } catch (err: any) {
        logEvent("redis_subscriber_error", {
          channel: "noirme:direct_notifications",
          error: err.message,
        });
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

// Boot server with error handling
initRedis()
  .then(() => {
    server.listen(PORT, () => {
      logEvent("server_running", {
        port: PORT,
        environment: process.env.NODE_ENV || "development",
        redis_enabled: useRedis,
      });
    });

    server.on("error", (err) => {
      logEvent("server_error", { error: err.message, code: (err as any).code });
      process.exit(1);
    });
  })
  .catch((err) => {
    logEvent("redis_init_failed", { error: err.message, stack: err.stack });
    console.error("Failed to initialize Redis. Starting in fallback mode...");
    // Start server even if Redis fails
    server.listen(PORT, () => {
      logEvent("server_running_fallback", {
        port: PORT,
        redis_enabled: false,
      });
    });
  });
