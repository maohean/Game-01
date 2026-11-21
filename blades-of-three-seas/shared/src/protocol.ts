import itemsFile from "./data/items.json" with { type: "json" };
import recipesFile from "./data/recipes.json" with { type: "json" };
import npcsFile from "./data/npcs.json" with { type: "json" };
import tilesetsSkinsFile from "./data/tilesets_skins.json" with { type: "json" };
import europeSeaSpawnsFile from "./data/europe_sea_spawns.json" with { type: "json" };
import siegeBoatsFile from "./data/siege_boats.json" with { type: "json" };
import { TiledChunkData } from "./chunkMap.js";

export type Stance = "high" | "mid" | "low";
export type ExtendedRegionId = "asia" | "europe" | "sea";
export type RegionId = ExtendedRegionId;
export type ItemColor = "green" | "orange" | "grey" | "yellow";
export type ItemCategory = "resource" | "healing" | "food" | "weapon" | "treasure";
export type ResourceKind = "wood" | "stone" | "iron" | "bamboo";
export type DayPhase = "day" | "dusk" | "night" | "dawn";

export type FollowerRole = "fighter" | "archer" | "healer" | "scout" | "blacksmith";
export type FollowerAiState = "follow" | "attack" | "flee" | "heal";
export type RescueEncounterType = "villager_beast" | "bandit_prisoner" | "injured_traveler";
export type TownNpcRole = "farmer" | "apothecary" | "blacksmith" | "merchant" | "guard";

export type HostileKind =
  | "wild_boar"
  | "bandit_raider"
  | "ambush_bandit"
  | "bridge_toll_bandit"
  | "ronin_outlaw"
  | "tiger"
  | "angkor_boss"
  | "oni_boss"
  | "wolf"
  | "bear"
  | "forest_bandit"
  | "shark"
  | "pirate_raider"
  | "sea_dragon";

export type PoiKind =
  | "oak_forest"
  | "medieval_village"
  | "windmill"
  | "inn"
  | "church"
  | "stone_castle"
  | "dungeon"
  | "harbor"
  | "lighthouse"
  | "shipwreck"
  | "pirate_fort"
  | "sea_dragon_lair";

export type SiegeKind = "battering_ram" | "ballista";
export type BoatKind = "rowboat" | "caravel";

export type ActionState =
  | "idle"
  | "windup"
  | "attack"
  | "recovery"
  | "block"
  | "dodge"
  | "stagger";

export type MatchPhase = "lobby" | "countdown" | "active" | "results";
export type StormPhaseStatus = "holding" | "shrinking" | "final";

export interface ItemSkinInfo {
  name: string;
  desc: string;
}

export interface ItemDefinition {
  id: string;
  category: ItemCategory;
  color: ItemColor;
  stackable: boolean;
  maxStack: number;
  healHp?: number;
  restoreHunger?: number;
  weaponTier?: number;
  bonusDamage?: number;
  bonusXp?: number;
  skins: Record<ExtendedRegionId, ItemSkinInfo>;
}

export interface RecipeDefinition {
  id: string;
  hotkey: string;
  label: string;
  description: string;
  requiresCampfire: boolean;
  deployCampfire: boolean;
  ingredients: Array<{ itemId: string; count: number }>;
  output: { itemId: string; count: number } | null;
}

export interface FollowerRoleDefinition {
  role: FollowerRole;
  tag: string;
  color: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  aggroRange: number;
  attackCooldownMs: number;
  healAmount?: number;
  healRange?: number;
  healCooldownMs?: number;
  perkDesc: string;
}

export interface RescueEncounterDefinition {
  type: RescueEncounterType;
  label: string;
  hostileKind: HostileKind | null;
  hostileCount: number;
  requiresMedicine: boolean;
  names: Record<ExtendedRegionId, string>;
}

export interface HostileDefinition {
  kind: HostileKind;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  aggroRange: number;
  attackCooldownMs: number;
  coinDrop?: number;
}

export const ITEMS_CATALOG: Record<string, ItemDefinition> = itemsFile.items as Record<
  string,
  ItemDefinition
>;
export const RECIPES_LIST: RecipeDefinition[] = recipesFile.recipes as RecipeDefinition[];
export const FOLLOWER_ROLES_CATALOG: Record<FollowerRole, FollowerRoleDefinition> =
  npcsFile.followerRoles as Record<FollowerRole, FollowerRoleDefinition>;
export const RESCUE_ENCOUNTERS_LIST: RescueEncounterDefinition[] =
  npcsFile.rescueEncounters as RescueEncounterDefinition[];
export const HOSTILES_CATALOG: Record<HostileKind, HostileDefinition> =
  npcsFile.hostiles as Record<HostileKind, HostileDefinition>;

export const TILESETS_SKINS = tilesetsSkinsFile;
export const EUROPE_SEA_DATA = europeSeaSpawnsFile;
export const SIEGE_BOATS_DATA = siegeBoatsFile;

export enum ClientMessage {
  INPUT = "input",
  STANCE = "stance",
  ATTACK = "attack",
  DODGE = "dodge",
  INTERACT = "interact",
  CRAFT = "craft",
  USE_ITEM = "use_item",
  FEED_FOLLOWER = "feed_follower",
  ALLY_ACTION = "ally_action",
  CREW_SIEGE = "crew_siege",
  FIRE_SIEGE = "fire_siege",
  BOAT_ACTION = "boat_action",
  READY = "ready",
  START_MATCH = "start_match",
  REMATCH = "rematch",
  PING = "ping",
}

export enum ServerMessage {
  PONG = "pong",
  COMBAT_EVENT = "combat_event",
  CHUNK_LOAD = "chunk_load",
  CHUNK_UNLOAD = "chunk_unload",
}

export interface ChunkLoadPayload {
  chunks: TiledChunkData[];
}

export interface ChunkUnloadPayload {
  chunkKeys: string[];
}

export interface InputPayload {
  seq: number;
  dx: number;
  dy: number;
  aimAngle: number;
  sprint: boolean;
  blocking: boolean;
}

export interface PongPayload {
  clientTime: number;
  serverTick: number;
  actualHz: number;
  aliveCount: number;
  totalCount: number;
}

export interface CombatEventPayload {
  type:
    | "hit"
    | "block"
    | "parry"
    | "dodge"
    | "stagger"
    | "ko"
    | "storm"
    | "gather"
    | "loot"
    | "heal"
    | "craft"
    | "rescue"
    | "follower_die"
    | "desert"
    | "honor"
    | "ally"
    | "betray"
    | "revive"
    | "arrow";
  x: number;
  y: number;
  toX?: number;
  toY?: number;
  value?: number;
  label?: string;
  stance?: Stance;
  attackerId?: string;
  targetId?: string;
}

export interface LeaderboardEntry {
  warriorName: string;
  matchesPlayed: number;
  wins: number;
  totalKos: number;
  totalXp: number;
}

export const VALID_STANCES: readonly Stance[] = ["high", "mid", "low"] as const;

export function isValidStance(value: unknown): value is Stance {
  return typeof value === "string" && (VALID_STANCES as readonly string[]).includes(value);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function sanitizeInput(raw: unknown): InputPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (
    typeof obj.seq !== "number" ||
    !Number.isInteger(obj.seq) ||
    obj.seq < 0 ||
    typeof obj.dx !== "number" ||
    !Number.isFinite(obj.dx) ||
    typeof obj.dy !== "number" ||
    !Number.isFinite(obj.dy) ||
    typeof obj.aimAngle !== "number" ||
    !Number.isFinite(obj.aimAngle)
  ) {
    return null;
  }

  let dx = clamp(obj.dx, -1, 1);
  let dy = clamp(obj.dy, -1, 1);
  const mag = Math.hypot(dx, dy);
  if (mag > 1) {
    dx /= mag;
    dy /= mag;
  }

  return {
    seq: obj.seq,
    dx,
    dy,
    aimAngle: obj.aimAngle,
    sprint: Boolean(obj.sprint),
    blocking: Boolean(obj.blocking),
  };
}
