# Game State Structure

This document defines the canonical structure for the game state. The structure is intended to be serializable (JSON/YAML) and directly representable in code.

## Top-Level Shape

- `meta`: Metadata about the session/save.
- `grid`: The playfield dimensions and tiles.
- `environment`: Global and local conditions that affect gameplay.
- `friendlyUnits`: Player-controlled units.
- `enemyUnits`: AI-controlled units.
- `turn`: Turn tracking and phase control.

## Field Definitions

### `meta`
- `version`: Schema version string, e.g. `"1.0"`.
- `seed`: Optional random seed for deterministic generation.

### `grid`
- `width`: Columns count.
- `height`: Rows count.
- `tiles`: Array of tiles indexed by `y * width + x`.

Tile fields:
- `x`, `y`: Grid coordinates.
- `terrain`: e.g. `"grass"`, `"stone"`, `"water"`.
- `height`: Elevation level (integer).
- `blocksMovement`: Boolean.
- `cover`: Optional cover rating `0-3`.

### `environment`
- `weather`: e.g. `"clear"`, `"rain"`.
- `timeOfDay`: e.g. `"day"`, `"night"`.
- `hazards`: Array of localized effects.

Hazard fields:
- `id`: Unique identifier.
- `type`: e.g. `"fire"`, `"poison"`.
- `area`: List of `{x, y}` tiles affected.
- `durationTurns`: Remaining turns.

### `friendlyUnits` / `enemyUnits`
Arrays of unit objects with common shape.

Unit fields:
- `id`: Unique identifier.
- `name`: Display name.
- `faction`: e.g. `"player"`, `"enemy"`.
- `position`: `{x, y}`.
- `stats`: Core combat values.
- `statusEffects`: Array of active effects.
- `equipment`: Optional items/slots.
- `ai`: Optional AI state (primarily for enemies).

Stats fields:
- `hp`, `maxHp`
- `mp`, `maxMp`
- `attack`, `defense`, `speed`, `range`

Status effect fields:
- `id`, `type`, `durationTurns`, `magnitude`

### `turn`
- `index`: Turn number (starts at 1).
- `phase`: e.g. `"player"`, `"enemy"`.
- `activeUnitId`: Current unit taking action.

## Example JSON

```json
{
  "meta": {"version": "1.0", "seed": 12345},
  "grid": {
    "width": 4,
    "height": 3,
    "tiles": [
      {"x": 0, "y": 0, "terrain": "grass", "height": 0, "blocksMovement": false, "cover": 0}
    ]
  },
  "environment": {
    "weather": "clear",
    "timeOfDay": "day",
    "hazards": [
      {"id": "hz-1", "type": "fire", "area": [{"x": 1, "y": 1}], "durationTurns": 2}
    ]
  },
  "friendlyUnits": [
    {
      "id": "u-1",
      "name": "Vera",
      "faction": "player",
      "position": {"x": 0, "y": 0},
      "stats": {"hp": 30, "maxHp": 30, "mp": 10, "maxMp": 10, "attack": 6, "defense": 4, "speed": 5, "range": 1},
      "statusEffects": [],
      "equipment": {"weapon": "iron-sword"}
    }
  ],
  "enemyUnits": [
    {
      "id": "e-1",
      "name": "Drake",
      "faction": "enemy",
      "position": {"x": 3, "y": 2},
      "stats": {"hp": 18, "maxHp": 18, "mp": 0, "maxMp": 0, "attack": 5, "defense": 2, "speed": 4, "range": 1},
      "statusEffects": [],
      "ai": {"state": "idle", "targetId": "u-1"}
    }
  ],
  "turn": {"index": 1, "phase": "player", "activeUnitId": "u-1"}
}
```

## Previewing Future States

Use the `previewGameState` helper to clone the current state, apply a mutator, and obtain a preview without changing the original state.
