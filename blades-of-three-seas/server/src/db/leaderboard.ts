import { LeaderboardEntry } from "@bots/shared";
import pg from "pg";

export interface MatchResultRecord {
  warriorName: string;
  won: boolean;
  kos: number;
  xpEarned: number;
}

class LeaderboardRepository {
  private pool: pg.Pool | null = null;
  private dbConnected = false;
  private memoryStore = new Map<string, LeaderboardEntry>();

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      const connStr =
        process.env.DATABASE_URL ||
        "postgres://bots_user:bots_password@localhost:5432/blades_of_three_seas";
      this.pool = new pg.Pool({ connectionString: connStr, connectionTimeoutMillis: 1500 });
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS warrior_leaderboard (
          warrior_name VARCHAR(32) PRIMARY KEY,
          matches_played INT NOT NULL DEFAULT 0,
          wins INT NOT NULL DEFAULT 0,
          total_kos INT NOT NULL DEFAULT 0,
          total_xp INT NOT NULL DEFAULT 0
        );
      `);
      this.dbConnected = true;
      console.log("[LeaderboardDB] Connected to PostgreSQL.");
    } catch {
      this.dbConnected = false;
      console.log("[LeaderboardDB] PostgreSQL unavailable — using in-memory fallback.");
    }
  }

  async recordMatchResults(records: MatchResultRecord[]): Promise<void> {
    for (const r of records) {
      if (this.dbConnected && this.pool) {
        try {
          await this.pool.query(
            `
            INSERT INTO warrior_leaderboard (warrior_name, matches_played, wins, total_kos, total_xp)
            VALUES ($1, 1, $2, $3, $4)
            ON CONFLICT (warrior_name) DO UPDATE SET
              matches_played = warrior_leaderboard.matches_played + 1,
              wins = warrior_leaderboard.wins + EXCLUDED.wins,
              total_kos = warrior_leaderboard.total_kos + EXCLUDED.total_kos,
              total_xp = warrior_leaderboard.total_xp + EXCLUDED.total_xp;
          `,
            [r.warriorName, r.won ? 1 : 0, r.kos, r.xpEarned]
          );
          continue;
        } catch {
          this.dbConnected = false;
        }
      }

      const prev = this.memoryStore.get(r.warriorName) ?? {
        warriorName: r.warriorName,
        matchesPlayed: 0,
        wins: 0,
        totalKos: 0,
        totalXp: 0,
      };
      prev.matchesPlayed += 1;
      prev.wins += r.won ? 1 : 0;
      prev.totalKos += r.kos;
      prev.totalXp += r.xpEarned;
      this.memoryStore.set(r.warriorName, prev);
    }
  }

  async getTopLeaderboard(): Promise<{ source: string; rows: LeaderboardEntry[] }> {
    if (this.dbConnected && this.pool) {
      try {
        const res = await this.pool.query(`
          SELECT warrior_name AS "warriorName",
                 matches_played AS "matchesPlayed",
                 wins,
                 total_kos AS "totalKos",
                 total_xp AS "totalXp"
          FROM warrior_leaderboard
          ORDER BY total_xp DESC, wins DESC
          LIMIT 10;
        `);
        return { source: "postgresql", rows: res.rows };
      } catch {
        this.dbConnected = false;
      }
    }

    const rows = Array.from(this.memoryStore.values())
      .sort((a, b) => b.totalXp - a.totalXp || b.wins - a.wins)
      .slice(0, 10);
    return { source: "memory", rows };
  }
}

export const leaderboardRepo = new LeaderboardRepository();
