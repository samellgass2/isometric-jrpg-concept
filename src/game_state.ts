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

export type GameStateMutator = (draft: GameState) => void;

const cloneCoord = (coord: Coord): Coord => ({ x: coord.x, y: coord.y });

const cloneTile = (tile: Tile): Tile => ({
  x: tile.x,
  y: tile.y,
  terrain: tile.terrain,
  height: tile.height,
  blocksMovement: tile.blocksMovement,
  cover: tile.cover,
});

const cloneGrid = (grid: Grid): Grid => ({
  width: grid.width,
  height: grid.height,
  tiles: grid.tiles.map(cloneTile),
});

const cloneHazard = (hazard: Hazard): Hazard => ({
  id: hazard.id,
  type: hazard.type,
  area: hazard.area.map(cloneCoord),
  durationTurns: hazard.durationTurns,
});

const cloneEnvironment = (environment: Environment): Environment => ({
  weather: environment.weather,
  timeOfDay: environment.timeOfDay,
  hazards: environment.hazards.map(cloneHazard),
});

const cloneStats = (stats: Stats): Stats => ({
  hp: stats.hp,
  maxHp: stats.maxHp,
  mp: stats.mp,
  maxMp: stats.maxMp,
  attack: stats.attack,
  defense: stats.defense,
  speed: stats.speed,
  range: stats.range,
});

const cloneStatusEffect = (effect: StatusEffect): StatusEffect => ({
  id: effect.id,
  type: effect.type,
  durationTurns: effect.durationTurns,
  magnitude: effect.magnitude,
});

const cloneUnitAI = (ai?: UnitAI): UnitAI | undefined =>
  ai ? { state: ai.state, targetId: ai.targetId } : undefined;

const cloneUnit = (unit: Unit): Unit => ({
  id: unit.id,
  name: unit.name,
  faction: unit.faction,
  position: cloneCoord(unit.position),
  stats: cloneStats(unit.stats),
  statusEffects: unit.statusEffects.map(cloneStatusEffect),
  equipment: unit.equipment ? { ...unit.equipment } : undefined,
  ai: cloneUnitAI(unit.ai),
});

const cloneTurnState = (turn: TurnState): TurnState => ({
  index: turn.index,
  phase: turn.phase,
  activeUnitId: turn.activeUnitId,
});

const cloneGameMeta = (meta: GameMeta): GameMeta => ({
  version: meta.version,
  seed: meta.seed,
});

export const cloneGameState = (state: GameState): GameState => ({
  meta: cloneGameMeta(state.meta),
  grid: cloneGrid(state.grid),
  environment: cloneEnvironment(state.environment),
  friendlyUnits: state.friendlyUnits.map(cloneUnit),
  enemyUnits: state.enemyUnits.map(cloneUnit),
  turn: cloneTurnState(state.turn),
});

export const previewGameState = (
  state: GameState,
  mutator: GameStateMutator,
): GameState => {
  const draft = cloneGameState(state);
  mutator(draft);
  return draft;
};
