import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import InputManager, { InputActions } from "../input/InputManager.js";
import HUDOverlay from "../ui/HUDOverlay.js";
import DialogueOverlay from "../ui/DialogueOverlay.js";
import {
  getBattleOutcomeFlag,
  KEY_BATTLE_OUTCOME_FLAGS,
  normalizePlayerProgressState,
  updateOverworldPosition,
} from "../state/playerProgress.js";
import {
  addInventoryItem,
  exportGameStateToPlayerProgress,
  getGameState,
  getInventoryCount,
  getPartyMember,
  getStoryFlag,
  hasStoryFlag,
  setStoryFlags,
} from "../state/gameState.js";
import { loadProgress, saveProgress } from "../persistence/saveSystem.js";
import { logDebugStateSnapshot, resolveResumeTarget } from "../persistence/runtimeStateTools.js";
import { DialogueController, DialogueEvents, DialogueFlagStore } from "../systems/dialogue/index.js";
import {
  OVERWORLD_DIALOGUE_FLAGS,
  OVERWORLD_INTERACTABLE_DEFINITIONS,
  OVERWORLD_NPC_DEFINITIONS,
  OVERWORLD_NPC_DIALOGUE_TREES,
} from "../data/overworldInteractionConfig.js";

const TILE_SIZE = 48;
const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const PLAYER_SPEED = 180;
const MAP_PIXEL_WIDTH = MAP_WIDTH * TILE_SIZE;
const MAP_PIXEL_HEIGHT = MAP_HEIGHT * TILE_SIZE;
const INTERACTION_DISTANCE = TILE_SIZE * 1.5;
const UI_DEPTH = 40;
const ARRIVAL_THRESHOLD = 4;
const SIGN_INTERACTION_DISTANCE = TILE_SIZE;

const PLAYER_TEXTURES = {
  idle: "player-idle",
  walkA: "player-walk-a",
  walkB: "player-walk-b",
};

const LEVEL_SIGN_DEFINITIONS = [
  {
    id: "sign-level-1",
    label: "Level 1",
    texture: "sign-level-1",
    tileX: 4,
    tileY: 9,
    prompt: "Level 1: Training Grounds",
  },
  {
    id: "sign-level-2",
    label: "Level 2",
    texture: "sign-level-2",
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
const OVERWORLD_BATTLE_ENCOUNTER_ID = "overworld-first-drone";
const OVERWORLD_BATTLE_ZONE = Object.freeze({
  id: "first-drone-zone",
  tileX: 9,
  tileY: 4,
  label: "Drone Patrol Zone",
});

const TILE_LAYOUT = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
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
    this.interactableGroup = null;
    this.npcEntities = [];
    this.levelSigns = [];
    this.interactableEntities = [];
    this.dialogueOverlay = null;
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.activeDialogueChoices = [];
    this.activeDialogueChoiceIndex = 0;
    this.dialogueController = null;
    this.dialogueFlagStore = null;
    this.dialogueUnsubscribeFns = [];
    this.pointerPath = [];
    this.pointerPathTiles = [];
    this.npcTileSet = new Set();
    this.signTileSet = new Set();
    this.blockingInteractableTileSet = new Set();
    this.isTransitioning = false;
    this.hudOverlay = null;
    this.hudLastKey = "";
    this.playerDisplayName = "Pathfinder";
    this.playerStats = { hp: 100, maxHp: 100 };
    this.lastSavedTileKey = "";
    this.progressSnapshot = normalizePlayerProgressState();
    this.stateDebugText = null;
    this.stateDebugLastKey = "";
    this.overworldBattleZoneMarker = null;
    this.overworldBattleZoneLabel = null;
    this.overworldBattleZoneTriggered = false;
    this.devShortcutListeners = [];
    this.stateDebugVisible = true;
    this.audioManager = null;
  }

  create(data) {
    this.audioManager = this.game.registry.get("audioManager") ?? null;
    this.audioManager?.playMusic("music-overworld", { loop: true });

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
    this.interactableGroup = this.physics.add.staticGroup();
    this.initializeDialogueSystem(progress);

    this.renderTerrain();
    this.renderCollisionOverlay();
    this.createCollisionBodies();
    const spawnTile = this.resolveSpawnTile(requestedSpawnPointId, progress?.overworld);
    this.createPlayerCharacter(spawnTile);
    this.createNpcPlaceholders();
    this.createQuestInteractables();
    this.createOverworldBattleZone();
    this.createLevelSigns();
    this.setupInputManager();
    this.setupDevShortcuts();
    this.createDialogueOverlay();
    this.createHudOverlay(data);
    this.createStateDebugOverlay();

    this.add
      .text(16, 16, "Overworld Prototype", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "16px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.add
      .text(16, 40, "Move: Arrows/WASD/Mouse  Interact: Space/Enter  F6: Save  F9: Load  I: Inspect  F3: Debug UI", {
        color: "#d7e0ef",
        fontFamily: "monospace",
        fontSize: "13px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.persistOverworldProgress({
      force: true,
      spawnPointId: requestedSpawnPointId,
      currentSceneKey: this.scene.key,
    });
    if (
      data?.lastEncounterId === OVERWORLD_BATTLE_ENCOUNTER_ID &&
      (data?.battleResult === "victory" || data?.battleResult === "defeat")
    ) {
      const line =
        data.battleResult === "victory"
          ? "Perimeter cleared. The canyon route is now authorized."
          : "Drone patrol held the line. Recover and retry the patrol zone.";
      this.dialogueOverlay?.renderSystemMessage(line, {
        speakerName: "Battle Report",
        hintText: "Press Space, Enter, or Esc to close",
      });
    }
    this.syncStateDebugOverlay(true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyDialogueSystem());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyDialogueSystem());
  }

  createHudOverlay(data = {}) {
    const protagonist = getPartyMember("protagonist");
    const configuredName = typeof data.playerName === "string" ? data.playerName.trim() : "";
    if (configuredName) {
      this.playerDisplayName = configuredName;
    } else if (protagonist?.name) {
      this.playerDisplayName = protagonist.name;
    }

    const hp = Number.isFinite(data.playerHp)
      ? data.playerHp
      : protagonist?.currentHp ?? this.playerStats.hp;
    const maxHp = Number.isFinite(data.playerMaxHp)
      ? data.playerMaxHp
      : protagonist?.maxHp ?? this.playerStats.maxHp;
    this.playerStats.maxHp = Math.max(1, Math.floor(maxHp));
    this.playerStats.hp = Phaser.Math.Clamp(Math.floor(hp), 0, this.playerStats.maxHp);

    this.hudOverlay = new HUDOverlay(this, { x: 790, y: 12, width: 250, depth: UI_DEPTH + 20 });
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

  createStateDebugOverlay() {
    this.stateDebugText = this.add
      .text(16, 62, "", {
        color: "#b8f2d6",
        fontFamily: "monospace",
        fontSize: "12px",
        backgroundColor: "#0f1820d1",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH + 2);
    this.stateDebugText.setVisible(this.stateDebugVisible);
    this.syncStateDebugOverlay(true);
  }

  syncStateDebugOverlay(force = false) {
    if (!this.stateDebugText) {
      return;
    }
    if (!this.stateDebugVisible) {
      this.stateDebugText.setVisible(false);
      return;
    }

    const snapshot = getGameState();
    const protagonist = snapshot.party.members.find((member) => member.id === "protagonist") ?? null;
    const partySummary = snapshot.party.members
      .map((member) => `${member.id}:${member.currentHp}/${member.maxHp}`)
      .join(", ");
    const inventoryEntries = Object.entries(snapshot.inventory.items)
      .slice(0, 6)
      .map(([itemId, count]) => `${itemId}x${count}`);
    const inventorySummary = inventoryEntries.length > 0 ? inventoryEntries.join(", ") : "empty";
    const gateUnlocked = hasStoryFlag(OVERWORLD_DIALOGUE_FLAGS.WORKSHOP_GATE_UNLOCKED) ? "ON" : "OFF";
    const checkpointUnlocked = hasStoryFlag(OVERWORLD_DIALOGUE_FLAGS.CANYON_CHECKPOINT_UNLOCKED) ? "ON" : "OFF";
    const firstDroneDefeated = hasStoryFlag(KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED) ? "ON" : "OFF";
    const workshopPassCount = getInventoryCount("workshop-pass");
    const debugLines = [
      `State Party:${snapshot.party.members.length} Protagonist:${protagonist?.currentHp ?? "?"}/${protagonist?.maxHp ?? "?"}`,
      `Party Members ${partySummary || "none"}`,
      `Inventory ${inventorySummary}`,
      `Flags Drone:${firstDroneDefeated} Gate:${gateUnlocked} Checkpoint:${checkpointUnlocked}`,
      `Workshop Pass:${workshopPassCount} | I console dump | F6 save | F9 load | F3 toggle`,
    ];
    const debugValue = debugLines.join("\n");

    if (!force && debugValue === this.stateDebugLastKey) {
      return;
    }

    this.stateDebugLastKey = debugValue;
    this.stateDebugText.setVisible(true);
    this.stateDebugText.setText(debugValue);
  }

  setupDevShortcuts() {
    const keyboard = this.input?.keyboard;
    if (!keyboard) {
      return;
    }

    const onSave = (event) => {
      event?.preventDefault?.();
      const saveGame = this.game.registry.get("saveGame");
      const saved = typeof saveGame === "function" ? saveGame({ currentSceneKey: this.scene.key }) : null;
      console.log("[OverworldScene] Save complete.", {
        scene: saved?.overworld?.currentSceneKey,
        partySize: saved?.party?.members?.length ?? 0,
      });
      this.syncStateDebugOverlay(true);
    };

    const onLoad = (event) => {
      event?.preventDefault?.();
      const loadGame = this.game.registry.get("loadGame");
      const loaded = typeof loadGame === "function" ? loadGame() : this.getProgressState();
      const { resumeSceneKey, resumeData } = resolveResumeTarget(loaded, this.scene.key);
      console.log("[OverworldScene] Loaded save.", {
        resumeSceneKey,
        spawnPointId: resumeData?.spawnPointId ?? null,
      });
      this.isTransitioning = true;
      this.scene.start(resumeSceneKey, resumeData);
    };

    const onInspect = () => {
      const debugState = this.game.registry.get("debugGameState");
      const snapshot = typeof debugState === "function" ? debugState() : logDebugStateSnapshot();
      console.log("[OverworldScene] Debug snapshot", snapshot);
      this.syncStateDebugOverlay(true);
    };

    const onToggleDebug = (event) => {
      event?.preventDefault?.();
      this.stateDebugVisible = !this.stateDebugVisible;
      this.syncStateDebugOverlay(true);
    };

    keyboard.on("keydown-F6", onSave);
    keyboard.on("keydown-F9", onLoad);
    keyboard.on("keydown-I", onInspect);
    keyboard.on("keydown-F3", onToggleDebug);

    this.devShortcutListeners = [
      { event: "keydown-F6", handler: onSave },
      { event: "keydown-F9", handler: onLoad },
      { event: "keydown-I", handler: onInspect },
      { event: "keydown-F3", handler: onToggleDebug },
    ];

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownDevShortcuts());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownDevShortcuts());
  }

  teardownDevShortcuts() {
    if (!this.devShortcutListeners.length) {
      return;
    }

    const keyboard = this.input?.keyboard;
    if (keyboard) {
      this.devShortcutListeners.forEach(({ event, handler }) => {
        keyboard.off(event, handler);
      });
    }
    this.devShortcutListeners = [];
  }

  persistGameStateSnapshot() {
    this.commitProgress((current) => exportGameStateToPlayerProgress(current));
    this.syncDialogueFlagsFromGameState();
    this.syncStateDebugOverlay(true);
  }

  syncDialogueFlagsFromGameState() {
    if (!this.dialogueFlagStore) {
      return;
    }

    const mergedFlags = {
      [KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED]: hasStoryFlag(
        KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED
      ),
      [KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED]: hasStoryFlag(
        KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED
      ),
      [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED]: hasStoryFlag(
        KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED
      ),
    };

    Object.values(OVERWORLD_DIALOGUE_FLAGS).forEach((flagKey) => {
      mergedFlags[flagKey] = hasStoryFlag(flagKey);
    });
    this.dialogueFlagStore.setFlags(mergedFlags);
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

  createNpcTexture(textureKey, bodyColor, accentColor) {
    if (this.textures.exists(textureKey)) {
      return;
    }

    const frame = this.make.graphics({ x: 0, y: 0, add: false });
    frame.fillStyle(0x1f1f2b, 1);
    frame.fillRoundedRect(6, 0, 12, 10, 3);
    frame.fillStyle(bodyColor, 1);
    frame.fillRoundedRect(4, 10, 16, 16, 4);
    frame.fillStyle(accentColor, 1);
    frame.fillRect(6, 14, 12, 3);
    frame.fillStyle(0x111111, 1);
    frame.fillRect(6, 28, 5, 3);
    frame.fillRect(13, 28, 5, 3);
    frame.generateTexture(textureKey, 24, 32);
    frame.destroy();
  }

  createSignTexture(textureKey, postColor, boardColor) {
    if (this.textures.exists(textureKey)) {
      return;
    }

    const frame = this.make.graphics({ x: 0, y: 0, add: false });
    frame.fillStyle(postColor, 1);
    frame.fillRect(10, 14, 4, 14);
    frame.fillStyle(boardColor, 1);
    frame.fillRoundedRect(2, 2, 20, 14, 3);
    frame.fillStyle(0x1a1a1a, 0.25);
    frame.fillRect(4, 6, 16, 2);
    frame.fillRect(4, 10, 16, 2);
    frame.generateTexture(textureKey, 24, 32);
    frame.destroy();
  }

  createInteractableTexture(textureKey, colors = {}) {
    if (this.textures.exists(textureKey)) {
      return;
    }

    const frameColor = Number.isFinite(colors.frame) ? colors.frame : 0x263244;
    const fillColor = Number.isFinite(colors.lockedFill) ? colors.lockedFill : 0xb24a4a;

    const frame = this.make.graphics({ x: 0, y: 0, add: false });
    frame.fillStyle(frameColor, 1);
    frame.fillRoundedRect(1, 2, 22, 28, 2);
    frame.fillStyle(fillColor, 1);
    frame.fillRect(4, 6, 16, 20);
    frame.fillStyle(0x000000, 0.25);
    frame.fillRect(6, 10, 12, 2);
    frame.fillRect(6, 14, 12, 2);
    frame.generateTexture(textureKey, 24, 32);
    frame.destroy();
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

  initializeDialogueSystem(progressState) {
    const initialQuestFlags = Object.values(OVERWORLD_DIALOGUE_FLAGS).reduce((acc, flagKey) => {
      acc[flagKey] = getStoryFlag(flagKey, false) === true;
      return acc;
    }, {});

    const initialFlags = {
      [KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED]: getBattleOutcomeFlag(
        progressState,
        KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED
      ),
      [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED]: getBattleOutcomeFlag(
        progressState,
        KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED
      ),
      ...initialQuestFlags,
    };

    this.dialogueFlagStore = new DialogueFlagStore(initialFlags);
    this.dialogueController = new DialogueController({
      flagStore: this.dialogueFlagStore,
      callbackMap: {
        onMechanicIntroComplete: () => {
          this.events.emit("dialogue:mechanic-intro-complete", {
            npcId: "npc-mechanic",
            flag: OVERWORLD_DIALOGUE_FLAGS.MECHANIC_INTRO_COMPLETE,
          });
        },
        onWorkshopGateUnlocked: () => {
          this.syncInteractablesFromFlags();
        },
      },
    });

    this.dialogueUnsubscribeFns = [
      this.dialogueController.on(DialogueEvents.NODE_CHANGED, (snapshot) =>
        this.renderNpcDialogueSnapshot(snapshot)
      ),
      this.dialogueController.on(DialogueEvents.HOOK_TRIGGERED, (payload) => {
        this.persistDialogueFlagsToProgress(payload.flags);
        this.syncInteractablesFromFlags();
        this.events.emit("dialogue:quest-hook", payload);
      }),
      this.dialogueController.on("quest:ranger-task-issued", (payload) => {
        this.events.emit("dialogue:ranger-task-issued", payload);
      }),
      this.dialogueController.on(DialogueEvents.ENDED, () => {
        if (this.activeDialogueNpcId) {
          this.hideDialogue({ keepSignPrompt: false, endNpcConversation: false });
        }
      }),
    ];
    this.syncDialogueFlagsFromGameState();
  }

  destroyDialogueSystem() {
    this.dialogueUnsubscribeFns.forEach((unsubscribe) => unsubscribe?.());
    this.dialogueUnsubscribeFns = [];
    this.dialogueController = null;
    this.dialogueFlagStore = null;
    this.activeDialogueChoices = [];
    this.activeDialogueChoiceIndex = 0;
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

  persistDialogueFlagsToProgress(flagSnapshot = {}) {
    const candidateFlags = Object.values(OVERWORLD_DIALOGUE_FLAGS).reduce((acc, flagKey) => {
      if (flagSnapshot[flagKey] === true) {
        acc[flagKey] = true;
      }
      return acc;
    }, {});

    if (Object.keys(candidateFlags).length === 0) {
      return;
    }

    setStoryFlags(candidateFlags);
    this.persistGameStateSnapshot();
  }

  syncInteractablesFromFlags() {
    this.interactableEntities.forEach((entity) => {
      this.applyInteractableFlagState(entity);
    });
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
    this.createPlayerTextures();
    this.createPlayerAnimations();

    const playerStart = tileToWorld(spawnTile.x, spawnTile.y);
    this.player = this.physics.add.sprite(playerStart.x, playerStart.y, PLAYER_TEXTURES.idle);
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
    this.physics.add.collider(this.player, this.interactableGroup);
    this.characterLayer.add(this.player);
  }

  createNpcPlaceholders() {
    OVERWORLD_NPC_DEFINITIONS.forEach((npcConfig) => {
      this.createNpcTexture(npcConfig.texture, npcConfig.bodyColor, npcConfig.accentColor);
      const world = tileToWorld(npcConfig.tileX, npcConfig.tileY);
      const npc = this.npcGroup.create(world.x, world.y, npcConfig.texture);
      npc.setDepth(9);
      npc.setDataEnabled();
      npc.setData("npcId", npcConfig.id);
      npc.setData("name", npcConfig.name);
      npc.setData("dialogueTree", OVERWORLD_NPC_DIALOGUE_TREES[npcConfig.id] ?? null);
      npc.setData("dialogueEntryPoint", npcConfig.dialogueEntryPoint ?? null);
      npc.setData("questMetadata", npcConfig.questMetadata ?? null);
      npc.refreshBody();
      this.characterLayer.add(npc);
      this.npcEntities.push(npc);
      this.npcTileSet.add(keyForTile(npcConfig.tileX, npcConfig.tileY));
    });
  }

  createQuestInteractables() {
    OVERWORLD_INTERACTABLE_DEFINITIONS.forEach((config) => {
      this.createInteractableTexture(config.texture, config.colors);
      const world = tileToWorld(config.tileX, config.tileY);
      const entity = this.interactableGroup.create(world.x, world.y, config.texture);
      entity.setDepth(8);
      entity.setDataEnabled();
      entity.setData("objectId", config.id);
      entity.setData("type", config.type ?? "object");
      entity.setData("label", config.label ?? "Object");
      entity.setData("tileX", config.tileX);
      entity.setData("tileY", config.tileY);
      entity.setData("unlockFlag", config.unlockFlag ?? null);
      entity.setData("unlockItemId", config.unlockItemId ?? null);
      entity.setData("unlockItemCount", config.unlockItemCount ?? 1);
      entity.setData("collectedFlag", config.collectedFlag ?? null);
      entity.setData("inventoryRewardItemId", config.inventoryReward?.itemId ?? null);
      entity.setData("inventoryRewardAmount", config.inventoryReward?.amount ?? 1);
      entity.setData("grantsStoryFlags", config.grantsStoryFlags ?? null);
      entity.setData("promptLocked", config.promptLocked ?? "It does not move.");
      entity.setData("promptUnlocked", config.promptUnlocked ?? "It is already unlocked.");
      entity.setData("lockedColor", config.colors?.lockedFill ?? 0xb24a4a);
      entity.setData("unlockedColor", config.colors?.unlockedFill ?? 0x4a9f63);
      entity.refreshBody();
      this.characterLayer.add(entity);
      this.interactableEntities.push(entity);
      this.applyInteractableFlagState(entity);
    });
  }

  applyInteractableFlagState(entity) {
    const tileX = entity.getData("tileX");
    const tileY = entity.getData("tileY");
    const unlockFlag = entity.getData("unlockFlag");
    const unlockItemId = entity.getData("unlockItemId");
    const unlockItemCount = Math.max(1, Number(entity.getData("unlockItemCount")) || 1);
    const collectedFlag = entity.getData("collectedFlag");
    const type = entity.getData("type");
    const unlockedByFlag = unlockFlag ? hasStoryFlag(unlockFlag) : false;
    const unlockedByItem = unlockItemId ? getInventoryCount(unlockItemId) >= unlockItemCount : false;
    const isCollected = collectedFlag ? hasStoryFlag(collectedFlag) : false;
    const isUnlocked = unlockedByFlag || unlockedByItem || (type === "pickup" && isCollected);
    const tileKey = keyForTile(tileX, tileY);
    const isPickup = type === "pickup";

    entity.setData("isUnlocked", isUnlocked);
    if (isUnlocked) {
      entity.setTint(entity.getData("unlockedColor"));
      this.blockingInteractableTileSet.delete(tileKey);
      if (entity.body) {
        entity.body.enable = false;
      }
    } else {
      entity.setTint(entity.getData("lockedColor"));
      if (isPickup) {
        this.blockingInteractableTileSet.delete(tileKey);
        if (entity.body) {
          entity.body.enable = false;
        }
      } else {
        this.blockingInteractableTileSet.add(tileKey);
        if (entity.body) {
          entity.body.enable = true;
        }
      }
    }
  }

  createLevelSigns() {
    LEVEL_SIGN_DEFINITIONS.forEach((signConfig, index) => {
      const boardColors = [
        { post: 0x7c5a3a, board: 0xffe6a8 },
        { post: 0x4b658f, board: 0xbee3ff },
      ];
      const colorSet = boardColors[index % boardColors.length];
      this.createSignTexture(signConfig.texture, colorSet.post, colorSet.board);

      const world = tileToWorld(signConfig.tileX, signConfig.tileY);
      const sign = this.signGroup.create(world.x, world.y, signConfig.texture);
      sign.setDepth(8);
      sign.setDataEnabled();
      sign.setData("signId", signConfig.id);
      sign.setData("label", signConfig.label);
      sign.setData("prompt", signConfig.prompt);
      sign.setData("lockedPrompt", "Route locked: clear the perimeter drone patrol first.");
      sign.refreshBody();
      sign.body.setSize(32, 32);
      sign.body.setOffset(0, 0);
      const isLockedLevel2 =
        signConfig.id === "sign-level-2" &&
        !hasStoryFlag(KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED);
      sign.setTint(isLockedLevel2 ? 0x8e5f5f : 0xffffff);
      this.characterLayer.add(sign);
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
    });
  }

  setupInputManager() {
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
  }

  handleInputAction(event) {
    if (!event || this.isTransitioning) {
      return;
    }

    if (event.action === InputActions.SELECT_TILE) {
      this.handleSelectTileAction(event);
      return;
    }

    if (event.type !== "pressed") {
      return;
    }

    if (event.action === InputActions.CONFIRM) {
      this.handleConfirmAction();
      return;
    }

    if (event.action === InputActions.MOVE_UP) {
      this.handleDialogueChoiceNavigation(-1);
      return;
    }

    if (event.action === InputActions.MOVE_DOWN) {
      this.handleDialogueChoiceNavigation(1);
      return;
    }

    if (event.action === InputActions.CANCEL) {
      if (this.isDialogueVisible()) {
        this.handleCancelAction();
      }
      this.clearPointerPath();
    }
  }

  handleSelectTileAction(event) {
    if (!this.player || this.isTransitioning) {
      return;
    }

    if (!Number.isInteger(event.tileX) || !Number.isInteger(event.tileY)) {
      return;
    }

    const targetTile = { x: event.tileX, y: event.tileY };
    if (this.isDialogueVisible()) {
      if (this.handleDialoguePointerSelection(targetTile)) {
        return;
      }
      const hasActiveConversation = Boolean(this.activeDialogueNpcId);
      const hasActiveSignPrompt = Boolean(this.activeDialogueSignId && this.awaitingSignEnterChoice);
      if (hasActiveConversation || hasActiveSignPrompt) {
        return;
      }
      this.hideDialogue({ keepSignPrompt: false, endNpcConversation: false });
      this.syncHudOverlay(true);
    }

    if (this.handleTileInteractionSelection(targetTile)) {
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
  }

  handleTileInteractionSelection(targetTile) {
    const interactable = this.findInteractableAtTile(targetTile.x, targetTile.y);
    if (interactable) {
      return this.tryInteractWithInteractable(interactable);
    }

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
    if (this.isDialogueVisible()) {
      if (this.activeDialogueSignId && this.awaitingSignEnterChoice) {
        this.confirmLevelSignSelection();
        return;
      }

      if (this.activeDialogueNpcId) {
        this.confirmNpcDialogueStep();
        return;
      }

      this.hideDialogue({ keepSignPrompt: false });
      return;
    }

    const nearbySign = this.findNearbySign();
    if (nearbySign) {
      this.showLevelSignPrompt(nearbySign);
      return;
    }

    const nearbyNpc = this.findNearbyNpc();
    if (nearbyNpc) {
      this.startNpcDialogueConversation(nearbyNpc);
      return;
    }

    const nearbyInteractable = this.findNearbyInteractable();
    if (!nearbyInteractable) {
      return;
    }

    this.tryInteractWithInteractable(nearbyInteractable);
  }

  handleCancelAction() {
    if (this.activeDialogueSignId && this.awaitingSignEnterChoice) {
      this.hideDialogue({ keepSignPrompt: false });
      return;
    }

    if (!this.activeDialogueNpcId || !this.dialogueController?.isActive()) {
      this.hideDialogue({ keepSignPrompt: false, endNpcConversation: false });
      return;
    }

    if (this.dialogueController.canGoBack()) {
      this.dialogueController.goBack();
      return;
    }

    this.dialogueController.endConversation("cancelled");
  }

  handleDialogueChoiceNavigation(direction) {
    if (!this.isDialogueVisible() || !this.activeDialogueNpcId) {
      return;
    }

    this.moveDialogueChoice(direction);
  }

  confirmNpcDialogueStep() {
    if (!this.dialogueController?.isActive()) {
      this.hideDialogue({ keepSignPrompt: false, endNpcConversation: false });
      return;
    }

    if (this.activeDialogueChoices.length > 0) {
      const selected = this.activeDialogueChoices[this.activeDialogueChoiceIndex];
      if (selected?.id) {
        this.dialogueController.selectChoice(selected.id);
      }
      return;
    }

    this.dialogueController.advance();
  }

  clearPointerPath() {
    this.pointerPath = [];
    this.pointerPathTiles = [];
  }

  isDialogueVisible() {
    return this.dialogueOverlay?.isVisible() === true;
  }

  handleDialoguePointerSelection(targetTile) {
    if (this.activeDialogueSignId && this.awaitingSignEnterChoice) {
      const sign = this.findSignAtTile(targetTile.x, targetTile.y);
      if (sign && sign.getData("signId") === this.activeDialogueSignId) {
        this.transitionToLevel(sign);
        return true;
      }
    }

    return false;
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
    if (this.blockingInteractableTileSet.has(keyForTile(tileX, tileY))) {
      return false;
    }
    return true;
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

  createDialogueOverlay() {
    this.dialogueOverlay = new DialogueOverlay(this, {
      depth: UI_DEPTH + 2,
      width: 760,
      height: 148,
      x: 400,
      y: 594,
    })
      .create()
      .onChoiceSelected((payload) => this.handleDialogueChoiceClick(payload));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyDialogueOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyDialogueOverlay());
  }

  destroyDialogueOverlay() {
    this.dialogueOverlay?.destroy();
    this.dialogueOverlay = null;
  }

  handleDialogueChoiceClick(payload) {
    if (!this.activeDialogueNpcId || !this.dialogueController?.isActive()) {
      return;
    }

    const choiceId = payload?.choice?.id;
    const index = Number.isInteger(payload?.index) ? payload.index : -1;
    if (index >= 0) {
      this.activeDialogueChoiceIndex = index;
    }
    if (!choiceId) {
      return;
    }

    this.dialogueController.selectChoice(choiceId);
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

  findNearbyInteractable() {
    if (!this.player || this.interactableEntities.length === 0) {
      return null;
    }

    let closestEntity = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    this.interactableEntities.forEach((entity) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entity.x, entity.y);
      if (distance <= SIGN_INTERACTION_DISTANCE && distance < closestDistance) {
        closestDistance = distance;
        closestEntity = entity;
      }
    });

    return closestEntity;
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

  findInteractableAtTile(tileX, tileY) {
    if (!Number.isInteger(tileX) || !Number.isInteger(tileY)) {
      return null;
    }

    return (
      this.interactableEntities.find((entity) => {
        const entityTile = worldToTile(entity.x, entity.y);
        return entityTile.x === tileX && entityTile.y === tileY;
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

    if (this.isDialogueVisible() && this.awaitingSignEnterChoice && this.activeDialogueSignId === sign.getData("signId")) {
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
    this.startNpcDialogueConversation(npc);
    return true;
  }

  tryInteractWithInteractable(entity) {
    if (!this.player || !entity) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, entity.x, entity.y);
    if (distance > SIGN_INTERACTION_DISTANCE) {
      return false;
    }

    this.clearPointerPath();
    const objectId = entity.getData("objectId") ?? "unknown-object";
    const type = entity.getData("type") ?? "object";
    const collectedFlag = entity.getData("collectedFlag");
    const rewardItemId = entity.getData("inventoryRewardItemId");
    const rewardAmount = Math.max(1, Number(entity.getData("inventoryRewardAmount")) || 1);
    const grantsStoryFlags = entity.getData("grantsStoryFlags");
    const alreadyCollected = collectedFlag ? hasStoryFlag(collectedFlag) : false;

    if (type === "pickup" && !alreadyCollected) {
      if (rewardItemId) {
        addInventoryItem(rewardItemId, rewardAmount);
      }
      const nextStoryFlags = {
        ...(collectedFlag ? { [collectedFlag]: true } : {}),
        ...(grantsStoryFlags && typeof grantsStoryFlags === "object" ? grantsStoryFlags : {}),
      };
      if (Object.keys(nextStoryFlags).length > 0) {
        setStoryFlags(nextStoryFlags);
      }

      this.persistGameStateSnapshot();
      this.syncInteractablesFromFlags();
      const nextCount = rewardItemId ? getInventoryCount(rewardItemId) : 0;
      const pickupPrompt = rewardItemId
        ? `${entity.getData("promptLocked")} (${rewardItemId} x${nextCount})`
        : entity.getData("promptLocked");
      this.dialogueOverlay?.renderSystemMessage(pickupPrompt, {
        speakerName: entity.getData("label") ?? "Pickup",
        hintText: "Press Space, Enter, or Esc to close",
      });
      console.log(
        `[OverworldScene] Pickup collected: ${objectId}; item=${rewardItemId ?? "none"}; total=${nextCount}; flags=${JSON.stringify(nextStoryFlags)}`
      );
      this.activeDialogueNpcId = null;
      this.activeDialogueSignId = null;
      this.awaitingSignEnterChoice = false;
      this.activeDialogueChoices = [];
      this.activeDialogueChoiceIndex = 0;
      this.syncStateDebugOverlay(true);
      return true;
    }

    const isUnlocked = entity.getData("isUnlocked") === true;
    const prompt = isUnlocked ? entity.getData("promptUnlocked") : entity.getData("promptLocked");
    const speakerName = entity.getData("label") ?? "Interactable";
    this.dialogueOverlay?.renderSystemMessage(prompt, {
      speakerName,
      hintText: "Press Space, Enter, or Esc to close",
    });
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.activeDialogueChoices = [];
    this.activeDialogueChoiceIndex = 0;
    return true;
  }

  startNpcDialogueConversation(npc) {
    if (!this.dialogueController) {
      return;
    }

    const npcId = npc.getData("npcId") || null;
    const dialogueTree = npc.getData("dialogueTree");
    const entryNodeId = npc.getData("dialogueEntryPoint") || null;
    if (!npcId || !dialogueTree) {
      this.dialogueOverlay?.renderSystemMessage("This NPC does not have a dialogue tree yet.", {
        speakerName: "System",
      });
      return;
    }

    this.activeDialogueNpcId = npcId;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.activeDialogueChoices = [];
    this.activeDialogueChoiceIndex = 0;
    this.dialogueController.startConversation({
      npcId,
      tree: dialogueTree,
      startNodeId: entryNodeId,
      context: {
        sceneKey: this.scene.key,
        playerTile: this.getPlayerTile(),
      },
    });
  }

  renderNpcDialogueSnapshot(snapshot) {
    if (!snapshot || !snapshot.node) {
      return;
    }

    this.activeDialogueChoices = Array.isArray(snapshot.choices) ? [...snapshot.choices] : [];
    if (this.activeDialogueChoiceIndex >= this.activeDialogueChoices.length) {
      this.activeDialogueChoiceIndex = 0;
    }

    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.dialogueOverlay?.renderNpcSnapshot(snapshot, {
      selectedChoiceIndex: this.activeDialogueChoiceIndex,
      npcId: this.activeDialogueNpcId,
    });
  }

  moveDialogueChoice(direction) {
    if (!this.activeDialogueChoices || this.activeDialogueChoices.length === 0) {
      return;
    }

    const nextIndex = this.dialogueOverlay?.moveChoiceSelection(direction);
    if (Number.isInteger(nextIndex)) {
      this.activeDialogueChoiceIndex = nextIndex;
    }
  }

  showLevelSignPrompt(sign) {
    const signLabel = sign.getData("label") || "Unknown Level";
    const signPrompt = this.isSignLocked(sign)
      ? sign.getData("lockedPrompt") || sign.getData("prompt") || signLabel
      : sign.getData("prompt") || signLabel;
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = sign.getData("signId") || null;
    this.awaitingSignEnterChoice = true;
    this.activeDialogueChoices = [];
    this.activeDialogueChoiceIndex = 0;
    this.dialogueOverlay?.renderSignPrompt({
      signId: this.activeDialogueSignId,
      signLabel,
      signPrompt,
    });
  }

  transitionToLevel(sign) {
    if (!sign || this.isTransitioning) {
      return;
    }

    if (this.isSignLocked(sign)) {
      this.dialogueOverlay?.renderSystemMessage(
        sign.getData("lockedPrompt") || "This route is currently locked.",
        {
          speakerName: "System",
          hintText: "Clear the nearby patrol zone first.",
        }
      );
      this.awaitingSignEnterChoice = false;
      return;
    }

    const signId = sign.getData("signId");
    const sceneKey = LEVEL_SCENE_BY_SIGN_ID[signId];
    if (!sceneKey) {
      this.dialogueOverlay?.renderSystemMessage("This sign is not mapped to a playable level yet.", {
        speakerName: "System",
      });
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

  hideDialogue(options = {}) {
    const keepSignPrompt = options.keepSignPrompt === true;
    const endNpcConversation = options.endNpcConversation !== false;

    if (endNpcConversation && this.activeDialogueNpcId && this.dialogueController?.isActive()) {
      this.dialogueController.endConversation("closed");
    }

    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = keepSignPrompt ? this.activeDialogueSignId : null;
    this.awaitingSignEnterChoice = keepSignPrompt && this.awaitingSignEnterChoice;
    this.activeDialogueChoices = [];
    this.activeDialogueChoiceIndex = 0;
    this.dialogueOverlay?.hide();
  }

  getMovementVector() {
    if (!this.inputManager) {
      return { x: 0, y: 0 };
    }

    const leftPressed = this.inputManager.isActionActive(InputActions.MOVE_LEFT);
    const rightPressed = this.inputManager.isActionActive(InputActions.MOVE_RIGHT);
    const upPressed = this.inputManager.isActionActive(InputActions.MOVE_UP);
    const downPressed = this.inputManager.isActionActive(InputActions.MOVE_DOWN);

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

  moveAlongPointerPath(deltaMs = 0) {
    if (!this.player?.body || this.pointerPath.length === 0) {
      return false;
    }

    const nextWaypoint = this.pointerPath[0];
    const frameTravelDistance = Math.max(0, (Number(deltaMs) || 0) * (PLAYER_SPEED / 1000));
    const snapThreshold = Math.max(ARRIVAL_THRESHOLD, frameTravelDistance + 1);
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      nextWaypoint.x,
      nextWaypoint.y
    );

    if (distance <= snapThreshold) {
      this.player.setPosition(nextWaypoint.x, nextWaypoint.y);
      this.pointerPath.shift();
      this.pointerPathTiles.shift();
      if (this.pointerPath.length === 0) {
        this.player.body.setVelocity(0, 0);
        this.player.anims.play("player-idle", true);
        return false;
      }
    }

    const targetWaypoint = this.pointerPath[0];
    const direction = new Phaser.Math.Vector2(
      targetWaypoint.x - this.player.x,
      targetWaypoint.y - this.player.y
    );

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

  update(_time, delta) {
    if (!this.player || !this.player.body || this.isTransitioning) {
      return;
    }

    if (this.isDialogueVisible()) {
      this.clearPointerPath();
      this.player.body.setVelocity(0, 0);
      this.player.anims.play("player-idle", true);
      this.syncHudOverlay();
      this.syncStateDebugOverlay();
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
      this.syncStateDebugOverlay();
      this.persistOverworldProgress();
      this.checkOverworldBattleTrigger();
      return;
    }

    if (this.moveAlongPointerPath(delta)) {
      this.syncHudOverlay();
      this.syncStateDebugOverlay();
      this.persistOverworldProgress();
      this.checkOverworldBattleTrigger();
      return;
    }

    this.player.body.setVelocity(0, 0);
    this.player.anims.play("player-idle", true);
    this.syncHudOverlay();
    this.syncStateDebugOverlay();
    this.persistOverworldProgress();
    this.checkOverworldBattleTrigger();
  }

  isSignLocked(sign) {
    if (!sign) {
      return false;
    }

    return (
      sign.getData("signId") === "sign-level-2" &&
      !hasStoryFlag(KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED)
    );
  }

  createOverworldBattleZone() {
    const world = tileToWorld(OVERWORLD_BATTLE_ZONE.tileX, OVERWORLD_BATTLE_ZONE.tileY);
    const cleared = hasStoryFlag(KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED);
    const fillColor = cleared ? 0x4a8f63 : 0x8a4a3a;
    const strokeColor = cleared ? 0x9be6b5 : 0xffbf9c;

    this.overworldBattleZoneMarker = this.add
      .rectangle(world.x, world.y, TILE_SIZE - 10, TILE_SIZE - 10, fillColor, 0.45)
      .setStrokeStyle(2, strokeColor, 0.9)
      .setDepth(6);
    this.overworldBattleZoneLabel = this.add
      .text(world.x, world.y - 26, cleared ? "Patrol Cleared" : "Drone Patrol", {
        color: cleared ? "#d4ffe3" : "#ffd3bf",
        fontFamily: "monospace",
        fontSize: "11px",
        backgroundColor: "#111827cc",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(7);
    this.characterLayer.add(this.overworldBattleZoneMarker);
    this.characterLayer.add(this.overworldBattleZoneLabel);
    this.overworldBattleZoneTriggered = false;
  }

  checkOverworldBattleTrigger() {
    if (this.isTransitioning || this.overworldBattleZoneTriggered) {
      return;
    }

    if (hasStoryFlag(KEY_BATTLE_OUTCOME_FLAGS.OVERWORLD_FIRST_DRONE_DEFEATED)) {
      return;
    }

    const tile = this.getPlayerTile();
    if (!tile) {
      return;
    }

    if (tile.x !== OVERWORLD_BATTLE_ZONE.tileX || tile.y !== OVERWORLD_BATTLE_ZONE.tileY) {
      return;
    }

    this.startOverworldBattleEncounter();
  }

  startOverworldBattleEncounter() {
    if (this.isTransitioning || this.overworldBattleZoneTriggered) {
      return;
    }

    this.overworldBattleZoneTriggered = true;
    this.isTransitioning = true;
    this.clearPointerPath();
    this.hideDialogue();
    this.persistOverworldProgress({
      force: true,
      currentSceneKey: "BattleScene",
    });
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.time.delayedCall(190, () => {
      this.scene.start("BattleScene", {
        encounterId: OVERWORLD_BATTLE_ENCOUNTER_ID,
        returnSceneKey: "OverworldScene",
        returnSceneData: {
          spawnPointId: "default",
        },
      });
    });
  }
}

export default OverworldScene;
