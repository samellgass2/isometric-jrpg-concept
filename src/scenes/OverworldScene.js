import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import InputManager, { InputActions } from "../input/InputManager.js";
import HUDOverlay from "../ui/HUDOverlay.js";
import {
  ensureSharedAnimations,
  ensureSharedTextures,
  isSharedTextureSetLoaded,
  makeReusedVector2,
  OVERWORLD_ACTOR_FRAMES,
  SHARED_TEXTURE_KEYS,
} from "../graphics/sharedTextures.js";
import {
  getBattleOutcomeFlag,
  KEY_BATTLE_OUTCOME_FLAGS,
  normalizePlayerProgressState,
  updateOverworldPosition,
} from "../state/playerProgress.js";
import { loadProgress, saveProgress } from "../persistence/saveSystem.js";

const TILE_SIZE = 48;
const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const PLAYER_SPEED = 180;
const MAP_PIXEL_WIDTH = MAP_WIDTH * TILE_SIZE;
const MAP_PIXEL_HEIGHT = MAP_HEIGHT * TILE_SIZE;
const INTERACTION_DISTANCE = TILE_SIZE * 0.9;
const UI_DEPTH = 40;
const ARRIVAL_THRESHOLD = 4;
const SIGN_INTERACTION_DISTANCE = TILE_SIZE;

const NPC_DEFINITIONS = [
  {
    id: "npc-ranger",
    name: "Ranger Sol",
    textureFrame: OVERWORLD_ACTOR_FRAMES.NPC_RANGER,
    tileX: 8,
    tileY: 4,
    dialogue: "Ranger Sol: Trails ahead are rough. Stay inside the marked paths.",
  },
  {
    id: "npc-mechanic",
    name: "Mechanic Ivo",
    textureFrame: OVERWORLD_ACTOR_FRAMES.NPC_MECHANIC,
    tileX: 11,
    tileY: 8,
    dialogue: "Mechanic Ivo: Placeholder line... my workshop will open in a later build.",
  },
];

const LEVEL_SIGN_DEFINITIONS = [
  {
    id: "sign-level-1",
    label: "Level 1",
    textureFrame: OVERWORLD_ACTOR_FRAMES.SIGN_LEVEL_1,
    tileX: 4,
    tileY: 9,
    prompt: "Level 1: Training Grounds",
  },
  {
    id: "sign-level-2",
    label: "Level 2",
    textureFrame: OVERWORLD_ACTOR_FRAMES.SIGN_LEVEL_2,
    tileX: 13,
    tileY: 3,
    prompt: "Level 2: Canyon Crossing",
  },
];

const LEVEL_SCENE_BY_SIGN_ID = {
  "sign-level-1": "Level1Scene",
  "sign-level-2": "Level2Scene",
};

const OVERWORLD_SPAWN_BY_ID = {
  default: { x: 2, y: 2 },
  "level-1-return": { x: 3, y: 9 },
  "level-2-return": { x: 12, y: 3 },
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

function worldToTile(worldX, worldY) {
  return {
    x: Math.floor(worldX / TILE_SIZE),
    y: Math.floor(worldY / TILE_SIZE),
  };
}

function keyForTile(x, y) {
  return `${x},${y}`;
}

class OverworldScene extends Phaser.Scene {
  constructor() {
    super("OverworldScene");
    this.collisionTiles = new Set();
    this.player = null;
    this.collisionBodies = null;
    this.inputManager = null;
    this.inputUnsubscribe = null;
    this.npcGroup = null;
    this.signGroup = null;
    this.npcEntities = [];
    this.levelSigns = [];
    this.dialogueBox = null;
    this.dialogueText = null;
    this.dialogueHintText = null;
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.pointerPath = [];
    this.pointerPathTiles = [];
    this.pointerPathIndex = 0;
    this.pendingTileSelection = null;
    this.npcTileSet = new Set();
    this.signTileSet = new Set();
    this.collisionTileCoords = [];
    this.cullableWorldObjects = [];
    this.cullPadding = TILE_SIZE * 2;
    this.nextCullUpdateAt = 0;
    this.reusableMovementVector = { x: 0, y: 0 };
    this.reusableDirectionVector = makeReusedVector2();
    this.isTransitioning = false;
    this.hudOverlay = null;
    this.hudLastKey = "";
    this.playerDisplayName = "Pathfinder";
    this.playerStats = { hp: 100, maxHp: 100 };
    this.lastSavedTileKey = "";
    this.progressSnapshot = normalizePlayerProgressState();
  }

  create(data) {
    if (!isSharedTextureSetLoaded(this)) {
      ensureSharedTextures(this);
    }
    ensureSharedAnimations(this);

    const progress = this.getProgressState();
    this.progressSnapshot = progress;
    const requestedSpawnPointId =
      typeof data?.spawnPointId === "string" && data.spawnPointId.trim() ? data.spawnPointId.trim() : null;

    this.cameras.main.setBackgroundColor("#1f2228");
    this.physics.world.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);

    this.terrainLayer = this.add.layer();
    this.collisionLayer = this.add.layer();
    this.characterLayer = this.add.layer();

    this.npcGroup = this.physics.add.staticGroup();
    this.signGroup = this.physics.add.staticGroup();

    this.renderTerrain();
    this.renderCollisionOverlay();
    this.createCollisionBodies();
    const spawnTile = this.resolveSpawnTile(requestedSpawnPointId, progress?.overworld);
    this.createPlayerCharacter(spawnTile);
    this.createNpcPlaceholders();
    this.createLevelSigns();
    this.setupInputManager();
    this.createDialogueUi();
    this.createHudOverlay(data);
    this.updateCulledObjectVisibility(true);

    this.add
      .text(16, 16, "Overworld Prototype", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.add
      .text(16, 40, "Move: Arrows/WASD or Mouse Click  Interact: Space/Enter", {
        color: "#d7e0ef",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.persistOverworldProgress({
      force: true,
      spawnPointId: requestedSpawnPointId,
      currentSceneKey: this.scene.key,
    });
  }

  createHudOverlay(data = {}) {
    const configuredName = typeof data.playerName === "string" ? data.playerName.trim() : "";
    if (configuredName) {
      this.playerDisplayName = configuredName;
    }

    const hp = Number.isFinite(data.playerHp) ? data.playerHp : this.playerStats.hp;
    const maxHp = Number.isFinite(data.playerMaxHp) ? data.playerMaxHp : this.playerStats.maxHp;
    this.playerStats.maxHp = Math.max(1, Math.floor(maxHp));
    this.playerStats.hp = Phaser.Math.Clamp(Math.floor(hp), 0, this.playerStats.maxHp);

    this.hudOverlay = new HUDOverlay(this, { y: 12, width: 250, depth: UI_DEPTH + 20 });
    this.hudOverlay.create();
    this.syncHudOverlay(true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyHudOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyHudOverlay());
  }

  syncHudOverlay(force = false) {
    if (!this.hudOverlay) {
      return;
    }

    const tile = this.getPlayerTile();
    const tileLabel = tile ? `(${tile.x}, ${tile.y})` : "(n/a)";
    const hudKey = `${this.playerDisplayName}|${this.playerStats.hp}|${this.playerStats.maxHp}|${tileLabel}`;
    if (!force && hudKey === this.hudLastKey) {
      return;
    }

    this.hudLastKey = hudKey;
    this.hudOverlay.setData({
      context: "OVERWORLD",
      primary: `Unit: ${this.playerDisplayName}`,
      secondary: `HP: ${this.playerStats.hp}/${this.playerStats.maxHp}`,
      tertiary: `Tile: ${tileLabel}`,
    });
  }

  destroyHudOverlay() {
    this.hudOverlay?.destroy();
    this.hudOverlay = null;
    this.hudLastKey = "";
  }

  renderTerrain() {
    for (let y = 0; y < MAP_HEIGHT; y += 1) {
      for (let x = 0; x < MAP_WIDTH; x += 1) {
        const tileType = TILE_LAYOUT[y][x];
        const textureKey =
          tileType === 1 ? SHARED_TEXTURE_KEYS.OVERWORLD_TILE_WALL : SHARED_TEXTURE_KEYS.OVERWORLD_TILE_FLOOR;
        const tile = this.add.image(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          textureKey
        );

        this.terrainLayer.add(tile);
        this.cullableWorldObjects.push(tile);

        if (tileType === 1) {
          const tileKey = keyForTile(x, y);
          this.collisionTiles.add(tileKey);
          this.collisionTileCoords.push({ x, y });
        }
      }
    }
  }

  renderCollisionOverlay() {
    this.collisionTileCoords.forEach(({ x, y }) => {
      const marker = this.add.image(
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        SHARED_TEXTURE_KEYS.OVERWORLD_COLLISION_OVERLAY
      );
      this.collisionLayer.add(marker);
      this.cullableWorldObjects.push(marker);
    });
  }

  createCollisionBodies() {
    this.collisionBodies = this.physics.add.staticGroup();

    this.collisionTileCoords.forEach(({ x, y }) => {
      const blocker = this.add.zone(
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE - 2,
        TILE_SIZE - 2
      );
      this.physics.add.existing(blocker, true);
      this.collisionBodies.add(blocker);
    });
  }

  resolveSpawnTile(requestedSpawnPointId, overworldProgress) {
    if (typeof requestedSpawnPointId === "string" && OVERWORLD_SPAWN_BY_ID[requestedSpawnPointId]) {
      return OVERWORLD_SPAWN_BY_ID[requestedSpawnPointId];
    }

    const fallbackPosition = overworldProgress?.position;
    if (
      Number.isFinite(fallbackPosition?.x) &&
      Number.isFinite(fallbackPosition?.y) &&
      this.isWalkableTile(Math.floor(fallbackPosition.x), Math.floor(fallbackPosition.y))
    ) {
      return {
        x: Math.floor(fallbackPosition.x),
        y: Math.floor(fallbackPosition.y),
      };
    }

    const savedSpawnPointId = overworldProgress?.spawnPointId;
    if (typeof savedSpawnPointId === "string" && OVERWORLD_SPAWN_BY_ID[savedSpawnPointId]) {
      return OVERWORLD_SPAWN_BY_ID[savedSpawnPointId];
    }

    return OVERWORLD_SPAWN_BY_ID.default;
  }

  getProgressState() {
    const fromRegistry = this.game?.registry?.get("playerProgress");
    if (fromRegistry) {
      return normalizePlayerProgressState(fromRegistry);
    }

    return normalizePlayerProgressState(loadProgress());
  }

  commitProgress(updater) {
    const setPlayerProgress = this.game?.registry?.get("setPlayerProgress");
    const current = this.getProgressState();
    const next = typeof updater === "function" ? updater(current) : updater;
    const normalized = normalizePlayerProgressState(next);

    if (typeof setPlayerProgress === "function") {
      return setPlayerProgress(normalized);
    }

    this.game?.registry?.set?.("playerProgress", normalized);
    saveProgress(normalized);
    return normalized;
  }

  persistOverworldProgress(options = {}) {
    const tile = this.getPlayerTile();
    if (!tile) {
      return;
    }

    const tileKey = keyForTile(tile.x, tile.y);
    const force = options.force === true;
    const nextSceneKey =
      typeof options.currentSceneKey === "string" && options.currentSceneKey.trim()
        ? options.currentSceneKey.trim()
        : this.scene.key;
    const spawnPointId =
      typeof options.spawnPointId === "string" && options.spawnPointId.trim()
        ? options.spawnPointId.trim()
        : undefined;

    if (!force && tileKey === this.lastSavedTileKey) {
      return;
    }

    this.commitProgress((current) =>
      updateOverworldPosition(current, tile, {
        spawnPointId,
        currentSceneKey: nextSceneKey,
      })
    );
    this.lastSavedTileKey = tileKey;
  }

  createPlayerCharacter(spawnTile) {
    const playerStart = tileToWorld(spawnTile.x, spawnTile.y);
    this.player = this.physics.add.sprite(
      playerStart.x,
      playerStart.y,
      SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
      OVERWORLD_ACTOR_FRAMES.PLAYER_IDLE
    );
    this.player.setDepth(10);
    this.player.setSize(16, 18);
    this.player.setOffset(4, 12);
    this.player.body.setAllowGravity(false);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(PLAYER_SPEED, PLAYER_SPEED);
    this.player.anims.play("player-idle");

    this.physics.add.collider(this.player, this.collisionBodies);
    this.physics.add.collider(this.player, this.npcGroup);
    this.physics.add.collider(this.player, this.signGroup);
    this.characterLayer.add(this.player);
  }

  createNpcPlaceholders() {
    NPC_DEFINITIONS.forEach((npcConfig) => {
      const world = tileToWorld(npcConfig.tileX, npcConfig.tileY);
      const npc = this.npcGroup.create(
        world.x,
        world.y,
        SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
        npcConfig.textureFrame
      );
      npc.setDepth(9);
      npc.setDataEnabled();
      npc.setData("npcId", npcConfig.id);
      npc.setData("name", npcConfig.name);
      npc.setData("dialogue", this.resolveNpcDialogue(npcConfig));
      npc.refreshBody();
      this.characterLayer.add(npc);
      this.cullableWorldObjects.push(npc);
      this.npcEntities.push(npc);
      this.npcTileSet.add(keyForTile(npcConfig.tileX, npcConfig.tileY));
    });
  }

  resolveNpcDialogue(npcConfig) {
    const baseDialogue = npcConfig?.dialogue || `${npcConfig?.name ?? "NPC"}: Placeholder dialogue.`;
    const progress = this.progressSnapshot;

    if (
      npcConfig?.id === "npc-ranger" &&
      getBattleOutcomeFlag(progress, KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED)
    ) {
      return "Ranger Sol: Nice work in the training ambush. Head to Canyon Crossing when you're ready.";
    }

    if (
      npcConfig?.id === "npc-mechanic" &&
      getBattleOutcomeFlag(progress, KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED)
    ) {
      return "Mechanic Ivo: You cleared the canyon gauntlet. I can tune your gear next time you visit.";
    }

    return baseDialogue;
  }

  createLevelSigns() {
    LEVEL_SIGN_DEFINITIONS.forEach((signConfig) => {
      const world = tileToWorld(signConfig.tileX, signConfig.tileY);
      const sign = this.signGroup.create(
        world.x,
        world.y,
        SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
        signConfig.textureFrame
      );
      sign.setDepth(8);
      sign.setDataEnabled();
      sign.setData("signId", signConfig.id);
      sign.setData("label", signConfig.label);
      sign.setData("prompt", signConfig.prompt);
      sign.refreshBody();
      sign.body.setSize(32, 32);
      sign.body.setOffset(0, 0);
      this.characterLayer.add(sign);
      this.cullableWorldObjects.push(sign);
      this.levelSigns.push(sign);
      this.signTileSet.add(keyForTile(signConfig.tileX, signConfig.tileY));

      const signLabel = this.add
        .text(world.x, world.y - 28, signConfig.label, {
          color: "#f5f7ff",
          fontFamily: "monospace",
          fontSize: "12px",
          backgroundColor: "#111827bb",
          padding: { x: 4, y: 1 },
        })
        .setOrigin(0.5)
        .setDepth(12);
      this.characterLayer.add(signLabel);
      this.cullableWorldObjects.push(signLabel);
    });
  }

  setupInputManager() {
    this.teardownInputManager();
    this.inputManager = new InputManager(this, { tileSize: TILE_SIZE, autoCleanup: false });
    this.inputUnsubscribe = this.inputManager.onAction((event) => this.handleInputAction(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownInputManager());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownInputManager());
  }

  teardownInputManager() {
    if (this.inputUnsubscribe) {
      this.inputUnsubscribe();
      this.inputUnsubscribe = null;
    }
    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }
    this.pendingTileSelection = null;
  }

  handleInputAction(event) {
    if (!event || this.isTransitioning) {
      return;
    }

    if (event.action === InputActions.SELECT_TILE) {
      if (event.type !== "pressed" || !Number.isInteger(event.tileX) || !Number.isInteger(event.tileY)) {
        return;
      }
      this.pendingTileSelection = { tileX: event.tileX, tileY: event.tileY };
      return;
    }

    if (event.type !== "pressed") {
      return;
    }

    if (event.action === InputActions.CONFIRM) {
      this.handleConfirmAction();
      return;
    }

    if (event.action === InputActions.CANCEL) {
      if (this.dialogueBox?.visible) {
        this.hideDialogue();
      }
      this.clearPointerPath();
    }
  }

  processPendingTileSelection() {
    if (!this.pendingTileSelection || this.isTransitioning) {
      return;
    }

    const event = this.pendingTileSelection;
    this.pendingTileSelection = null;
    this.handleSelectTileAction(event);
  }

  handleSelectTileAction(event) {
    if (!this.player || this.isTransitioning) {
      return;
    }

    if (!Number.isInteger(event.tileX) || !Number.isInteger(event.tileY)) {
      return;
    }

    const targetTile = { x: event.tileX, y: event.tileY };
    if (this.handleTileInteractionSelection(targetTile)) {
      return;
    }

    if (this.dialogueBox?.visible) {
      return;
    }

    if (!this.isWalkableTile(targetTile.x, targetTile.y)) {
      this.clearPointerPath();
      return;
    }

    const startTile = this.getPlayerTile();
    if (!startTile) {
      return;
    }

    const tilePath = this.findTilePath(startTile, targetTile);
    if (!tilePath || tilePath.length === 0) {
      this.clearPointerPath();
      return;
    }

    this.pointerPathTiles = tilePath;
    this.pointerPath = tilePath.map((tile) => tileToWorld(tile.x, tile.y));
    this.pointerPathIndex = 0;
  }

  handleTileInteractionSelection(targetTile) {
    const sign = this.findSignAtTile(targetTile.x, targetTile.y);
    if (sign) {
      return this.tryInteractWithSign(sign);
    }

    const npc = this.findNpcAtTile(targetTile.x, targetTile.y);
    if (npc) {
      return this.tryInteractWithNpc(npc);
    }

    return false;
  }

  handleConfirmAction() {
    if (this.dialogueBox?.visible) {
      if (this.activeDialogueSignId && this.awaitingSignEnterChoice) {
        this.confirmLevelSignSelection();
        return;
      }
      this.hideDialogue();
      return;
    }

    const nearbySign = this.findNearbySign();
    if (nearbySign) {
      this.showLevelSignPrompt(nearbySign);
      return;
    }

    const nearbyNpc = this.findNearbyNpc();
    if (!nearbyNpc) {
      return;
    }

    this.showDialogue(nearbyNpc);
  }

  clearPointerPath() {
    this.pointerPath = [];
    this.pointerPathTiles = [];
    this.pointerPathIndex = 0;
  }

  getPlayerTile() {
    if (!this.player) {
      return null;
    }
    return worldToTile(this.player.x, this.player.y);
  }

  isInBounds(tileX, tileY) {
    return tileX >= 0 && tileY >= 0 && tileX < MAP_WIDTH && tileY < MAP_HEIGHT;
  }

  isWalkableTile(tileX, tileY) {
    if (!this.isInBounds(tileX, tileY)) {
      return false;
    }
    if (this.collisionTiles.has(keyForTile(tileX, tileY))) {
      return false;
    }
    if (this.npcTileSet.has(keyForTile(tileX, tileY))) {
      return false;
    }
    if (this.signTileSet.has(keyForTile(tileX, tileY))) {
      return false;
    }
    return true;
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

  findTilePath(startTile, targetTile) {
    if (!startTile || !targetTile) {
      return [];
    }
    if (startTile.x === targetTile.x && startTile.y === targetTile.y) {
      return [];
    }

    const queue = [{ x: startTile.x, y: startTile.y }];
    const visited = new Set([keyForTile(startTile.x, startTile.y)]);
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
        const neighborKey = keyForTile(neighbor.x, neighbor.y);
        if (visited.has(neighborKey) || !this.isWalkableTile(neighbor.x, neighbor.y)) {
          return;
        }

        visited.add(neighborKey);
        parentMap.set(neighborKey, current);
        queue.push(neighbor);
      });
    }

    const targetKey = keyForTile(targetTile.x, targetTile.y);
    if (!parentMap.has(targetKey)) {
      return [];
    }

    const path = [];
    let currentTile = { x: targetTile.x, y: targetTile.y };

    while (!(currentTile.x === startTile.x && currentTile.y === startTile.y)) {
      path.push(currentTile);
      const previous = parentMap.get(keyForTile(currentTile.x, currentTile.y));
      if (!previous) {
        return [];
      }
      currentTile = previous;
    }

    path.reverse();
    return path;
  }

  createDialogueUi() {
    this.dialogueBox = this.add
      .rectangle(400, 540, 760, 96, 0x111827, 0.9)
      .setStrokeStyle(2, 0x7ea8ff, 1)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setVisible(false);

    this.dialogueText = this.add
      .text(32, 508, "", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "15px",
        wordWrap: { width: 730, useAdvancedWrap: true },
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setVisible(false);

    this.dialogueHintText = this.add
      .text(32, 568, "Press Space or Enter to close", {
        color: "#c5d9ff",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH)
      .setVisible(false);
  }

  findNearbyNpc() {
    if (!this.player || this.npcEntities.length === 0) {
      return null;
    }

    let closestNpc = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    this.npcEntities.forEach((npc) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (distance <= INTERACTION_DISTANCE && distance < closestDistance) {
        closestDistance = distance;
        closestNpc = npc;
      }
    });

    return closestNpc;
  }

  findNearbySign() {
    if (!this.player || this.levelSigns.length === 0) {
      return null;
    }

    let closestSign = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    this.levelSigns.forEach((sign) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sign.x, sign.y);
      if (distance <= SIGN_INTERACTION_DISTANCE && distance < closestDistance) {
        closestDistance = distance;
        closestSign = sign;
      }
    });

    return closestSign;
  }

  findSignAtTile(tileX, tileY) {
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return null;
    }

    return (
      this.levelSigns.find((sign) => {
        const signTile = worldToTile(sign.x, sign.y);
        return signTile.x === tileX && signTile.y === tileY;
      }) ?? null
    );
  }

  findNpcAtTile(tileX, tileY) {
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return null;
    }

    return (
      this.npcEntities.find((npc) => {
        const npcTile = worldToTile(npc.x, npc.y);
        return npcTile.x === tileX && npcTile.y === tileY;
      }) ?? null
    );
  }

  tryInteractWithSign(sign) {
    if (!this.player || !sign) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sign.x, sign.y);
    if (distance > SIGN_INTERACTION_DISTANCE) {
      return false;
    }

    if (
      this.dialogueBox?.visible &&
      this.awaitingSignEnterChoice &&
      this.activeDialogueSignId === sign.getData("signId")
    ) {
      this.transitionToLevel(sign);
      return true;
    }

    this.clearPointerPath();
    this.showLevelSignPrompt(sign);
    return true;
  }

  tryInteractWithNpc(npc) {
    if (!this.player || !npc) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
    if (distance > INTERACTION_DISTANCE) {
      return false;
    }

    this.clearPointerPath();
    this.showDialogue(npc);
    return true;
  }

  showDialogue(npc) {
    const npcName = npc.getData("name") || "NPC";
    const npcDialogue = npc.getData("dialogue") || `${npcName}: Placeholder dialogue.`;
    this.activeDialogueNpcId = npc.getData("npcId") || null;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.dialogueText.setText(npcDialogue);
    this.dialogueHintText.setText("Press Space or Enter to close");
    this.dialogueBox.setVisible(true);
    this.dialogueText.setVisible(true);
    this.dialogueHintText.setVisible(true);
  }

  showLevelSignPrompt(sign) {
    const signLabel = sign.getData("label") || "Unknown Level";
    const signPrompt = sign.getData("prompt") || signLabel;
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = sign.getData("signId") || null;
    this.awaitingSignEnterChoice = true;
    this.dialogueText.setText(
      `${signPrompt}\nPress Enter to travel to ${signLabel}. Tap/click the sign tile again to confirm. Space closes.`
    );
    this.dialogueHintText.setText("Enter or sign-tile tap: travel  Space: close");
    this.dialogueBox.setVisible(true);
    this.dialogueText.setVisible(true);
    this.dialogueHintText.setVisible(true);
  }

  transitionToLevel(sign) {
    if (!sign || this.isTransitioning) {
      return;
    }

    const signId = sign.getData("signId");
    const sceneKey = LEVEL_SCENE_BY_SIGN_ID[signId];
    if (!sceneKey) {
      this.dialogueText.setText("This sign is not mapped to a playable level yet.");
      this.dialogueHintText.setText("Press Space or Enter to close");
      this.awaitingSignEnterChoice = false;
      return;
    }

    this.isTransitioning = true;
    this.clearPointerPath();
    this.hideDialogue();
    this.persistOverworldProgress({
      force: true,
      currentSceneKey: sceneKey,
    });
    this.cameras.main.fadeOut(160, 0, 0, 0);
    this.time.delayedCall(170, () => {
      this.scene.start(sceneKey);
    });
  }

  confirmLevelSignSelection() {
    const sign = this.levelSigns.find(
      (entity) => entity.getData("signId") === this.activeDialogueSignId
    );
    this.transitionToLevel(sign);
  }

  hideDialogue() {
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.dialogueBox.setVisible(false);
    this.dialogueText.setVisible(false);
    this.dialogueHintText.setVisible(false);
  }

  getMovementVector() {
    const movement = this.reusableMovementVector;
    movement.x = 0;
    movement.y = 0;

    if (!this.inputManager) {
      return movement;
    }

    const leftPressed = this.inputManager.isActionActive(InputActions.MOVE_LEFT);
    const rightPressed = this.inputManager.isActionActive(InputActions.MOVE_RIGHT);
    const upPressed = this.inputManager.isActionActive(InputActions.MOVE_UP);
    const downPressed = this.inputManager.isActionActive(InputActions.MOVE_DOWN);

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

  moveAlongPointerPath() {
    if (!this.player?.body || this.pointerPathIndex >= this.pointerPath.length) {
      return false;
    }

    const nextWaypoint = this.pointerPath[this.pointerPathIndex];
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      nextWaypoint.x,
      nextWaypoint.y
    );

    if (distance <= ARRIVAL_THRESHOLD) {
      this.player.setPosition(nextWaypoint.x, nextWaypoint.y);
      this.pointerPathIndex += 1;
      if (this.pointerPathIndex >= this.pointerPath.length) {
        this.player.body.setVelocity(0, 0);
        this.player.anims.play("player-idle", true);
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

    if (Math.abs(direction.x) > 1) {
      this.player.setFlipX(direction.x < 0);
    }
    this.player.anims.play("player-walk", true);
    return true;
  }

  update() {
    if (!this.player || !this.player.body || this.isTransitioning) {
      return;
    }
    this.updateCulledObjectVisibility();
    this.processPendingTileSelection();

    if (this.dialogueBox.visible) {
      this.clearPointerPath();
      this.player.body.setVelocity(0, 0);
      this.player.anims.play("player-idle", true);
      this.syncHudOverlay();
      this.persistOverworldProgress();
      return;
    }

    const movement = this.getMovementVector();
    if (movement.x !== 0 || movement.y !== 0) {
      this.clearPointerPath();
      this.player.body.setVelocity(movement.x * PLAYER_SPEED, movement.y * PLAYER_SPEED);

      if (movement.x !== 0) {
        this.player.setFlipX(movement.x < 0);
      }

      this.player.anims.play("player-walk", true);
      this.syncHudOverlay();
      this.persistOverworldProgress();
      return;
    }

    if (this.moveAlongPointerPath()) {
      this.syncHudOverlay();
      this.persistOverworldProgress();
      return;
    }

    this.player.body.setVelocity(0, 0);
    this.player.anims.play("player-idle", true);
    this.syncHudOverlay();
    this.persistOverworldProgress();
  }
}

export default OverworldScene;
