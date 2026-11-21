import {
  FOLLOWER_ROLES_CATALOG,
  ITEMS_CATALOG,
  MAX_INVENTORY_SLOTS,
  RECIPES_LIST,
} from "@bots/shared";
import { NetworkClient, PlayerSnapshot } from "../net/NetworkClient";
import { MinimapRenderer } from "./MinimapRenderer";

export class HudController {
  private net: NetworkClient;
  private minimap: MinimapRenderer;

  private debugEl = document.getElementById("debug-overlay")!;
  private dayNightEl = document.getElementById("daynight-pill")!;
  private honorPillEl = document.getElementById("honor-pill")!;
  private castlePillEl = document.getElementById("castle-pill")!;
  private followerRosterEl = document.getElementById("follower-roster")!;
  private craftingEl = document.getElementById("crafting-panel")!;
  private interactPromptEl = document.getElementById("interact-prompt")!;
  private allyPromptEl = document.getElementById("ally-prompt")!;

  private stormPillEl = document.getElementById("storm-pill")!;
  private stormAlertEl = document.getElementById("storm-alert")!;
  private stormVignetteEl = document.getElementById("storm-vignette")!;
  private koFeedEl = document.getElementById("ko-feed")!;
  private hpBar = document.getElementById("hp-bar")!;
  private hpText = document.getElementById("hp-text")!;
  private stamBar = document.getElementById("stam-bar")!;
  private stamText = document.getElementById("stam-text")!;
  private hungerBar = document.getElementById("hunger-bar")!;
  private hungerText = document.getElementById("hunger-text")!;
  private invRowEl = document.getElementById("inv-row")!;
  private spectatorBanner = document.getElementById("spectator-banner")!;
  private modalOverlay = document.getElementById("modal-overlay")!;

  private stanceHigh = document.getElementById("stance-high")!;
  private stanceMid = document.getElementById("stance-mid")!;
  private stanceLow = document.getElementById("stance-low")!;

  private lastPhase = "";
  private lastModalFingerprint = "";
  private lastInvFingerprint = "";
  private lastCraftFingerprint = "";
  private lastRosterFingerprint = "";

  constructor(net: NetworkClient) {
    this.net = net;
    this.minimap = new MinimapRenderer();
    this.renderJoinModal();
  }

  update(
    fps: number,
    players: Map<string, PlayerSnapshot>,
    spectateTargetId: string,
    nearbyPrompt: string | null,
    allyPrompt: string | null
  ): void {
    const meta = this.net.getLatestMeta();
    const myId = this.net.sessionId;
    const me = players.get(myId);

    this.debugEl.innerHTML = `
      <div class="dbg-header">BLADES OF THREE SEAS • FULL WORLD (PHASES 1–6)</div>
      <div>Room: <strong>${this.net.roomId || "—"}</strong> | Alive: <strong>${this.net.aliveCount}/${this.net.totalCount}</strong></div>
      <div>FPS: <strong>${Math.round(fps)}</strong> | Tick: <strong>${this.net.serverHz}Hz</strong> | RTT: <strong>${this.net.rttMs}ms</strong></div>
      <button id="btn-netsim" class="dbg-toggle ${this.net.simulateBadNetwork ? "active" : ""}">
        Net Sim (150ms + 5% Loss): ${this.net.simulateBadNetwork ? "ON" : "OFF"}
      </button>
    `;
    document.getElementById("btn-netsim")?.addEventListener("click", () => {
      this.net.simulateBadNetwork = !this.net.simulateBadNetwork;
    });

    const dn = meta.dayNight;
    const phaseColor =
      dn.phaseOfDay === "night"
        ? "#8957e5"
        : dn.phaseOfDay === "dusk" || dn.phaseOfDay === "dawn"
        ? "#f0883e"
        : "#ffd166";
    this.dayNightEl.innerHTML = `Cycle: <strong style="color:${phaseColor}">${dn.phaseOfDay.toUpperCase()}</strong> (${dn.cycleElapsedSec}s/60s)`;

    if (me) {
      const honorColor = me.honor >= 75 ? "#3fb950" : me.honor < 25 ? "#f85149" : "#ffd166";
      const allyName = me.allyId ? players.get(me.allyId)?.name ?? "Allied" : "None";
      this.honorPillEl.innerHTML = `
        Honor: <strong style="color:${honorColor}">${Math.round(me.honor)}/100</strong> •
        Coins: <strong style="color:#ffd166">${me.coins}g</strong> •
        Truce: <strong>${allyName}</strong>
      `;
    }

    const castle = meta.castle;
    const castlePct = Math.min(100, Math.round((castle.progressSec / castle.targetSec) * 100));
    const castleStatus = castle.ownerPlayerName
      ? `HELD BY ${castle.ownerPlayerName.toUpperCase()}`
      : castle.contested
      ? "CONTESTED!"
      : `${Math.floor(castle.progressSec)}s / ${castle.targetSec}s (${castlePct}%)`;
    this.castlePillEl.innerHTML = `Japanese Castle: <strong style="color:#ffd166">${castleStatus}</strong>`;

    if (nearbyPrompt) {
      this.interactPromptEl.style.display = "block";
      this.interactPromptEl.textContent = nearbyPrompt;
    } else {
      this.interactPromptEl.style.display = "none";
    }

    if (allyPrompt) {
      this.allyPromptEl.style.display = "block";
      this.allyPromptEl.textContent = allyPrompt;
    } else {
      this.allyPromptEl.style.display = "none";
    }

    if (meta.phase === "active") {
      const s = meta.storm;
      this.stormPillEl.innerHTML = `<strong>${s.label}</strong> • ${s.status.toUpperCase()} (${s.timeRemainingSec}s) • Storm DMG: <strong>${s.dps}/s</strong>`;
    } else {
      this.stormPillEl.textContent = `Room Phase: ${meta.phase.toUpperCase()}`;
    }

    this.koFeedEl.innerHTML = meta.killFeed
      .slice()
      .reverse()
      .map(
        (k) =>
          `<div class="ko-item"><strong>${k.killerName}</strong> [${k.stance.toUpperCase()}] K.O. <strong>${k.victimName}</strong></div>`
      )
      .join("");

    const focusId = me && me.alive ? myId : spectateTargetId;
    const focusPlayer = players.get(focusId);

    this.spectatorBanner.style.display =
      meta.phase === "active" && me && !me.alive ? "block" : "none";

    const showWarning = Boolean(focusPlayer && focusPlayer.alive && focusPlayer.outsideStorm);
    this.stormAlertEl.style.display = showWarning ? "block" : "none";
    this.stormVignetteEl.style.display = showWarning ? "block" : "none";

    if (focusPlayer) {
      const hpPct = Math.max(0, Math.min(100, (focusPlayer.hp / focusPlayer.maxHp) * 100));
      const stamPct = Math.max(
        0,
        Math.min(100, (focusPlayer.stamina / focusPlayer.maxStamina) * 100)
      );
      const hungerPct = Math.max(
        0,
        Math.min(100, (focusPlayer.hunger / focusPlayer.maxHunger) * 100)
      );

      this.hpBar.style.width = `${hpPct}%`;
      this.hpText.textContent = `${Math.ceil(focusPlayer.hp)}/${focusPlayer.maxHp}`;

      this.stamBar.style.width = `${stamPct}%`;
      this.stamBar.classList.toggle("exhausted", focusPlayer.exhausted);
      this.stamText.textContent = `${Math.ceil(focusPlayer.stamina)}/${focusPlayer.maxStamina}`;

      this.hungerBar.style.width = `${hungerPct}%`;
      this.hungerText.textContent = `${Math.ceil(focusPlayer.hunger)}/${focusPlayer.maxHunger}`;

      this.stanceHigh.className = `stance-pill ${focusPlayer.stance === "high" ? "active-high" : ""}`;
      this.stanceMid.className = `stance-pill ${focusPlayer.stance === "mid" ? "active-mid" : ""}`;
      this.stanceLow.className = `stance-pill ${focusPlayer.stance === "low" ? "active-low" : ""}`;

      this.renderFollowerRoster(focusPlayer);
      this.renderInventorySlots(focusPlayer);
      this.renderCraftingPanel(focusPlayer);
    }

    this.minimap.render(this.net, players, focusId);

    if (!this.net.isConnected) return;

    if (meta.phase === "lobby" || meta.phase === "countdown") {
      const fp = `${meta.phase}_${meta.countdownSec}_${this.buildLobbyFingerprint(players)}`;
      if (fp !== this.lastModalFingerprint) {
        this.lastModalFingerprint = fp;
        this.renderLobbyModal(players, meta.phase, meta.countdownSec, meta.hostId);
      }
      this.modalOverlay.classList.remove("hidden");
    } else if (meta.phase === "results") {
      if (this.lastPhase !== "results") {
        void this.renderResultsModal(players, meta.winnerName);
      }
      this.modalOverlay.classList.remove("hidden");
    } else {
      this.modalOverlay.classList.add("hidden");
      this.lastModalFingerprint = "";
    }
    this.lastPhase = meta.phase;
  }

  private renderFollowerRoster(player: PlayerSnapshot): void {
    const fp = player.followers
      .map((f) => `${f.id}:${Math.ceil(f.hp)}:${Math.ceil(f.hunger)}:${f.aiState}`)
      .join("|");
    if (fp === this.lastRosterFingerprint) return;
    this.lastRosterFingerprint = fp;

    if (player.followers.length === 0) {
      this.followerRosterEl.innerHTML = "";
      return;
    }

    const hasFood = player.inventory.some(
      (s) => s.itemId === "food_cooked" || s.itemId === "food_raw"
    );

    this.followerRosterEl.innerHTML = player.followers
      .map((f, idx) => {
        const roleDef = FOLLOWER_ROLES_CATALOG[f.role];
        const hpPct = Math.max(0, Math.min(100, (f.hp / f.maxHp) * 100));
        const hunPct = Math.max(0, Math.min(100, (f.hunger / f.maxHunger) * 100));
        return `
          <div class="follower-card">
            <div class="fol-top">
              <span style="color:${roleDef.color}">[${roleDef.tag}] ${f.name}</span>
              <span style="color:#8b949e">${f.aiState.toUpperCase()}</span>
            </div>
            <div class="fol-bars">
              <div class="fol-mini-track" title="Follower HP">
                <div class="fol-hp-fill" style="width:${hpPct}%"></div>
              </div>
              <div class="fol-mini-track" title="Follower Hunger">
                <div class="fol-hunger-fill" style="width:${hunPct}%"></div>
              </div>
              <button class="feed-btn" data-feed-idx="${idx}" ${hasFood ? "" : "disabled"}>
                Feed [G]
              </button>
            </div>
          </div>
        `;
      })
      .join("");

    this.followerRosterEl.querySelectorAll<HTMLButtonElement>(".feed-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.feedIdx);
        this.net.sendFeedFollower(idx);
      });
    });
  }

  private renderInventorySlots(player: PlayerSnapshot): void {
    const fp = player.inventory.map((s) => `${s.itemId}:${s.skin}:${s.count}`).join("|");
    if (fp === this.lastInvFingerprint) return;
    this.lastInvFingerprint = fp;

    const slotsHtml: string[] = [];
    for (let i = 0; i < MAX_INVENTORY_SLOTS; i++) {
      const slot = player.inventory[i];
      const keyNum = i + 4;
      if (!slot) {
        slotsHtml.push(`
          <div class="inv-slot">
            <div class="inv-slot-key"><span>[${keyNum}]</span><span>Empty</span></div>
            <div class="inv-slot-name" style="color:#484f58;">—</div>
          </div>
        `);
      } else {
        const def = ITEMS_CATALOG[slot.itemId];
        const skinInfo = def?.skins[slot.skin] ?? { name: slot.itemId, desc: "" };
        slotsHtml.push(`
          <div class="inv-slot color-${def?.color ?? "grey"}" data-slot="${i}" title="${skinInfo.desc}">
            <div class="inv-slot-key"><span>[${keyNum}]</span><span>x${slot.count}</span></div>
            <div class="inv-slot-name">${skinInfo.name}</div>
          </div>
        `);
      }
    }
    this.invRowEl.innerHTML = slotsHtml.join("");

    this.invRowEl.querySelectorAll<HTMLElement>(".inv-slot[data-slot]").forEach((el) => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.slot);
        this.net.sendUseItem(idx);
      });
    });
  }

  private renderCraftingPanel(player: PlayerSnapshot): void {
    const countOf = (id: string) =>
      player.inventory.reduce((acc, s) => (s.itemId === id ? acc + s.count : acc), 0);

    const statusList = RECIPES_LIST.map((r) => {
      const hasIngredients = r.ingredients.every((ing) => countOf(ing.itemId) >= ing.count);
      const fireOk = !r.requiresCampfire || player.nearCampfire;
      return { recipe: r, canCraft: hasIngredients && fireOk };
    });

    const fp = statusList.map((s) => `${s.recipe.id}:${s.canCraft}`).join("|");
    if (fp === this.lastCraftFingerprint) return;
    this.lastCraftFingerprint = fp;

    this.craftingEl.innerHTML =
      `<div class="craft-title">SURVIVAL CRAFTING</div>` +
      statusList
        .map(
          ({ recipe, canCraft }) => `
        <button class="craft-btn ${canCraft ? "ready" : ""}" data-recipe="${recipe.id}" ${canCraft ? "" : "disabled"}>
          <div class="craft-btn-top">
            <span>[${recipe.hotkey}] ${recipe.label}</span>
            <span>${canCraft ? "READY" : "LOCKED"}</span>
          </div>
          <div class="craft-btn-sub">${recipe.description}</div>
        </button>
      `
        )
        .join("");

    this.craftingEl.querySelectorAll<HTMLButtonElement>(".craft-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const recipeId = btn.dataset.recipe;
        if (recipeId) this.net.sendCraft(recipeId);
      });
    });
  }

  private renderJoinModal(): void {
    this.modalOverlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">BLADES OF THREE SEAS</div>
        <div style="font-size:12px;color:#8b949e;">
          Enter your warrior name to join the Asia, Europe &amp; Sea world.
        </div>
        <div class="input-group">
          <input id="inp-name" type="text" maxlength="16" placeholder="Warrior Name (e.g. Musashi)" />
        </div>
        <div class="input-group">
          <input id="inp-room" type="text" placeholder="Optional Room ID (leave blank to auto-join)" />
          <button id="btn-join" class="primary">Enter Arena</button>
        </div>
        <div id="join-err" style="color:#f85149;font-size:12px;"></div>
      </div>
    `;

    document.getElementById("btn-join")?.addEventListener("click", async () => {
      const nameInput = document.getElementById("inp-name") as HTMLInputElement;
      const roomInput = document.getElementById("inp-room") as HTMLInputElement;
      const errEl = document.getElementById("join-err")!;
      try {
        errEl.textContent = "Connecting to server...";
        await this.net.joinOrCreate(nameInput.value, roomInput.value);
      } catch (err) {
        errEl.textContent = `Connection failed: ${(err as Error).message}`;
      }
    });
  }

  private renderLobbyModal(
    players: Map<string, PlayerSnapshot>,
    phase: string,
    countdownSec: number,
    hostId: string
  ): void {
    const me = players.get(this.net.sessionId);
    const isHost = this.net.sessionId === hostId;
    const canStart = players.size >= 2;

    let rowsHtml = "";
    players.forEach((p, id) => {
      rowsHtml += `
        <div class="player-row">
          <span>${p.name} ${id === hostId ? "(Host)" : ""} ${id === this.net.sessionId ? "(You)" : ""}</span>
          <span class="${p.ready ? "badge-ready" : "badge-wait"}">${p.ready ? "READY" : "WAITING"}</span>
        </div>
      `;
    });

    this.modalOverlay.innerHTML = `
      <div class="modal-card">
        <div class="modal-title">THREE SEAS LOBBY (${players.size}/8)</div>
        <div style="font-size:12px;color:#8b949e;">
          Room ID: <strong style="color:#ffd166;">${this.net.roomId}</strong> (Open a 2nd browser tab to battle!)
        </div>
        <div class="player-list">${rowsHtml}</div>
        ${
          phase === "countdown"
            ? `<div style="text-align:center;font-size:18px;color:#3fb950;font-weight:700;">Match starts in ${countdownSec}s...</div>`
            : `<div class="input-group" style="justify-content:space-between;">
                <button id="btn-ready" class="secondary">${me?.ready ? "Unready" : "Ready Up"}</button>
                ${
                  isHost
                    ? `<button id="btn-start" class="primary" ${canStart ? "" : "disabled"}>Start Match</button>`
                    : `<span style="font-size:12px;color:#8b949e;align-self:center;">Waiting for Host...</span>`
                }
              </div>`
        }
      </div>
    `;

    document.getElementById("btn-ready")?.addEventListener("click", () => {
      this.net.sendReady(!me?.ready);
    });
    document.getElementById("btn-start")?.addEventListener("click", () => {
      this.net.sendStartMatch();
    });
  }

  private async renderResultsModal(
    players: Map<string, PlayerSnapshot>,
    winnerName: string
  ): Promise<void> {
    const ranked = Array.from(players.values())
      .filter((p) => p.placement > 0)
      .sort((a, b) => a.placement - b.placement);

    const matchRows = ranked
      .map(
        (p) => `
        <tr>
          <td class="${p.placement === 1 ? "rank-1" : ""}">#${p.placement}</td>
          <td class="${p.placement === 1 ? "rank-1" : ""}">${p.name}</td>
          <td>${p.kills}</td>
          <td>${Math.round(p.honor)}</td>
          <td class="xp-gain">+${p.xpEarned} XP</td>
        </tr>
      `
      )
      .join("");

    const lb = await this.net.fetchLeaderboard();
    const lbRows =
      lb.rows.length > 0
        ? lb.rows
            .map(
              (r, i) => `
          <tr>
            <td>#${i + 1}</td>
            <td>${r.warriorName}</td>
            <td>${r.wins}</td>
            <td>${r.totalKos}</td>
            <td class="xp-gain">${r.totalXp} XP</td>
          </tr>
        `
            )
            .join("")
        : `<tr><td colspan="5" style="color:#8b949e;">No persisted records yet</td></tr>`;

    this.modalOverlay.innerHTML = `
      <div class="modal-card wide">
        <div class="modal-title" style="text-align:center;">VICTORY: ${winnerName.toUpperCase()}</div>
        <div class="results-grid">
          <div class="panel-box">
            <div class="panel-heading">MATCH PLACEMENTS &amp; XP</div>
            <table class="stats-table">
              <thead><tr><th>Rank</th><th>Warrior</th><th>KOs</th><th>Honor</th><th>XP</th></tr></thead>
              <tbody>${matchRows}</tbody>
            </table>
          </div>
          <div class="panel-box">
            <div class="panel-heading">ALL-TIME LEADERBOARD (${lb.source.toUpperCase()})</div>
            <table class="stats-table">
              <thead><tr><th>#</th><th>Warrior</th><th>Wins</th><th>KOs</th><th>Total XP</th></tr></thead>
              <tbody>${lbRows}</tbody>
            </table>
          </div>
        </div>
        <div style="display:flex;justify-content:center;gap:12px;">
          <button id="btn-rematch" class="primary">Play Again (Return to Lobby)</button>
        </div>
      </div>
    `;

    document.getElementById("btn-rematch")?.addEventListener("click", () => {
      this.net.sendRematch();
    });
  }

  private buildLobbyFingerprint(players: Map<string, PlayerSnapshot>): string {
    const parts: string[] = [];
    players.forEach((p, id) => parts.push(`${id}:${p.name}:${p.ready}`));
    return parts.join("|");
  }
}
