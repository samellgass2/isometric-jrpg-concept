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
    this.unitManager = null;
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

    this.add
      .text(24, 48, "Board: 8x8 isometric grid (row,col). Press O to return to Overworld.", {
        color: "#b5c7e8",
        fontFamily: "monospace",
        fontSize: "14px",
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
        const row = tile.getData("row");
        const col = tile.getData("col");
        const fillColor = (row + col) % 2 === 0 ? TILE_COLORS.fillA : TILE_COLORS.fillB;
        tile.setFillStyle(fillColor, 1);
      });
    });
  }

  create() {
    this.setupCamera();
    this.createGrid();
    this.createInitialUnits();
    this.createUi();
    this.addHoverFeedback();

    this.add
      .text(24, 70, `Tile Size: ${TILE_WIDTH}x${TILE_HEIGHT}  Origin: (${this.gridOrigin.x.toFixed(0)}, ${this.gridOrigin.y.toFixed(0)})`, {
        color: "#9fbbdf",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.add
      .text(24, 88, "Hover any diamond to verify stable tile objects for future targeting.", {
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
      .text(24, 106, `Units: ${unitSummary}`, {
        color: "#9fbbdf",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setDepth(UI_DEPTH)
      .setScrollFactor(0);

    this.returnToOverworldKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.O);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.unitManager) {
        this.unitManager.destroy();
      }
      this.unitManager = null;
    });
  }

  update() {
    if (this.returnToOverworldKey && Phaser.Input.Keyboard.JustDown(this.returnToOverworldKey)) {
      this.scene.start("OverworldScene");
    }
  }
}

export default BattleScene;
