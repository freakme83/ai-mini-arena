import { EXHAUSTION_STAMINA_THRESHOLD } from "../engine/rules";
import {
  Action,
  ArenaState,
  ModelInput,
  PerspectiveRoundSummary,
  RoundLog,
} from "../engine/types";

export type SeatPerspective = "player1" | "player2";

const LOW_HP_THRESHOLD = 30;
const LOW_STAMINA_THRESHOLD = 8;
const HISTORY_WINDOW = 5;
const LAST_ACTIONS_WINDOW = 3;

function isAggressiveAction(action: Action): boolean {
  return (
    action === "light_attack" ||
    action === "heavy_attack" ||
    action === "poke" ||
    action === "dash_forward"
  );
}

function isDefensiveAction(action: Action): boolean {
  return (
    action === "block" ||
    action === "retreat_guard" ||
    action === "dash_back" ||
    action === "rest"
  );
}

function isGuardingAction(action: Action): boolean {
  return action === "block" || action === "retreat_guard";
}

function countTrailing<T>(items: T[], predicate: (item: T) => boolean): number {
  let count = 0;

  for (let i = items.length - 1; i >= 0; i--) {
    if (!predicate(items[i])) {
      break;
    }
    count += 1;
  }

  return count;
}

function toPerspectiveRound(
  roundLog: RoundLog,
  perspective: SeatPerspective
): PerspectiveRoundSummary {
  if (perspective === "player1") {
    return {
      round: roundLog.round,
      selfAction: roundLog.player1Resolved.effectiveAction,
      opponentAction: roundLog.player2Resolved.effectiveAction,
      selfDamageDealt: roundLog.player1Resolved.damageDealt,
      selfDamageTaken: roundLog.player1Resolved.damageTaken,
      opponentDamageDealt: roundLog.player2Resolved.damageDealt,
      opponentDamageTaken: roundLog.player2Resolved.damageTaken,
      selfHpAfter: roundLog.player1HpAfter,
      opponentHpAfter: roundLog.player2HpAfter,
      selfStaminaAfter: roundLog.player1StaminaAfter,
      opponentStaminaAfter: roundLog.player2StaminaAfter,
      distanceAfter: roundLog.distanceAfter,
    };
  }

  return {
    round: roundLog.round,
    selfAction: roundLog.player2Resolved.effectiveAction,
    opponentAction: roundLog.player1Resolved.effectiveAction,
    selfDamageDealt: roundLog.player2Resolved.damageDealt,
    selfDamageTaken: roundLog.player2Resolved.damageTaken,
    opponentDamageDealt: roundLog.player1Resolved.damageDealt,
    opponentDamageTaken: roundLog.player1Resolved.damageTaken,
    selfHpAfter: roundLog.player2HpAfter,
    opponentHpAfter: roundLog.player1HpAfter,
    selfStaminaAfter: roundLog.player2StaminaAfter,
    opponentStaminaAfter: roundLog.player1StaminaAfter,
    distanceAfter: roundLog.distanceAfter,
  };
}

function getLastActions(actions: Action[]): Action[] {
  return [...actions].slice(-LAST_ACTIONS_WINDOW).reverse();
}

export function buildModelInput(
  state: ArenaState,
  perspective: SeatPerspective
): ModelInput {
  const self = perspective === "player1" ? state.player1 : state.player2;
  const opponent = perspective === "player1" ? state.player2 : state.player1;

  const recentRounds = state.roundHistory
    .slice(-HISTORY_WINDOW)
    .map((roundLog) => toPerspectiveRound(roundLog, perspective));

  const selfRecentActions = recentRounds.map((round) => round.selfAction);
  const opponentRecentActions = recentRounds.map((round) => round.opponentAction);

  const selfLastActions = getLastActions(selfRecentActions);
  const opponentLastActions = getLastActions(opponentRecentActions);

  const inCloseRange = state.distance <= 1;
  const inMidRange = state.distance === 2;
  const inFarRange = state.distance >= 3;

  return {
    self: {
      id: self.id,
      name: self.name,
      hp: self.hp,
      stamina: self.stamina,
      position: self.position,
      lastAction: self.lastAction,
    },
    opponent: {
      id: opponent.id,
      name: opponent.name,
      hp: opponent.hp,
      stamina: opponent.stamina,
      position: opponent.position,
      lastAction: opponent.lastAction,
    },
    round: state.round,
    maxRounds: state.maxRounds,
    distance: state.distance,
    allowedActions: state.allowedActions,
    context: {
      inRange: inCloseRange,
      inCloseRange,
      inMidRange,
      inFarRange,
      selfLowHp: self.hp <= LOW_HP_THRESHOLD,
      opponentLowHp: opponent.hp <= LOW_HP_THRESHOLD,
      selfLowStamina: self.stamina <= LOW_STAMINA_THRESHOLD,
      opponentLowStamina: opponent.stamina <= LOW_STAMINA_THRESHOLD,
      selfExhausted: self.stamina <= EXHAUSTION_STAMINA_THRESHOLD,
      opponentExhausted: opponent.stamina <= EXHAUSTION_STAMINA_THRESHOLD,
      opponentResting: opponent.lastAction === "rest",
      opponentBlocking:
        opponent.lastAction === "block" || opponent.lastAction === "retreat_guard",
      opponentGuardingPattern:
        opponentLastActions.length >= 2 &&
        opponentLastActions[0] !== undefined &&
        opponentLastActions[1] !== undefined &&
        isGuardingAction(opponentLastActions[0]) &&
        isGuardingAction(opponentLastActions[1]),
      opponentRestingPattern:
        opponentLastActions.length >= 2 &&
        opponentLastActions[0] === "rest" &&
        opponentLastActions[1] === "rest",
      opponentAggressiveStreak: countTrailing(opponentRecentActions, isAggressiveAction),
      opponentDefensiveStreak: countTrailing(opponentRecentActions, isDefensiveAction),
      selfRepeatedBlockCount: countTrailing(selfRecentActions, (action) => action === "block"),
      selfLastActions,
      opponentLastActions,
    },
    history: {
      recentRounds,
      selfRecentActions,
      opponentRecentActions,
    },
  };
}
