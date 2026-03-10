import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import InputManager, { InputActions } from "../input/InputManager.js";

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
    this.dialogueBox = null;
    this.dialogueText = null;
    this.dialogueHintText = null;
    this.activeDialogueNpcId = null;
    this.activeDialogueSignId = null;
    this.awaitingSignEnterChoice = false;
    this.pointerPath = [];
    this.pointerPathTiles = [];
    this.npcTileSet = new Set();
    this.signTileSet = new Set();
    this.isTransitioning = false;
  }

  create(data) {
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
    const spawnTile = this.resolveSpawnTile(data?.spawnPointId);
    this.createPlayerCharacter(spawnTile);
    this.createNpcPlaceholders();
    this.createLevelSigns();
    this.setupInputManager();
    this.createDialogueUi();

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

  resolveSpawnTile(spawnPointId) {
    return OVERWORLD_SPAWN_BY_ID[spawnPointId] ?? OVERWORLD_SPAWN_BY_ID.default;
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
      npc.setData("dialogue", npcConfig.dialogue);
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
      sign.setInteractive({ useHandCursor: true });
      sign.on("pointerdown", (pointer, localX, localY, event) => {
        this.handleSignPointerInteraction(sign, event);
      });
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

    if (event.action === InputActions.CANCEL) {
      if (this.dialogueBox?.visible) {
        this.hideDialogue();
      }
      this.clearPointerPath();
    }
  }

  handleSelectTileAction(event) {
    if (!this.player || this.dialogueBox?.visible) {
      return;
    }

    if (!Number.isInteger(event.tileX) || !Number.isInteger(event.tileY)) {
      return;
    }

    const targetTile = { x: event.tileX, y: event.tileY };
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
      `${signPrompt}\nPress Enter (or click sign again) to travel to ${signLabel}, or Space to close.`
    );
    this.dialogueHintText.setText("Enter/click sign: travel  Space: close");
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

  handleSignPointerInteraction(sign, event) {
    if (!this.player || this.isTransitioning) {
      return;
    }

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sign.x, sign.y);
    if (distance > SIGN_INTERACTION_DISTANCE) {
      return;
    }

    if (event?.stopPropagation) {
      event.stopPropagation();
    }

    if (
      this.dialogueBox?.visible &&
      this.awaitingSignEnterChoice &&
      this.activeDialogueSignId === sign.getData("signId")
    ) {
      this.transitionToLevel(sign);
      return;
    }

    this.clearPointerPath();
    this.showLevelSignPrompt(sign);
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

    if (this.dialogueBox.visible) {
      this.clearPointerPath();
      this.player.body.setVelocity(0, 0);
      this.player.anims.play("player-idle", true);
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
      return;
    }

    if (this.moveAlongPointerPath()) {
      return;
    }

    this.player.body.setVelocity(0, 0);
    this.player.anims.play("player-idle", true);
  }
}

export default OverworldScene;
