import Phaser from "phaser";
import {
  ASIA_SPAWNS,
  CHUNK_PIXEL_SIZE,
  CHUNK_TILES,
  TILE_SIZE,
  TiledChunkData,
} from "@bots/shared";

const ASIA_TILE_PALETTE: Record<number, number> = {
  0: 0x3b332b,
  1: 0x1b4332,
  2: 0x2d6a4f,
  3: 0x6f4e37,
  4: 0x5c677d,
  5: 0x52614a,
  6: 0x495057,
  7: 0x212529,
  8: 0x1d4e89,
  9: 0x8d5524,
};

export class AsiaChunkRenderer {
  private scene: Phaser.Scene;
  private chunkGraphics = new Map<string, Phaser.GameObjects.Graphics>();
  private landmarkGraphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.landmarkGraphics = scene.add.graphics().setDepth(5);
    this.drawLandmarkZones();
  }

  loadChunks(chunks: TiledChunkData[]): void {
    for (const chunk of chunks) {
      if (this.chunkGraphics.has(chunk.key)) continue;

      const g = this.scene.add.graphics().setDepth(2);
      for (let ly = 0; ly < chunk.height; ly++) {
        for (let lx = 0; lx < chunk.width; lx++) {
          const rawGid = chunk.data[ly * CHUNK_TILES + lx] ?? 1;
          const tileId = Math.max(0, rawGid - 1);
          const wx = (chunk.x + lx) * TILE_SIZE;
          const wy = (chunk.y + ly) * TILE_SIZE;

          g.fillStyle(ASIA_TILE_PALETTE[tileId] ?? 0x3b332b, 1);
          g.fillRect(wx, wy, TILE_SIZE, TILE_SIZE);
          g.lineStyle(1, 0x0d1117, 0.22);
          g.strokeRect(wx, wy, TILE_SIZE, TILE_SIZE);

          if (tileId === 1) {
            g.fillStyle(0x40916c, 0.9);
            g.fillRect(wx + 12, wy + 8, 5, 32);
            g.fillRect(wx + 28, wy + 10, 5, 30);
          } else if (tileId === 2) {
            g.fillStyle(0x74c69d, 0.55);
            g.fillRect(wx + 6, wy + 14, 36, 4);
            g.fillRect(wx + 6, wy + 30, 36, 4);
          } else if (tileId === 5) {
            g.lineStyle(2, 0x95d5b2, 0.45);
            g.strokeRect(wx + 6, wy + 6, TILE_SIZE - 12, TILE_SIZE - 12);
          }
        }
      }

      g.lineStyle(1, 0x58a6ff, 0.14);
      g.strokeRect(
        chunk.cx * CHUNK_PIXEL_SIZE,
        chunk.cy * CHUNK_PIXEL_SIZE,
        CHUNK_PIXEL_SIZE,
        CHUNK_PIXEL_SIZE
      );

      this.chunkGraphics.set(chunk.key, g);
    }
  }

  unloadChunks(chunkKeys: string[]): void {
    for (const key of chunkKeys) {
      const g = this.chunkGraphics.get(key);
      if (g) {
        g.destroy();
        this.chunkGraphics.delete(key);
      }
    }
  }

  private drawLandmarkZones(): void {
    const g = this.landmarkGraphics;
    for (const lm of ASIA_SPAWNS.landmarks) {
      const color =
        lm.kind === "mountain_temple"
          ? 0x3fb950
          : lm.kind === "angkor_temple"
          ? 0xffd166
          : 0xf85149;

      g.lineStyle(3, color, 0.75);
      g.strokeCircle(lm.x, lm.y, lm.radius);

      this.scene.add
        .text(lm.x, lm.y - lm.radius - 10, lm.name.toUpperCase(), {
          fontSize: "10px",
          fontFamily: "monospace",
          fontStyle: "bold",
          color: "#ffd166",
          backgroundColor: "rgba(13,17,23,0.78)",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
        .setDepth(15);
    }
  }
}
