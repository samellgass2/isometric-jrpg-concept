# Game State Structure

This project uses a single game state object to represent the current match. The
state is designed for an isometric, grid-based tactics game and separates the
map, environment, friendly units, and enemy units.

## Top-Level Shape

```
GameState {
  meta: {
    version: "1.0",
    seed: number,
    turn: number,
    activeFaction: "friendly" | "enemy",
    phase: "planning" | "action" | "resolution"
  },
  grid: {
    width: number,
    height: number,
    tileSize: { x: number, y: number },
    origin: { x: number, y: number },
    tiles: Tile[][]
  },
  environment: {
    terrain: TerrainCell[],
    obstacles: Obstacle[],
    props: Prop[],
    hazards: Hazard[]
  },
  friendlyUnits: Unit[],
  enemyUnits: Unit[]
}
```

## Tile

```
Tile {
  x: number,
  y: number,
  elevation: number,
  terrainId: string,
  moveCost: number,
  blocksMovement: boolean,
  blocksLineOfSight: boolean
}
```

## Unit

```
Unit {
  id: string,
  name: string,
  faction: "friendly" | "enemy",
  position: { x: number, y: number },
  facing: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW",
  stats: {
    hp: number,
    maxHp: number,
    move: number,
    attack: number,
    defense: number,
    range: number
  },
  status: {
    alive: boolean,
    effects: string[]
  },
  inventory: string[],
  abilities: string[]
}
```

## Environment Entries

```
TerrainCell { id: string, name: string, color: string, moveCost: number }
Obstacle { id: string, name: string, position: { x: number, y: number }, size: { w: number, h: number }, blocksMovement: boolean, blocksLineOfSight: boolean }
Prop { id: string, name: string, position: { x: number, y: number }, tags: string[] }
Hazard { id: string, name: string, position: { x: number, y: number }, radius: number, damagePerTurn: number }
```

## Notes

- The grid uses `tiles[y][x]` indexing so row-major storage is predictable.
- Environment entries are separate arrays so the engine can query them without
  touching unit state.
- Friendly and enemy units are split for faster turn logic, while each unit still
  stores its `faction` for clarity.
- The example game state in `src/gameState.js` uses a 10 x 10 board.
