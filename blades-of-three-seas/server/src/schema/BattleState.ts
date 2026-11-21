import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import {
  ActionState,
  BoatKind,
  CASTLE_CAPTURE_SECONDS,
  DayPhase,
  ExtendedRegionId,
  FINAL_DUEL_CENTER_X,
  FINAL_DUEL_CENTER_Y,
  FollowerAiState,
  FollowerRole,
  HostileKind,
  INITIAL_HONOR,
  MAX_HP,
  MAX_HUNGER,
  MAX_STAMINA,
  MatchPhase,
  PoiKind,
  RescueEncounterType,
  ResourceKind,
  STORM_STAGES,
  STARTING_COINS,
  SiegeKind,
  Stance,
  StormPhaseStatus,
  TownNpcRole,
} from "@bots/shared";

export class InventorySlotSchema extends Schema {
  @type("string") itemId: string = "";
  @type("string") skin: ExtendedRegionId = "asia";
  @type("number") count: number = 0;
}

export class FollowerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") ownerId: string = "";
  @type("string") name: string = "";
  @type("string") role: FollowerRole = "fighter";
  @type("string") region: ExtendedRegionId = "asia";
  @type("string") aiState: FollowerAiState = "follow";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") facingAngle: number = 0;
  @type("number") hp: number = 100;
  @type("number") maxHp: number = 100;
  @type("number") hunger: number = 100;
  @type("number") maxHunger: number = 100;
}

export class RescueNpcSchema extends Schema {
  @type("string") id: string = "";
  @type("string") encounterType: RescueEncounterType = "villager_beast";
  @type("string") followerRole: FollowerRole = "fighter";
  @type("string") region: ExtendedRegionId = "asia";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") rescued: boolean = false;
  @type("boolean") requiresMedicine: boolean = false;
}

export class HostileNpcSchema extends Schema {
  @type("string") id: string = "";
  @type("string") encounterId: string = "";
  @type("string") kind: HostileKind = "wild_boar";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") facingAngle: number = 0;
  @type("number") hp: number = 75;
  @type("number") maxHp: number = 75;
  @type("boolean") alive: boolean = true;
}

export class TownNpcSchema extends Schema {
  @type("string") id: string = "";
  @type("string") role: TownNpcRole = "farmer";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") serviceLabel: string = "";
}

export class CastleCaptureSchema extends Schema {
  @type("string") name: string = "Himeji-style Tenshu Castle";
  @type("number") x: number = 1152;
  @type("number") y: number = 240;
  @type("number") radius: number = 120;
  @type("string") capturingPlayerId: string = "";
  @type("string") capturingPlayerName: string = "";
  @type("number") progressSec: number = 0;
  @type("number") targetSec: number = CASTLE_CAPTURE_SECONDS;
  @type("string") ownerPlayerId: string = "";
  @type("string") ownerPlayerName: string = "";
  @type("boolean") contested: boolean = false;
}

export class AsiaWorldStateSchema extends Schema {
  @type("boolean") angkorTreasureClaimed: boolean = false;
  @type("boolean") oniBossActive: boolean = false;
  @type(CastleCaptureSchema) castle = new CastleCaptureSchema();
  @type({ map: TownNpcSchema }) townNpcs = new MapSchema<TownNpcSchema>();
  @type(["string"]) tollPaidPlayerIds = new ArraySchema<string>();
}

export class WorldPoiSchema extends Schema {
  @type("string") id: string = "";
  @type("string") region: ExtendedRegionId = "europe";
  @type("string") kind: PoiKind = "oak_forest";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") radius: number = 80;
  @type("boolean") drawbridgeOpen: boolean = false;
  @type("number") gateHp: number = 0;
  @type("number") gateMaxHp: number = 0;
  @type("boolean") beaconLit: boolean = false;
  @type("boolean") looted: boolean = false;
}

export class SiegeWeaponSchema extends Schema {
  @type("string") id: string = "";
  @type("string") kind: SiegeKind = "battering_ram";
  @type("string") name: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") aimAngle: number = 0;
  @type("number") minCrew: number = 2;
  @type("number") maxCrew: number = 3;
  @type(["string"]) crewIds = new ArraySchema<string>();
}

export class BoatSchema extends Schema {
  @type("string") id: string = "";
  @type("string") kind: BoatKind = "rowboat";
  @type("string") name: string = "";
  @type("string") ownerId: string = "";
  @type("boolean") rented: boolean = false;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") heading: number = 0;
  @type("number") hp: number = 140;
  @type("number") maxHp: number = 140;
  @type(["string"]) passengerIds = new ArraySchema<string>();
}

export class PlayerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "Ronin";
  @type("boolean") ready: boolean = false;
  @type("boolean") alive: boolean = true;
  @type("boolean") downed: boolean = false;
  @type("number") downedRemainingSec: number = 0;
  @type("number") kills: number = 0;

  @type("number") placement: number = 0;
  @type("number") survivalSec: number = 0;
  @type("number") xpEarned: number = 0;

  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") facingAngle: number = 0;

  @type("number") hp: number = MAX_HP;
  @type("number") maxHp: number = MAX_HP;
  @type("number") stamina: number = MAX_STAMINA;
  @type("number") maxStamina: number = MAX_STAMINA;
  @type("number") hunger: number = MAX_HUNGER;
  @type("number") maxHunger: number = MAX_HUNGER;
  @type("number") honor: number = INITIAL_HONOR;
  @type("number") coins: number = STARTING_COINS;
  @type("number") weaponTier: number = 1;

  @type("string") allyId: string = "";
  @type("string") pendingAllyFromId: string = "";
  @type("string") pendingAllyFromName: string = "";

  @type("string") activeSiegeId: string = "";
  @type("string") mountedBoatId: string = "";
  @type("boolean") seaRadarUnlocked: boolean = false;

  @type("string") stance: Stance = "mid";
  @type("string") actionState: ActionState = "idle";
  @type("boolean") isParrying: boolean = false;
  @type("boolean") exhausted: boolean = false;
  @type("boolean") outsideStorm: boolean = false;
  @type("boolean") nearCampfire: boolean = false;
  @type("number") lastProcessedSeq: number = 0;

  @type([InventorySlotSchema]) inventory = new ArraySchema<InventorySlotSchema>();
  @type([FollowerSchema]) followers = new ArraySchema<FollowerSchema>();
}

export class ResourceNodeSchema extends Schema {
  @type("string") id: string = "";
  @type("string") kind: ResourceKind = "wood";
  @type("string") region: ExtendedRegionId = "asia";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") hp: number = 3;
  @type("number") maxHp: number = 3;
  @type("boolean") depleted: boolean = false;
}

export class LootContainerSchema extends Schema {
  @type("string") id: string = "";
  @type("string") region: ExtendedRegionId = "asia";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") opened: boolean = false;
}

export class CampfireSchema extends Schema {
  @type("string") id: string = "";
  @type("string") ownerName: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") remainingSec: number = 45;
}

export class DayNightSchema extends Schema {
  @type("string") phaseOfDay: DayPhase = "day";
  @type("number") cycleElapsedSec: number = 0;
  @type("number") darknessAlpha: number = 0;
}

export class StormSchema extends Schema {
  @type("number") stage: number = 1;
  @type("string") label: string = STORM_STAGES[0].label;
  @type("string") status: StormPhaseStatus = "holding";
  @type("number") centerX: number = FINAL_DUEL_CENTER_X;
  @type("number") centerY: number = FINAL_DUEL_CENTER_Y;
  @type("number") currentRadius: number = STORM_STAGES[0].startRadius;
  @type("number") nextRadius: number = STORM_STAGES[1].endRadius;
  @type("number") timeRemainingSec: number = STORM_STAGES[0].holdSec;
  @type("number") dps: number = STORM_STAGES[0].dps;
}

export class KillFeedEntry extends Schema {
  @type("string") id: string = "";
  @type("string") killerName: string = "";
  @type("string") victimName: string = "";
  @type("string") stance: Stance = "mid";
}

export class BattleState extends Schema {
  @type("string") phase: MatchPhase = "lobby";
  @type("number") countdownSec: number = 0;
  @type("string") winnerId: string = "";
  @type("string") winnerName: string = "";
  @type("number") serverTick: number = 0;
  @type("string") hostId: string = "";

  @type(StormSchema) storm = new StormSchema();
  @type(DayNightSchema) dayNight = new DayNightSchema();
  @type(AsiaWorldStateSchema) asia = new AsiaWorldStateSchema();

  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type({ map: ResourceNodeSchema }) resourceNodes = new MapSchema<ResourceNodeSchema>();
  @type({ map: LootContainerSchema }) lootContainers = new MapSchema<LootContainerSchema>();
  @type({ map: CampfireSchema }) campfires = new MapSchema<CampfireSchema>();
  @type({ map: RescueNpcSchema }) rescueNpcs = new MapSchema<RescueNpcSchema>();
  @type({ map: HostileNpcSchema }) hostiles = new MapSchema<HostileNpcSchema>();
  @type({ map: WorldPoiSchema }) pois = new MapSchema<WorldPoiSchema>();
  @type({ map: SiegeWeaponSchema }) siegeWeapons = new MapSchema<SiegeWeaponSchema>();
  @type({ map: BoatSchema }) boats = new MapSchema<BoatSchema>();
  @type([KillFeedEntry]) killFeed = new ArraySchema<KillFeedEntry>();
}
