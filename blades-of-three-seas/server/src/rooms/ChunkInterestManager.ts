import {
  ASIA_MAX_X,
  CHUNK_INTEREST_RADIUS,
  ServerMessage,
  chunkKey,
  getChunksInRadius,
  worldToChunk,
} from "@bots/shared";
import { Client } from "colyseus";
import { BattleState } from "../schema/BattleState.js";

export class ChunkInterestManager {
  private clientSubscribedChunks = new Map<string, Set<string>>();
  private activeWorldChunks = new Set<string>();

  registerClient(client: Client, x: number, y: number): void {
    this.clientSubscribedChunks.set(client.sessionId, new Set());
    this.updateClientInterest(client, x, y);
  }

  unregisterClient(clientId: string): void {
    this.clientSubscribedChunks.delete(clientId);
  }

  resetAll(): void {
    this.clientSubscribedChunks.forEach((set) => set.clear());
    this.activeWorldChunks.clear();
  }

  updateClientInterest(client: Client, x: number, y: number): void {
    let currentSet = this.clientSubscribedChunks.get(client.sessionId);
    if (!currentSet) {
      currentSet = new Set();
      this.clientSubscribedChunks.set(client.sessionId, currentSet);
    }

    const { cx, cy } = worldToChunk(x, y);
    const desiredChunks = x < ASIA_MAX_X + 384 ? getChunksInRadius(cx, cy, CHUNK_INTEREST_RADIUS) : [];
    const desiredKeys = new Set(desiredChunks.map((c) => c.key));

    const toLoad = desiredChunks.filter((c) => !currentSet!.has(c.key));
    const toUnload: string[] = [];

    for (const oldKey of currentSet) {
      if (!desiredKeys.has(oldKey)) {
        toUnload.push(oldKey);
      }
    }

    if (toLoad.length > 0) {
      for (const c of toLoad) currentSet.add(c.key);
      client.send(ServerMessage.CHUNK_LOAD, { chunks: toLoad });
    }

    if (toUnload.length > 0) {
      for (const k of toUnload) currentSet.delete(k);
      client.send(ServerMessage.CHUNK_UNLOAD, { chunkKeys: toUnload });
    }
  }

  rebuildActiveChunkSet(state: BattleState, clients: Iterable<Client>): void {
    this.activeWorldChunks.clear();
    for (const client of clients) {
      const player = state.players.get(client.sessionId);
      if (!player || !player.alive) continue;
      this.updateClientInterest(client, player.x, player.y);

      const { cx, cy } = worldToChunk(player.x, player.y);
      for (let dy = -CHUNK_INTEREST_RADIUS; dy <= CHUNK_INTEREST_RADIUS; dy++) {
        for (let dx = -CHUNK_INTEREST_RADIUS; dx <= CHUNK_INTEREST_RADIUS; dx++) {
          this.activeWorldChunks.add(chunkKey(cx + dx, cy + dy));
        }
      }
    }
  }

  isPositionInActiveInterest(x: number, y: number): boolean {
    if (x >= ASIA_MAX_X) return true;
    const { cx, cy } = worldToChunk(x, y);
    return this.activeWorldChunks.has(chunkKey(cx, cy));
  }
}
