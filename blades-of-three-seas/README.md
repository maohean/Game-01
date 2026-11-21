# Blades of Three Seas (Phases 1–6 Complete)

Authoritative multiplayer survival-duel RPG built with **Colyseus**, **Phaser 3**, **TypeScript**, and **PostgreSQL**.

## Included Features (Phases 1–6)
- **Combat & Stances (Phases 1–2):** 20Hz authoritative Colyseus simulation, High/Mid/Low stances, directional block, 200ms parry window, guard-break stagger, dodge roll, 4-stage shrinking storm, and Spectator mode.
- **Survival, Crafting & Day/Night (Phase 3):** 6-slot inventory with regional skins (Asia/Europe), resource gathering, campfires, cooking, blade forging, and dynamic 60s Day/Night lighting.
- **Rescue, Followers, Honor & Alliances (Phase 4):** 3 rescuable NPC scenarios, up to 3 followers (`fighter`, `archer`, `healer`, `scout`, `blacksmith`) with 10Hz FSM (`follow -> attack -> flee -> heal`) + 8-directional A* pathfinding, Honor system (`0-100`), temporary player alliances (`[H]`), downed revive (`[F]`), and betrayal penalty.
- **Full Asia Region & Chunked Tiled Map (Phase 5):** 6x4 Tiled chunk map (`asia_tiled_map.json`) with 3x3 spatial interest streaming, Bamboo Forest, Rice Paddies, Bamboo Village (Farmer, Apothecary, Blacksmith, Merchant, Guards), Mountain Temple free healing, Angkor Jungle Temple Boss + Treasure, 60s Japanese Castle Capture Point, Bridge Toll, Ambush zones, Tigers, and Night Oni Boss.
- **Europe & Sea Regions (Phase 6):** Connected via Borderland Wooden Bridge and Harbor Routes. Features Oak Forest, Medieval Village, Windmill, Inn, Church (Heal/Revive), Stone Castle with Drawbridge & Dungeon, 2–3 player Siege Weapons (Battering Ram & Ballista), Wolves, Bears, Forest Bandits, Harbor Boats (Rent Skiff / Buy Caravel), Lighthouse, Shipwreck with Sharks, Pirate Fort, and Sea Dragon Boss.

## Quick Start in VS Code
1. Open the `blades-of-three-seas` folder in VS Code.
2. Start PostgreSQL (optional; falls back cleanly to in-memory leaderboard if Docker is not running):
   ```bash
   docker compose up -d
   ```
3. Install dependencies and run both server (`:2567`) and client (`:5173`):
   ```bash
   npm install
   npm run dev
   ```
4. Open `http://localhost:5173` in **2 or more browser tabs** and click **Ready Up** / **Start Match**.
