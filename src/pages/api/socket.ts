import type { NextApiRequest, NextApiResponse } from "next";
import type { Socket } from "net";
import type { Server as HTTPServer } from "http";
import type { WebSocket as WSType, WebSocketServer as WSSType } from "ws";

// Use require to avoid webpack ESM/CJS bundling issues with 'ws'
// (ws is externalized in next.config.ts so this runs as native Node require)
const { WebSocketServer } = require("ws") as typeof import("ws");

type ServerWithWss = HTTPServer & {
  _noirmeWss?: WSSType;
  _noirmeUpgrade?: boolean;
};

type ResWithSocket = NextApiResponse & {
  socket: Socket & { server: ServerWithWss };
};

// ── Global state (survives Next.js HMR / hot reload in dev) ──────────────────
declare global {
  var _noirmeClients: Map<WSType, any> | undefined;
  var _noirmeIntents: Map<string, any> | undefined;
}
if (!global._noirmeClients) global._noirmeClients = new Map<WSType, any>();
if (!global._noirmeIntents) global._noirmeIntents = new Map<string, any>();

const clients = global._noirmeClients;
const intents = global._noirmeIntents;

// Clean expired intents every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, intent] of intents.entries()) {
    if (intent.expires_at < now) intents.delete(id);
  }
}, 5 * 60 * 1000);

function broadcast(wss: WSSType, message: object) {
  const str = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(str);
    }
  });
}

function setupWss(server: ServerWithWss): WSSType {
  if (server._noirmeWss) return server._noirmeWss;

  console.log("[noirme] Creating WebSocket server…");
  const wss = new WebSocketServer({ noServer: true }) as WSSType;
  server._noirmeWss = wss;

  // Register the HTTP upgrade handler exactly once
  if (!server._noirmeUpgrade) {
    server._noirmeUpgrade = true;
    server.on("upgrade", (req, socket, head) => {
      if (req.url?.startsWith("/api/socket")) {
        (wss as any).handleUpgrade(req, socket, head, (ws: WSType) => {
          (wss as any).emit("connection", ws, req);
        });
      }
    });
  }

  (wss as any).on("connection", (client: WSType) => {
    clients.set(client, { last_seen: Date.now() });

    // Send current state snapshot to new client
    const currentUsers = Array.from(clients.values()).filter((c) => c.lat && c.lng);
    const currentIntents = Array.from(intents.values()).filter((i) => i.expires_at > Date.now());
    client.send(JSON.stringify({ type: "sync", users: currentUsers, intents: currentIntents }));

    client.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());

        if (data.type === "location_update") {
          const prev = clients.get(client) || {};
          const updated = {
            ...prev,
            user_id: data.user_id,
            username: data.username,
            vibeEmoji: data.vibeEmoji || prev.vibeEmoji || "☕",
            avatar_url: data.avatar_url || prev.avatar_url || "",
            lat: data.lat,
            lng: data.lng,
            last_seen: Date.now(),
          };
          clients.set(client, updated);
          broadcast(wss, { type: "location_update", data: updated });
        } else if (data.type === "new_intent") {
          const intent = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            user_id: data.user_id,
            username: data.username,
            title: data.title,
            lat: data.lat,
            lng: data.lng,
            expires_at: Date.now() + 60 * 60 * 1000,
          };
          intents.set(intent.id, intent);
          broadcast(wss, { type: "new_intent", data: intent });
        }
      } catch (e) {
        console.error("[noirme] Bad message:", e);
      }
    });

    client.on("close", () => {
      const info = clients.get(client);
      if (info?.user_id) {
        broadcast(wss, { type: "user_disconnected", user_id: info.user_id });
      }
      clients.delete(client);
    });
  });

  return wss;
}

export default function handler(req: NextApiRequest, res: ResWithSocket) {
  try {
    setupWss(res.socket.server);
    res.status(200).end();
  } catch (err) {
    console.error("[noirme] Socket init error:", err);
    res.status(500).json({ error: String(err) });
  }
}
