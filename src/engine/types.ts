export type Action =
  | "light_attack"
  | "heavy_attack"
  | "block"
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

export interface ArenaState {
  round: number;
  maxRounds: number;
  status: MatchStatus;
  player1: PlayerState;
  player2: PlayerState;
  distance: number;
  allowedActions: Action[];
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
}

export interface ActionDecision {
  action: Action;
  reasoning?: string;
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
