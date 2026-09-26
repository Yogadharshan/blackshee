import { World } from './systems/world.js';
import { Player } from './systems/player.js';
import { Dialogue } from './systems/dialogue.js';
import { createQuestState, talkFor, rewardFor } from './systems/quests.js';
import { handleHotspot } from './systems/collectibles.js';
import { nearestInteractable } from './systems/interactions.js';
import { drawHud } from './ui/hud.js';
import { drawDialogueBox } from './ui/dialogue_box.js';
import { drawEnding } from './ui/ending.js';
import { TILE, START } from './data/world.js';
import { DIALOGUE } from './data/dialogue.js';

const HOTSPOT_COLORS = {
  memory: '#f2c14e',
  flower: '#e86a92',
  rock: '#9a9a9a',
  altar: '#c9b458',
  bo: '#f5f2e8',
  secret: '#bfe5f0',
};

export class Game {
  constructor(ctx) {
    this.ctx = ctx;
    this.world = new World();
    this.q = createQuestState();
    this.player = new Player(START.tileX * TILE + 7, START.tileY * TILE + 5);
    this.dialogue = new Dialogue();
    this.mode = 'title'; // title | play | ending
    this.keys = {};
    this.advance = false;   // E/Enter/Space pressed edge
    this.logOpen = false;
    this.near = null;
    this.playTime = 0;
    this.noDoorUntil = 0;
    this.attachInput();
  }

  attachInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
        if (!this.keys[e.code]) this.advance = true;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!e.repeat) this.logOpen = !this.logOpen;
      }
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  say(pairs, onDone) {
    this.dialogue.start(pairs, onDone);
  }

  update(dt) {
    // Title: Enter starts.
    if (this.mode === 'title') {
      if (this.advance) { this.mode = 'play'; this.advance = false; }
      this.advance = false;
      return;
    }
    // Ending: R restarts.
    if (this.mode === 'ending') {
      if (this.keys['KeyR']) location.reload();
      this.advance = false;
      return;
    }

    // Play mode.
    const pressed = this.advance;
    this.advance = false;
    if (this.dialogue.active) {
      if (pressed) this.dialogue.advance();
      return;
    }

    this.playTime += dt;

    // Movement (NPC bodies block like walls).
    const blockers = this.world.npcs.map((n) => ({ px: n.px, py: n.py, w: 32, h: 32 }));
    this.player.update(this.keys, this.world.tiles, blockers, dt);

    // Doors.
    const now = performance.now() / 1000;
    if (now > this.noDoorUntil) {
      const tx = Math.floor(this.player.cx / TILE);
      const ty = Math.floor(this.player.cy / TILE);
      const door = this.world.doorAt(tx, ty);
      if (door) {
        if (door.sealed && this.q.memories < this.q.required) {
          this.say(DIALOGUE.gate_sealed);
        } else {
          this.world.setArea(door.to);
          this.player.x = door.tx * TILE + 7;
          this.player.y = door.ty * TILE + 5;
          this.noDoorUntil = now + 0.35;
        }
      }
    }

    // Interaction: pressing E near someone/something.
    this.near = nearestInteractable(this);
    if (pressed && this.near) {
      if (this.near.type === 'npc') {
        const npc = this.near.ref;
        this.say(talkFor(npc.id, this.q), () => rewardFor(npc.id, this.q));
      } else {
        handleHotspot(this, this.near.ref);
      }
    }
  }

  render() {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#7ea54e';
    ctx.fillRect(0, 0, 960, 640);

    this.world.draw(ctx);

    // Hotspots.
    for (const hs of this.world.hotspots) {
      this.drawHotspot(ctx, hs);
    }

    // NPCs.
    for (const n of this.world.npcs) {
      drawSheep(ctx, n.px + 20, n.py + 20, false, 0, 0);
      if (this.near && this.near.type === 'npc' && this.near.ref === n) {
        ctx.fillStyle = '#f2e9c9';
        ctx.font = 'bold 12px "Courier New", monospace';
        const w = ctx.measureText(n.name).width;
        ctx.fillStyle = 'rgba(20,22,26,0.8)';
        ctx.fillRect(n.px + 20 - w / 2 - 6, n.py - 16, w + 12, 18);
        ctx.fillStyle = '#f2e9c9';
        ctx.fillText(n.name, n.px + 20 - w / 2, n.py - 2);
      }
    }

    this.player.draw(ctx);

    if (this.mode === 'title') this.drawTitle(ctx);
    else {
      drawHud(ctx, this);
      if (this.dialogue.active) drawDialogueBox(ctx, this.dialogue);
    }
    if (this.mode === 'ending') drawEnding(ctx, this);
  }

  drawHotspot(ctx, hs) {
    const c = HOTSPOT_COLORS[hs.kind] || '#fff';
    const pulse = 1 + Math.sin(performance.now() / 300 + hs.id.length) * 0.15;
    const px = hs.px + 20;
    const py = hs.py + 20;
    if (hs.kind === 'memory' || hs.kind === 'secret') {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (hs.kind === 'flower') {
      ctx.fillStyle = '#e86a92';
      ctx.beginPath(); ctx.arc(px - 4, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 4, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py - 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px, py + 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    } else if (hs.kind === 'rock') {
      ctx.fillStyle = '#9a9a9a';
      ctx.beginPath(); ctx.ellipse(px, py, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7c7c7c';
      ctx.beginPath(); ctx.ellipse(px - 3, py - 2, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (hs.kind === 'altar') {
      ctx.fillStyle = '#8a8f7a';
      ctx.fillRect(px - 14, py - 6, 28, 22);
      ctx.fillStyle = '#c9b458';
      ctx.beginPath(); ctx.arc(px, py - 10, 6 * pulse, 0, Math.PI * 2); ctx.fill();
    } else if (hs.kind === 'bo') {
      drawSheep(ctx, px, py, false, 0, 0);
    }
  }

  drawTitle(ctx) {
    ctx.fillStyle = 'rgba(10,12,16,0.88)';
    ctx.fillRect(0, 0, 960, 640);
    drawSheep(ctx, 480, 300, true, 0, 0);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f2f2f2';
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.fillText('B L A C K S H E E', 480, 410);
    ctx.fillStyle = '#c9b458';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('The only black sheep in a world of white ones.', 480, 442);
    ctx.fillStyle = '#8f97a5';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('Collect the five Memories. Help a few weird sheep. Press Enter to begin.', 480, 480);
    ctx.fillStyle = '#f2e9c9';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('[Enter]', 480, 530);
    ctx.textAlign = 'left';
  }
}

// Shared chunky sheep renderer. dark = player (black wool).
function drawSheep(ctx, cx, cy, dark, dx, dy) {
  const body = dark ? '#2b2b33' : '#f5f2e8';
  const head = dark ? '#33333d' : '#7a6a5a';
  const leg = dark ? '#1c1c22' : '#b8b0a0';
  const eye = dark ? '#f2f2f2' : '#1c1c22';
  const wool = dark ? '#2b2b33' : '#ece7d6';

  ctx.fillStyle = leg;
  ctx.fillRect(cx - 10 + dx, cy + 8 + dy, 5, 8);
  ctx.fillRect(cx + 5 + dx, cy + 8 + dy, 5, 8);

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx + dx, cy + 2 + dy, 13, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  const hx = cx + dx * 0 + (dx || -6);
  const hy = cy + dy * 0 + (dy || -6);
  ctx.fillStyle = wool;
  ctx.beginPath();
  ctx.ellipse(hx + 6, hy - 2, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(cx + 10 + dx, cy - 2 + dy, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(cx + 13 + dx, cy - 4 + dy, 1.8, 0, Math.PI * 2);
  ctx.fill();
}