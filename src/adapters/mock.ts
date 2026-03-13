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
    const opponentLikelyBlocks = input.opponent.lastAction === "block";
    const opponentIsResting = input.opponent.lastAction === "rest";

    if (canAttack && opponentIsResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Punishing a vulnerable resting opponent.",
      };
    }

    if (canAttack && affordable.includes("heavy_attack") && !opponentLikelyBlocks && input.self.stamina >= 18) {
      return {
        action: "heavy_attack",
        reasoning: "Strong pressure while block risk appears low.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Applying reliable offensive pressure.",
      };
    }

    if (!canAttack && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Closing distance to stay aggressive.",
      };
    }

    if (input.self.stamina < 8 && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina for continued aggression.",
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

    if (lowStamina && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Low stamina, recovering before re-engaging.",
      };
    }

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

    if (canAttack && opponentRecentlyBlocked && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Testing offense after opponent played defensively.",
      };
    }

    if ((lowHp || input.opponent.lastAction === "heavy_attack") && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Expecting pressure and prioritizing defense.",
      };
    }

    if (!canAttack && affordable.includes("dash_back") && input.self.position > -1) {
      return {
        action: "dash_back",
        reasoning: "Creating space to reduce immediate danger.",
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

    if (affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Defaulting to a safe defensive posture.",
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
    const opponentHeavy = input.opponent.lastAction === "heavy_attack";

    if (lowStamina && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina before making another commitment.",
      };
    }

    if (canAttack && opponentResting && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Capitalizing on opponent vulnerability.",
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
        reasoning: "Pressuring a tired opponent safely.",
      };
    }

    if (opponentHeavy && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Responding to recent heavy aggression with defense.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Maintaining balanced pressure.",
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
