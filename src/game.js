import { World } from './systems/world.js';
import { Player } from './systems/player.js';
import { Dialogue } from './systems/dialogue.js';
import { createQuestState, talkFor, rewardFor } from './systems/quests.js';
import { handleHotspot, dialogLines } from './systems/collectibles.js';
import { hasFragment, recordFragment, choose, hasChoice } from './systems/story.js';
import { fragmentFor } from './data/npc_fragments.js';
import { CHOICES, isAllowedOption } from './data/choices.js';
import { nearestInteractable } from './systems/interactions.js';
import { drawHud } from './ui/hud.js';
import { drawDialogueBox, drawChoiceBox } from './ui/dialogue_box.js';
import { drawEnding } from './ui/ending.js';
import { TILE, START } from './data/world.js';
import { DIALOGUE } from './data/dialogue.js';
import { sfx, ensureAudio } from './systems/sfx.js';
import { sprites, spr, sheepPose, memorySprite, envSprites, rockSprite, photographSprite } from './systems/sprites.js';
import { net } from './systems/net.js';
import { PERSONAS, INTENT_LABELS } from './data/npc_personas.js';
import { buildContext } from './systems/npc_context.js';
import { npcDialogue } from './systems/npc_dialogue.js';
import { drawAskMenu } from './ui/ask_menu.js';
import { hasSave, loadSave, writeSave, clearSave, applySave } from './systems/save.js';

// Remote-player presentation tuning. The network position stays authoritative;
// these only affect how the remote sheep is drawn, never simulation or collision.
//   REMOTE_SMOOTH_TAU  — easing time constant (seconds) toward the last packet.
//                        Smaller = snappier, larger = smoother/laggier.
//   REMOTE_SNAP_DIST   — a jump larger than this is treated as a teleport
//                        (area change / reconnect) and shown without easing, so
//                        nobody slides across the map from a stale position.
const REMOTE_SMOOTH_TAU = 0.09;
const REMOTE_SNAP_DIST = 96;

// Identity shown above the remote player. The protocol carries no display name,
// so use one minimal deterministic label rather than expanding identity.
export function remoteTagText() {
  return 'Black Sheep';
}

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
    // Portal/transition guard (per player — each client owns its own player).
    // A door only fires after the player has stepped OFF every door tile, so
    // arriving on a destination portal can't bounce you straight back.
    this.portalArmed = true;     // re-armed once the player is not on a door tile
    this.portalLocked = false;   // true during/just after a transition
    this.portalLockUntil = 0;    // grace timestamp after arriving in a new map
    this.mounted = false;
    this.myId = (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
      ? globalThis.crypto.randomUUID()
      : 'p' + Math.random().toString(36).slice(2);
    this.others = new Map();       // id -> { x, y, dir, mounted }
    this.sendTimer = 0;
    this.secretPoke = false;
    this.revealShown = false;
    // Phase 6C staging for the Baa sequence (encounter -> reveal). Pure
    // presentation: transient, never persisted, no input or state change.
    this.stageBaa = false;     // the Baa sequence is actively staged (dim + body)
    this.baaStageAt = 0;       // performance.now() when staging began (fade-in)
    this.baaRevealAt = -1;     // line index inside the sequence where the reveal begins
    this.roomUI = { active: false, code: '', joined: false };
    this.roomCode = '';
    // Co-op connection health (net.js reports connecting/open/reconnecting).
    this.netStatus = net.status;
    this.netFlash = 0;
    // Single-player save: offer Continue on the title if one exists.
    this.hasSave = hasSave();
    this.saveTimer = 0;
    // Seconds left on the "Saved" blip (only meaningful saves flash, not autosave).
    this.saveFlash = 0;
    // Guided NPC conversation (Phase 2). Modal chooser shown after an NPC's
    // authored opening dialogue; wording only, never mutates game state.
    this.ask = { active: false, npcId: null, npcName: '', intents: [], index: 0, answer: null, answerIntent: null, thinking: false };
    net.init(
      (players, shared) => this.syncPlayers(players, shared),
      (status, info) => this.onNetStatus(status, info),
    );
    this.roomCode = net.room || this.roomCode;
    // Safety net: keep transmitting even if rAF is paused (backgrounded tab).
    // Sends on the title screen too, so a player who has joined a room but not
    // started yet still shows up for the other player. (net.send no-ops offline.)
    this.netTimer = setInterval(() => {
      this.sendState();
    }, 120);
    this.attachInput();
  }

  attachInput() {
    window.addEventListener('keydown', (e) => {
      ensureAudio();

      // Room-code entry on the title screen. G = create a fresh code and join.
      if (this.mode === 'title' && this.roomUI.active) {
        e.preventDefault();
        if (e.key === 'Escape') {
          this.roomUI.active = false;
        } else if (e.key === 'Enter') {
          // Empty field = create a fresh room; typed text = join that room.
          this.joinRoom(this.roomUI.code.length ? this.roomUI.code : newRoomCode());
        } else if (e.key === 'Backspace') {
          this.roomUI.code = this.roomUI.code.slice(0, -1);
        } else if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
          this.roomUI.code = (this.roomUI.code + e.key.toUpperCase()).slice(0, 12);
        }
        return;
      }

      if (e.code === 'KeyC' && !e.repeat && this.mode === 'title' && !this.roomUI.active) {
        e.preventDefault();
        this.roomUI.active = true;
        this.roomUI.code = this.roomCode;
        this.roomUI.joined = false;
        return;
      }

      // Title: N discards the save and starts a fresh run.
      if (e.code === 'KeyN' && !e.repeat && this.mode === 'title' && !this.roomUI.active && this.hasSave) {
        e.preventDefault();
        clearSave();
        this.hasSave = false;
        return;
      }

      // Guided question chooser owns the keyboard until the player leaves.
      if (this.ask.active) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.closeAsk();
          return;
        }
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          if (!e.repeat) this.moveAsk(-1);
          return;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          if (!e.repeat) this.moveAsk(1);
          return;
        }
        if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (!e.repeat) this.askQuestion();
          this.keys[e.code] = true;
          return;
        }
        const n = /^[1-9]$/.test(e.key) ? Number(e.key) : 0;
        if (n && n <= this.ask.intents.length) {
          e.preventDefault();
          this.ask.index = n - 1;
          this.askQuestion();
          return;
        }
        e.preventDefault();
        return;
      }

      // Phase 6 choice owns navigation; confirm (E/Enter/Space) falls through to
      // the normal advance path so update() picks the highlighted reply.
      if (this.dialogue.choosing) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          if (!e.repeat) this.dialogue.moveChoice(-1);
          this.keys[e.code] = true;
          return;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault();
          if (!e.repeat) this.dialogue.moveChoice(1);
          this.keys[e.code] = true;
          return;
        }
        const n = /^[12]$/.test(e.key) ? Number(e.key) : 0;
        if (n) {
          e.preventDefault();
          this.dialogue.pickChoice(n - 1);
          return;
        }
      }

      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') {
        // Edge-fires on the physical press (OS auto-repeat sets repeat=true), so
        // E keeps working even if a keyup was missed (blur/swallow) — a stale
        // key in this.keys must never dead-lock dialogue advancement.
        if (!e.repeat) this.advance = true;
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
    // A missed keyup (tab switch, window blur) must never leave movement or
    // interaction keys stuck "held". Clear everything on blur.
    window.addEventListener('blur', () => {
      this.keys = {};
    });
  }

  say(pairs, onDone) {
    this.dialogue.start(pairs, onDone);
  }

  // Phase 6: which authored choice (if any) this NPC offers right now. One per
  // NPC, offered once, only after that NPC's own authored dialogue has played and
  // only once its quest moment has actually happened. No scores, no history.
  pendingChoiceFor(npcId) {
    const map = { baabara: 'flowers', farmSheep: 'friend', rockSheep: 'rock' };
    const id = map[npcId];
    if (!id || hasChoice(this, id)) return null;
    const q = this.q;
    const ready = id === 'flowers'
      ? q.flowersGiven
      : id === 'friend'
        ? q.side.friend !== 'idle'
        : q.side.rock !== 'idle';
    return ready ? id : null;
  }

  // Freeze the world on a two-reply prompt; on pick, record the choice through
  // story.choose and play the authored consequence, then continue with `then`.
  offerChoice(choiceId, then) {
    const c = CHOICES[choiceId];
    if (!c || hasChoice(this, choiceId)) { if (then) then(); return; }
    this.dialogue.startChoice(c.prompt, c.options, (optionId) => {
      // Only the authored option ids are ever stored (last-write-wins).
      if (isAllowedOption(choiceId, optionId)) choose(this, choiceId, optionId);
      this.say(dialogLines(c.lines[optionId]), then);
    });
  }

  // After an NPC's opening dialogue, offer only the questions that NPC supports
  // (npc_personas.js is the source of truth). NPCs without a persona get none.
  openGuided(npcId, npcName) {
    const persona = PERSONAS[npcId];
    const intents = ((persona && persona.supportedIntents) || []).filter((i) => INTENT_LABELS[i]);
    if (!intents.length) return;
    this.ask = {
      active: true,
      npcId,
      npcName: npcName || persona.name,
      intents,
      index: 0,
      answer: null,
      answerIntent: null,
      thinking: false,
    };
  }

  moveAsk(delta) {
    if (!this.ask.active) return;
    const n = this.ask.intents.length;
    this.ask.index = (this.ask.index + delta + n) % n;
  }

  closeAsk() {
    this.ask.active = false;
    this.ask.answer = null;
    this.ask.answerIntent = null;
    this.ask.thinking = false;
  }

  // Ask the highlighted question. Wording only: buildContext reads state, the
  // dialogue service generates text, and nothing here mutates the game.
  async askQuestion() {
    const a = this.ask;
    if (!a.active) return;
    const intent = a.intents[a.index];
    const npcId = a.npcId;
    a.answer = null;
    a.answerIntent = intent;
    a.thinking = true;
    const context = buildContext(npcId, this, intent, null);
    let text;
    try {
      text = await npcDialogue.generate(context);
    } catch {
      text = '...';
    }
    if (!this.ask.active || this.ask.npcId !== npcId) return;
    this.ask.answer = text;
    this.ask.thinking = false;
  }

  // M key: mount/dismount the Mount Sheep (only after the keeper grants it).
  tryMountToggle() {
    if (this.mode !== 'play' || this.dialogue.active || !this.q.mountOwned) return;
    this.mounted = !this.mounted;
    this.player.speed = this.mounted ? 300 : 170;
    this.player.moving = false;
    sfx.done();
    this.persist();
  }

  // Event-driven save: persists and shows the brief "Saved" blip. Autosave
  // uses writeSave directly so it stays quiet.
  persist() {
    if (writeSave(this)) this.saveFlash = 1.4;
  }

  // Broadcast our state to the relay. Safe to call at any time (no-op offline).
  sendState() {
    net.send({
      id: this.myId,
      x: this.player.x,
      y: this.player.y,
      // Canonical area id. Maps are independent coordinate spaces, so the
      // remote must know which map this position belongs to before drawing it.
      area: this.world.area,
      dir: { x: this.player.dir.x, y: this.player.dir.y },
      mounted: this.mounted,
      mountId: this.mounted ? 'sheep' : null,
      secretIn: this.inSecretZone() ? 1 : 0,
      poke: this.secretPoke ? 1 : 0,
      sixth: this.q.secret.sixth ? 1 : 0,
    });
    this.secretPoke = false;
  }

  // Join (or create) a co-op room with the given code. Create = fresh code, room auto-appears.
  joinRoom(code) {
    if (!code) return;
    this.roomUI.joined = true;
    this.roomUI.active = false;
    this.roomCode = code;
    net.join(code);
    sfx.done();
  }

  // Connection health from the relay. net.js owns reconnect; here we reflect it
  // and drop ghost partners while disconnected so they don't linger on screen.
  onNetStatus(status, info) {
    this.netStatus = status;
    if (status !== 'open') this.others = new Map();
    if (status === 'open' && info && info.recovered) this.netFlash = 1.6;
  }

  // Ease each remote render position toward its authoritative network position.
  // Presentation only: exponential smoothing, frame-rate independent.
  updateOthers(dt) {
    const k = 1 - Math.exp(-dt / REMOTE_SMOOTH_TAU);
    for (const o of this.others.values()) {
      o.rx += (o.x - o.rx) * k;
      o.ry += (o.y - o.ry) * k;
    }
  }

  // Remote players standing on the local map. Rendering reads only this, so a
  // remote on another map is skipped entirely (no sprite, name tag, or mount)
  // rather than drawn at coordinates that belong to a different coordinate space.
  remotePlayers() {
    const area = this.world.area;
    const out = [];
    for (const o of this.others.values()) if (o.area === area) out.push(o);
    return out;
  }

  // Incoming other-player states + shared room state from the relay.
  syncPlayers(players, shared) {
    const prev = this.others;
    const next = new Map();
    const localArea = this.world.area;
    for (const pl of players) {
      if (pl.id === this.myId) continue;
      const old = prev.get(pl.id);
      // Keep the in-flight render position so movement eases instead of snapping.
      // A brand-new id (or a large jump) starts fresh at the received position —
      // this is what keeps reconnect from interpolating from a stale location.
      const far = old && (Math.abs(old.rx - pl.x) > REMOTE_SNAP_DIST || Math.abs(old.ry - pl.y) > REMOTE_SNAP_DIST);
      // Maps have independent coordinate spaces, so never ease across an area
      // change: reset the render position whenever the remote switches map or is
      // currently on a map we are not on. This prevents old-map coordinates from
      // bleeding into the local map.
      const sameArea = !!old && old.area === pl.area;
      const snap = !old || far || !sameArea || pl.area !== localArea;
      next.set(pl.id, Object.assign({}, pl, {
        rx: snap ? pl.x : old.rx,
        ry: snap ? pl.y : old.ry,
      }));
    }
    this.others = next;
    if (shared) {
      if (shared.discovered && !this.q.secret.discovered) {
        this.q.secret.discovered = true;
        if (!this.revealShown) {
          this.revealShown = true;
          if (!this.dialogue.active) this.say(DIALOGUE.tree_reveal);
        }
      }
      if (shared.sixth) this.q.secret.sixth = true;
    }
  }

  // Is the player standing near the suspicious tree (co-op zone)?
  inSecretZone() {
    const tx = Math.floor(this.player.cx / TILE);
    const ty = Math.floor(this.player.cy / TILE);
    return Math.abs(tx - 5) <= 1 && Math.abs(ty - 13) <= 1;
  }

  // One-time world beat when the 5th Memory lands. Returns true when it just
  // opened the seal line, so callers can defer follow-up UI until it is
  // dismissed (the guided ask menu must never sit on top of an open dialogue).
  maybeAnnounceSeal() {
    if (this.q.memories >= this.q.required && !this.q.sealAnnounced) {
      this.q.sealAnnounced = true;
      sfx.open();
      this.say([['', 'A low hum fills the world. The seal on the Old Shrine is gone.']]);
      return true;
    }
    return false;
  }

  update(dt) {
    // Title: Enter starts. If a save exists, Enter continues it; N starts fresh.
    if (this.mode === 'title') {
      if (this.advance) {
        this.advance = false;
        if (this.hasSave) {
          const data = loadSave();
          if (data) applySave(this, data);
        }
        this.mode = 'play';
      }
      this.advance = false;
      return;
    }
    // Ending: R restarts.
    if (this.mode === 'ending') {
      if (this.keys['KeyR']) location.reload();
      this.advance = false;
      return;
    }

    // Guided question chooser is modal: freeze the world until the player leaves.
    if (this.ask.active) {
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

    // Remote rendering: ease remote sprites toward their last network position.
    this.updateOthers(dt);

    // Network: push our state at ~20 Hz (a timer also does this when rAF is paused
    // because the tab is backgrounded, so the other player still sees us move).
    this.sendTimer += dt;
    if (this.sendTimer > 0.05) {
      this.sendTimer = 0;
      this.sendState();
    }

    // Persist single-player progress periodically (no-op without storage).
    this.saveTimer += dt;
    if (this.saveTimer > 2) { this.saveTimer = 0; writeSave(this); }

    // Fade the "Saved" blip.
    if (this.saveFlash > 0) this.saveFlash = Math.max(0, this.saveFlash - dt);
    if (this.netFlash > 0) this.netFlash = Math.max(0, this.netFlash - dt);

    // Movement (NPC bodies block like walls).
    const blockers = this.world.npcs.map((n) => ({ px: n.px, py: n.py, w: 32, h: 32 }));
    this.player.update(this.keys, this.world.tiles, blockers, dt);

    // Doors / portals (tile-polled). Guarded so a destination portal can't
    // immediately trigger: the player must leave the portal tile to re-arm,
    // plus a short time lock debounces rapid re-entry.
    const now = performance.now() / 1000;
    const tx = Math.floor(this.player.cx / TILE);
    const ty = Math.floor(this.player.cy / TILE);
    const door = this.world.doorAt(tx, ty);

    // Re-arm only once the player has stepped off every portal tile.
    if (!door) this.portalArmed = true;
    // Release the transition lock after the destination grace period.
    if (this.portalLocked && now >= this.portalLockUntil) this.portalLocked = false;

    if (door && this.portalArmed && !this.portalLocked && now >= this.portalLockUntil) {
      if (door.secret && !this.q.secret.discovered) {
        // The secret tree hides its path until both players find it.
      } else if (door.sealed && this.q.memories < this.q.required) {
        this.portalArmed = false; // say it once per visit, not every frame
        this.say(DIALOGUE.gate_sealed);
      } else {
        // Single transition: lock this player out of portals during the hop.
        this.portalLocked = true;
        this.portalArmed = false;
        this.world.setArea(door.to);
        this.player.x = door.tx * TILE + 7;
        this.player.y = door.ty * TILE + 5;
        this.portalLockUntil = performance.now() / 1000 + 0.75;
        this.persist();
      }
    }

    // Once discovered, the suspicious tree becomes a doorway.
    if (this.world.area === 'forest' && this.q.secret.discovered) {
      const t = this.world.tiles;
      if (t[13][5] === 'S') t[13][5] = 'D';
    }

    // Interaction: pressing E near someone/something.
    this.near = nearestInteractable(this);
    if (pressed && this.near) {
      if (this.near.type === 'npc') {
        const npc = this.near.ref;
        // Phase 3: weave in this NPC's one authored Baa recollection the first
        // time the player talks to them. One fragment per NPC; recorded on
        // close so the stage reflects what the player actually heard.
        const frag = fragmentFor(npc.id);
        const pending = frag && !hasFragment(this, frag.id) ? frag : null;
        let lines = talkFor(npc.id, this.q);
        if (pending) lines = lines.concat(dialogLines(pending.dialogue));
        this.say(lines, () => {
          if (pending) recordFragment(this, pending.id);
          const finalize = () => {
            const was = this.q.collected.flower;
            rewardFor(npc.id, this);
            if (!was && this.q.collected.flower) {
              sfx.pickup();
              this.rewardFx = { at: performance.now() };
            }
            // The seal line and the guided ask menu must never be open at once:
            // if the seal was just announced (a dialogue is up), defer the
            // questions until the player dismisses it with E — otherwise E would
            // be swallowed by the invisible ask menu and the seal never closes.
            if (this.maybeAnnounceSeal()) {
              this.dialogue.onDone = () => this.openGuided(npc.id, npc.name);
            } else {
              // Opening stays authored; guided questions are the optional extra.
              this.openGuided(npc.id, npc.name);
            }
            this.persist();
          };
          // Phase 6: this NPC's authored choice (if any) plays before the quest
          // reward and the guided-questions menu. Choices never gate progress.
          const cid = this.pendingChoiceFor(npc.id);
          if (cid) this.offerChoice(cid, finalize);
          else finalize();
        });
      } else {
        const wasActive = this.dialogue.active;
        handleHotspot(this, this.near.ref);
        if (this.dialogue.active && !wasActive) {
          const prev = this.dialogue.onDone;
          this.dialogue.onDone = () => {
            if (prev) prev();
            this.maybeAnnounceSeal();
            this.persist();
          };
        } else if (!wasActive) {
          this.maybeAnnounceSeal();
          this.persist();
        }
      }
    }
  }

  render() {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;

    // Single top-down camera for every state. Mounting changes how the player
    // is drawn (black rider on a white Mount Sheep) and its speed, nothing else.
    ctx.fillStyle = '#7ea54e';
    ctx.fillRect(0, 0, 960, 640);

    this.world.draw(ctx, this);

    // Hotspots.
    for (const hs of this.world.hotspots) {
      this.drawHotspot(ctx, hs);
    }

    // First-Memory pickup pulse (transient; nothing drawn if never set).
    this.drawMemoryBurst(ctx);

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

    // Remote co-op players (black sheep, like you), drawn at the eased render
    // position. A mounted remote rides a white Mount Sheep. Presentation only.
    // Only remotes on the local map are drawn; others live in another
    // coordinate space and are filtered out before any drawing happens.
    for (const o of this.remotePlayers()) {
      if (o.mounted) drawRiderSheep(ctx, o.rx + 13, o.ry + 15);
      else drawSheep(ctx, o.rx + 13, o.ry + 15, true);
      drawNameTag(ctx, o.rx + 13, o.ry - 3, remoteTagText());
    }

    this.player.draw(ctx, this.mounted);

    // Red Flower reward: the granted memory floats above the player briefly.
    this.drawRewardFx(ctx);

    // Phase 6C: staged presentation for the Baa sequence — dim the world, give
    // the voice a body, and show the Photograph during the reveal.
    if (this.stageBaa) this.drawBaaStage(ctx);

    if (this.mode === 'title') this.drawTitle(ctx);
    else {
      drawHud(ctx, this);
      if (this.dialogue.active) {
        if (this.dialogue.choosing) drawChoiceBox(ctx, this.dialogue.choice);
        else {
          drawDialogueBox(ctx, this.dialogue, this.stageBaa);
          // The Photograph becomes a real object the first time its Memory
          // dialogue is read: shown above the box, undimmed, no staging.
          if (this.dialogue.lines === DIALOGUE.memory_photo) this.drawPhotoCard(ctx);
        }
      } else if (this.ask.active) drawAskMenu(ctx, this.ask, this.ask.npcName);
      if (this.saveFlash > 0) this.drawSaveBlip(ctx);
      if (this.netFlash > 0) this.drawNetBlip(ctx);
    }
    if (this.mode === 'ending') drawEnding(ctx, this);
  }

  // Brief "Saved" blip, top-right, fading out.
  drawSaveBlip(ctx) {
    const a = Math.min(1, this.saveFlash / 0.5);
    const label = 'Saved ✓';
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px "Courier New", monospace';
    const w = ctx.measureText(label).width;
    const right = 946;
    ctx.fillStyle = 'rgba(20,22,26,0.72)';
    ctx.fillRect(right - w - 12, 12, w + 20, 22);
    ctx.fillStyle = '#8fd18f';
    ctx.fillText(label, right - 6, 28);
    ctx.restore();
  }

  // Brief "Reconnected" blip, top-right under the Saved blip, fading out.
  drawNetBlip(ctx) {
    const a = Math.min(1, this.netFlash / 0.5);
    const label = 'Reconnected ✓';
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px "Courier New", monospace';
    const w = ctx.measureText(label).width;
    const right = 946;
    const y = this.saveFlash > 0 ? 38 : 12;
    ctx.fillStyle = 'rgba(20,22,26,0.72)';
    ctx.fillRect(right - w - 12, y, w + 20, 22);
    ctx.fillStyle = '#8fd18f';
    ctx.fillText(label, right - 6, y + 16);
    ctx.restore();
  }

  drawHotspot(ctx, hs) {
    const t = performance.now();
    const px = hs.px + 20;
    const py = hs.py + 20;
    if (hs.kind === 'memory') {
      // Picked up memories leave their tile: the item is collected, so the
      // world stops showing it (interaction stays: handleHotspot no-ops).
      if (this.q.collected[hs.item]) return;
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
      // A picked flower is gone from the world (per-flower state), and once
      // all three are delivered no flower spot remains.
      if (this.q.flowersPicked[hs.id] || this.q.flowersGiven) return;
      const bob = Math.round(Math.sin(t / 400 + hs.x) * 2);
      envFlower(ctx, px, py + bob, (hs.x + hs.y) % 3);
    } else if (hs.kind === 'rock') {
      if (this.q.hasRock) return;
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
      // With all five Memories placed, their icons rest at the altar's base.
      // Presentation only: reads q, mutates nothing. Drawn under the overlay
      // layers, so a staged Baa silhouette may cover them in the ending — fine.
      if (this.q.memories >= this.q.required) {
        const icons = ['bell', 'flower', 'toy', 'ribbon', 'photo'];
        const pitch = 26;
        const rowY = py + 28;
        ctx.fillStyle = 'rgba(30,20,10,0.22)';
        ctx.fillRect(Math.round(px - (icons.length * pitch) / 2), rowY - 2, icons.length * pitch, 5);
        let cx = px - ((icons.length - 1) * pitch) / 2;
        for (const item of icons) {
          const img = memorySprite(item);
          if (img) spr(ctx, img, Math.round(cx - img.width / 2), Math.round(rowY - img.height / 2));
          cx += pitch;
        }
      }
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

  // First-Memory pickup pulse: two expanding gold rings at the collection
  // point, fading out over ~650 ms. Transient presentation only — a Game that
  // never had memoryBurst set draws nothing extra (stub tests unaffected).
  drawMemoryBurst(ctx) {
    const b = this.memoryBurst;
    if (!b) return;
    const age = performance.now() - b.at;
    if (age >= 650) return;
    const k = age / 650;
    ctx.save();
    ctx.strokeStyle = '#f2c14e';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const size = 14 + i * 16 + k * 46;
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
      ctx.strokeRect(Math.round(b.px - size / 2), Math.round(b.py - size / 2), size, size);
    }
    ctx.restore();
  }

  // Red Flower reward: the granted Memory sprite floats above the player with
  // a gentle bob as it fades, ~1.1 s after the reward was granted. Transient.
  drawRewardFx(ctx) {
    const rx = this.rewardFx;
    if (!rx) return;
    const age = performance.now() - rx.at;
    if (age >= 1100) return;
    const img = memorySprite('flower');
    if (!img) return;
    const k = age / 1100;
    const bob = Math.round(Math.sin(age / 120) * 5);
    const cx = Math.round(this.player.x + 13);
    const cy = Math.round(this.player.y + 15 - 42 + bob);
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k);
    spr(ctx, img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
    ctx.restore();
  }

  // The Photograph as a real object: shown at mid-screen above the dialogue
  // box while the memory_photo lines are on screen. No dim, no staging.
  drawPhotoCard(ctx) {
    const img = photographSprite();
    if (!img) return;
    spr(ctx, img, Math.round(480 - img.width / 2), Math.round(295 - img.height / 2));
  }

  // Phase 6C: one staged pass over the world while the Baa sequence plays.
  // Presentation-only: dims the view, draws the voice as a dark sheep at the
  // altar, and during the reveal shows the enlarged Photograph the dialogue is
  // describing. No state, no input change, nothing persisted.
  drawBaaStage(ctx) {
    const t = performance.now();
    const k = Math.min(1, (t - this.baaStageAt) / 450);
    if (k <= 0) return;

    // subtle dim + vignette so the beat reads differently from NPC dialogue.
    ctx.fillStyle = `rgba(10,12,16,${(0.4 * k).toFixed(3)})`;
    ctx.fillRect(0, 0, 960, 640);
    ctx.fillStyle = `rgba(6,8,12,${(0.28 * k).toFixed(3)})`;
    ctx.fillRect(0, 0, 960, 46);
    ctx.fillRect(0, 594, 960, 46);
    ctx.fillRect(0, 0, 46, 640);
    ctx.fillRect(914, 0, 46, 640);

    // Baa: a still dark sheep standing at the altar (reused sheepBlack sprite,
    // no new character system). Front view, no bob — a presence, not a wanderer.
    const altar = this.world.hotspots.find((h) => h.id === 'altar');
    const img = sprites().sheepBlack[0];
    if (img && altar) {
      const cx = altar.px + 20;
      const cy = altar.py + 20;
      ctx.fillStyle = 'rgba(20,14,8,0.35)';
      ctx.fillRect(cx - 14, cy + 12, 28, 5);
      ctx.globalAlpha = Math.max(k, 0.35);
      spr(ctx, img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
      ctx.globalAlpha = 1;
    }

    // The Photograph, visible for the first time, during the reveal beats.
    if (this.baaRevealAt >= 0 && this.dialogue.active && this.dialogue.i >= this.baaRevealAt) {
      this.drawBaaPhotograph(ctx, k);
    }
  }

  // The enlarged Photograph: row of sheep, cropped dark shape at the edge, and
  // the small bell / ribbon / flower the memory beat already described.
  drawBaaPhotograph(ctx, k) {
    const img = photographSprite();
    if (!img) return;
    const cx = 480;
    const cy = 240;
    ctx.fillStyle = `rgba(20,15,8,${(0.35 * k).toFixed(3)})`;
    ctx.fillRect(cx - img.width / 2 - 4, cy - img.height / 2 + 34, img.width + 8, 12);
    ctx.globalAlpha = k;
    spr(ctx, img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
    ctx.globalAlpha = 1;
    // the worn corner the text keeps coming back to
    ctx.fillStyle = 'rgba(120,108,84,0.55)';
    ctx.fillRect(Math.round(cx - img.width / 2), Math.round(cy - img.height / 2), 12, 7);
    ctx.fillRect(Math.round(cx - img.width / 2), Math.round(cy - img.height / 2), 6, 12);
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
    ctx.fillText('Collect the five Memories. Help a few weird sheep.', 480, 470);
    ctx.fillStyle = '#f2e9c9';
    ctx.font = 'bold 15px "Courier New", monospace';
    if (this.hasSave) {
      ctx.fillText('[Enter] Continue  ·  [N] New game  ·  [C] Co-op', 480, 508);
    } else {
      ctx.fillText('[Enter]  Solo  ·  [C]  Co-op room', 480, 508);
    }
    if (this.roomUI.active) drawRoomInput(ctx, this.roomUI);
    else if (this.roomUI.joined) {
      ctx.fillStyle = '#7fa66a';
      ctx.font = '14px "Courier New", monospace';
      ctx.fillText(`Joined room ${this.roomCode} — friend types the same code.`, 480, 538);
      ctx.fillStyle = '#f2e9c9';
      ctx.font = 'bold 14px "Courier New", monospace';
      ctx.fillText('[Enter] begin', 480, 566);
      if (this.netStatus !== 'open') {
        ctx.fillStyle = '#e0a35a';
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.fillText(this.netStatus === 'reconnecting' ? 'Reconnecting to the room…' : 'Connecting to the room…', 480, 588);
      }
    }
    // Optional local SLM status (never blocks play).
    if (npcDialogue.status === 'loading') {
      const local = npcDialogue.local;
      const pct = Math.round(((local && local.progress) || 0) * 100);
      const detail = local && local.progressLabel ? `  ${local.progressLabel}` : '';
      ctx.fillStyle = '#8f97a5';
      ctx.font = '12px "Courier New", monospace';
      let label = `SHEEP ARE THINKING... ${pct}%${detail}`;
      if (label.length > 78) label = label.slice(0, 77) + '…';
      ctx.fillText(label, 480, 600);
    }
    ctx.textAlign = 'left';
  }
}

// Room-code entry overlay on the title screen.
function drawRoomInput(ctx, ui) {
  ctx.fillStyle = 'rgba(16,18,22,0.95)';
  ctx.fillRect(240, 200, 480, 240);
  ctx.strokeStyle = '#c9b46a';
  ctx.lineWidth = 2;
  ctx.strokeRect(242, 202, 476, 236);
  ctx.fillStyle = '#c9b46a';
  ctx.fillRect(240, 200, 8, 8);
  ctx.fillRect(712, 200, 8, 8);
  ctx.fillRect(240, 432, 8, 8);
  ctx.fillRect(712, 432, 8, 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 16px "Courier New", monospace';
  ctx.fillText('CO-OP ROOM', 480, 232);
  ctx.fillStyle = '#9aa0a8';
  ctx.font = '13px "Courier New", monospace';
  ctx.fillText('Type a friend\'s code to join,', 480, 258);
  ctx.fillText('or leave it empty and press Enter to create a room.', 480, 276);

  // input box
  ctx.fillStyle = '#10141a';
  ctx.fillRect(300, 300, 360, 40);
  ctx.strokeStyle = '#e8b83e';
  ctx.strokeRect(300, 300, 360, 40);
  const caret = Math.floor(performance.now() / 500) % 2 === 0 ? '_' : ' ';
  ctx.fillStyle = '#f2f2f2';
  ctx.font = 'bold 22px "Courier New", monospace';
  ctx.fillText((ui.code + caret).padEnd(12, '·'), 480, 329);

  ctx.fillStyle = '#f2e9c9';
  ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText('[Enter] join (empty = create)   [Esc] back', 480, 372);
  ctx.textAlign = 'left';
}

// Fresh room code for the "create a room" path (no confusing 0/O, 1/I).
function newRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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

// Small identity tag above a remote player. Presentation only; it is drawn
// inside the same per-frame loop as the sprite, so it vanishes with the sprite.
function drawNameTag(ctx, cx, bottomY, text) {
  ctx.font = 'bold 10px "Courier New", monospace';
  const w = ctx.measureText(text).width;
  const x = Math.round(cx - w / 2);
  const y = Math.round(bottomY - 14);
  ctx.fillStyle = 'rgba(20,22,26,0.82)';
  ctx.fillRect(x - 5, y, w + 10, 15);
  ctx.fillStyle = '#c9b458';
  ctx.fillRect(x - 5, y, w + 10, 1);
  ctx.fillStyle = '#f2e9c9';
  ctx.fillText(text, x, y + 11);
}

// Remote player on a mount: white Mount Sheep beneath, black rider on top.
// Built from the existing sheep sprites — no new art, presentation only.
function drawRiderSheep(ctx, cx, cy) {
  const t = performance.now();
  const mount = sheepPose(sprites().sheepWhite, false, t);
  const rider = sheepPose(sprites().sheepBlack, false, t);
  ctx.fillStyle = 'rgba(30,20,10,0.22)';
  ctx.fillRect(cx - 15, cy + 15, 30, 4);
  spr(ctx, mount.img, Math.round(cx - mount.img.width / 2), Math.round(cy - mount.img.height / 2 + mount.bob + 7));
  spr(ctx, rider.img, Math.round(cx - rider.img.width / 2), Math.round(cy - rider.img.height / 2 + rider.bob - 4));
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