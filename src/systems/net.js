// Client-side networking: pairs two tabs via the ws relay.
// Never lets the network break the game — offline/solo play keeps working.
let ws = null;
let myId = null;
let connected = false;

export function netInit(onPlayers) {
  if (typeof location === 'undefined' || typeof WebSocket === 'undefined') return;
  const room = new URLSearchParams(location.search).get('room') || 'demo';
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  try {
    ws = new WebSocket(`${proto}://${location.hostname || 'localhost'}:8081?room=${room}`);
  } catch { return; }

  ws.onopen = () => { connected = true; };
  ws.onclose = () => { connected = false; };
  ws.onerror = () => { connected = false; };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.t === 'players') onPlayers(msg.players || []);
    } catch { /* ignore bad frames */ }
  };
}

export function netSend(state) {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify({ t: 'state', ...state }));
  } catch { /* ignore */ }
}

export function netLeave() {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify({ t: 'leave', id: myId })); } catch { /* ignore */ }
  try { ws.close(); } catch { /* ignore */ }
}

export const net = { init: netInit, send: netSend, leave: netLeave };