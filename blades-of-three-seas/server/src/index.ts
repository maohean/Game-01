import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { SamuraiRoom } from "./rooms/SamuraiRoom.js";
import { leaderboardRepo } from "./db/leaderboard.js";

const PORT = Number(process.env.PORT || 2567);
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/leaderboard", async (_req, res) => {
  const data = await leaderboardRepo.getTopLeaderboard();
  res.json(data);
});

const httpServer = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("samurai_duel", SamuraiRoom);

httpServer.listen(PORT, () => {
  console.log(`[BladesOfThreeSeas] Authoritative Colyseus Server listening on ws://localhost:${PORT}`);
});
