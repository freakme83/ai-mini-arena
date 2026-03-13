import {
  buildMatchResult,
  createInitialArenaState,
  isMatchFinished,
  resolveRound,
} from "../engine/arena";
import {
  Action,
  ArenaState,
  BotAdapter,
  ModelInput,
  PerspectiveRoundSummary,
  RoundLog,
} from "../engine/types";
import { AggroBot, TurtleBot } from "../adapters/mock";

function isAggressiveAction(action: Action): boolean {
  return (
    action === "light_attack" ||
    action === "heavy_attack" ||
    action === "dash_forward"
  );
}

function isDefensiveAction(action: Action): boolean {
  return action === "block" || action === "dash_back" || action === "rest";
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
  perspective: "player1" | "player2"
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

function toModelInput(
  state: ArenaState,
  perspective: "player1" | "player2"
): ModelInput {
  const self = perspective === "player1" ? state.player1 : state.player2;
  const opponent = perspective === "player1" ? state.player2 : state.player1;

  const recentRounds = state.roundHistory
    .slice(-5)
    .map((roundLog) => toPerspectiveRound(roundLog, perspective));

  const selfRecentActions = recentRounds.map((round) => round.selfAction);
  const opponentRecentActions = recentRounds.map((round) => round.opponentAction);

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
      inRange: self.position >= 0,
      selfLowHp: self.hp <= 30,
      opponentLowHp: opponent.hp <= 30,
      selfLowStamina: self.stamina <= 8,
      opponentLowStamina: opponent.stamina <= 8,
      opponentResting: opponent.lastAction === "rest",
      opponentBlocking: opponent.lastAction === "block",
      opponentAggressiveStreak: countTrailing(opponentRecentActions, isAggressiveAction),
      opponentDefensiveStreak: countTrailing(opponentRecentActions, isDefensiveAction),
      selfRepeatedBlockCount: countTrailing(selfRecentActions, (action) => action === "block"),
    },
    history: {
      recentRounds,
      selfRecentActions,
      opponentRecentActions,
    },
  };
}

async function getActions(state: ArenaState, bot1: BotAdapter, bot2: BotAdapter) {
  const input1 = toModelInput(state, "player1");
  const input2 = toModelInput(state, "player2");

  const [decision1, decision2] = await Promise.all([
    bot1.getAction(input1),
    bot2.getAction(input2),
  ]);

  return {
    player1Action: decision1.action,
    player2Action: decision2.action,
    player1Reasoning: decision1.reasoning ?? "",
    player2Reasoning: decision2.reasoning ?? "",
  };
}

function printRoundHeader(round: number) {
  console.log(`\n=== ROUND ${round} ===`);
}

function printState(state: ArenaState) {
  console.log(
    `${state.player1.name} | HP: ${state.player1.hp} | STA: ${state.player1.stamina} | POS: ${state.player1.position}`
  );
  console.log(
    `${state.player2.name} | HP: ${state.player2.hp} | STA: ${state.player2.stamina} | POS: ${state.player2.position}`
  );
  console.log(`Distance: ${state.distance}`);
}

function printRoundDetails(params: {
  player1Name: string;
  player2Name: string;
  player1Action: string;
  player2Action: string;
  player1Reasoning: string;
  player2Reasoning: string;
  summary: string;
}) {
  console.log(`${params.player1Name} chose: ${params.player1Action}`);
  console.log(`${params.player2Name} chose: ${params.player2Action}`);

  if (params.player1Reasoning) {
    console.log(`${params.player1Name} reasoning: ${params.player1Reasoning}`);
  }

  if (params.player2Reasoning) {
    console.log(`${params.player2Name} reasoning: ${params.player2Reasoning}`);
  }

  console.log(`Summary: ${params.summary}`);
}

async function runMatch(bot1: BotAdapter, bot2: BotAdapter) {
  let state = createInitialArenaState(bot1.name, bot2.name);
  const roundLogs = [];

  console.log(`Starting match: ${bot1.name} vs ${bot2.name}`);
  printState(state);

  while (!isMatchFinished(state)) {
    printRoundHeader(state.round);

    const actions = await getActions(state, bot1, bot2);

    const { nextState, roundLog } = resolveRound(
      state,
      actions.player1Action,
      actions.player2Action
    );

    roundLogs.push(roundLog);

    printRoundDetails({
      player1Name: state.player1.name,
      player2Name: state.player2.name,
      player1Action: actions.player1Action,
      player2Action: actions.player2Action,
      player1Reasoning: actions.player1Reasoning,
      player2Reasoning: actions.player2Reasoning,
      summary: roundLog.summary,
    });

    if (roundLog.player1Resolved.notes.length > 0) {
      console.log(`${state.player1.name} notes: ${roundLog.player1Resolved.notes.join(" | ")}`);
    }

    if (roundLog.player2Resolved.notes.length > 0) {
      console.log(`${state.player2.name} notes: ${roundLog.player2Resolved.notes.join(" | ")}`);
    }

    state = nextState;
    printState(state);
  }

  const result = buildMatchResult({
    matchId: `match_${Date.now()}`,
    finalState: state,
    rounds: roundLogs,
  });

  console.log("\n=== FINAL RESULT ===");
  console.log(`Outcome: ${result.outcome}`);
  console.log(`Winner: ${result.winnerId ?? "None (draw)"}`);
  console.log(`Total rounds: ${result.totalRounds}`);
  console.log(
    `Final HP -> ${result.finalState.player1.name}: ${result.finalState.player1.hp}, ${result.finalState.player2.name}: ${result.finalState.player2.hp}`
  );

  return result;
}

async function main() {
  const bot1 = new AggroBot("AggroBot");
  const bot2 = new TurtleBot("TurtleBot");

  await runMatch(bot1, bot2);
}

main().catch((error) => {
  console.error("runMatch failed:");
  console.error(error);
  process.exit(1);
});
