export type Action =
  | "light_attack"
  | "heavy_attack"
  | "poke"
  | "guard_break"
  | "block"
  | "retreat_guard"
  | "dash_forward"
  | "dash_back"
  | "rest";

export type MatchStatus = "ongoing" | "finished";
export type MatchOutcome = "player1_win" | "player2_win" | "draw";

export interface PlayerState {
  id: string;
  name: string;
  hp: number;
  stamina: number;
  position: number;
  lastAction: Action | null;
}

export interface ResolvedAction {
  playerId: string;
  chosenAction: Action;
  effectiveAction: Action;
  staminaBefore: number;
  staminaAfter: number;
  damageDealt: number;
  damageTaken: number;
  wasBlocked: boolean;
  wasMissed: boolean;
  notes: string[];
}

export interface RoundLog {
  round: number;
  player1Action: Action;
  player2Action: Action;
  player1Resolved: ResolvedAction;
  player2Resolved: ResolvedAction;
  player1HpAfter: number;
  player2HpAfter: number;
  player1StaminaAfter: number;
  player2StaminaAfter: number;
  distanceAfter: number;
  summary: string;
}

export interface ArenaState {
  round: number;
  maxRounds: number;
  status: MatchStatus;
  player1: PlayerState;
  player2: PlayerState;
  distance: number;
  allowedActions: Action[];
  roundHistory: RoundLog[];
}

export interface PerspectiveRoundSummary {
  round: number;
  selfAction: Action;
  opponentAction: Action;
  selfDamageDealt: number;
  selfDamageTaken: number;
  opponentDamageDealt: number;
  opponentDamageTaken: number;
  selfHpAfter: number;
  opponentHpAfter: number;
  selfStaminaAfter: number;
  opponentStaminaAfter: number;
  distanceAfter: number;
}

export interface ModelContext {
  inRange: boolean;
  selfLowHp: boolean;
  opponentLowHp: boolean;
  selfLowStamina: boolean;
  opponentLowStamina: boolean;
  opponentResting: boolean;
  opponentBlocking: boolean;
  opponentAggressiveStreak: number;
  opponentDefensiveStreak: number;
  selfRepeatedBlockCount: number;
}

export interface ModelInput {
  self: {
    id: string;
    name: string;
    hp: number;
    stamina: number;
    position: number;
    lastAction: Action | null;
  };
  opponent: {
    id: string;
    name: string;
    hp: number;
    stamina: number;
    position: number;
    lastAction: Action | null;
  };
  round: number;
  maxRounds: number;
  distance: number;
  allowedActions: Action[];
  context: ModelContext;
  history: {
    recentRounds: PerspectiveRoundSummary[];
    selfRecentActions: Action[];
    opponentRecentActions: Action[];
  };
}

export interface ActionDecision {
  action: Action;
  reasoning?: string;
}

export interface MatchResult {
  matchId: string;
  status: "finished";
  outcome: MatchOutcome;
  winnerId: string | null;
  totalRounds: number;
  finalState: ArenaState;
  rounds: RoundLog[];
}

export interface BotAdapter {
  name: string;
  getAction(input: ModelInput): Promise<ActionDecision>;
}
