import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";

const GRID_ROWS = 8;
const GRID_COLS = 8;
const TILE_WIDTH = 72;
const TILE_HEIGHT = 36;
const UI_DEPTH = 50;
const TILE_DEPTH_BASE = 5;
const UNIT_DEPTH_OFFSET = 2;
const UNIT_Y_OFFSET = TILE_HEIGHT * 0.45;
const TILE_COLORS = {
  fillA: 0x3a6ea5,
  fillB: 0x2c5889,
  stroke: 0xa7d0ff,
  highlight: 0x4f90d9,
  aiActionFill: 0x875151,
  aiActionStroke: 0xffb7b7,
};
const UNIT_SIDE_STYLE = {
  player: {
    fill: 0x4cd97b,
    stroke: 0x1c7a43,
    marker: "P",
    labelColor: "#0d2816",
  },
  enemy: {
    fill: 0xff7a7a,
    stroke: 0x8f1c1c,
    marker: "E",
    labelColor: "#2d0f0f",
  },
};
const TURN_OWNER = Object.freeze({
  player: "player",
  ai: "ai",
});
const AI_TURN_DELAY_MS = 850;

function isoProject(row, col, originX, originY) {
  return {
    x: originX + (col - row) * (TILE_WIDTH / 2),
    y: originY + (col + row) * (TILE_HEIGHT / 2),
  };
}

class BattleUnitManager {
  constructor(scene) {
    this.scene = scene;
    this.units = [];
    this.unitsById = new Map();
    this.nextId = 1;
  }

  createUnit(unitConfig) {
    const id = unitConfig.id ?? `unit-${this.nextId++}`;
    const side = unitConfig.side;

    if (!UNIT_SIDE_STYLE[side]) {
      throw new Error(`Unsupported unit side "${side}" for unit "${id}".`);
    }

    if (!this.scene.isWithinGrid(unitConfig.row, unitConfig.col)) {
      throw new Error(`Unit "${id}" has out-of-bounds grid position (${unitConfig.row},${unitConfig.col}).`);
    }

    const unit = {
      id,
      side,
      row: unitConfig.row,
      col: unitConfig.col,
      name: unitConfig.name ?? id,
      view: this.createUnitView(id, side),
    };

    this.units.push(unit);
    this.unitsById.set(id, unit);
    this.syncUnitScreenPosition(unit);
    return unit;
  }

  createUnitView(id, side) {
    const style = UNIT_SIDE_STYLE[side];
    const shadow = this.scene.add.ellipse(0, 8, 24, 10, 0x000000, 0.35);
    const body = this.scene.add.circle(0, -8, 12, style.fill, 1).setStrokeStyle(2, style.stroke, 1);
    const marker = this.scene.add
      .text(0, -8, style.marker, {
        color: style.labelColor,
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const unitView = this.scene.add.container(0, 0, [shadow, body, marker]).setName(`unit-${id}`);
    unitView.setDataEnabled();
    unitView.setData("unitId", id);
    unitView.setData("side", side);
    unitView.setData("bodyShape", body);
    unitView.setSize(28, 28);
    unitView.setInteractive(new Phaser.Geom.Circle(0, 0, 16), Phaser.Geom.Circle.Contains);
    return unitView;
  }

  syncUnitScreenPosition(unit) {
    const projected = this.scene.gridToWorld(unit.row, unit.col);
    unit.view.setPosition(projected.x, projected.y - UNIT_Y_OFFSET);
    unit.view.setDepth(this.scene.getUnitDepth(unit.row, unit.col));
  }

  setUnitGridPosition(id, row, col) {
    const unit = this.unitsById.get(id);
    if (!unit) {
      return false;
    }

    if (!this.scene.isWithinGrid(row, col)) {
      throw new Error(`Unit "${id}" cannot move to out-of-bounds grid position (${row},${col}).`);
    }

    unit.row = row;
    unit.col = col;
    this.syncUnitScreenPosition(unit);
    return true;
  }

  getUnits() {
    return this.units.map((unit) => ({
      id: unit.id,
      side: unit.side,
      row: unit.row,
      col: unit.col,
      name: unit.name,
    }));
  }

  forEachUnit(callback) {
    this.units.forEach((unit) => callback(unit));
  }

  getUnitById(id) {
    return this.unitsById.get(id) ?? null;
  }

  getFirstUnitBySide(side) {
    return this.units.find((unit) => unit.side === side) ?? null;
  }

  destroy() {
    this.units.forEach((unit) => unit.view.destroy());
    this.units = [];
    this.unitsById.clear();
  }
}

class BattleScene extends Phaser.Scene {
  constructor() {
    super("BattleScene");
    this.returnToOverworldKey = null;
    this.gridOrigin = { x: 0, y: 0 };
    this.tileObjects = [];
    this.tileById = new Map();
    this.unitManager = null;
    this.endTurnKey = null;
    this.endTurnAltKey = null;
    this.currentTurnOwner = TURN_OWNER.player;
    this.turnCounter = 1;
    this.selectedPlayerUnitId = null;
    this.turnStatusText = null;
    this.turnInstructionText = null;
    this.turnSelectionText = null;
    this.turnHistoryText = null;
    this.aiTurnTimer = null;
    this.aiActionTile = null;
    this.aiActionTween = null;
  }

  preload() {}

  createUi() {
    this.add
      .text(24, 20, "Battle Scene", {
        color: "#f4f7ff",
        fontFamily: "monospace",
        fontSize: "20px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.turnStatusText = this.add
      .text(24, 48, "", {
        color: "#ffe8a6",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.turnInstructionText = this.add
      .text(24, 66, "", {
        color: "#b5c7e8",
        fontFamily: "monospace",
        fontSize: "14px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.turnSelectionText = this.add
      .text(24, 84, "", {
        color: "#9fbbdf",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.turnHistoryText = this.add
      .text(24, 100, "", {
        color: "#9fbbdf",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);
  }

  getProjectedGridBounds(originX, originY) {
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const projected = isoProject(row, col, originX, originY);
        minX = Math.min(minX, projected.x - halfW);
        maxX = Math.max(maxX, projected.x + halfW);
        minY = Math.min(minY, projected.y - halfH);
        maxY = Math.max(maxY, projected.y + halfH);
      }
    }

    return { minX, maxX, minY, maxY };
  }

  computeGridOrigin() {
    const viewportWidth = this.scale.width;
    const viewportHeight = this.scale.height;

    const baseOriginX = viewportWidth / 2;
    const baseOriginY = viewportHeight / 2;
    const baseBounds = this.getProjectedGridBounds(baseOriginX, baseOriginY);
    const boardCenterX = (baseBounds.minX + baseBounds.maxX) / 2;
    const boardCenterY = (baseBounds.minY + baseBounds.maxY) / 2;

    return {
      x: baseOriginX + (viewportWidth / 2 - boardCenterX),
      y: baseOriginY + (viewportHeight / 2 - boardCenterY),
    };
  }

  createGrid() {
    this.tileObjects = [];
    this.tileById.clear();
    this.gridOrigin = this.computeGridOrigin();
    const halfW = TILE_WIDTH / 2;
    const halfH = TILE_HEIGHT / 2;
    const tilePoints = [0, -halfH, halfW, 0, 0, halfH, -halfW, 0];

    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        const projected = isoProject(row, col, this.gridOrigin.x, this.gridOrigin.y);
        const fillColor = (row + col) % 2 === 0 ? TILE_COLORS.fillA : TILE_COLORS.fillB;
        const tile = this.add
          .polygon(projected.x, projected.y, tilePoints, fillColor, 1)
          .setStrokeStyle(1, TILE_COLORS.stroke, 0.75)
          .setDepth(TILE_DEPTH_BASE + row + col)
          .setName(`battle-tile-r${row}-c${col}`)
          .setDataEnabled();

        tile.setData("row", row);
        tile.setData("col", col);
        tile.setData("tileId", `${row},${col}`);
        tile.setData("worldX", projected.x);
        tile.setData("worldY", projected.y);

        this.tileObjects.push(tile);
        this.tileById.set(`${row},${col}`, tile);
      }
    }
  }

  isWithinGrid(row, col) {
    return row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS;
  }

  gridToWorld(row, col) {
    return isoProject(row, col, this.gridOrigin.x, this.gridOrigin.y);
  }

  getUnitDepth(row, col) {
    return TILE_DEPTH_BASE + row + col + UNIT_DEPTH_OFFSET;
  }

  createInitialUnits() {
    this.unitManager = new BattleUnitManager(this);
    const unitDefinitions = [
      {
        id: "player-vanguard",
        side: "player",
        row: 6,
        col: 2,
        name: "Vanguard",
      },
      {
        id: "enemy-skirmisher",
        side: "enemy",
        row: 1,
        col: 5,
        name: "Skirmisher",
      },
    ];

    unitDefinitions.forEach((unitConfig) => this.unitManager.createUnit(unitConfig));
  }

  getTileBaseFillColor(row, col) {
    return (row + col) % 2 === 0 ? TILE_COLORS.fillA : TILE_COLORS.fillB;
  }

  getTileAt(row, col) {
    return this.tileById.get(`${row},${col}`) ?? null;
  }

  restoreTileVisual(tile) {
    if (!tile) {
      return;
    }

    const row = tile.getData("row");
    const col = tile.getData("col");

    if (this.aiActionTile === tile) {
      tile.setFillStyle(TILE_COLORS.aiActionFill, 1);
      tile.setStrokeStyle(2, TILE_COLORS.aiActionStroke, 1);
      return;
    }

    tile.setAlpha(1);
    tile.setFillStyle(this.getTileBaseFillColor(row, col), 1);
    tile.setStrokeStyle(1, TILE_COLORS.stroke, 0.75);
  }

  setupCamera() {
    this.cameras.main.setBackgroundColor("#243145");
    this.cameras.main.setZoom(1);
    this.cameras.main.setBounds(0, 0, this.scale.width, this.scale.height);
    this.cameras.main.centerOn(this.scale.width / 2, this.scale.height / 2);
  }

  addHoverFeedback() {
    this.tileObjects.forEach((tile) => {
      tile.setInteractive(
        new Phaser.Geom.Polygon([
          0,
          -TILE_HEIGHT / 2,
          TILE_WIDTH / 2,
          0,
          0,
          TILE_HEIGHT / 2,
          -TILE_WIDTH / 2,
          0,
        ]),
        Phaser.Geom.Polygon.Contains
      );

      tile.on("pointerover", () => {
        tile.setFillStyle(TILE_COLORS.highlight, 1);
      });

      tile.on("pointerout", () => {
        this.restoreTileVisual(tile);
      });
    });
  }

  addUnitInputHandlers() {
    this.unitManager.forEachUnit((unit) => {
      unit.view.on("pointerdown", () => {
        this.trySelectPlayerUnit(unit.id);
      });

      unit.view.on("pointerover", () => {
        this.input.setDefaultCursor("pointer");
      });

      unit.view.on("pointerout", () => {
        this.input.setDefaultCursor("default");
      });
    });
  }

  setTurnHistoryText(message) {
    if (!this.turnHistoryText) {
      return;
    }

    this.turnHistoryText.setText(`Last Action: ${message}`);
  }

  updateTurnUi() {
    if (!this.turnStatusText || !this.turnInstructionText || !this.turnSelectionText) {
      return;
    }

    const activeLabel = this.currentTurnOwner === TURN_OWNER.player ? "Player" : "AI";
    this.turnStatusText.setText(`Turn ${this.turnCounter} | Active: ${activeLabel}`);

    if (this.currentTurnOwner === TURN_OWNER.player) {
      this.turnInstructionText.setText(
        "Player Turn: Click a green unit to select. Press E or Enter to end turn. Press O for Overworld."
      );
    } else {
      this.turnInstructionText.setText("AI Turn: simulated action in progress. Player input is temporarily locked.");
    }

    const selectedUnit = this.selectedPlayerUnitId ? this.unitManager.getUnitById(this.selectedPlayerUnitId) : null;
    if (selectedUnit) {
      this.turnSelectionText.setText(
        `Selected Unit: ${selectedUnit.name} (${selectedUnit.id}) at (${selectedUnit.row},${selectedUnit.col})`
      );
      return;
    }

    this.turnSelectionText.setText("Selected Unit: none");
  }

  updateUnitVisuals() {
    if (!this.unitManager) {
      return;
    }

    this.unitManager.forEachUnit((unit) => {
      const style = UNIT_SIDE_STYLE[unit.side];
      const bodyShape = unit.view.getData("bodyShape");
      const isSelected = unit.id === this.selectedPlayerUnitId;
      const isPlayerTurn = this.currentTurnOwner === TURN_OWNER.player;
      const isPlayersUnit = unit.side === TURN_OWNER.player;

      unit.view.setScale(isSelected ? 1.2 : 1);
      unit.view.setAlpha(!isPlayerTurn && isPlayersUnit ? 0.82 : 1);

      if (bodyShape) {
        if (isSelected && isPlayerTurn) {
          bodyShape.setStrokeStyle(3, 0xfff6a2, 1);
        } else {
          bodyShape.setStrokeStyle(2, style.stroke, 1);
        }
      }
    });
  }

  clearAiActionTileHighlight() {
    if (this.aiActionTween) {
      this.aiActionTween.stop();
      this.aiActionTween = null;
    }

    if (this.aiActionTile) {
      const tile = this.aiActionTile;
      this.aiActionTile = null;
      this.restoreTileVisual(tile);
    }
  }

  highlightAiActionTile(row, col) {
    this.clearAiActionTileHighlight();
    const tile = this.getTileAt(row, col);
    if (!tile) {
      return;
    }

    this.aiActionTile = tile;
    tile.setFillStyle(TILE_COLORS.aiActionFill, 1);
    tile.setStrokeStyle(2, TILE_COLORS.aiActionStroke, 1);

    this.aiActionTween = this.tweens.add({
      targets: tile,
      alpha: { from: 1, to: 0.6 },
      duration: 260,
      yoyo: true,
      repeat: -1,
    });
  }

  trySelectPlayerUnit(unitId) {
    if (this.currentTurnOwner !== TURN_OWNER.player) {
      return;
    }

    const unit = this.unitManager.getUnitById(unitId);
    if (!unit) {
      return;
    }

    if (unit.side !== TURN_OWNER.player) {
      this.setTurnHistoryText(`Ignored selection for ${unit.id}; only player units are selectable.`);
      return;
    }

    this.selectedPlayerUnitId = unit.id;
    this.setTurnHistoryText(`Selected ${unit.name} (${unit.id}).`);
    this.updateUnitVisuals();
    this.updateTurnUi();
  }

  startPlayerTurn(reason, { incrementTurn } = { incrementTurn: false }) {
    if (incrementTurn) {
      this.turnCounter += 1;
    }

    this.currentTurnOwner = TURN_OWNER.player;
    this.selectedPlayerUnitId = null;
    this.clearAiActionTileHighlight();
    this.updateUnitVisuals();
    this.updateTurnUi();
    this.setTurnHistoryText(reason);
    console.log(`[Battle] Turn ${this.turnCounter}: player turn started. ${reason}`);
  }

  startAiTurn(reason) {
    this.currentTurnOwner = TURN_OWNER.ai;
    this.selectedPlayerUnitId = null;
    this.updateUnitVisuals();
    this.updateTurnUi();
    this.setTurnHistoryText(reason);
    console.log(`[Battle] Turn ${this.turnCounter}: AI turn started. ${reason}`);

    const enemyUnit = this.unitManager.getFirstUnitBySide(TURN_OWNER.ai);
    if (enemyUnit) {
      this.highlightAiActionTile(enemyUnit.row, enemyUnit.col);
      this.setTurnHistoryText(
        `AI action: ${enemyUnit.name} (${enemyUnit.id}) holds at (${enemyUnit.row},${enemyUnit.col}).`
      );
      console.log(
        `[Battle] Turn ${this.turnCounter}: AI action by ${enemyUnit.id} at (${enemyUnit.row},${enemyUnit.col}).`
      );
    } else {
      this.setTurnHistoryText("AI action: no enemy units available.");
      console.log(`[Battle] Turn ${this.turnCounter}: AI has no units to act.`);
    }

    if (this.aiTurnTimer) {
      this.aiTurnTimer.remove(false);
    }
    this.aiTurnTimer = this.time.delayedCall(AI_TURN_DELAY_MS, () => {
      this.aiTurnTimer = null;
      this.startPlayerTurn("AI turn complete. Player control restored.", { incrementTurn: true });
    });
  }

  endPlayerTurn(source) {
    if (this.currentTurnOwner !== TURN_OWNER.player) {
      return;
    }

    this.startAiTurn(`Player ended turn using ${source}.`);
  }

  create() {
    this.setupCamera();
    this.createGrid();
    this.createInitialUnits();
    this.createUi();
    this.addHoverFeedback();
    this.addUnitInputHandlers();

    this.add
      .text(24, 122, `Tile Size: ${TILE_WIDTH}x${TILE_HEIGHT}  Origin: (${this.gridOrigin.x.toFixed(0)}, ${this.gridOrigin.y.toFixed(0)})`, {
        color: "#9fbbdf",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.add
      .text(24, 140, "Hover any diamond to verify stable tile objects for future targeting.", {
        color: "#b5c7e8",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    const unitSummary = this.unitManager
      .getUnits()
      .map((unit) => `${unit.id}:${unit.side}@(${unit.row},${unit.col})`)
      .join("  ");

    this.add
      .text(24, 158, `Units: ${unitSummary}`, {
        color: "#9fbbdf",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.returnToOverworldKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this.endTurnKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.endTurnAltKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.startPlayerTurn("Battle initialized. Awaiting player input.", { incrementTurn: false });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.clearAiActionTileHighlight();
      if (this.aiTurnTimer) {
        this.aiTurnTimer.remove(false);
        this.aiTurnTimer = null;
      }
      if (this.unitManager) {
        this.unitManager.destroy();
      }
      this.input.setDefaultCursor("default");
      this.unitManager = null;
    });
  }

  update() {
    if (this.returnToOverworldKey && Phaser.Input.Keyboard.JustDown(this.returnToOverworldKey)) {
      this.scene.start("OverworldScene");
    }

    const didPressEndTurn =
      (this.endTurnKey && Phaser.Input.Keyboard.JustDown(this.endTurnKey)) ||
      (this.endTurnAltKey && Phaser.Input.Keyboard.JustDown(this.endTurnAltKey));

    if (didPressEndTurn) {
      this.endPlayerTurn("E/Enter");
    }
  }
}

export default BattleScene;
