import { Action, ActionDecision, BotAdapter, ModelInput } from "../engine/types";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

const STAMINA_COST: Record<Action, number> = {
  light_attack: 6,
  heavy_attack: 12,
  block: 3,
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

    if (canAttack && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "In range with stamina for heavy attack.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Applying pressure with light attack.",
      };
    }

    if (!canAttack && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Closing distance to attack.",
      };
    }

    if (input.self.stamina < 6 && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina to continue aggression.",
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
    const opponentThreat = input.opponent.position >= 0;

    if (input.self.stamina <= 8 && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Low stamina, prioritizing recovery.",
      };
    }

    if (opponentThreat && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Expecting incoming attack.",
      };
    }

    if (affordable.includes("dash_back")) {
      return {
        action: "dash_back",
        reasoning: "Creating distance for safety.",
      };
    }

    if (inAttackRange(input) && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Safe opportunistic attack.",
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

    const lowHp = input.self.hp < 30;
    const lowStamina = input.self.stamina < 8;
    const canAttack = inAttackRange(input);
    const opponentLowHp = input.opponent.hp < 20;

    if (lowStamina && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina.",
      };
    }

    if (lowHp && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Low HP, prioritizing defense.",
      };
    }

    if (canAttack && opponentLowHp && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "Attempting finishing move.",
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
        reasoning: "Moving into attack range.",
      };
    }

    if (affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Default safe option.",
      };
    }

    const pool: Action[] = affordable.length > 0 ? affordable : REST_ONLY;

    return {
      action: pickRandom(pool),
      reasoning: "Fallback balanced decision.",
    };
  }
}
