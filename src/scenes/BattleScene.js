import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import { cheetahUnit, elephantUnit, guardianDogUnit } from "../battle/units/animalUnits.js";
import { getEffectiveCombatStats, isDogDangerBuffActive, resolveAttack } from "../battle/combatResolver.js";

const TILE_SIZE = 52;
const GRID_WIDTH = 12;
const GRID_HEIGHT = 8;
const UI_DEPTH = 30;
const OBSTACLES = [
  { x: 6, y: 3 },
  { x: 6, y: 4 },
  { x: 8, y: 2 },
];

function keyFor(x, y) {
  return `${x},${y}`;
}

function manhattanDistance(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID_WIDTH && y < GRID_HEIGHT;
}

function findStepToward(start, goal) {
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: start.x + Math.sign(dx), y: start.y };
  }

  return { x: start.x, y: start.y + Math.sign(dy) };
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
    this.units = [];
    this.selectedUnitId = null;
    this.mode = "idle";
    this.turn = 1;
    this.playerTurn = true;
    this.tileHighlights = [];
    this.logLines = [];
    this.obstacleSet = new Set();
    this.dangerMessageShown = false;
  }

  create() {
    this.cameras.main.setBackgroundColor("#1a1f2b");
    this.createGrid();
    this.createObstacles();
    this.createUnits();
    this.createUi();
    this.setupInput();
    this.refreshDogBuffVisuals();
    this.updateTurnHeader();
    this.updateSelectionPanel();
  }

  createGrid() {
    this.gridLayer = this.add.layer();
    for (let y = 0; y < GRID_HEIGHT; y += 1) {
      for (let x = 0; x < GRID_WIDTH; x += 1) {
        const baseColor = (x + y) % 2 === 0 ? 0x314458 : 0x2a3a4c;
        const tile = this.add.rectangle(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE - 2,
          TILE_SIZE - 2,
          baseColor
        );
        this.gridLayer.add(tile);
      }
    }
  }

  createObstacles() {
    this.obstacleLayer = this.add.layer();
    OBSTACLES.forEach(({ x, y }) => {
      this.obstacleSet.add(keyFor(x, y));
      const block = this.add.rectangle(
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE - 8,
        TILE_SIZE - 8,
        0x6f4f3b
      );
      block.setStrokeStyle(2, 0xb08a66, 0.9);
      this.obstacleLayer.add(block);
    });
  }

  createUnits() {
    const protagonist = this.spawnUnit(
      {
        id: "protagonist",
        name: "Protagonist",
        archetype: "hero",
        movement: { tilesPerTurn: 4 },
        attack: { range: 1, baseDamage: 22, canAttackOverObstacles: false },
        stats: { maxHp: 120, defense: 14 },
        abilities: [],
      },
      "friendly",
      2,
      4,
      0x6aa9ff
    );
    protagonist.currentHp = 32;
    this.protagonist = protagonist;

    this.spawnUnit(elephantUnit, "friendly", 5, 3, 0xb5b5b5);
    this.spawnUnit(cheetahUnit, "friendly", 1, 2, 0xe8c26e);
    this.spawnUnit(guardianDogUnit, "friendly", 3, 5, 0xc48e5a);

    this.spawnUnit(
      {
        id: "enemy-raider-1",
        name: "Raider Alpha",
        archetype: "raider",
        movement: { tilesPerTurn: 3 },
        attack: { range: 1, baseDamage: 20, canAttackOverObstacles: false },
        stats: { maxHp: 90, defense: 8 },
        abilities: [],
      },
      "enemy",
      7,
      3,
      0xc45656
    );
    this.spawnUnit(
      {
        id: "enemy-raider-2",
        name: "Raider Beta",
        archetype: "raider",
        movement: { tilesPerTurn: 3 },
        attack: { range: 1, baseDamage: 18, canAttackOverObstacles: false },
        stats: { maxHp: 80, defense: 7 },
        abilities: [],
      },
      "enemy",
      9,
      5,
      0xb14747
    );
  }

  spawnUnit(config, faction, tileX, tileY, color) {
    const sprite = this.add.rectangle(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE - 18,
      TILE_SIZE - 18,
      color
    );
    sprite.setStrokeStyle(2, faction === "friendly" ? 0xc9d7ff : 0xffc3c3, 1);
    const icon = this.add
      .text(sprite.x - 12, sprite.y - 24, "FURY", {
        color: "#ffd166",
        fontFamily: "monospace",
        fontSize: "10px",
      })
      .setDepth(UI_DEPTH - 5)
      .setVisible(false);

    const unit = {
      id: config.id,
      name: config.name,
      faction,
      archetype: config.archetype ?? null,
      movement: { ...config.movement },
      attack: { ...config.attack },
      stats: { ...config.stats },
      abilities: Array.isArray(config.abilities) ? [...config.abilities] : [],
      currentHp: config.stats.maxHp,
      tileX,
      tileY,
      hasActed: false,
      alive: true,
      buffActive: false,
      baseColor: color,
      sprite,
      buffIcon: icon,
    };

    this.units.push(unit);
    return unit;
  }

  createUi() {
    this.turnHeaderText = this.add
      .text(12, 10, "", {
        color: "#ffffff",
        fontFamily: "monospace",
        fontSize: "15px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.instructionsText = this.add
      .text(12, 32, "Click a friendly unit. Keys: [M] Move [A] Attack [E] End Turn [H] Toggle Danger HP", {
        color: "#d7dfef",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.selectionPanelText = this.add
      .text(12, 54, "", {
        color: "#eaf3ff",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.actionMenuText = this.add
      .text(12, 162, "", {
        color: "#cfe8ff",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);

    this.logText = this.add
      .text(12, 244, "", {
        color: "#ffd9a8",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);
  }

  setupInput() {
    this.input.on("pointerdown", (pointer) => {
      if (!this.playerTurn) {
        return;
      }
      const tileX = Math.floor(pointer.worldX / TILE_SIZE);
      const tileY = Math.floor(pointer.worldY / TILE_SIZE);
      if (!inBounds(tileX, tileY)) {
        return;
      }
      this.handleTileClick(tileX, tileY);
    });

    this.input.keyboard.on("keydown-M", () => this.enterMoveMode());
    this.input.keyboard.on("keydown-A", () => this.enterAttackMode());
    this.input.keyboard.on("keydown-E", () => this.endPlayerTurn());
    this.input.keyboard.on("keydown-H", () => this.toggleProtagonistDanger());
  }

  handleTileClick(tileX, tileY) {
    const selected = this.getSelectedUnit();

    if (this.mode === "move" && selected) {
      const valid = this.highlightTileData.find((tile) => tile.x === tileX && tile.y === tileY);
      if (valid) {
        this.moveUnit(selected, tileX, tileY);
        return;
      }
    }

    if (this.mode === "attack" && selected) {
      const target = this.getUnitAt(tileX, tileY);
      if (target && target.faction === "enemy" && this.canUnitAttackTarget(selected, target)) {
        this.attackTarget(selected, target);
        return;
      }
    }

    const clickedUnit = this.getUnitAt(tileX, tileY);
    if (clickedUnit && clickedUnit.faction === "friendly" && clickedUnit.alive) {
      this.selectUnit(clickedUnit.id);
      return;
    }

    this.clearHighlights();
    this.mode = "idle";
    this.updateSelectionPanel();
  }

  selectUnit(unitId) {
    this.selectedUnitId = unitId;
    this.mode = "idle";
    this.clearHighlights();
    this.updateSelectionPanel();
  }

  getSelectedUnit() {
    return this.units.find((unit) => unit.id === this.selectedUnitId && unit.alive) ?? null;
  }

  getUnitAt(tileX, tileY) {
    return (
      this.units.find((unit) => unit.alive && unit.tileX === tileX && unit.tileY === tileY) ??
      null
    );
  }

  getFriendlyUnits() {
    return this.units.filter((unit) => unit.faction === "friendly" && unit.alive);
  }

  getEnemyUnits() {
    return this.units.filter((unit) => unit.faction === "enemy" && unit.alive);
  }

  enterMoveMode() {
    const unit = this.getSelectedUnit();
    if (!this.playerTurn || !unit || unit.hasActed) {
      return;
    }
    this.mode = "move";
    const reachableTiles = this.getReachableTiles(unit, unit.movement.tilesPerTurn);
    this.showHighlights(reachableTiles, 0x45d483, 0.35);
    this.highlightTileData = reachableTiles;
    this.updateSelectionPanel();
  }

  enterAttackMode() {
    const unit = this.getSelectedUnit();
    if (!this.playerTurn || !unit || unit.hasActed) {
      return;
    }
    this.mode = "attack";
    const targets = this.getEnemyUnits()
      .filter((enemy) => this.canUnitAttackTarget(unit, enemy))
      .map((enemy) => ({ x: enemy.tileX, y: enemy.tileY }));
    this.showHighlights(targets, 0xe46f6f, 0.38);
    this.highlightTileData = targets;
    this.updateSelectionPanel();
  }

  clearHighlights() {
    this.tileHighlights.forEach((highlight) => highlight.destroy());
    this.tileHighlights = [];
    this.highlightTileData = [];
  }

  showHighlights(tiles, color, alpha) {
    this.clearHighlights();
    tiles.forEach(({ x, y }) => {
      const rect = this.add.rectangle(
        x * TILE_SIZE + TILE_SIZE / 2,
        y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE - 10,
        TILE_SIZE - 10,
        color,
        alpha
      );
      rect.setStrokeStyle(2, color, 0.9);
      this.tileHighlights.push(rect);
    });
  }

  getReachableTiles(unit, range) {
    const queue = [{ x: unit.tileX, y: unit.tileY, dist: 0 }];
    const visited = new Set([keyFor(unit.tileX, unit.tileY)]);
    const tiles = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current.dist >= range) {
        continue;
      }

      const neighbors = [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ];

      neighbors.forEach((neighbor) => {
        if (!inBounds(neighbor.x, neighbor.y)) {
          return;
        }
        const k = keyFor(neighbor.x, neighbor.y);
        if (visited.has(k) || this.obstacleSet.has(k)) {
          return;
        }
        const occupant = this.getUnitAt(neighbor.x, neighbor.y);
        if (occupant && occupant.id !== unit.id) {
          return;
        }

        visited.add(k);
        tiles.push({ x: neighbor.x, y: neighbor.y });
        queue.push({ x: neighbor.x, y: neighbor.y, dist: current.dist + 1 });
      });
    }

    return tiles;
  }

  moveUnit(unit, tileX, tileY) {
    unit.tileX = tileX;
    unit.tileY = tileY;
    unit.hasActed = true;
    unit.sprite.x = tileX * TILE_SIZE + TILE_SIZE / 2;
    unit.sprite.y = tileY * TILE_SIZE + TILE_SIZE / 2;
    unit.buffIcon.x = unit.sprite.x - 12;
    unit.buffIcon.y = unit.sprite.y - 24;
    this.addLog(`${unit.name} moved to (${tileX}, ${tileY}).`);
    this.mode = "idle";
    this.clearHighlights();
    this.updateSelectionPanel();
    this.tryAutoEndPlayerTurn();
  }

  hasBlockingObstacleBetween(from, to) {
    if (from.tileX === to.tileX) {
      const x = from.tileX;
      const start = Math.min(from.tileY, to.tileY) + 1;
      const end = Math.max(from.tileY, to.tileY);
      for (let y = start; y < end; y += 1) {
        if (this.obstacleSet.has(keyFor(x, y))) {
          return true;
        }
      }
    }

    if (from.tileY === to.tileY) {
      const y = from.tileY;
      const start = Math.min(from.tileX, to.tileX) + 1;
      const end = Math.max(from.tileX, to.tileX);
      for (let x = start; x < end; x += 1) {
        if (this.obstacleSet.has(keyFor(x, y))) {
          return true;
        }
      }
    }

    return false;
  }

  canUnitAttackTarget(attacker, defender) {
    if (!attacker.alive || !defender.alive) {
      return false;
    }

    const inRange = manhattanDistance(attacker, defender) <= attacker.attack.range;
    if (!inRange) {
      return false;
    }

    if (attacker.attack.canAttackOverObstacles) {
      return true;
    }

    return !this.hasBlockingObstacleBetween(attacker, defender);
  }

  attackTarget(attacker, defender) {
    const result = resolveAttack({
      attacker,
      defender,
      protagonist: this.protagonist,
    });

    defender.currentHp = Math.max(0, defender.currentHp - result.damage);
    defender.stats.hp = defender.currentHp;
    attacker.hasActed = true;
    this.mode = "idle";
    this.clearHighlights();
    this.addLog(`${attacker.name} hit ${defender.name} for ${result.damage}.`);

    if (defender.currentHp <= 0) {
      defender.alive = false;
      defender.sprite.setFillStyle(0x222222, 0.4);
      defender.buffIcon.setVisible(false);
      this.addLog(`${defender.name} was defeated.`);
    }

    this.refreshDogBuffVisuals();
    this.updateSelectionPanel();
    this.tryAutoEndPlayerTurn();
  }

  tryAutoEndPlayerTurn() {
    const waiting = this.getFriendlyUnits().filter((unit) => unit.id !== this.protagonist.id);
    const allActed = waiting.every((unit) => unit.hasActed);
    if (allActed) {
      this.endPlayerTurn();
    }
  }

  endPlayerTurn() {
    if (!this.playerTurn) {
      return;
    }
    this.playerTurn = false;
    this.mode = "idle";
    this.clearHighlights();
    this.selectedUnitId = null;
    this.updateSelectionPanel();
    this.runEnemyTurn();
  }

  runEnemyTurn() {
    const enemies = this.getEnemyUnits();
    const friendly = this.getFriendlyUnits();
    enemies.forEach((enemy) => {
      const target = this.pickTargetForEnemy(enemy, friendly);
      if (!target) {
        return;
      }
      if (this.canUnitAttackTarget(enemy, target)) {
        this.attackTarget(enemy, target);
        return;
      }
      const step = findStepToward(enemy, target);
      const occupied = this.getUnitAt(step.x, step.y);
      if (inBounds(step.x, step.y) && !this.obstacleSet.has(keyFor(step.x, step.y)) && !occupied) {
        enemy.tileX = step.x;
        enemy.tileY = step.y;
        enemy.sprite.x = step.x * TILE_SIZE + TILE_SIZE / 2;
        enemy.sprite.y = step.y * TILE_SIZE + TILE_SIZE / 2;
      }
    });

    this.turn += 1;
    this.playerTurn = true;
    this.units.forEach((unit) => {
      if (unit.faction === "friendly") {
        unit.hasActed = false;
      }
    });
    this.refreshDogBuffVisuals();
    this.updateTurnHeader();
    this.addLog(`Turn ${this.turn}: your phase.`);
  }

  pickTargetForEnemy(enemy, friendlyUnits) {
    if (!friendlyUnits.length) {
      return null;
    }

    const protagonistAlive = this.protagonist?.alive ? this.protagonist : null;
    if (protagonistAlive) {
      return protagonistAlive;
    }

    return [...friendlyUnits].sort((a, b) => manhattanDistance(enemy, a) - manhattanDistance(enemy, b))[0];
  }

  toggleProtagonistDanger() {
    const wasDanger = this.protagonist.currentHp <= 42;
    this.protagonist.currentHp = wasDanger ? 84 : 32;
    this.protagonist.stats.hp = this.protagonist.currentHp;
    this.addLog(
      `Protagonist HP set to ${this.protagonist.currentHp}/${this.protagonist.stats.maxHp} (${wasDanger ? "safe" : "danger"}).`
    );
    this.refreshDogBuffVisuals();
    this.updateSelectionPanel();
  }

  refreshDogBuffVisuals() {
    this.units.forEach((unit) => {
      if (unit.archetype !== "dog" || !unit.alive) {
        return;
      }
      const active = isDogDangerBuffActive(unit, this.protagonist);
      const changed = unit.buffActive !== active;
      unit.buffActive = active;
      unit.buffIcon.setVisible(active);
      unit.sprite.setFillStyle(active ? 0xf5a85c : unit.baseColor, 1);
      if (changed) {
        this.addLog(`${unit.name}: Loyal Fury ${active ? "ACTIVE" : "inactive"}.`);
      }
    });
  }

  addLog(line) {
    this.logLines.push(line);
    this.logLines = this.logLines.slice(-6);
    this.logText.setText(this.logLines.join("\n"));
  }

  updateTurnHeader() {
    this.turnHeaderText.setText(`Battle Turn ${this.turn} | ${this.playerTurn ? "Player Phase" : "Enemy Phase"}`);
  }

  updateSelectionPanel() {
    this.updateTurnHeader();
    const selected = this.getSelectedUnit();
    if (!selected) {
      this.selectionPanelText.setText("Selected: none");
      this.actionMenuText.setText("Action menu: select a friendly unit.");
      return;
    }

    const effective = getEffectiveCombatStats(selected, { protagonist: this.protagonist });
    const hpLine = `HP ${selected.currentHp}/${selected.stats.maxHp}`;
    const coreLine = `Move ${selected.movement.tilesPerTurn} | Range ${selected.attack.range} | DMG ${effective.damage} | DEF ${effective.defense}`;

    let abilityLine = "Ability: -";
    if (selected.archetype === "elephant") {
      abilityLine = "Ability: Trampling Arc (Can shoot over obstacles)";
    } else if (selected.archetype === "cheetah") {
      abilityLine = "Ability: Predator Sprint (High mobility)";
    } else if (selected.archetype === "dog") {
      abilityLine = `Ability: Loyal Fury (${selected.buffActive ? "ACTIVE" : "inactive"})`;
    }

    this.selectionPanelText.setText(`Selected: ${selected.name}\n${hpLine}\n${coreLine}\n${abilityLine}`);

    const modeLabel = this.mode === "idle" ? "choose action" : this.mode;
    const actionLines = [
      `Mode: ${modeLabel}`,
      "[M] Move",
      "[A] Attack",
      "[E] End turn",
    ];
    if (selected.archetype === "elephant") {
      actionLines.push("Trait: Attack targeting ignores obstacle blocking.");
    }
    if (selected.archetype === "dog" && selected.buffActive) {
      actionLines.push("Buff: Loyal Fury active (danger-triggered).");
    }
    this.actionMenuText.setText(actionLines.join("\n"));
  }
}

export default BattleScene;
