import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import {
  ensureSharedTextures,
  isSharedTextureSetLoaded,
  makeReusedVector2,
  SHARED_TEXTURE_KEYS,
} from "../graphics/sharedTextures.js";
import {
  getBattleOutcomeFlag,
  KEY_BATTLE_OUTCOME_FLAGS,
  normalizePlayerProgressState,
} from "../state/playerProgress.js";
import { loadProgress } from "../persistence/saveSystem.js";
import {
  getNormalizedPointerWorldPosition,
  shouldProcessPointerDown,
} from "../platform/browserCompat.js";

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
    this.pointerPathIndex = 0;
    this.pendingPathRequest = null;
    this.pointerDownHandler = null;
    this.cursors = null;
    this.wasdKeys = null;
    this.interactKeys = null;
    this.returnKey = null;
    this.isReturning = false;
    this.levelStartTile = { ...START_TILE };
    this.clearedEncounterIds = new Set();
    this.battleTotem = null;
    this.battleStartLock = false;
    this.collisionTileCoords = [];
    this.cullableWorldObjects = [];
    this.cullPadding = TILE_SIZE * 2;
    this.nextCullUpdateAt = 0;
    this.reusableMovementVector = { x: 0, y: 0 };
    this.reusableDirectionVector = makeReusedVector2();
  }

  create(data = {}) {
    if (!isSharedTextureSetLoaded(this)) {
      ensureSharedTextures(this);
    }

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupInputHandlers());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanupInputHandlers());
    this.createUi();
    this.updateCulledObjectVisibility(true);

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
        const textureKey = isBlocked
          ? SHARED_TEXTURE_KEYS.LEVEL2_TILE_WALL
          : (x + y) % 2 === 0
            ? SHARED_TEXTURE_KEYS.LEVEL2_TILE_FLOOR_A
            : SHARED_TEXTURE_KEYS.LEVEL2_TILE_FLOOR_B;
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          textureKey
        );
        this.terrainLayer.add(tile);
        this.cullableWorldObjects.push(tile);

        if (isBlocked) {
          const key = tileKey(x, y);
          this.collisionTiles.add(key);
          this.collisionTileCoords.push({ x, y });
        }
      }
    }
  }

  createCollisionBodies() {
    this.collisionBodies = this.physics.add.staticGroup();
    this.collisionTileCoords.forEach(({ x, y }) => {
      const body = this.add.zone(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE - 3, TILE_SIZE - 3);
      this.physics.add.existing(body, true);
      this.collisionBodies.add(body);
    });
  }

  createPlayer() {
    const start = tileToWorld(this.levelStartTile.x, this.levelStartTile.y);
    this.player = this.physics.add.rectangle(start.x, start.y, TILE_SIZE - 20, TILE_SIZE - 20, 0xffcc86, 1);
    this.player.setStrokeStyle(2, 0xffefca, 1);
    this.player.body.setAllowGravity(false);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(PLAYER_SPEED, PLAYER_SPEED);
    this.physics.add.collider(this.player, this.collisionBodies);
  }

  createExitBeacon() {
    const exit = tileToWorld(EXIT_TILE.x, EXIT_TILE.y);
    this.exitBeacon = this.add.image(exit.x, exit.y, SHARED_TEXTURE_KEYS.LEVEL2_EXIT_BEACON).setDepth(6);
    this.cullableWorldObjects.push(this.exitBeacon);
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
      .image(world.x, world.y, SHARED_TEXTURE_KEYS.LEVEL2_BATTLE_TOTEM)
      .setDepth(6);
    this.cullableWorldObjects.push(this.battleTotem);

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
    this.battleTotem.setTint(0x5cdba0);
  }

  setupInput() {
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
    if (this.pointerDownHandler) {
      this.input.off("pointerdown", this.pointerDownHandler);
    }

    this.pointerDownHandler = (pointer) => {
      if (!shouldProcessPointerDown(pointer)) {
        return;
      }

      if (this.isReturning || !this.player) {
        return;
      }

      const worldPoint = getNormalizedPointerWorldPosition(this, pointer);
      const targetTile = worldPoint
        ? worldToTile(worldPoint.x, worldPoint.y)
        : worldToTile(pointer.worldX, pointer.worldY);
      this.pendingPathRequest = { x: targetTile.x, y: targetTile.y };
    };

    this.input.on("pointerdown", this.pointerDownHandler);
  }

  cleanupInputHandlers() {
    if (this.pointerDownHandler) {
      this.input.off("pointerdown", this.pointerDownHandler);
      this.pointerDownHandler = null;
    }
    this.pendingPathRequest = null;
  }

  processPendingPathRequest() {
    if (!this.pendingPathRequest || this.isReturning || !this.player) {
      return;
    }

    const targetTile = this.pendingPathRequest;
    this.pendingPathRequest = null;

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
    this.pointerPathIndex = 0;
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

    const queue = [{ x: startTile.x, y: startTile.y }];
    const visited = new Set([tileKey(startTile.x, startTile.y)]);
    const parentMap = new Map();

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.x === targetTile.x && current.y === targetTile.y) {
        break;
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      neighbors.forEach((neighbor) => {
        const key = tileKey(neighbor.x, neighbor.y);
        if (!this.isWalkableTile(neighbor.x, neighbor.y) || visited.has(key)) {
          return;
        }

        visited.add(key);
        parentMap.set(key, current);
        queue.push(neighbor);
      });
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
    this.pointerPathIndex = 0;
  }

  updateCulledObjectVisibility(force = false) {
    const now = this.time.now;
    if (!force && now < this.nextCullUpdateAt) {
      return;
    }

    this.nextCullUpdateAt = now + 220;
    const worldView = this.cameras.main.worldView;
    const minX = worldView.x - this.cullPadding;
    const minY = worldView.y - this.cullPadding;
    const maxX = worldView.right + this.cullPadding;
    const maxY = worldView.bottom + this.cullPadding;

    this.cullableWorldObjects.forEach((obj) => {
      if (!obj || !obj.active) {
        return;
      }
      const visible = obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY;
      obj.setVisible(visible);
    });
  }

  moveAlongPointerPath() {
    if (!this.player?.body || this.pointerPathIndex >= this.pointerPath.length) {
      return false;
    }

    const nextWaypoint = this.pointerPath[this.pointerPathIndex];
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, nextWaypoint.x, nextWaypoint.y);

    if (distance <= ARRIVAL_THRESHOLD) {
      this.player.setPosition(nextWaypoint.x, nextWaypoint.y);
      this.pointerPathIndex += 1;
      if (this.pointerPathIndex >= this.pointerPath.length) {
        this.player.body.setVelocity(0, 0);
        return false;
      }
    }

    const targetWaypoint = this.pointerPath[this.pointerPathIndex];
    const direction = this.reusableDirectionVector;
    direction.set(targetWaypoint.x - this.player.x, targetWaypoint.y - this.player.y);
    if (direction.lengthSq() === 0) {
      this.player.body.setVelocity(0, 0);
      return true;
    }

    direction.normalize().scale(PLAYER_SPEED);
    this.player.body.setVelocity(direction.x, direction.y);
    return true;
  }

  getMovementVector() {
    const movement = this.reusableMovementVector;
    movement.x = 0;
    movement.y = 0;

    const leftPressed = this.cursors.left.isDown || this.wasdKeys.left.isDown;
    const rightPressed = this.cursors.right.isDown || this.wasdKeys.right.isDown;
    const upPressed = this.cursors.up.isDown || this.wasdKeys.up.isDown;
    const downPressed = this.cursors.down.isDown || this.wasdKeys.down.isDown;

    if (leftPressed && !rightPressed) {
      movement.x = -1;
      return movement;
    }
    if (rightPressed && !leftPressed) {
      movement.x = 1;
      return movement;
    }
    if (upPressed && !downPressed) {
      movement.y = -1;
      return movement;
    }
    if (downPressed && !upPressed) {
      movement.y = 1;
      return movement;
    }
    return movement;
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
    if (Phaser.Input.Keyboard.JustDown(this.returnKey)) {
      this.returnToOverworld();
      return;
    }

    const interactPressed =
      Phaser.Input.Keyboard.JustDown(this.interactKeys.space) ||
      Phaser.Input.Keyboard.JustDown(this.interactKeys.enter);

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
    this.updateCulledObjectVisibility();

    this.handleReturnInput();
    this.processPendingPathRequest();

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
