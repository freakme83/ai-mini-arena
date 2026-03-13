import { Action } from "./types";

export const ALLOWED_ACTIONS: Action[] = [
  "light_attack",
  "heavy_attack",
  "block",
  "dash_forward",
  "dash_back",
  "rest",
];

export const MAX_HP = 100;
export const STARTING_HP = 100;

export const MAX_STAMINA = 40;
export const STARTING_STAMINA = 40;

export const MAX_ROUNDS = 20;

export const MIN_POSITION = -2;
export const MAX_POSITION = 2;

/**
 * Damage reduction applied when defending with block.
 * 0.85 means 85% of incoming damage is reduced.
 */
export const BLOCK_DAMAGE_REDUCTION = 0.85;

/**
 * Extra stamina penalty applied to an attacker when a heavy attack is blocked.
 */
export const BLOCKED_HEAVY_ATTACK_STAMINA_PENALTY = 4;

/**
 * Extra damage taken by a resting player if hit this round.
 * Rest should be useful, but punishable.
 */
export const RESTING_DAMAGE_BONUS = 4;

export interface ActionRule {
  staminaCost: number;
  baseDamage: number;
  requiresCloseRange: boolean;
  movement: number;
  staminaGain: number;
}

export const ACTION_RULES: Record<Action, ActionRule> = {
  light_attack: {
    staminaCost: 6,
    baseDamage: 10,
    requiresCloseRange: true,
    movement: 0,
    staminaGain: 0,
  },
  heavy_attack: {
    staminaCost: 14,
    baseDamage: 22,
    requiresCloseRange: true,
    movement: 0,
    staminaGain: 0,
  },
  block: {
    staminaCost: 2,
    baseDamage: 0,
    requiresCloseRange: false,
    movement: 0,
    staminaGain: 2,
  },
  dash_forward: {
    staminaCost: 4,
    baseDamage: 0,
    requiresCloseRange: false,
    movement: 1,
    staminaGain: 0,
  },
  dash_back: {
    staminaCost: 4,
    baseDamage: 0,
    requiresCloseRange: false,
    movement: -1,
    staminaGain: 0,
  },
  rest: {
    staminaCost: 0,
    baseDamage: 0,
    requiresCloseRange: false,
    movement: 0,
    staminaGain: 8,
  },
};

export function canAffordAction(action: Action, stamina: number): boolean {
  return stamina >= ACTION_RULES[action].staminaCost;
}

export function clampPosition(position: number): number {
  return Math.max(MIN_POSITION, Math.min(MAX_POSITION, position));
}

export function isInRange(position: number): boolean {
  return position >= 0;
}

export function isAttack(action: Action): boolean {
  return action === "light_attack" || action === "heavy_attack";
}

export function isMovement(action: Action): boolean {
  return action === "dash_forward" || action === "dash_back";
}

export function getActionRule(action: Action): ActionRule {
  return ACTION_RULES[action];
}
