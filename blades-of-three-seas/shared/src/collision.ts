import {
  ASIA_MAX_X,
  EUROPE_MAX_X,
  MAP_COLS,
  MAP_ROWS,
  PLAYER_RADIUS,
  TILE_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants.js";
import { ExtendedRegionId } from "./protocol.js";

export function getRegionAt(x: number): ExtendedRegionId {
  if (x < ASIA_MAX_X) return "asia";
  if (x < EUROPE_MAX_X) return "europe";
  return "sea";
}

export function isWaterCoordinate(x: number, y: number): boolean {
  // Border river between Asia and Europe (except the Wooden Bridge deck at y: 528..624)
  if (x >= 1488 && x <= 1584 && (y < 528 || y > 624)) {
    return true;
  }

  // Open Sea east of Harbor shoreline, excluding major island landmasses
  if (x >= 3072) {
    const islands = [
      { x: 3440, y: 280, r: 95 },
      { x: 4120, y: 320, r: 125 },
    ];
    for (const isl of islands) {
      if (Math.hypot(x - isl.x, y - isl.y) <= isl.r) return false;
    }
    return true;
  }
  return false;
}

export function isTileSolid(col: number, row: number): boolean {
  if (col <= 0 || col >= MAP_COLS - 1 || row <= 0 || row >= MAP_ROWS - 1) {
    return true;
  }
  const wx = col * TILE_SIZE + TILE_SIZE / 2;
  const wy = row * TILE_SIZE + TILE_SIZE / 2;
  return isWaterCoordinate(wx, wy);
}

export function resolveMapCollision(
  x: number,
  y: number,
  radius: number = PLAYER_RADIUS,
  allowWater: boolean = false
): { x: number; y: number } {
  const minX = TILE_SIZE + radius;
  const maxX = WORLD_WIDTH - TILE_SIZE - radius;
  const minY = TILE_SIZE + radius;
  const maxY = WORLD_HEIGHT - TILE_SIZE - radius;

  let nx = Math.max(minX, Math.min(maxX, x));
  let ny = Math.max(minY, Math.min(maxY, y));

  if (!allowWater && isWaterCoordinate(nx, ny)) {
    // Push back from border river or sea shoreline
    if (nx >= 1488 && nx <= 1584) {
      nx = nx < 1536 ? 1488 - radius : 1584 + radius;
    } else if (nx >= 3072) {
      nx = 3072 - radius;
    }
  }

  return { x: nx, y: ny };
}

export function angleDiff(a: number, b: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}

export function generateRandomSpawns(count: number): Array<{ x: number; y: number }> {
  const presets = [
    { x: 420, y: 420 },
    { x: 640, y: 620 },
    { x: 960, y: 460 },
    { x: 1120, y: 680 },
    { x: 1850, y: 540 },
    { x: 2050, y: 600 },
    { x: 480, y: 820 },
    { x: 1240, y: 440 },
  ];
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    out.push(presets[i % presets.length]);
  }
  return out;
}

export function sampleWalkablePoints(
  count: number,
  minSpacing: number
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  while (pts.length < count && attempts < count * 80) {
    attempts++;
    // Distribute across Asia (120..1440) and Europe (1640..2980) land masses
    const inEurope = pts.length % 2 === 1;
    const x = inEurope
      ? 1640 + Math.random() * 1320
      : 120 + Math.random() * 1300;
    const y = 120 + Math.random() * (WORLD_HEIGHT - 240);
    if (isWaterCoordinate(x, y)) continue;
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < minSpacing)) continue;
    pts.push({ x: Math.round(x), y: Math.round(y) });
  }
  return pts;
}
