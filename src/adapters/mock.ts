import { Action, ActionDecision, BotAdapter, ModelInput } from "../engine/types";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const STAMINA_COST: Record<Action, number> = {
  light_attack: 6,
  heavy_attack: 14,
  block: 2,
  dash_forward: 4,
  dash_back: 4,
  rest: 0,
};

function isAffordable(action: Action, stamina: number): boolean {
  return stamina >= STAMINA_COST[action];
}

function getAffordableActions(input: ModelInput): Action[] {
  return input.allowedActions.filter((action) =>
    isAffordable(action, input.self.stamina)
  );
}

function inAttackRange(input: ModelInput): boolean {
  return input.context.inRange;
}

const REST_ONLY: Action[] = ["rest"];

export class RandomBot implements BotAdapter {
  name: string;

  constructor(name = "RandomBot") {
    this.name = name;
  }

  async getAction(input: ModelInput): Promise<ActionDecision> {
    const affordable = getAffordableActions(input);
    const pool: Action[] = affordable.length > 0 ? affordable : REST_ONLY;

    return {
      action: pickRandom(pool),
      reasoning: "Random valid action selected.",
    };
  }
}

export class AggroBot implements BotAdapter {
  name: string;

  constructor(name = "AggroBot") {
    this.name = name;
  }

  async getAction(input: ModelInput): Promise<ActionDecision> {
    const affordable = getAffordableActions(input);
    const canAttack = inAttackRange(input);

    if (canAttack && input.context.opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Punishing a resting opponent with maximum pressure.",
      };
    }

    if (
      canAttack &&
      input.context.opponentBlocking &&
      affordable.includes("light_attack")
    ) {
      return {
        action: "light_attack",
        reasoning: "Opponent blocked last turn, so switching to lighter pressure.",
      };
    }

    if (
      input.context.opponentDefensiveStreak >= 2 &&
      !canAttack &&
      affordable.includes("dash_forward")
    ) {
      return {
        action: "dash_forward",
        reasoning: "Opponent has been defensive for multiple rounds, so closing distance to keep pressure.",
      };
    }

    if (
      input.context.opponentDefensiveStreak >= 3 &&
      input.context.selfLowStamina &&
      affordable.includes("rest") &&
      !canAttack
    ) {
      return {
        action: "rest",
        reasoning: "Opponent is in a defensive loop, taking a safe stamina reset.",
      };
    }

    if (
      canAttack &&
      affordable.includes("heavy_attack") &&
      !input.context.opponentBlocking &&
      input.self.stamina >= 18
    ) {
      return {
        action: "heavy_attack",
        reasoning: "Applying strong offensive pressure while block risk appears lower.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Maintaining reliable offensive pressure.",
      };
    }

    if (!canAttack && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Closing distance to keep the initiative.",
      };
    }

    if (input.context.selfLowStamina && canAttack && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Low stamina in range, defending instead of taking a risky rest.",
      };
    }

    if (input.context.selfLowStamina && !canAttack && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina outside immediate danger.",
      };
    }

    const pool: Action[] = affordable.length > 0 ? affordable : REST_ONLY;

    return {
      action: pickRandom(pool),
      reasoning: "Fallback aggressive decision.",
    };
  }
}

export class TurtleBot implements BotAdapter {
  name: string;

  constructor(name = "TurtleBot") {
    this.name = name;
  }

  async getAction(input: ModelInput): Promise<ActionDecision> {
    const affordable = getAffordableActions(input);
    const canAttack = inAttackRange(input);

    if (canAttack && input.context.opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Punishing a resting opponent.",
      };
    }

    if (
      canAttack &&
      input.context.opponentLowStamina &&
      affordable.includes("light_attack")
    ) {
      return {
        action: "light_attack",
        reasoning: "Taking initiative against a tired opponent.",
      };
    }

    if (
      input.context.selfRepeatedBlockCount >= 2 &&
      !input.context.opponentAggressiveStreak &&
      canAttack &&
      affordable.includes("light_attack")
    ) {
      return {
        action: "light_attack",
        reasoning: "Breaking my own block loop with a measured attack.",
      };
    }

    if (
      input.context.selfRepeatedBlockCount >= 2 &&
      !canAttack &&
      affordable.includes("dash_back")
    ) {
      return {
        action: "dash_back",
        reasoning: "Breaking repetitive blocking by creating distance.",
      };
    }

    if (
      input.context.selfLowStamina &&
      !canAttack &&
      affordable.includes("rest")
    ) {
      return {
        action: "rest",
        reasoning: "Recovering stamina while safely out of range.",
      };
    }

    if (
      (input.context.selfLowHp ||
        input.context.opponentAggressiveStreak >= 1 ||
        canAttack) &&
      affordable.includes("block") &&
      input.context.selfRepeatedBlockCount < 2
    ) {
      return {
        action: "block",
        reasoning: "Prioritizing defense under pressure or while in range.",
      };
    }

    if (!canAttack && affordable.includes("dash_back") && input.self.position > -1) {
      return {
        action: "dash_back",
        reasoning: "Creating more space to reduce immediate danger.",
      };
    }

    if (!canAttack && input.context.opponentLowStamina && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Re-entering range against a weakened opponent.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Taking a measured attack opportunity.",
      };
    }

    if (input.context.selfLowStamina && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina because no better defensive option is available.",
      };
    }

    const pool: Action[] = affordable.length > 0 ? affordable : REST_ONLY;

    return {
      action: pickRandom(pool),
      reasoning: "Fallback defensive decision.",
    };
  }
}

export class BalancedBot implements BotAdapter {
  name: string;

  constructor(name = "BalancedBot") {
    this.name = name;
  }

  async getAction(input: ModelInput): Promise<ActionDecision> {
    const affordable = getAffordableActions(input);
    const canAttack = inAttackRange(input);

    if (canAttack && input.context.opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Capitalizing on a resting opponent.",
      };
    }

    if (
      input.context.selfLowStamina &&
      !canAttack &&
      affordable.includes("rest")
    ) {
      return {
        action: "rest",
        reasoning: "Recovering stamina while outside immediate danger.",
      };
    }

    if (
      input.context.selfLowStamina &&
      canAttack &&
      affordable.includes("block")
    ) {
      return {
        action: "block",
        reasoning: "Low stamina in range, choosing defense over a punishable rest.",
      };
    }

    if (input.context.selfLowHp && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Low HP, prioritizing survival.",
      };
    }

    if (
      canAttack &&
      input.context.opponentLowHp &&
      affordable.includes("heavy_attack")
    ) {
      return {
        action: "heavy_attack",
        reasoning: "Attempting to close out the fight.",
      };
    }

    if (
      canAttack &&
      input.context.opponentLowStamina &&
      affordable.includes("light_attack")
    ) {
      return {
        action: "light_attack",
        reasoning: "Applying safe pressure to a tired opponent.",
      };
    }

    if (
      input.context.opponentAggressiveStreak >= 2 &&
      affordable.includes("block")
    ) {
      return {
        action: "block",
        reasoning: "Opponent has been aggressively chaining actions, so defending for a counter window.",
      };
    }

    if (
      input.context.opponentDefensiveStreak >= 2 &&
      !canAttack &&
      affordable.includes("dash_forward")
    ) {
      return {
        action: "dash_forward",
        reasoning: "Opponent is playing defensively, so stepping in to seize tempo.",
      };
    }

    if (
      input.context.opponentDefensiveStreak >= 2 &&
      canAttack &&
      affordable.includes("light_attack")
    ) {
      return {
        action: "light_attack",
        reasoning: "Using lighter pressure to probe a defensive opponent.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Maintaining balanced offensive pressure.",
      };
    }

    if (!canAttack && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Moving into effective range.",
      };
    }

    if (affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Using defense as a safe fallback.",
      };
    }

    const pool: Action[] = affordable.length > 0 ? affordable : REST_ONLY;

    return {
      action: pickRandom(pool),
      reasoning: "Fallback balanced decision.",
    };
  }
}
