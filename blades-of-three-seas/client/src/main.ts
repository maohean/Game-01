import Phaser from "phaser";
import { NetworkClient } from "./net/NetworkClient";
import { HudController } from "./ui/HudController";
import { CombatScene } from "./scenes/CombatScene";

const net = new NetworkClient();
const hud = new HudController(net);
const combatScene = new CombatScene(net, hud);

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game-container",
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: "#0d1117",
  scene: [combatScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
