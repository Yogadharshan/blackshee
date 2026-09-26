// Client-side networking: pairs two tabs via the ws relay.
// Never lets the network break the game — offline/solo play keeps working.
let ws = null;
let room = '';
let connected = false;
let onPlayers = null;

function open(roomCode) {
  closeRaw();
  room = (roomCode || 'demo').trim().toUpperCase().slice(0, 12) || 'demo';
  if (typeof location === 'undefined' || typeof WebSocket === 'undefined') return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  try {
    ws = new WebSocket(`${proto}://${location.hostname || 'localhost'}:8081?room=${room}`);
  } catch { ws = null; return; }

  ws.onopen = () => { connected = true; };
  ws.onclose = () => { connected = false; };
  ws.onerror = () => { connected = false; };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.t === 'players' && onPlayers) onPlayers(msg.players || []);
    } catch { /* ignore bad frames */ }
  };
}

function closeRaw() {
  if (ws) {
    try { ws.onclose = null; ws.close(); } catch { /* ignore */ }
  }
  ws = null;
  connected = false;
}

export function netInit(cb) {
  onPlayers = cb;
  const start = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('room') || '';
  if (start) open(start);
}

export function netJoin(roomCode) {
  open(roomCode);
}

export function netSend(state) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify({ t: 'state', ...state }));
  } catch { /* ignore */ }
}

export function netLeave() {
  closeRaw();
}

export const net = {
  init: netInit,
  join: netJoin,
  send: netSend,
  leave: netLeave,
  get room() { return room; },
  get connected() { return connected; },
};