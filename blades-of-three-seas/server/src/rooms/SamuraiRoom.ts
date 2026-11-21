import { Room, Client } from "colyseus";
import {
  AI_TICK_INTERVAL_MS,
  AI_TICK_RATE,
  ALLIANCE_INTERACT_RANGE,
  ASIA_SPAWNS,
  ATTACK_ACTIVE_MS,
  ATTACK_ARC_RAD,
  ATTACK_RANGE,
  ATTACK_RECOVERY_MS,
  ATTACK_STAMINA_COST,
  ATTACK_WINDUP_MS,
  BASE_MOVE_SPEED,
  BASE_SLASH_DAMAGE,
  BETRAYAL_STAGGER_MS,
  BLOCK_HOLD_STAMINA_PER_SEC,
  BLOCK_IMPACT_STAMINA_COST,
  BLOCK_MOVE_MULTIPLIER,
  BOAT_INTERACT_RANGE,
  BRIDGE_TOLL_COINS,
  CAMPFIRE_DURATION_MS,
  CAMPFIRE_HEAL_PER_SEC,
  CAMPFIRE_HEAL_RADIUS,
  CASTLE_CAPTURE_SECONDS,
  CHURCH_HEAL_AMOUNT,
  ClientMessage,
  CombatEventPayload,
  DAY_NIGHT_CYCLE_SEC,
  DODGE_COOLDOWN_MS,
  DODGE_DURATION_MS,
  DODGE_SPEED_MULTIPLIER,
  DODGE_STAMINA_COST,
  DOWNED_BLEEDOUT_MS,
  EUROPE_SEA_DATA,
  EXHAUSTED_MOVE_MULTIPLIER,
  ExtendedRegionId,
  FINAL_DUEL_CENTER_X,
  FINAL_DUEL_CENTER_Y,
  FOLLOWER_FLEE_HP_RATIO,
  FOLLOWER_HUNGER_DRAIN_PER_SEC,
  FOLLOWER_ROLES_CATALOG,
  FORGED_SLASH_BONUS,
  FollowerRole,
  GUARD_BREAK_STAGGER_MS,
  HIGH_HONOR_THRESHOLD,
  HONOR_BACKSTAB_LOSS,
  HONOR_BETRAYAL_LOSS,
  HONOR_FAIR_DUEL_GAIN,
  HONOR_FEED_GAIN,
  HONOR_FOLLOWER_DEATH_LOSS,
  HONOR_RESCUE_GAIN,
  HONOR_REVIVE_GAIN,
  HOSTILES_CATALOG,
  HUNGER_DRAIN_PER_SEC,
  INITIAL_HONOR,
  INN_REST_COST,
  INTERACT_COOLDOWN_MS,
  INTERACT_RANGE,
  ITEMS_CATALOG,
  InputPayload,
  LOBBY_COUNTDOWN_SEC,
  LOOT_CONTAINER_COUNT,
  LOW_HONOR_DESERT_THRESHOLD,
  LOW_HUNGER_THRESHOLD,
  MAX_ACTIVE_CAMPFIRES,
  MAX_FOLLOWERS_PER_PLAYER,
  MAX_HONOR,
  MAX_HP,
  MAX_HUNGER,
  MAX_INVENTORY_SLOTS,
  MAX_MESSAGES_PER_SEC,
  MAX_PLAYERS_PER_ROOM,
  MAX_STAMINA,
  MIN_HONOR,
  MIN_PLAYERS_TO_START,
  MOUNTAIN_TEMPLE_HEAL_PER_SEC,
  PARRY_ATTACKER_STAMINA_LOSS,
  PARRY_WINDOW_MS,
  PLAYER_RADIUS,
  PongPayload,
  RECIPES_LIST,
  RESCUE_ENCOUNTERS_LIST,
  RESCUE_ENCOUNTER_COUNT,
  RESOURCE_NODE_COUNT,
  RESOURCE_NODE_MAX_HP,
  REVIVE_RESTORE_HP,
  ResourceKind,
  SIEGE_BOATS_DATA,
  SIEGE_INTERACT_RANGE,
  SPRINT_MULTIPLIER,
  SPRINT_STAMINA_PER_SEC,
  STAGGERED_SLASH_DAMAGE,
  STAGGER_DURATION_MS,
  STAMINA_REGEN_DELAY_MS,
  STAMINA_REGEN_PER_SEC,
  STARTING_COINS,
  STARVATION_DAMAGE,
  STARVATION_INTERVAL_MS,
  STORM_DOT_INTERVAL_MS,
  STORM_STAGES,
  ServerMessage,
  TICK_INTERVAL_MS,
  TICK_RATE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  XP_PARTICIPATION,
  XP_PER_KO,
  XP_PER_PLACEMENT_STEP,
  XP_PER_SURVIVAL_SEC,
  XP_PER_TREASURE,
  XP_WINNER_BONUS,
  angleDiff,
  clamp,
  findPathAStar,
  generateRandomSpawns,
  getRegionAt,
  isValidStance,
  isWaterCoordinate,
  resolveMapCollision,
  sampleWalkablePoints,
  sanitizeInput,
} from "@bots/shared";
import {
  BattleState,
  BoatSchema,
  CampfireSchema,
  FollowerSchema,
  HostileNpcSchema,
  InventorySlotSchema,
  KillFeedEntry,
  LootContainerSchema,
  PlayerSchema,
  RescueNpcSchema,
  ResourceNodeSchema,
  SiegeWeaponSchema,
  TownNpcSchema,
  WorldPoiSchema,
} from "../schema/BattleState.js";
import { MatchResultRecord, leaderboardRepo } from "../db/leaderboard.js";
import { ChunkInterestManager } from "./ChunkInterestManager.js";

interface PlayerRuntime {
  input: InputPayload;
  msgTimestamps: number[];
  stateEndsAtMs: number;
  parryEndsAtMs: number;
  nextDodgeAtMs: number;
  nextInteractAtMs: number;
  lastStaminaUseAtMs: number;
  lastStarveTickMs: number;
  downedEndsAtMs: number;
  dodgeDirX: number;
  dodgeDirY: number;
  attackHasDealtDamage: boolean;
  participatedInMatch: boolean;
}

interface FollowerRuntime {
  nextAttackAtMs: number;
  nextHealAtMs: number;
  lastStarveTickMs: number;
  lastBlacksmithTickMs: number;
}

interface HostileRuntime {
  nextAttackAtMs: number;
  homeX: number;
  homeY: number;
}

const RESOURCE_TO_ITEM: Record<ResourceKind, string> = {
  wood: "res_wood",
  stone: "res_stone",
  iron: "res_iron",
  bamboo: "res_bamboo",
};

const ALL_ROLES: FollowerRole[] = ["fighter", "archer", "healer", "scout", "blacksmith"];

export class SamuraiRoom extends Room<BattleState> {
  maxClients = MAX_PLAYERS_PER_ROOM;

  private runtime = new Map<string, PlayerRuntime>();
  private followerRuntime = new Map<string, FollowerRuntime>();
  private hostileRuntime = new Map<string, HostileRuntime>();
  private chunkManager = new ChunkInterestManager();
  private triggeredAmbushes = new Set<string>();
  private farmerCooldowns = new Map<string, number>();
  private siegeCooldowns = new Map<string, number>();

  private tickTimestamps: number[] = [];
  private measuredHz: number = TICK_RATE;
  private aiAccumMs = 0;

  private countdownEndsAtMs = 0;
  private resultsEndsAtMs = 0;
  private matchStartedAtMs = 0;
  private initialMatchPlayers = 0;
  private killCounter = 0;
  private campfireCounter = 0;
  private followerCounter = 0;
  private campfireExpiry = new Map<string, number>();
  private lastSurvivalSecondTickMs = 0;

  private stormStageIndex = 0;
  private stormSubPhase: "hold" | "shrink" | "final" = "hold";
  private stormPhaseStartMs = 0;
  private stormPhaseEndMs = 0;
  private lastStormDotMs = 0;

  onCreate(): void {
    this.setState(new BattleState());
    this.setPatchRate(TICK_INTERVAL_MS);
    this.setSimulationInterval(() => this.fixedTick(), TICK_INTERVAL_MS);
    this.registerHandlers();
    console.log(
      `[SamuraiRoom] Room ${this.roomId} created (Sim ${TICK_RATE}Hz, Follower AI ${AI_TICK_RATE}Hz)`
    );
  }

  onJoin(client: Client, options?: { name?: unknown }): void {
    const player = new PlayerSchema();
    player.id = client.sessionId;

    const rawName = typeof options?.name === "string" ? options.name.trim() : "";
    player.name = rawName.slice(0, 16) || `Samurai_${client.sessionId.slice(0, 4)}`;

    if (this.state.phase !== "lobby") {
      player.alive = false;
      player.hp = 0;
    }

    const [spawn] = generateRandomSpawns(1);
    player.x = spawn.x;
    player.y = spawn.y;

    if (!this.state.hostId) {
      this.state.hostId = client.sessionId;
    }

    this.state.players.set(client.sessionId, player);
    this.runtime.set(client.sessionId, {
      input: { seq: 0, dx: 0, dy: 0, aimAngle: 0, sprint: false, blocking: false },
      msgTimestamps: [],
      stateEndsAtMs: 0,
      parryEndsAtMs: 0,
      nextDodgeAtMs: 0,
      nextInteractAtMs: 0,
      lastStaminaUseAtMs: 0,
      lastStarveTickMs: 0,
      downedEndsAtMs: 0,
      dodgeDirX: 1,
      dodgeDirY: 0,
      attackHasDealtDamage: false,
      participatedInMatch: false,
    });

    this.chunkManager.registerClient(client, player.x, player.y);
    this.updateRoomLock();
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player && player.alive && this.state.phase === "active") {
      this.clearPlayerAlliance(player);
      this.eliminatePlayer(player, "Disconnected", "mid");
    }

    this.chunkManager.unregisterClient(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.runtime.delete(client.sessionId);

    if (this.state.hostId === client.sessionId) {
      const nextHost = this.state.players.keys().next().value;
      this.state.hostId = nextHost ?? "";
    }

    if (this.state.phase === "active") {
      this.checkWinCondition();
    }
    this.updateRoomLock();
  }

  private registerHandlers(): void {
    this.onMessage("*", (client, type) => {
      console.warn(`[AntiCheat] Blocked unauthorized message "${String(type)}" from ${client.sessionId}`);
    });

    this.onMessage(ClientMessage.PING, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId)) return;
      const clientTime =
        typeof (raw as { clientTime?: unknown })?.clientTime === "number"
          ? (raw as { clientTime: number }).clientTime
          : Date.now();

      const pong: PongPayload = {
        clientTime,
        serverTick: this.state.serverTick,
        actualHz: this.measuredHz,
        aliveCount: this.countAlivePlayers(),
        totalCount: this.state.players.size,
      };
      client.send(ServerMessage.PONG, pong);
    });

    this.onMessage(ClientMessage.READY, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "lobby") return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.ready = Boolean((raw as { ready?: unknown })?.ready);
      this.checkAutoStartLobby();
    });

    this.onMessage(ClientMessage.START_MATCH, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "lobby") return;
      if (client.sessionId !== this.state.hostId) return;
      if (this.state.players.size < MIN_PLAYERS_TO_START) return;
      this.beginCountdown();
    });

    this.onMessage(ClientMessage.REMATCH, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "results") return;
      this.resetToLobby();
    });

    this.onMessage(ClientMessage.INPUT, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId)) return;
      const rt = this.runtime.get(client.sessionId);
      const player = this.state.players.get(client.sessionId);
      if (!rt || !player || !player.alive) return;

      const clean = sanitizeInput(raw);
      if (!clean) return;
      if (clean.seq >= rt.input.seq) {
        rt.input = clean;
      }
    });

    this.onMessage(ClientMessage.STANCE, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.downed) return;
      if (
        player.actionState === "windup" ||
        player.actionState === "attack" ||
        player.actionState === "stagger"
      ) {
        return;
      }
      const stance = (raw as { stance?: unknown })?.stance;
      if (isValidStance(stance)) {
        player.stance = stance;
      }
    });

    this.onMessage(ClientMessage.ATTACK, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      const rt = this.runtime.get(client.sessionId);
      if (!player || !rt || !player.alive || player.downed) return;
      if (player.actionState !== "idle" && player.actionState !== "block") return;
      if (player.stamina < ATTACK_STAMINA_COST) return;

      const now = performance.now();
      this.consumeStamina(player, rt, ATTACK_STAMINA_COST, now);
      player.isParrying = false;
      player.actionState = "windup";
      rt.stateEndsAtMs = now + ATTACK_WINDUP_MS;
      rt.attackHasDealtDamage = false;
    });

    this.onMessage(ClientMessage.DODGE, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      const rt = this.runtime.get(client.sessionId);
      if (!player || !rt || !player.alive || player.downed) return;

      const now = performance.now();
      if (now < rt.nextDodgeAtMs) return;
      if (player.actionState !== "idle" && player.actionState !== "block") return;
      if (player.stamina < DODGE_STAMINA_COST) return;

      this.consumeStamina(player, rt, DODGE_STAMINA_COST, now);
      player.isParrying = false;
      player.actionState = "dodge";
      rt.stateEndsAtMs = now + DODGE_DURATION_MS;
      rt.nextDodgeAtMs = now + DODGE_COOLDOWN_MS;

      if (rt.input.dx !== 0 || rt.input.dy !== 0) {
        rt.dodgeDirX = rt.input.dx;
        rt.dodgeDirY = rt.input.dy;
      } else {
        rt.dodgeDirX = Math.cos(rt.input.aimAngle);
        rt.dodgeDirY = Math.sin(rt.input.aimAngle);
      }
    });

    this.onMessage(ClientMessage.INTERACT, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      const rt = this.runtime.get(client.sessionId);
      if (!player || !rt || !player.alive || player.downed) return;

      const now = performance.now();
      if (now < rt.nextInteractAtMs) return;
      rt.nextInteractAtMs = now + INTERACT_COOLDOWN_MS;

      this.handlePlayerInteract(player, now);
    });

    this.onMessage(ClientMessage.CRAFT, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.downed) return;
      const recipeId = (raw as { recipeId?: unknown })?.recipeId;
      if (typeof recipeId === "string") {
        this.handlePlayerCraft(player, recipeId, performance.now());
      }
    });

    this.onMessage(ClientMessage.USE_ITEM, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.downed) return;
      const slotIndex = (raw as { slotIndex?: unknown })?.slotIndex;
      if (typeof slotIndex === "number" && Number.isInteger(slotIndex)) {
        this.handleUseInventoryItem(player, slotIndex);
      }
    });

    this.onMessage(ClientMessage.FEED_FOLLOWER, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.downed) return;
      const followerIndex = (raw as { followerIndex?: unknown })?.followerIndex;
      const targetIdx =
        typeof followerIndex === "number" && Number.isInteger(followerIndex) ? followerIndex : -1;
      this.handleFeedFollower(player, targetIdx);
    });

    this.onMessage(ClientMessage.ALLY_ACTION, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.downed) return;
      this.handleAllianceAction(player);
    });

    this.onMessage(ClientMessage.CREW_SIEGE, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (player && player.alive && !player.downed) {
        this.toggleSiegeCrew(player);
      }
    });

    this.onMessage(ClientMessage.FIRE_SIEGE, (client) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (player && player.alive && !player.downed) {
        this.fireCrewedSiegeWeapon(player, performance.now());
      }
    });

    this.onMessage(ClientMessage.BOAT_ACTION, (client, raw: unknown) => {
      if (!this.allowMessage(client.sessionId) || this.state.phase !== "active") return;
      const player = this.state.players.get(client.sessionId);
      if (!player || !player.alive || player.downed) return;
      const mode = (raw as { mode?: string })?.mode === "buy" ? "buy" : "rent_or_board";
      this.handleBoatInteraction(player, mode);
    });
  }

  private fixedTick(): void {
    const now = performance.now();
    const dtSec = TICK_INTERVAL_MS / 1000;
    this.state.serverTick += 1;
    this.trackServerHz(now);

    if (this.state.phase === "countdown") {
      const remaining = Math.ceil((this.countdownEndsAtMs - now) / 1000);
      this.state.countdownSec = Math.max(0, remaining);
      if (now >= this.countdownEndsAtMs) {
        this.startActiveMatch();
      }
      return;
    }

    if (this.state.phase === "results") {
      if (now >= this.resultsEndsAtMs) {
        this.resetToLobby();
      }
      return;
    }

    if (this.state.phase !== "active") return;

    this.updateDayNightCycle(now);
    this.updateStorm(now);
    this.updateCampfiresAndSurvival(now, dtSec);
    this.tickAsiaWorldSystems(now, dtSec);
    this.tickVehiclesAndSiege(dtSec);

    this.aiAccumMs += TICK_INTERVAL_MS;
    if (this.aiAccumMs >= AI_TICK_INTERVAL_MS) {
      const aiDtSec = this.aiAccumMs / 1000;
      this.aiAccumMs = 0;
      this.runAiTick10Hz(now, aiDtSec);
    }

    this.state.players.forEach((player, id) => {
      const rt = this.runtime.get(id);
      if (!rt || !player.alive) return;

      player.survivalSec = (now - this.matchStartedAtMs) / 1000;

      if (player.downed) {
        const remMs = rt.downedEndsAtMs - now;
        player.downedRemainingSec = Math.max(0, Math.ceil(remMs / 1000));
        if (remMs <= 0) {
          player.downed = false;
          this.clearPlayerAlliance(player);
          this.eliminatePlayer(player, "Bled Out", "mid");
        }
        return;
      }

      this.updatePlayerCombatState(player, rt, now, dtSec);
      this.updatePlayerMovement(player, rt, now, dtSec);
      player.lastProcessedSeq = rt.input.seq;
    });

    this.state.players.forEach((attacker, attackerId) => {
      const rt = this.runtime.get(attackerId);
      if (!rt || !attacker.alive || attacker.downed) return;
      if (attacker.actionState === "attack" && !rt.attackHasDealtDamage) {
        rt.attackHasDealtDamage = true;
        this.resolveSlashHitbox(attacker, now);
      }
    });

    this.checkWinCondition();
  }

  private tickAsiaWorldSystems(now: number, dtSec: number): void {
    const asia = this.state.asia;

    // 1. Update 3x3 chunk streaming & active spatial interest set
    this.chunkManager.rebuildActiveChunkSet(this.state, this.clients);

    // 2. Night Oni Boss lifecycle
    const isNight = this.state.dayNight.phaseOfDay === "night";
    const oniCfg = ASIA_SPAWNS.spawns.nightOniBoss;
    const existingOni = this.state.hostiles.get(oniCfg.id);

    if (isNight && !asia.oniBossActive && !existingOni) {
      const def = HOSTILES_CATALOG.oni_boss;
      const oni = new HostileNpcSchema();
      oni.id = oniCfg.id;
      oni.encounterId = "night_oni_event";
      oni.kind = "oni_boss";
      oni.name = def.name;
      oni.x = oniCfg.x;
      oni.y = oniCfg.y;
      oni.hp = def.maxHp;
      oni.maxHp = def.maxHp;
      oni.alive = true;
      this.state.hostiles.set(oni.id, oni);
      this.hostileRuntime.set(oni.id, { nextAttackAtMs: 0, homeX: oni.x, homeY: oni.y });
      asia.oniBossActive = true;

      this.emitCombatEvent({
        type: "stagger",
        x: oni.x,
        y: oni.y,
        label: "NIGHTFALL: KURO-ONI BOSS HAS AWAKENED!",
      });
    } else if (!isNight && asia.oniBossActive) {
      asia.oniBossActive = false;
      if (existingOni && existingOni.alive) {
        this.state.hostiles.delete(oniCfg.id);
        this.hostileRuntime.delete(oniCfg.id);
      }
    }

    // 3. Bandit Ambush Zones, Mountain Temple Free Healing & Japanese Castle Capture
    const mountainTemple = ASIA_SPAWNS.landmarks.find((l) => l.kind === "mountain_temple")!;
    const castle = asia.castle;
    const playersInCastle: PlayerSchema[] = [];

    this.state.players.forEach((player) => {
      if (!player.alive || player.downed) return;

      for (const amb of ASIA_SPAWNS.spawns.ambushes) {
        if (this.triggeredAmbushes.has(amb.id)) continue;
        if (Math.hypot(player.x - amb.triggerX, player.y - amb.triggerY) <= amb.triggerRadius) {
          this.triggeredAmbushes.add(amb.id);
          const def = HOSTILES_CATALOG.ambush_bandit;
          for (let i = 0; i < amb.count; i++) {
            const a = (i / amb.count) * Math.PI * 2;
            const b = new HostileNpcSchema();
            b.id = `${amb.id}_bandit_${i}`;
            b.encounterId = amb.id;
            b.kind = "ambush_bandit";
            b.name = def.name;
            b.x = amb.triggerX + Math.cos(a) * 62;
            b.y = amb.triggerY + Math.sin(a) * 62;
            b.hp = def.maxHp;
            b.maxHp = def.maxHp;
            b.alive = true;
            this.state.hostiles.set(b.id, b);
            this.hostileRuntime.set(b.id, { nextAttackAtMs: 0, homeX: b.x, homeY: b.y });
          }
          this.emitCombatEvent({
            type: "stagger",
            x: amb.triggerX,
            y: amb.triggerY,
            label: `AMBUSH! ${amb.name.toUpperCase()}!`,
            targetId: player.id,
          });
        }
      }

      if (Math.hypot(player.x - mountainTemple.x, player.y - mountainTemple.y) <= mountainTemple.radius) {
        if (player.hp < player.maxHp || player.exhausted) {
          player.hp = Math.min(player.maxHp, player.hp + MOUNTAIN_TEMPLE_HEAL_PER_SEC * dtSec);
          player.exhausted = false;
        }
      }

      if (Math.hypot(player.x - castle.x, player.y - castle.y) <= castle.radius) {
        playersInCastle.push(player);
      }
    });

    if (playersInCastle.length === 0) {
      castle.contested = false;
      if (!castle.ownerPlayerId && castle.progressSec > 0) {
        castle.progressSec = Math.max(0, castle.progressSec - dtSec * 0.5);
      }
    } else {
      const first = playersInCastle[0];
      const isContested = playersInCastle.some(
        (p) => p.id !== first.id && p.allyId !== first.id
      );
      castle.contested = isContested;

      if (!isContested && castle.ownerPlayerId !== first.id) {
        castle.capturingPlayerId = first.id;
        castle.capturingPlayerName = first.name;
        castle.progressSec = Math.min(CASTLE_CAPTURE_SECONDS, castle.progressSec + dtSec);

        if (castle.progressSec >= CASTLE_CAPTURE_SECONDS) {
          castle.ownerPlayerId = first.id;
          castle.ownerPlayerName = first.name;
          this.adjustPlayerHonor(first, 25, "CAPTURED JAPANESE CASTLE");
          first.coins += 40;
          first.weaponTier = 2;
        }
      }
    }
  }

  private tickVehiclesAndSiege(dtSec: number): void {
    // 1. Multi-player Siege Weapons (2-3 crew)
    this.state.siegeWeapons.forEach((siege) => {
      for (let i = siege.crewIds.length - 1; i >= 0; i--) {
        const p = this.state.players.get(siege.crewIds[i]);
        if (!p || !p.alive || p.downed) {
          siege.crewIds.splice(i, 1);
        }
      }

      if (siege.crewIds.length < siege.minCrew) return;
      const spec = SIEGE_BOATS_DATA.siegeWeapons[siege.kind];
      let sumDx = 0;
      let sumDy = 0;
      for (let i = 0; i < siege.crewIds.length; i++) {
        const rt = this.runtime.get(siege.crewIds[i]);
        if (rt) {
          sumDx += rt.input.dx;
          sumDy += rt.input.dy;
        }
      }
      const leaderRt = this.runtime.get(siege.crewIds[0]);
      if (leaderRt) siege.aimAngle = leaderRt.input.aimAngle;

      const mag = Math.hypot(sumDx, sumDy);
      if (mag > 0.1) {
        siege.x = clamp(siege.x + (sumDx / mag) * spec.moveSpeed * dtSec, 1580, 2980);
        siege.y = clamp(siege.y + (sumDy / mag) * spec.moveSpeed * dtSec, 64, WORLD_HEIGHT - 64);
      }

      for (let i = 0; i < siege.crewIds.length; i++) {
        const member = this.state.players.get(siege.crewIds[i]);
        if (member) {
          const sideOffset = (i - 1) * 28;
          member.x = siege.x - Math.cos(siege.aimAngle) * 24 - Math.sin(siege.aimAngle) * sideOffset;
          member.y = siege.y - Math.sin(siege.aimAngle) * 24 + Math.cos(siege.aimAngle) * sideOffset;
        }
      }
    });

    // 2. Boats across Sea & Harbor Routes
    this.state.boats.forEach((boat) => {
      for (let i = boat.passengerIds.length - 1; i >= 0; i--) {
        const p = this.state.players.get(boat.passengerIds[i]);
        if (!p || !p.alive) {
          boat.passengerIds.splice(i, 1);
        }
      }

      if (boat.passengerIds.length === 0) return;
      const captainRt = this.runtime.get(boat.passengerIds[0]);
      const spec = SIEGE_BOATS_DATA.boats[boat.kind];

      if (captainRt && (captainRt.input.dx !== 0 || captainRt.input.dy !== 0)) {
        const nx = clamp(boat.x + captainRt.input.dx * spec.speed * dtSec, 3075, WORLD_WIDTH - 48);
        const ny = clamp(boat.y + captainRt.input.dy * spec.speed * dtSec, 48, WORLD_HEIGHT - 48);
        if (isWaterCoordinate(nx, ny)) {
          boat.x = nx;
          boat.y = ny;
          boat.heading = Math.atan2(captainRt.input.dy, captainRt.input.dx);
        }
      }

      for (let i = 0; i < boat.passengerIds.length; i++) {
        const passenger = this.state.players.get(boat.passengerIds[i]);
        if (passenger) {
          passenger.x = boat.x + (i - 0.5) * 18;
          passenger.y = boat.y;
        }
      }
    });
  }

  private runAiTick10Hz(now: number, aiDtSec: number): void {
    // 1. Village Guards patrol and defend against nearby threats
    this.state.asia.townNpcs.forEach((npc) => {
      if (npc.role !== "guard") return;
      if (!this.chunkManager.isPositionInActiveInterest(npc.x, npc.y)) return;

      let nearestThreat: HostileNpcSchema | null = null;
      let bestDist = 210;
      this.state.hostiles.forEach((h) => {
        if (!h.alive) return;
        const d = Math.hypot(h.x - npc.x, h.y - npc.y);
        if (d < bestDist) {
          bestDist = d;
          nearestThreat = h;
        }
      });

      if (nearestThreat) {
        const threat = nearestThreat as HostileNpcSchema;
        if (bestDist > 54) {
          const path = findPathAStar(npc.x, npc.y, threat.x, threat.y, 160);
          const wp = path[0];
          if (wp) {
            const ang = Math.atan2(wp.y - npc.y, wp.x - npc.x);
            npc.x += Math.cos(ang) * 185 * aiDtSec;
            npc.y += Math.sin(ang) * 185 * aiDtSec;
          }
        } else {
          threat.hp = Math.max(0, threat.hp - 22 * aiDtSec);
          if (threat.hp <= 0) threat.alive = false;
        }
      }
    });

    // 2. Hostile NPCs & Bosses (culled outside active 3x3 chunk windows)
    this.state.hostiles.forEach((hostile, id) => {
      if (!hostile.alive) return;
      if (!this.chunkManager.isPositionInActiveInterest(hostile.x, hostile.y)) return;

      const hRt = this.hostileRuntime.get(id);
      const hDef = HOSTILES_CATALOG[hostile.kind];
      if (!hRt || !hDef) return;

      let targetX = hRt.homeX;
      let targetY = hRt.homeY;
      let targetPlayer: PlayerSchema | null = null;
      let targetFollower: FollowerSchema | null = null;
      let bestDist = hDef.aggroRange;

      this.state.players.forEach((p) => {
        if (!p.alive || p.downed) return;
        if (
          hostile.kind === "bridge_toll_bandit" &&
          this.state.asia.tollPaidPlayerIds.includes(p.id)
        ) {
          return;
        }
        const d = Math.hypot(p.x - hostile.x, p.y - hostile.y);
        if (d < bestDist) {
          bestDist = d;
          targetPlayer = p;
          targetFollower = null;
          targetX = p.x;
          targetY = p.y;
        }
      });

      this.state.players.forEach((p) => {
        if (!p.alive) return;
        for (let i = 0; i < p.followers.length; i++) {
          const f = p.followers[i];
          const d = Math.hypot(f.x - hostile.x, f.y - hostile.y);
          if (d < bestDist) {
            bestDist = d;
            targetFollower = f;
            targetPlayer = null;
            targetX = f.x;
            targetY = f.y;
          }
        }
      });

      if (!targetPlayer && !targetFollower && hostile.kind === "wild_boar") {
        const enc = this.state.rescueNpcs.get(hostile.encounterId);
        if (enc && !enc.rescued) {
          const angle = (now / 700) % (Math.PI * 2);
          targetX = enc.x + Math.cos(angle) * 38;
          targetY = enc.y + Math.sin(angle) * 38;
        }
      }

      const distToGoal = Math.hypot(targetX - hostile.x, targetY - hostile.y);
      const isAquatic = hostile.kind === "shark" || hostile.kind === "sea_dragon";

      if (distToGoal > hDef.attackRange - 6) {
        if (isAquatic) {
          const angle = Math.atan2(targetY - hostile.y, targetX - hostile.x);
          hostile.facingAngle = angle;
          const nx = hostile.x + Math.cos(angle) * hDef.speed * aiDtSec;
          const ny = hostile.y + Math.sin(angle) * hDef.speed * aiDtSec;
          if (isWaterCoordinate(nx, ny)) {
            hostile.x = nx;
            hostile.y = ny;
          }
        } else {
          const path = findPathAStar(hostile.x, hostile.y, targetX, targetY, 180);
          const wp = path[0];
          if (wp) {
            const angle = Math.atan2(wp.y - hostile.y, wp.x - hostile.x);
            hostile.facingAngle = angle;
            const next = resolveMapCollision(
              hostile.x + Math.cos(angle) * hDef.speed * aiDtSec,
              hostile.y + Math.sin(angle) * hDef.speed * aiDtSec,
              15
            );
            hostile.x = next.x;
            hostile.y = next.y;
          }
        }
      } else if ((targetPlayer || targetFollower) && now >= hRt.nextAttackAtMs) {
        hRt.nextAttackAtMs = now + hDef.attackCooldownMs;
        if (targetPlayer) {
          const tp = targetPlayer as PlayerSchema;
          tp.hp = Math.max(0, tp.hp - hDef.damage);
          this.emitCombatEvent({
            type: "hit",
            x: tp.x,
            y: tp.y,
            value: hDef.damage,
            targetId: tp.id,
          });
          if (tp.hp <= 0) {
            this.handleWarriorZeroHp(tp, hostile.name, "mid");
          }
        } else if (targetFollower) {
          const tf = targetFollower as FollowerSchema;
          tf.hp = Math.max(0, tf.hp - hDef.damage);
          this.emitCombatEvent({
            type: "hit",
            x: tf.x,
            y: tf.y,
            value: hDef.damage,
          });
        }
      }
    });

    // 3. Player Followers (FSM: follow -> attack -> flee -> heal + A*)
    this.state.players.forEach((player) => {
      if (!player.alive) {
        if (player.followers.length > 0) player.followers.clear();
        return;
      }

      if (player.honor < LOW_HONOR_DESERT_THRESHOLD && player.followers.length > 0) {
        this.emitCombatEvent({
          type: "desert",
          x: player.x,
          y: player.y,
          label: "LOW HONOR! FOLLOWERS DESERTED!",
          targetId: player.id,
        });
        for (let i = 0; i < player.followers.length; i++) {
          this.followerRuntime.delete(player.followers[i].id);
        }
        player.followers.clear();
        return;
      }

      const honorBonusMultiplier = player.honor >= HIGH_HONOR_THRESHOLD ? 1.15 : 1.0;

      for (let i = player.followers.length - 1; i >= 0; i--) {
        const f = player.followers[i];
        const fRt = this.followerRuntime.get(f.id);
        const roleDef = FOLLOWER_ROLES_CATALOG[f.role];
        if (!fRt || !roleDef) continue;

        f.hunger = Math.max(0, f.hunger - FOLLOWER_HUNGER_DRAIN_PER_SEC * aiDtSec);
        if (f.hunger <= 0 && now - fRt.lastStarveTickMs >= STARVATION_INTERVAL_MS) {
          fRt.lastStarveTickMs = now;
          f.hp = Math.max(0, f.hp - STARVATION_DAMAGE);
        }

        if (f.hp <= 0) {
          this.emitCombatEvent({
            type: "follower_die",
            x: f.x,
            y: f.y,
            label: `${f.name.toUpperCase()} DIED PERMANENTLY!`,
            targetId: player.id,
          });
          this.adjustPlayerHonor(player, -HONOR_FOLLOWER_DEATH_LOSS, "FOLLOWER LOST");
          this.followerRuntime.delete(f.id);
          player.followers.splice(i, 1);
          continue;
        }

        if (f.role === "blacksmith" && now - fRt.lastBlacksmithTickMs >= 5000) {
          fRt.lastBlacksmithTickMs = now;
          if (player.weaponTier < 2) {
            player.weaponTier = 2;
            this.emitCombatEvent({
              type: "craft",
              x: player.x,
              y: player.y,
              label: "BLACKSMITH FORGED BLADE!",
              targetId: player.id,
            });
          } else {
            player.stamina = Math.min(player.maxStamina, player.stamina + 12);
          }
        }

        let goalX = player.x;
        let goalY = player.y;

        let nearestEnemy: { x: number; y: number; player?: PlayerSchema; hostile?: HostileNpcSchema } | null =
          null;
        let nearestEnemyDist = roleDef.aggroRange;

        this.state.hostiles.forEach((h) => {
          if (!h.alive) return;
          const d = Math.hypot(h.x - f.x, h.y - f.y);
          if (d < nearestEnemyDist) {
            nearestEnemyDist = d;
            nearestEnemy = { x: h.x, y: h.y, hostile: h };
          }
        });

        this.state.players.forEach((other) => {
          if (other.id === player.id || !other.alive || other.downed) return;
          if (player.allyId && other.id === player.allyId) return;
          const d = Math.hypot(other.x - f.x, other.y - f.y);
          if (d < nearestEnemyDist) {
            nearestEnemyDist = d;
            nearestEnemy = { x: other.x, y: other.y, player: other };
          }
        });

        if (f.hp < f.maxHp * FOLLOWER_FLEE_HP_RATIO && nearestEnemy) {
          f.aiState = "flee";
          const awayAngle = Math.atan2(f.y - nearestEnemy.y, f.x - nearestEnemy.x);
          goalX = f.x + Math.cos(awayAngle) * 140;
          goalY = f.y + Math.sin(awayAngle) * 140;
        } else if (
          f.role === "healer" &&
          now >= fRt.nextHealAtMs &&
          player.hp < player.maxHp * 0.85 &&
          Math.hypot(player.x - f.x, player.y - f.y) <= (roleDef.healRange ?? 140) + 80
        ) {
          f.aiState = "heal";
          goalX = player.x;
          goalY = player.y;
          if (Math.hypot(player.x - f.x, player.y - f.y) <= (roleDef.healRange ?? 140)) {
            fRt.nextHealAtMs = now + (roleDef.healCooldownMs ?? 4000);
            const healAmt = Math.round((roleDef.healAmount ?? 18) * honorBonusMultiplier);
            player.hp = Math.min(player.maxHp, player.hp + healAmt);
            this.emitCombatEvent({
              type: "heal",
              x: player.x,
              y: player.y,
              value: healAmt,
              label: `+${healAmt} HEALER`,
              targetId: player.id,
            });
          }
        } else if (nearestEnemy) {
          f.aiState = "attack";
          goalX = nearestEnemy.x;
          goalY = nearestEnemy.y;

          if (nearestEnemyDist <= roleDef.attackRange && now >= fRt.nextAttackAtMs) {
            fRt.nextAttackAtMs = now + roleDef.attackCooldownMs;
            const dmg = Math.round(roleDef.damage * honorBonusMultiplier);

            if (f.role === "archer") {
              this.emitCombatEvent({
                type: "arrow",
                x: f.x,
                y: f.y,
                toX: nearestEnemy.x,
                toY: nearestEnemy.y,
              });
            }

            if (nearestEnemy.hostile) {
              nearestEnemy.hostile.hp = Math.max(0, nearestEnemy.hostile.hp - dmg);
              this.emitCombatEvent({
                type: "hit",
                x: nearestEnemy.hostile.x,
                y: nearestEnemy.hostile.y,
                value: dmg,
              });
              if (nearestEnemy.hostile.hp <= 0) {
                nearestEnemy.hostile.alive = false;
                player.coins += HOSTILES_CATALOG[nearestEnemy.hostile.kind]?.coinDrop ?? 10;
              }
            } else if (nearestEnemy.player) {
              const targetP = nearestEnemy.player;
              targetP.hp = Math.max(0, targetP.hp - dmg);
              this.emitCombatEvent({
                type: "hit",
                x: targetP.x,
                y: targetP.y,
                value: dmg,
                targetId: targetP.id,
              });
              if (targetP.hp <= 0) {
                player.kills += 1;
                this.handleWarriorZeroHp(targetP, `${player.name}'s ${roleDef.tag}`, "mid", player.id);
              }
            }
          }
        } else {
          f.aiState = "follow";
          const slotAngle = player.facingAngle + Math.PI + (i - 1) * 0.75;
          goalX = player.x + Math.cos(slotAngle) * 56;
          goalY = player.y + Math.sin(slotAngle) * 56;
        }

        const holdRangedStandoff =
          f.aiState === "attack" && f.role === "archer" && nearestEnemyDist <= roleDef.attackRange * 0.85;
        const distToGoal = Math.hypot(goalX - f.x, goalY - f.y);

        if (!holdRangedStandoff && distToGoal > 18) {
          const path = findPathAStar(f.x, f.y, goalX, goalY, 220);
          const wp = path[0];
          if (wp) {
            const moveAngle = Math.atan2(wp.y - f.y, wp.x - f.x);
            f.facingAngle = moveAngle;
            const next = resolveMapCollision(
              f.x + Math.cos(moveAngle) * roleDef.speed * aiDtSec,
              f.y + Math.sin(moveAngle) * roleDef.speed * aiDtSec,
              14,
              Boolean(player.mountedBoatId)
            );
            f.x = next.x;
            f.y = next.y;
          }
        }
      }
    });
  }

  private handlePlayerInteract(player: PlayerSchema, now: number): void {
    const region = getRegionAt(player.x);

    // 1. Revive Downed Ally
    if (player.allyId) {
      const ally = this.state.players.get(player.allyId);
      if (
        ally &&
        ally.alive &&
        ally.downed &&
        Math.hypot(player.x - ally.x, player.y - ally.y) <= INTERACT_RANGE
      ) {
        ally.downed = false;
        ally.downedRemainingSec = 0;
        ally.hp = REVIVE_RESTORE_HP;
        this.adjustPlayerHonor(player, HONOR_REVIVE_GAIN, "ALLY REVIVED!");
        this.emitCombatEvent({
          type: "revive",
          x: ally.x,
          y: ally.y,
          label: `REVIVED BY ${player.name.toUpperCase()}!`,
          targetId: ally.id,
        });
        return;
      }
    }

    // 2. Asia Bridge Toll
    const toll = ASIA_SPAWNS.spawns.bridgeToll;
    if (
      Math.hypot(player.x - toll.x, player.y - toll.y) <= 105 &&
      !this.state.asia.tollPaidPlayerIds.includes(player.id)
    ) {
      if (player.coins >= BRIDGE_TOLL_COINS) {
        player.coins -= BRIDGE_TOLL_COINS;
        this.state.asia.tollPaidPlayerIds.push(player.id);
        this.emitCombatEvent({
          type: "honor",
          x: player.x,
          y: player.y,
          label: `PAID ${BRIDGE_TOLL_COINS}g BRIDGE TOLL — SAFE PASSAGE!`,
          targetId: player.id,
        });
      } else {
        this.emitCombatEvent({
          type: "stagger",
          x: player.x,
          y: player.y,
          label: `NEED ${BRIDGE_TOLL_COINS}g FOR BRIDGE TOLL!`,
          targetId: player.id,
        });
      }
      return;
    }

    // 3. Angkor Jungle Temple Treasure
    const angkor = ASIA_SPAWNS.landmarks.find((l) => l.kind === "angkor_temple")!;
    if (
      !this.state.asia.angkorTreasureClaimed &&
      Math.hypot(player.x - angkor.x, player.y - angkor.y) <= angkor.radius
    ) {
      const boss = this.state.hostiles.get(ASIA_SPAWNS.spawns.angkorBoss.id);
      if (boss && boss.alive) {
        this.emitCombatEvent({
          type: "stagger",
          x: player.x,
          y: player.y,
          label: "DEFEAT YAMA-NAGA GUARDIAN FIRST!",
          targetId: player.id,
        });
        return;
      }
      this.state.asia.angkorTreasureClaimed = true;
      player.coins += 85;
      this.grantItemToPlayer(player, "treasure_relic", 1, "asia");
      this.emitCombatEvent({
        type: "loot",
        x: player.x,
        y: player.y,
        label: "ANGKOR TREASURE (+85g & JADE SEAL)!",
        targetId: player.id,
      });
      return;
    }

    // 4. Asia Town NPCs (Farmer, Apothecary, Blacksmith, Merchant)
    let closestTownNpc: TownNpcSchema | null = null;
    let bestTownDist = INTERACT_RANGE;
    this.state.asia.townNpcs.forEach((npc) => {
      if (npc.role === "guard") return;
      const d = Math.hypot(player.x - npc.x, player.y - npc.y);
      if (d <= bestTownDist) {
        bestTownDist = d;
        closestTownNpc = npc;
      }
    });

    if (closestTownNpc) {
      const npc = closestTownNpc as TownNpcSchema;
      if (npc.role === "farmer") {
        const nextReady = this.farmerCooldowns.get(player.id) ?? 0;
        if (now < nextReady) return;
        this.farmerCooldowns.set(player.id, now + 25000);
        this.grantItemToPlayer(player, "food_cooked", 2, "asia");
        this.emitCombatEvent({
          type: "gather",
          x: npc.x,
          y: npc.y,
          label: "FARMER: +2 RICE BALLS!",
          targetId: player.id,
        });
      } else if (npc.role === "apothecary" && player.coins >= 8) {
        player.coins -= 8;
        this.grantItemToPlayer(player, "heal_small", 2, "asia");
        this.emitCombatEvent({
          type: "heal",
          x: npc.x,
          y: npc.y,
          label: "APOTHECARY: +2 HERBS (-8g)",
          targetId: player.id,
        });
      } else if (npc.role === "blacksmith" && player.coins >= 15) {
        player.coins -= 15;
        player.weaponTier = 2;
        this.emitCombatEvent({
          type: "craft",
          x: npc.x,
          y: npc.y,
          label: "BLACKSMITH: TIER 2 KATANA (-15g)",
          targetId: player.id,
        });
      } else if (npc.role === "merchant") {
        if (this.countPlayerItem(player, "treasure_relic") > 0) {
          this.consumePlayerItem(player, "treasure_relic", 1);
          player.coins += 45;
          this.emitCombatEvent({
            type: "loot",
            x: npc.x,
            y: npc.y,
            label: "SOLD RELIC (+45g)!",
            targetId: player.id,
          });
        } else if (player.coins >= 6) {
          player.coins -= 6;
          this.grantItemToPlayer(player, "food_cooked", 1, "asia");
          this.emitCombatEvent({
            type: "loot",
            x: npc.x,
            y: npc.y,
            label: "BOUGHT RATION (-6g)",
            targetId: player.id,
          });
        }
      }
      return;
    }

    // 5. Europe & Sea POIs (Church, Inn, Castle Drawbridge, Dungeon, Lighthouse, Shipwreck)
    let targetPoi: WorldPoiSchema | null = null;
    let bestPoiDist = 9999;
    this.state.pois.forEach((poi) => {
      const d = Math.hypot(player.x - poi.x, player.y - poi.y);
      if (d <= poi.radius && d < bestPoiDist) {
        bestPoiDist = d;
        targetPoi = poi;
      }
    });

    if (targetPoi) {
      const poi = targetPoi as WorldPoiSchema;
      if (poi.kind === "church") {
        player.hp = Math.min(player.maxHp, player.hp + CHURCH_HEAL_AMOUNT);
        player.exhausted = false;
        if (player.allyId) {
          const ally = this.state.players.get(player.allyId);
          if (ally && ally.alive && ally.downed) {
            ally.downed = false;
            ally.hp = REVIVE_RESTORE_HP;
            this.adjustPlayerHonor(player, HONOR_REVIVE_GAIN, "CHURCH REVIVE");
          }
        }
        this.emitCombatEvent({
          type: "heal",
          x: poi.x,
          y: poi.y,
          label: `CHURCH BLESSING (+${CHURCH_HEAL_AMOUNT} HP)`,
          targetId: player.id,
        });
        return;
      }

      if (poi.kind === "inn") {
        if (player.coins >= INN_REST_COST) {
          player.coins -= INN_REST_COST;
          player.hunger = player.maxHunger;
          player.stamina = player.maxStamina;
          this.emitCombatEvent({
            type: "heal",
            x: poi.x,
            y: poi.y,
            label: "INN FEAST (FULL HUNGER & STAMINA)",
            targetId: player.id,
          });
        }
        return;
      }

      if (poi.kind === "stone_castle") {
        this.emitCombatEvent({
          type: poi.drawbridgeOpen ? "loot" : "stagger",
          x: poi.x,
          y: poi.y,
          label: poi.drawbridgeOpen
            ? "DRAWBRIDGE LOWERED — DUNGEON OPEN!"
            : `GATE LOCKED (${poi.gateHp}/${poi.gateMaxHp} HP) — USE RAM/BALLISTA [U]`,
          targetId: player.id,
        });
        return;
      }

      if (poi.kind === "dungeon" && !poi.looted) {
        poi.looted = true;
        player.coins += 50;
        player.weaponTier = 2;
        this.emitCombatEvent({
          type: "loot",
          x: poi.x,
          y: poi.y,
          label: "DUNGEON VAULT (+50g & TIER 2 BLADE)!",
          targetId: player.id,
        });
        return;
      }

      if (poi.kind === "lighthouse") {
        poi.beaconLit = true;
        player.seaRadarUnlocked = true;
        this.emitCombatEvent({
          type: "craft",
          x: poi.x,
          y: poi.y,
          label: "LIGHTHOUSE LIT! SEA ROUTES REVEALED!",
          targetId: player.id,
        });
        return;
      }

      if (poi.kind === "shipwreck" && !poi.looted) {
        let sharksAlive = 0;
        this.state.hostiles.forEach((h) => {
          if (h.alive && h.kind === "shark" && Math.hypot(h.x - poi.x, h.y - poi.y) < 180) {
            sharksAlive += 1;
          }
        });
        if (sharksAlive > 0) {
          this.emitCombatEvent({
            type: "stagger",
            x: poi.x,
            y: poi.y,
            label: `SLAY ${sharksAlive} REEF SHARK(S) FIRST!`,
            targetId: player.id,
          });
          return;
        }
        poi.looted = true;
        player.coins += 65;
        this.emitCombatEvent({
          type: "loot",
          x: poi.x,
          y: poi.y,
          label: "SHIPWRECK TREASURE (+65g)!",
          targetId: player.id,
        });
        return;
      }
    }

    // 6. Rescuable NPCs
    let nearestRescue: RescueNpcSchema | null = null;
    let nearestRescueDist = INTERACT_RANGE;
    this.state.rescueNpcs.forEach((npc) => {
      if (npc.rescued) return;
      const d = Math.hypot(player.x - npc.x, player.y - npc.y);
      if (d <= nearestRescueDist) {
        nearestRescueDist = d;
        nearestRescue = npc;
      }
    });

    if (nearestRescue) {
      const npc = nearestRescue as RescueNpcSchema;
      const remainingThreats = this.countAliveEncounterHostiles(npc.id);
      if (remainingThreats > 0) {
        this.emitCombatEvent({
          type: "stagger",
          x: npc.x,
          y: npc.y,
          label: `DEFEAT ${remainingThreats} THREAT(S) FIRST!`,
          targetId: player.id,
        });
        return;
      }

      npc.rescued = true;
      let honorBonus = HONOR_RESCUE_GAIN;
      if (npc.requiresMedicine && this.countPlayerItem(player, "heal_small") > 0) {
        this.consumePlayerItem(player, "heal_small", 1);
        honorBonus += 5;
      }
      this.adjustPlayerHonor(player, honorBonus, "NPC RESCUED!");

      if (player.followers.length < MAX_FOLLOWERS_PER_PLAYER) {
        this.recruitFollower(player, npc, now);
      }
      return;
    }

    // 7. Loot Containers
    let nearestChest: LootContainerSchema | null = null;
    let nearestChestDist = INTERACT_RANGE;
    this.state.lootContainers.forEach((chest) => {
      if (chest.opened) return;
      const d = Math.hypot(player.x - chest.x, player.y - chest.y);
      if (d <= nearestChestDist) {
        nearestChestDist = d;
        nearestChest = chest;
      }
    });

    if (nearestChest) {
      const chest = nearestChest as LootContainerSchema;
      chest.opened = true;
      const lootPool = ["heal_small", "food_raw", "res_iron", "treasure_relic"];
      const rolledId = lootPool[Math.floor(Math.random() * lootPool.length)];
      const added = this.grantItemToPlayer(player, rolledId, 1, chest.region);
      const skinName = ITEMS_CATALOG[rolledId].skins[chest.region].name;

      this.emitCombatEvent({
        type: "loot",
        x: chest.x,
        y: chest.y,
        label: added ? `+1 ${skinName}` : "PACK FULL!",
        targetId: player.id,
      });
      return;
    }

    // 8. Cook at Campfire
    if (player.nearCampfire && this.countPlayerItem(player, "food_raw") > 0) {
      this.handlePlayerCraft(player, "craft_cook_food", now);
      return;
    }

    // 9. Harvest Resource Node
    let nearestNode: ResourceNodeSchema | null = null;
    let nearestNodeDist = INTERACT_RANGE;
    this.state.resourceNodes.forEach((node) => {
      if (node.depleted) return;
      const d = Math.hypot(player.x - node.x, player.y - node.y);
      if (d <= nearestNodeDist) {
        nearestNodeDist = d;
        nearestNode = node;
      }
    });

    if (nearestNode) {
      this.harvestResourceNode(player, nearestNode, region);
    }
  }

  private toggleSiegeCrew(player: PlayerSchema): void {
    if (player.activeSiegeId) {
      const current = this.state.siegeWeapons.get(player.activeSiegeId);
      if (current) {
        const idx = current.crewIds.indexOf(player.id);
        if (idx >= 0) current.crewIds.splice(idx, 1);
      }
      player.activeSiegeId = "";
      return;
    }

    this.state.siegeWeapons.forEach((siege) => {
      if (player.activeSiegeId) return;
      if (
        siege.crewIds.length < siege.maxCrew &&
        Math.hypot(player.x - siege.x, player.y - siege.y) <= SIEGE_INTERACT_RANGE
      ) {
        siege.crewIds.push(player.id);
        player.activeSiegeId = siege.id;
        this.emitCombatEvent({
          type: "craft",
          x: siege.x,
          y: siege.y,
          label: `CREWING ${siege.name.toUpperCase()} (${siege.crewIds.length}/${siege.minCrew} MIN)`,
          targetId: player.id,
        });
      }
    });
  }

  private fireCrewedSiegeWeapon(player: PlayerSchema, now: number): void {
    if (!player.activeSiegeId) return;
    const siege = this.state.siegeWeapons.get(player.activeSiegeId);
    if (!siege) return;

    if (siege.crewIds.length < siege.minCrew) {
      this.emitCombatEvent({
        type: "stagger",
        x: siege.x,
        y: siege.y,
        label: `NEED ${siege.minCrew - siege.crewIds.length} MORE PLAYER(S) TO OPERATE!`,
        targetId: player.id,
      });
      return;
    }

    const spec = SIEGE_BOATS_DATA.siegeWeapons[siege.kind];
    const nextReady = this.siegeCooldowns.get(siege.id) ?? 0;
    if (now < nextReady) return;
    this.siegeCooldowns.set(siege.id, now + spec.cooldownMs);

    const tipX = siege.x + Math.cos(siege.aimAngle) * spec.range;
    const tipY = siege.y + Math.sin(siege.aimAngle) * spec.range;
    if (siege.kind === "ballista") {
      this.emitCombatEvent({ type: "arrow", x: siege.x, y: siege.y, toX: tipX, toY: tipY });
    }

    const castle = this.state.pois.get("eu_castle");
    if (castle && !castle.drawbridgeOpen) {
      if (Math.hypot(castle.x - siege.x, castle.y - siege.y) <= spec.range + 110) {
        castle.gateHp = Math.max(0, castle.gateHp - spec.structureDamage);
        this.emitCombatEvent({
          type: "hit",
          x: castle.x - 60,
          y: castle.y,
          value: spec.structureDamage,
          label: `GATE -${spec.structureDamage} (${castle.gateHp} HP)`,
        });
        if (castle.gateHp <= 0) {
          castle.drawbridgeOpen = true;
          this.emitCombatEvent({
            type: "craft",
            x: castle.x,
            y: castle.y,
            label: "CASTLE DRAWBRIDGE BREACHED!",
          });
        }
      }
    }
  }

  private handleBoatInteraction(player: PlayerSchema, mode: "rent_or_board" | "buy"): void {
    if (player.mountedBoatId) {
      const boat = this.state.boats.get(player.mountedBoatId);
      if (boat) {
        const idx = boat.passengerIds.indexOf(player.id);
        if (idx >= 0) boat.passengerIds.splice(idx, 1);
        player.x = boat.x - 42;
      }
      player.mountedBoatId = "";
      return;
    }

    this.state.boats.forEach((boat) => {
      if (player.mountedBoatId) return;
      if (Math.hypot(player.x - boat.x, player.y - boat.y) > BOAT_INTERACT_RANGE) return;

      const spec = SIEGE_BOATS_DATA.boats[boat.kind];
      if (boat.ownerId === player.id || boat.rented) {
        if (boat.passengerIds.length < spec.maxPassengers) {
          boat.passengerIds.push(player.id);
          player.mountedBoatId = boat.id;
        }
        return;
      }

      if (mode === "buy" && spec.buyCost > 0 && player.coins >= spec.buyCost) {
        player.coins -= spec.buyCost;
        boat.ownerId = player.id;
        boat.passengerIds.push(player.id);
        player.mountedBoatId = boat.id;
        this.emitCombatEvent({
          type: "craft",
          x: boat.x,
          y: boat.y,
          label: `BOUGHT ${boat.name.toUpperCase()} (-${spec.buyCost}g)`,
          targetId: player.id,
        });
      } else if (spec.rentCost > 0 && player.coins >= spec.rentCost) {
        player.coins -= spec.rentCost;
        boat.rented = true;
        boat.ownerId = player.id;
        boat.passengerIds.push(player.id);
        player.mountedBoatId = boat.id;
        this.emitCombatEvent({
          type: "craft",
          x: boat.x,
          y: boat.y,
          label: `RENTED ${boat.name.toUpperCase()} (-${spec.rentCost}g)`,
          targetId: player.id,
        });
      }
    });
  }

  private recruitFollower(player: PlayerSchema, npc: RescueNpcSchema, now: number): void {
    const roleDef = FOLLOWER_ROLES_CATALOG[npc.followerRole];
    this.followerCounter += 1;
    const fId = `fol_${this.followerCounter}`;

    const follower = new FollowerSchema();
    follower.id = fId;
    follower.ownerId = player.id;
    follower.name = npc.name.split(" ")[0];
    follower.role = npc.followerRole;
    follower.region = npc.region;
    follower.aiState = "follow";
    follower.x = npc.x;
    follower.y = npc.y;
    follower.hp = roleDef.maxHp;
    follower.maxHp = roleDef.maxHp;
    follower.hunger = 100;
    follower.maxHunger = 100;

    player.followers.push(follower);
    this.followerRuntime.set(fId, {
      nextAttackAtMs: 0,
      nextHealAtMs: 0,
      lastStarveTickMs: now,
      lastBlacksmithTickMs: now,
    });

    this.emitCombatEvent({
      type: "rescue",
      x: npc.x,
      y: npc.y,
      label: `${follower.name.toUpperCase()} (${roleDef.tag}) JOINED!`,
      targetId: player.id,
    });
  }

  private handleFeedFollower(player: PlayerSchema, targetIndex: number): void {
    if (player.followers.length === 0) return;

    let chosenIdx = targetIndex;
    if (chosenIdx < 0 || chosenIdx >= player.followers.length) {
      chosenIdx = 0;
      for (let i = 1; i < player.followers.length; i++) {
        if (player.followers[i].hunger < player.followers[chosenIdx].hunger) {
          chosenIdx = i;
        }
      }
    }

    const follower = player.followers[chosenIdx];
    if (!follower) return;

    let foodId: "food_cooked" | "food_raw" | null = null;
    if (this.countPlayerItem(player, "food_cooked") > 0) foodId = "food_cooked";
    else if (this.countPlayerItem(player, "food_raw") > 0) foodId = "food_raw";
    if (!foodId) return;

    this.consumePlayerItem(player, foodId, 1);
    const hungerGain = foodId === "food_cooked" ? 60 : 25;
    const hpGain = foodId === "food_cooked" ? 20 : 5;

    follower.hunger = Math.min(follower.maxHunger, follower.hunger + hungerGain);
    follower.hp = Math.min(follower.maxHp, follower.hp + hpGain);

    this.adjustPlayerHonor(player, HONOR_FEED_GAIN, "FED FOLLOWER");
    this.emitCombatEvent({
      type: "heal",
      x: follower.x,
      y: follower.y,
      label: `FED ${follower.name.toUpperCase()} (+${hungerGain} HUNGER)`,
      targetId: player.id,
    });
  }

  private handleAllianceAction(player: PlayerSchema): void {
    if (player.pendingAllyFromId && !player.allyId) {
      const sender = this.state.players.get(player.pendingAllyFromId);
      player.pendingAllyFromId = "";
      player.pendingAllyFromName = "";
      if (sender && sender.alive && !sender.allyId) {
        player.allyId = sender.id;
        sender.allyId = player.id;
        sender.pendingAllyFromId = "";
        sender.pendingAllyFromName = "";

        this.emitCombatEvent({
          type: "ally",
          x: player.x,
          y: player.y,
          label: `ALLIED WITH ${sender.name.toUpperCase()}!`,
          targetId: player.id,
        });
        this.emitCombatEvent({
          type: "ally",
          x: sender.x,
          y: sender.y,
          label: `ALLIED WITH ${player.name.toUpperCase()}!`,
          targetId: sender.id,
        });
        return;
      }
    }

    if (player.allyId) return;
    let nearestOther: PlayerSchema | null = null;
    let bestDist = ALLIANCE_INTERACT_RANGE;
    this.state.players.forEach((other) => {
      if (other.id === player.id || !other.alive || other.downed || other.allyId) return;
      const d = Math.hypot(other.x - player.x, other.y - player.y);
      if (d <= bestDist) {
        bestDist = d;
        nearestOther = other;
      }
    });

    if (nearestOther) {
      const target = nearestOther as PlayerSchema;
      target.pendingAllyFromId = player.id;
      target.pendingAllyFromName = player.name;
      this.emitCombatEvent({
        type: "ally",
        x: player.x,
        y: player.y,
        label: `TRUCE SENT TO ${target.name.toUpperCase()}`,
        targetId: player.id,
      });
    }
  }

  private clearPlayerAlliance(player: PlayerSchema): void {
    if (!player.allyId) return;
    const formerAlly = this.state.players.get(player.allyId);
    if (formerAlly && formerAlly.allyId === player.id) {
      formerAlly.allyId = "";
    }
    player.allyId = "";
  }

  private adjustPlayerHonor(player: PlayerSchema, delta: number, reason?: string): void {
    player.honor = clamp(player.honor + delta, MIN_HONOR, MAX_HONOR);
    if (reason) {
      const sign = delta >= 0 ? "+" : "";
      this.emitCombatEvent({
        type: "honor",
        x: player.x,
        y: player.y - 16,
        label: `${sign}${delta} HONOR (${reason})`,
        targetId: player.id,
      });
    }
  }

  private countAliveEncounterHostiles(encounterId: string): number {
    let count = 0;
    this.state.hostiles.forEach((h) => {
      if (h.alive && h.encounterId === encounterId) count += 1;
    });
    return count;
  }

  private updateDayNightCycle(now: number): void {
    const elapsedSec = ((now - this.matchStartedAtMs) / 1000) % DAY_NIGHT_CYCLE_SEC;
    const dn = this.state.dayNight;
    dn.cycleElapsedSec = Math.floor(elapsedSec);

    if (elapsedSec < 30) {
      dn.phaseOfDay = "day";
      dn.darknessAlpha = 0;
    } else if (elapsedSec < 38) {
      dn.phaseOfDay = "dusk";
      dn.darknessAlpha = ((elapsedSec - 30) / 8) * 0.65;
    } else if (elapsedSec < 52) {
      dn.phaseOfDay = "night";
      dn.darknessAlpha = 0.65;
    } else {
      dn.phaseOfDay = "dawn";
      dn.darknessAlpha = (1 - (elapsedSec - 52) / 8) * 0.65;
    }
  }

  private updateCampfiresAndSurvival(now: number, dtSec: number): void {
    for (const [fireId, expiresAt] of this.campfireExpiry.entries()) {
      const fire = this.state.campfires.get(fireId);
      if (!fire || now >= expiresAt) {
        this.state.campfires.delete(fireId);
        this.campfireExpiry.delete(fireId);
      } else {
        fire.remainingSec = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      }
    }

    const oneSecPulse = now - this.lastSurvivalSecondTickMs >= 1000;
    if (oneSecPulse) {
      this.lastSurvivalSecondTickMs = now;
    }

    this.state.players.forEach((player, id) => {
      const rt = this.runtime.get(id);
      if (!rt || !player.alive || player.downed) return;

      player.hunger = Math.max(0, player.hunger - HUNGER_DRAIN_PER_SEC * dtSec);

      let nearFire = false;
      this.state.campfires.forEach((fire) => {
        if (Math.hypot(player.x - fire.x, player.y - fire.y) <= CAMPFIRE_HEAL_RADIUS) {
          nearFire = true;
        }
      });
      player.nearCampfire = nearFire;

      if (nearFire && oneSecPulse && player.hp < player.maxHp) {
        const prevHp = player.hp;
        player.hp = Math.min(player.maxHp, player.hp + CAMPFIRE_HEAL_PER_SEC);
        const healed = Math.round(player.hp - prevHp);
        if (healed > 0) {
          this.emitCombatEvent({
            type: "heal",
            x: player.x,
            y: player.y,
            value: healed,
            label: `+${healed} WARMTH`,
            targetId: player.id,
          });
        }
      }

      if (player.hunger <= 0 && now - rt.lastStarveTickMs >= STARVATION_INTERVAL_MS) {
        rt.lastStarveTickMs = now;
        player.hp = Math.max(0, player.hp - STARVATION_DAMAGE);
        this.emitCombatEvent({
          type: "storm",
          x: player.x,
          y: player.y,
          value: STARVATION_DAMAGE,
          label: `-${STARVATION_DAMAGE} HUNGER`,
          targetId: player.id,
        });
        if (player.hp <= 0) {
          this.handleWarriorZeroHp(player, "Starvation", "mid");
        }
      }
    });
  }

  private harvestResourceNode(
    player: PlayerSchema,
    node: ResourceNodeSchema,
    region: ExtendedRegionId
  ): void {
    if (node.depleted) return;
    node.hp = Math.max(0, node.hp - 1);
    const itemId = RESOURCE_TO_ITEM[node.kind];
    const yieldCount = node.hp === 0 ? 2 : 1;
    if (node.hp === 0) node.depleted = true;

    const added = this.grantItemToPlayer(player, itemId, yieldCount, region);
    const skinName = ITEMS_CATALOG[itemId].skins[region].name;

    this.emitCombatEvent({
      type: "gather",
      x: node.x,
      y: node.y,
      label: added ? `+${yieldCount} ${skinName}` : "PACK FULL!",
      targetId: player.id,
    });
  }

  private handlePlayerCraft(player: PlayerSchema, recipeId: string, now: number): void {
    const recipe = RECIPES_LIST.find((r) => r.id === recipeId);
    if (!recipe) return;
    if (recipe.requiresCampfire && !player.nearCampfire) return;
    if (recipe.deployCampfire && this.state.campfires.size >= MAX_ACTIVE_CAMPFIRES) return;

    for (const ing of recipe.ingredients) {
      if (this.countPlayerItem(player, ing.itemId) < ing.count) return;
    }
    for (const ing of recipe.ingredients) {
      this.consumePlayerItem(player, ing.itemId, ing.count);
    }

    const region = getRegionAt(player.x);

    if (recipe.deployCampfire) {
      this.campfireCounter += 1;
      const fireId = `fire_${this.campfireCounter}`;
      const fire = new CampfireSchema();
      fire.id = fireId;
      fire.ownerName = player.name;
      fire.x = player.x + Math.cos(player.facingAngle) * 32;
      fire.y = player.y + Math.sin(player.facingAngle) * 32;
      fire.remainingSec = Math.floor(CAMPFIRE_DURATION_MS / 1000);

      this.state.campfires.set(fireId, fire);
      this.campfireExpiry.set(fireId, now + CAMPFIRE_DURATION_MS);

      this.emitCombatEvent({
        type: "craft",
        x: fire.x,
        y: fire.y,
        label: "CAMPFIRE LIT!",
        targetId: player.id,
      });
      return;
    }

    if (recipe.output) {
      const outDef = ITEMS_CATALOG[recipe.output.itemId];
      if (outDef?.weaponTier && outDef.weaponTier > player.weaponTier) {
        player.weaponTier = outDef.weaponTier;
      }
      this.grantItemToPlayer(player, recipe.output.itemId, recipe.output.count, region);
      const skinName = outDef.skins[region].name;

      this.emitCombatEvent({
        type: "craft",
        x: player.x,
        y: player.y,
        label: `CRAFTED ${skinName.toUpperCase()}`,
        targetId: player.id,
      });
    }
  }

  private handleUseInventoryItem(player: PlayerSchema, slotIndex: number): void {
    if (slotIndex < 0 || slotIndex >= player.inventory.length) return;
    const slot = player.inventory[slotIndex];
    if (!slot || slot.count <= 0) return;

    const def = ITEMS_CATALOG[slot.itemId];
    if (!def || (def.category !== "healing" && def.category !== "food")) return;

    const healAmount = def.healHp ?? 0;
    const hungerAmount = def.restoreHunger ?? 0;
    if (healAmount > 0) player.hp = Math.min(player.maxHp, player.hp + healAmount);
    if (hungerAmount > 0) player.hunger = Math.min(player.maxHunger, player.hunger + hungerAmount);

    slot.count -= 1;
    if (slot.count <= 0) player.inventory.splice(slotIndex, 1);

    this.emitCombatEvent({
      type: "heal",
      x: player.x,
      y: player.y,
      label:
        hungerAmount > 0
          ? `+${hungerAmount} HUNGER / +${healAmount} HP`
          : `+${healAmount} HP`,
      targetId: player.id,
    });
  }

  private grantItemToPlayer(
    player: PlayerSchema,
    itemId: string,
    count: number,
    skin: ExtendedRegionId
  ): boolean {
    const def = ITEMS_CATALOG[itemId];
    if (!def) return false;

    if (def.stackable) {
      for (let i = 0; i < player.inventory.length; i++) {
        const slot = player.inventory[i];
        if (slot.itemId === itemId && slot.count < def.maxStack) {
          slot.count = Math.min(def.maxStack, slot.count + count);
          return true;
        }
      }
    }

    if (player.inventory.length >= MAX_INVENTORY_SLOTS) return false;

    const newSlot = new InventorySlotSchema();
    newSlot.itemId = itemId;
    newSlot.skin = skin;
    newSlot.count = Math.min(def.maxStack, count);
    player.inventory.push(newSlot);
    return true;
  }

  private countPlayerItem(player: PlayerSchema, itemId: string): number {
    let total = 0;
    for (let i = 0; i < player.inventory.length; i++) {
      if (player.inventory[i].itemId === itemId) total += player.inventory[i].count;
    }
    return total;
  }

  private consumePlayerItem(player: PlayerSchema, itemId: string, needed: number): void {
    let remaining = needed;
    for (let i = player.inventory.length - 1; i >= 0 && remaining > 0; i--) {
      const slot = player.inventory[i];
      if (slot.itemId !== itemId) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) player.inventory.splice(i, 1);
    }
  }

  private updateStorm(now: number): void {
    const cfg = STORM_STAGES[this.stormStageIndex];
    const storm = this.state.storm;

    if (this.stormSubPhase === "hold") {
      const remainingMs = Math.max(0, this.stormPhaseEndMs - now);
      storm.timeRemainingSec = Math.ceil(remainingMs / 1000);
      storm.currentRadius = cfg.startRadius;

      if (now >= this.stormPhaseEndMs) {
        if (cfg.shrinkSec > 0) {
          this.stormSubPhase = "shrink";
          storm.status = "shrinking";
          this.stormPhaseStartMs = now;
          this.stormPhaseEndMs = now + cfg.shrinkSec * 1000;
        } else {
          this.advanceStormStage(now);
        }
      }
    } else if (this.stormSubPhase === "shrink") {
      const totalMs = Math.max(1, this.stormPhaseEndMs - this.stormPhaseStartMs);
      const elapsedMs = Math.min(totalMs, Math.max(0, now - this.stormPhaseStartMs));
      const progress = elapsedMs / totalMs;

      storm.currentRadius = cfg.startRadius + (cfg.endRadius - cfg.startRadius) * progress;
      storm.timeRemainingSec = Math.ceil((totalMs - elapsedMs) / 1000);

      if (now >= this.stormPhaseEndMs) {
        storm.currentRadius = cfg.endRadius;
        this.advanceStormStage(now);
      }
    } else {
      storm.status = "final";
      storm.timeRemainingSec = 0;
    }

    const applyDotTick = now - this.lastStormDotMs >= STORM_DOT_INTERVAL_MS;
    if (applyDotTick) this.lastStormDotMs = now;

    this.state.players.forEach((player) => {
      if (!player.alive || player.downed) {
        player.outsideStorm = false;
        return;
      }

      const dist = Math.hypot(player.x - storm.centerX, player.y - storm.centerY);
      player.outsideStorm = dist > storm.currentRadius;

      if (player.outsideStorm && applyDotTick) {
        const dmg = Math.max(1, Math.round(storm.dps * (STORM_DOT_INTERVAL_MS / 1000)));
        player.hp = Math.max(0, player.hp - dmg);
        this.emitCombatEvent({
          type: "storm",
          x: player.x,
          y: player.y,
          value: dmg,
          targetId: player.id,
        });
        if (player.hp <= 0) {
          this.handleWarriorZeroHp(player, "The Storm", "mid");
        }
      }
    });
  }

  private advanceStormStage(now: number): void {
    if (this.stormStageIndex + 1 >= STORM_STAGES.length) {
      this.stormSubPhase = "final";
      this.state.storm.status = "final";
      this.state.storm.timeRemainingSec = 0;
      return;
    }

    this.stormStageIndex += 1;
    const nextCfg = STORM_STAGES[this.stormStageIndex];
    const upcomingCfg = STORM_STAGES[Math.min(this.stormStageIndex + 1, STORM_STAGES.length - 1)];

    const storm = this.state.storm;
    storm.stage = nextCfg.stage;
    storm.label = nextCfg.label;
    storm.dps = nextCfg.dps;
    storm.currentRadius = nextCfg.startRadius;
    storm.nextRadius =
      nextCfg.endRadius !== nextCfg.startRadius ? nextCfg.endRadius : upcomingCfg.endRadius;

    if (nextCfg.holdSec > 0) {
      this.stormSubPhase = "hold";
      storm.status = "holding";
      this.stormPhaseStartMs = now;
      this.stormPhaseEndMs = now + nextCfg.holdSec * 1000;
      storm.timeRemainingSec = nextCfg.holdSec;
    } else {
      this.stormSubPhase = "shrink";
      storm.status = "shrinking";
      this.stormPhaseStartMs = now;
      this.stormPhaseEndMs = now + nextCfg.shrinkSec * 1000;
      storm.timeRemainingSec = nextCfg.shrinkSec;
    }
  }

  private updatePlayerCombatState(
    player: PlayerSchema,
    rt: PlayerRuntime,
    now: number,
    dtSec: number
  ): void {
    if (
      (player.actionState === "windup" ||
        player.actionState === "attack" ||
        player.actionState === "recovery" ||
        player.actionState === "dodge" ||
        player.actionState === "stagger") &&
      now >= rt.stateEndsAtMs
    ) {
      if (player.actionState === "windup") {
        player.actionState = "attack";
        rt.stateEndsAtMs = now + ATTACK_ACTIVE_MS;
      } else if (player.actionState === "attack") {
        player.actionState = "recovery";
        rt.stateEndsAtMs = now + ATTACK_RECOVERY_MS;
      } else {
        player.actionState = "idle";
      }
    }

    if (player.actionState === "idle" || player.actionState === "block") {
      if (rt.input.blocking && player.stamina > 0) {
        if (player.actionState !== "block") {
          player.actionState = "block";
          if (!player.exhausted) {
            rt.parryEndsAtMs = now + PARRY_WINDOW_MS;
            player.isParrying = true;
          } else {
            rt.parryEndsAtMs = 0;
            player.isParrying = false;
          }
        } else {
          player.isParrying = now < rt.parryEndsAtMs && !player.exhausted;
        }
        this.consumeStamina(player, rt, BLOCK_HOLD_STAMINA_PER_SEC * dtSec, now);
      } else if (player.actionState === "block") {
        player.actionState = "idle";
        player.isParrying = false;
      }
    } else {
      player.isParrying = false;
    }

    const isUsingStamina =
      rt.input.sprint ||
      player.actionState === "block" ||
      player.actionState === "windup" ||
      player.actionState === "attack" ||
      player.actionState === "dodge";

    if (!isUsingStamina && now - rt.lastStaminaUseAtMs >= STAMINA_REGEN_DELAY_MS) {
      const hungerMultiplier = player.hunger <= LOW_HUNGER_THRESHOLD ? 0.5 : 1.0;
      player.stamina = Math.min(
        MAX_STAMINA,
        player.stamina + STAMINA_REGEN_PER_SEC * hungerMultiplier * dtSec
      );
      if (player.exhausted && player.stamina >= 25) {
        player.exhausted = false;
      }
    }
  }

  private updatePlayerMovement(
    player: PlayerSchema,
    rt: PlayerRuntime,
    now: number,
    dtSec: number
  ): void {
    if (player.mountedBoatId || player.activeSiegeId) return;

    if (player.actionState !== "stagger" && player.actionState !== "dodge") {
      player.facingAngle = rt.input.aimAngle;
    }
    if (player.actionState === "stagger") return;

    if (player.actionState === "dodge") {
      const dodgeSpeed = BASE_MOVE_SPEED * DODGE_SPEED_MULTIPLIER;
      const next = resolveMapCollision(
        player.x + rt.dodgeDirX * dodgeSpeed * dtSec,
        player.y + rt.dodgeDirY * dodgeSpeed * dtSec,
        PLAYER_RADIUS
      );
      player.x = next.x;
      player.y = next.y;
      return;
    }

    const { dx, dy, sprint } = rt.input;
    if (dx === 0 && dy === 0) return;

    let speed = BASE_MOVE_SPEED;
    if (player.exhausted) {
      speed *= EXHAUSTED_MOVE_MULTIPLIER;
    } else if (player.actionState === "block") {
      speed *= BLOCK_MOVE_MULTIPLIER;
    } else if (sprint && player.stamina > 0 && player.actionState === "idle") {
      speed *= SPRINT_MULTIPLIER;
      this.consumeStamina(player, rt, SPRINT_STAMINA_PER_SEC * dtSec, now);
    }

    const next = resolveMapCollision(
      player.x + dx * speed * dtSec,
      player.y + dy * speed * dtSec,
      PLAYER_RADIUS
    );
    player.x = next.x;
    player.y = next.y;
  }

  private resolveSlashHitbox(attacker: PlayerSchema, now: number): void {
    const attackerRt = this.runtime.get(attacker.id)!;

    // 1. Resource Nodes
    this.state.resourceNodes.forEach((node) => {
      if (node.depleted) return;
      const dx = node.x - attacker.x;
      const dy = node.y - attacker.y;
      if (Math.hypot(dx, dy) > ATTACK_RANGE + 16) return;
      if (Math.abs(angleDiff(attacker.facingAngle, Math.atan2(dy, dx))) <= ATTACK_ARC_RAD / 2) {
        this.harvestResourceNode(attacker, node, getRegionAt(node.x));
      }
    });

    // 2. Hostiles & Bosses
    this.state.hostiles.forEach((hostile) => {
      if (!hostile.alive) return;
      const dx = hostile.x - attacker.x;
      const dy = hostile.y - attacker.y;
      if (Math.hypot(dx, dy) > ATTACK_RANGE + 28) return;
      if (Math.abs(angleDiff(attacker.facingAngle, Math.atan2(dy, dx))) <= ATTACK_ARC_RAD / 2) {
        const dmg = BASE_SLASH_DAMAGE + (attacker.weaponTier > 1 ? FORGED_SLASH_BONUS : 0);
        hostile.hp = Math.max(0, hostile.hp - dmg);
        this.emitCombatEvent({
          type: "hit",
          x: hostile.x,
          y: hostile.y,
          value: dmg,
        });
        if (hostile.hp <= 0) {
          hostile.alive = false;
          const coinReward = HOSTILES_CATALOG[hostile.kind]?.coinDrop ?? 12;
          attacker.coins += coinReward;
          this.emitCombatEvent({
            type: "loot",
            x: hostile.x,
            y: hostile.y - 16,
            label: `+${coinReward} COINS`,
            targetId: attacker.id,
          });
        }
      }
    });

    // 3. Rival Warriors
    this.state.players.forEach((target, targetId) => {
      if (targetId === attacker.id || !target.alive) return;

      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const dist = Math.hypot(dx, dy);
      if (dist > ATTACK_RANGE + PLAYER_RADIUS) return;

      const angleToTarget = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(attacker.facingAngle, angleToTarget)) > ATTACK_ARC_RAD / 2) return;

      const targetRt = this.runtime.get(targetId)!;

      if (target.actionState === "dodge") {
        this.emitCombatEvent({
          type: "dodge",
          x: target.x,
          y: target.y,
          attackerId: attacker.id,
          targetId: target.id,
        });
        return;
      }

      if (attacker.allyId && attacker.allyId === target.id) {
        this.clearPlayerAlliance(attacker);
        this.adjustPlayerHonor(attacker, -HONOR_BETRAYAL_LOSS, "ALLIANCE BETRAYAL!");
        attacker.actionState = "stagger";
        attackerRt.stateEndsAtMs = now + BETRAYAL_STAGGER_MS;
        this.emitCombatEvent({
          type: "betray",
          x: attacker.x,
          y: attacker.y,
          label: "BETRAYER! (-40 HONOR)",
          targetId: attacker.id,
        });
        return;
      }

      const stanceMatches = target.stance === attacker.stance;
      if (target.actionState === "block" && stanceMatches && target.stamina > 0 && !target.downed) {
        if (target.isParrying && !target.exhausted) {
          attacker.actionState = "stagger";
          attackerRt.stateEndsAtMs = now + STAGGER_DURATION_MS;
          this.consumeStamina(attacker, attackerRt, PARRY_ATTACKER_STAMINA_LOSS, now);
          this.emitCombatEvent({
            type: "parry",
            x: target.x,
            y: target.y,
            stance: target.stance,
            attackerId: attacker.id,
            targetId: target.id,
          });
          return;
        }

        this.consumeStamina(target, targetRt, BLOCK_IMPACT_STAMINA_COST, now);
        if (target.stamina <= 0) {
          target.actionState = "stagger";
          target.isParrying = false;
          targetRt.stateEndsAtMs = now + GUARD_BREAK_STAGGER_MS;
          this.emitCombatEvent({
            type: "stagger",
            x: target.x,
            y: target.y,
            attackerId: attacker.id,
            targetId: target.id,
          });
        } else {
          this.emitCombatEvent({
            type: "block",
            x: target.x,
            y: target.y,
            stance: target.stance,
            attackerId: attacker.id,
            targetId: target.id,
          });
        }
        return;
      }

      const isBackstab = Math.abs(angleDiff(target.facingAngle, angleToTarget)) < Math.PI / 3;
      if (isBackstab) {
        this.adjustPlayerHonor(attacker, -HONOR_BACKSTAB_LOSS, "BACKSTAB");
      }

      const weaponBonus = attacker.weaponTier > 1 ? FORGED_SLASH_BONUS : 0;
      const damage =
        (target.actionState === "stagger" || target.downed
          ? STAGGERED_SLASH_DAMAGE
          : BASE_SLASH_DAMAGE) + weaponBonus;
      target.hp = Math.max(0, target.hp - damage);

      this.emitCombatEvent({
        type: "hit",
        x: target.x,
        y: target.y,
        value: damage,
        stance: attacker.stance,
        attackerId: attacker.id,
        targetId: target.id,
      });

      if (target.hp <= 0) {
        if (!isBackstab) {
          this.adjustPlayerHonor(attacker, HONOR_FAIR_DUEL_GAIN, "HONORABLE DUEL");
        }
        attacker.kills += 1;
        this.handleWarriorZeroHp(target, attacker.name, attacker.stance, attacker.id);
      }
    });
  }

  private handleWarriorZeroHp(
    victim: PlayerSchema,
    killerName: string,
    stance: "high" | "mid" | "low",
    attackerId?: string
  ): void {
    if (!victim.alive) return;

    if (!victim.downed && victim.allyId) {
      const ally = this.state.players.get(victim.allyId);
      if (ally && ally.alive && !ally.downed) {
        victim.downed = true;
        victim.hp = 1;
        victim.downedRemainingSec = Math.ceil(DOWNED_BLEEDOUT_MS / 1000);
        const rt = this.runtime.get(victim.id);
        if (rt) rt.downedEndsAtMs = performance.now() + DOWNED_BLEEDOUT_MS;

        this.emitCombatEvent({
          type: "stagger",
          x: victim.x,
          y: victim.y,
          label: "DOWNED! ALLY CAN REVIVE [F]",
          targetId: victim.id,
        });
        return;
      }
    }

    this.clearPlayerAlliance(victim);
    this.eliminatePlayer(victim, killerName, stance, attackerId);
  }

  private eliminatePlayer(
    victim: PlayerSchema,
    killerName: string,
    stance: "high" | "mid" | "low",
    attackerId?: string
  ): void {
    if (!victim.alive) return;

    victim.placement = Math.max(2, this.countAlivePlayers());
    victim.alive = false;
    victim.downed = false;
    victim.hp = 0;
    victim.actionState = "idle";
    victim.isParrying = false;
    victim.outsideStorm = false;
    victim.nearCampfire = false;

    for (let i = 0; i < victim.followers.length; i++) {
      this.followerRuntime.delete(victim.followers[i].id);
    }
    victim.followers.clear();

    this.killCounter += 1;
    const entry = new KillFeedEntry();
    entry.id = `ko_${this.killCounter}`;
    entry.killerName = killerName;
    entry.victimName = victim.name;
    entry.stance = stance;
    this.state.killFeed.push(entry);
    if (this.state.killFeed.length > 6) this.state.killFeed.shift();

    this.emitCombatEvent({
      type: "ko",
      x: victim.x,
      y: victim.y,
      stance,
      attackerId,
      targetId: victim.id,
    });
  }

  private computePlayerXp(player: PlayerSchema): number {
    const total = Math.max(1, this.initialMatchPlayers);
    const placement = player.placement > 0 ? player.placement : total;
    const placementBonus = Math.max(1, total - placement + 1) * XP_PER_PLACEMENT_STEP;
    const winnerBonus = placement === 1 ? XP_WINNER_BONUS : 0;
    const koBonus = player.kills * XP_PER_KO;
    const survivalBonus = Math.floor(player.survivalSec) * XP_PER_SURVIVAL_SEC;
    const treasureBonus = this.countPlayerItem(player, "treasure_relic") * XP_PER_TREASURE;
    const honorBonus = player.honor >= HIGH_HONOR_THRESHOLD ? 75 : 0;
    return (
      XP_PARTICIPATION +
      placementBonus +
      winnerBonus +
      koBonus +
      survivalBonus +
      treasureBonus +
      honorBonus
    );
  }

  private consumeStamina(
    player: PlayerSchema,
    rt: PlayerRuntime,
    amount: number,
    now: number
  ): void {
    player.stamina = Math.max(0, player.stamina - amount);
    rt.lastStaminaUseAtMs = now;
    if (player.stamina <= 0) {
      player.exhausted = true;
      player.isParrying = false;
    }
  }

  private checkAutoStartLobby(): void {
    if (this.state.players.size < MIN_PLAYERS_TO_START) return;
    let allReady = true;
    this.state.players.forEach((p) => {
      if (!p.ready) allReady = false;
    });
    if (allReady) this.beginCountdown();
  }

  private beginCountdown(): void {
    this.state.phase = "countdown";
    this.state.countdownSec = LOBBY_COUNTDOWN_SEC;
    this.countdownEndsAtMs = performance.now() + LOBBY_COUNTDOWN_SEC * 1000;
    this.updateRoomLock();
  }

  private startActiveMatch(): void {
    const now = performance.now();
    this.state.phase = "active";
    this.state.winnerId = "";
    this.state.winnerName = "";
    this.state.killFeed.clear();
    this.matchStartedAtMs = now;
    this.lastSurvivalSecondTickMs = now;
    this.initialMatchPlayers = this.state.players.size;
    this.aiAccumMs = 0;

    this.state.dayNight.phaseOfDay = "day";
    this.state.dayNight.cycleElapsedSec = 0;
    this.state.dayNight.darknessAlpha = 0;

    this.stormStageIndex = 0;
    this.stormSubPhase = "hold";
    this.stormPhaseStartMs = now;
    this.stormPhaseEndMs = now + STORM_STAGES[0].holdSec * 1000;
    this.lastStormDotMs = now;

    const storm = this.state.storm;
    storm.stage = STORM_STAGES[0].stage;
    storm.label = STORM_STAGES[0].label;
    storm.status = "holding";
    storm.centerX = FINAL_DUEL_CENTER_X;
    storm.centerY = FINAL_DUEL_CENTER_Y;
    storm.currentRadius = STORM_STAGES[0].startRadius;
    storm.nextRadius = STORM_STAGES[1].endRadius;
    storm.timeRemainingSec = STORM_STAGES[0].holdSec;
    storm.dps = STORM_STAGES[0].dps;

    this.populateAllRegions();

    const spawns = generateRandomSpawns(this.state.players.size);
    let idx = 0;

    this.state.players.forEach((player, id) => {
      const spawn = spawns[idx % spawns.length];
      idx++;
      player.alive = true;
      player.downed = false;
      player.downedRemainingSec = 0;
      player.hp = MAX_HP;
      player.stamina = MAX_STAMINA;
      player.hunger = MAX_HUNGER;
      player.honor = INITIAL_HONOR;
      player.coins = STARTING_COINS;
      player.weaponTier = 1;
      player.allyId = "";
      player.pendingAllyFromId = "";
      player.pendingAllyFromName = "";
      player.activeSiegeId = "";
      player.mountedBoatId = "";
      player.seaRadarUnlocked = false;
      player.stance = "mid";
      player.actionState = "idle";
      player.isParrying = false;
      player.exhausted = false;
      player.outsideStorm = false;
      player.nearCampfire = false;
      player.kills = 0;
      player.placement = 0;
      player.survivalSec = 0;
      player.xpEarned = 0;
      player.x = spawn.x;
      player.y = spawn.y;
      player.inventory.clear();
      player.followers.clear();

      const rt = this.runtime.get(id);
      if (rt) {
        rt.stateEndsAtMs = 0;
        rt.parryEndsAtMs = 0;
        rt.nextDodgeAtMs = 0;
        rt.nextInteractAtMs = 0;
        rt.lastStarveTickMs = now;
        rt.downedEndsAtMs = 0;
        rt.participatedInMatch = true;
      }
    });

    this.chunkManager.rebuildActiveChunkSet(this.state, this.clients);
  }

  private populateAllRegions(): void {
    this.state.resourceNodes.clear();
    this.state.lootContainers.clear();
    this.state.campfires.clear();
    this.state.rescueNpcs.clear();
    this.state.hostiles.clear();
    this.state.pois.clear();
    this.state.siegeWeapons.clear();
    this.state.boats.clear();
    this.state.asia.townNpcs.clear();
    this.state.asia.tollPaidPlayerIds.clear();
    this.state.asia.angkorTreasureClaimed = false;
    this.state.asia.oniBossActive = false;

    this.campfireExpiry.clear();
    this.followerRuntime.clear();
    this.hostileRuntime.clear();
    this.triggeredAmbushes.clear();
    this.farmerCooldowns.clear();
    this.siegeCooldowns.clear();
    this.chunkManager.resetAll();

    // 1. Resources, Chests & Rescue Encounters across Asia & Europe
    const totalPoints = RESOURCE_NODE_COUNT + LOOT_CONTAINER_COUNT + RESCUE_ENCOUNTER_COUNT;
    const points = sampleWalkablePoints(totalPoints, 95);
    const kinds: ResourceKind[] = ["wood", "stone", "iron", "bamboo"];

    for (let i = 0; i < RESOURCE_NODE_COUNT && i < points.length; i++) {
      const pt = points[i];
      const node = new ResourceNodeSchema();
      node.id = `node_${i}`;
      node.kind = kinds[i % kinds.length];
      node.region = getRegionAt(pt.x);
      node.x = pt.x;
      node.y = pt.y;
      node.hp = RESOURCE_NODE_MAX_HP;
      node.maxHp = RESOURCE_NODE_MAX_HP;
      this.state.resourceNodes.set(node.id, node);
    }

    for (let j = 0; j < LOOT_CONTAINER_COUNT; j++) {
      const pt = points[RESOURCE_NODE_COUNT + j];
      if (!pt) break;
      const chest = new LootContainerSchema();
      chest.id = `chest_${j}`;
      chest.region = getRegionAt(pt.x);
      chest.x = pt.x;
      chest.y = pt.y;
      this.state.lootContainers.set(chest.id, chest);
    }

    let hostileCounter = 0;
    const addHostile = (id: string, encounterId: string, kind: HostileNpcSchema["kind"], x: number, y: number) => {
      const def = HOSTILES_CATALOG[kind];
      if (!def) return;
      const h = new HostileNpcSchema();
      h.id = id;
      h.encounterId = encounterId;
      h.kind = kind;
      h.name = def.name;
      h.x = x;
      h.y = y;
      h.hp = def.maxHp;
      h.maxHp = def.maxHp;
      h.alive = true;
      this.state.hostiles.set(h.id, h);
      this.hostileRuntime.set(h.id, { nextAttackAtMs: 0, homeX: x, homeY: y });
    };

    for (let k = 0; k < RESCUE_ENCOUNTER_COUNT; k++) {
      const pt = points[RESOURCE_NODE_COUNT + LOOT_CONTAINER_COUNT + k];
      if (!pt) break;
      const template = RESCUE_ENCOUNTERS_LIST[k % RESCUE_ENCOUNTERS_LIST.length];
      const assignedRole = ALL_ROLES[k % ALL_ROLES.length];
      const region = getRegionAt(pt.x);

      const npc = new RescueNpcSchema();
      npc.id = `rescue_${k}`;
      npc.encounterType = template.type;
      npc.followerRole = assignedRole;
      npc.region = region;
      npc.name = template.names[region];
      npc.x = pt.x;
      npc.y = pt.y;
      npc.requiresMedicine = template.requiresMedicine;
      this.state.rescueNpcs.set(npc.id, npc);

      if (template.hostileKind && template.hostileCount > 0) {
        for (let hIdx = 0; hIdx < template.hostileCount; hIdx++) {
          hostileCounter += 1;
          const angle = hIdx === 0 ? 0.4 : Math.PI - 0.4;
          addHostile(
            `rescue_hostile_${hostileCounter}`,
            npc.id,
            template.hostileKind,
            pt.x + Math.cos(angle) * 42,
            pt.y + Math.sin(angle) * 42
          );
        }
      }
    }

    // 2. Asia Landmarks, Town NPCs, Bridge Toll, Ronin Camp, Tigers & Angkor Boss
    const castleCfg = ASIA_SPAWNS.landmarks.find((l) => l.kind === "japanese_castle")!;
    this.state.asia.castle.name = castleCfg.name;
    this.state.asia.castle.x = castleCfg.x;
    this.state.asia.castle.y = castleCfg.y;
    this.state.asia.castle.radius = castleCfg.radius;
    this.state.asia.castle.progressSec = 0;
    this.state.asia.castle.targetSec = CASTLE_CAPTURE_SECONDS;
    this.state.asia.castle.ownerPlayerId = "";
    this.state.asia.castle.ownerPlayerName = "";
    this.state.asia.castle.contested = false;

    for (const tNpc of ASIA_SPAWNS.townNpcs) {
      const n = new TownNpcSchema();
      n.id = tNpc.id;
      n.role = tNpc.role as TownNpcSchema["role"];
      n.name = tNpc.name;
      n.x = tNpc.x;
      n.y = tNpc.y;
      n.serviceLabel = tNpc.serviceLabel;
      this.state.asia.townNpcs.set(n.id, n);
    }

    const toll = ASIA_SPAWNS.spawns.bridgeToll;
    for (let i = 0; i < toll.guardCount; i++) {
      addHostile(`asia_toll_${i}`, toll.id, "bridge_toll_bandit", toll.x, toll.y + (i === 0 ? -28 : 28));
    }

    const ronin = ASIA_SPAWNS.spawns.roninCamp;
    for (let i = 0; i < ronin.count; i++) {
      const a = (i / ronin.count) * Math.PI * 2;
      addHostile(`asia_ronin_${i}`, ronin.id, "ronin_outlaw", ronin.x + Math.cos(a) * 44, ronin.y + Math.sin(a) * 44);
    }

    for (const t of ASIA_SPAWNS.spawns.tigers) {
      addHostile(t.id, "asia_wildlife", "tiger", t.x, t.y);
    }

    addHostile(
      ASIA_SPAWNS.spawns.angkorBoss.id,
      "angkor_temple",
      "angkor_boss",
      ASIA_SPAWNS.spawns.angkorBoss.x,
      ASIA_SPAWNS.spawns.angkorBoss.y
    );

    // 3. Europe & Sea POIs, Siege Weapons, Boats & Hostiles/Sea Dragon Boss
    for (const p of EUROPE_SEA_DATA.pois) {
      const poi = new WorldPoiSchema();
      poi.id = p.id;
      poi.region = p.region as ExtendedRegionId;
      poi.kind = p.kind as WorldPoiSchema["kind"];
      poi.name = p.name;
      poi.x = p.x;
      poi.y = p.y;
      poi.radius = p.radius;
      poi.drawbridgeOpen = !p.hasDrawbridge;
      poi.gateHp = p.gateMaxHp ?? 0;
      poi.gateMaxHp = p.gateMaxHp ?? 0;
      this.state.pois.set(poi.id, poi);
    }

    for (const s of EUROPE_SEA_DATA.siegeSpawns) {
      const spec = SIEGE_BOATS_DATA.siegeWeapons[s.kind as "battering_ram" | "ballista"];
      const siege = new SiegeWeaponSchema();
      siege.id = s.id;
      siege.kind = spec.kind as "battering_ram" | "ballista";
      siege.name = spec.name;
      siege.x = s.x;
      siege.y = s.y;
      siege.minCrew = spec.minCrew;
      siege.maxCrew = spec.maxCrew;
      this.state.siegeWeapons.set(siege.id, siege);
    }

    for (const b of EUROPE_SEA_DATA.boatSpawns) {
      const spec = SIEGE_BOATS_DATA.boats[b.kind as "rowboat" | "caravel"];
      const boat = new BoatSchema();
      boat.id = b.id;
      boat.kind = spec.kind as "rowboat" | "caravel";
      boat.name = spec.name;
      boat.x = b.x;
      boat.y = b.y;
      boat.hp = spec.maxHp;
      boat.maxHp = spec.maxHp;
      this.state.boats.set(boat.id, boat);
    }

    for (const entry of EUROPE_SEA_DATA.spawns) {
      for (let i = 0; i < entry.count; i++) {
        hostileCounter += 1;
        addHostile(
          `eu_sea_${entry.kind}_${hostileCounter}`,
          "eu_sea_spawn",
          entry.kind as HostileNpcSchema["kind"],
          entry.x + (i - 1) * 38,
          entry.y + (i % 2 === 0 ? -24 : 24)
        );
      }
    }
  }

  private checkWinCondition(): void {
    if (this.state.phase !== "active") return;

    const alivePlayers: PlayerSchema[] = [];
    this.state.players.forEach((p) => {
      if (p.alive) alivePlayers.push(p);
    });

    const onlyAlliedDuoLeft =
      alivePlayers.length === 2 &&
      alivePlayers[0].allyId === alivePlayers[1].id &&
      !alivePlayers[0].downed &&
      !alivePlayers[1].downed;

    if (alivePlayers.length <= 1 || onlyAlliedDuoLeft) {
      const now = performance.now();
      this.state.phase = "results";
      const winner = alivePlayers[0];

      if (winner) {
        winner.placement = 1;
        winner.survivalSec = (now - this.matchStartedAtMs) / 1000;
        this.state.winnerId = winner.id;
        this.state.winnerName = onlyAlliedDuoLeft
          ? `${alivePlayers[0].name} & ${alivePlayers[1].name} (Allied Victory)`
          : winner.name;

        if (onlyAlliedDuoLeft) {
          alivePlayers[1].placement = 1;
          alivePlayers[1].survivalSec = (now - this.matchStartedAtMs) / 1000;
        }
      } else {
        this.state.winnerId = "";
        this.state.winnerName = "No Survivor";
      }

      const dbRecords: MatchResultRecord[] = [];
      this.state.players.forEach((p, id) => {
        const rt = this.runtime.get(id);
        if (!rt?.participatedInMatch) return;
        if (p.placement === 0) p.placement = Math.max(1, this.initialMatchPlayers);
        p.xpEarned = this.computePlayerXp(p);

        dbRecords.push({
          warriorName: p.name,
          won: p.placement === 1,
          kos: p.kills,
          xpEarned: p.xpEarned,
        });
      });

      void leaderboardRepo.recordMatchResults(dbRecords);
      this.resultsEndsAtMs = now + 20000;
    }
  }

  private resetToLobby(): void {
    this.state.phase = "lobby";
    this.state.winnerId = "";
    this.state.winnerName = "";
    this.state.rescueNpcs.clear();
    this.state.hostiles.clear();
    this.state.pois.clear();
    this.state.siegeWeapons.clear();
    this.state.boats.clear();
    this.state.asia.townNpcs.clear();
    this.state.players.forEach((p, id) => {
      p.ready = false;
      p.alive = true;
      p.downed = false;
      p.downedRemainingSec = 0;
      p.hp = MAX_HP;
      p.stamina = MAX_STAMINA;
      p.hunger = MAX_HUNGER;
      p.honor = INITIAL_HONOR;
      p.coins = STARTING_COINS;
      p.weaponTier = 1;
      p.allyId = "";
      p.pendingAllyFromId = "";
      p.pendingAllyFromName = "";
      p.activeSiegeId = "";
      p.mountedBoatId = "";
      p.seaRadarUnlocked = false;
      p.actionState = "idle";
      p.isParrying = false;
      p.exhausted = false;
      p.outsideStorm = false;
      p.nearCampfire = false;
      p.inventory.clear();
      p.followers.clear();
      const rt = this.runtime.get(id);
      if (rt) rt.participatedInMatch = false;
    });
    this.updateRoomLock();
  }

  private countAlivePlayers(): number {
    let count = 0;
    this.state.players.forEach((p) => {
      if (p.alive) count++;
    });
    return count;
  }

  private updateRoomLock(): void {
    if (this.state.phase === "lobby" && this.state.players.size < MAX_PLAYERS_PER_ROOM) {
      this.unlock();
    } else {
      this.lock();
    }
  }

  private emitCombatEvent(payload: CombatEventPayload): void {
    this.broadcast(ServerMessage.COMBAT_EVENT, payload);
  }

  private allowMessage(sessionId: string): boolean {
    const rt = this.runtime.get(sessionId);
    if (!rt) return false;
    const now = performance.now();
    while (rt.msgTimestamps.length > 0 && now - rt.msgTimestamps[0] > 1000) {
      rt.msgTimestamps.shift();
    }
    if (rt.msgTimestamps.length >= MAX_MESSAGES_PER_SEC) return false;
    rt.msgTimestamps.push(now);
    return true;
  }

  private trackServerHz(now: number): void {
    this.tickTimestamps.push(now);
    while (this.tickTimestamps.length > 0 && now - this.tickTimestamps[0] > 1000) {
      this.tickTimestamps.shift();
    }
    if (this.tickTimestamps.length > 1) {
      this.measuredHz = this.tickTimestamps.length;
    }
  }
}
