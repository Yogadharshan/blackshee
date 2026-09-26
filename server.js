// Minimal WebSocket relay: rooms by name, broadcast player state only.
// No game logic lives here — the world stays authoritative in each client.
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8081;
const wss = new WebSocketServer({ port: PORT });

const rooms = new Map(); // room -> { sockets:Set, states:Map(id -> state) }

function roomOf(ws) {
  const param = new URLSearchParams((ws.url || '').split('?')[1]);
  return param.get('room') || 'demo';
}

wss.on('connection', (ws, req) => {
  const room = roomOf(ws);
  if (!rooms.has(room)) rooms.set(room, { sockets: new Set(), states: new Map(), shared: { discovered: false, sixth: false }, zone: new Map() });
  const r = rooms.get(room);
  r.sockets.add(ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (msg.t === 'state' && msg.id) {
      r.states.set(msg.id, {
        id: msg.id, x: msg.x, y: msg.y, dir: msg.dir, mounted: msg.mounted,
        mountId: msg.mountId || null, __ws: ws,
        z: msg.secretIn ? 1 : 0, p: msg.poke ? 1 : 0, sx: msg.sixth ? 1 : 0,
      });
      const all = [...r.states.values()];
      if (all.length >= 2 && !r.shared.discovered) {
        const both = all.every((s) => s.z === 1 && s.p === 1);
        if (both) r.shared.discovered = true;
      }
      if (all.some((s) => s.sx === 1)) r.shared.sixth = true;
      broadcast(r);
    } else if (msg.t === 'leave' && msg.id) {
      r.states.delete(msg.id);
      broadcast(r);
    }
  });

  ws.on('close', () => {
    r.sockets.delete(ws);
    for (const [id, s] of r.states) {
      if (s.__ws === ws) r.states.delete(id);
    }
    broadcast(r);
    if (r.sockets.size === 0) rooms.delete(room);
  });
});

function broadcast(r) {
  const msg = JSON.stringify({
    t: 'players',
    players: [...r.states.values()].map(({ __ws, z, p, sx, ...rest }) => rest),
    shared: r.shared,
  });
  for (const s of r.sockets) {
    s.send(msg);
  }
}

wss.on('listening', () => console.log(`blackshee relay on ws://localhost:${PORT}`));