/**
 * Canonical game state structure for the isometric strategy game.
 * This file provides a concrete, code-level representation that mirrors
 * GAME_STATE.md.
 */

export const exampleGameState = {
  meta: {
    version: "1.0",
    seed: 12345,
    turn: 1,
    activeFaction: "friendly",
    phase: "planning",
  },
  grid: {
    width: 10,
    height: 10,
    tileSize: { x: 64, y: 32 },
    origin: { x: 0, y: 0 },
    tiles: Array.from({ length: 10 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => ({
        x,
        y,
        elevation: 0,
        terrainId: "grass",
        moveCost: 1,
        blocksMovement: false,
        blocksLineOfSight: false,
      }))
    ),
  },
  environment: {
    terrain: [{ id: "grass", name: "Grass", color: "#6aa84f", moveCost: 1 }],
    obstacles: [
      {
        id: "rock-1",
        name: "Rock",
        position: { x: 3, y: 3 },
        size: { w: 1, h: 1 },
        blocksMovement: true,
        blocksLineOfSight: true,
      },
    ],
    props: [
      {
        id: "banner-1",
        name: "Banner",
        position: { x: 1, y: 6 },
        tags: ["decor"],
      },
    ],
    hazards: [
      {
        id: "fire-1",
        name: "Fire Pit",
        position: { x: 5, y: 2 },
        radius: 1,
        damagePerTurn: 2,
      },
    ],
  },
  friendlyUnits: [
    {
      id: "friendly-1",
      name: "Vanguard",
      faction: "friendly",
      position: { x: 0, y: 0 },
      facing: "SE",
      stats: {
        hp: 12,
        maxHp: 12,
        move: 4,
        attack: 6,
        defense: 3,
        range: 1,
      },
      status: {
        alive: true,
        effects: [],
      },
      inventory: ["potion"],
      abilities: ["slash"],
    },
  ],
  enemyUnits: [
    {
      id: "enemy-1",
      name: "Raider",
      faction: "enemy",
      position: { x: 6, y: 6 },
      facing: "NW",
      stats: {
        hp: 10,
        maxHp: 10,
        move: 3,
        attack: 5,
        defense: 2,
        range: 1,
      },
      status: {
        alive: true,
        effects: ["guarded"],
      },
      inventory: [],
      abilities: ["strike"],
    },
  ],
};

export const createInitialGameState = () => JSON.parse(JSON.stringify(exampleGameState));
