const DEFAULT_DAMAGE_FLOOR = 1;
const DEFENSE_DAMAGE_SCALE = 0.5;

function normalizeNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function getUnitHpRatio(unit) {
  const hp = normalizeNumber(unit?.currentHp, normalizeNumber(unit?.stats?.hp));
  const maxHp = normalizeNumber(unit?.stats?.maxHp);

  if (maxHp <= 0) {
    return 1;
  }

  return hp / maxHp;
}

function evaluateLowHpTrigger(unit, trigger = {}) {
  const thresholdPercent = normalizeNumber(trigger.thresholdPercent, 35);
  const comparator = trigger.comparator ?? "lte";
  const hpPercent = getUnitHpRatio(unit) * 100;

  if (comparator === "lt") {
    return hpPercent < thresholdPercent;
  }

  return hpPercent <= thresholdPercent;
}

function getLoyalFuryAbility(unit) {
  if (unit?.archetype !== "dog") {
    return null;
  }

  return (
    unit?.abilities?.find(
      (ability) =>
        ability?.type === "conditional_passive" &&
        ability?.trigger?.source === "protagonist" &&
        ability?.trigger?.condition === "low_hp"
    ) ?? null
  );
}

export function isDogDangerBuffActive(unit, protagonist) {
  const ability = getLoyalFuryAbility(unit);
  if (!ability) {
    return false;
  }

  return evaluateLowHpTrigger(protagonist, ability.trigger);
}

export function getEffectiveCombatStats(unit, { protagonist } = {}) {
  const baseDamage = normalizeNumber(unit?.attack?.baseDamage);
  const baseDefense = normalizeNumber(unit?.stats?.defense);

  const stats = {
    damage: baseDamage,
    defense: baseDefense,
    buffActive: false,
    sourceAbilityId: null,
  };

  const ability = getLoyalFuryAbility(unit);
  if (!ability || !evaluateLowHpTrigger(protagonist, ability.trigger)) {
    return stats;
  }

  const effectValue = ability?.effect?.value;
  const attackMultiplier = normalizeNumber(
    effectValue?.attackMultiplier,
    normalizeNumber(effectValue, 1)
  );
  const defenseMultiplier = normalizeNumber(effectValue?.defenseMultiplier, 1);

  stats.damage = Math.round(baseDamage * attackMultiplier);
  stats.defense = Math.round(baseDefense * defenseMultiplier);
  stats.buffActive = true;
  stats.sourceAbilityId = ability.id ?? null;

  return stats;
}

export function resolveAttack({ attacker, defender, protagonist } = {}) {
  if (!attacker || !defender) {
    throw new Error("resolveAttack requires both attacker and defender units.");
  }

  const attackerStats = getEffectiveCombatStats(attacker, { protagonist });
  const defenderStats = getEffectiveCombatStats(defender, { protagonist });

  const mitigatedDamage = attackerStats.damage - defenderStats.defense * DEFENSE_DAMAGE_SCALE;
  const damage = Math.max(DEFAULT_DAMAGE_FLOOR, Math.round(mitigatedDamage));

  return {
    attackerId: attacker.id,
    defenderId: defender.id,
    damage,
    attackerStats,
    defenderStats,
  };
}

export function shouldPrioritizeAggression(unit, protagonist) {
  return isDogDangerBuffActive(unit, protagonist);
}
