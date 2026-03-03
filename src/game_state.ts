export type Coord = {
  x: number;
  y: number;
};

export type Tile = {
  x: number;
  y: number;
  terrain: string;
  height: number;
  blocksMovement: boolean;
  cover?: number;
};

export type Grid = {
  width: number;
  height: number;
  tiles: Tile[];
};

export type Hazard = {
  id: string;
  type: string;
  area: Coord[];
  durationTurns: number;
};

export type Environment = {
  weather: string;
  timeOfDay: string;
  hazards: Hazard[];
};

export type Stats = {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  attack: number;
  defense: number;
  speed: number;
  range: number;
};

export type StatusEffect = {
  id: string;
  type: string;
  durationTurns: number;
  magnitude: number;
};

export type UnitAI = {
  state: string;
  targetId?: string;
};

export type Unit = {
  id: string;
  name: string;
  faction: "player" | "enemy" | "neutral";
  position: Coord;
  stats: Stats;
  statusEffects: StatusEffect[];
  equipment?: Record<string, string>;
  ai?: UnitAI;
};

export type TurnState = {
  index: number;
  phase: "player" | "enemy" | "neutral";
  activeUnitId?: string;
};

export type GameMeta = {
  version: string;
  seed?: number;
};

export type GameState = {
  meta: GameMeta;
  grid: Grid;
  environment: Environment;
  friendlyUnits: Unit[];
  enemyUnits: Unit[];
  turn: TurnState;
};
