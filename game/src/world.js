// The VOIDSPARK simulation: player, bullets, four enemy kinds, cores, particles
// and floating score popups, advanced in fixed steps by stepWorld. It knows
// nothing about the DOM; input arrives as a plain intent object and sound
// requests leave as event names in state.events for the shell to play.

import { COLORS, COMBO, CORES_PER_HEAL, ENEMY_TYPES, PLAYER, VIEW, WAVE } from './config.js';
import { makeRng, range } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

export function createWorld(seed = 1) {
  return {
    rng: makeRng(seed),
    screen: SCREEN_TITLE,
    paused: false,
    time: 0,
    score: 0,
    best: 0,
    kills: 0,
    coresHeld: 0,
    comboCount: 0,
    comboTimer: 0,
    wave: 0,
    waveState: 'idle', // idle | spawning | active | intermission
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    shake: 0,
    flash: 0,
    overTimer: 0,
    events: [],
    player: freshPlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    cores: [],
    particles: [],
    popups: [],
  };
}

function freshPlayer() {
  return {
    x: VIEW.width / 2,
    y: VIEW.height / 2,
    radius: PLAYER.radius,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: PLAYER.hp,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashDirX: 1,
    dashDirY: 0,
    invulnTimer: 0,
    alive: true,
  };
}

/** Start (or restart) a run: reset everything and open wave 1. A seed may be
 * passed to make the run reproducible (the screenshot scenes do this). */
export function startRun(state, seed = (Math.random() * 1e9) | 0) {
  const best = state.best;
  Object.assign(state, createWorld(seed));
  state.best = best;
  state.screen = SCREEN_PLAY;
  beginWave(state, 1);
}

export function comboMultiplier(state) {
  return 1 + Math.min(COMBO.maxBonus, Math.floor(state.comboCount / COMBO.killsPerStep));
}

function beginWave(state, n) {
  state.wave = n;
  state.waveState = 'spawning';
  state.spawnTimer = 0.4;
  const queue = [];
  const count = WAVE.baseCount + WAVE.perWave * (n - 1);
  for (let i = 0; i < count; i += 1) queue.push('drifter');
  if (n >= 2) for (let i = 0; i < Math.floor(count * 0.3); i += 1) queue.push('dart');
  if (n >= 2) for (let i = 0; i < Math.floor(n / 2); i += 1) queue.push('bulwark');
  if (n >= 3) for (let i = 0; i < Math.floor(count * 0.22); i += 1) queue.push('spitter');
  // Shuffle so kinds arrive mixed, then deal the queue out over the wave.
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(state.rng() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  state.spawnQueue = queue;
  state.events.push('wave');
}

function spawnPoint(state) {
  const side = Math.floor(state.rng() * 4);
  const m = 30;
  let x = m;
  let y = m;
  if (side === 0) { x = range(state.rng, m, VIEW.width - m); y = m; }
  if (side === 1) { x = VIEW.width - m; y = range(state.rng, m, VIEW.height - m); }
  if (side === 2) { x = range(state.rng, m, VIEW.width - m); y = VIEW.height - m; }
  if (side === 3) { x = m; y = range(state.rng, m, VIEW.height - m); }
  // Never spawn on top of the player: nudge the point away if it lands close.
  const dx = x - state.player.x;
  const dy = y - state.player.y;
  if (dx * dx + dy * dy < 240 * 240) {
    x = VIEW.width - x;
    y = VIEW.height - y;
  }
  return { x, y };
}

function spawnEnemy(state, kind) {
  const spec = ENEMY_TYPES[kind];
  const at = spawnPoint(state);
  const speedScale = 1 + (state.wave - 1) * 0.045;
  state.enemies.push({
    kind,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp: spec.hp + (kind === 'bulwark' ? (state.wave - 2) * 2 : 0),
    maxHp: spec.hp,
    speed: spec.speed * speedScale * range(state.rng, 0.9, 1.1),
    angle: 0,
    age: 0,
    lungeTimer: range(state.rng, 1.2, 2.4),
    lungeTime: 0,
    fireTimer: range(state.rng, 1.4, 2.6),
    strafeDir: state.rng() < 0.5 ? -1 : 1,
    flash: 0,
    spawnIn: 0.45,
  });
}

export function burst(state, x, y, color, count, speed = 260, life = 0.55, size = 3.4) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * TAU;
    const s = speed * (0.25 + state.rng() * 0.95);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: life * (0.5 + state.rng() * 0.8),
      maxLife: life,
      size: size * (0.6 + state.rng() * 0.9),
      color,
    });
  }
}

function popup(state, x, y, text, color = COLORS.text, size = 17) {
  state.popups.push({ x, y, text, color, size, life: 0.9, maxLife: 0.9 });
}

function damagePlayer(state) {
  const p = state.player;
  if (p.invulnTimer > 0 || !p.alive) return;
  p.hp -= 1;
  p.invulnTimer = 1.1;
  state.comboCount = 0;
  state.comboTimer = 0;
  state.shake = Math.max(state.shake, 13);
  state.flash = 0.55;
  burst(state, p.x, p.y, COLORS.danger, 22, 320, 0.6, 4);
  state.events.push('hurt');
  if (p.hp <= 0) {
    p.alive = false;
    state.screen = SCREEN_OVER;
    state.overTimer = 0;
    state.best = Math.max(state.best, state.score);
    burst(state, p.x, p.y, COLORS.player, 70, 430, 1.1, 4.6);
    burst(state, p.x, p.y, COLORS.core, 30, 300, 0.9, 3.6);
    state.shake = 22;
    state.events.push('over');
  }
}

function killEnemy(state, index) {
  const e = state.enemies[index];
  const spec = ENEMY_TYPES[e.kind];
  state.enemies.splice(index, 1);
  state.kills += 1;
  state.comboCount += 1;
  state.comboTimer = COMBO.window;
  const gained = spec.score * comboMultiplier(state);
  state.score += gained;
  popup(state, e.x, e.y - e.radius - 4, `+${gained}`, spec.color, e.kind === 'bulwark' ? 21 : 16);
  burst(state, e.x, e.y, spec.color, e.kind === 'bulwark' ? 42 : 20, e.kind === 'bulwark' ? 360 : 290, 0.65, 3.8);
  state.shake = Math.max(state.shake, e.kind === 'bulwark' ? 11 : 4.5);
  state.events.push(e.kind === 'bulwark' ? 'boomBig' : 'boom');
  for (let i = 0; i < spec.cores; i += 1) {
    const a = state.rng() * TAU;
    state.cores.push({
      x: e.x, y: e.y,
      vx: Math.cos(a) * range(state.rng, 30, 120),
      vy: Math.sin(a) * range(state.rng, 30, 120),
      age: 0,
    });
  }
  if (e.kind === 'bulwark') {
    for (let i = 0; i < 2; i += 1) {
      spawnEnemy(state, 'drifter');
      const child = state.enemies[state.enemies.length - 1];
      child.x = e.x + (i === 0 ? -22 : 22);
      child.y = e.y + (i === 0 ? 10 : -10);
      child.spawnIn = 0.15;
    }
  }
}

function stepPlayer(state, intent, dt) {
  const p = state.player;
  if (!p.alive) return;
  p.angle = Math.atan2(intent.aimY - p.y, intent.aimX - p.x);
  p.fireTimer -= dt;
  p.dashCooldown -= dt;
  p.invulnTimer -= dt;

  if (intent.dash && p.dashCooldown <= 0 && p.dashTimer <= 0) {
    const hasMove = intent.moveX !== 0 || intent.moveY !== 0;
    p.dashDirX = hasMove ? intent.moveX : Math.cos(p.angle);
    p.dashDirY = hasMove ? intent.moveY : Math.sin(p.angle);
    p.dashTimer = PLAYER.dashTime;
    p.dashCooldown = PLAYER.dashCooldown;
    p.invulnTimer = Math.max(p.invulnTimer, PLAYER.dashTime + 0.08);
    state.events.push('dash');
  }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.vx = p.dashDirX * PLAYER.dashSpeed;
    p.vy = p.dashDirY * PLAYER.dashSpeed;
    state.particles.push({
      x: p.x, y: p.y, vx: -p.dashDirX * 40, vy: -p.dashDirY * 40,
      life: 0.3, maxLife: 0.3, size: 5, color: COLORS.player,
    });
  } else {
    p.vx += intent.moveX * PLAYER.accel * dt;
    p.vy += intent.moveY * PLAYER.accel * dt;
    const damp = Math.max(0, 1 - PLAYER.friction * dt);
    if (intent.moveX === 0) p.vx *= damp;
    if (intent.moveY === 0) p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER.speed) {
      p.vx = (p.vx / speed) * PLAYER.speed;
      p.vy = (p.vy / speed) * PLAYER.speed;
    }
  }
  p.x = Math.min(VIEW.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
  p.y = Math.min(VIEW.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));

  if (intent.firing && p.fireTimer <= 0) {
    p.fireTimer = 1 / PLAYER.fireRate;
    const spread = range(state.rng, -0.035, 0.035);
    const a = p.angle + spread;
    state.bullets.push({
      x: p.x + Math.cos(p.angle) * (p.radius + 6),
      y: p.y + Math.sin(p.angle) * (p.radius + 6),
      vx: Math.cos(a) * PLAYER.bulletSpeed,
      vy: Math.sin(a) * PLAYER.bulletSpeed,
      life: PLAYER.bulletLife,
    });
    state.events.push('shoot');
  }
}

function stepEnemy(state, e, dt) {
  const p = state.player;
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt * 6);
  if (e.spawnIn > 0) {
    e.spawnIn -= dt;
    return;
  }
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  e.angle = Math.atan2(dy, dx);

  if (e.kind === 'drifter') {
    e.vx += ux * 340 * dt;
    e.vy += uy * 340 * dt;
  } else if (e.kind === 'dart') {
    e.lungeTimer -= dt;
    if (e.lungeTime > 0) {
      e.lungeTime -= dt;
    } else if (e.lungeTimer <= 0) {
      e.lungeTime = 0.42;
      e.lungeTimer = range(state.rng, 1.6, 2.6);
      e.vx = ux * 430;
      e.vy = uy * 430;
    } else {
      e.vx += ux * 300 * dt;
      e.vy += uy * 300 * dt;
    }
  } else if (e.kind === 'bulwark') {
    e.vx += ux * 130 * dt;
    e.vy += uy * 130 * dt;
  } else if (e.kind === 'spitter') {
    const want = dist > 300 ? 1 : dist < 210 ? -1 : 0;
    e.vx += (ux * want * 260 + -uy * e.strafeDir * 120) * dt;
    e.vy += (uy * want * 260 + ux * e.strafeDir * 120) * dt;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && dist < 560 && p.alive) {
      e.fireTimer = range(state.rng, 2.0, 2.8);
      state.enemyBullets.push({ x: e.x, y: e.y, vx: ux * 215, vy: uy * 215, life: 3.4 });
    }
  }

  if (e.kind !== 'dart' || e.lungeTime <= 0) {
    const speed = Math.hypot(e.vx, e.vy);
    if (speed > e.speed) {
      e.vx = (e.vx / speed) * e.speed;
      e.vy = (e.vy / speed) * e.speed;
    }
  }
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = Math.min(VIEW.width - e.radius, Math.max(e.radius, e.x));
  e.y = Math.min(VIEW.height - e.radius, Math.max(e.radius, e.y));
}

/** Advance the whole game by dt seconds. intent: {moveX, moveY, aimX, aimY, firing, dash}. */
export function stepWorld(state, intent, dt) {
  state.time += dt;
  state.events.length = 0;
  state.shake = Math.max(0, state.shake - dt * 34);
  state.flash = Math.max(0, state.flash - dt * 1.6);
  if (state.screen === SCREEN_OVER) state.overTimer += dt;

  // Combo decays when the kill chain goes quiet.
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.comboCount = 0;
  }

  if (state.screen === SCREEN_PLAY && !state.paused) {
    stepPlayer(state, intent, dt);

    // Wave flow: deal spawns, watch for a clear wave, run the intermission.
    if (state.waveState === 'spawning' || state.waveState === 'active') {
      if (state.spawnQueue.length > 0) {
        state.waveState = 'spawning';
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = WAVE.spawnInterval;
          spawnEnemy(state, state.spawnQueue.shift());
        }
      } else {
        state.waveState = 'active';
      }
      if (state.spawnQueue.length === 0 && state.enemies.length === 0 && state.player.alive) {
        state.waveState = 'intermission';
        state.waveTimer = WAVE.intermission;
        state.score += WAVE.clearBonus * state.wave;
        popup(state, VIEW.width / 2, 150, `WAVE ${state.wave} CLEAR  +${WAVE.clearBonus * state.wave}`, COLORS.good, 26);
      }
    } else if (state.waveState === 'intermission') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) beginWave(state, state.wave + 1);
    }

    for (const e of state.enemies) stepEnemy(state, e, dt);

    // Player bullets.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20) {
        state.bullets.splice(i, 1);
      }
    }
    // Enemy bolts.
    for (let i = state.enemyBullets.length - 1; i >= 0; i -= 1) {
      const b = state.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const p = state.player;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (p.alive && dx * dx + dy * dy < (p.radius + 6) * (p.radius + 6)) {
        state.enemyBullets.splice(i, 1);
        damagePlayer(state);
        continue;
      }
      if (b.life <= 0 || b.x < -20 || b.x > VIEW.width + 20 || b.y < -20 || b.y > VIEW.height + 20) {
        state.enemyBullets.splice(i, 1);
      }
    }
    // Bullets vs enemies.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      let consumed = false;
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (e.spawnIn > 0) continue;
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.radius + 4) * (e.radius + 4)) {
          consumed = true;
          e.hp -= 1;
          e.flash = 1;
          burst(state, b.x, b.y, ENEMY_TYPES[e.kind].color, 3, 170, 0.3, 2.6);
          if (e.hp <= 0) killEnemy(state, j);
          else state.events.push('hit');
          break;
        }
      }
      if (consumed) state.bullets.splice(i, 1);
    }
    // Enemies touching the player.
    const p = state.player;
    if (p.alive) {
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (e.spawnIn > 0) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = e.radius + p.radius - 2;
        if (dx * dx + dy * dy < rr * rr) {
          if (e.kind === 'bulwark') {
            e.hp -= 4;
            e.flash = 1;
            if (e.hp <= 0) killEnemy(state, j);
            else {
              e.x -= dx * 0.6;
              e.y -= dy * 0.6;
            }
          } else {
            killEnemy(state, j);
          }
          damagePlayer(state);
          if (!p.alive) break;
        }
      }
    }
    // Cores drift, magnetise and collect.
    for (let i = state.cores.length - 1; i >= 0; i -= 1) {
      const c = state.cores[i];
      c.age += dt;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (p.alive && d2 < 110 * 110) {
        const d = Math.sqrt(d2) || 1;
        const pull = 560 * (1 - d / 130) + 120;
        c.vx += (dx / d) * pull * dt * 4;
        c.vy += (dy / d) * pull * dt * 4;
      }
      c.vx *= Math.max(0, 1 - 3.2 * dt);
      c.vy *= Math.max(0, 1 - 3.2 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (p.alive && d2 < 24 * 24) {
        state.cores.splice(i, 1);
        state.coresHeld += 1;
        state.score += 15;
        state.events.push('pickup');
        if (state.coresHeld % CORES_PER_HEAL === 0 && p.hp < PLAYER.hp) {
          p.hp += 1;
          popup(state, p.x, p.y - 30, 'HULL +1', COLORS.good, 19);
          state.events.push('heal');
        }
      } else if (c.age > 14) {
        state.cores.splice(i, 1);
      }
    }
  }

  // Particles and popups always animate, even on the title and game-over screens.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      state.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.max(0, 1 - 2.4 * dt);
    pt.vy *= Math.max(0, 1 - 2.4 * dt);
  }
  for (let i = state.popups.length - 1; i >= 0; i -= 1) {
    const pp = state.popups[i];
    pp.life -= dt;
    pp.y -= 34 * dt;
    if (pp.life <= 0) state.popups.splice(i, 1);
  }
}
