import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const TILE_SIZE = 48;
const MAP_WIDTH = 16;
const MAP_HEIGHT = 12;
const PLAYER_SPEED = 180;
const MAP_PIXEL_WIDTH = MAP_WIDTH * TILE_SIZE;
const MAP_PIXEL_HEIGHT = MAP_HEIGHT * TILE_SIZE;
const INTERACTION_DISTANCE = TILE_SIZE * 0.9;
const UI_DEPTH = 40;
const ARRIVAL_THRESHOLD = 4;

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
    this.cursors = null;
    this.wasdKeys = null;
    this.interactKeys = null;
    this.npcGroup = null;
    this.npcEntities = [];
    this.dialogueBox = null;
    this.dialogueText = null;
    this.dialogueHintText = null;
    this.activeDialogueNpcId = null;
    this.pointerPath = [];
    this.pointerPathTiles = [];
    this.npcTileSet = new Set();
  }

  create() {
    this.cameras.main.setBackgroundColor("#1f2228");
    this.physics.world.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP_PIXEL_WIDTH, MAP_PIXEL_HEIGHT);

    this.terrainLayer = this.add.layer();
    this.collisionLayer = this.add.layer();
    this.characterLayer = this.add.layer();

    this.npcGroup = this.physics.add.staticGroup();

    this.renderTerrain();
    this.renderCollisionOverlay();
    this.createCollisionBodies();
    this.createPlayerCharacter();
    this.createNpcPlaceholders();
    this.setupMovementInput();
    this.setupPointerInput();
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
    this.physics.add.collider(this.player, this.npcGroup);
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

  setupMovementInput() {
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
  }

  setupPointerInput() {
    this.input.on("pointerdown", (pointer) => {
      if (!this.player || this.dialogueBox?.visible) {
        return;
      }

      const targetTile = worldToTile(pointer.worldX, pointer.worldY);
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
    });
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

  showDialogue(npc) {
    const npcName = npc.getData("name") || "NPC";
    const npcDialogue = npc.getData("dialogue") || `${npcName}: Placeholder dialogue.`;
    this.activeDialogueNpcId = npc.getData("npcId") || null;
    this.dialogueText.setText(npcDialogue);
    this.dialogueBox.setVisible(true);
    this.dialogueText.setVisible(true);
    this.dialogueHintText.setVisible(true);
  }

  hideDialogue() {
    this.activeDialogueNpcId = null;
    this.dialogueBox.setVisible(false);
    this.dialogueText.setVisible(false);
    this.dialogueHintText.setVisible(false);
  }

  handleInteractionInput() {
    const interactPressed =
      Phaser.Input.Keyboard.JustDown(this.interactKeys.space) ||
      Phaser.Input.Keyboard.JustDown(this.interactKeys.enter);

    if (!interactPressed) {
      return;
    }

    if (this.dialogueBox.visible) {
      this.hideDialogue();
      return;
    }

    const nearbyNpc = this.findNearbyNpc();
    if (!nearbyNpc) {
      return;
    }

    this.showDialogue(nearbyNpc);
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
    if (!this.player || !this.player.body) {
      return;
    }

    this.handleInteractionInput();

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
