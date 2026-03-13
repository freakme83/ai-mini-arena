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
  MatchOutcome,
  MatchResult,
  ModelInput,
  PerspectiveRoundSummary,
  RoundLog,
} from "../engine/types";
import { AggroBot, BalancedBot, RandomBot, TurtleBot } from "../adapters/mock";

type BotFactory = () => BotAdapter;

type SeatPerspective = "player1" | "player2";
type FinishType = "ko" | "timeout";

type ActionCounts = Record<Action, number>;

interface TournamentStats {
  player1Name: string;
  player2Name: string;
  player1Wins: number;
  player2Wins: number;
  draws: number;
  totalRounds: number;
  outcomes: MatchOutcome[];

  koCount: number;
  timeoutCount: number;

  totalPlayer1FinalHp: number;
  totalPlayer2FinalHp: number;
  totalPlayer1FinalStamina: number;
  totalPlayer2FinalStamina: number;
  totalHpDiff: number;
  totalStaminaDiff: number;

  player1ActionCounts: ActionCounts;
  player2ActionCounts: ActionCounts;
}

interface BotEntry {
  name: string;
  factory: BotFactory;
}

function createEmptyActionCounts(): ActionCounts {
  return {
    light_attack: 0,
    heavy_attack: 0,
    guard_break: 0,
    block: 0,
    dash_forward: 0,
    dash_back: 0,
    rest: 0,
  };
}

function mergeActionCounts(target: ActionCounts, source: ActionCounts): void {
  for (const action of Object.keys(target) as Action[]) {
    target[action] += source[action];
  }
}

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

function toModelInput(
  state: ArenaState,
  perspective: SeatPerspective
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
      selfRepeatedBlockCount: countTrailing(
        selfRecentActions,
        (action) => action === "block"
      ),
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
  };
}

function getFinishType(result: MatchResult): FinishType {
  const p1Hp = result.finalState.player1.hp;
  const p2Hp = result.finalState.player2.hp;

  if (p1Hp <= 0 || p2Hp <= 0) {
    return "ko";
  }

  return "timeout";
}

async function runSingleMatch(bot1: BotAdapter, bot2: BotAdapter): Promise<MatchResult> {
  let state = createInitialArenaState(bot1.name, bot2.name);
  const roundLogs: RoundLog[] = [];

  while (!isMatchFinished(state)) {
    const { player1Action, player2Action } = await getActions(state, bot1, bot2);
    const { nextState, roundLog } = resolveRound(state, player1Action, player2Action);

    roundLogs.push(roundLog);
    state = nextState;
  }

  return buildMatchResult({
    matchId: `match_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    finalState: state,
    rounds: roundLogs,
  });
}

function createEmptyTournamentStats(
  player1Name: string,
  player2Name: string
): TournamentStats {
  return {
    player1Name,
    player2Name,
    player1Wins: 0,
    player2Wins: 0,
    draws: 0,
    totalRounds: 0,
    outcomes: [],
    koCount: 0,
    timeoutCount: 0,
    totalPlayer1FinalHp: 0,
    totalPlayer2FinalHp: 0,
    totalPlayer1FinalStamina: 0,
    totalPlayer2FinalStamina: 0,
    totalHpDiff: 0,
    totalStaminaDiff: 0,
    player1ActionCounts: createEmptyActionCounts(),
    player2ActionCounts: createEmptyActionCounts(),
  };
}

function recordMatchStats(stats: TournamentStats, result: MatchResult): void {
  stats.totalRounds += result.totalRounds;
  stats.outcomes.push(result.outcome);

  if (result.outcome === "player1_win") {
    stats.player1Wins += 1;
  } else if (result.outcome === "player2_win") {
    stats.player2Wins += 1;
  } else {
    stats.draws += 1;
  }

  const finishType = getFinishType(result);
  if (finishType === "ko") {
    stats.koCount += 1;
  } else {
    stats.timeoutCount += 1;
  }

  const p1 = result.finalState.player1;
  const p2 = result.finalState.player2;

  stats.totalPlayer1FinalHp += p1.hp;
  stats.totalPlayer2FinalHp += p2.hp;
  stats.totalPlayer1FinalStamina += p1.stamina;
  stats.totalPlayer2FinalStamina += p2.stamina;
  stats.totalHpDiff += p1.hp - p2.hp;
  stats.totalStaminaDiff += p1.stamina - p2.stamina;

  for (const round of result.rounds) {
    stats.player1ActionCounts[round.player1Resolved.effectiveAction] += 1;
    stats.player2ActionCounts[round.player2Resolved.effectiveAction] += 1;
  }
}

async function runTournament(
  bot1Factory: BotFactory,
  bot2Factory: BotFactory,
  matchCount: number,
  player1Name: string,
  player2Name: string
): Promise<TournamentStats> {
  const stats = createEmptyTournamentStats(player1Name, player2Name);

  for (let i = 0; i < matchCount; i++) {
    const bot1 = bot1Factory();
    const bot2 = bot2Factory();

    const result = await runSingleMatch(bot1, bot2);
    recordMatchStats(stats, result);
  }

  return stats;
}

function formatPercent(value: number, total: number): string {
  if (total === 0) {
    return "0.0%";
  }
  return `${((value / total) * 100).toFixed(1)}%`;
}

function formatAvg(total: number, count: number): string {
  if (count === 0) {
    return "0.00";
  }
  return (total / count).toFixed(2);
}

function printActionCounts(label: string, counts: ActionCounts) {
  console.log(`${label}:`);
  for (const action of Object.keys(counts) as Action[]) {
    console.log(`  - ${action}: ${counts[action]}`);
  }
}

function printStats(title: string, stats: TournamentStats, matchCount: number) {
  console.log(`\n=== ${title} ===`);
  console.log(`Matches: ${matchCount}`);
  console.log(`Player 1 (${stats.player1Name}) wins: ${stats.player1Wins}`);
  console.log(`Player 2 (${stats.player2Name}) wins: ${stats.player2Wins}`);
  console.log(`Draws: ${stats.draws}`);
  console.log(`Player 1 win rate: ${formatPercent(stats.player1Wins, matchCount)}`);
  console.log(`Player 2 win rate: ${formatPercent(stats.player2Wins, matchCount)}`);
  console.log(`Draw rate: ${formatPercent(stats.draws, matchCount)}`);
  console.log(`Average rounds: ${formatAvg(stats.totalRounds, matchCount)}`);

  console.log(`KO finishes: ${stats.koCount} (${formatPercent(stats.koCount, matchCount)})`);
  console.log(
    `Timeout finishes: ${stats.timeoutCount} (${formatPercent(stats.timeoutCount, matchCount)})`
  );

  console.log(
    `Average final HP -> ${stats.player1Name}: ${formatAvg(
      stats.totalPlayer1FinalHp,
      matchCount
    )}, ${stats.player2Name}: ${formatAvg(stats.totalPlayer2FinalHp, matchCount)}`
  );

  console.log(
    `Average final stamina -> ${stats.player1Name}: ${formatAvg(
      stats.totalPlayer1FinalStamina,
      matchCount
    )}, ${stats.player2Name}: ${formatAvg(stats.totalPlayer2FinalStamina, matchCount)}`
  );

  console.log(`Average HP diff (P1-P2): ${formatAvg(stats.totalHpDiff, matchCount)}`);
  console.log(
    `Average stamina diff (P1-P2): ${formatAvg(stats.totalStaminaDiff, matchCount)}`
  );

  printActionCounts(`${stats.player1Name} action usage`, stats.player1ActionCounts);
  printActionCounts(`${stats.player2Name} action usage`, stats.player2ActionCounts);
}

function combineStats(forward: TournamentStats, reverse: TournamentStats): TournamentStats {
  const combined = createEmptyTournamentStats(forward.player1Name, forward.player2Name);

  combined.player1Wins = forward.player1Wins + reverse.player2Wins;
  combined.player2Wins = forward.player2Wins + reverse.player1Wins;
  combined.draws = forward.draws + reverse.draws;
  combined.totalRounds = forward.totalRounds + reverse.totalRounds;
  combined.outcomes = [...forward.outcomes, ...reverse.outcomes];

  combined.koCount = forward.koCount + reverse.koCount;
  combined.timeoutCount = forward.timeoutCount + reverse.timeoutCount;

  combined.totalPlayer1FinalHp = forward.totalPlayer1FinalHp + reverse.totalPlayer2FinalHp;
  combined.totalPlayer2FinalHp = forward.totalPlayer2FinalHp + reverse.totalPlayer1FinalHp;

  combined.totalPlayer1FinalStamina =
    forward.totalPlayer1FinalStamina + reverse.totalPlayer2FinalStamina;
  combined.totalPlayer2FinalStamina =
    forward.totalPlayer2FinalStamina + reverse.totalPlayer1FinalStamina;

  combined.totalHpDiff =
    (forward.totalPlayer1FinalHp - forward.totalPlayer2FinalHp) +
    (reverse.totalPlayer2FinalHp - reverse.totalPlayer1FinalHp);

  combined.totalStaminaDiff =
    (forward.totalPlayer1FinalStamina - forward.totalPlayer2FinalStamina) +
    (reverse.totalPlayer2FinalStamina - reverse.totalPlayer1FinalStamina);

  mergeActionCounts(combined.player1ActionCounts, forward.player1ActionCounts);
  mergeActionCounts(combined.player1ActionCounts, reverse.player2ActionCounts);

  mergeActionCounts(combined.player2ActionCounts, forward.player2ActionCounts);
  mergeActionCounts(combined.player2ActionCounts, reverse.player1ActionCounts);

  return combined;
}

async function runPairAnalysis(
  left: BotEntry,
  right: BotEntry,
  matchCount: number
): Promise<void> {
  const forward = await runTournament(
    left.factory,
    right.factory,
    matchCount,
    left.name,
    right.name
  );

  const reverse = await runTournament(
    right.factory,
    left.factory,
    matchCount,
    right.name,
    left.name
  );

  printStats(`${left.name} vs ${right.name}`, forward, matchCount);
  printStats(`${right.name} vs ${left.name}`, reverse, matchCount);

  const combined = combineStats(forward, reverse);
  printStats(
    `${left.name} vs ${right.name} | combined`,
    combined,
    matchCount * 2
  );
}

async function main() {
  const matchCount = 100;

  const bots: BotEntry[] = [
    { name: "AggroBot", factory: () => new AggroBot("AggroBot") },
    { name: "TurtleBot", factory: () => new TurtleBot("TurtleBot") },
    { name: "BalancedBot", factory: () => new BalancedBot("BalancedBot") },
    { name: "RandomBot", factory: () => new RandomBot("RandomBot") },
  ];

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      await runPairAnalysis(bots[i], bots[j], matchCount);
    }
  }
}

main().catch((error) => {
  console.error("runTournament failed:");
  console.error(error);
  process.exit(1);
});

