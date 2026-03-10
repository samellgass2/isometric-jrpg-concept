import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import {
  getBattleOutcomeFlag,
  KEY_BATTLE_OUTCOME_FLAGS,
  normalizePlayerProgressState,
} from "../state/playerProgress.js";
import { loadProgress } from "../persistence/saveSystem.js";
import { ensureSharedAssets, TEXTURE_KEYS } from "../render/sharedAssets.js";
import { applyKeyboardCapture, getPointerWorldPosition } from "../platform/browserCompat.js";

const TILE_SIZE = 52;
const MAP_WIDTH = 12;
const MAP_HEIGHT = 11;
const PLAYER_SPEED = 180;
const INTERACTION_DISTANCE = TILE_SIZE;
const ARRIVAL_THRESHOLD = 4;
const UI_DEPTH = 30;

const START_TILE = { x: 1, y: 9 };
const EXIT_TILE = { x: 10, y: 1 };
const LEVEL2_BATTLE_ENCOUNTER_ID = "level-2-canyon-gauntlet";
const LEVEL2_BATTLE_TOTEM_TILE = { x: 5, y: 5 };
const CARDINAL_DIRECTIONS = Object.freeze([
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]);

const TILE_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

function tileToWorld(tileX, tileY) {
  return {
    x: tileX * TILE_SIZE + TILE_SIZE / 2,
    y: tileY * TILE_SIZE + TILE_SIZE / 2,
  };
}

function worldToTile(worldX, worldY) {
  return {
    x: Math.floor(worldX / TILE_SIZE),
    y: Math.floor(worldY / TILE_SIZE),
  };
}

function tileKey(tileX, tileY) {
  return `${tileX},${tileY}`;
}

class Level2Scene extends Phaser.Scene {
  constructor() {
    super("Level2Scene");
    this.player = null;
    this.collisionTiles = new Set();
    this.collisionBodies = null;
    this.exitBeacon = null;
    this.pointerPath = [];
    this.pointerPathTiles = [];
    this.cursors = null;
    this.wasdKeys = null;
    this.interactKeys = null;
    this.returnKey = null;
    this.isReturning = false;
    this.levelStartTile = { ...START_TILE };
    this.clearedEncounterIds = new Set();
    this.battleTotem = null;
    this.battleStartLock = false;
    this.movementVector = { x: 0, y: 0 };
    this.bfsQueue = [];
    this.pointerDownHandler = null;
    this.pendingPointerTile = null;
  }

  create(data = {}) {
    ensureSharedAssets(this);
    const progress = this.getProgressState();
    this.levelStartTile = data?.spawnTile ?? { ...START_TILE };
    this.clearedEncounterIds = new Set(data?.clearedEncounterIds ?? []);
    if (getBattleOutcomeFlag(progress, KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED)) {
      this.clearedEncounterIds.add(LEVEL2_BATTLE_ENCOUNTER_ID);
    }
    if (data?.battleResult === "victory" && data?.lastEncounterId === LEVEL2_BATTLE_ENCOUNTER_ID) {
      this.clearedEncounterIds.add(LEVEL2_BATTLE_ENCOUNTER_ID);
    }
    this.battleStartLock = false;
    this.pendingPointerTile = null;

    const mapPixelWidth = MAP_WIDTH * TILE_SIZE;
    const mapPixelHeight = MAP_HEIGHT * TILE_SIZE;

    this.cameras.main.setBackgroundColor("#241912");
    this.physics.world.setBounds(0, 0, mapPixelWidth, mapPixelHeight);
    this.cameras.main.setBounds(0, 0, mapPixelWidth, mapPixelHeight);

    this.renderTerrain();
    this.createCollisionBodies();
    this.createPlayer();
    this.createExitBeacon();
    this.createBattleTotem();
    this.setupInput();
    this.setupPointerInput();
    this.createUi();

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
  }

  getProgressState() {
    const fromRegistry = this.game?.registry?.get("playerProgress");
    if (fromRegistry) {
      return normalizePlayerProgressState(fromRegistry);
    }

    return normalizePlayerProgressState(loadProgress());
  }

  renderTerrain() {
    this.terrainLayer = this.add.layer();

    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const isBlocked = TILE_LAYOUT[y][x] === 1;
        const tileTexture = isBlocked
          ? TEXTURE_KEYS.level2Wall
          : (x + y) % 2 === 0
            ? TEXTURE_KEYS.level2FloorA
            : TEXTURE_KEYS.level2FloorB;
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          tileTexture
        );
        this.terrainLayer.add(tile);

        if (isBlocked) {
          this.collisionTiles.add(tileKey(x, y));
        }
      }
    }
  }

  createCollisionBodies() {
    this.collisionBodies = this.physics.add.staticGroup();
    this.collisionTiles.forEach((key) => {
      const [tileX, tileY] = key.split(",").map(Number);
      const world = tileToWorld(tileX, tileY);
      const body = this.add.zone(world.x, world.y, TILE_SIZE - 3, TILE_SIZE - 3);
      this.physics.add.existing(body, true);
      this.collisionBodies.add(body);
    });
  }

  createPlayer() {
    const start = tileToWorld(this.levelStartTile.x, this.levelStartTile.y);
    this.player = this.add.rectangle(start.x, start.y, TILE_SIZE - 20, TILE_SIZE - 20, 0xffcc86, 1);
    this.physics.add.existing(this.player);
    this.player.setStrokeStyle(2, 0xffefca, 1);
    this.player.body.setAllowGravity(false);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(PLAYER_SPEED, PLAYER_SPEED);
    this.physics.add.collider(this.player, this.collisionBodies);
  }

  createExitBeacon() {
    const exit = tileToWorld(EXIT_TILE.x, EXIT_TILE.y);
    this.exitBeacon = this.add.rectangle(exit.x, exit.y, 22, 22, 0x90e5ff, 0.9).setDepth(6);
    this.exitBeacon.setStrokeStyle(2, 0xd7f6ff, 1);
    this.add
      .text(exit.x, exit.y - 30, "OVERWORLD", {
        color: "#dbf7ff",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "#124055bb",
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(7);

    this.exitBeacon.setInteractive({ useHandCursor: true });
    this.exitBeacon.on("pointerdown", () => {
      if (this.playerIsNearExit()) {
        this.returnToOverworld();
      }
    });

    this.tweens.add({
      targets: this.exitBeacon,
      scaleX: { from: 0.8, to: 1.15 },
      scaleY: { from: 0.8, to: 1.15 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
  }

  createUi() {
    this.add
      .text(14, 12, "Level 2 - Canyon Crossing", {
        color: "#fff0dc",
        fontFamily: "monospace",
        fontSize: "17px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.add
      .text(
        14,
        36,
        "Move: Arrows/WASD or click | Battle: interact near TOTEM | Return: Esc or interact near OVERWORLD marker",
        {
          color: "#f2d9b8",
          fontFamily: "monospace",
          fontSize: "13px",
        }
      )
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);
  }

  createBattleTotem() {
    const world = tileToWorld(LEVEL2_BATTLE_TOTEM_TILE.x, LEVEL2_BATTLE_TOTEM_TILE.y);
    this.battleTotem = this.add
      .triangle(world.x, world.y, 0, 20, 11, 0, 22, 20, 0x8b2f2f, 0.95)
      .setDepth(6)
      .setStrokeStyle(2, 0xffc2c2, 1);

    this.add
      .text(world.x, world.y - 28, "TOTEM", {
        color: "#ffe0cc",
        fontFamily: "monospace",
        fontSize: "11px",
        backgroundColor: "#30170fcc",
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5)
      .setDepth(7);

    this.battleTotem.setInteractive({ useHandCursor: true });
    this.battleTotem.on("pointerdown", () => {
      if (this.playerIsNearBattleTotem()) {
        this.startLevelBattleEncounter();
      }
    });

    if (this.clearedEncounterIds.has(LEVEL2_BATTLE_ENCOUNTER_ID)) {
      this.setBattleTotemClearedVisual();
    }
  }

  setBattleTotemClearedVisual() {
    if (!this.battleTotem) {
      return;
    }
    this.battleTotem.setFillStyle(0x2a7a5d, 0.95);
    this.battleTotem.setStrokeStyle(2, 0xb0ffd9, 1);
  }

  setupInput() {
    const keyboard = this.input.keyboard;
    if (!keyboard) {
      return;
    }

    applyKeyboardCapture(keyboard);
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasdKeys = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.interactKeys = this.input.keyboard.addKeys({
      space: Phaser.Input.Keyboard.KeyCodes.SPACE,
      enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
    });
    this.returnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  setupPointerInput() {
    this.teardownPointerInput();
    this.pointerDownHandler = (pointer) => {
      if (this.isReturning || !this.player) {
        return;
      }

      const worldPoint = getPointerWorldPosition(this, pointer);
      if (!worldPoint) {
        return;
      }

      this.pendingPointerTile = worldToTile(worldPoint.x, worldPoint.y);
    };
    this.input.on("pointerdown", this.pointerDownHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownPointerInput());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownPointerInput());
  }

  teardownPointerInput() {
    if (this.pointerDownHandler) {
      this.input.off("pointerdown", this.pointerDownHandler);
      this.pointerDownHandler = null;
    }
    this.pendingPointerTile = null;
  }

  processPendingPointerInput() {
    if (!this.pendingPointerTile || this.isReturning || !this.player) {
      return;
    }

    const targetTile = this.pendingPointerTile;
    this.pendingPointerTile = null;

    if (!this.isWalkableTile(targetTile.x, targetTile.y)) {
      this.clearPointerPath();
      return;
    }

    const startTile = worldToTile(this.player.x, this.player.y);
    const tilePath = this.findTilePath(startTile, targetTile);
    if (!tilePath.length) {
      this.clearPointerPath();
      return;
    }

    this.pointerPathTiles = tilePath;
    this.pointerPath = tilePath.map((tile) => tileToWorld(tile.x, tile.y));
  }

  isInBounds(tileX, tileY) {
    return tileX >= 0 && tileY >= 0 && tileX < MAP_WIDTH && tileY < MAP_HEIGHT;
  }

  isWalkableTile(tileX, tileY) {
    if (!this.isInBounds(tileX, tileY)) {
      return false;
    }
    return !this.collisionTiles.has(tileKey(tileX, tileY));
  }

  findTilePath(startTile, targetTile) {
    if (startTile.x === targetTile.x && startTile.y === targetTile.y) {
      return [];
    }

    const queue = this.bfsQueue;
    queue.length = 0;
    queue.push({ x: startTile.x, y: startTile.y });
    let queueIndex = 0;
    const visited = new Set([tileKey(startTile.x, startTile.y)]);
    const parentMap = new Map();

    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;
      if (current.x === targetTile.x && current.y === targetTile.y) {
        break;
      }

      for (const [deltaX, deltaY] of CARDINAL_DIRECTIONS) {
        const neighborX = current.x + deltaX;
        const neighborY = current.y + deltaY;
        const key = tileKey(neighborX, neighborY);
        if (!this.isWalkableTile(neighborX, neighborY) || visited.has(key)) {
          continue;
        }

        visited.add(key);
        parentMap.set(key, current);
        queue.push({ x: neighborX, y: neighborY });
      }
    }

    const targetKey = tileKey(targetTile.x, targetTile.y);
    if (!parentMap.has(targetKey)) {
      return [];
    }

    const path = [];
    let node = targetTile;
    while (!(node.x === startTile.x && node.y === startTile.y)) {
      path.push(node);
      node = parentMap.get(tileKey(node.x, node.y));
      if (!node) {
        return [];
      }
    }

    path.reverse();
    return path;
  }

  clearPointerPath() {
    this.pointerPath = [];
    this.pointerPathTiles = [];
  }

  moveAlongPointerPath() {
    if (!this.player?.body || !this.pointerPath.length) {
      return false;
    }

    const nextWaypoint = this.pointerPath[0];
    const nextDeltaX = nextWaypoint.x - this.player.x;
    const nextDeltaY = nextWaypoint.y - this.player.y;
    const distanceSquared = nextDeltaX * nextDeltaX + nextDeltaY * nextDeltaY;

    if (distanceSquared <= ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD) {
      this.player.setPosition(nextWaypoint.x, nextWaypoint.y);
      this.pointerPath.shift();
      this.pointerPathTiles.shift();
      if (!this.pointerPath.length) {
        this.player.body.setVelocity(0, 0);
        return false;
      }
    }

    const targetWaypoint = this.pointerPath[0];
    const deltaX = targetWaypoint.x - this.player.x;
    const deltaY = targetWaypoint.y - this.player.y;
    const magnitudeSquared = deltaX * deltaX + deltaY * deltaY;
    if (magnitudeSquared === 0) {
      this.player.body.setVelocity(0, 0);
      return true;
    }

    const magnitude = Math.sqrt(magnitudeSquared);
    this.player.body.setVelocity((deltaX / magnitude) * PLAYER_SPEED, (deltaY / magnitude) * PLAYER_SPEED);
    return true;
  }

  getMovementVector() {
    const leftPressed = this.cursors?.left?.isDown || this.wasdKeys?.left?.isDown;
    const rightPressed = this.cursors?.right?.isDown || this.wasdKeys?.right?.isDown;
    const upPressed = this.cursors?.up?.isDown || this.wasdKeys?.up?.isDown;
    const downPressed = this.cursors?.down?.isDown || this.wasdKeys?.down?.isDown;

    if (leftPressed && !rightPressed) {
      this.movementVector.x = -1;
      this.movementVector.y = 0;
      return this.movementVector;
    }
    if (rightPressed && !leftPressed) {
      this.movementVector.x = 1;
      this.movementVector.y = 0;
      return this.movementVector;
    }
    if (upPressed && !downPressed) {
      this.movementVector.x = 0;
      this.movementVector.y = -1;
      return this.movementVector;
    }
    if (downPressed && !upPressed) {
      this.movementVector.x = 0;
      this.movementVector.y = 1;
      return this.movementVector;
    }
    this.movementVector.x = 0;
    this.movementVector.y = 0;
    return this.movementVector;
  }

  playerIsNearExit() {
    if (!this.player || !this.exitBeacon) {
      return false;
    }
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.exitBeacon.x, this.exitBeacon.y);
    return distance <= INTERACTION_DISTANCE;
  }

  playerIsNearBattleTotem() {
    if (!this.player || !this.battleTotem) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.battleTotem.x, this.battleTotem.y);
    return distance <= INTERACTION_DISTANCE;
  }

  handleReturnInput() {
    if (this.returnKey && Phaser.Input.Keyboard.JustDown(this.returnKey)) {
      this.returnToOverworld();
      return;
    }

    const interactPressed =
      (this.interactKeys?.space && Phaser.Input.Keyboard.JustDown(this.interactKeys.space)) ||
      (this.interactKeys?.enter && Phaser.Input.Keyboard.JustDown(this.interactKeys.enter));

    if (interactPressed) {
      if (
        !this.clearedEncounterIds.has(LEVEL2_BATTLE_ENCOUNTER_ID) &&
        this.playerIsNearBattleTotem()
      ) {
        this.startLevelBattleEncounter();
        return;
      }

      if (this.playerIsNearExit()) {
        this.returnToOverworld();
      }
    }
  }

  returnToOverworld() {
    if (this.isReturning) {
      return;
    }

    this.isReturning = true;
    this.clearPointerPath();
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.time.delayedCall(170, () => {
      this.scene.start("OverworldScene", { spawnPointId: "level-2-return" });
    });
  }

  startLevelBattleEncounter() {
    if (
      this.battleStartLock ||
      this.isReturning ||
      this.clearedEncounterIds.has(LEVEL2_BATTLE_ENCOUNTER_ID)
    ) {
      return;
    }

    this.battleStartLock = true;
    this.clearPointerPath();
    this.player.body.setVelocity(0, 0);
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.time.delayedCall(170, () => {
      this.scene.start("BattleScene", {
        encounterId: LEVEL2_BATTLE_ENCOUNTER_ID,
        returnSceneKey: "Level2Scene",
        returnSceneData: {
          spawnTile: { x: LEVEL2_BATTLE_TOTEM_TILE.x + 1, y: LEVEL2_BATTLE_TOTEM_TILE.y },
          clearedEncounterIds: [...this.clearedEncounterIds],
        },
      });
    });
  }

  update() {
    if (!this.player?.body || this.isReturning) {
      return;
    }

    this.handleReturnInput();
    this.processPendingPointerInput();

    const movement = this.getMovementVector();
    if (movement.x !== 0 || movement.y !== 0) {
      this.clearPointerPath();
      this.player.body.setVelocity(movement.x * PLAYER_SPEED, movement.y * PLAYER_SPEED);
      return;
    }

    if (this.moveAlongPointerPath()) {
      return;
    }

    this.player.body.setVelocity(0, 0);
  }
}

export default Level2Scene;
