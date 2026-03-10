import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

export const SHARED_TEXTURE_KEYS = Object.freeze({
  OVERWORLD_ACTORS_ATLAS: "overworld-actors-atlas",
  OVERWORLD_TILE_FLOOR: "overworld-tile-floor",
  OVERWORLD_TILE_WALL: "overworld-tile-wall",
  OVERWORLD_COLLISION_OVERLAY: "overworld-collision-overlay",
  LEVEL1_TILE_FLOOR_A: "level1-tile-floor-a",
  LEVEL1_TILE_FLOOR_B: "level1-tile-floor-b",
  LEVEL1_TILE_WALL: "level1-tile-wall",
  LEVEL1_EXIT_BEACON: "level1-exit-beacon",
  LEVEL1_BATTLE_TRIGGER: "level1-battle-trigger",
  LEVEL2_TILE_FLOOR_A: "level2-tile-floor-a",
  LEVEL2_TILE_FLOOR_B: "level2-tile-floor-b",
  LEVEL2_TILE_WALL: "level2-tile-wall",
  LEVEL2_EXIT_BEACON: "level2-exit-beacon",
  LEVEL2_BATTLE_TOTEM: "level2-battle-totem",
  BATTLE_GRID_A: "battle-grid-a",
  BATTLE_GRID_B: "battle-grid-b",
  BATTLE_OBSTACLE: "battle-obstacle",
  BATTLE_HIGHLIGHT: "battle-highlight",
});

export const OVERWORLD_ACTOR_FRAMES = Object.freeze({
  PLAYER_IDLE: "player-idle",
  PLAYER_WALK_A: "player-walk-a",
  PLAYER_WALK_B: "player-walk-b",
  NPC_RANGER: "npc-ranger",
  NPC_MECHANIC: "npc-mechanic",
  SIGN_LEVEL_1: "sign-level-1",
  SIGN_LEVEL_2: "sign-level-2",
});

function createTextureFromGraphics(scene, key, drawFn, width, height) {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphic = scene.make.graphics({ x: 0, y: 0, add: false });
  drawFn(graphic);
  graphic.generateTexture(key, width, height);
  graphic.destroy();
}

function createOverworldActorAtlas(scene) {
  if (scene.textures.exists(SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS)) {
    return;
  }

  const frameWidth = 24;
  const frameHeight = 32;
  const frames = [
    OVERWORLD_ACTOR_FRAMES.PLAYER_IDLE,
    OVERWORLD_ACTOR_FRAMES.PLAYER_WALK_A,
    OVERWORLD_ACTOR_FRAMES.PLAYER_WALK_B,
    OVERWORLD_ACTOR_FRAMES.NPC_RANGER,
    OVERWORLD_ACTOR_FRAMES.NPC_MECHANIC,
    OVERWORLD_ACTOR_FRAMES.SIGN_LEVEL_1,
    OVERWORLD_ACTOR_FRAMES.SIGN_LEVEL_2,
  ];

  const graphic = scene.make.graphics({ x: 0, y: 0, add: false });

  const drawHumanoidFrame = (index, bodyColor, accentColor, topColor = 0x1f1f2b) => {
    const offsetX = index * frameWidth;
    graphic.fillStyle(topColor, 1);
    graphic.fillRect(offsetX + 8, 1, 8, 8);
    graphic.fillStyle(bodyColor, 1);
    graphic.fillRoundedRect(offsetX + 4, 10, 16, 16, 3);
    graphic.fillStyle(accentColor, 1);
    graphic.fillRect(offsetX + 6, 13, 12, 2);
    graphic.fillStyle(0x111111, 1);
    graphic.fillRect(offsetX + 6, 28, 5, 3);
    graphic.fillRect(offsetX + 13, 28, 5, 3);
  };

  const drawSignFrame = (index, postColor, boardColor) => {
    const offsetX = index * frameWidth;
    graphic.fillStyle(postColor, 1);
    graphic.fillRect(offsetX + 10, 14, 4, 14);
    graphic.fillStyle(boardColor, 1);
    graphic.fillRoundedRect(offsetX + 2, 2, 20, 14, 3);
    graphic.fillStyle(0x1a1a1a, 0.25);
    graphic.fillRect(offsetX + 4, 6, 16, 2);
    graphic.fillRect(offsetX + 4, 10, 16, 2);
  };

  drawHumanoidFrame(0, 0x2f71ff, 0x8cb3ff);
  drawHumanoidFrame(1, 0x3c7cff, 0xa8c6ff);
  drawHumanoidFrame(2, 0x2b66e0, 0x7ea8ff);
  drawHumanoidFrame(3, 0x3f8f7d, 0xc5f7d9);
  drawHumanoidFrame(4, 0x9d6ac9, 0xffd58a);
  drawSignFrame(5, 0x7c5a3a, 0xffe6a8);
  drawSignFrame(6, 0x4b658f, 0xbee3ff);

  graphic.generateTexture(SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS, frameWidth * frames.length, frameHeight);
  graphic.destroy();

  const texture = scene.textures.get(SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS);
  frames.forEach((frameName, index) => {
    texture.add(frameName, 0, index * frameWidth, 0, frameWidth, frameHeight);
  });
}

function createOverworldTextures(scene) {
  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.OVERWORLD_TILE_FLOOR,
    (graphic) => {
      graphic.fillStyle(0x4c8f5e, 1);
      graphic.fillRect(0, 0, 46, 46);
      graphic.fillStyle(0x5ba66f, 0.3);
      graphic.fillRect(2, 2, 42, 8);
    },
    46,
    46
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.OVERWORLD_TILE_WALL,
    (graphic) => {
      graphic.fillStyle(0x5a4b3d, 1);
      graphic.fillRect(0, 0, 46, 46);
      graphic.fillStyle(0x6e5c4b, 0.35);
      graphic.fillRect(2, 2, 42, 8);
    },
    46,
    46
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.OVERWORLD_COLLISION_OVERLAY,
    (graphic) => {
      graphic.fillStyle(0xcc3344, 0.25);
      graphic.fillRect(0, 0, 38, 38);
    },
    38,
    38
  );
}

function createLevel1Textures(scene) {
  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL1_TILE_FLOOR_A,
    (graphic) => {
      graphic.fillStyle(0x28426a, 1);
      graphic.fillRect(0, 0, 46, 46);
      graphic.lineStyle(1, 0x3a5e8b, 0.9);
      graphic.strokeRect(0.5, 0.5, 45, 45);
    },
    46,
    46
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL1_TILE_FLOOR_B,
    (graphic) => {
      graphic.fillStyle(0x203757, 1);
      graphic.fillRect(0, 0, 46, 46);
      graphic.lineStyle(1, 0x3a5e8b, 0.9);
      graphic.strokeRect(0.5, 0.5, 45, 45);
    },
    46,
    46
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL1_TILE_WALL,
    (graphic) => {
      graphic.fillStyle(0x3e2f2f, 1);
      graphic.fillRect(0, 0, 46, 46);
      graphic.lineStyle(1, 0x8e6a6a, 0.9);
      graphic.strokeRect(0.5, 0.5, 45, 45);
    },
    46,
    46
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL1_EXIT_BEACON,
    (graphic) => {
      graphic.fillStyle(0x6cf3b3, 0.85);
      graphic.fillCircle(16, 16, 14);
    },
    32,
    32
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL1_BATTLE_TRIGGER,
    (graphic) => {
      graphic.fillStyle(0xb73333, 0.82);
      graphic.fillRect(0, 0, 34, 34);
      graphic.lineStyle(2, 0xff9d9d, 1);
      graphic.strokeRect(1, 1, 32, 32);
    },
    34,
    34
  );
}

function createLevel2Textures(scene) {
  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL2_TILE_FLOOR_A,
    (graphic) => {
      graphic.fillStyle(0x6e4a2d, 1);
      graphic.fillRect(0, 0, 49, 49);
      graphic.lineStyle(1, 0xc09468, 0.85);
      graphic.strokeRect(0.5, 0.5, 48, 48);
    },
    49,
    49
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL2_TILE_FLOOR_B,
    (graphic) => {
      graphic.fillStyle(0x5a3d26, 1);
      graphic.fillRect(0, 0, 49, 49);
      graphic.lineStyle(1, 0xc09468, 0.85);
      graphic.strokeRect(0.5, 0.5, 48, 48);
    },
    49,
    49
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL2_TILE_WALL,
    (graphic) => {
      graphic.fillStyle(0x2f2620, 1);
      graphic.fillRect(0, 0, 49, 49);
      graphic.lineStyle(1, 0x8f7660, 0.85);
      graphic.strokeRect(0.5, 0.5, 48, 48);
    },
    49,
    49
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL2_EXIT_BEACON,
    (graphic) => {
      graphic.fillStyle(0x90e5ff, 0.9);
      graphic.fillRoundedRect(2, 2, 20, 20, 3);
      graphic.lineStyle(2, 0xd7f6ff, 1);
      graphic.strokeRoundedRect(2, 2, 20, 20, 3);
    },
    24,
    24
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.LEVEL2_BATTLE_TOTEM,
    (graphic) => {
      graphic.fillStyle(0x8b2f2f, 0.95);
      graphic.fillTriangle(0, 20, 11, 0, 22, 20);
      graphic.lineStyle(2, 0xffc2c2, 1);
      graphic.strokeTriangle(0, 20, 11, 0, 22, 20);
    },
    22,
    20
  );
}

function createBattleTextures(scene) {
  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.BATTLE_GRID_A,
    (graphic) => {
      graphic.fillStyle(0x314458, 1);
      graphic.fillRect(0, 0, 50, 50);
    },
    50,
    50
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.BATTLE_GRID_B,
    (graphic) => {
      graphic.fillStyle(0x2a3a4c, 1);
      graphic.fillRect(0, 0, 50, 50);
    },
    50,
    50
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.BATTLE_OBSTACLE,
    (graphic) => {
      graphic.fillStyle(0x6f4f3b, 1);
      graphic.fillRoundedRect(2, 2, 40, 40, 4);
      graphic.lineStyle(2, 0xb08a66, 0.9);
      graphic.strokeRoundedRect(2, 2, 40, 40, 4);
    },
    44,
    44
  );

  createTextureFromGraphics(
    scene,
    SHARED_TEXTURE_KEYS.BATTLE_HIGHLIGHT,
    (graphic) => {
      graphic.fillStyle(0xffffff, 1);
      graphic.fillRect(0, 0, 42, 42);
    },
    42,
    42
  );
}

export function ensureSharedTextures(scene) {
  createOverworldActorAtlas(scene);
  createOverworldTextures(scene);
  createLevel1Textures(scene);
  createLevel2Textures(scene);
  createBattleTextures(scene);
}

export function ensureSharedAnimations(scene) {
  if (!scene.anims.exists("player-idle")) {
    scene.anims.create({
      key: "player-idle",
      frames: [
        {
          key: SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
          frame: OVERWORLD_ACTOR_FRAMES.PLAYER_IDLE,
        },
      ],
      frameRate: 1,
      repeat: -1,
    });
  }

  if (!scene.anims.exists("player-walk")) {
    scene.anims.create({
      key: "player-walk",
      frames: [
        {
          key: SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
          frame: OVERWORLD_ACTOR_FRAMES.PLAYER_WALK_A,
        },
        {
          key: SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
          frame: OVERWORLD_ACTOR_FRAMES.PLAYER_WALK_B,
        },
        {
          key: SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
          frame: OVERWORLD_ACTOR_FRAMES.PLAYER_WALK_A,
        },
        {
          key: SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS,
          frame: OVERWORLD_ACTOR_FRAMES.PLAYER_IDLE,
        },
      ],
      frameRate: 10,
      repeat: -1,
    });
  }
}

export function isSharedTextureSetLoaded(scene) {
  return scene.textures.exists(SHARED_TEXTURE_KEYS.OVERWORLD_ACTORS_ATLAS);
}

export function makeReusedVector2() {
  return new Phaser.Math.Vector2(0, 0);
}
