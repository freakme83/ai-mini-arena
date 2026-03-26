const HISTORY_WINDOW = 6;

const state = {
  timeline: null,
  index: 0,
  timer: null,
};

const el = {
  title: document.querySelector('#match-title'),
  round: document.querySelector('#round-number'),
  distanceBand: document.querySelector('#distance-band'),
  distanceLane: document.querySelector('#distance-lane'),
  notes: document.querySelector('#notes'),
  clashLeft: document.querySelector('#clash-left'),
  clashRight: document.querySelector('#clash-right'),
  outcomeLabels: document.querySelector('#outcome-labels'),
  leftName: document.querySelector('#left-name'),
  rightName: document.querySelector('#right-name'),
  leftAction: document.querySelector('#left-action'),
  rightAction: document.querySelector('#right-action'),
  leftHpValue: document.querySelector('#left-hp-value'),
  rightHpValue: document.querySelector('#right-hp-value'),
  leftStValue: document.querySelector('#left-st-value'),
  rightStValue: document.querySelector('#right-st-value'),
  leftHpDelta: document.querySelector('#left-hp-delta'),
  rightHpDelta: document.querySelector('#right-hp-delta'),
  leftStDelta: document.querySelector('#left-st-delta'),
  rightStDelta: document.querySelector('#right-st-delta'),
  leftHpBar: document.querySelector('#left-hp-bar'),
  rightHpBar: document.querySelector('#right-hp-bar'),
  leftStBar: document.querySelector('#left-st-bar'),
  rightStBar: document.querySelector('#right-st-bar'),
  leftPanel: document.querySelector('#left-panel'),
  rightPanel: document.querySelector('#right-panel'),
  leftMarker: document.querySelector('#left-marker'),
  rightMarker: document.querySelector('#right-marker'),
  history: document.querySelector('#history-list'),
  stepCounter: document.querySelector('#step-counter'),
  prev: document.querySelector('#prev-step'),
  next: document.querySelector('#next-step'),
  reset: document.querySelector('#reset'),
  autoplay: document.querySelector('#autoplay'),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Map event tags to display labels with severity class */
const EVENT_LABELS = {
  ko: { text: 'KO', cls: 'label-ko' },
  critical_hp: { text: 'CRITICAL', cls: 'label-danger' },
  guard_break_success: { text: 'GUARD BREAK', cls: 'label-warn' },
  heavy_hit: { text: 'HEAVY HIT', cls: 'label-danger' },
  light_hit: { text: 'HIT', cls: 'label-info' },
  blocked: { text: 'BLOCKED', cls: 'label-muted' },
  whiff: { text: 'WHIFF', cls: 'label-muted' },
  disengage_attempt: { text: 'DISENGAGE', cls: 'label-info' },
  close_distance: { text: 'CLOSING', cls: 'label-info' },
  match_start: { text: 'FIGHT', cls: 'label-accent' },
  round_start: { text: 'NEW ROUND', cls: 'label-muted' },
  exhausted: { text: 'EXHAUSTED', cls: 'label-warn' },
  punish: { text: 'PUNISH', cls: 'label-danger' },
  rest_punished: { text: 'REST PUNISHED', cls: 'label-danger' },
  chip_damage: { text: 'CHIP', cls: 'label-muted' },
};

/** Action display names */
const ACTION_NAMES = {
  light_attack: 'Light Attack',
  heavy_attack: 'Heavy Attack',
  poke: 'Poke',
  guard_break: 'Guard Break',
  block: 'Block',
  retreat_guard: 'Retreat Guard',
  dash_forward: 'Dash Forward',
  dash_back: 'Dash Back',
  rest: 'Rest',
  observe: 'Observe',
};

/** Action CSS class hints */
const ACTION_CLASSES = {
  light_attack: 'action-attack',
  heavy_attack: 'action-attack',
  poke: 'action-attack',
  guard_break: 'action-break',
  block: 'action-defend',
  retreat_guard: 'action-defend',
  dash_forward: 'action-move',
  dash_back: 'action-move',
  rest: 'action-rest',
  observe: 'action-rest',
};

function formatAction(action) {
  return ACTION_NAMES[action] || action;
}

function actionClass(action) {
  return ACTION_CLASSES[action] || '';
}

async function loadTimeline() {
  const response = await fetch('./data/mock-match-timeline.json');
  if (!response.ok) throw new Error(`Failed to load mock timeline: ${response.status}`);
  state.timeline = await response.json();
  init();
}

function init() {
  const { fighters } = state.timeline;
  el.title.textContent = `Observer: ${fighters.left.name} vs ${fighters.right.name}`;
  el.leftName.textContent = fighters.left.name;
  el.rightName.textContent = fighters.right.name;

  el.prev.addEventListener('click', () => stepBy(-1));
  el.next.addEventListener('click', () => stepBy(1));
  el.reset.addEventListener('click', () => setStep(0));
  el.autoplay.addEventListener('click', toggleAutoplay);

  render();
}

function setStep(index) {
  const maxIndex = state.timeline.steps.length - 1;
  state.index = clamp(index, 0, maxIndex);
  render();
}

function stepBy(delta) {
  setStep(state.index + delta);
}

function toggleAutoplay() {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
    el.autoplay.textContent = 'Play';
    return;
  }

  state.timer = setInterval(() => {
    if (state.index >= state.timeline.steps.length - 1) {
      clearInterval(state.timer);
      state.timer = null;
      el.autoplay.textContent = 'Play';
      return;
    }
    stepBy(1);
  }, 900);
  el.autoplay.textContent = 'Pause';
}

/** Compute HP/stamina deltas compared to previous step */
function getDeltas(side) {
  if (state.index === 0) return { hp: 0, stamina: 0 };
  const prev = state.timeline.steps[state.index - 1].fighters[side];
  const curr = state.timeline.steps[state.index].fighters[side];
  return {
    hp: curr.hp - prev.hp,
    stamina: curr.stamina - prev.stamina,
  };
}

function formatDelta(value) {
  if (value === 0) return '';
  return value > 0 ? `+${value}` : `${value}`;
}

function deltaClass(value) {
  if (value > 0) return 'delta-positive';
  if (value < 0) return 'delta-negative';
  return '';
}

function render() {
  const step = state.timeline.steps[state.index];
  const left = step.fighters.left;
  const right = step.fighters.right;

  el.round.textContent = String(step.round);
  el.distanceBand.textContent = step.distance.band;
  el.distanceLane.textContent = `${step.distance.lane}% lane separation`;
  el.notes.textContent = step.summary || 'No notes for this step.';

  // Clash display
  el.clashLeft.textContent = formatAction(left.action);
  el.clashLeft.className = `clash-action ${actionClass(left.action)}`;
  el.clashRight.textContent = formatAction(right.action);
  el.clashRight.className = `clash-action ${actionClass(right.action)}`;

  // Outcome labels from events
  renderOutcomeLabels(step.events);

  // Step counter
  el.stepCounter.textContent = `Step ${state.index + 1} / ${state.timeline.steps.length}`;

  paintFighter('left', left);
  paintFighter('right', right);
  paintLane(step.distance.lane);
  paintHistory();
}

function renderOutcomeLabels(events) {
  el.outcomeLabels.innerHTML = '';
  events.forEach((evt) => {
    const cfg = EVENT_LABELS[evt];
    const span = document.createElement('span');
    span.className = `outcome-label ${cfg ? cfg.cls : 'label-muted'}`;
    span.textContent = cfg ? cfg.text : evt.toUpperCase().replace(/_/g, ' ');
    el.outcomeLabels.appendChild(span);
  });
}

function paintFighter(side, fighterStep) {
  const isLeft = side === 'left';
  const hp = fighterStep.hp;
  const stamina = fighterStep.stamina;
  const panel = isLeft ? el.leftPanel : el.rightPanel;
  const deltas = getDeltas(side);

  // Action
  const actionEl = isLeft ? el.leftAction : el.rightAction;
  actionEl.textContent = formatAction(fighterStep.action);
  actionEl.className = `action-label ${actionClass(fighterStep.action)}`;

  // Values
  (isLeft ? el.leftHpValue : el.rightHpValue).textContent = `${hp}`;
  (isLeft ? el.leftStValue : el.rightStValue).textContent = `${stamina}`;

  // Bars
  (isLeft ? el.leftHpBar : el.rightHpBar).style.width = `${clamp(hp, 0, 100)}%`;
  (isLeft ? el.leftStBar : el.rightStBar).style.width = `${clamp(stamina, 0, 100)}%`;

  // Deltas
  const hpDeltaEl = isLeft ? el.leftHpDelta : el.rightHpDelta;
  const stDeltaEl = isLeft ? el.leftStDelta : el.rightStDelta;
  hpDeltaEl.textContent = formatDelta(deltas.hp);
  hpDeltaEl.className = `delta ${deltaClass(deltas.hp)}`;
  stDeltaEl.textContent = formatDelta(deltas.stamina);
  stDeltaEl.className = `delta ${deltaClass(deltas.stamina)}`;

  // State classes
  panel.classList.toggle('low', hp <= 25);
  panel.classList.toggle('exhausted', stamina <= 20);
}

function paintLane(distanceLanePercent) {
  const gap = clamp(distanceLanePercent, 8, 90);
  const leftPos = clamp(50 - gap / 2, 2, 90);
  const rightPos = clamp(50 + gap / 2, 6, 98);

  el.leftMarker.style.left = `calc(${leftPos}% - 10px)`;
  el.rightMarker.style.left = `calc(${rightPos}% - 10px)`;
}

function paintHistory() {
  const start = Math.max(0, state.index - HISTORY_WINDOW + 1);
  const recent = state.timeline.steps.slice(start, state.index + 1);

  el.history.innerHTML = '';
  recent.forEach((step, idx) => {
    const item = document.createElement('li');
    if (start + idx === state.index) item.classList.add('current-step');

    const leftAct = formatAction(step.fighters.left.action);
    const rightAct = formatAction(step.fighters.right.action);
    const evtLabels = step.events
      .map((e) => {
        const cfg = EVENT_LABELS[e];
        return cfg ? cfg.text : e.toUpperCase().replace(/_/g, ' ');
      })
      .join(', ');

    item.innerHTML = `<span class="hist-round">R${step.round}</span> <span class="hist-clash">${leftAct} vs ${rightAct}</span> <span class="hist-events">${evtLabels}</span>`;
    el.history.appendChild(item);
  });
}

loadTimeline().catch((error) => {
  console.error(error);
  el.notes.textContent = `Could not load timeline: ${error.message}`;
});
