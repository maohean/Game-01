import asiaMapJson from "./data/asia_tiled_map.json" with { type: "json" };
import spawnsJson from "./data/spawns.json" with { type: "json" };
import {
  ASIA_MAX_X,
  CHUNK_PIXEL_SIZE,
  CHUNK_TILES,
  TILE_SIZE,
  WORLD_HEIGHT,
} from "./constants.js";

export interface TiledChunkData {
  key: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data: number[];
}

export const ASIA_TILED_MAP = asiaMapJson;
export const ASIA_SPAWNS = spawnsJson;

const chunkLookup = new Map<string, TiledChunkData>();

const terrainLayer = asiaMapJson.layers[0];
if (terrainLayer && Array.isArray(terrainLayer.chunks)) {
  for (const raw of terrainLayer.chunks) {
    const cx = Math.floor(raw.x / CHUNK_TILES);
    const cy = Math.floor(raw.y / CHUNK_TILES);
    const key = `${cx},${cy}`;
    chunkLookup.set(key, {
      key,
      cx,
      cy,
      x: raw.x,
      y: raw.y,
      width: raw.width,
      height: raw.height,
      data: raw.data,
    });
  }
}

export function chunkKey(cx: number, cy: number): string {
  return `${cx},${cy}`;
}

export function worldToChunk(x: number, y: number): { cx: number; cy: number } {
  const clampedX = Math.max(0, Math.min(ASIA_MAX_X - 1, x));
  const clampedY = Math.max(0, Math.min(WORLD_HEIGHT - 1, y));
  return {
    cx: Math.floor(clampedX / CHUNK_PIXEL_SIZE),
    cy: Math.floor(clampedY / CHUNK_PIXEL_SIZE),
  };
}

export function getTiledChunk(cx: number, cy: number): TiledChunkData | undefined {
  return chunkLookup.get(chunkKey(cx, cy));
}

export function getChunksInRadius(cx: number, cy: number, radius = 1): TiledChunkData[] {
  const result: TiledChunkData[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const chunk = getTiledChunk(cx + dx, cy + dy);
      if (chunk) result.push(chunk);
    }
  }
  return result;
}

export function getTileIdAtWorld(x: number, y: number): number {
  if (x < 0 || y < 0 || x >= ASIA_MAX_X || y >= WORLD_HEIGHT) return 0;
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  const cx = Math.floor(tx / CHUNK_TILES);
  const cy = Math.floor(ty / CHUNK_TILES);
  const chunk = getTiledChunk(cx, cy);
  if (!chunk) return 0;
  const localX = tx - chunk.x;
  const localY = ty - chunk.y;
  const rawGid = chunk.data[localY * CHUNK_TILES + localX] ?? 1;
  return Math.max(0, rawGid - 1);
}
