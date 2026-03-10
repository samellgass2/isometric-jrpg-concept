import { shouldPrioritizeAggression } from "../combatResolver.js";

function normalizeTargetScore(enemy) {
  const hp = Number.isFinite(enemy?.currentHp)
    ? enemy.currentHp
    : Number.isFinite(enemy?.stats?.hp)
      ? enemy.stats.hp
      : 1;
  const attackPower = Number.isFinite(enemy?.attack?.baseDamage) ? enemy.attack.baseDamage : 0;

  // Lower HP and higher threat should rise to the top for focused takedowns.
  return attackPower * 2 - hp;
}

function pickAggressiveTarget(enemies = []) {
  if (!Array.isArray(enemies) || enemies.length === 0) {
    return null;
  }

  const sorted = [...enemies].sort((left, right) => normalizeTargetScore(right) - normalizeTargetScore(left));
  return sorted[0];
}

function pickDefaultTarget(enemies = []) {
  if (!Array.isArray(enemies) || enemies.length === 0) {
    return null;
  }
  return enemies[0];
}

export function chooseAllyAction({ unit, enemies = [], protagonist } = {}) {
  if (!unit) {
    throw new Error("chooseAllyAction requires a unit.");
  }

  const aggressive = shouldPrioritizeAggression(unit, protagonist);
  const target = aggressive ? pickAggressiveTarget(enemies) : pickDefaultTarget(enemies);

  if (!target) {
    return {
      actorId: unit.id,
      action: "wait",
      stance: aggressive ? "aggressive" : "standard",
      reason: "No enemies available.",
    };
  }

  if (aggressive) {
    return {
      actorId: unit.id,
      action: "attack",
      stance: "aggressive",
      targetId: target.id,
      reason: "Dog danger-state buff active; forcing offensive pressure.",
    };
  }

  return {
    actorId: unit.id,
    action: "attack",
    stance: "standard",
    targetId: target.id,
    reason: "Default ally attack behavior.",
  };
}
