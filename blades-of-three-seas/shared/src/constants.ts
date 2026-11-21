// Authoritative simulation tick rate (20 ticks/sec = 50ms)
export const TICK_RATE = 20;
export const TICK_INTERVAL_MS = 1000 / TICK_RATE;

// Authoritative Follower & Hostile AI tick rate (10 ticks/sec = 100ms)
export const AI_TICK_RATE = 10;
export const AI_TICK_INTERVAL_MS = 1000 / AI_TICK_RATE;

// Room & lobby rules
export const MIN_PLAYERS_TO_START = 2;
export const MAX_PLAYERS_PER_ROOM = 8;
export const LOBBY_COUNTDOWN_SEC = 3;

// Unified Tri-Region World (Asia 0..1536 | Europe 1536..3072 | Sea 3072..4608)
export const TILE_SIZE = 48;
export const CHUNK_TILES = 8;
export const CHUNK_PIXEL_SIZE = TILE_SIZE * CHUNK_TILES; // 384 px
export const REGION_WIDTH = 1536;
export const ASIA_MAX_X = 1536;
export const EUROPE_MAX_X = 3072;
export const SEA_MAX_X = 4608;
export const WORLD_WIDTH = 4608;
export const WORLD_HEIGHT = 1152;
export const MAP_COLS = WORLD_WIDTH / TILE_SIZE; // 96
export const MAP_ROWS = WORLD_HEIGHT / TILE_SIZE; // 24
export const CHUNK_INTEREST_RADIUS = 1;

// Central Final Duel Arena geometry (Central Courtyard Hub)
export const FINAL_DUEL_CENTER_X = 768;
export const FINAL_DUEL_CENTER_Y = 576;
export const FINAL_DUEL_RADIUS = 175;

// 4-Stage Shrinking Storm configuration
export interface StormStageConfig {
  stage: number;
  label: string;
  holdSec: number;
  shrinkSec: number;
  startRadius: number;
  endRadius: number;
  dps: number;
}

export const STORM_STAGES: readonly StormStageConfig[] = [
  {
    stage: 1,
    label: "Stage 1: Three Seas Horizon",
    holdSec: 45,
    shrinkSec: 0,
    startRadius: 3950,
    endRadius: 3950,
    dps: 3,
  },
  {
    stage: 2,
    label: "Stage 2: Borderlands Closing",
    holdSec: 25,
    shrinkSec: 30,
    startRadius: 3950,
    endRadius: 1650,
    dps: 7,
  },
  {
    stage: 3,
    label: "Stage 3: Inner Sanctum",
    holdSec: 20,
    shrinkSec: 25,
    startRadius: 1650,
    endRadius: 480,
    dps: 13,
  },
  {
    stage: 4,
    label: "Stage 4: Final Duel",
    holdSec: 0,
    shrinkSec: 20,
    startRadius: 480,
    endRadius: FINAL_DUEL_RADIUS,
    dps: 22,
  },
] as const;

export const STORM_DOT_INTERVAL_MS = 500;

// Survival, Hunger, Campfire, Resources & Day/Night Cycle
export const MAX_INVENTORY_SLOTS = 6;
export const INTERACT_RANGE = 82;
export const INTERACT_COOLDOWN_MS = 350;

export const MAX_HUNGER = 100;
export const HUNGER_DRAIN_PER_SEC = 1.1;
export const LOW_HUNGER_THRESHOLD = 25;
export const STARVATION_INTERVAL_MS = 2000;
export const STARVATION_DAMAGE = 2;

export const RESOURCE_NODE_COUNT = 28;
export const RESOURCE_NODE_MAX_HP = 3;
export const LOOT_CONTAINER_COUNT = 14;

export const CAMPFIRE_DURATION_MS = 45000;
export const CAMPFIRE_HEAL_RADIUS = 95;
export const CAMPFIRE_HEAL_PER_SEC = 6;
export const MAX_ACTIVE_CAMPFIRES = 16;

export const DAY_NIGHT_CYCLE_SEC = 60;

// Phase 4: Rescue, Followers, Honor & Temporary Alliance
export const MAX_FOLLOWERS_PER_PLAYER = 3;
export const RESCUE_ENCOUNTER_COUNT = 6;
export const FOLLOWER_HUNGER_DRAIN_PER_SEC = 0.85;
export const FOLLOWER_FLEE_HP_RATIO = 0.28;

export const INITIAL_HONOR = 50;
export const MIN_HONOR = 0;
export const MAX_HONOR = 100;
export const LOW_HONOR_DESERT_THRESHOLD = 25;
export const HIGH_HONOR_THRESHOLD = 75;

export const HONOR_RESCUE_GAIN = 15;
export const HONOR_FEED_GAIN = 3;
export const HONOR_REVIVE_GAIN = 20;
export const HONOR_FAIR_DUEL_GAIN = 8;
export const HONOR_BACKSTAB_LOSS = 12;
export const HONOR_FOLLOWER_DEATH_LOSS = 10;
export const HONOR_BETRAYAL_LOSS = 40;

export const ALLIANCE_INTERACT_RANGE = 115;
export const DOWNED_BLEEDOUT_MS = 12000;
export const REVIVE_RESTORE_HP = 40;
export const BETRAYAL_STAGGER_MS = 1200;

// Phase 5 & 6: Asia, Europe & Sea Constants
export const CASTLE_CAPTURE_SECONDS = 60;
export const BRIDGE_TOLL_COINS = 10;
export const MOUNTAIN_TEMPLE_HEAL_PER_SEC = 15;
export const WOODEN_BRIDGE_X = 1536;
export const HARBOR_DOCK_X = 3030;
export const HARBOR_DOCK_Y = 576;
export const CHURCH_HEAL_AMOUNT = 50;
export const INN_REST_COST = 5;
export const SIEGE_INTERACT_RANGE = 82;
export const BOAT_INTERACT_RANGE = 92;
export const STARTING_COINS = 25;

// XP & Placement rewards
export const XP_PARTICIPATION = 50;
export const XP_PER_PLACEMENT_STEP = 40;
export const XP_WINNER_BONUS = 100;
export const XP_PER_KO = 75;
export const XP_PER_SURVIVAL_SEC = 1;
export const XP_PER_TREASURE = 150;

// Warrior physics & movement
export const PLAYER_RADIUS = 18;
export const BASE_MOVE_SPEED = 225;
export const SPRINT_MULTIPLIER = 1.45;
export const BLOCK_MOVE_MULTIPLIER = 0.5;
export const EXHAUSTED_MOVE_MULTIPLIER = 0.55;
export const DODGE_SPEED_MULTIPLIER = 2.6;

// Health & damage
export const MAX_HP = 100;
export const BASE_SLASH_DAMAGE = 40;
export const FORGED_SLASH_BONUS = 14;
export const STAGGERED_SLASH_DAMAGE = 60;

// Stamina pool & costs
export const MAX_STAMINA = 100;
export const STAMINA_REGEN_PER_SEC = 22;
export const STAMINA_REGEN_DELAY_MS = 600;
export const ATTACK_STAMINA_COST = 20;
export const DODGE_STAMINA_COST = 25;
export const SPRINT_STAMINA_PER_SEC = 16;
export const BLOCK_HOLD_STAMINA_PER_SEC = 8;
export const BLOCK_IMPACT_STAMINA_COST = 22;
export const PARRY_ATTACKER_STAMINA_LOSS = 25;

// Katana / Longsword combat timings (ms)
export const ATTACK_WINDUP_MS = 150;
export const ATTACK_ACTIVE_MS = 100;
export const ATTACK_RECOVERY_MS = 200;
export const ATTACK_RANGE = 84;
export const ATTACK_ARC_RAD = (95 * Math.PI) / 180;

export const PARRY_WINDOW_MS = 200;
export const STAGGER_DURATION_MS = 900;
export const GUARD_BREAK_STAGGER_MS = 500;
export const DODGE_DURATION_MS = 200;
export const DODGE_COOLDOWN_MS = 1000;

// Anti-cheat & client interpolation
export const MAX_MESSAGES_PER_SEC = 45;
export const CLIENT_INTERPOLATION_DELAY_MS = 100;
