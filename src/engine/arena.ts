import {
  Action,
  ArenaState,
  MatchOutcome,
  MatchResult,
  PlayerState,
  ResolvedAction,
  RoundLog,
} from "./types";
import {
  ALLOWED_ACTIONS,
  ACTION_RULES,
  BLOCK_DAMAGE_REDUCTION,
  BLOCKED_HEAVY_ATTACK_STAMINA_PENALTY,
  GUARD_BREAK_BONUS_DAMAGE,
  GUARD_BREAK_STAMINA_BREAK,
  MAX_ROUNDS,
  MAX_STAMINA,
  RESTING_DAMAGE_BONUS,
  STARTING_HP,
  STARTING_STAMINA,
  clampPosition,
  canAffordAction,
  getActionRule,
  isAttack,
  isInRange,
} from "./rules";

function createPlayer(id: string, name: string): PlayerState {
  return {
    id,
    name,
    hp: STARTING_HP,
    stamina: STARTING_STAMINA,
    position: 0,
    lastAction: null,
  };
}

export function createInitialArenaState(
  player1Name: string,
  player2Name: string
): ArenaState {
  const player1 = createPlayer("player1", player1Name);
  const player2 = createPlayer("player2", player2Name);

  return {
    round: 1,
    maxRounds: MAX_ROUNDS,
    status: "ongoing",
    player1,
    player2,
    distance: Math.abs(player1.position - player2.position),
    allowedActions: ALLOWED_ACTIONS,
    roundHistory: [],
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return { ...player };
}

function resolveAffordableAction(
  player: PlayerState,
  chosenAction: Action
): { effectiveAction: Action; notes: string[] } {
  const notes: string[] = [];

  if (!canAffordAction(chosenAction, player.stamina)) {
    notes.push(`Not enough stamina for ${chosenAction}; fallback to rest applied.`);
    return { effectiveAction: "rest", notes };
  }

  return { effectiveAction: chosenAction, notes };
}

function applyMovement(player: PlayerState, action: Action): void {
  const movement = ACTION_RULES[action].movement;
  player.position = clampPosition(player.position + movement);
}

function calculateRawDamage(attackerAction: Action): number {
  return getActionRule(attackerAction).baseDamage;
}

function calculateDamageTaken(params: {
  attackerAction: Action;
  defenderAction: Action;
  attackerPosition: number;
}): {
  damage: number;
  wasBlocked: boolean;
  wasMissed: boolean;
  brokeGuard: boolean;
  notes: string[];
} {
  const { attackerAction, defenderAction, attackerPosition } = params;
  const notes: string[] = [];

  if (!isAttack(attackerAction)) {
    return {
      damage: 0,
      wasBlocked: false,
      wasMissed: false,
      brokeGuard: false,
      notes,
    };
  }

  if (!isInRange(attackerPosition)) {
    notes.push(`${attackerAction} missed because attacker was out of range.`);
    return {
      damage: 0,
      wasBlocked: false,
      wasMissed: true,
      brokeGuard: false,
      notes,
    };
  }

  const rawDamage = calculateRawDamage(attackerAction);

  if (attackerAction === "guard_break") {
    if (defenderAction === "block") {
      const damage = rawDamage + GUARD_BREAK_BONUS_DAMAGE;
      notes.push(
        `guard_break punished block for ${damage} damage and will apply stamina break.`
      );
      return {
        damage,
        wasBlocked: false,
        wasMissed: false,
        brokeGuard: true,
        notes,
      };
    }

    notes.push(`guard_break connected without finding a block to punish.`);
    return {
      damage: rawDamage,
      wasBlocked: false,
      wasMissed: false,
      brokeGuard: false,
      notes,
    };
  }

  if (defenderAction === "block") {
    const reducedDamage = Math.round(rawDamage * (1 - BLOCK_DAMAGE_REDUCTION));
    notes.push(`${attackerAction} was partially blocked.`);
    return {
      damage: reducedDamage,
      wasBlocked: true,
      wasMissed: false,
      brokeGuard: false,
      notes,
    };
  }

  return {
    damage: rawDamage,
    wasBlocked: false,
    wasMissed: false,
    brokeGuard: false,
    notes,
  };
}

function spendAndRecoverStamina(player: PlayerState, action: Action): {
  staminaBefore: number;
  staminaAfter: number;
} {
  const staminaBefore = player.stamina;
  const rule = getActionRule(action);

  let nextStamina = player.stamina - rule.staminaCost + rule.staminaGain;
  nextStamina = Math.max(0, Math.min(MAX_STAMINA, nextStamina));

  player.stamina = nextStamina;

  return {
    staminaBefore,
    staminaAfter: player.stamina,
  };
}

function applyBlockedHeavyAttackPenalty(params: {
  attacker: PlayerState;
  attackerAction: Action;
  wasBlocked: boolean;
  notes: string[];
}): void {
  const { attacker, attackerAction, wasBlocked, notes } = params;

  if (attackerAction === "heavy_attack" && wasBlocked) {
    attacker.stamina = Math.max(
      0,
      attacker.stamina - BLOCKED_HEAVY_ATTACK_STAMINA_PENALTY
    );
    notes.push(
      `Blocked heavy attack caused an extra ${BLOCKED_HEAVY_ATTACK_STAMINA_PENALTY} stamina penalty.`
    );
  }
}

function applyGuardBreakStaminaBreak(params: {
  defender: PlayerState;
  attackerAction: Action;
  defenderAction: Action;
  brokeGuard: boolean;
  notes: string[];
}): void {
  const { defender, attackerAction, defenderAction, brokeGuard, notes } = params;

  if (
    attackerAction === "guard_break" &&
    defenderAction === "block" &&
    brokeGuard
  ) {
    defender.stamina = Math.max(0, defender.stamina - GUARD_BREAK_STAMINA_BREAK);
    notes.push(
      `Guard was broken for an extra ${GUARD_BREAK_STAMINA_BREAK} stamina loss.`
    );
  }
}

function applyRestingDamageBonus(params: {
  defenderAction: Action;
  incomingDamage: number;
  notes: string[];
}): number {
  const { defenderAction, incomingDamage, notes } = params;

  if (defenderAction === "rest" && incomingDamage > 0) {
    notes.push(
      `Resting target took +${RESTING_DAMAGE_BONUS} bonus damage due to vulnerability.`
    );
    return incomingDamage + RESTING_DAMAGE_BONUS;
  }

  return incomingDamage;
}

function buildResolvedAction(params: {
  player: PlayerState;
  chosenAction: Action;
  effectiveAction: Action;
  staminaBefore: number;
  staminaAfter: number;
  damageDealt: number;
  damageTaken: number;
  wasBlocked: boolean;
  wasMissed: boolean;
  notes: string[];
}): ResolvedAction {
  return {
    playerId: params.player.id,
    chosenAction: params.chosenAction,
    effectiveAction: params.effectiveAction,
    staminaBefore: params.staminaBefore,
    staminaAfter: params.staminaAfter,
    damageDealt: params.damageDealt,
    damageTaken: params.damageTaken,
    wasBlocked: params.wasBlocked,
    wasMissed: params.wasMissed,
    notes: params.notes,
  };
}

function determineOutcome(state: ArenaState): {
  outcome: MatchOutcome;
  winnerId: string | null;
} {
  if (state.player1.hp <= 0 && state.player2.hp <= 0) {
    return { outcome: "draw", winnerId: null };
  }

  if (state.player1.hp <= 0) {
    return { outcome: "player2_win", winnerId: state.player2.id };
  }

  if (state.player2.hp <= 0) {
    return { outcome: "player1_win", winnerId: state.player1.id };
  }

  if (state.round > state.maxRounds) {
    if (state.player1.hp > state.player2.hp) {
      return { outcome: "player1_win", winnerId: state.player1.id };
    }
    if (state.player2.hp > state.player1.hp) {
      return { outcome: "player2_win", winnerId: state.player2.id };
    }
    return { outcome: "draw", winnerId: null };
  }

  return { outcome: "draw", winnerId: null };
}

export function isMatchFinished(state: ArenaState): boolean {
  if (state.player1.hp <= 0 || state.player2.hp <= 0) {
    return true;
  }

  if (state.round > state.maxRounds) {
    return true;
  }

  return false;
}

export function resolveRound(
  currentState: ArenaState,
  player1Action: Action,
  player2Action: Action
): { nextState: ArenaState; roundLog: RoundLog } {
  const nextPlayer1 = clonePlayer(currentState.player1);
  const nextPlayer2 = clonePlayer(currentState.player2);

  const p1Resolution = resolveAffordableAction(nextPlayer1, player1Action);
  const p2Resolution = resolveAffordableAction(nextPlayer2, player2Action);

  const p1EffectiveAction = p1Resolution.effectiveAction;
  const p2EffectiveAction = p2Resolution.effectiveAction;

  const p1Stamina = spendAndRecoverStamina(nextPlayer1, p1EffectiveAction);
  const p2Stamina = spendAndRecoverStamina(nextPlayer2, p2EffectiveAction);

  applyMovement(nextPlayer1, p1EffectiveAction);
  applyMovement(nextPlayer2, p2EffectiveAction);

  const p1AttackResult = calculateDamageTaken({
    attackerAction: p1EffectiveAction,
    defenderAction: p2EffectiveAction,
    attackerPosition: nextPlayer1.position,
  });

  const p2AttackResult = calculateDamageTaken({
    attackerAction: p2EffectiveAction,
    defenderAction: p1EffectiveAction,
    attackerPosition: nextPlayer2.position,
  });

  const damageToPlayer2 = applyRestingDamageBonus({
    defenderAction: p2EffectiveAction,
    incomingDamage: p1AttackResult.damage,
    notes: p1AttackResult.notes,
  });

  const damageToPlayer1 = applyRestingDamageBonus({
    defenderAction: p1EffectiveAction,
    incomingDamage: p2AttackResult.damage,
    notes: p2AttackResult.notes,
  });

  nextPlayer1.hp = Math.max(0, nextPlayer1.hp - damageToPlayer1);
  nextPlayer2.hp = Math.max(0, nextPlayer2.hp - damageToPlayer2);

  applyBlockedHeavyAttackPenalty({
    attacker: nextPlayer1,
    attackerAction: p1EffectiveAction,
    wasBlocked: p1AttackResult.wasBlocked,
    notes: p1AttackResult.notes,
  });

  applyBlockedHeavyAttackPenalty({
    attacker: nextPlayer2,
    attackerAction: p2EffectiveAction,
    wasBlocked: p2AttackResult.wasBlocked,
    notes: p2AttackResult.notes,
  });

  applyGuardBreakStaminaBreak({
    defender: nextPlayer2,
    attackerAction: p1EffectiveAction,
    defenderAction: p2EffectiveAction,
    brokeGuard: p1AttackResult.brokeGuard,
    notes: p1AttackResult.notes,
  });

  applyGuardBreakStaminaBreak({
    defender: nextPlayer1,
    attackerAction: p2EffectiveAction,
    defenderAction: p1EffectiveAction,
    brokeGuard: p2AttackResult.brokeGuard,
    notes: p2AttackResult.notes,
  });

  nextPlayer1.lastAction = p1EffectiveAction;
  nextPlayer2.lastAction = p2EffectiveAction;

  const distance = Math.abs(nextPlayer1.position - nextPlayer2.position);

  const player1Resolved = buildResolvedAction({
    player: nextPlayer1,
    chosenAction: player1Action,
    effectiveAction: p1EffectiveAction,
    staminaBefore: p1Stamina.staminaBefore,
    staminaAfter: nextPlayer1.stamina,
    damageDealt: damageToPlayer2,
    damageTaken: damageToPlayer1,
    wasBlocked: p1AttackResult.wasBlocked,
    wasMissed: p1AttackResult.wasMissed,
    notes: [...p1Resolution.notes, ...p1AttackResult.notes],
  });

  const player2Resolved = buildResolvedAction({
    player: nextPlayer2,
    chosenAction: player2Action,
    effectiveAction: p2EffectiveAction,
    staminaBefore: p2Stamina.staminaBefore,
    staminaAfter: nextPlayer2.stamina,
    damageDealt: damageToPlayer1,
    damageTaken: damageToPlayer2,
    wasBlocked: p2AttackResult.wasBlocked,
    wasMissed: p2AttackResult.wasMissed,
    notes: [...p2Resolution.notes, ...p2AttackResult.notes],
  });

  const roundLog: RoundLog = {
    round: currentState.round,
    player1Action,
    player2Action,
    player1Resolved,
    player2Resolved,
    player1HpAfter: nextPlayer1.hp,
    player2HpAfter: nextPlayer2.hp,
    player1StaminaAfter: nextPlayer1.stamina,
    player2StaminaAfter: nextPlayer2.stamina,
    distanceAfter: distance,
    summary: `${nextPlayer1.name} used ${p1EffectiveAction}, ${nextPlayer2.name} used ${p2EffectiveAction}.`,
  };

  const nextState: ArenaState = {
    round: currentState.round + 1,
    maxRounds: currentState.maxRounds,
    status: "ongoing",
    player1: nextPlayer1,
    player2: nextPlayer2,
    distance,
    allowedActions: ALLOWED_ACTIONS,
    roundHistory: [...currentState.roundHistory, roundLog],
  };

  if (isMatchFinished(nextState)) {
    nextState.status = "finished";
  }

  return { nextState, roundLog };
}

export function buildMatchResult(params: {
  matchId: string;
  finalState: ArenaState;
  rounds: RoundLog[];
}): MatchResult {
  const { finalState, matchId, rounds } = params;
  const { outcome, winnerId } = determineOutcome(finalState);

  return {
    matchId,
    status: "finished",
    outcome,
    winnerId,
    totalRounds: rounds.length,
    finalState,
    rounds,
  };
}
