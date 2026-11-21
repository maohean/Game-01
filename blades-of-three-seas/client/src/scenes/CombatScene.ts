import Phaser from "phaser";
import {
  ALLIANCE_INTERACT_RANGE,
  ASIA_MAX_X,
  ASIA_SPAWNS,
  ATTACK_ARC_RAD,
  ATTACK_RANGE,
  BOAT_INTERACT_RANGE,
  BRIDGE_TOLL_COINS,
  CAMPFIRE_HEAL_RADIUS,
  EUROPE_MAX_X,
  EUROPE_SEA_DATA,
  FINAL_DUEL_CENTER_X,
  FINAL_DUEL_CENTER_Y,
  FINAL_DUEL_RADIUS,
  FOLLOWER_ROLES_CATALOG,
  HOSTILES_CATALOG,
  INTERACT_RANGE,
  PLAYER_RADIUS,
  RESCUE_ENCOUNTERS_LIST,
  SIEGE_INTERACT_RANGE,
  Stance,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "@bots/shared";
import {
  FollowerSnapshot,
  NetworkClient,
  PlayerSnapshot,
} from "../net/NetworkClient";
import { HudController } from "../ui/HudController";
import { AsiaChunkRenderer } from "./AsiaChunkRenderer";

interface WarriorVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  allyRing: Phaser.GameObjects.Arc;
  downedRing: Phaser.GameObjects.Arc;
  stanceArc: Phaser.GameObjects.Graphics;
  weaponLine: Phaser.GameObjects.Line;
  shieldArc: Phaser.GameObjects.Graphics;
  hpFill: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
}

interface FollowerVisual {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  hpFill: Phaser.GameObjects.Rectangle;
  tagText: Phaser.GameObjects.Text;
}

const STANCE_COLORS: Record<Stance, number> = {
  high: 0xff6b6b,
  mid: 0xffd166,
  low: 0x4cc9f0,
};

export class CombatScene extends Phaser.Scene {
  private net: NetworkClient;
  private hud: HudController;
  private visuals = new Map<string, WarriorVisual>();
  private followerVisuals = new Map<string, FollowerVisual>();
  private arrowTrails: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    expiresAt: number;
  }> = [];

  private worldGfx!: Phaser.GameObjects.Graphics;
  private stormGfx!: Phaser.GameObjects.Graphics;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private asiaChunkRenderer!: AsiaChunkRenderer;

  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    SHIFT: Phaser.Input.Keyboard.Key;
    SPACE: Phaser.Input.Keyboard.Key;
    TAB: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    G: Phaser.Input.Keyboard.Key;
    H: Phaser.Input.Keyboard.Key;
    U: Phaser.Input.Keyboard.Key;
    Y: Phaser.Input.Keyboard.Key;
    B: Phaser.Input.Keyboard.Key;
    N: Phaser.Input.Keyboard.Key;
    Z: Phaser.Input.Keyboard.Key;
    X: Phaser.Input.Keyboard.Key;
    C: Phaser.Input.Keyboard.Key;
    V: Phaser.Input.Keyboard.Key;
    ONE: Phaser.Input.Keyboard.Key;
    TWO: Phaser.Input.Keyboard.Key;
    THREE: Phaser.Input.Keyboard.Key;
    FOUR: Phaser.Input.Keyboard.Key;
    FIVE: Phaser.Input.Keyboard.Key;
    SIX: Phaser.Input.Keyboard.Key;
    SEVEN: Phaser.Input.Keyboard.Key;
    EIGHT: Phaser.Input.Keyboard.Key;
    NINE: Phaser.Input.Keyboard.Key;
  };

  private inputSeq = 0;
  private inputAccumMs = 0;
  private spectateTargetId = "";

  constructor(net: NetworkClient, hud: HudController) {
    super("CombatScene");
    this.net = net;
    this.hud = hud;
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.drawBaseTriRegionMap();

    this.asiaChunkRenderer = new AsiaChunkRenderer(this);
    this.net.onChunkLoad((chunks) => this.asiaChunkRenderer.loadChunks(chunks));
    this.net.onChunkUnload((keys) => this.asiaChunkRenderer.unloadChunks(keys));

    this.worldGfx = this.add.graphics().setDepth(8);
    this.stormGfx = this.add.graphics().setDepth(45);

    this.nightOverlay = this.add
      .rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x050914, 0)
      .setDepth(42);

    this.setupInputs();
    this.net.onCombatEvent((evt) => this.spawnCombatVfx(evt));
  }

  private drawBaseTriRegionMap(): void {
    const g = this.add.graphics().setDepth(0);

    // 1. Asia Base (0..1536)
    g.fillStyle(0x16202a, 1);
    g.fillRect(0, 0, ASIA_MAX_X, WORLD_HEIGHT);

    // 2. Europe Base (1536..3072)
    g.fillStyle(0x1d2b1f, 1);
    g.fillRect(ASIA_MAX_X, 0, EUROPE_MAX_X - ASIA_MAX_X, WORLD_HEIGHT);

    // 3. Sea Base (3072..4608)
    g.fillStyle(0x0b2545, 1);
    g.fillRect(EUROPE_MAX_X, 0, WORLD_WIDTH - EUROPE_MAX_X, WORLD_HEIGHT);

    // Border River & Wooden Bridge between Asia and Europe
    g.fillStyle(0x1d4e89, 1);
    g.fillRect(1488, 0, 96, WORLD_HEIGHT);
    g.fillStyle(0x8d5524, 1);
    g.fillRect(1480, 528, 112, 96);

    // Harbor Routes dashed lines
    g.lineStyle(2, 0x4cc9f0, 0.35);
    for (const route of EUROPE_SEA_DATA.connections.harborRoutes) {
      g.beginPath();
      g.moveTo(route.from.x, route.from.y);
      g.lineTo(route.to.x, route.to.y);
      g.strokePath();
    }

    // Final Duel Sanctuary
    g.lineStyle(2, 0x8957e5, 0.35);
    g.strokeCircle(FINAL_DUEL_CENTER_X, FINAL_DUEL_CENTER_Y, FINAL_DUEL_RADIUS);

    const bannerStyle = {
      fontSize: "14px",
      fontFamily: "monospace",
      fontStyle: "bold",
      color: "#ffd166",
      backgroundColor: "rgba(13,17,23,0.8)",
      padding: { x: 8, y: 4 },
    };
    this.add.text(768, 36, "REGION I: ASIA (BAMBOO, TEMPLES & CASTLE)", bannerStyle).setOrigin(0.5).setDepth(12);
    this.add.text(2304, 36, "REGION II: EUROPE (VILLAGE, CASTLE & SIEGE)", bannerStyle).setOrigin(0.5).setDepth(12);
    this.add.text(3840, 36, "REGION III: THREE SEAS (HARBOR, PIRATES & DRAGON)", bannerStyle).setOrigin(0.5).setDepth(12);
  }

  private setupInputs(): void {
    const kb = this.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      SHIFT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      SPACE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      TAB: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TAB),
      F: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      G: kb.addKey(Phaser.Input.Keyboard.KeyCodes.G),
      H: kb.addKey(Phaser.Input.Keyboard.KeyCodes.H),
      U: kb.addKey(Phaser.Input.Keyboard.KeyCodes.U),
      Y: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Y),
      B: kb.addKey(Phaser.Input.Keyboard.KeyCodes.B),
      N: kb.addKey(Phaser.Input.Keyboard.KeyCodes.N),
      Z: kb.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      X: kb.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      C: kb.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      V: kb.addKey(Phaser.Input.Keyboard.KeyCodes.V),
      ONE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      TWO: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      THREE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
      FOUR: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR),
      FIVE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FIVE),
      SIX: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SIX),
      SEVEN: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SEVEN),
      EIGHT: kb.addKey(Phaser.Input.Keyboard.KeyCodes.EIGHT),
      NINE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.NINE),
    };

    this.input.mouse?.disableContextMenu();

    this.keys.ONE.on("down", () => this.net.sendStance("high"));
    this.keys.TWO.on("down", () => this.net.sendStance("mid"));
    this.keys.THREE.on("down", () => this.net.sendStance("low"));
    this.keys.SPACE.on("down", () => this.net.sendDodge());
    this.keys.TAB.on("down", () => this.cycleSpectateTarget());
    this.keys.F.on("down", () => this.net.sendInteract());
    this.keys.G.on("down", () => this.net.sendFeedFollower());
    this.keys.H.on("down", () => this.net.sendAllyAction());
    this.keys.U.on("down", () => this.net.sendCrewSiege());
    this.keys.Y.on("down", () => this.net.sendFireSiege());
    this.keys.B.on("down", () => this.net.sendBoatAction("rent_or_board"));
    this.keys.N.on("down", () => this.net.sendBoatAction("buy"));

    this.keys.Z.on("down", () => this.net.sendCraft("craft_campfire"));
    this.keys.X.on("down", () => this.net.sendCraft("craft_cook_food"));
    this.keys.C.on("down", () => this.net.sendCraft("craft_poultice"));
    this.keys.V.on("down", () => this.net.sendCraft("craft_forge_blade"));

    this.keys.FOUR.on("down", () => this.net.sendUseItem(0));
    this.keys.FIVE.on("down", () => this.net.sendUseItem(1));
    this.keys.SIX.on("down", () => this.net.sendUseItem(2));
    this.keys.SEVEN.on("down", () => this.net.sendUseItem(3));
    this.keys.EIGHT.on("down", () => this.net.sendUseItem(4));
    this.keys.NINE.on("down", () => this.net.sendUseItem(5));

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        this.net.sendAttack();
      }
    });
  }

  update(_time: number, delta: number): void {
    const players = this.net.getInterpolatedPlayers();
    const myId = this.net.sessionId;
    const me = players.get(myId);
    const meta = this.net.getLatestMeta();

    this.nightOverlay.setAlpha(meta.dayNight.darknessAlpha);

    if (me && me.alive && !me.downed && meta.phase === "active") {
      this.inputAccumMs += delta;
      if (this.inputAccumMs >= 50) {
        this.inputAccumMs = 0;
        this.sendMovementSample(me);
      }
    }

    this.drawWorldObjects(me);
    this.syncWarriorVisuals(players, myId);
    this.syncFollowerVisuals(players, myId);
    this.drawStormOverlay();
    this.updateCameraFollow(players, myId);

    const nearbyPrompt = me && me.alive ? this.findNearbyInteractionPrompt(me) : null;
    const allyPrompt = me && me.alive ? this.findNearbyAlliancePrompt(me, players) : null;
    this.hud.update(
      this.game.loop.actualFps,
      players,
      this.spectateTargetId,
      nearbyPrompt,
      allyPrompt
    );
  }

  private findNearbyInteractionPrompt(me: PlayerSnapshot): string | null {
    const meta = this.net.getLatestMeta();

    if (me.allyId) {
      const ally = this.net.getInterpolatedPlayers().get(me.allyId);
      if (ally && ally.alive && ally.downed && Math.hypot(me.x - ally.x, me.y - ally.y) <= INTERACT_RANGE) {
        return `[F] Revive ${ally.name} (+20 Honor)`;
      }
    }

    const toll = ASIA_SPAWNS.spawns.bridgeToll;
    if (
      Math.hypot(me.x - toll.x, me.y - toll.y) <= 105 &&
      !meta.tollPaidPlayerIds.includes(me.id)
    ) {
      return `[F] Pay Bridge Toll (${BRIDGE_TOLL_COINS}g)`;
    }

    const angkor = ASIA_SPAWNS.landmarks.find((l) => l.kind === "angkor_temple")!;
    if (!meta.angkorTreasureClaimed && Math.hypot(me.x - angkor.x, me.y - angkor.y) <= angkor.radius) {
      return `[F] Claim Angkor Royal Treasure (+85g)`;
    }

    let prompt: string | null = null;
    meta.townNpcs.forEach((npc) => {
      if (prompt || npc.role === "guard") return;
      if (Math.hypot(me.x - npc.x, me.y - npc.y) <= INTERACT_RANGE) {
        prompt = `${npc.name}: ${npc.serviceLabel}`;
      }
    });
    if (prompt) return prompt;

    meta.pois.forEach((poi) => {
      if (prompt) return;
      if (Math.hypot(me.x - poi.x, me.y - poi.y) <= poi.radius) {
        if (poi.kind === "church") prompt = `[F] Sanctuary Church Blessing (+50 HP)`;
        else if (poi.kind === "inn") prompt = `[F] Golden Boar Inn Rest (5g)`;
        else if (poi.kind === "dungeon" && !poi.looted) prompt = `[F] Open Castle Crypt Vault`;
        else if (poi.kind === "lighthouse" && !poi.beaconLit) prompt = `[F] Light Beacon Lighthouse`;
        else if (poi.kind === "shipwreck" && !poi.looted) prompt = `[F] Salvage Sunken Galleon (+65g)`;
      }
    });
    if (prompt) return prompt;

    meta.siegeWeapons.forEach((s) => {
      if (prompt) return;
      if (Math.hypot(me.x - s.x, me.y - s.y) <= SIEGE_INTERACT_RANGE) {
        prompt = `[U] Crew ${s.name} (${s.crewIds.length}/${s.minCrew}) | [Y] Fire`;
      }
    });
    if (prompt) return prompt;

    meta.boats.forEach((b) => {
      if (prompt) return;
      if (Math.hypot(me.x - b.x, me.y - b.y) <= BOAT_INTERACT_RANGE) {
        prompt = `[B] Rent/Board ${b.name} | [N] Buy Caravel`;
      }
    });
    if (prompt) return prompt;

    meta.rescueNpcs.forEach((npc) => {
      if (prompt || npc.rescued) return;
      if (Math.hypot(me.x - npc.x, me.y - npc.y) <= INTERACT_RANGE) {
        const encDef = RESCUE_ENCOUNTERS_LIST.find((e) => e.type === npc.encounterType);
        const roleDef = FOLLOWER_ROLES_CATALOG[npc.followerRole];
        prompt = `[F] Rescue ${npc.name} (${roleDef.tag}) — ${encDef?.label ?? ""}`;
      }
    });
    if (prompt) return prompt;

    meta.lootContainers.forEach((c) => {
      if (prompt || c.opened) return;
      if (Math.hypot(me.x - c.x, me.y - c.y) <= INTERACT_RANGE) {
        prompt = `[F] Open Supply Chest`;
      }
    });
    if (prompt) return prompt;

    meta.resourceNodes.forEach((n) => {
      if (prompt || n.depleted) return;
      if (Math.hypot(me.x - n.x, me.y - n.y) <= INTERACT_RANGE) {
        prompt = `[F / Slash] Gather ${n.kind.toUpperCase()} (${n.hp}/${n.maxHp})`;
      }
    });
    return prompt;
  }

  private findNearbyAlliancePrompt(
    me: PlayerSnapshot,
    players: Map<string, PlayerSnapshot>
  ): string | null {
    if (me.pendingAllyFromId && !me.allyId) {
      return `[H] Accept Truce from ${me.pendingAllyFromName}`;
    }
    if (me.allyId) return null;

    let prompt: string | null = null;
    players.forEach((other) => {
      if (prompt || other.id === me.id || !other.alive || other.downed || other.allyId) return;
      if (Math.hypot(me.x - other.x, me.y - other.y) <= ALLIANCE_INTERACT_RANGE) {
        prompt = `[H] Propose Temporary Truce to ${other.name}`;
      }
    });
    return prompt;
  }

  private drawWorldObjects(me?: PlayerSnapshot): void {
    const g = this.worldGfx;
    g.clear();
    const meta = this.net.getLatestMeta();

    // 1. Resource Nodes
    meta.resourceNodes.forEach((n) => {
      if (n.depleted) return;
      const color =
        n.kind === "wood"
          ? 0x7f4f24
          : n.kind === "stone"
          ? 0x8d99ae
          : n.kind === "iron"
          ? 0x4cc9f0
          : 0x52b788;
      g.fillStyle(color, 1);
      g.fillCircle(n.x, n.y, 13);
      g.lineStyle(2, 0x0d1117, 0.8);
      g.strokeCircle(n.x, n.y, 13);
    });

    // 2. Loot Chests
    meta.lootContainers.forEach((c) => {
      if (c.opened) return;
      g.fillStyle(0xffd166, 1);
      g.fillRect(c.x - 11, c.y - 8, 22, 16);
      g.lineStyle(2, 0x5c3d2e, 1);
      g.strokeRect(c.x - 11, c.y - 8, 22, 16);
    });

    // 3. Campfires
    meta.campfires.forEach((f) => {
      g.fillStyle(0xf0883e, 0.14);
      g.fillCircle(f.x, f.y, CAMPFIRE_HEAL_RADIUS);
      g.lineStyle(1.5, 0xf0883e, 0.45);
      g.strokeCircle(f.x, f.y, CAMPFIRE_HEAL_RADIUS);

      g.fillStyle(0xff6b35, 1);
      g.fillCircle(f.x, f.y, 10);
      g.fillStyle(0xffd166, 1);
      g.fillCircle(f.x, f.y, 5);
    });

    // 4. Asia Town NPCs
    meta.townNpcs.forEach((npc) => {
      const color =
        npc.role === "guard"
          ? 0x4cc9f0
          : npc.role === "blacksmith"
          ? 0xd2a8ff
          : npc.role === "apothecary"
          ? 0x3fb950
          : 0xffd166;
      g.fillStyle(color, 1);
      g.fillCircle(npc.x, npc.y, 13);
      g.lineStyle(2, 0xffffff, 0.8);
      g.strokeCircle(npc.x, npc.y, 13);
    });

    // 5. Europe & Sea POIs
    meta.pois.forEach((poi) => {
      const color = poi.region === "sea" ? 0x4cc9f0 : 0xd2a8ff;
      g.lineStyle(2.5, color, 0.65);
      g.strokeCircle(poi.x, poi.y, poi.radius);
      g.fillStyle(color, 0.25);
      g.fillCircle(poi.x, poi.y, 18);
    });

    // 6. Siege Weapons
    meta.siegeWeapons.forEach((s) => {
      g.fillStyle(s.kind === "battering_ram" ? 0xa47148 : 0xffd166, 1);
      g.fillRect(s.x - 18, s.y - 12, 36, 24);
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeRect(s.x - 18, s.y - 12, 36, 24);
    });

    // 7. Boats
    meta.boats.forEach((b) => {
      g.fillStyle(b.kind === "caravel" ? 0xffd166 : 0xb08968, 1);
      g.fillRect(b.x - 22, b.y - 12, 44, 24);
      g.lineStyle(2, 0x0d1117, 1);
      g.strokeRect(b.x - 22, b.y - 12, 44, 24);
    });

    // 8. Rescuable NPCs
    meta.rescueNpcs.forEach((npc) => {
      if (npc.rescued) return;
      g.lineStyle(2, 0x4cc9f0, 0.7);
      g.strokeCircle(npc.x, npc.y, 20);
      g.fillStyle(0x4cc9f0, 1);
      g.fillCircle(npc.x, npc.y, 12);
    });

    // 9. Hostile NPCs & Bosses
    meta.hostiles.forEach((h) => {
      if (!h.alive) return;
      const isBoss =
        h.kind === "angkor_boss" || h.kind === "oni_boss" || h.kind === "sea_dragon";
      const r = isBoss ? 24 : 14;
      const color =
        h.kind === "oni_boss"
          ? 0x9b5de5
          : h.kind === "angkor_boss" || h.kind === "sea_dragon"
          ? 0xff006e
          : h.kind === "tiger"
          ? 0xf77f00
          : 0xda3633;

      g.fillStyle(color, 1);
      g.fillCircle(h.x, h.y, r);
      g.lineStyle(2, 0xffd166, 0.9);
      g.strokeCircle(h.x, h.y, r);

      const hpRatio = Math.max(0, h.hp / h.maxHp);
      g.fillStyle(0x0d1117, 0.9);
      g.fillRect(h.x - r, h.y - r - 9, r * 2, 4);
      g.fillStyle(0xf85149, 1);
      g.fillRect(h.x - r, h.y - r - 9, r * 2 * hpRatio, 4);
    });

    // 10. Archer Arrow Trails
    const now = performance.now();
    this.arrowTrails = this.arrowTrails.filter((tr) => now < tr.expiresAt);
    for (const tr of this.arrowTrails) {
      g.lineStyle(2.5, 0xffd166, 0.9);
      g.beginPath();
      g.moveTo(tr.fromX, tr.fromY);
      g.lineTo(tr.toX, tr.toY);
      g.strokePath();
    }

    // 11. Subtle Range Guide
    if (me && me.alive && !me.downed) {
      g.lineStyle(1, 0xffffff, 0.1);
      g.strokeCircle(me.x, me.y, INTERACT_RANGE);
    }
  }

  private syncFollowerVisuals(players: Map<string, PlayerSnapshot>, myId: string): void {
    const activeFollowers = new Map<string, { f: FollowerSnapshot; isMine: boolean }>();
    players.forEach((p, ownerId) => {
      if (!p.alive) return;
      for (const f of p.followers) {
        activeFollowers.set(f.id, { f, isMine: ownerId === myId });
      }
    });

    for (const [fId, vis] of this.followerVisuals.entries()) {
      if (!activeFollowers.has(fId)) {
        vis.container.destroy();
        this.followerVisuals.delete(fId);
      }
    }

    activeFollowers.forEach(({ f, isMine }, fId) => {
      let vis = this.followerVisuals.get(fId);
      if (!vis) {
        vis = this.createFollowerVisual(f, isMine);
        this.followerVisuals.set(fId, vis);
      }
      vis.container.setPosition(f.x, f.y);
      vis.hpFill.width = Math.max(0, 26 * (f.hp / f.maxHp));
    });
  }

  private createFollowerVisual(f: FollowerSnapshot, isMine: boolean): FollowerVisual {
    const roleDef = FOLLOWER_ROLES_CATALOG[f.role];
    const colorNum = Phaser.Display.Color.HexStringToColor(roleDef.color).color;

    const container = this.add.container(f.x, f.y).setDepth(18);
    const body = this.add.circle(0, 0, 12, colorNum);
    body.setStrokeStyle(2, isMine ? 0xffffff : 0xf85149);

    const hpBg = this.add.rectangle(0, -20, 26, 4, 0x21262d);
    const hpFill = this.add.rectangle(-13, -20, 26, 4, 0x3fb950).setOrigin(0, 0.5);

    const tagText = this.add
      .text(0, 16, `${roleDef.tag}`, {
        fontSize: "9px",
        fontFamily: "monospace",
        fontStyle: "bold",
        color: roleDef.color,
      })
      .setOrigin(0.5);

    container.add([body, hpBg, hpFill, tagText]);
    return { container, body, hpFill, tagText };
  }

  private sendMovementSample(me: PlayerSnapshot): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.A.isDown) dx -= 1;
    if (this.keys.D.isDown) dx += 1;
    if (this.keys.W.isDown) dy -= 1;
    if (this.keys.S.isDown) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    const pointer = this.input.activePointer;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const aimAngle = Math.atan2(worldPt.y - me.y, worldPt.x - me.x);

    this.inputSeq += 1;
    this.net.sendInput({
      seq: this.inputSeq,
      dx,
      dy,
      aimAngle,
      sprint: this.keys.SHIFT.isDown,
      blocking: pointer.rightButtonDown(),
    });
  }

  private syncWarriorVisuals(players: Map<string, PlayerSnapshot>, myId: string): void {
    const me = players.get(myId);

    for (const [id, vis] of this.visuals.entries()) {
      const p = players.get(id);
      if (!p || !p.alive) {
        vis.container.destroy();
        this.visuals.delete(id);
      }
    }

    players.forEach((player, id) => {
      if (!player.alive) return;

      let vis = this.visuals.get(id);
      if (!vis) {
        vis = this.createWarriorVisual(player, id === myId);
        this.visuals.set(id, vis);
      }

      vis.container.setPosition(player.x, player.y);
      vis.container.setAlpha(player.downed ? 0.55 : player.actionState === "dodge" ? 0.45 : 1);

      const isAlly = Boolean(me?.allyId && me.allyId === id);
      vis.allyRing.setVisible(isAlly);
      vis.downedRing.setVisible(player.downed);

      const stanceColor = STANCE_COLORS[player.stance];
      vis.stanceArc.clear();
      vis.stanceArc.lineStyle(3, stanceColor, 0.9);
      vis.stanceArc.beginPath();
      vis.stanceArc.arc(0, 0, PLAYER_RADIUS + 5, player.facingAngle - 0.65, player.facingAngle + 0.65);
      vis.stanceArc.strokePath();

      const isSwinging = player.actionState === "attack";
      const bladeAngle = isSwinging ? player.facingAngle + 0.55 : player.facingAngle - 0.45;
      const bladeLen = (isSwinging ? ATTACK_RANGE : 34) + (player.weaponTier > 1 ? 8 : 0);
      vis.weaponLine.setTo(
        Math.cos(bladeAngle) * 12,
        Math.sin(bladeAngle) * 12,
        Math.cos(bladeAngle) * bladeLen,
        Math.sin(bladeAngle) * bladeLen
      );
      vis.weaponLine.setStrokeStyle(
        player.weaponTier > 1 ? 5 : isSwinging ? 4 : 3,
        player.weaponTier > 1 ? 0xffd166 : isSwinging ? stanceColor : 0xe6edf3
      );

      vis.shieldArc.clear();
      if (player.actionState === "block") {
        vis.shieldArc.lineStyle(
          player.isParrying ? 5 : 3,
          player.isParrying ? 0xffffff : stanceColor,
          0.95
        );
        vis.shieldArc.beginPath();
        vis.shieldArc.arc(
          0,
          0,
          PLAYER_RADIUS + 11,
          player.facingAngle - ATTACK_ARC_RAD / 2,
          player.facingAngle + ATTACK_ARC_RAD / 2
        );
        vis.shieldArc.strokePath();
      }

      if (player.actionState === "stagger") {
        vis.body.setFillStyle(0xd29922);
      } else if (player.downed) {
        vis.body.setFillStyle(0x8b0000);
      } else {
        vis.body.setFillStyle(id === myId ? 0x2ea043 : isAlly ? 0x4cc9f0 : 0xda3633);
      }

      vis.hpFill.width = Math.max(0, 44 * (player.hp / player.maxHp));
      const honorBadge = player.honor >= 75 ? "★ " : player.honor < 25 ? "☠ " : "";
      vis.nameText.setText(
        player.downed
          ? `${player.name} [DOWNED ${player.downedRemainingSec}s]`
          : `${honorBadge}${player.name} (${player.kills} KO)`
      );
    });
  }

  private createWarriorVisual(player: PlayerSnapshot, isLocal: boolean): WarriorVisual {
    const container = this.add.container(player.x, player.y).setDepth(20);

    const allyRing = this.add.circle(0, 0, PLAYER_RADIUS + 9);
    allyRing.setStrokeStyle(2, 0x4cc9f0, 0.85);
    allyRing.setVisible(false);

    const downedRing = this.add.circle(0, 0, PLAYER_RADIUS + 12);
    downedRing.setStrokeStyle(2.5, 0xf85149, 0.95);
    downedRing.setVisible(false);

    const body = this.add.circle(0, 0, PLAYER_RADIUS, isLocal ? 0x2ea043 : 0xda3633);
    body.setStrokeStyle(2, 0xffffff);

    const stanceArc = this.add.graphics();
    const shieldArc = this.add.graphics();
    const weaponLine = this.add.line(0, 0, 10, 0, 34, 0, 0xe6edf3).setOrigin(0, 0);

    const hpBg = this.add.rectangle(0, -30, 44, 5, 0x21262d);
    const hpFill = this.add.rectangle(-22, -30, 44, 5, 0x3fb950).setOrigin(0, 0.5);

    const nameText = this.add
      .text(0, -42, player.name, {
        fontSize: "11px",
        fontFamily: "monospace",
        color: "#e6edf3",
      })
      .setOrigin(0.5);

    container.add([
      allyRing,
      downedRing,
      stanceArc,
      shieldArc,
      body,
      weaponLine,
      hpBg,
      hpFill,
      nameText,
    ]);
    return {
      container,
      body,
      allyRing,
      downedRing,
      stanceArc,
      weaponLine,
      shieldArc,
      hpFill,
      nameText,
    };
  }

  private drawStormOverlay(): void {
    const storm = this.net.getLatestMeta().storm;
    const g = this.stormGfx;
    g.clear();

    g.lineStyle(4, 0xbc2c66, 0.85);
    g.strokeCircle(storm.centerX, storm.centerY, storm.currentRadius);

    if (storm.status === "shrinking") {
      g.lineStyle(2, 0xd2a8ff, 0.45);
      g.strokeCircle(storm.centerX, storm.centerY, storm.nextRadius);
    }
  }

  private updateCameraFollow(players: Map<string, PlayerSnapshot>, myId: string): void {
    const me = players.get(myId);
    if (me && me.alive) {
      this.spectateTargetId = myId;
      this.cameras.main.centerOn(me.x, me.y);
      return;
    }

    const currentTarget = players.get(this.spectateTargetId);
    if (!currentTarget || !currentTarget.alive) {
      for (const [id, p] of players.entries()) {
        if (p.alive) {
          this.spectateTargetId = id;
          break;
        }
      }
    }

    const target = players.get(this.spectateTargetId);
    if (target && target.alive) {
      this.cameras.main.centerOn(target.x, target.y);
    }
  }

  private cycleSpectateTarget(): void {
    const players = this.net.getInterpolatedPlayers();
    const aliveIds: string[] = [];
    players.forEach((p, id) => {
      if (p.alive) aliveIds.push(id);
    });
    if (aliveIds.length === 0) return;

    const idx = aliveIds.indexOf(this.spectateTargetId);
    this.spectateTargetId = aliveIds[(idx + 1) % aliveIds.length];
  }

  private spawnCombatVfx(evt: {
    type: string;
    x: number;
    y: number;
    toX?: number;
    toY?: number;
    value?: number;
    label?: string;
  }): void {
    if (
      evt.type === "arrow" &&
      typeof evt.toX === "number" &&
      typeof evt.toY === "number"
    ) {
      this.arrowTrails.push({
        fromX: evt.x,
        fromY: evt.y,
        toX: evt.toX,
        toY: evt.toY,
        expiresAt: performance.now() + 180,
      });
      return;
    }

    const labelMap: Record<string, { text: string; color: string }> = {
      parry: { text: "PARRY!", color: "#ffffff" },
      block: { text: "BLOCKED", color: "#4cc9f0" },
      dodge: { text: "DODGE", color: "#a8dadc" },
      stagger: { text: evt.label ?? "GUARD BROKEN!", color: "#ffd166" },
      hit: { text: `-${evt.value ?? 40}`, color: "#ff6b6b" },
      storm: { text: evt.label ?? `-${evt.value ?? 3} STORM`, color: "#ff4d6d" },
      ko: { text: "K.O.!", color: "#ff006e" },
      gather: { text: evt.label ?? "+RESOURCE", color: "#95d5b2" },
      loot: { text: evt.label ?? "LOOTED!", color: "#ffd166" },
      heal: { text: evt.label ?? "+HEAL", color: "#3fb950" },
      craft: { text: evt.label ?? "CRAFTED!", color: "#d2a8ff" },
      rescue: { text: evt.label ?? "RESCUED!", color: "#4cc9f0" },
      follower_die: { text: evt.label ?? "FOLLOWER DIED!", color: "#f85149" },
      desert: { text: evt.label ?? "DESERTED!", color: "#f85149" },
      honor: { text: evt.label ?? "HONOR", color: "#ffd166" },
      ally: { text: evt.label ?? "ALLIANCE!", color: "#4cc9f0" },
      betray: { text: evt.label ?? "BETRAYED!", color: "#ff006e" },
      revive: { text: evt.label ?? "REVIVED!", color: "#3fb950" },
    };

    const cfg = labelMap[evt.type];
    if (!cfg) return;

    const popup = this.add
      .text(evt.x, evt.y - 24, cfg.text, {
        fontSize: "14px",
        fontFamily: "monospace",
        fontStyle: "bold",
        color: cfg.color,
        stroke: "#0d1117",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(60);

    this.tweens.add({
      targets: popup,
      y: evt.y - 62,
      alpha: 0,
      duration: 850,
      ease: "Cubic.easeOut",
      onComplete: () => popup.destroy(),
    });
  }
}
