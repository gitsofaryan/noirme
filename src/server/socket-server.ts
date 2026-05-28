import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createClient } from "redis";

// Global crash guards — never let the server process die
process.on("uncaughtException", (err) => {
  console.error("[noirme] UNCAUGHT EXCEPTION (kept alive):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[noirme] UNHANDLED REJECTION (kept alive):", reason);
});

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

// ── In-Memory Fallback State (used if Redis is inactive/not configured) ──────
const clientsLocal = new Map<WebSocket, ClientInfo>();
const hotspotsLocal = new Map<string, Hotspot>();
const lastBroadcastTime = new Map<string, number>(); // userId -> timestamp for throttle

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

// ── Secure Sync & Broadcast Helpers ──────────────────────────────────────────
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  // Fast rectangular bounding-box pre-filter: 0.35 degrees is roughly 38km
  // If the points are obviously too far, short-circuit immediately to avoid heavy math
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
      const maxRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));
      
      // Geo-spatial query for active users within viewer's scan range
      const nearbyUserIds = await redisPub.geoSearch(
        "noirme:user_locations",
        { latitude: clientInfo.lat, longitude: clientInfo.lng },
        { radius: maxRange, unit: "km" }
      );

      if (nearbyUserIds && nearbyUserIds.length > 0) {
        // Verify active user sessions in Redis via transactional pipelining
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

        // Perform deferred on-the-fly purge of expired ghost coordinates
        if (expiredUserIds.length > 0) {
          console.log(`[noirme] Purging ${expiredUserIds.length} expired ghost users from Redis spatial index.`);
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

      // Geo-spatial query for hotspots within viewer's scan range
      const nearbyHotspotIds = await redisPub.geoSearch(
        "noirme:hotspot_locations",
        { latitude: clientInfo.lat, longitude: clientInfo.lng },
        { radius: maxRange, unit: "km" }
      );

      if (nearbyHotspotIds && nearbyHotspotIds.length > 0) {
        // Verify active hotspot sessions in Redis via transactional pipelining
        const pipeline = redisPub.multi();
        nearbyHotspotIds.forEach((rid) => {
          pipeline.exists(`noirme:hotspot_session:${rid}`);
        });
        const sessionExistsResults = (await pipeline.exec()) as any[];

        const validHotspotIds: string[] = [];
        const expiredHotspotIds: string[] = [];

        sessionExistsResults.forEach((resVal, idx) => {
          const rid = nearbyHotspotIds[idx];
          if (resVal === 1 || resVal === true || String(resVal) === "1") {
            validHotspotIds.push(rid);
          } else {
            expiredHotspotIds.push(rid);
          }
        });

        // Perform deferred on-the-fly purge of expired ghost hotspots
        if (expiredHotspotIds.length > 0) {
          console.log(`[noirme] Purging ${expiredHotspotIds.length} expired ghost hotspots from Redis spatial index.`);
          const purgePipeline = redisPub.multi();
          expiredHotspotIds.forEach((rid) => {
            purgePipeline.zRem("noirme:hotspot_locations", rid);
            purgePipeline.hDel("noirme:hotspots", rid);
          });
          await purgePipeline.exec();
        }

        if (validHotspotIds.length > 0) {
          const rawHotspots = (await redisPub.hMGet("noirme:hotspots", validHotspotIds)) as any[];
          allHotspots = rawHotspots.filter(Boolean).map((h: any) => JSON.parse(h));
        }
      }
    } catch (e) {
      console.error("[noirme] Redis geo sync failed, falling back:", e);
    }
  } else {
    allUsers = Array.from(clientsLocal.values());
    allHotspots = Array.from(hotspotsLocal.values());
  }

  // Filter active users: omit blocked relationships and those outside customized radarRange (default 15km)
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

  // Filter hotspots: omit blocked hosts, expired hotspots, and those outside customized range
  const activeHotspots = allHotspots.filter((h) => {
    if (h.expires_at <= Date.now()) return false;

    const iBlockedHost = (clientInfo.blockedUsers || []).includes(h.host_id);
    const hostInfo = Array.from(clientsLocal.values()).find((u) => u.user_id === h.host_id);
    const hostBlockedMe = (hostInfo?.blockedUsers || []).includes(clientInfo.user_id);
    if (iBlockedHost || hostBlockedMe) return false;

    const distance = getDistanceKm(clientInfo.lat, clientInfo.lng, h.lat, h.lng);
    const viewerRange = Math.max(10, Math.min(30, clientInfo.radarRange || 15));
    const hostRange = Math.max(10, Math.min(30, h.hotspotRange || 15));
    // Visible if it's within viewer's scan range AND host's broadcast range
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
      // Don't send back to the sender
      if (senderWs && client === senderWs) return;

      const recipientInfo = clientsLocal.get(client);
      if (recipientInfo) {
        // Don't send to yourself (same user_id from another tab)
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
  console.log("[noirme] Client connected");
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", async (raw: any) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "request_sync") {
        await sendSync(ws);
        return;
      }

      if (data.type === "location_update") {
        // Validate required fields
        if (!data.user_id || typeof data.lat !== "number" || typeof data.lng !== "number") {
          return; // Silently drop malformed messages
        }
        const info: ClientInfo = {
          user_id: data.user_id,
          username: data.username,
          avatar_url: data.avatar_url || "",
          vibeEmoji: data.vibeEmoji || "☕",
          lat: data.lat,
          lng: data.lng,
          last_seen: Date.now(),
          bio: sanitizeInput(data.bio),
          selectedTags: data.selectedTags,
          gender: data.gender,
          age: data.age,
          blockedUsers: data.blockedUsers || [],
          radarRange: typeof data.radarRange === "number" ? data.radarRange : undefined,
          hotspotRange: typeof data.hotspotRange === "number" ? data.hotspotRange : undefined,
        };

        // Cache locally for connection management
        clientsLocal.set(ws, info);

        // Instant Kick on Block
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
                  hotspot.requests = hotspot.requests.filter(r => !infoBlocks.includes(r.user_id));
                  if (hotspot.requests.length !== initialLen) changed = true;
                } else {
                  const isGuestBlocked = infoBlocks.includes(hotspot.host_id);
                  if (isGuestBlocked) {
                    const initialLen = hotspot.requests.length;
                    hotspot.requests = hotspot.requests.filter(r => r.user_id !== info.user_id);
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
            } catch (e) {
              console.error("[noirme] Kick on block failed:", e);
            }
          } else {
            // Local fallback
            for (const [rid, hotspot] of hotspotsLocal.entries()) {
              const isHostBlocker = hotspot.host_id === info.user_id;
              let changed = false;
              if (isHostBlocker) {
                const initialLen = hotspot.requests.length;
                hotspot.requests = hotspot.requests.filter(r => !infoBlocks.includes(r.user_id));
                if (hotspot.requests.length !== initialLen) changed = true;
              } else {
                const isGuestBlocked = infoBlocks.includes(hotspot.host_id);
                if (isGuestBlocked) {
                  const initialLen = hotspot.requests.length;
                  hotspot.requests = hotspot.requests.filter(r => r.user_id !== info.user_id);
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
          // Store globally in Redis and publish update
          await redisPub.hSet("noirme:active_users", info.user_id, JSON.stringify(info));

          // Write to Redis Geo-Spatial Index
          await redisPub.geoAdd("noirme:user_locations", {
            longitude: info.lng,
            latitude: info.lat,
            member: info.user_id,
          });

          // Set temporary session heartbeat key to support self-cleaning spatial indexes
          await redisPub.set(`noirme:user_session:${info.user_id}`, "active", { EX: 60 });

          // Throttle broadcasts to max 1 per 2 seconds per user to avoid flooding
          const now = Date.now();
          const lastTime = lastBroadcastTime.get(info.user_id) || 0;
          if (now - lastTime >= 2000) {
            lastBroadcastTime.set(info.user_id, now);
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
          const now = Date.now();
          const lastTime = lastBroadcastTime.get(info.user_id) || 0;
          if (now - lastTime >= 2000) {
            lastBroadcastTime.set(info.user_id, now);
            broadcastLocationUpdate(info, ws);
          }
        }

        // Auto-sync this client immediately so their map is always fresh and responsive
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
          host_tags: data.host_tags,
          host_gender: data.host_gender,
          host_age: data.host_age,
          hotspotRange: typeof data.hotspotRange === "number" ? data.hotspotRange : undefined,
        };

        if (useRedis && redisPub) {
          await redisPub.hSet("noirme:hotspots", roomId, JSON.stringify(newHotspot));
          
          // Write to Redis Geo-Spatial Index for Hotspots
          await redisPub.geoAdd("noirme:hotspot_locations", {
            longitude: newHotspot.lng,
            latitude: newHotspot.lat,
            member: roomId,
          });

          // Set temporary hotspot session heartbeat key with custom duration TTL
          const ttlSecs = Math.max(10, Math.ceil((newHotspot.expires_at - Date.now()) / 1000));
          await redisPub.set(`noirme:hotspot_session:${roomId}`, "active", { EX: ttlSecs });

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
                username,
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
              JSON.stringify({ type: "join_request_received", roomId, username, request, hotspot })
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
        const sanitizedText = sanitizeInput(text);

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
              text: sanitizedText,
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
      } else if (data.type === "send_wave") {
        const { target_user_id, sender_id, sender_username } = data;
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
    } catch (e) {
      console.error("[noirme] Message handle exception:", e);
    }
  });

  ws.on("close", async () => {
    const info = clientsLocal.get(ws);
    if (info) {
      console.log(`[noirme] Local client closed: ${info.username}`);
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

// Heartbeat check every 20 seconds to clean up dead connections faster
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
}, 20000);

// Boot server
initRedis().then(() => {
  server.listen(PORT, () => {
    console.log(`[noirme] Server running on port ${PORT}`);
  });
});
