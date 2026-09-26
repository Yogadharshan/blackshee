// BLACKSHEE single-process server:
//   1. serves the static game (index.html, style.css, src/**)
//   2. exposes /healthz for platform health checks
//   3. hosts the WebSocket co-op relay on /ws?room=<code>
// One port, no proxy needed. Port comes from $PORT (Railway/Render/Fly) or 8080.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, sep } from 'node:path';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const ROOT = dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Strict allowlist of served paths. Only what the game needs; docs/tools stay private.
function resolvePath(pathname) {
  if (pathname === '/' || pathname === '/index.html') return join(ROOT, 'index.html');
  if (pathname === '/style.css') return join(ROOT, 'style.css');
  if (pathname.startsWith('/src/')) {
    const file = normalize(join(ROOT, pathname));
    if (file.startsWith(join(ROOT, 'src') + sep)) return file;
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  const file = resolvePath(url.pathname);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('404');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('500');
  }
});

// --- WebSocket co-op relay: rooms by name, broadcast player state only. ---
// No game logic lives here — the world stays authoritative in each client.
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map(); // room -> { sockets:Set, states:Map(id -> state) }

function roomOf(req) {
  // NOTE: server-side ws.url is undefined; the request URL lives on req.url.
  const param = new URLSearchParams((req.url || '').split('?')[1] || '');
  return (param.get('room') || 'demo').trim().toUpperCase().slice(0, 12) || 'demo';
}

wss.on('connection', (ws, req) => {
  const room = roomOf(req);
  if (!rooms.has(room)) rooms.set(room, { sockets: new Set(), states: new Map(), shared: { discovered: false, sixth: false } });
  const r = rooms.get(room);
  r.sockets.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

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

server.listen(PORT, () => {
  console.log(`blackshee on http://localhost:${PORT} (ws relay on /ws)`);
});

// Reap dead sockets (killed tabs/browsers) so ghost players don't linger in a room.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* ignore */ }
  }
}, 15000);
wss.on('close', () => clearInterval(heartbeat));