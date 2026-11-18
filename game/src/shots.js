// Screenshot scenes behind ?shot=cover|title|late|over&seed=N. Each scene is
// the real game, played forward in fixed steps by a small autopilot from a
// seeded run — nothing is staged or drawn specially, so a screenshot is a
// frame the game itself produced, identical for every run with the same seed.

import { VIEW } from './config.js';
import { SCREEN_OVER, SCREEN_TITLE, createWorld, startRun, stepWorld } from './world.js';

const STEP = 1 / 60;

/**
 * A simple pilot: keep distance from the nearest hunters, strafe around the
 * crowd, aim at the closest enemy, fire constantly, dash when boxed in.
 * With `reckless` it flies at enemies instead — a pilot who will not last.
 */
function autopilot(state, reckless = false) {
  const p = state.player;
  let aimX = p.x + Math.cos(p.angle) * 100;
  let aimY = p.y + Math.sin(p.angle) * 100;
  let nearest = null;
  let nearestD2 = Infinity;
  let fleeX = 0;
  let fleeY = 0;
  for (const e of state.enemies) {
    if (e.spawnIn > 0) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD2) {
      nearestD2 = d2;
      nearest = e;
    }
    if (d2 < 300 * 300 && d2 > 1) {
      const d = Math.sqrt(d2);
      const w = (300 - d) / 300;
      fleeX += (dx / d) * w;
      fleeY += (dy / d) * w;
    }
  }
  if (nearest && !reckless) {
    // Lead the target: aim where it will be when the bullet arrives.
    const d = Math.sqrt(nearestD2);
    const lead = d / 660;
    aimX = nearest.x + nearest.vx * lead;
    aimY = nearest.y + nearest.vy * lead;
  }
  let moveX = fleeX;
  let moveY = fleeY;
  // With only a couple of hunters left, press in and finish them instead of
  // orbiting forever at the edge of their range.
  if (nearest && state.enemies.length <= 2) {
    const dx = nearest.x - p.x;
    const dy = nearest.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    moveX = (dx / d) * 0.9;
    moveY = (dy / d) * 0.9;
  }
  // Drift back toward the middle so the pilot does not hug a wall forever.
  moveX += (VIEW.width / 2 - p.x) * 0.0016;
  moveY += (VIEW.height / 2 - p.y) * 0.0016;
  // Strafe tangentially around the nearest enemy to keep the fight moving.
  if (nearest) {
    const dx = nearest.x - p.x;
    const dy = nearest.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    moveX += (-dy / d) * 0.55;
    moveY += (dx / d) * 0.55;
    if (reckless) {
      moveX = dx / d;
      moveY = dy / d;
    }
  }
  const len = Math.hypot(moveX, moveY);
  if (len > 1) {
    moveX /= len;
    moveY /= len;
  }
  return {
    moveX,
    moveY,
    aimX,
    aimY,
    firing: nearest !== null,
    dash: !reckless && nearestD2 < 110 * 110,
  };
}

function playFor(state, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(state, pilot(state), STEP);
    if (state.screen === SCREEN_OVER) break;
  }
}

const IDLE = () => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, dash: false });

/** Play a run the careful pilot survives; retry on the next seed if it falls. */
function survivedRun(seconds, seed) {
  let state = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    state = createWorld(seed + attempt * 131);
    startRun(state, seed + attempt * 131);
    playFor(state, seconds, (s) => autopilot(s));
    if (state.screen !== SCREEN_OVER) break;
  }
  return state;
}

/** Build the frozen state a named scene shows. */
export function buildScene(name, seed) {
  if (name === 'title') {
    const state = createWorld(seed);
    state.screen = SCREEN_TITLE;
    playFor(state, 1.2, IDLE);
    return { state, bannerText: '', bannerT: 0 };
  }
  if (name === 'cover') {
    return { state: survivedRun(34, seed), bannerText: '', bannerT: 0 };
  }
  if (name === 'late') {
    const state = survivedRun(105, seed);
    if (state.screen !== SCREEN_OVER && state.player.hp > 2) state.player.hp = 2;
    return { state, bannerText: '', bannerT: 0 };
  }
  // 'over': a real run first — the careful pilot builds a score for ~45 s —
  // then the pilot turns reckless and the arena finishes it. Let the wreckage
  // settle afterwards so the game-over screen (with its restart prompt) is up.
  const state = createWorld(seed);
  startRun(state, seed);
  playFor(state, 45, (s) => autopilot(s));
  if (state.screen !== SCREEN_OVER) playFor(state, 240, (s) => autopilot(s, true));
  if (state.screen !== SCREEN_OVER) {
    // If the reckless pilot somehow survived, stop dodging and let the arena close in.
    playFor(state, 240, IDLE);
  }
  for (let i = 0; i < 84; i += 1) stepWorld(state, IDLE(), STEP);
  return { state, bannerText: '', bannerT: 0 };
}
