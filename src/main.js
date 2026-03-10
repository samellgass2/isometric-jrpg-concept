import * as Phaser from "../node_modules/phaser/dist/phaser.esm.js";
import gameConfig from "./gameConfig.js";

const app = document.getElementById("app");

if (!app) {
  throw new Error("Missing #app container for Phaser game.");
}

app.replaceChildren();
// eslint-disable-next-line no-new
new Phaser.Game(gameConfig);
