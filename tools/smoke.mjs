// Headless playthrough: drives the Game object with stubbed canvas/window.
// Verifies: movement isn't required, but doors, pickups, quests, gate, ending are.
import { Game } from '../src/game.js';
import { TILE } from '../src/data/world.js';

const noop = () => {};
const ctx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return (s) => ({ width: s.length * 8 });
    if (k === 'canvas') return { width: 960, height: 640 };
    return noop;
  },
  set: () => true,
});
globalThis.window = { addEventListener: noop };

const g = new Game(ctx);
let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

const teleport = (area, x, y) => {
  g.world.setArea(area);
  g.player.x = x * TILE + 7;
  g.player.y = y * TILE + 5;
  g.noDoorUntil = 0;
};

// step through an open dialogue until it closes
const finishDialogue = () => {
  let guard = 0;
  while (g.dialogue.active && guard < 20) {
    g.advance = true;
    g.update(1 / 60);
    guard++;
  }
};

check(g.mode === 'title', 'starts in title');
g.advance = true; g.update(1 / 60);
check(g.mode === 'play', 'Enter starts the game');

// village west door -> farm
teleport('village', 1, 8);
g.update(1 / 60);
check(g.world.area === 'farm', 'village > farm via west door');

// farm flower
teleport('farm', 16, 5);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.flowers === 1, 'farm flower picked');

// back to village via farm east door
teleport('farm', 22, 8);
g.update(1 / 60);
check(g.world.area === 'village', 'farm > village via east door');

// village flower
teleport('village', 10, 5);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.flowers === 2, 'village flower picked');

// meadow door + meadow flower + toy + photo + back
teleport('village', 22, 8);
g.update(1 / 60);
check(g.world.area === 'meadow', 'village > meadow via east door');
teleport('meadow', 6, 6);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.flowers === 3, 'meadow flower picked (3/3)');
teleport('meadow', 21, 12);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.memories === 1, 'wooden toy = memory 1');
teleport('meadow', 8, 4);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.memories === 2, 'photograph = memory 2');

// talk to Baaabara -> reward red flower memory
teleport('meadow', 1, 8); g.update(1 / 60); // meadow > village
teleport('village', 15, 4);
g.advance = true; g.update(1 / 60);
check(g.dialogue.active, 'Baaabara dialogue opens');
check(g.q.side.flowers === 'done', 'flower quest completes on first hand-in');
finishDialogue();
check(g.q.flowersGiven && g.q.memories === 3, 'flower quest done, red flower = memory 3');

// bell in village
teleport('village', 19, 7);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.memories === 4, 'bell = memory 4');

// MOUNT: talk Elder (starts quest), Mount Keeper gifts the Mount Sheep
teleport('village', 14, 9);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.elderTalked, 'elder talk sets elderTalked');

// ROOM UI: create-a-room path
g.joinRoom('XYZQP');
check(g.roomCode === 'XYZQP' && g.roomUI.joined, 'room code created/joined via UI');
teleport('village', 1, 8); g.update(1 / 60); // village > farm
teleport('farm', 12, 11);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.mountOwned, 'mount keeper gifts Mount Sheep after elder talk');
check(g.mounted === false, 'player starts unmounted');
g.tryMountToggle();
check(g.mounted === true && g.player.speed === 300, 'M toggles mounted + faster speed');
g.tryMountToggle();
check(g.mounted === false && g.player.speed === 170, 'M dismount restores speed');

// rock sidequest: pick rock, talk Rock Sheep
teleport('village', 17, 11);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.hasRock, 'rock picked');
teleport('village', 20, 12);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.rockGiven && g.q.side.rock === 'done', 'rock quest complete');
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.rockGiven, 'rock sheep post-dialogue');

// forest + ribbon (memory 5) via north door
teleport('village', 12, 1);
g.update(1 / 60);
check(g.world.area === 'forest', 'village > forest via north door');
teleport('forest', 9, 9);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.memories === 5, 'ribbon = memory 5 (5/5)');

// boFound flag + friend sidequest
teleport('forest', 2, 6);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.boFound, 'Bo found');
teleport('forest', 12, 14); g.update(1 / 60); // forest > village
teleport('village', 12, 1); g.update(1 / 60); // village > forest
teleport('forest', 12, 14); g.update(1 / 60);
teleport('village', 12, 1); g.update(1 / 60);
teleport('village', 1, 8); g.update(1 / 60); // village > farm
teleport('farm', 17, 10);
g.advance = true; g.update(1 / 60); finishDialogue();
check(g.q.side.friend === 'done', 'friend sidequest complete');

// SECRET AREA: co-op discovery via relay shared state
teleport('forest', 12, 14); g.update(1 / 60); // farm... no; ensure forest
teleport('forest', 5, 13);
check(g.inSecretZone(), 'secret zone detects player near tree');
g.syncPlayers([], { discovered: true, sixth: false });
finishDialogue();
check(g.q.secret.discovered, 'shared discovery applied');
// tree flips to doorway and opens into Nowhere
g.noDoorUntil = 0;
g.update(1 / 60);
check(g.world.area === 'hidden', 'secret tree becomes a doorway into Nowhere');
// Sixth Memory from the Sheep Who Knows Too Much
teleport('hidden', 12, 8);
for (let i = 0; i < 5; i++) { g.advance = true; g.update(1 / 60); finishDialogue(); }
check(g.q.secret.sixth, 'sixth memory granted on 5th talk');
g.syncPlayers([], { discovered: true, sixth: true });
check(g.q.secret.sixth, 'sixth memory is shared state');

// gate sealed at 0-4, open at 5
teleport('farm', 22, 8); g.update(1 / 60); // farm > village
teleport('village', 12, 1); g.update(1 / 60); // village > forest
teleport('forest', 22, 8);
g.noDoorUntil = 0;
g.update(1 / 60);
check(g.world.area === 'shrine', `gate opens at 5/5 (memories=${g.q.memories})`);

// bonus: gate sealed check at <5
g.q.memories = 4;
teleport('shrine', 1, 8); g.update(1 / 60);
teleport('forest', 22, 8); g.noDoorUntil = 0;
g.update(1 / 60);
check(g.world.area === 'forest' && g.dialogue.active, 'gate stays sealed below 5/5');
finishDialogue();
g.q.memories = 5;

// ending: enter shrine, touch altar
teleport('forest', 22, 8); g.noDoorUntil = 0; g.update(1 / 60);
teleport('shrine', 12, 7);
g.advance = true; g.update(1 / 60);
check(g.dialogue.active, 'altar dialogue opens');
finishDialogue();
check(g.mode === 'ending', 'ending reached');

console.log(fail === 0 ? '\nPLAYTHROUGH PASS' : `\n${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);