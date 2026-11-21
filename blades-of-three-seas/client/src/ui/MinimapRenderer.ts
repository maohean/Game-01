import { WORLD_HEIGHT, WORLD_WIDTH } from "../../../shared/src";
import { NetworkClient, PlayerSnapshot } from "../net/NetworkClient";

export class MinimapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.getElementById("minimap-canvas") as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
  }

  render(
    net: NetworkClient,
    players: Map<string, PlayerSnapshot>,
    focusId: string
  ): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scaleX = w / WORLD_WIDTH;
    const scaleY = h / WORLD_HEIGHT;
    const meta = net.getLatestMeta();
    const localPlayer = players.get(net.sessionId);

    const hasScout =
      (localPlayer?.followers.some((f) => f.role === "scout") ?? false) ||
      Boolean(localPlayer?.seaRadarUnlocked);

    this.ctx.clearRect(0, 0, w, h);

    // 3 Regions: Asia (left 1/3), Europe (middle 1/3), Sea (right 1/3)
    const thirdW = w / 3;
    this.ctx.fillStyle = "#16202a";
    this.ctx.fillRect(0, 0, thirdW, h);
    this.ctx.fillStyle = "#1c2b21";
    this.ctx.fillRect(thirdW, 0, thirdW, h);
    this.ctx.fillStyle = "#0b2545";
    this.ctx.fillRect(thirdW * 2, 0, thirdW, h);

    // Region borders
    this.ctx.strokeStyle = "#30363d";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(thirdW, 0);
    this.ctx.lineTo(thirdW, h);
    this.ctx.moveTo(thirdW * 2, 0);
    this.ctx.lineTo(thirdW * 2, h);
    this.ctx.stroke();

    // Storm circle
    const storm = meta.storm;
    this.ctx.strokeStyle = "#bc2c66";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(
      storm.centerX * scaleX,
      storm.centerY * scaleY,
      storm.currentRadius * scaleX,
      0,
      Math.PI * 2
    );
    this.ctx.stroke();

    // Japanese Castle Capture Point
    this.ctx.fillStyle = "#f85149";
    this.ctx.fillRect(meta.castle.x * scaleX - 3, meta.castle.y * scaleY - 3, 6, 6);

    // Europe & Sea POIs
    meta.pois.forEach((poi) => {
      this.ctx.fillStyle = poi.region === "sea" ? "#4cc9f0" : "#ffd166";
      this.ctx.fillRect(poi.x * scaleX - 2, poi.y * scaleY - 2, 4, 4);
    });

    // Rescuable NPCs
    meta.rescueNpcs.forEach((npc) => {
      if (npc.rescued) return;
      this.ctx.fillStyle = "#4cc9f0";
      this.ctx.beginPath();
      this.ctx.arc(npc.x * scaleX, npc.y * scaleY, 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Bosses & Scout-detected Hostiles
    meta.hostiles.forEach((h) => {
      if (!h.alive) return;
      const isBoss =
        h.kind === "angkor_boss" || h.kind === "oni_boss" || h.kind === "sea_dragon";
      if (!isBoss && !hasScout) return;
      this.ctx.fillStyle = isBoss ? "#ff006e" : "#ff6b6b";
      this.ctx.beginPath();
      this.ctx.arc(h.x * scaleX, h.y * scaleY, isBoss ? 3.5 : 2, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Warriors
    players.forEach((p, id) => {
      if (!p.alive) return;
      const isFocus = id === focusId;
      const isAlly = Boolean(localPlayer?.allyId && localPlayer.allyId === id);
      if (!isFocus && !isAlly && !hasScout) return;

      this.ctx.fillStyle = isFocus ? "#3fb950" : isAlly ? "#4cc9f0" : "#f85149";
      this.ctx.beginPath();
      this.ctx.arc(p.x * scaleX, p.y * scaleY, isFocus ? 3.5 : 2.5, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }
}
