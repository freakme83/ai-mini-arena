import { Action, ActionDecision, BotAdapter, ModelInput } from "../engine/types";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function isAffordable(action: Action, stamina: number): boolean {
  const staminaCosts: Record<Action, number> = {
    light_attack: 6,
    heavy_attack: 12,
    block: 3,
    dash_forward: 4,
    dash_back: 4,
    rest: 0,
  };

  return stamina >= staminaCosts[action];
}

function getAffordableActions(input: ModelInput): Action[] {
  return input.allowedActions.filter((action) =>
    isAffordable(action, input.self.stamina)
  );
}

function isCloseEnoughToAttack(input: ModelInput): boolean {
  return input.self.position >= 0;
}

export class RandomBot implements BotAdapter {
  name: string;

  constructor(name = "RandomBot") {
    this.name = name;
  }

  async getAction(input: ModelInput): Promise<ActionDecision> {
    const affordable = getAffordableActions(input);
    const action = affordable.length > 0 ? pickRandom(affordable) : "rest";

    return {
      action,
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
    const canAttack = isCloseEnoughToAttack(input);

    if (canAttack && affordable.includes("heavy_attack")) {
      return {
        action: "heavy_attack",
        reasoning: "In range and enough stamina for maximum pressure.",
      };
    }

    if (canAttack && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "In range and applying steady pressure.",
      };
    }

    if (!canAttack && affordable.includes("dash_forward")) {
      return {
        action: "dash_forward",
        reasoning: "Closing distance to enable attacks.",
      };
    }

    if (affordable.includes("rest") && input.self.stamina < 6) {
      return {
        action: "rest",
        reasoning: "Recovering stamina to continue aggression.",
      };
    }

    const fallbackPool = affordable.length > 0 ? affordable : ["rest"];
    return {
      action: pickRandom(fallbackPool),
      reasoning: "Fallback valid action selected.",
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
    const opponentCanLikelyAttack = input.opponent.position >= 0;
    const lowHp = input.self.hp <= 35;
    const lowStamina = input.self.stamina <= 8;

    if (lowStamina && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Low stamina, prioritizing recovery.",
      };
    }

    if ((opponentCanLikelyAttack || lowHp) && affordable.includes("block")) {
      return {
        action: "block",
        reasoning: "Expecting pressure and choosing safety.",
      };
    }

    if (affordable.includes("dash_back") && input.self.position > -2) {
      return {
        action: "dash_back",
        reasoning: "Creating space to reduce risk.",
      };
    }

    if (isCloseEnoughToAttack(input) && affordable.includes("light_attack")) {
      return {
        action: "light_attack",
        reasoning: "Taking a safe, low-risk attack opportunity.",
      };
    }

    const fallbackPool = affordable.length > 0 ? affordable : ["rest"];
    return {
      action: pickRandom(fallbackPool),
      reasoning: "Fallback defensive action selected.",
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
    const canAttack = isCloseEnoughToAttack(input);
    const lowHp = input.self.hp <= 30;
    const lowStamina = input.self.stamina <= 8;
    const opponentLowHp = input.opponent.hp <= 20;

    if (lowStamina && affordable.includes("rest")) {
      return {
        action: "rest",
        reasoning: "Recovering stamina before committing.",
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
        reasoning: "Attempting a high-damage finish.",
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
        reasoning: "Defaulting to safe defense.",
      };
    }

    const fallbackPool = affordable.length > 0 ? affordable : ["rest"];
    return {
      action: pickRandom(fallbackPool),
      reasoning: "Fallback balanced action selected.",
    };
  }
}
