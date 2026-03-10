import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const TEXTURE_KEYS = Object.freeze({
  playerSheet: "player-sheet",
  npcRanger: "npc-ranger",
  npcMechanic: "npc-mechanic",
  signLevel1: "sign-level-1",
  signLevel2: "sign-level-2",
  overworldFloor: "tile-overworld-floor",
  overworldWall: "tile-overworld-wall",
  level1FloorA: "tile-level1-floor-a",
  level1FloorB: "tile-level1-floor-b",
  level1Wall: "tile-level1-wall",
  level2FloorA: "tile-level2-floor-a",
  level2FloorB: "tile-level2-floor-b",
  level2Wall: "tile-level2-wall",
  battleFloorA: "tile-battle-floor-a",
  battleFloorB: "tile-battle-floor-b",
  battleObstacle: "tile-battle-obstacle",
});

const PLAYER_FRAMES = Object.freeze({
  idle: 0,
  walkA: 1,
  walkB: 2,
});

function ensureTexture(scene, key, drawFn, width, height) {
  if (scene.textures.exists(key)) {
    return;
  }

  const frame = scene.make.graphics({ x: 0, y: 0, add: false });
  drawFn(frame);
  frame.generateTexture(key, width, height);
  frame.destroy();
}

function toCssColor(color) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function drawRoundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function drawUnitFrameCanvas(ctx, offsetX, bodyColor, accentColor) {
  ctx.fillStyle = toCssColor(0x1f1f2b);
  ctx.fillRect(offsetX + 8, 1, 8, 8);
  drawRoundedRect(ctx, offsetX + 4, 10, 16, 16, 3, toCssColor(bodyColor));
  ctx.fillStyle = toCssColor(accentColor);
  ctx.fillRect(offsetX + 6, 13, 12, 2);
  ctx.fillStyle = toCssColor(0x111111);
  ctx.fillRect(offsetX + 6, 28, 5, 3);
  ctx.fillRect(offsetX + 13, 28, 5, 3);
}

function ensurePlayerSpritesheet(scene) {
  if (scene.textures.exists(TEXTURE_KEYS.playerSheet)) {
    return;
  }

  const spriteWidth = 24;
  const spriteHeight = 32;
  const frameCount = 3;
  const canvas = document.createElement("canvas");
  canvas.width = spriteWidth * frameCount;
  canvas.height = spriteHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  drawUnitFrameCanvas(ctx, PLAYER_FRAMES.idle * spriteWidth, 0x2f71ff, 0x8cb3ff);
  drawUnitFrameCanvas(ctx, PLAYER_FRAMES.walkA * spriteWidth, 0x3c7cff, 0xa8c6ff);
  drawUnitFrameCanvas(ctx, PLAYER_FRAMES.walkB * spriteWidth, 0x2b66e0, 0x7ea8ff);
  scene.textures.addSpriteSheet(TEXTURE_KEYS.playerSheet, canvas, {
    frameWidth: spriteWidth,
    frameHeight: spriteHeight,
    endFrame: frameCount - 1,
  });
}

function ensurePlayerAnimations(scene) {
  if (!scene.anims.exists("player-idle")) {
    scene.anims.create({
      key: "player-idle",
      frames: [{ key: TEXTURE_KEYS.playerSheet, frame: PLAYER_FRAMES.idle }],
      frameRate: 1,
      repeat: -1,
    });
  }

  if (!scene.anims.exists("player-walk")) {
    scene.anims.create({
      key: "player-walk",
      frames: [
        { key: TEXTURE_KEYS.playerSheet, frame: PLAYER_FRAMES.walkA },
        { key: TEXTURE_KEYS.playerSheet, frame: PLAYER_FRAMES.walkB },
        { key: TEXTURE_KEYS.playerSheet, frame: PLAYER_FRAMES.walkA },
        { key: TEXTURE_KEYS.playerSheet, frame: PLAYER_FRAMES.idle },
      ],
      frameRate: 10,
      repeat: -1,
    });
  }
}

function ensureSharedTiles(scene) {
  ensureTexture(
    scene,
    TEXTURE_KEYS.overworldFloor,
    (frame) => {
      frame.fillStyle(0x4c8f5e, 1);
      frame.fillRect(0, 0, 46, 46);
    },
    46,
    46
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.overworldWall,
    (frame) => {
      frame.fillStyle(0x5a4b3d, 1);
      frame.fillRect(0, 0, 46, 46);
    },
    46,
    46
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.level1FloorA,
    (frame) => {
      frame.fillStyle(0x28426a, 1);
      frame.fillRect(0, 0, 46, 46);
      frame.lineStyle(1, 0x3a5e8b, 0.9);
      frame.strokeRect(0, 0, 46, 46);
    },
    46,
    46
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.level1FloorB,
    (frame) => {
      frame.fillStyle(0x203757, 1);
      frame.fillRect(0, 0, 46, 46);
      frame.lineStyle(1, 0x3a5e8b, 0.9);
      frame.strokeRect(0, 0, 46, 46);
    },
    46,
    46
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.level1Wall,
    (frame) => {
      frame.fillStyle(0x3e2f2f, 1);
      frame.fillRect(0, 0, 46, 46);
      frame.lineStyle(1, 0x8e6a6a, 0.9);
      frame.strokeRect(0, 0, 46, 46);
    },
    46,
    46
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.level2FloorA,
    (frame) => {
      frame.fillStyle(0x6e4a2d, 1);
      frame.fillRect(0, 0, 49, 49);
      frame.lineStyle(1, 0xc09468, 0.85);
      frame.strokeRect(0, 0, 49, 49);
    },
    49,
    49
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.level2FloorB,
    (frame) => {
      frame.fillStyle(0x5a3d26, 1);
      frame.fillRect(0, 0, 49, 49);
      frame.lineStyle(1, 0xc09468, 0.85);
      frame.strokeRect(0, 0, 49, 49);
    },
    49,
    49
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.level2Wall,
    (frame) => {
      frame.fillStyle(0x2f2620, 1);
      frame.fillRect(0, 0, 49, 49);
      frame.lineStyle(1, 0x8f7660, 0.85);
      frame.strokeRect(0, 0, 49, 49);
    },
    49,
    49
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.battleFloorA,
    (frame) => {
      frame.fillStyle(0x314458, 1);
      frame.fillRect(0, 0, 50, 50);
    },
    50,
    50
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.battleFloorB,
    (frame) => {
      frame.fillStyle(0x2a3a4c, 1);
      frame.fillRect(0, 0, 50, 50);
    },
    50,
    50
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.battleObstacle,
    (frame) => {
      frame.fillStyle(0x6f4f3b, 1);
      frame.fillRect(0, 0, 44, 44);
      frame.lineStyle(2, 0xb08a66, 0.9);
      frame.strokeRect(0, 0, 44, 44);
    },
    44,
    44
  );
}

function ensureNpcAndSignTextures(scene) {
  ensureTexture(
    scene,
    TEXTURE_KEYS.npcRanger,
    (frame) => {
      frame.fillStyle(0x1f1f2b, 1);
      frame.fillRoundedRect(6, 0, 12, 10, 3);
      frame.fillStyle(0x3f8f7d, 1);
      frame.fillRoundedRect(4, 10, 16, 16, 4);
      frame.fillStyle(0xc5f7d9, 1);
      frame.fillRect(6, 14, 12, 3);
      frame.fillStyle(0x111111, 1);
      frame.fillRect(6, 28, 5, 3);
      frame.fillRect(13, 28, 5, 3);
    },
    24,
    32
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.npcMechanic,
    (frame) => {
      frame.fillStyle(0x1f1f2b, 1);
      frame.fillRoundedRect(6, 0, 12, 10, 3);
      frame.fillStyle(0x9d6ac9, 1);
      frame.fillRoundedRect(4, 10, 16, 16, 4);
      frame.fillStyle(0xffd58a, 1);
      frame.fillRect(6, 14, 12, 3);
      frame.fillStyle(0x111111, 1);
      frame.fillRect(6, 28, 5, 3);
      frame.fillRect(13, 28, 5, 3);
    },
    24,
    32
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.signLevel1,
    (frame) => {
      frame.fillStyle(0x7c5a3a, 1);
      frame.fillRect(10, 14, 4, 14);
      frame.fillStyle(0xffe6a8, 1);
      frame.fillRoundedRect(2, 2, 20, 14, 3);
      frame.fillStyle(0x1a1a1a, 0.25);
      frame.fillRect(4, 6, 16, 2);
      frame.fillRect(4, 10, 16, 2);
    },
    24,
    32
  );
  ensureTexture(
    scene,
    TEXTURE_KEYS.signLevel2,
    (frame) => {
      frame.fillStyle(0x4b658f, 1);
      frame.fillRect(10, 14, 4, 14);
      frame.fillStyle(0xbee3ff, 1);
      frame.fillRoundedRect(2, 2, 20, 14, 3);
      frame.fillStyle(0x1a1a1a, 0.25);
      frame.fillRect(4, 6, 16, 2);
      frame.fillRect(4, 10, 16, 2);
    },
    24,
    32
  );
}

export function ensureSharedAssets(scene) {
  ensurePlayerSpritesheet(scene);
  ensurePlayerAnimations(scene);
  ensureNpcAndSignTextures(scene);
  ensureSharedTiles(scene);
}

export { PLAYER_FRAMES, TEXTURE_KEYS };
