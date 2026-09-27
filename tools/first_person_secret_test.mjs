// Headless checks for first-person wall coverage of the secret tree.
// The bug: 'S' (secret tree) is collision-solid but was missing from the
// raycaster wall set, so it rendered as an invisible blocker.
import { isWallTile } from '../src/render/first_person.js';
import { LEGEND } from '../src/data/world.js';

let fail = 0;
const check = (cond, msg) => { console.log((cond ? 'ok  ' : 'FAIL') + ' ' + msg); if (!cond) fail++; };

// The secret tree must be a wall in first-person, exactly matching its collision.
check(LEGEND['S'].solid === true, 'secret tree is collision-solid in the legend');
check(isWallTile('S') === true, 'secret tree renders as a first-person wall');

// Normal solid tiles and walkable tiles keep their behavior.
check(['#', 'B', 'F', 'R', 'W'].every((c) => isWallTile(c)), 'existing solid tiles still block the view');
check(['.', '-', 'D', 'X'].every((c) => isWallTile(c) === false), 'walkable tiles (doors, gates, ground) never block the view');

// Discovered secret tree becomes a walkable doorway.
check(isWallTile('D') === false, 'the revealed doorway stays walkable');

console.log(fail === 0 ? '\nFIRST-PERSON SECRET PASS' : `\nFIRST-PERSON SECRET FAIL (${fail})`);
process.exit(fail === 0 ? 0 : 1);
