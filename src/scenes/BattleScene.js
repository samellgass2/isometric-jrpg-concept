import * as Phaser from "../../node_modules/phaser/dist/phaser.esm.js";
import {
  cheetahUnit,
  elephantUnit,
  guardianDogUnit,
  zookeeperControllerDroneUnit,
  zookeeperDefenderDroneUnit,
  zookeeperScoutDroneUnit,
} from "../battle/units/animalUnits.js";
import { createProtagonistCharacter, normalizeCharacterModel } from "../models/characterModels.js";
import { getEffectiveCombatStats, isDogDangerBuffActive, resolveAttack } from "../battle/combatResolver.js";
import { getEncounterDefinition } from "../battle/encounters.js";
import {
  canUnitTarget,
  getReachableTiles,
  getTargetableTiles,
  getUnitMovementRange,
} from "../battle/grid.js";
import { decideDroneAction } from "../battle/ai/droneDecisionController.js";
import InputManager, { InputActions } from "../input/InputManager.js";
import HUDOverlay from "../ui/HUDOverlay.js";
import {
  resolveKeyBattleOutcomeFlagForEncounter,
  normalizePlayerProgressState,
  recordBattleOutcome,
  updateOverworldPosition,
} from "../state/playerProgress.js";
import {
  loadGame as loadRuntimeGame,
  logDebugStateSnapshot,
  resolveResumeTarget,
  saveGame as saveRuntimeGame,
} from "../persistence/runtimeStateTools.js";
import {
  addInventoryItem,
  awardPartyXP,
  buildBattlePartyFromEncounterTemplates,
  exportGameStateToPlayerProgress,
  getBattleEnemies,
  getGameState,
  setBattleEnemies,
  setPartyMemberHealth,
  setStoryFlag,
  setStoryFlags,
} from "../state/gameState.js";
import { loadProgress, saveProgress } from "../persistence/saveSystem.js";

const TILE_SIZE = 52;
const GRID_WIDTH = 12;
const GRID_HEIGHT = 8;
const UI_DEPTH = 30;
const OBSTACLES = [
  { x: 6, y: 3 },
  { x: 6, y: 4 },
  { x: 8, y: 2 },
];
const DEFAULT_RETURN_SCENE_KEY = "OverworldScene";
const COMMAND_OPTIONS = Object.freeze(["move", "attack", "stabilize", "end-turn"]);

function keyFor(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < GRID_WIDTH && y < GRID_HEIGHT;
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
    this.encounterId = "default-battle";
    this.encounterName = "Prototype Battle";
    this.encounterTriggerDescription = "";
    this.returnSceneKey = DEFAULT_RETURN_SCENE_KEY;
    this.returnSceneData = {};
    this.battleResolved = false;
    this.inputManager = null;
    this.inputUnsubscribe = null;
    this.cursorTile = { x: 0, y: 0 };
    this.cursorIndicator = null;
    this.commandIndex = 0;
    this.currentActingUnitId = null;
    this.hudOverlay = null;
    this.loadedProgress = null;
    this.encounterFriendlyTemplateIds = [];
    this.encounterRewards = { xp: 0, inventory: [], storyFlags: {} };
    this.devShortcutListeners = [];
  }

  create(data = {}) {
    this.loadedProgress = this.getProgressState();
    const encounterData = this.resolveEncounterData(data);
    this.encounterId = encounterData.id;
    this.encounterName = encounterData.name;
    this.encounterTriggerDescription = encounterData.triggerDescription;
    this.encounterRewards = {
      inventory: Array.isArray(encounterData.rewards?.inventory) ? encounterData.rewards.inventory : [],
      xp: encounterData.rewards?.xp,
      storyFlags:
        encounterData.rewards?.storyFlags && typeof encounterData.rewards.storyFlags === "object"
          ? encounterData.rewards.storyFlags
          : {},
    };
    this.returnSceneKey = data.returnSceneKey ?? DEFAULT_RETURN_SCENE_KEY;
    this.returnSceneData = data.returnSceneData ?? {};
    this.encounterObstacles = encounterData.obstacles;

    this.cameras.main.setBackgroundColor("#1a1f2b");
    this.createGrid();
    this.createObstacles();
    this.createUnits(encounterData);
    this.createUi();
    this.createCursorIndicator();
    this.snapCursorToStartingTile();
    this.setupInput();
    this.setupDevShortcuts();
    this.refreshDogBuffVisuals();
    this.createHudOverlay();
    this.updateTurnHeader();
    this.updateSelectionPanel();
    this.addLog(`Encounter: ${this.encounterName}`);
    this.addLog("Objective: Defeat all enemies.");
    this.logPartyProgressSnapshot("battle-entry");
    if (this.encounterTriggerDescription) {
      this.addLog(`Triggered by: ${this.encounterTriggerDescription}`);
    }
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
    this.encounterObstacles.forEach(({ x, y }) => {
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

  createUnits(encounterData) {
    const friendlyUnits = this.resolveInitialFriendlyUnits(encounterData.friendlyUnits);
    this.encounterFriendlyTemplateIds = Array.isArray(encounterData.friendlyUnits)
      ? encounterData.friendlyUnits.map((unit) => unit.id)
      : [];

    friendlyUnits.forEach((unitConfig) => {
      const unit = this.spawnUnit(
        unitConfig,
        "friendly",
        unitConfig.spawn.x,
        unitConfig.spawn.y,
        unitConfig.color ?? 0x6aa9ff
      );
      if (unitConfig.id === "protagonist") {
        this.protagonist = unit;
      }
      if (Number.isFinite(unitConfig.currentHp)) {
        unit.currentHp = Math.max(0, Math.min(unitConfig.currentHp, unit.stats.maxHp));
        unit.stats.hp = unit.currentHp;
        unit.alive = unit.currentHp > 0;
        if (!unit.alive) {
          unit.sprite.setFillStyle(0x222222, 0.4);
          unit.buffIcon.setVisible(false);
        }
      }
    });

    const spawnedEnemies = [];
    encounterData.enemyUnits.forEach((unitConfig) => {
      spawnedEnemies.push(unitConfig);
      this.spawnUnit(
        unitConfig,
        "enemy",
        unitConfig.spawn.x,
        unitConfig.spawn.y,
        unitConfig.color ?? 0xc45656
      );
    });
    setBattleEnemies(spawnedEnemies);

    if (!this.protagonist) {
      this.protagonist = this.getFriendlyUnits()[0] ?? null;
    }
  }

  getProgressState() {
    const fromRegistry = this.game?.registry?.get("playerProgress");
    if (fromRegistry) {
      return normalizePlayerProgressState(fromRegistry);
    }

    return normalizePlayerProgressState(loadProgress());
  }

  commitProgress(updater) {
    const setPlayerProgress = this.game?.registry?.get("setPlayerProgress");
    const current = this.getProgressState();
    const next = typeof updater === "function" ? updater(current) : updater;
    const normalized = normalizePlayerProgressState(next);
    this.loadedProgress = normalized;

    if (typeof setPlayerProgress === "function") {
      return setPlayerProgress(normalized);
    }

    this.game?.registry?.set?.("playerProgress", normalized);
    saveProgress(normalized);
    return normalized;
  }

  getPersistedPartyMember(memberId) {
    if (!this.loadedProgress?.party?.members || typeof memberId !== "string") {
      return null;
    }

    return this.loadedProgress.party.members.find((member) => member.id === memberId) ?? null;
  }

  resolveInitialFriendlyUnits(friendlyUnits) {
    if (!Array.isArray(friendlyUnits)) {
      return [];
    }

    const resolved = buildBattlePartyFromEncounterTemplates(friendlyUnits);
    if (resolved.length > 0) {
      return resolved;
    }

    return friendlyUnits
      .map((template) => normalizeCharacterModel(template))
      .filter(Boolean);
  }

  resolveEncounterData(data) {
    const encounterId = typeof data.encounterId === "string" ? data.encounterId : null;
    const definition = encounterId ? getEncounterDefinition(encounterId) : null;
    const fallback = this.getDefaultEncounter();
    const persistedEnemies = getBattleEnemies();
    const enemyFallback = persistedEnemies.length > 0 ? persistedEnemies : fallback.enemyUnits;
    if (!definition) {
      return {
        ...fallback,
        enemyUnits: enemyFallback,
      };
    }

    return {
      id: definition.id,
      name: definition.name ?? fallback.name,
      triggerDescription: definition.triggerDescription ?? "",
      obstacles: Array.isArray(definition.obstacles) ? definition.obstacles : fallback.obstacles,
      friendlyUnits: Array.isArray(definition.friendlyUnits) ? definition.friendlyUnits : fallback.friendlyUnits,
      enemyUnits: Array.isArray(definition.enemyUnits) ? definition.enemyUnits : enemyFallback,
      rewards: definition.rewards ?? { xp: 0, inventory: [], storyFlags: {} },
    };
  }

  getDefaultEncounter() {
    return {
      id: "default-battle",
      name: "Prototype Battle",
      triggerDescription: "Debug/default start.",
      obstacles: [...OBSTACLES],
      friendlyUnits: [
        {
          ...createProtagonistCharacter({ currentHp: 32 }),
          spawn: { x: 2, y: 4 },
          color: 0x6aa9ff,
        },
        { ...elephantUnit, spawn: { x: 5, y: 3 }, color: 0xb5b5b5 },
        { ...cheetahUnit, spawn: { x: 1, y: 2 }, color: 0xe8c26e },
        { ...guardianDogUnit, spawn: { x: 3, y: 5 }, color: 0xc48e5a },
      ],
      enemyUnits: [
        {
          ...zookeeperDefenderDroneUnit,
          id: "enemy-zookeeper-defender-default",
          spawn: { x: 7, y: 3 },
          color: 0xc06a6a,
        },
        {
          ...zookeeperScoutDroneUnit,
          id: "enemy-zookeeper-scout-default",
          spawn: { x: 9, y: 5 },
          color: 0xde8c8c,
        },
        {
          ...zookeeperControllerDroneUnit,
          id: "enemy-zookeeper-controller-default",
          spawn: { x: 10, y: 2 },
          color: 0xa65f9a,
        },
      ],
      rewards: {
        xp: 0,
        inventory: [],
        storyFlags: {},
      },
    };
  }

  resolveEnemyXPYield(enemyUnit) {
    if (!enemyUnit || typeof enemyUnit !== "object") {
      return 0;
    }

    const explicitXP = Number(enemyUnit.xpReward ?? enemyUnit.xpYield);
    if (Number.isFinite(explicitXP)) {
      return Math.max(0, Math.floor(explicitXP));
    }

    const level = Math.max(1, Math.floor(Number(enemyUnit.level) || 1));
    const maxHp = Math.max(1, Math.floor(Number(enemyUnit.stats?.maxHp) || 1));
    const attack = Math.max(0, Math.floor(Number(enemyUnit.attack?.baseDamage) || 0));
    const defense = Math.max(0, Math.floor(Number(enemyUnit.stats?.defense) || 0));
    return Math.max(10, Math.floor(level * 20 + maxHp * 0.2 + attack * 0.6 + defense * 0.4));
  }

  resolveEncounterXPRewardTotal() {
    const rewardXP = this.encounterRewards?.xp;
    if (Number.isFinite(rewardXP)) {
      return Math.max(0, Math.floor(rewardXP));
    }
    if (rewardXP && typeof rewardXP === "object") {
      const totalXP = Number(rewardXP.totalXP);
      if (Number.isFinite(totalXP)) {
        return Math.max(0, Math.floor(totalXP));
      }
    }

    return this.units
      .filter((unit) => unit.faction === "enemy")
      .reduce((total, enemyUnit) => total + this.resolveEnemyXPYield(enemyUnit), 0);
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
      role: config.role ?? null,
      archetype: config.archetype ?? null,
      aiBehavior: config.aiBehavior ?? null,
      level: Number.isFinite(config.level) ? Math.max(1, Math.floor(config.level)) : 1,
      currentXP: Number.isFinite(config.currentXP) ? Math.max(0, Math.floor(config.currentXP)) : 0,
      xpToNextLevel: Number.isFinite(config.xpToNextLevel) ? Math.max(1, Math.floor(config.xpToNextLevel)) : 100,
      flags: { ...(config.flags ?? {}) },
      movement: { ...config.movement },
      attack: { ...config.attack },
      stats: { ...config.stats },
      abilities: Array.isArray(config.abilities) ? [...config.abilities] : [],
      tags: Array.isArray(config.tags) ? [...config.tags] : [],
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
      .text(
        12,
        32,
        "Battle input: Move cursor [WASD/Arrows], [Enter/Space] Confirm, [Esc] Cancel, tap/click tiles.",
        {
          color: "#d7dfef",
          fontFamily: "monospace",
          fontSize: "12px",
        }
      )
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

  createHudOverlay() {
    this.hudOverlay = new HUDOverlay(this, { x: 790, y: 12, width: 260, depth: UI_DEPTH + 25 });
    this.hudOverlay.create();
    this.syncHudOverlay();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyHudOverlay());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyHudOverlay());
  }

  destroyHudOverlay() {
    this.hudOverlay?.destroy();
    this.hudOverlay = null;
  }

  getActiveUnitForHud() {
    if (this.currentActingUnitId) {
      const acting = this.units.find((unit) => unit.id === this.currentActingUnitId && unit.alive);
      if (acting) {
        return acting;
      }
    }

    const selected = this.getSelectedUnit();
    if (selected) {
      return selected;
    }

    if (this.playerTurn) {
      return this.getFriendlyUnits().find((unit) => !unit.hasActed) ?? this.getFriendlyUnits()[0] ?? null;
    }

    return this.getEnemyUnits()[0] ?? null;
  }

  getPhaseLabelForHud() {
    if (this.battleResolved) {
      return "Complete";
    }
    return this.playerTurn ? "Player Turn" : "Enemy Turn";
  }

  syncHudOverlay() {
    if (!this.hudOverlay) {
      return;
    }

    const active = this.getActiveUnitForHud();
    const activeUnitLabel = active
      ? `${active.name} Lv${active.level} ${active.currentHp}/${active.stats.maxHp} HP XP ${active.currentXP}/${active.xpToNextLevel}`
      : "none";
    this.hudOverlay.setData({
      context: "BATTLE",
      primary: `Active: ${activeUnitLabel}`,
      secondary: `Phase: ${this.getPhaseLabelForHud()}`,
      tertiary: `Turn: ${this.turn}`,
    });
  }

  createCursorIndicator() {
    this.cursorIndicator = this.add
      .rectangle(0, 0, TILE_SIZE - 6, TILE_SIZE - 6, 0x6fbaff, 0.05)
      .setStrokeStyle(2, 0xa9d8ff, 0.95)
      .setDepth(12);
  }

  snapCursorToStartingTile() {
    const origin = this.getFriendlyUnits()[0];
    if (origin) {
      this.setCursorTile(origin.tileX, origin.tileY);
      return;
    }
    this.setCursorTile(0, 0);
  }

  setupInput() {
    this.inputManager = new InputManager(this, { tileSize: TILE_SIZE, autoCleanup: false });
    this.inputUnsubscribe = this.inputManager.onAction((event) => this.handleInputAction(event));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownInputManager());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownInputManager());
  }

  setupDevShortcuts() {
    const keyboard = this.input?.keyboard;
    if (!keyboard) {
      return;
    }

    const onSave = (event) => {
      event?.preventDefault?.();
      const saveGame = this.game.registry.get("saveGame");
      const saved =
        typeof saveGame === "function" ? saveGame({ currentSceneKey: this.returnSceneKey }) : saveRuntimeGame(this.game);
      this.addLog(`Saved (${saved?.party?.members?.length ?? 0} party members).`);
    };

    const onLoad = (event) => {
      event?.preventDefault?.();
      const loadGame = this.game.registry.get("loadGame");
      const loaded = typeof loadGame === "function" ? loadGame() : loadRuntimeGame(this.game);
      const { resumeSceneKey, resumeData } = resolveResumeTarget(loaded, this.returnSceneKey);
      this.addLog(`Loaded save -> ${resumeSceneKey}.`);
      this.time.delayedCall(200, () => {
        this.scene.start(resumeSceneKey, resumeData);
      });
    };

    const onInspect = () => {
      const debugState = this.game.registry.get("debugGameState");
      const snapshot = typeof debugState === "function" ? debugState() : logDebugStateSnapshot();
      console.log("[BattleScene] Debug snapshot", snapshot);
      this.addLog("Debug snapshot logged to console.");
    };

    keyboard.on("keydown-F6", onSave);
    keyboard.on("keydown-F9", onLoad);
    keyboard.on("keydown-I", onInspect);

    this.devShortcutListeners = [
      { event: "keydown-F6", handler: onSave },
      { event: "keydown-F9", handler: onLoad },
      { event: "keydown-I", handler: onInspect },
    ];

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardownDevShortcuts());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardownDevShortcuts());
  }

  teardownDevShortcuts() {
    if (!this.devShortcutListeners.length) {
      return;
    }

    const keyboard = this.input?.keyboard;
    if (keyboard) {
      this.devShortcutListeners.forEach(({ event, handler }) => {
        keyboard.off(event, handler);
      });
    }
    this.devShortcutListeners = [];
  }

  teardownInputManager() {
    if (this.inputUnsubscribe) {
      this.inputUnsubscribe();
      this.inputUnsubscribe = null;
    }
    if (this.inputManager) {
      this.inputManager.destroy();
      this.inputManager = null;
    }
  }

  handleInputAction(event) {
    if (!event) {
      return;
    }

    if (event.action === InputActions.SELECT_TILE) {
      if (!Number.isInteger(event.tileX) || !Number.isInteger(event.tileY)) {
        return;
      }
      if (!inBounds(event.tileX, event.tileY)) {
        return;
      }
      this.setCursorTile(event.tileX, event.tileY);
      if (event.type === "pressed") {
        this.handleConfirmAction({ fromPointerSelection: true });
      }
      return;
    }

    if (event.type !== "pressed") {
      return;
    }

    if (
      event.action === InputActions.MOVE_UP ||
      event.action === InputActions.MOVE_DOWN ||
      event.action === InputActions.MOVE_LEFT ||
      event.action === InputActions.MOVE_RIGHT
    ) {
      this.handleMoveAction(event.action);
      return;
    }

    if (event.action === InputActions.CONFIRM) {
      this.handleConfirmAction();
      return;
    }

    if (event.action === InputActions.CANCEL) {
      this.handleCancelAction();
    }
  }

  setCursorTile(tileX, tileY) {
    const nextX = Phaser.Math.Clamp(tileX, 0, GRID_WIDTH - 1);
    const nextY = Phaser.Math.Clamp(tileY, 0, GRID_HEIGHT - 1);
    this.cursorTile = { x: nextX, y: nextY };

    if (this.cursorIndicator) {
      this.cursorIndicator.x = nextX * TILE_SIZE + TILE_SIZE / 2;
      this.cursorIndicator.y = nextY * TILE_SIZE + TILE_SIZE / 2;
    }

    this.updateSelectionPanel();
  }

  handleMoveAction(action) {
    if (!this.playerTurn || this.battleResolved) {
      return;
    }

    if (this.mode === "command") {
      if (action === InputActions.MOVE_UP || action === InputActions.MOVE_LEFT) {
        this.adjustCommandSelection(-1);
      } else {
        this.adjustCommandSelection(1);
      }
      return;
    }

    if (action === InputActions.MOVE_UP) {
      this.setCursorTile(this.cursorTile.x, this.cursorTile.y - 1);
      return;
    }
    if (action === InputActions.MOVE_DOWN) {
      this.setCursorTile(this.cursorTile.x, this.cursorTile.y + 1);
      return;
    }
    if (action === InputActions.MOVE_LEFT) {
      this.setCursorTile(this.cursorTile.x - 1, this.cursorTile.y);
      return;
    }
    this.setCursorTile(this.cursorTile.x + 1, this.cursorTile.y);
  }

  handleConfirmAction({ fromPointerSelection = false } = {}) {
    if (!this.playerTurn || this.battleResolved) {
      return;
    }

    const selected = this.getSelectedUnit();
    const tileX = this.cursorTile.x;
    const tileY = this.cursorTile.y;
    const tileUnit = this.getUnitAt(tileX, tileY);

    if (this.mode === "move" && selected) {
      const valid = this.highlightTileData.find((tile) => tile.x === tileX && tile.y === tileY);
      if (valid) {
        this.moveUnit(selected, tileX, tileY);
      }
      return;
    }

    if (this.mode === "attack" && selected) {
      const target = this.getUnitAt(tileX, tileY);
      if (target && target.faction === "enemy" && this.canUnitAttackTarget(selected, target)) {
        this.attackTarget(selected, target);
      }
      return;
    }

    if (this.mode === "command") {
      if (tileUnit && tileUnit.faction === "friendly" && tileUnit.alive && tileUnit.id !== selected?.id) {
        this.selectUnit(tileUnit.id);
        if (!tileUnit.hasActed) {
          this.enterCommandMode();
        }
        return;
      }
      if (fromPointerSelection) {
        if (selected && this.tryContextualPointerCommand(selected, tileX, tileY)) {
          return;
        }
      }
      this.confirmCommand();
      return;
    }

    if (tileUnit && tileUnit.faction === "friendly" && tileUnit.alive) {
      this.selectUnit(tileUnit.id);
      if (!tileUnit.hasActed) {
        this.enterCommandMode();
      }
      return;
    }

    if (selected && !selected.hasActed) {
      this.enterCommandMode();
      if (fromPointerSelection && this.tryContextualPointerCommand(selected, tileX, tileY)) {
        return;
      }
      this.confirmCommand();
      return;
    }

    this.selectedUnitId = null;
    this.mode = "idle";
    this.clearHighlights();
    this.updateSelectionPanel();
  }

  tryContextualPointerCommand(selected, tileX, tileY) {
    const targetedUnit = this.getUnitAt(tileX, tileY);
    if (targetedUnit && targetedUnit.faction === "enemy" && this.canUnitAttackTarget(selected, targetedUnit)) {
      this.enterAttackMode();
      this.attackTarget(selected, targetedUnit);
      return true;
    }

    const canMoveTo = this.getReachableTiles(selected).find((tile) => tile.x === tileX && tile.y === tileY);
    if (canMoveTo) {
      this.enterMoveMode();
      this.moveUnit(selected, tileX, tileY);
      return true;
    }

    return false;
  }

  handleCancelAction() {
    if (!this.playerTurn || this.battleResolved) {
      return;
    }

    if (this.mode === "move" || this.mode === "attack") {
      this.enterCommandMode();
      return;
    }

    if (this.mode === "command") {
      this.mode = "idle";
      this.clearHighlights();
      this.updateSelectionPanel();
      return;
    }

    this.selectedUnitId = null;
    this.mode = "idle";
    this.clearHighlights();
    this.updateSelectionPanel();
  }

  getCommandOptions(unit) {
    if (!unit || unit.hasActed) {
      return [];
    }

    const options = [];
    const reachableTiles = this.getReachableTiles(unit);
    if (reachableTiles.length > 0) {
      options.push("move");
    }

    const canAttack = this.getEnemyUnits().some((enemy) => this.canUnitAttackTarget(unit, enemy));
    if (canAttack) {
      options.push("attack");
    }

    if (unit.faction === "friendly" && unit.currentHp < unit.stats.maxHp) {
      options.push("stabilize");
    }

    options.push("end-turn");
    return options.filter((option) => COMMAND_OPTIONS.includes(option));
  }

  adjustCommandSelection(delta) {
    const options = this.getCommandOptions(this.getSelectedUnit());
    if (!options.length) {
      return;
    }
    this.commandIndex = Phaser.Math.Wrap(this.commandIndex + delta, 0, options.length);
    this.updateSelectionPanel();
  }

  confirmCommand() {
    const selected = this.getSelectedUnit();
    if (!selected || selected.hasActed) {
      return;
    }
    const options = this.getCommandOptions(selected);
    if (!options.length) {
      return;
    }
    const chosen = options[this.commandIndex] ?? options[0];
    if (chosen === "move") {
      this.enterMoveMode();
      return;
    }
    if (chosen === "attack") {
      this.enterAttackMode();
      return;
    }
    if (chosen === "stabilize") {
      this.useStabilizeAction(selected);
      return;
    }
    if (chosen === "end-turn") {
      this.endPlayerTurn();
    }
  }

  useStabilizeAction(unit) {
    if (!unit || unit.hasActed || unit.currentHp >= unit.stats.maxHp) {
      return;
    }

    const healAmount = Math.max(6, Math.floor(unit.stats.maxHp * 0.16));
    const previousHp = unit.currentHp;
    unit.currentHp = Math.min(unit.stats.maxHp, unit.currentHp + healAmount);
    unit.stats.hp = unit.currentHp;
    unit.hasActed = true;
    this.mode = "idle";
    this.clearHighlights();
    this.addLog(`${unit.name} stabilized for +${unit.currentHp - previousHp} HP.`);
    if (unit.faction === "friendly") {
      setPartyMemberHealth(unit.id, {
        currentHp: unit.currentHp,
        maxHp: unit.stats.maxHp,
      });
    }
    this.updateSelectionPanel();
    this.tryAutoEndPlayerTurn();
  }

  enterCommandMode() {
    const selected = this.getSelectedUnit();
    if (!selected || selected.hasActed || !this.playerTurn) {
      this.mode = "idle";
      this.clearHighlights();
      this.updateSelectionPanel();
      return;
    }

    this.mode = "command";
    this.clearHighlights();
    const options = this.getCommandOptions(selected);
    this.commandIndex = Phaser.Math.Clamp(this.commandIndex, 0, Math.max(0, options.length - 1));
    this.updateSelectionPanel();
  }

  selectUnit(unitId) {
    this.selectedUnitId = unitId;
    const selected = this.getSelectedUnit();
    this.mode = selected && !selected.hasActed ? "command" : "idle";
    if (selected) {
      this.setCursorTile(selected.tileX, selected.tileY);
    }
    this.commandIndex = 0;
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
    const reachableTiles = this.getReachableTiles(unit);
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
    const targetableTiles = getTargetableTiles({
      unit,
      width: GRID_WIDTH,
      height: GRID_HEIGHT,
      isObstacleAt: (x, y) => this.obstacleSet.has(keyFor(x, y)),
    });
    this.showHighlights(targetableTiles, 0xe46f6f, 0.3);

    const enemyTargets = this.getEnemyUnits()
      .filter((enemy) => this.canUnitAttackTarget(unit, enemy))
      .map((enemy) => ({ x: enemy.tileX, y: enemy.tileY }));
    this.appendHighlights(enemyTargets, 0xff7f7f, 0.45);
    this.highlightTileData = enemyTargets;
    this.updateSelectionPanel();
  }

  clearHighlights() {
    this.tileHighlights.forEach((highlight) => highlight.destroy());
    this.tileHighlights = [];
    this.highlightTileData = [];
  }

  showHighlights(tiles, color, alpha) {
    this.clearHighlights();
    this.appendHighlights(tiles, color, alpha);
  }

  appendHighlights(tiles, color, alpha) {
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

  getReachableTiles(unit) {
    const moveRange = getUnitMovementRange(unit);
    return getReachableTiles({
      start: { x: unit.tileX, y: unit.tileY },
      moveRange,
      inBounds,
      isObstacleAt: (x, y) => this.obstacleSet.has(keyFor(x, y)),
      isOccupied: (x, y) => {
        const occupant = this.getUnitAt(x, y);
        return occupant && occupant.id !== unit.id;
      },
    }).map(({ x, y }) => ({ x, y }));
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

  canUnitAttackTarget(attacker, defender) {
    return canUnitTarget(attacker, defender, {
      isObstacleAt: (x, y) => this.obstacleSet.has(keyFor(x, y)),
    });
  }

  attackTarget(attacker, defender) {
    if (this.battleResolved) {
      return;
    }

    const result = resolveAttack({
      attacker,
      defender,
      protagonist: this.protagonist,
    });

    defender.currentHp = Math.max(0, defender.currentHp - result.damage);
    defender.stats.hp = defender.currentHp;
    if (defender.faction === "friendly") {
      setPartyMemberHealth(defender.id, {
        currentHp: defender.currentHp,
        maxHp: defender.stats.maxHp,
      });
    }
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

    if (this.evaluateBattleOutcome()) {
      return;
    }

    this.refreshDogBuffVisuals();
    this.updateSelectionPanel();
    this.tryAutoEndPlayerTurn();
  }

  tryAutoEndPlayerTurn() {
    if (this.battleResolved) {
      return;
    }
    const waiting = this.getFriendlyUnits().filter((unit) => unit.id !== this.protagonist.id);
    const allActed = waiting.every((unit) => unit.hasActed);
    if (allActed) {
      this.endPlayerTurn();
    }
  }

  endPlayerTurn() {
    if (!this.playerTurn || this.battleResolved) {
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
    if (this.battleResolved) {
      return;
    }

    const enemies = this.getEnemyUnits();
    for (const enemy of enemies) {
      if (this.battleResolved) {
        return;
      }
      this.currentActingUnitId = enemy.id;
      this.syncHudOverlay();

      const isObstacleAt = (x, y) => this.obstacleSet.has(keyFor(x, y));
      const isOccupied = (x, y) => {
        const occupant = this.getUnitAt(x, y);
        return occupant && occupant.id !== enemy.id;
      };
      const friendly = this.getFriendlyUnits();
      const decision = decideDroneAction({
        drone: enemy,
        playerUnits: friendly,
        inBounds,
        isObstacleAt,
        isOccupied,
      });

      if (decision.action === "attack" && decision.targetId) {
        const target = friendly.find((unit) => unit.id === decision.targetId) ?? null;
        if (target && this.canUnitAttackTarget(enemy, target)) {
          this.attackTarget(enemy, target);
          continue;
        }
      }

      if (decision.action === "move" && decision.destination) {
        enemy.tileX = decision.destination.x;
        enemy.tileY = decision.destination.y;
        enemy.sprite.x = decision.destination.x * TILE_SIZE + TILE_SIZE / 2;
        enemy.sprite.y = decision.destination.y * TILE_SIZE + TILE_SIZE / 2;
        enemy.buffIcon.x = enemy.sprite.x - 12;
        enemy.buffIcon.y = enemy.sprite.y - 24;
        enemy.hasActed = true;
        this.addLog(`${enemy.name} advanced to (${decision.destination.x}, ${decision.destination.y}).`);
        this.syncHudOverlay();
        continue;
      }

      enemy.hasActed = true;
      this.addLog(`${enemy.name} is holding position.`);
    }

    if (this.evaluateBattleOutcome()) {
      return;
    }

    this.currentActingUnitId = null;
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
    this.syncHudOverlay();
  }

  evaluateBattleOutcome() {
    if (this.battleResolved) {
      return true;
    }

    const enemiesRemaining = this.getEnemyUnits().length;
    if (enemiesRemaining === 0) {
      this.finishBattle("victory");
      return true;
    }

    const friendliesRemaining = this.getFriendlyUnits().length;
    if (friendliesRemaining === 0) {
      this.finishBattle("defeat");
      return true;
    }

    return false;
  }

  finishBattle(result) {
    if (this.battleResolved) {
      return;
    }
    setBattleEnemies([]);

    this.battleResolved = true;
    this.playerTurn = false;
    this.mode = "idle";
    this.clearHighlights();
    this.currentActingUnitId = null;

    const completionLabel = result === "victory" ? "Victory" : "Defeat";
    this.addLog(`${completionLabel}. Returning...`);
    this.updateTurnHeader();
    this.updateSelectionPanel();
    this.syncHudOverlay();
    this.persistBattleProgress(result);

    this.time.delayedCall(450, () => {
      this.scene.start(this.returnSceneKey, {
        ...this.returnSceneData,
        battleResult: result,
        lastEncounterId: this.encounterId,
      });
    });
  }

  persistBattleProgress(result) {
    this.logPartyProgressSnapshot("pre-battle-result");

    this.units
      .filter((unit) => unit.faction === "friendly")
      .forEach((unit) => {
        setPartyMemberHealth(unit.id, {
          currentHp: unit.currentHp,
          maxHp: unit.stats.maxHp,
        });
      });

    const keyBattleFlag = resolveKeyBattleOutcomeFlagForEncounter(this.encounterId);
    if (keyBattleFlag && result === "victory") {
      setStoryFlag(keyBattleFlag, true);
    }
    if (result === "victory") {
      const survivingFriendlyIds = this.units
        .filter((unit) => unit.faction === "friendly" && unit.alive && unit.currentHp > 0)
        .map((unit) => unit.id);
      const totalXPReward = this.resolveEncounterXPRewardTotal();
      if (survivingFriendlyIds.length > 0 && totalXPReward > 0) {
        const xpAwards = awardPartyXP(survivingFriendlyIds, totalXPReward).awards ?? [];
        if (xpAwards.length > 0) {
          this.addLog(`Party gained ${totalXPReward} XP.`);
          xpAwards.forEach((award) => {
            if (!award || award.levelsGained <= 0 || !award.character) {
              return;
            }
            this.addLog(`${award.character.name} reached Lv ${award.character.level}.`);
          });
          this.logPartyProgressSnapshot("post-xp-award", xpAwards);
        }
      }

      this.encounterRewards.inventory.forEach((reward) => {
        if (!reward || typeof reward.itemId !== "string") {
          return;
        }
        const amount = Math.max(1, Math.floor(Number(reward.amount) || 1));
        addInventoryItem(reward.itemId, amount);
      });
      if (this.encounterRewards.storyFlags && typeof this.encounterRewards.storyFlags === "object") {
        setStoryFlags(this.encounterRewards.storyFlags);
      }
    }

    this.commitProgress((current) => {
      let next = exportGameStateToPlayerProgress(current);

      next = recordBattleOutcome(next, this.encounterId, {
        result,
        recordedAt: new Date().toISOString(),
      });

      return updateOverworldPosition(next, next?.overworld?.position, {
        currentSceneKey: this.returnSceneKey,
      });
    });

    if (result !== "victory") {
      this.logPartyProgressSnapshot("post-battle-result");
    }
  }

  logPartyProgressSnapshot(stage, xpAwards = []) {
    const snapshot = getGameState();
    const party = Array.isArray(snapshot.party?.members) ? snapshot.party.members : [];
    const friendlyPartyById = new Map(party.map((member) => [member.id, member]));
    const battleFriendlies = this.units.filter((unit) => unit.faction === "friendly");
    const summary = battleFriendlies.map((unit) => {
      const persisted = friendlyPartyById.get(unit.id);
      const level = persisted?.level ?? unit.level ?? 1;
      const currentXP = persisted?.currentXP ?? unit.currentXP ?? 0;
      const xpToNextLevel = persisted?.xpToNextLevel ?? unit.xpToNextLevel ?? 100;
      const currentHp = persisted?.currentHp ?? unit.currentHp;
      const maxHp = persisted?.maxHp ?? unit.stats?.maxHp;
      const isDrone = persisted?.flags?.isDrone === true || unit.flags?.isDrone === true;

      return `${unit.id}(Lv${level} XP ${currentXP}/${xpToNextLevel} HP ${currentHp}/${maxHp}${isDrone ? " DRONE(non-persistent-xp)" : ""})`;
    });

    const awardSummary = xpAwards
      .map((award) => `${award?.memberId ?? "unknown"}:+${award?.awardedXP ?? 0}xp`)
      .join(", ");
    const line = `[Progression ${stage}] ${summary.join(" | ")}${awardSummary ? ` | awards ${awardSummary}` : ""}`;
    this.addLog(line);
    console.log("[BattleScene] Progression snapshot", {
      stage,
      encounterId: this.encounterId,
      party: summary,
      awards: xpAwards.map((award) => ({
        memberId: award?.memberId,
        awardedXP: award?.awardedXP,
        levelsGained: award?.levelsGained,
        isDrone: award?.character?.flags?.isDrone === true,
      })),
    });
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
    const phase = this.battleResolved ? "Complete" : this.playerTurn ? "Player Phase" : "Enemy Phase";
    this.turnHeaderText.setText(`${this.encounterName} | Turn ${this.turn} | ${phase}`);
  }

  updateSelectionPanel() {
    this.updateTurnHeader();
    const selected = this.getSelectedUnit();
    const cursorLine = `Cursor: (${this.cursorTile.x}, ${this.cursorTile.y})`;
    if (!selected) {
      this.selectionPanelText.setText(`Selected: none\n${cursorLine}`);
      this.actionMenuText.setText("Action menu: move cursor to a friendly unit and press confirm.");
      this.syncHudOverlay();
      return;
    }

    const effective = getEffectiveCombatStats(selected, { protagonist: this.protagonist });
    const hpLine = `HP ${selected.currentHp}/${selected.stats.maxHp}`;
    const progressionLine = `LV ${selected.level} | XP ${selected.currentXP}/${selected.xpToNextLevel}`;
    const coreLine = `Move ${selected.movement.tilesPerTurn} | Range ${selected.attack.range} | DMG ${effective.damage} | DEF ${effective.defense}`;

    let abilityLine = "Ability: -";
    if (selected.archetype === "elephant") {
      abilityLine = "Ability: Trampling Arc (Can shoot over obstacles)";
    } else if (selected.archetype === "cheetah") {
      abilityLine = "Ability: Predator Sprint (High mobility)";
    } else if (selected.archetype === "dog") {
      abilityLine = `Ability: Loyal Fury (${selected.buffActive ? "ACTIVE" : "inactive"})`;
    }

    this.selectionPanelText.setText(
      `Selected: ${selected.name}\n${hpLine}\n${progressionLine}\n${coreLine}\n${abilityLine}\n${cursorLine}`
    );

    const modeLabel = this.mode === "idle" ? "idle" : this.mode;
    const commandOptions = this.getCommandOptions(selected);
    const commandLine =
      this.mode === "command"
        ? commandOptions
            .map((option, index) => (index === this.commandIndex ? `[${option}]` : option))
            .join(" | ")
        : commandOptions.join(" | ");
    const actionLines = [`Mode: ${modeLabel}`];
    if (commandOptions.length > 0) {
      actionLines.push(`Commands: ${commandLine}`);
    }
    actionLines.push("Controls: Move cursor (WASD/Arrows), Confirm (Enter/Space), Cancel (Esc)");
    if (selected.archetype === "elephant") {
      actionLines.push("Trait: Attack targeting ignores obstacle blocking.");
    }
    if (selected.archetype === "dog" && selected.buffActive) {
      actionLines.push("Buff: Loyal Fury active (danger-triggered).");
    }
    this.actionMenuText.setText(actionLines.join("\n"));
    this.syncHudOverlay();
  }
}

export default BattleScene;
