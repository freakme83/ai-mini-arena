/* ===== Arena Observer – Animated Fight Viewer ===== */

const state = {
  timeline: null,
  index: 0,
  timer: null,
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
  contactSpark: $('#contact-spark'),
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

/* ---- Constants ---- */
const ATTACK_ACTIONS = new Set(['light_attack', 'heavy_attack', 'poke', 'guard_break']);
const FIGHTER_WIDTH = 60; // px, matches CSS

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

const IMPACT_PRIORITY = ['ko', 'guard_break_success', 'heavy_hit', 'rest_punished', 'punish', 'critical_hp'];

/* Lunge durations per action type (ms) */
const LUNGE_DURATION = {
  light_attack: 400,
  heavy_attack: 600,
  poke: 350,
  guard_break: 550,
};

/* ---- Helpers ---- */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function laneToPositions(lanePct) {
  const margin = 8;
  const spread = clamp(lanePct, 0, 100) / 100;
  const center = 50;
  const maxHalf = center - margin;
  return {
    leftPct: center - spread * maxHalf,
    rightPct: center + spread * maxHalf,
  };
}

function getSpeed() {
  return parseInt(el.speedSlider.value, 10);
}

function getPrevStep() {
  if (state.index <= 0) return null;
  return state.timeline.steps[state.index - 1];
}

/**
 * Get the pixel gap between the right edge of the left fighter
 * and the left edge of the right fighter.
 */
function getFighterGapPx() {
  const lRect = el.fighterLeft.getBoundingClientRect();
  const rRect = el.fighterRight.getBoundingClientRect();
  return rRect.left - (lRect.left + lRect.width);
}

/**
 * Get the midpoint (in arena-relative coords) between the two fighters.
 */
function getContactPoint() {
  const aRect = el.arena.getBoundingClientRect();
  const lRect = el.fighterLeft.getBoundingClientRect();
  const rRect = el.fighterRight.getBoundingClientRect();
  const lCenter = lRect.left + lRect.width;
  const rCenter = rRect.left;
  return {
    x: (lCenter + rCenter) / 2 - aRect.left,
    y: (lRect.top + lRect.height * 0.35) - aRect.top, // chest height
  };
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

  // HUD text
  el.roundDisplay.textContent = `ROUND ${step.round}`;
  el.stepInfo.textContent = `${state.index + 1} / ${state.timeline.steps.length}`;
  el.summary.textContent = step.summary || '';
  renderEventTags(step.events);

  // Fighter positions (base positioning via CSS left)
  const pos = laneToPositions(step.distance.lane);
  el.fighterLeft.style.left = `calc(${pos.leftPct}% - 30px)`;
  el.fighterRight.style.left = `calc(${pos.rightPct}% - 30px)`;

  if (instant) {
    // First render: set bars immediately
    updateBar(el.leftHpFill, el.leftHpVal, left.hp, 100);
    updateBar(el.rightHpFill, el.rightHpVal, right.hp, 100);
    updateBar(el.leftStFill, el.leftStVal, left.stamina, 100);
    updateBar(el.rightStFill, el.rightStVal, right.stamina, 100);
    return;
  }

  // Animate actions, then update bars at impact
  animateActions(step, prev);
}

function updateBar(fillEl, valEl, value, max) {
  const pct = clamp((value / max) * 100, 0, 100);
  fillEl.style.width = `${pct}%`;
  valEl.textContent = value;
  if (fillEl.classList.contains('hp-fill')) {
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

/* ===== ANIMATION SYSTEM ===== */

const ANIM_CLASSES = [
  'anim-light_attack', 'anim-heavy_attack', 'anim-poke', 'anim-guard_break',
  'anim-block', 'anim-retreat_guard', 'anim-dash_forward', 'anim-dash_back',
  'anim-rest', 'anim-observe', 'hit-flash', 'ko-fall',
];

function clearAnimClasses(fighterEl) {
  ANIM_CLASSES.forEach((cls) => fighterEl.classList.remove(cls));
}

function animateActions(step, prev) {
  const leftAction = step.fighters.left.action;
  const rightAction = step.fighters.right.action;
  const events = step.events;

  // --- Clear previous state ---
  clearAnimClasses(el.fighterLeft);
  clearAnimClasses(el.fighterRight);
  el.contactSpark.className = 'contact-spark';
  void el.fighterLeft.offsetWidth; // force reflow

  // --- Damage deltas ---
  const leftTookDmg = prev ? prev.fighters.left.hp - step.fighters.left.hp : 0;
  const rightTookDmg = prev ? prev.fighters.right.hp - step.fighters.right.hp : 0;

  const leftIsAttack = ATTACK_ACTIONS.has(leftAction);
  const rightIsAttack = ATTACK_ACTIONS.has(rightAction);

  // Did the attack connect? (opponent lost HP)
  const leftConnected = leftIsAttack && rightTookDmg > 0;
  const rightConnected = rightIsAttack && leftTookDmg > 0;

  // --- Apply CSS body-part animations (arms, shield, etc.) ---
  el.fighterLeft.classList.add(`anim-${leftAction}`);
  el.fighterRight.classList.add(`anim-${rightAction}`);

  // --- Calculate the pixel gap between fighters ---
  // We need to wait a frame for the new CSS `left` positions to apply
  requestAnimationFrame(() => {
    const gap = getFighterGapPx();

    // --- Compute lunge distances ---
    let leftLungePx = 0;
    let rightLungePx = 0;

    if (leftConnected && rightConnected) {
      // Both attacks connect: meet in the middle
      const halfGap = gap / 2 + FIGHTER_WIDTH * 0.3;
      leftLungePx = halfGap;
      rightLungePx = -halfGap;
    } else if (leftConnected) {
      // Left attacks, right got hit → left lunges most of the gap
      leftLungePx = gap + FIGHTER_WIDTH * 0.3;
    } else if (rightConnected) {
      // Right attacks, left got hit → right lunges
      rightLungePx = -(gap + FIGHTER_WIDTH * 0.3);
    } else if (leftIsAttack && !leftConnected) {
      // Left swung but missed (whiff) → short lunge
      leftLungePx = Math.min(gap * 0.25, 50);
    } else if (rightIsAttack && !rightConnected) {
      rightLungePx = -Math.min(gap * 0.25, 50);
    }

    // Non-attack moves that close distance (dash_forward)
    if (leftAction === 'dash_forward' && !leftIsAttack) {
      leftLungePx = Math.min(gap * 0.4, 80);
    }
    if (rightAction === 'dash_forward' && !rightIsAttack) {
      rightLungePx = -Math.min(gap * 0.4, 80);
    }

    // --- Determine timing ---
    const attackAction = leftIsAttack ? leftAction : rightIsAttack ? rightAction : null;
    const duration = attackAction ? (LUNGE_DURATION[attackAction] || 450) : 450;
    const peakOffset = 0.38; // fraction of duration where contact happens
    const peakMs = duration * peakOffset;

    // --- Animate lunges via Web Animations API ---
    if (leftLungePx !== 0) {
      el.fighterLeft.animate([
        { transform: 'translateX(0)' },
        { transform: `translateX(${leftLungePx}px)`, offset: peakOffset },
        { transform: 'translateX(0)' },
      ], { duration, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'none' });
    }

    if (rightLungePx !== 0) {
      el.fighterRight.animate([
        { transform: 'translateX(0)' },
        { transform: `translateX(${rightLungePx}px)`, offset: peakOffset },
        { transform: 'translateX(0)' },
      ], { duration, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'none' });
    }

    // --- At peak: show contact effects ---
    const anyConnected = leftConnected || rightConnected;

    setTimeout(() => {
      if (anyConnected) {
        showContactSpark(events, leftConnected, rightConnected);
      }

      // Hit reactions on the defender(s)
      if (rightTookDmg > 0) {
        const isKo = events.includes('ko') && step.fighters.right.hp <= 0;
        showHitReaction(el.fighterRight, isKo);
        showDamagePopup(el.dmgRight, rightTookDmg, el.fighterRight, false);
      }
      if (leftTookDmg > 0) {
        const isKo = events.includes('ko') && step.fighters.left.hp <= 0;
        showHitReaction(el.fighterLeft, isKo);
        showDamagePopup(el.dmgLeft, leftTookDmg, el.fighterLeft, false);
      }

      // Update HP/stamina bars at moment of impact (not before)
      updateBar(el.leftHpFill, el.leftHpVal, step.fighters.left.hp, 100);
      updateBar(el.rightHpFill, el.rightHpVal, step.fighters.right.hp, 100);
      updateBar(el.leftStFill, el.leftStVal, step.fighters.left.stamina, 100);
      updateBar(el.rightStFill, el.rightStVal, step.fighters.right.stamina, 100);

      // Impact text
      const impactEvt = IMPACT_PRIORITY.find((e) => events.includes(e));
      if (impactEvt) {
        const cfg = EVENT_MAP[impactEvt];
        showImpactText(cfg ? cfg.text : impactEvt);
      }

      // Screen shake on heavy impacts
      if (events.includes('ko') || events.includes('heavy_hit') || events.includes('guard_break_success')) {
        el.arena.classList.remove('screen-shake');
        void el.arena.offsetWidth;
        el.arena.classList.add('screen-shake');
      }
    }, peakMs);

    // Stamina recovery popup (after lunge settles)
    if (prev) {
      const leftStGain = step.fighters.left.stamina - prev.fighters.left.stamina;
      const rightStGain = step.fighters.right.stamina - prev.fighters.right.stamina;
      setTimeout(() => {
        if (leftStGain > 5) showDamagePopup(el.dmgLeft, leftStGain, el.fighterLeft, true);
        if (rightStGain > 5) showDamagePopup(el.dmgRight, rightStGain, el.fighterRight, true);
      }, peakMs + 200);
    }
  });
}

/* ---- Contact Spark ---- */
function showContactSpark(events, leftHit, rightHit) {
  const pt = getContactPoint();
  el.contactSpark.style.left = `${pt.x}px`;
  el.contactSpark.style.top = `${pt.y}px`;

  // Determine spark intensity
  const isHeavy = events.includes('guard_break_success') || events.includes('heavy_hit') || events.includes('ko');
  const isBlocked = events.includes('blocked') || events.includes('chip_damage');

  el.contactSpark.className = 'contact-spark show'
    + (isHeavy ? ' heavy' : '')
    + (isBlocked && !isHeavy ? ' blocked' : '');

  // Clear after animation
  setTimeout(() => { el.contactSpark.className = 'contact-spark'; }, 500);
}

/* ---- Hit Reaction ---- */
function showHitReaction(fighterEl, isKo) {
  if (isKo) {
    fighterEl.classList.add('ko-fall');
  } else {
    fighterEl.classList.add('hit-flash');
    setTimeout(() => fighterEl.classList.remove('hit-flash'), 350);
  }
}

/* ---- Damage Popup ---- */
function showDamagePopup(popupEl, value, fighterEl, isHeal) {
  const rect = fighterEl.getBoundingClientRect();
  const arenaRect = el.arena.getBoundingClientRect();
  popupEl.style.left = `${rect.left - arenaRect.left + rect.width / 2 - 10}px`;
  popupEl.style.top = `${rect.top - arenaRect.top - 5}px`;
  popupEl.textContent = isHeal ? `+${value}` : `-${value}`;
  popupEl.className = `damage-popup show${isHeal ? ' heal' : ''}`;
  setTimeout(() => { popupEl.className = 'damage-popup'; }, 900);
}

/* ---- Impact Text ---- */
function showImpactText(text) {
  el.impactText.textContent = text;
  el.impactText.className = 'impact-text';
  void el.impactText.offsetWidth;
  el.impactText.className = 'impact-text show';
  setTimeout(() => { el.impactText.className = 'impact-text'; }, 700);
}

/* ---- Boot ---- */
loadTimeline();
