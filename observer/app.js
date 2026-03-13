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
  exchange: document.querySelector('#exchange'),
  notes: document.querySelector('#notes'),
  leftName: document.querySelector('#left-name'),
  rightName: document.querySelector('#right-name'),
  leftAction: document.querySelector('#left-action'),
  rightAction: document.querySelector('#right-action'),
  leftHpValue: document.querySelector('#left-hp-value'),
  rightHpValue: document.querySelector('#right-hp-value'),
  leftStValue: document.querySelector('#left-st-value'),
  rightStValue: document.querySelector('#right-st-value'),
  leftHpBar: document.querySelector('#left-hp-bar'),
  rightHpBar: document.querySelector('#right-hp-bar'),
  leftStBar: document.querySelector('#left-st-bar'),
  rightStBar: document.querySelector('#right-st-bar'),
  leftPanel: document.querySelector('#left-panel'),
  rightPanel: document.querySelector('#right-panel'),
  leftMarker: document.querySelector('#left-marker'),
  rightMarker: document.querySelector('#right-marker'),
  history: document.querySelector('#history-list'),
  prev: document.querySelector('#prev-step'),
  next: document.querySelector('#next-step'),
  reset: document.querySelector('#reset'),
  autoplay: document.querySelector('#autoplay'),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

function render() {
  const step = state.timeline.steps[state.index];
  const left = step.fighters.left;
  const right = step.fighters.right;

  el.round.textContent = String(step.round);
  el.distanceBand.textContent = step.distance.band;
  el.distanceLane.textContent = `${step.distance.lane}% lane separation`;
  el.exchange.textContent = `${left.action}  vs  ${right.action}`;
  el.notes.textContent = step.summary || 'No notes for this step.';

  paintFighter('left', left);
  paintFighter('right', right);
  paintLane(step.distance.lane);
  paintHistory();
}

function paintFighter(side, fighterStep) {
  const isLeft = side === 'left';
  const hp = fighterStep.hp;
  const stamina = fighterStep.stamina;
  const panel = isLeft ? el.leftPanel : el.rightPanel;

  (isLeft ? el.leftAction : el.rightAction).textContent = fighterStep.action;
  (isLeft ? el.leftHpValue : el.rightHpValue).textContent = `${hp}`;
  (isLeft ? el.leftStValue : el.rightStValue).textContent = `${stamina}`;
  (isLeft ? el.leftHpBar : el.rightHpBar).style.width = `${clamp(hp, 0, 100)}%`;
  (isLeft ? el.leftStBar : el.rightStBar).style.width = `${clamp(stamina, 0, 100)}%`;

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

    item.textContent = `R${step.round} · #${step.step} · ${step.distance.band} · ${step.fighters.left.action} / ${step.fighters.right.action} · ${step.events.join(', ')}`;
    el.history.appendChild(item);
  });
}

loadTimeline().catch((error) => {
  console.error(error);
  el.notes.textContent = `Could not load timeline: ${error.message}`;
});
