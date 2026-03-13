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
  return input.self.position >= 0;
}

function opponentWasAggressive(input: ModelInput): boolean {
  return (
    input.opponent.lastAction === "light_attack" ||
    input.opponent.lastAction === "heavy_attack" ||
    input.opponent.lastAction === "dash_forward"
  );
}

function opponentWasDefensive(input: ModelInput): boolean {
  return (
    input.opponent.lastAction === "block" ||
    input.opponent.lastAction === "dash_back" ||
    input.opponent.lastAction === "rest"
  );
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
    const opponentBlocked = input.opponent.lastAction === "block";
    const opponentResting = input.opponent.lastAction === "rest";
    const lowStamina = input.self.stamina <= 7;

    if (canAttack && opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Punishing a resting opponent with maximum pressure.",
      };
    }

    if (canAttack && opponentBlocked && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Opponent blocked last turn, so using lighter pressure instead of a risky heavy attack.",
      };
    }

    if (
      canAttack &&
      affordable.includes("heavy_attack") &&
      !opponentBlocked &&
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

    if (lowStamina && !canAttack && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina while outside immediate attack range.",
      };
    }

    if (lowStamina && canAttack && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Temporarily defending instead of taking a vulnerable rest in range.",
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
    const lowHp = input.self.hp <= 35;
    const lowStamina = input.self.stamina <= 8;
    const opponentLowStamina = input.opponent.stamina <= 8;
    const opponentResting = input.opponent.lastAction === "rest";
    const opponentRecentlyBlocked = input.opponent.lastAction === "block";
    const opponentAggressive = opponentWasAggressive(input);

    if (canAttack && opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Punishing a resting opponent.",
      };
    }

    if (canAttack && opponentLowStamina && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Taking initiative against a tired opponent.",
      };
    }

    if (
      canAttack &&
      opponentRecentlyBlocked &&
      affordable.includes("light_attack")
    ) {
      return {
        action: "light_attack",
        reasoning: "Testing offense after the opponent played defensively.",
      };
    }

    if (lowStamina && !canAttack && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina while safely out of range.",
      };
    }

    if ((lowHp || opponentAggressive || canAttack) && affordable.includes("block")) {
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

    if (!canAttack && affordable.includes("dash_forward") && opponentLowStamina) {
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

    if (lowStamina && affordable.includes("rest")) {
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

    const lowHp = input.self.hp <= 30;
    const lowStamina = input.self.stamina <= 8;
    const opponentLowHp = input.opponent.hp <= 22;
    const opponentLowStamina = input.opponent.stamina <= 8;
    const opponentResting = input.opponent.lastAction === "rest";
    const opponentBlocking = input.opponent.lastAction === "block";
    const opponentAggressive = opponentWasAggressive(input);
    const opponentDefensive = opponentWasDefensive(input);

    if (canAttack && opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Capitalizing on a resting opponent.",
      };
    }

    if (lowStamina && !canAttack && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina while outside immediate danger.",
      };
    }

    if (lowStamina && canAttack && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Low stamina in range, choosing defense over a punishable rest.",
      };
    }

    if (lowHp && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Low HP, prioritizing survival.",
      };
    }

    if (canAttack && opponentLowHp && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Attempting to close out the fight.",
      };
    }

    if (canAttack && opponentLowStamina && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Applying safe pressure to a tired opponent.",
      };
    }

    if (opponentAggressive && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Adapting to recent aggression with a defensive response.",
      };
    }

    if (canAttack && opponentBlocking && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Using lighter pressure after the opponent showed a defensive tendency.",
      };
    }

    if (!canAttack && opponentDefensive && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Stepping in because the opponent appears defensive or passive.",
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
