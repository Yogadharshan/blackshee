// Headless tests for the networking reconnect UX. Mocks location/WebSocket and
// drives the real net.js state machine: drop → reconnecting → auto-retry the
// same room → open, and a manual leave must stop retries.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class FakeWS {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWS.instances.push(this);
  }
  send(d) { this.sent.push(d); }
  close() { this.readyState = 3; }
  open() { this.readyState = 1; this.onopen && this.onopen(); }
  drop() { this.readyState = 3; this.onclose && this.onclose({}); }
}

globalThis.location = { protocol: 'http:', host: 'test.local', search: '' };
globalThis.WebSocket = FakeWS;
globalThis.window = { addEventListener: () => {} };

const { net } = await import('../src/systems/net.js');

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const statuses = [];
const opens = [];
net.init(() => {}, (s, info) => { statuses.push(s); if (s === 'open') opens.push(!!(info && info.recovered)); });
check(net.status === 'offline' && !net.connected, 'no room → offline');

net.join('abc');
check(net.status === 'connecting' && FakeWS.instances.length === 1, 'join → dialing');
check(FakeWS.instances[0].url.includes('room=ABC'), 'room code is normalized (uppercased)');

FakeWS.instances[0].open();
check(net.connected === true && net.status === 'open', 'socket open → connected');

// Unexpected drop → backoff retry, same room.
FakeWS.instances[0].drop();
check(net.connected === false && net.status === 'reconnecting', 'drop → reconnecting');
await sleep(750);
check(FakeWS.instances.length === 2, 'auto-retried after the backoff');
check(FakeWS.instances[1].url.includes('room=ABC'), 'retry keeps the same room');

FakeWS.instances[1].open();
check(net.status === 'open' && net.connected === true, 'reconnect → open');
check(statuses.includes('reconnecting') && statuses.includes('open'), 'status callback fired');
check(opens[0] === false && opens[1] === true, 'reconnect is flagged as recovered (first open is not)');

// Repeated drops must escalate the attempt counter.
FakeWS.instances[1].drop();
check(net.attempts >= 1, 'attempt counter tracks retries');

// Manual leave stops everything.
net.leave();
check(net.status === 'offline' && net.room === '' && net.connected === false, 'leave → offline, room cleared');
const afterLeave = FakeWS.instances.length;
await sleep(800);
check(FakeWS.instances.length === afterLeave, 'leave stops further retries');

console.log(fail === 0 ? '\nNET RECONNECT PASS' : `\nNET RECONNECT FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
