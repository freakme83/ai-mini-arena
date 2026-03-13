import {
  buildMatchResult,
  createInitialArenaState,
  isMatchFinished,
  resolveRound,
} from "../engine/arena";
import { ArenaState, BotAdapter, MatchOutcome, ModelInput } from "../engine/types";
import { AggroBot, BalancedBot, RandomBot, TurtleBot } from "../adapters/mock";

type BotFactory = () => BotAdapter;

interface TournamentStats {
  player1Wins: number;
  player2Wins: number;
  draws: number;
  totalRounds: number;
  outcomes: MatchOutcome[];
}

function toModelInput(state: ArenaState, perspective: "player1" | "player2"): ModelInput {
  const self = perspective === "player1" ? state.player1 : state.player2;
  const opponent = perspective === "player1" ? state.player2 : state.player1;

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

async function runSingleMatch(bot1: BotAdapter, bot2: BotAdapter) {
  let state = createInitialArenaState(bot1.name, bot2.name);
  const roundLogs = [];

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

async function runTournament(
  bot1Factory: BotFactory,
  bot2Factory: BotFactory,
  matchCount: number
): Promise<TournamentStats> {
  const stats: TournamentStats = {
    player1Wins: 0,
    player2Wins: 0,
    draws: 0,
    totalRounds: 0,
    outcomes: [],
  };

  for (let i = 0; i < matchCount; i++) {
    const bot1 = bot1Factory();
    const bot2 = bot2Factory();

    const result = await runSingleMatch(bot1, bot2);

    stats.totalRounds += result.totalRounds;
    stats.outcomes.push(result.outcome);

    if (result.outcome === "player1_win") {
      stats.player1Wins += 1;
    } else if (result.outcome === "player2_win") {
      stats.player2Wins += 1;
    } else {
      stats.draws += 1;
    }
  }

  return stats;
}

function printStats(title: string, stats: TournamentStats, matchCount: number) {
  const avgRounds = (stats.totalRounds / matchCount).toFixed(2);

  console.log(`\n=== ${title} ===`);
  console.log(`Matches: ${matchCount}`);
  console.log(`Player 1 wins: ${stats.player1Wins}`);
  console.log(`Player 2 wins: ${stats.player2Wins}`);
  console.log(`Draws: ${stats.draws}`);
  console.log(`Player 1 win rate: ${((stats.player1Wins / matchCount) * 100).toFixed(1)}%`);
  console.log(`Player 2 win rate: ${((stats.player2Wins / matchCount) * 100).toFixed(1)}%`);
  console.log(`Draw rate: ${((stats.draws / matchCount) * 100).toFixed(1)}%`);
  console.log(`Average rounds: ${avgRounds}`);
}

async function main() {
  const matchCount = 100;

  const aggroVsTurtle = await runTournament(
    () => new AggroBot("AggroBot"),
    () => new TurtleBot("TurtleBot"),
    matchCount
  );

  printStats("AggroBot vs TurtleBot", aggroVsTurtle, matchCount);

  const aggroVsBalanced = await runTournament(
    () => new AggroBot("AggroBot"),
    () => new BalancedBot("BalancedBot"),
    matchCount
  );

  printStats("AggroBot vs BalancedBot", aggroVsBalanced, matchCount);

  const turtleVsRandom = await runTournament(
    () => new TurtleBot("TurtleBot"),
    () => new RandomBot("RandomBot"),
    matchCount
  );

  printStats("TurtleBot vs RandomBot", turtleVsRandom, matchCount);
}

main().catch((error) => {
  console.error("runTournament failed:");
  console.error(error);
  process.exit(1);
});
