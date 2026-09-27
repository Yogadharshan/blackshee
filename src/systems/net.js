// Client-side networking: pairs two tabs via the ws relay.
// Never lets the network break the game — offline/solo play keeps working.
//
// Reconnect UX: an unexpected drop auto-retries the *same* room with backoff and
// reports status, so the UI can show "Reconnecting…" instead of silently losing
// the partner. A manual leave stops retries. Reconnect never blocks gameplay.
let ws = null;
let room = '';
let connected = false;
let status = 'offline'; // offline | connecting | open | reconnecting
let attempts = 0;
let retryTimer = null;
let manualClose = false;
let recovering = false; // true when the current connect attempt is a retry
let onPlayers = null;
let onStatus = null;

const RETRY_BASE_MS = 500;
const RETRY_MAX_MS = 5000;

function reportStatus(info) {
  if (!onStatus) return;
  try { onStatus(status, { room, attempts, ...(info || {}) }); } catch { /* a listener error must not break net */ }
}

function setStatus(next, info) {
  if (status === next) { reportStatus(info); return; }
  status = next;
  reportStatus(info);
}

function online() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

// Exponential backoff, capped. Reuses the current room; skipped after a leave.
function scheduleReconnect() {
  if (manualClose || !room || retryTimer) return;
  attempts += 1;
  recovering = true;
  setStatus('reconnecting');
  const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempts - 1));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    open(room, true);
  }, delay);
}

function open(roomCode, isRetry = false) {
  closeRaw();
  manualClose = false;
  if (!isRetry) recovering = false;
  room = (roomCode || 'demo').trim().toUpperCase().slice(0, 12) || 'demo';

  if (typeof location === 'undefined' || typeof WebSocket === 'undefined') { setStatus('offline'); return; }
  if (location.protocol === 'file:') { setStatus('offline'); return; } // no relay over file://
  if (!online()) { scheduleReconnect(); return; }

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let socket = null;
  try {
    // Same-origin: whoever served the page hosts the relay at /ws. Works in
    // dev (node server.js) and in production (https + wss) with no port config.
    socket = new WebSocket(`${proto}://${location.host}/ws?room=${room}`);
  } catch { socket = null; }
  if (!socket) { scheduleReconnect(); return; }
  ws = socket;
  setStatus('connecting');

  socket.onopen = () => {
    connected = true;
    attempts = 0;
    const wasRecovering = recovering;
    recovering = false;
    setStatus('open', { recovered: wasRecovering });
  };
  socket.onclose = () => {
    connected = false;
    if (manualClose) { setStatus('offline'); return; }
    scheduleReconnect();
  };
  socket.onerror = () => { connected = false; };
  socket.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.t === 'players' && onPlayers) onPlayers(msg.players || [], msg.shared || { discovered: false, sixth: false });
    } catch { /* ignore bad frames */ }
  };
}

function closeRaw() {
  if (ws) {
    try {
      ws.onopen = null; ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close();
    } catch { /* ignore */ }
  }
  ws = null;
  connected = false;
}

export function netInit(cb, statusCb) {
  onPlayers = cb;
  if (statusCb) onStatus = statusCb;
  const start = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('room') || '';
  if (start) open(start);
  else reportStatus();
  if (typeof window !== 'undefined' && window.addEventListener) {
    // Coming back online: retry immediately instead of waiting out the backoff.
    window.addEventListener('online', () => {
      if (manualClose || !room || connected) return;
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      attempts = 0;
      recovering = true;
      open(room, true);
    });
  }
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
  manualClose = true;
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  if (ws && ws.readyState === 1) {
    try { ws.send(JSON.stringify({ t: 'leave' })); } catch { /* ignore */ }
  }
  closeRaw();
  room = '';
  attempts = 0;
  recovering = false;
  setStatus('offline');
}

export const net = {
  init: netInit,
  join: netJoin,
  send: netSend,
  leave: netLeave,
  get room() { return room; },
  get connected() { return connected; },
  get status() { return status; },
  get attempts() { return attempts; },
};
