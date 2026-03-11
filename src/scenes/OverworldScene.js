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
import { loadProgress, saveProgress } from "../persistence/saveSystem.js";
import {
  DialogueController,
  DialogueEvents,
  DialogueFlagStore,
  createDialogueTree,
} from "../systems/dialogue/index.js";

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

const PLAYER_TEXTURES = {
  idle: "player-idle",
  walkA: "player-walk-a",
  walkB: "player-walk-b",
};

const NPC_DEFINITIONS = [
  {
    id: "npc-ranger",
    name: "Ranger Sol",
    texture: "npc-ranger",
    bodyColor: 0x3f8f7d,
    accentColor: 0xc5f7d9,
    tileX: 8,
    tileY: 4,
    dialogue: "Ranger Sol: Trails ahead are rough. Stay inside the marked paths.",
  },
  {
    id: "npc-mechanic",
    name: "Mechanic Ivo",
    texture: "npc-mechanic",
    bodyColor: 0x9d6ac9,
    accentColor: 0xffd58a,
    tileX: 11,
    tileY: 8,
    dialogue: "Mechanic Ivo: Placeholder line... my workshop will open in a later build.",
  },
];

const DIALOGUE_FLAGS = Object.freeze({
  RANGER_TUTORIAL_COMPLETE: "dialogue.rangerTutorialComplete",
  MECHANIC_INTRO_COMPLETE: "dialogue.mechanicIntroComplete",
});

const NPC_DIALOGUE_TREES = Object.freeze({
  "npc-ranger": createDialogueTree({
    id: "npc-ranger-overworld-dialogue",
    npcId: "npc-ranger",
    speakers: {
      ranger: { name: "Ranger Sol", portraitKey: "npc-ranger" },
      player: { name: "Pathfinder" },
    },
    startNodeId: "opening",
    nodes: {
      opening: {
        id: "opening",
        speakerId: "ranger",
        text: "Trails ahead are rough. Stay inside the marked paths.",
        next: [
          {
            condition: { allFlags: [DIALOGUE_FLAGS.RANGER_TUTORIAL_COMPLETE] },
            target: "repeat-advice",
          },
          { target: "offer-guidance" },
        ],
      },
      "repeat-advice": {
        id: "repeat-advice",
        speakerId: "ranger",
        text: "You already know the route. Keep your pace steady and watch the minimap.",
      },
      "offer-guidance": {
        id: "offer-guidance",
        speakerId: "player",
        text: "Need anything from me before I head out?",
        choices: [
          {
            id: "ask-for-task",
            text: "Any task I should prioritize?",
            next: "task-response",
          },
          {
            id: "leave-now",
            text: "I am ready to move.",
            next: "farewell",
          },
        ],
      },
      "task-response": {
        id: "task-response",
        speakerId: "ranger",
        text: "Clear the training ambush marker first. Report back once it is handled.",
        hooks: [
          {
            id: "ranger-task-issued",
            once: true,
            setFlags: {
              [DIALOGUE_FLAGS.RANGER_TUTORIAL_COMPLETE]: true,
            },
            emitEvent: {
              name: "quest:ranger-task-issued",
              payload: { questId: "overworld-training-ambush" },
            },
          },
        ],
        next: "farewell",
      },
      farewell: {
        id: "farewell",
        speakerId: "ranger",
        text: "Stay alert out there.",
      },
    },
  }),
  "npc-mechanic": createDialogueTree({
    id: "npc-mechanic-overworld-dialogue",
    npcId: "npc-mechanic",
    speakers: {
      mechanic: { name: "Mechanic Ivo", portraitKey: "npc-mechanic" },
      player: { name: "Pathfinder" },
    },
    startNodeId: "opening",
    nodes: {
      opening: {
        id: "opening",
        speakerId: "mechanic",
        text: "Workshop is still closed, but I can still log your field reports.",
        next: [
          {
            condition: { allFlags: [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED] },
            target: "canyon-cleared",
          },
          { target: "status-check" },
        ],
      },
      "canyon-cleared": {
        id: "canyon-cleared",
        speakerId: "mechanic",
        text: "You cleared Canyon Crossing. Bring me salvage and I will tune your gear.",
      },
      "status-check": {
        id: "status-check",
        speakerId: "player",
        text: "Anything I should know before I leave?",
        choices: [
          {
            id: "ask-upgrades",
            text: "When do upgrades unlock?",
            next: "upgrade-response",
          },
          {
            id: "close-chat",
            text: "No questions for now.",
            next: "short-farewell",
          },
        ],
      },
      "upgrade-response": {
        id: "upgrade-response",
        speakerId: "mechanic",
        text: "Beat the canyon gauntlet first. That gives me enough diagnostics to calibrate.",
        hooks: [
          {
            id: "mechanic-intro-complete",
            once: true,
            setFlags: {
              [DIALOGUE_FLAGS.MECHANIC_INTRO_COMPLETE]: true,
            },
            callbackId: "onMechanicIntroComplete",
          },
        ],
        next: "short-farewell",
      },
      "short-farewell": {
        id: "short-farewell",
        speakerId: "mechanic",
        text: "Come back when you need repairs.",
      },
    },
  }),
});

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
    this.isTransitioning = false;
    this.hudOverlay = null;
    this.hudLastKey = "";
    this.playerDisplayName = "Pathfinder";
    this.playerStats = { hp: 100, maxHp: 100 };
    this.lastSavedTileKey = "";
    this.progressSnapshot = normalizePlayerProgressState();
  }

  create(data) {
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
    this.initializeDialogueSystem(progress);

    this.renderTerrain();
    this.renderCollisionOverlay();
    this.createCollisionBodies();
    const spawnTile = this.resolveSpawnTile(requestedSpawnPointId, progress?.overworld);
    this.createPlayerCharacter(spawnTile);
    this.createNpcPlaceholders();
    this.createLevelSigns();
    this.setupInputManager();
    this.createDialogueOverlay();
    this.createHudOverlay(data);

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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyDialogueSystem());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyDialogueSystem());
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
    const initialFlags = {
      [KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED]: getBattleOutcomeFlag(
        progressState,
        KEY_BATTLE_OUTCOME_FLAGS.LEVEL1_TRAINING_AMBUSH_CLEARED
      ),
      [KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED]: getBattleOutcomeFlag(
        progressState,
        KEY_BATTLE_OUTCOME_FLAGS.LEVEL2_CANYON_GAUNTLET_CLEARED
      ),
    };

    this.dialogueFlagStore = new DialogueFlagStore(initialFlags);
    this.dialogueController = new DialogueController({
      flagStore: this.dialogueFlagStore,
      callbackMap: {
        onMechanicIntroComplete: () => {
          this.events.emit("dialogue:mechanic-intro-complete", {
            npcId: "npc-mechanic",
            flag: DIALOGUE_FLAGS.MECHANIC_INTRO_COMPLETE,
          });
        },
      },
    });

    this.dialogueUnsubscribeFns = [
      this.dialogueController.on(DialogueEvents.NODE_CHANGED, (snapshot) =>
        this.renderNpcDialogueSnapshot(snapshot)
      ),
      this.dialogueController.on(DialogueEvents.HOOK_TRIGGERED, (payload) => {
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
    this.characterLayer.add(this.player);
  }

  createNpcPlaceholders() {
    NPC_DEFINITIONS.forEach((npcConfig) => {
      this.createNpcTexture(npcConfig.texture, npcConfig.bodyColor, npcConfig.accentColor);
      const world = tileToWorld(npcConfig.tileX, npcConfig.tileY);
      const npc = this.npcGroup.create(world.x, world.y, npcConfig.texture);
      npc.setDepth(9);
      npc.setDataEnabled();
      npc.setData("npcId", npcConfig.id);
      npc.setData("name", npcConfig.name);
      npc.setData("dialogueTree", NPC_DIALOGUE_TREES[npcConfig.id] ?? null);
      npc.refreshBody();
      this.characterLayer.add(npc);
      this.npcEntities.push(npc);
      this.npcTileSet.add(keyForTile(npcConfig.tileX, npcConfig.tileY));
    });
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
      sign.refreshBody();
      sign.body.setSize(32, 32);
      sign.body.setOffset(0, 0);
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
      return;
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
    if (!nearbyNpc) {
      return;
    }

    this.startNpcDialogueConversation(nearbyNpc);
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

  startNpcDialogueConversation(npc) {
    if (!this.dialogueController) {
      return;
    }

    const npcId = npc.getData("npcId") || null;
    const dialogueTree = npc.getData("dialogueTree");
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
    const signPrompt = sign.getData("prompt") || signLabel;
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

  moveAlongPointerPath() {
    if (!this.player?.body || this.pointerPath.length === 0) {
      return false;
    }

    const nextWaypoint = this.pointerPath[0];
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      nextWaypoint.x,
      nextWaypoint.y
    );

    if (distance <= ARRIVAL_THRESHOLD) {
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

  update() {
    if (!this.player || !this.player.body || this.isTransitioning) {
      return;
    }

    if (this.isDialogueVisible()) {
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
