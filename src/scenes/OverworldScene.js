import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const TILE_SIZE = 48;
const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const PLAYER_SPEED = 180;
const MAP_PIXEL_WIDTH = MAP_WIDTH * TILE_SIZE;
const MAP_PIXEL_HEIGHT = MAP_HEIGHT * TILE_SIZE;

const PLAYER_TEXTURES = {
  idle: "player-idle",
  walkA: "player-walk-a",
  walkB: "player-walk-b",
};

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
    this.player = null;
    this.collisionBodies = null;
    this.cursors = null;
    this.wasdKeys = null;
  }

  create() {
    this.cameras.main.setBackgroundColor("#1f2228");
    this.physics.world.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);

    this.terrainLayer = this.add.layer();
    this.collisionLayer = this.add.layer();
    this.characterLayer = this.add.layer();

    this.npcGroup = this.add.group();

    this.renderTerrain();
    this.renderCollisionOverlay();
    this.createCollisionBodies();
    this.createPlayerCharacter();
    this.createNpcPlaceholders();
    this.setupMovementInput();

    this.add
      .text(16, 16, "Overworld Prototype", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setScrollFactor(0)
      .setDepth(20);
  }

  createPlayerTextures() {
    if (
      this.textures.exists(PLAYER_TEXTURES.idle) &&
      this.textures.exists(PLAYER_TEXTURES.walkA) &&
      this.textures.exists(PLAYER_TEXTURES.walkB)
    ) {
      return;
    }

    const drawFrame = (textureKey, bodyColor, accentColor) => {
      const frame = this.make.graphics({ x: 0, y: 0, add: false });
      frame.fillStyle(0x1f1f2b, 1);
      frame.fillRect(8, 1, 8, 8);
      frame.fillStyle(bodyColor, 1);
      frame.fillRoundedRect(4, 10, 16, 16, 3);
      frame.fillStyle(accentColor, 1);
      frame.fillRect(6, 13, 12, 2);
      frame.fillStyle(0x111111, 1);
      frame.fillRect(6, 28, 5, 3);
      frame.fillRect(13, 28, 5, 3);
      frame.generateTexture(textureKey, 24, 32);
      frame.destroy();
    };

    drawFrame(PLAYER_TEXTURES.idle, 0x2f71ff, 0x8cb3ff);
    drawFrame(PLAYER_TEXTURES.walkA, 0x3c7cff, 0xa8c6ff);
    drawFrame(PLAYER_TEXTURES.walkB, 0x2b66e0, 0x7ea8ff);
  }

  createPlayerAnimations() {
    if (!this.anims.exists("player-idle")) {
      this.anims.create({
        key: "player-idle",
        frames: [{ key: PLAYER_TEXTURES.idle }],
        frameRate: 1,
        repeat: -1,
      });
    }

    if (!this.anims.exists("player-walk")) {
      this.anims.create({
        key: "player-walk",
        frames: [
          { key: PLAYER_TEXTURES.walkA },
          { key: PLAYER_TEXTURES.walkB },
          { key: PLAYER_TEXTURES.walkA },
          { key: PLAYER_TEXTURES.idle },
        ],
        frameRate: 10,
        repeat: -1,
      });
    }
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

  createCollisionBodies() {
    this.collisionBodies = this.physics.add.staticGroup();

    this.collisionTiles.forEach((key) => {
      const [tileX, tileY] = key.split(",").map(Number);
      const world = tileToWorld(tileX, tileY);
      const blocker = this.add.zone(world.x, world.y, TILE_SIZE - 2, TILE_SIZE - 2);
      this.physics.add.existing(blocker, true);
      this.collisionBodies.add(blocker);
    });
  }

  createPlayerCharacter() {
    this.createPlayerTextures();
    this.createPlayerAnimations();

    const playerStart = tileToWorld(2, 2);
    this.player = this.physics.add.sprite(playerStart.x, playerStart.y, PLAYER_TEXTURES.idle);
    this.player.setDepth(10);
    this.player.setSize(16, 18);
    this.player.setOffset(4, 12);
    this.player.body.setAllowGravity(false);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(PLAYER_SPEED, PLAYER_SPEED);
    this.player.anims.play("player-idle");

    this.physics.add.collider(this.player, this.collisionBodies);
    this.characterLayer.add(this.player);
  }

  createNpcPlaceholders() {
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

  setupMovementInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
  }

  getMovementVector() {
    const leftPressed = this.cursors.left.isDown || this.wasdKeys.left.isDown;
    const rightPressed = this.cursors.right.isDown || this.wasdKeys.right.isDown;
    const upPressed = this.cursors.up.isDown || this.wasdKeys.up.isDown;
    const downPressed = this.cursors.down.isDown || this.wasdKeys.down.isDown;

    if (leftPressed && !rightPressed) {
      return { x: -1, y: 0 };
    }

    if (rightPressed && !leftPressed) {
      return { x: 1, y: 0 };
    }

    if (upPressed && !downPressed) {
      return { x: 0, y: -1 };
    }

    if (downPressed && !upPressed) {
      return { x: 0, y: 1 };
    }

    return { x: 0, y: 0 };
  }

  update() {
    if (!this.player || !this.player.body) {
      return;
    }

    const movement = this.getMovementVector();
    this.player.body.setVelocity(movement.x * PLAYER_SPEED, movement.y * PLAYER_SPEED);

    if (movement.x === 0 && movement.y === 0) {
      this.player.anims.play("player-idle", true);
      return;
    }

    if (movement.x !== 0) {
      this.player.setFlipX(movement.x < 0);
    }

    this.player.anims.play("player-walk", true);
  }
}

export default OverworldScene;
