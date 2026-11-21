import { Client, Room } from "colyseus.js";
import {
  BoatKind,
  CLIENT_INTERPOLATION_DELAY_MS,
  ChunkLoadPayload,
  ChunkUnloadPayload,
  ClientMessage,
  CombatEventPayload,
  DayPhase,
  ExtendedRegionId,
  FINAL_DUEL_CENTER_X,
  FINAL_DUEL_CENTER_Y,
  FollowerAiState,
  FollowerRole,
  HostileKind,
  InputPayload,
  LeaderboardEntry,
  MatchPhase,
  PoiKind,
  PongPayload,
  RescueEncounterType,
  ResourceKind,
  STORM_STAGES,
  ServerMessage,
  SiegeKind,
  Stance,
  StormPhaseStatus,
  TiledChunkData,
  TownNpcRole,
  lerpAngle,
} from "@bots/shared";
import { NETWORK_SIM_CONFIG, SERVER_WS_URL } from "../config";

export interface InventorySlotSnapshot {
  itemId: string;
  skin: ExtendedRegionId;
  count: number;
}

export interface FollowerSnapshot {
  id: string;
  ownerId: string;
  name: string;
  role: FollowerRole;
  region: ExtendedRegionId;
  aiState: FollowerAiState;
  x: number;
  y: number;
  facingAngle: number;
  hp: number;
  maxHp: number;
  hunger: number;
  maxHunger: number;
}

export interface RescueNpcSnapshot {
  id: string;
  encounterType: RescueEncounterType;
  followerRole: FollowerRole;
  region: ExtendedRegionId;
  name: string;
  x: number;
  y: number;
  rescued: boolean;
  requiresMedicine: boolean;
}

export interface HostileNpcSnapshot {
  id: string;
  encounterId: string;
  kind: HostileKind;
  name: string;
  x: number;
  y: number;
  facingAngle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
}

export interface TownNpcSnapshot {
  id: string;
  role: TownNpcRole;
  name: string;
  x: number;
  y: number;
  serviceLabel: string;
}

export interface WorldPoiSnapshot {
  id: string;
  region: ExtendedRegionId;
  kind: PoiKind;
  name: string;
  x: number;
  y: number;
  radius: number;
  drawbridgeOpen: boolean;
  gateHp: number;
  gateMaxHp: number;
  beaconLit: boolean;
  looted: boolean;
}

export interface SiegeWeaponSnapshot {
  id: string;
  kind: SiegeKind;
  name: string;
  x: number;
  y: number;
  aimAngle: number;
  minCrew: number;
  maxCrew: number;
  crewIds: string[];
}

export interface BoatSnapshot {
  id: string;
  kind: BoatKind;
  name: string;
  ownerId: string;
  rented: boolean;
  x: number;
  y: number;
  heading: number;
  hp: number;
  maxHp: number;
  passengerIds: string[];
}

export interface PlayerSnapshot {
  id: string;
  name: string;
  ready: boolean;
  alive: boolean;
  downed: boolean;
  downedRemainingSec: number;
  kills: number;
  placement: number;
  survivalSec: number;
  xpEarned: number;
  x: number;
  y: number;
  facingAngle: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  maxHunger: number;
  honor: number;
  coins: number;
  weaponTier: number;
  allyId: string;
  pendingAllyFromId: string;
  pendingAllyFromName: string;
  activeSiegeId: string;
  mountedBoatId: string;
  seaRadarUnlocked: boolean;
  stance: Stance;
  actionState: string;
  isParrying: boolean;
  exhausted: boolean;
  outsideStorm: boolean;
  nearCampfire: boolean;
  inventory: InventorySlotSnapshot[];
  followers: FollowerSnapshot[];
}

export interface ResourceNodeSnapshot {
  id: string;
  kind: ResourceKind;
  region: ExtendedRegionId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  depleted: boolean;
}

export interface LootContainerSnapshot {
  id: string;
  region: ExtendedRegionId;
  x: number;
  y: number;
  opened: boolean;
}

export interface CampfireSnapshot {
  id: string;
  ownerName: string;
  x: number;
  y: number;
  remainingSec: number;
}

export interface DayNightSnapshot {
  phaseOfDay: DayPhase;
  cycleElapsedSec: number;
  darknessAlpha: number;
}

export interface StormSnapshot {
  stage: number;
  label: string;
  status: StormPhaseStatus;
  centerX: number;
  centerY: number;
  currentRadius: number;
  nextRadius: number;
  timeRemainingSec: number;
  dps: number;
}

export interface CastleCaptureSnapshot {
  name: string;
  x: number;
  y: number;
  radius: number;
  capturingPlayerId: string;
  capturingPlayerName: string;
  progressSec: number;
  targetSec: number;
  ownerPlayerId: string;
  ownerPlayerName: string;
  contested: boolean;
}

export interface RoomSnapshot {
  timestamp: number;
  phase: MatchPhase;
  countdownSec: number;
  winnerId: string;
  winnerName: string;
  hostId: string;
  storm: StormSnapshot;
  dayNight: DayNightSnapshot;
  castle: CastleCaptureSnapshot;
  angkorTreasureClaimed: boolean;
  oniBossActive: boolean;
  tollPaidPlayerIds: string[];
  players: Map<string, PlayerSnapshot>;
  resourceNodes: Map<string, ResourceNodeSnapshot>;
  lootContainers: Map<string, LootContainerSnapshot>;
  campfires: Map<string, CampfireSnapshot>;
  rescueNpcs: Map<string, RescueNpcSnapshot>;
  hostiles: Map<string, HostileNpcSnapshot>;
  townNpcs: Map<string, TownNpcSnapshot>;
  pois: Map<string, WorldPoiSnapshot>;
  siegeWeapons: Map<string, SiegeWeaponSnapshot>;
  boats: Map<string, BoatSnapshot>;
  killFeed: Array<{ id: string; killerName: string; victimName: string; stance: Stance }>;
}

const DEFAULT_STORM: StormSnapshot = {
  stage: 1,
  label: STORM_STAGES[0].label,
  status: "holding",
  centerX: FINAL_DUEL_CENTER_X,
  centerY: FINAL_DUEL_CENTER_Y,
  currentRadius: STORM_STAGES[0].startRadius,
  nextRadius: STORM_STAGES[1].endRadius,
  timeRemainingSec: STORM_STAGES[0].holdSec,
  dps: STORM_STAGES[0].dps,
};

const DEFAULT_DAY_NIGHT: DayNightSnapshot = {
  phaseOfDay: "day",
  cycleElapsedSec: 0,
  darknessAlpha: 0,
};

const DEFAULT_CASTLE: CastleCaptureSnapshot = {
  name: "Himeji-style Tenshu Castle",
  x: 1152,
  y: 240,
  radius: 120,
  capturingPlayerId: "",
  capturingPlayerName: "",
  progressSec: 0,
  targetSec: 60,
  ownerPlayerId: "",
  ownerPlayerName: "",
  contested: false,
};

export class NetworkClient {
  private client: Client;
  private room: Room | null = null;

  public simulateBadNetwork: boolean = NETWORK_SIM_CONFIG.ENABLED_ON_BOOT;
  public rttMs: number = 0;
  public serverTick: number = 0;
  public serverHz: number = 0;
  public aliveCount: number = 0;
  public totalCount: number = 0;
  public roomId: string = "";

  private snapshotBuffer: RoomSnapshot[] = [];
  private latestMeta: Omit<RoomSnapshot, "timestamp" | "players"> = {
    phase: "lobby",
    countdownSec: 0,
    winnerId: "",
    winnerName: "",
    hostId: "",
    storm: DEFAULT_STORM,
    dayNight: DEFAULT_DAY_NIGHT,
    castle: DEFAULT_CASTLE,
    angkorTreasureClaimed: false,
    oniBossActive: false,
    tollPaidPlayerIds: [],
    resourceNodes: new Map(),
    lootContainers: new Map(),
    campfires: new Map(),
    rescueNpcs: new Map(),
    hostiles: new Map(),
    townNpcs: new Map(),
    pois: new Map(),
    siegeWeapons: new Map(),
    boats: new Map(),
    killFeed: [],
  };

  private pingTimer: number | null = null;
  private combatListeners: Array<(evt: CombatEventPayload) => void> = [];
  private chunkLoadListeners: Array<(chunks: TiledChunkData[]) => void> = [];
  private chunkUnloadListeners: Array<(keys: string[]) => void> = [];

  constructor() {
    this.client = new Client(SERVER_WS_URL);
  }

  get sessionId(): string {
    return this.room?.sessionId ?? "";
  }

  get isConnected(): boolean {
    return this.room !== null;
  }

  onCombatEvent(cb: (evt: CombatEventPayload) => void): void {
    this.combatListeners.push(cb);
  }

  onChunkLoad(cb: (chunks: TiledChunkData[]) => void): void {
    this.chunkLoadListeners.push(cb);
  }

  onChunkUnload(cb: (keys: string[]) => void): void {
    this.chunkUnloadListeners.push(cb);
  }

  async joinOrCreate(playerName: string, targetRoomId?: string): Promise<void> {
    if (this.room) await this.room.leave();
    this.snapshotBuffer = [];

    if (targetRoomId && targetRoomId.trim().length > 0) {
      this.room = await this.client.joinById(targetRoomId.trim(), { name: playerName });
    } else {
      this.room = await this.client.joinOrCreate("samurai_duel", { name: playerName });
    }

    this.roomId = this.room.roomId;

    this.room.onStateChange((state: any) => {
      this.captureSnapshot(state);
    });

    this.room.onMessage(ServerMessage.PONG, (pong: PongPayload) => {
      this.rttMs = Math.max(0, Math.round(performance.now() - pong.clientTime));
      this.serverTick = pong.serverTick;
      this.serverHz = pong.actualHz;
      this.aliveCount = pong.aliveCount;
      this.totalCount = pong.totalCount;
    });

    this.room.onMessage(ServerMessage.COMBAT_EVENT, (evt: CombatEventPayload) => {
      for (const cb of this.combatListeners) cb(evt);
    });

    this.room.onMessage(ServerMessage.CHUNK_LOAD, (payload: ChunkLoadPayload) => {
      for (const cb of this.chunkLoadListeners) cb(payload.chunks);
    });

    this.room.onMessage(ServerMessage.CHUNK_UNLOAD, (payload: ChunkUnloadPayload) => {
      for (const cb of this.chunkUnloadListeners) cb(payload.chunkKeys);
    });

    this.room.onLeave(() => {
      this.room = null;
      if (this.pingTimer !== null) {
        clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
    });

    this.startPingLoop();
  }

  async fetchLeaderboard(): Promise<{ source: string; rows: LeaderboardEntry[] }> {
    const httpBase = SERVER_WS_URL.replace(/^ws/, "http");
    try {
      const resp = await fetch(`${httpBase}/api/leaderboard`);
      if (!resp.ok) throw new Error("Failed");
      return (await resp.json()) as { source: string; rows: LeaderboardEntry[] };
    } catch {
      return { source: "offline", rows: [] };
    }
  }

  private captureSnapshot(state: any): void {
    const players = new Map<string, PlayerSnapshot>();
    let alive = 0;

    state.players?.forEach((p: any, key: string) => {
      if (p.alive) alive++;
      const inventory: InventorySlotSnapshot[] = [];
      p.inventory?.forEach((slot: any) => {
        inventory.push({
          itemId: slot.itemId,
          skin: slot.skin,
          count: slot.count,
        });
      });

      const followers: FollowerSnapshot[] = [];
      p.followers?.forEach((f: any) => {
        followers.push({
          id: f.id,
          ownerId: f.ownerId,
          name: f.name,
          role: f.role,
          region: f.region,
          aiState: f.aiState,
          x: f.x,
          y: f.y,
          facingAngle: f.facingAngle,
          hp: f.hp,
          maxHp: f.maxHp,
          hunger: f.hunger,
          maxHunger: f.maxHunger,
        });
      });

      players.set(key, {
        id: p.id,
        name: p.name,
        ready: p.ready,
        alive: p.alive,
        downed: p.downed,
        downedRemainingSec: p.downedRemainingSec,
        kills: p.kills,
        placement: p.placement,
        survivalSec: p.survivalSec,
        xpEarned: p.xpEarned,
        x: p.x,
        y: p.y,
        facingAngle: p.facingAngle,
        hp: p.hp,
        maxHp: p.maxHp,
        stamina: p.stamina,
        maxStamina: p.maxStamina,
        hunger: p.hunger,
        maxHunger: p.maxHunger,
        honor: p.honor,
        coins: p.coins,
        weaponTier: p.weaponTier,
        allyId: p.allyId,
        pendingAllyFromId: p.pendingAllyFromId,
        pendingAllyFromName: p.pendingAllyFromName,
        activeSiegeId: p.activeSiegeId,
        mountedBoatId: p.mountedBoatId,
        seaRadarUnlocked: p.seaRadarUnlocked,
        stance: p.stance,
        actionState: p.actionState,
        isParrying: p.isParrying,
        exhausted: p.exhausted,
        outsideStorm: p.outsideStorm,
        nearCampfire: p.nearCampfire,
        inventory,
        followers,
      });
    });

    this.aliveCount = alive;
    this.totalCount = players.size;

    const resourceNodes = new Map<string, ResourceNodeSnapshot>();
    state.resourceNodes?.forEach((n: any, key: string) => {
      resourceNodes.set(key, {
        id: n.id,
        kind: n.kind,
        region: n.region,
        x: n.x,
        y: n.y,
        hp: n.hp,
        maxHp: n.maxHp,
        depleted: n.depleted,
      });
    });

    const lootContainers = new Map<string, LootContainerSnapshot>();
    state.lootContainers?.forEach((c: any, key: string) => {
      lootContainers.set(key, {
        id: c.id,
        region: c.region,
        x: c.x,
        y: c.y,
        opened: c.opened,
      });
    });

    const campfires = new Map<string, CampfireSnapshot>();
    state.campfires?.forEach((f: any, key: string) => {
      campfires.set(key, {
        id: f.id,
        ownerName: f.ownerName,
        x: f.x,
        y: f.y,
        remainingSec: f.remainingSec,
      });
    });

    const rescueNpcs = new Map<string, RescueNpcSnapshot>();
    state.rescueNpcs?.forEach((r: any, key: string) => {
      rescueNpcs.set(key, {
        id: r.id,
        encounterType: r.encounterType,
        followerRole: r.followerRole,
        region: r.region,
        name: r.name,
        x: r.x,
        y: r.y,
        rescued: r.rescued,
        requiresMedicine: r.requiresMedicine,
      });
    });

    const hostiles = new Map<string, HostileNpcSnapshot>();
    state.hostiles?.forEach((h: any, key: string) => {
      hostiles.set(key, {
        id: h.id,
        encounterId: h.encounterId,
        kind: h.kind,
        name: h.name,
        x: h.x,
        y: h.y,
        facingAngle: h.facingAngle,
        hp: h.hp,
        maxHp: h.maxHp,
        alive: h.alive,
      });
    });

    const townNpcs = new Map<string, TownNpcSnapshot>();
    state.asia?.townNpcs?.forEach((n: any, key: string) => {
      townNpcs.set(key, {
        id: n.id,
        role: n.role,
        name: n.name,
        x: n.x,
        y: n.y,
        serviceLabel: n.serviceLabel,
      });
    });

    const pois = new Map<string, WorldPoiSnapshot>();
    state.pois?.forEach((p: any, key: string) => {
      pois.set(key, {
        id: p.id,
        region: p.region,
        kind: p.kind,
        name: p.name,
        x: p.x,
        y: p.y,
        radius: p.radius,
        drawbridgeOpen: p.drawbridgeOpen,
        gateHp: p.gateHp,
        gateMaxHp: p.gateMaxHp,
        beaconLit: p.beaconLit,
        looted: p.looted,
      });
    });

    const siegeWeapons = new Map<string, SiegeWeaponSnapshot>();
    state.siegeWeapons?.forEach((s: any, key: string) => {
      const crewIds: string[] = [];
      s.crewIds?.forEach((cid: string) => crewIds.push(cid));
      siegeWeapons.set(key, {
        id: s.id,
        kind: s.kind,
        name: s.name,
        x: s.x,
        y: s.y,
        aimAngle: s.aimAngle,
        minCrew: s.minCrew,
        maxCrew: s.maxCrew,
        crewIds,
      });
    });

    const boats = new Map<string, BoatSnapshot>();
    state.boats?.forEach((b: any, key: string) => {
      const passengerIds: string[] = [];
      b.passengerIds?.forEach((pid: string) => passengerIds.push(pid));
      boats.set(key, {
        id: b.id,
        kind: b.kind,
        name: b.name,
        ownerId: b.ownerId,
        rented: b.rented,
        x: b.x,
        y: b.y,
        heading: b.heading,
        hp: b.hp,
        maxHp: b.maxHp,
        passengerIds,
      });
    });

    const killFeed: RoomSnapshot["killFeed"] = [];
    state.killFeed?.forEach((k: any) => {
      killFeed.push({
        id: k.id,
        killerName: k.killerName,
        victimName: k.victimName,
        stance: k.stance,
      });
    });

    const storm: StormSnapshot = state.storm
      ? {
          stage: state.storm.stage,
          label: state.storm.label,
          status: state.storm.status,
          centerX: state.storm.centerX,
          centerY: state.storm.centerY,
          currentRadius: state.storm.currentRadius,
          nextRadius: state.storm.nextRadius,
          timeRemainingSec: state.storm.timeRemainingSec,
          dps: state.storm.dps,
        }
      : DEFAULT_STORM;

    const dayNight: DayNightSnapshot = state.dayNight
      ? {
          phaseOfDay: state.dayNight.phaseOfDay,
          cycleElapsedSec: state.dayNight.cycleElapsedSec,
          darknessAlpha: state.dayNight.darknessAlpha,
        }
      : DEFAULT_DAY_NIGHT;

    const castle: CastleCaptureSnapshot = state.asia?.castle
      ? {
          name: state.asia.castle.name,
          x: state.asia.castle.x,
          y: state.asia.castle.y,
          radius: state.asia.castle.radius,
          capturingPlayerId: state.asia.castle.capturingPlayerId,
          capturingPlayerName: state.asia.castle.capturingPlayerName,
          progressSec: state.asia.castle.progressSec,
          targetSec: state.asia.castle.targetSec,
          ownerPlayerId: state.asia.castle.ownerPlayerId,
          ownerPlayerName: state.asia.castle.ownerPlayerName,
          contested: state.asia.castle.contested,
        }
      : DEFAULT_CASTLE;

    const tollPaidPlayerIds: string[] = [];
    state.asia?.tollPaidPlayerIds?.forEach((pid: string) => tollPaidPlayerIds.push(pid));

    this.latestMeta = {
      phase: state.phase,
      countdownSec: state.countdownSec,
      winnerId: state.winnerId,
      winnerName: state.winnerName,
      hostId: state.hostId,
      storm,
      dayNight,
      castle,
      angkorTreasureClaimed: Boolean(state.asia?.angkorTreasureClaimed),
      oniBossActive: Boolean(state.asia?.oniBossActive),
      tollPaidPlayerIds,
      resourceNodes,
      lootContainers,
      campfires,
      rescueNpcs,
      hostiles,
      townNpcs,
      pois,
      siegeWeapons,
      boats,
      killFeed,
    };

    const snap: RoomSnapshot = {
      timestamp: performance.now(),
      ...this.latestMeta,
      players,
    };

    this.snapshotBuffer.push(snap);
    while (this.snapshotBuffer.length > 30) {
      this.snapshotBuffer.shift();
    }
  }

  getLatestMeta() {
    return this.latestMeta;
  }

  getInterpolatedPlayers(): Map<string, PlayerSnapshot> {
    if (this.snapshotBuffer.length === 0) return new Map();
    if (this.snapshotBuffer.length === 1) return this.snapshotBuffer[0].players;

    const renderTime = performance.now() - CLIENT_INTERPOLATION_DELAY_MS;
    let older = this.snapshotBuffer[0];
    let newer = this.snapshotBuffer[this.snapshotBuffer.length - 1];

    for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
      if (
        this.snapshotBuffer[i].timestamp <= renderTime &&
        this.snapshotBuffer[i + 1].timestamp >= renderTime
      ) {
        older = this.snapshotBuffer[i];
        newer = this.snapshotBuffer[i + 1];
        break;
      }
    }

    const span = Math.max(1, newer.timestamp - older.timestamp);
    const t = Math.max(0, Math.min(1, (renderTime - older.timestamp) / span));

    const result = new Map<string, PlayerSnapshot>();
    newer.players.forEach((newP, id) => {
      const oldP = older.players.get(id);
      if (!oldP) {
        result.set(id, newP);
        return;
      }

      const followers = newP.followers.map((nf) => {
        const of = oldP.followers.find((item) => item.id === nf.id);
        if (!of) return nf;
        return {
          ...nf,
          x: of.x + (nf.x - of.x) * t,
          y: of.y + (nf.y - of.y) * t,
          facingAngle: lerpAngle(of.facingAngle, nf.facingAngle, t),
        };
      });

      result.set(id, {
        ...newP,
        x: oldP.x + (newP.x - oldP.x) * t,
        y: oldP.y + (newP.y - oldP.y) * t,
        facingAngle: lerpAngle(oldP.facingAngle, newP.facingAngle, t),
        followers,
      });
    });

    return result;
  }

  sendInput(payload: InputPayload): void {
    this.sendWithOptionalNetSim(ClientMessage.INPUT, payload, true);
  }
  sendStance(stance: Stance): void {
    this.sendWithOptionalNetSim(ClientMessage.STANCE, { stance }, false);
  }
  sendAttack(): void {
    this.sendWithOptionalNetSim(ClientMessage.ATTACK, {}, false);
  }
  sendDodge(): void {
    this.sendWithOptionalNetSim(ClientMessage.DODGE, {}, false);
  }
  sendInteract(): void {
    this.sendWithOptionalNetSim(ClientMessage.INTERACT, {}, false);
  }
  sendCraft(recipeId: string): void {
    this.sendWithOptionalNetSim(ClientMessage.CRAFT, { recipeId }, false);
  }
  sendUseItem(slotIndex: number): void {
    this.sendWithOptionalNetSim(ClientMessage.USE_ITEM, { slotIndex }, false);
  }
  sendFeedFollower(followerIndex?: number): void {
    this.sendWithOptionalNetSim(ClientMessage.FEED_FOLLOWER, { followerIndex }, false);
  }
  sendAllyAction(): void {
    this.sendWithOptionalNetSim(ClientMessage.ALLY_ACTION, {}, false);
  }
  sendCrewSiege(): void {
    this.sendWithOptionalNetSim(ClientMessage.CREW_SIEGE, {}, false);
  }
  sendFireSiege(): void {
    this.sendWithOptionalNetSim(ClientMessage.FIRE_SIEGE, {}, false);
  }
  sendBoatAction(mode: "rent_or_board" | "buy"): void {
    this.sendWithOptionalNetSim(ClientMessage.BOAT_ACTION, { mode }, false);
  }
  sendReady(ready: boolean): void {
    this.room?.send(ClientMessage.READY, { ready });
  }
  sendStartMatch(): void {
    this.room?.send(ClientMessage.START_MATCH, {});
  }
  sendRematch(): void {
    this.room?.send(ClientMessage.REMATCH, {});
  }

  private sendWithOptionalNetSim(type: string, data: unknown, droppable: boolean): void {
    if (!this.room) return;
    if (!this.simulateBadNetwork) {
      this.room.send(type, data);
      return;
    }
    if (droppable && Math.random() < NETWORK_SIM_CONFIG.PACKET_LOSS_RATE) return;
    const minOneWay = NETWORK_SIM_CONFIG.MIN_RTT_MS / 2;
    const maxOneWay = NETWORK_SIM_CONFIG.MAX_RTT_MS / 2;
    const delayMs = minOneWay + Math.random() * (maxOneWay - minOneWay);
    window.setTimeout(() => {
      this.room?.send(type, data);
    }, delayMs);
  }

  private startPingLoop(): void {
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    this.pingTimer = window.setInterval(() => {
      this.room?.send(ClientMessage.PING, { clientTime: performance.now() });
    }, 500);
  }
}
