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
import { sfx, ensureAudio } from './systems/sfx.js';
import { sprites, spr, sheepPose, memorySprite, envSprites, rockSprite } from './systems/sprites.js';
import { net } from './systems/net.js';
import { renderFP } from './render/first_person.js';

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
    this.mounted = false;
    this.myId = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'p' + Math.random().toString(36).slice(2);
    this.others = new Map();       // id -> { x, y, dir, mounted }
    this.sendTimer = 0;
    net.init((players) => this.syncPlayers(players));
    this.attachInput();
  }

  attachInput() {
    window.addEventListener('keydown', (e) => {
      ensureAudio();
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
        if (!this.keys[e.code]) this.advance = true;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        if (!e.repeat) this.logOpen = !this.logOpen;
      }
      if (e.code === 'KeyM' && !e.repeat) this.tryMountToggle();
      this.keys[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  say(pairs, onDone) {
    this.dialogue.start(pairs, onDone);
  }

  // M key: mount/dismount the Mount Sheep (only after the keeper grants it).
  tryMountToggle() {
    if (this.mode !== 'play' || this.dialogue.active || !this.q.mountOwned) return;
    this.mounted = !this.mounted;
    this.player.speed = this.mounted ? 300 : 170;
    this.player.moving = false;
    sfx.done();
  }

  // Incoming other-player states from the relay.
  syncPlayers(players) {
    const next = new Map();
    for (const pl of players) {
      if (pl.id === this.myId) continue;
      next.set(pl.id, pl);
    }
    this.others = next;
  }

  // One-time world beat when the 5th Memory lands.
  maybeAnnounceSeal() {
    if (this.q.memories >= this.q.required && !this.q.sealAnnounced) {
      this.q.sealAnnounced = true;
      sfx.open();
      this.say([['', 'A low hum fills the world. The seal on the Old Shrine is gone.']]);
    }
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
      if (pressed) { sfx.advance(); this.dialogue.advance(); }
      return;
    }

    this.playTime += dt;

    // Network: push our state at ~20 Hz.
    this.sendTimer += dt;
    if (this.sendTimer > 0.05) {
      this.sendTimer = 0;
      net.send({
        id: this.myId,
        x: this.player.x,
        y: this.player.y,
        dir: { x: this.player.dir.x, y: this.player.dir.y },
        mounted: this.mounted,
        mountId: this.mounted ? 'sheep' : null,
      });
    }

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
        this.say(talkFor(npc.id, this.q), () => {
          rewardFor(npc.id, this.q);
          this.maybeAnnounceSeal();
        });
      } else {
        const wasActive = this.dialogue.active;
        handleHotspot(this, this.near.ref);
        if (this.dialogue.active && !wasActive) {
          const prev = this.dialogue.onDone;
          this.dialogue.onDone = () => {
            if (prev) prev();
            this.maybeAnnounceSeal();
          };
        } else if (!wasActive) {
          this.maybeAnnounceSeal();
        }
      }
    }
  }

  render() {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;

    if (this.mounted && this.q.mountOwned) {
      renderFP(ctx, this, this.others);
    } else {
      ctx.fillStyle = '#7ea54e';
      ctx.fillRect(0, 0, 960, 640);

      this.world.draw(ctx, this);

      // Hotspots.
      for (const hs of this.world.hotspots) {
        this.drawHotspot(ctx, hs);
      }

      // NPCs.
      for (const n of this.world.npcs) {
        drawSheep(ctx, n.px + 20, n.py + 20, false);
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

      // Remote co-op players (white sheep + name).
      for (const o of this.others.values()) {
        drawSheep(ctx, o.x + 13, o.y + 15, false);
        if (o.mounted) {
          ctx.fillStyle = '#c9b458';
          ctx.font = 'bold 10px "Courier New", monospace';
          ctx.fillText('riding', o.x + 13 - 14, o.y + 4);
        }
      }

      this.player.draw(ctx);
    }

    if (this.mode === 'title') this.drawTitle(ctx);
    else {
      drawHud(ctx, this);
      if (this.dialogue.active) drawDialogueBox(ctx, this.dialogue);
    }
    if (this.mode === 'ending') drawEnding(ctx, this);
  }

  drawHotspot(ctx, hs) {
    const t = performance.now();
    const px = hs.px + 20;
    const py = hs.py + 20;
    if (hs.kind === 'memory') {
      const img = memorySprite(hs.item);
      const bob = Math.round(Math.sin(t / 320 + hs.x * 2) * 2);
      ctx.fillStyle = 'rgba(30,20,10,0.22)';
      ctx.fillRect(px - 11, py + 13, 22, 4);
      // floating sparkle platform
      ctx.fillStyle = 'rgba(242,193,78,0.35)';
      ctx.fillRect(px - 9, py + 10 + bob, 18, 2);
      spr(ctx, img, px - img.width / 2, py - img.height / 2 + bob - 4);
      sparkle(ctx, px, py - 16 + bob, t);
    } else if (hs.kind === 'flower') {
      const bob = Math.round(Math.sin(t / 400 + hs.x) * 2);
      envFlower(ctx, px, py + bob, (hs.x + hs.y) % 3);
    } else if (hs.kind === 'rock') {
      spr(ctx, rockSprite((hs.x + hs.y) % 2), px - 12, py - 12);
    } else if (hs.kind === 'altar') {
      const pulse = 1 + Math.sin(t / 260) * 0.25;
      ctx.fillStyle = 'rgba(30,20,10,0.3)';
      ctx.fillRect(px - 16, py + 14, 32, 6);
      ctx.fillStyle = '#8a8f7a';
      ctx.fillRect(px - 14, py - 4, 28, 18);
      ctx.fillStyle = '#6e7362';
      ctx.fillRect(px - 14, py - 4, 28, 3);
      ctx.fillStyle = '#c9b458';
      ctx.beginPath();
      ctx.arc(px, py - 10, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      sparkle(ctx, px, py - 20, t);
    } else if (hs.kind === 'bo') {
      drawSheep(ctx, px, py, false);
    } else if (hs.kind === 'secret') {
      if (hs.id === 'sign') {
        const e = envSprites();
        spr(ctx, e.sign, px - 8, py - 16);
      } else {
        sparkle(ctx, px, py, t);
        sparkle(ctx, px + 8, py - 6, t + 200);
      }
    }
  }

  drawTitle(ctx) {
    ctx.fillStyle = 'rgba(10,12,16,0.9)';
    ctx.fillRect(0, 0, 960, 640);
    // big pixel sheep
    const s = sprites().sheepBlack[0];
    if (s) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(480, 290);
      ctx.scale(4, 4);
      ctx.drawImage(s, -s.width / 2, -s.height / 2 - 10);
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2a2a32';
    ctx.font = 'bold 46px "Courier New", monospace';
    ctx.fillText('B L A C K S H E E', 482, 412);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillText('B L A C K S H E E', 480, 410);
    ctx.fillStyle = '#c9b458';
    ctx.font = '15px "Courier New", monospace';
    ctx.fillText('The only black sheep in a world of white ones.', 480, 444);
    ctx.fillStyle = '#8f97a5';
    ctx.font = '13px "Courier New", monospace';
    ctx.fillText('Collect the five Memories. Help a few weird sheep. Press Enter to begin.', 480, 480);
    ctx.fillStyle = '#f2e9c9';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('[Enter]', 480, 532);
    ctx.textAlign = 'left';
  }
}

// Small orbiting sparkle for collectibles.
function sparkle(ctx, cx, cy, t) {
  const a = t / 300;
  const r = 11;
  for (let i = 0; i < 3; i++) {
    const ang = a + (i * Math.PI * 2) / 3;
    const x = cx + Math.cos(ang) * r;
    const y = cy + Math.sin(ang) * r * 0.6;
    ctx.fillStyle = i % 2 ? '#f2f2f2' : '#f2c14e';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

// Pixel flower (same look as ground flowers) for pickup spots.
function envFlower(ctx, cx, cy, hue) {
  const petals = ['#e86a92', '#f2c14e', '#8fc8e8'][hue];
  ctx.fillStyle = '#3e6b2c';
  ctx.fillRect(cx - 1, cy + 6, 2, 8);
  ctx.fillStyle = petals;
  ctx.fillRect(cx - 5, cy, 4, 4);
  ctx.fillRect(cx + 3, cy, 4, 4);
  ctx.fillRect(cx - 1, cy - 4, 4, 4);
  ctx.fillRect(cx - 1, cy + 4, 4, 4);
  ctx.fillStyle = '#c8be7a';
  ctx.fillRect(cx, cy - 1, 3, 3);
}

// Shared pixel sheep for NPCs, Bo, and the meadow.
function drawSheep(ctx, cx, cy, dark) {
  const t = performance.now();
  const key = dark ? 'sheepBlack' : 'sheepWhite';
  const s = sprites()[key];
  const { img, bob } = sheepPose(s, false, t);
  ctx.fillStyle = 'rgba(30,20,10,0.22)';
  ctx.fillRect(cx - 13, cy + 13, 26, 4);
  spr(ctx, img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2 + bob));
}