/* ===== Arena Observer – Animated Fight Viewer ===== */

const state = {
  timeline: null,
  index: 0,
  timer: null,
  animating: false,
};

/* ---- DOM refs ---- */
const $ = (sel) => document.querySelector(sel);
const el = {
  arena: $('#arena'),
  roundDisplay: $('#round-display'),
  summary: $('#summary'),
  eventTags: $('#event-tags'),
  stepInfo: $('#step-info'),
  impactText: $('#impact-text'),
  dmgLeft: $('#dmg-left'),
  dmgRight: $('#dmg-right'),
  fighterLeft: $('#fighter-left'),
  fighterRight: $('#fighter-right'),
  leftName: $('#left-name'),
  rightName: $('#right-name'),
  leftHpFill: $('#left-hp-fill'),
  rightHpFill: $('#right-hp-fill'),
  leftStFill: $('#left-st-fill'),
  rightStFill: $('#right-st-fill'),
  leftHpVal: $('#left-hp-val'),
  rightHpVal: $('#right-hp-val'),
  leftStVal: $('#left-st-val'),
  rightStVal: $('#right-st-val'),
  btnPrev: $('#btn-prev'),
  btnNext: $('#btn-next'),
  btnPlay: $('#btn-play'),
  btnReset: $('#btn-reset'),
  speedSlider: $('#speed-slider'),
};

/* ---- Event → display label mapping ---- */
const EVENT_MAP = {
  ko:                  { text: 'KO',            cls: 'tag-ko' },
  critical_hp:         { text: 'CRITICAL',      cls: 'tag-danger' },
  guard_break_success: { text: 'GUARD BREAK',   cls: 'tag-warn' },
  heavy_hit:           { text: 'HEAVY HIT',     cls: 'tag-danger' },
  light_hit:           { text: 'HIT',           cls: 'tag-info' },
  blocked:             { text: 'BLOCKED',       cls: 'tag-muted' },
  whiff:               { text: 'WHIFF',         cls: 'tag-muted' },
  disengage_attempt:   { text: 'DISENGAGE',     cls: 'tag-info' },
  close_distance:      { text: 'CLOSING',       cls: 'tag-info' },
  match_start:         { text: 'FIGHT!',        cls: 'tag-accent' },
  round_start:         { text: 'NEW ROUND',     cls: 'tag-muted' },
  exhausted:           { text: 'EXHAUSTED',     cls: 'tag-warn' },
  punish:              { text: 'PUNISH',        cls: 'tag-danger' },
  rest_punished:       { text: 'REST PUNISHED', cls: 'tag-danger' },
  chip_damage:         { text: 'CHIP',          cls: 'tag-muted' },
};

/* ---- Impact text triggers (priority order) ---- */
const IMPACT_PRIORITY = ['ko', 'guard_break_success', 'heavy_hit', 'rest_punished', 'punish', 'critical_hp', 'light_hit'];

/* ---- Helpers ---- */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function laneToPositions(lanePct) {
  // lanePct: 0 = touching, 100 = max distance
  // Returns left% positions for each fighter within the arena
  const margin = 8; // % from edges
  const spread = clamp(lanePct, 0, 100) / 100;
  const center = 50;
  const maxHalf = center - margin;
  const leftPos = center - spread * maxHalf;
  const rightPos = center + spread * maxHalf;
  return { leftPct: leftPos, rightPct: rightPos };
}

function getSpeed() {
  return parseInt(el.speedSlider.value, 10);
}

function getPrevStep() {
  if (state.index <= 0) return null;
  return state.timeline.steps[state.index - 1];
}

/* ---- Load ---- */
async function loadTimeline() {
  try {
    const resp = await fetch('./data/mock-match-timeline.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    state.timeline = await resp.json();
    init();
  } catch (err) {
    el.summary.textContent = `Failed to load timeline: ${err.message}`;
  }
}

/* ---- Init ---- */
function init() {
  const { fighters } = state.timeline;
  el.leftName.textContent = fighters.left.name;
  el.rightName.textContent = fighters.right.name;

  el.btnPrev.addEventListener('click', () => goStep(state.index - 1));
  el.btnNext.addEventListener('click', () => goStep(state.index + 1));
  el.btnReset.addEventListener('click', () => { stopAutoplay(); goStep(0); });
  el.btnPlay.addEventListener('click', toggleAutoplay);

  renderStep(true);
}

/* ---- Navigation ---- */
function goStep(idx) {
  if (state.animating) return;
  const max = state.timeline.steps.length - 1;
  state.index = clamp(idx, 0, max);
  renderStep(false);
}

/* ---- Autoplay ---- */
function toggleAutoplay() {
  if (state.timer) { stopAutoplay(); return; }
  el.btnPlay.textContent = 'Pause';
  scheduleNext();
}

function scheduleNext() {
  const max = state.timeline.steps.length - 1;
  if (state.index >= max) { stopAutoplay(); return; }
  state.timer = setTimeout(() => {
    state.index++;
    renderStep(false);
    scheduleNext();
  }, getSpeed());
}

function stopAutoplay() {
  clearTimeout(state.timer);
  state.timer = null;
  el.btnPlay.textContent = 'Play';
}

/* ===== RENDER ===== */
function renderStep(instant) {
  const step = state.timeline.steps[state.index];
  const prev = getPrevStep();
  const left = step.fighters.left;
  const right = step.fighters.right;

  // HUD
  el.roundDisplay.textContent = `ROUND ${step.round}`;
  el.stepInfo.textContent = `${state.index + 1} / ${state.timeline.steps.length}`;
  el.summary.textContent = step.summary || '';

  // Event tags
  renderEventTags(step.events);

  // HP / Stamina bars
  updateBar(el.leftHpFill, el.leftHpVal, left.hp, 100);
  updateBar(el.rightHpFill, el.rightHpVal, right.hp, 100);
  updateBar(el.leftStFill, el.leftStVal, left.stamina, 100);
  updateBar(el.rightStFill, el.rightStVal, right.stamina, 100);

  // Fighter positions
  const pos = laneToPositions(step.distance.lane);
  el.fighterLeft.style.left = `calc(${pos.leftPct}% - 30px)`;
  el.fighterRight.style.left = `calc(${pos.rightPct}% - 30px)`;

  if (instant) return;

  // Animate actions
  animateActions(step, prev);
}

function updateBar(fillEl, valEl, value, max) {
  const pct = clamp((value / max) * 100, 0, 100);
  fillEl.style.width = `${pct}%`;
  valEl.textContent = value;

  // HP bar color via background-position (gradient trick)
  if (fillEl.classList.contains('hp-fill')) {
    // 0% hp → show red (left of gradient), 100% → show green (right)
    fillEl.style.backgroundPosition = `${100 - pct}% 0`;
  }
}

function renderEventTags(events) {
  el.eventTags.innerHTML = '';
  events.forEach((evt) => {
    const cfg = EVENT_MAP[evt];
    const span = document.createElement('span');
    span.className = `event-tag ${cfg ? cfg.cls : 'tag-muted'}`;
    span.textContent = cfg ? cfg.text : evt.toUpperCase().replace(/_/g, ' ');
    el.eventTags.appendChild(span);
  });
}

/* ===== ANIMATIONS ===== */

function animateActions(step, prev) {
  const leftAction = step.fighters.left.action;
  const rightAction = step.fighters.right.action;
  const events = step.events;

  // Clear previous animations
  clearAnimClasses(el.fighterLeft);
  clearAnimClasses(el.fighterRight);

  // Force reflow so animations restart
  void el.fighterLeft.offsetWidth;
  void el.fighterRight.offsetWidth;

  // Apply action animations
  el.fighterLeft.classList.add(`anim-${leftAction}`);
  el.fighterRight.classList.add(`anim-${rightAction}`);

  // Calculate damage deltas
  const leftDmg = prev ? prev.fighters.left.hp - step.fighters.left.hp : 0;
  const rightDmg = prev ? prev.fighters.right.hp - step.fighters.right.hp : 0;

  // Determine who got hit based on HP decrease
  const animDelay = 200; // ms before showing hit reaction

  // Hit reactions & damage popups
  if (leftDmg > 0) {
    setTimeout(() => {
      showHitReaction(el.fighterLeft, leftDmg, events.includes('ko') && step.fighters.left.hp <= 0);
      showDamagePopup(el.dmgLeft, leftDmg, el.fighterLeft);
    }, animDelay);
  }
  if (rightDmg > 0) {
    setTimeout(() => {
      showHitReaction(el.fighterRight, rightDmg, events.includes('ko') && step.fighters.right.hp <= 0);
      showDamagePopup(el.dmgRight, rightDmg, el.fighterRight);
    }, animDelay);
  }

  // Stamina recovery popup
  if (prev) {
    const leftStGain = step.fighters.left.stamina - prev.fighters.left.stamina;
    const rightStGain = step.fighters.right.stamina - prev.fighters.right.stamina;
    if (leftStGain > 5) {
      setTimeout(() => showDamagePopup(el.dmgLeft, leftStGain, el.fighterLeft, true), animDelay);
    }
    if (rightStGain > 5) {
      setTimeout(() => showDamagePopup(el.dmgRight, rightStGain, el.fighterRight, true), animDelay);
    }
  }

  // Impact text for significant events
  const impactEvt = IMPACT_PRIORITY.find((e) => events.includes(e));
  if (impactEvt) {
    const cfg = EVENT_MAP[impactEvt];
    setTimeout(() => showImpactText(cfg ? cfg.text : impactEvt), animDelay + 50);
  }

  // Screen shake on heavy events
  if (events.includes('ko') || events.includes('heavy_hit') || events.includes('guard_break_success')) {
    setTimeout(() => {
      el.arena.classList.remove('screen-shake');
      void el.arena.offsetWidth;
      el.arena.classList.add('screen-shake');
    }, animDelay);
  }
}

const ANIM_CLASSES = [
  'anim-light_attack', 'anim-heavy_attack', 'anim-poke', 'anim-guard_break',
  'anim-block', 'anim-retreat_guard', 'anim-dash_forward', 'anim-dash_back',
  'anim-rest', 'anim-observe', 'hit-flash', 'ko-fall',
];

function clearAnimClasses(fighterEl) {
  ANIM_CLASSES.forEach((cls) => fighterEl.classList.remove(cls));
}

function showHitReaction(fighterEl, dmg, isKo) {
  if (isKo) {
    fighterEl.classList.add('ko-fall');
  } else {
    fighterEl.classList.add('hit-flash');
    setTimeout(() => fighterEl.classList.remove('hit-flash'), 350);
  }
}

function showDamagePopup(popupEl, value, fighterEl, isHeal) {
  const rect = fighterEl.getBoundingClientRect();
  const arenaRect = el.arena.getBoundingClientRect();
  popupEl.style.left = `${rect.left - arenaRect.left + 15}px`;
  popupEl.style.top = `${rect.top - arenaRect.top - 10}px`;
  popupEl.textContent = isHeal ? `+${value}` : `-${value}`;
  popupEl.className = `damage-popup show${isHeal ? ' heal' : ''}`;

  // Reset after animation
  setTimeout(() => { popupEl.className = 'damage-popup'; }, 800);
}

function showImpactText(text) {
  el.impactText.textContent = text;
  el.impactText.className = 'impact-text show';
  setTimeout(() => { el.impactText.className = 'impact-text'; }, 700);
}

/* ---- Boot ---- */
loadTimeline();
