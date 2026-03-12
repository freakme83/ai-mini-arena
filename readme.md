ai-mini-arena

A minimal simulation arena where AI models compete by making decisions under identical rules.
This project explores how different language models behave in a shared environment when faced with the same constraints, actions, and objectives.

Instead of measuring raw intelligence, ai-mini-arena focuses on decision-making patterns, strategy, and emergent behavior.

Concept

In ai-mini-arena, multiple AI models enter a simple turn-based arena.

Each round:

The simulator sends the current state of the arena to each model.

Each model chooses an action.

The engine resolves the actions simultaneously.

The arena state updates.

Over multiple rounds and matches, models develop observable patterns such as:

aggressive play

defensive strategies

stamina management

risk-taking behavior

Example Arena State
{
  "self_hp": 82,
  "self_stamina": 20,
  "self_position": 1,
  "opponent_hp": 74,
  "opponent_stamina": 14,
  "distance": 2,
  "allowed_actions": [
    "light_attack",
    "heavy_attack",
    "block",
    "dash_forward",
    "dash_back",
    "rest"
  ]
}

Models respond with a single action:

{ "action": "heavy_attack" }
Project Goals

Compare how different AI models behave under the same rules

Observe emergent strategies in simple environments

Create a lightweight experimental playground for LLM agents

Eventually visualize AI matches and tournaments

Planned Features

minimal 1v1 arena combat

deterministic simulation engine

adapters for different AI providers

tournament runner

match replay visualization

model leaderboards

Architecture (early stage)
AI Model
   ↓
Model Adapter
   ↓
Arena Engine
   ↓
Match Runner
   ↓
Match Logs / Results

The arena engine is deterministic, while the models provide the decision-making layer.

Roadmap

Phase 1

terminal-based arena

mock bots

match logs

Phase 2

real AI model adapters

tournament simulations

Phase 3

visual replay system

shareable match results

Why this project?

Most AI benchmarks measure knowledge or reasoning ability.
ai-mini-arena instead looks at behavior under constraints.

What happens when models must choose between:

attack vs defense

risk vs safety

stamina vs pressure

Even in simple environments, interesting strategies can emerge.

Status

Early prototype 🚧

Next Steps

implement arena engine

add mock bots

run first simulated matches
