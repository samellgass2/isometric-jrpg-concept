import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const TILE_SIZE = 48;
const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;

const TILE_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

function tileToWorld(tileX, tileY) {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

class OverworldScene extends Phaser.Scene {
  constructor() {
    super("OverworldScene");
    this.collisionTiles = new Set();
  }

  create() {
    this.cameras.main.setBackgroundColor("#1f2228");

    this.terrainLayer = this.add.layer();
    this.collisionLayer = this.add.layer();
    this.characterLayer = this.add.layer();

    this.npcGroup = this.add.group();

    this.renderTerrain();
    this.renderCollisionOverlay();
    this.createCharacterPlaceholders();

    this.add
      .text(16, 16, "Overworld Prototype", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setScrollFactor(0)
      .setDepth(20);
  }

  renderTerrain() {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const tileType = TILE_LAYOUT[y][x];
        const color = tileType === 1 ? 0x5a4b3d : 0x4c8f5e;

        const tile = this.add.rectangle(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
          color
        );

        this.terrainLayer.add(tile);

        if (tileType === 1) {
          this.collisionTiles.add(`${x},${y}`);
        }
      }
    }
  }

  renderCollisionOverlay() {
    this.collisionTiles.forEach((key) => {
      const [tileX, tileY] = key.split(",").map(Number);
      const marker = this.add.rectangle(
        tileX * TILE_SIZE + TILE_SIZE / 2,
        tileY * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE - 10,
        TILE_SIZE - 10,
        0xcc3344,
        0.25
      );
      this.collisionLayer.add(marker);
    });
  }

  createCharacterPlaceholders() {
    const playerStart = tileToWorld(2, 2);
    this.player = this.add.circle(playerStart.x, playerStart.y, 14, 0x2f71ff);
    this.characterLayer.add(this.player);

    const npcTiles = [
      { tileX: 8, tileY: 4 },
      { tileX: 11, tileY: 8 },
    ];

    npcTiles.forEach(({ tileX, tileY }) => {
      const world = tileToWorld(tileX, tileY);
      const npc = this.add.circle(world.x, world.y, 12, 0xe8b04d);
      this.characterLayer.add(npc);
      this.npcGroup.add(npc);
    });
  }
}

export default OverworldScene;
