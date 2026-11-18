// Every pixel of VOIDSPARK is drawn here: the starfield arena, the ship and its
// four enemy kinds, bullets, cores, particles, floating score popups, the HUD,
// and the title, pause and game-over screens. Pure canvas, flat neon shapes
// with additive glows — no image assets anywhere.

import { COLORS, COMBO, ENEMY_TYPES, PLAYER, VIEW } from './config.js';
import { makeRng } from './random.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, comboMultiplier } from './world.js';

const TAU = Math.PI * 2;

// A fixed starfield, generated once from a seed so every frame agrees.
const STARS = (() => {
  const rng = makeRng(20261);
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({ x: rng() * VIEW.width, y: rng() * VIEW.height, r: 0.6 + rng() * 1.7, layer: rng() < 0.6 ? 0.3 : 1, tw: rng() * TAU });
  }
  return stars;
})();

function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawBackground(ctx, state) {
  const grad = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2, 80,
    VIEW.width / 2, VIEW.height / 2, VIEW.width * 0.72,
  );
  grad.addColorStop(0, COLORS.bgGlow);
  grad.addColorStop(1, COLORS.bgDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 64; x < VIEW.width; x += 64) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, VIEW.height);
  }
  for (let y = 64; y < VIEW.height; y += 64) {
    ctx.moveTo(0, y);
    ctx.lineTo(VIEW.width, y);
  }
  ctx.stroke();

  const px = state.player.x - VIEW.width / 2;
  const py = state.player.y - VIEW.height / 2;
  for (const s of STARS) {
    const tw = 0.55 + 0.45 * Math.sin(state.time * 1.7 + s.tw);
    ctx.globalAlpha = 0.25 + 0.55 * tw * s.layer;
    ctx.fillStyle = COLORS.star;
    const x = (s.x - px * 0.03 * s.layer + VIEW.width) % VIEW.width;
    const y = (s.y - py * 0.03 * s.layer + VIEW.height) % VIEW.height;
    ctx.fillRect(x, y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawCore(ctx, c, time) {
  const pulse = 1 + 0.18 * Math.sin(time * 6 + c.x * 0.05);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(time * 2.4 + c.x * 0.02);
  ctx.shadowColor = COLORS.core;
  ctx.shadowBlur = 10;
  ctx.fillStyle = COLORS.core;
  const r = 5.2 * pulse;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.62, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.62, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  const spec = ENEMY_TYPES[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.spawnIn > 0) {
    const t = 1 - e.spawnIn / 0.45;
    ctx.globalAlpha = 0.25 + 0.5 * t;
    ctx.strokeStyle = spec.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 12 * (1 - t), 0, TAU);
    ctx.stroke();
    ctx.scale(0.5 + 0.5 * t, 0.5 + 0.5 * t);
  }
  ctx.shadowColor = spec.color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = spec.color;
  if (e.kind === 'drifter') {
    polygon(ctx, 0, 0, e.radius, 4, time * 1.4 + e.x * 0.01);
    ctx.fill();
  } else if (e.kind === 'dart') {
    ctx.rotate(e.angle);
    if (e.lungeTimer < 0.38 && e.lungeTime <= 0) ctx.fillStyle = '#ffe9d2';
    ctx.beginPath();
    ctx.moveTo(e.radius + 4, 0);
    ctx.lineTo(-e.radius, e.radius * 0.72);
    ctx.lineTo(-e.radius * 0.45, 0);
    ctx.lineTo(-e.radius, -e.radius * 0.72);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'bulwark') {
    polygon(ctx, 0, 0, e.radius, 6, time * 0.5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(4, 20, 14, 0.65)';
    ctx.lineWidth = 3;
    polygon(ctx, 0, 0, e.radius * 0.62, 6, -time * 0.8);
    ctx.stroke();
    // Hull arc shows the bulwark's remaining health.
    ctx.strokeStyle = '#d8ffef';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, e.hp / e.maxHp));
    ctx.stroke();
  } else if (e.kind === 'spitter') {
    ctx.rotate(time * 0.9);
    ctx.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0d1a04';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.34, 0, TAU);
    ctx.fill();
  }
  if (e.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, e.flash);
    ctx.fillStyle = '#ffffff';
    polygon(ctx, 0, 0, e.radius, e.kind === 'bulwark' ? 6 : 4, time * 1.4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawPlayer(ctx, state) {
  const p = state.player;
  if (!p.alive) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.invulnTimer > 0 && p.dashTimer <= 0 && Math.sin(state.time * 34) > 0.2) ctx.globalAlpha = 0.35;
  // Engine flame while thrusting.
  const thrust = Math.hypot(p.vx, p.vy);
  if (thrust > 40) {
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
    const flame = 10 + thrust * 0.03 + Math.sin(state.time * 41) * 3;
    ctx.beginPath();
    ctx.moveTo(-p.radius * 0.7, 4.5);
    ctx.lineTo(-p.radius * 0.7 - flame, 0);
    ctx.lineTo(-p.radius * 0.7, -4.5);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-Math.atan2(p.vy, p.vx));
  }
  ctx.rotate(p.angle);
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 18;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(p.radius + 5, 0);
  ctx.lineTo(-p.radius * 0.8, p.radius * 0.78);
  ctx.lineTo(-p.radius * 0.35, 0);
  ctx.lineTo(-p.radius * 0.8, -p.radius * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(1, 0, 4.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, state) {
  const pad = 22;
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE', pad, pad);
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(state.score).padStart(6, '0'), pad, pad + 16);

  const mult = comboMultiplier(state);
  if (state.comboCount >= COMBO.killsPerStep) {
    const frac = Math.max(0, state.comboTimer / COMBO.window);
    ctx.fillStyle = COLORS.core;
    ctx.font = '800 19px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`COMBO ×${mult}`, pad, pad + 58);
    ctx.fillStyle = 'rgba(255, 217, 74, 0.25)';
    ctx.fillRect(pad, pad + 82, 110, 5);
    ctx.fillStyle = COLORS.core;
    ctx.fillRect(pad, pad + 82, 110 * frac, 5);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WAVE', VIEW.width / 2, pad);
  ctx.fillStyle = COLORS.text;
  ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(String(state.wave), VIEW.width / 2, pad + 16);

  // Hull pips, top right.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('HULL', VIEW.width - pad, pad);
  for (let i = 0; i < PLAYER.hp; i += 1) {
    const x = VIEW.width - pad - 12 - i * 26;
    const y = pad + 30;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    if (i < state.player.hp) {
      ctx.shadowColor = COLORS.good;
      ctx.shadowBlur = 9;
      ctx.fillStyle = COLORS.good;
    } else {
      ctx.fillStyle = 'rgba(120, 140, 190, 0.3)';
    }
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
  }
  ctx.fillStyle = COLORS.core;
  ctx.font = '800 19px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`◆ ${state.coresHeld}`, VIEW.width - pad, pad + 58);

  // Dash readiness, bottom left.
  const p = state.player;
  const ready = p.dashCooldown <= 0;
  ctx.textAlign = 'left';
  ctx.fillStyle = ready ? COLORS.player : COLORS.textDim;
  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(ready ? 'DASH READY — SHIFT' : 'DASH CHARGING', pad, VIEW.height - 40);
  ctx.fillStyle = 'rgba(61, 245, 255, 0.22)';
  ctx.fillRect(pad, VIEW.height - 22, 110, 5);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(pad, VIEW.height - 22, 110 * (ready ? 1 : 1 - p.dashCooldown / 1.5), 5);

  if (state.player.hp === 1 && state.player.alive) {
    const pulse = 0.1 + 0.08 * Math.sin(state.time * 6);
    const grad = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.42,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.78,
    );
    grad.addColorStop(0, 'rgba(255, 61, 104, 0)');
    grad.addColorStop(1, `rgba(255, 61, 104, ${pulse + 0.12})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}

function centredText(ctx, text, y, font, color, glow = 0) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillText(text, VIEW.width / 2, y);
  ctx.shadowBlur = 0;
}

function drawTitle(ctx, state) {
  // Decorative hunters drift behind the title so the menu feels alive.
  const ghosts = [
    { kind: 'drifter', x: 210, y: 190, r: 26 },
    { kind: 'bulwark', x: 1065, y: 505, r: 44 },
    { kind: 'dart', x: 1090, y: 150, r: 20 },
    { kind: 'spitter', x: 185, y: 520, r: 24 },
  ];
  for (const g of ghosts) {
    ctx.save();
    ctx.translate(g.x + Math.sin(state.time * 0.7 + g.x) * 12, g.y + Math.cos(state.time * 0.6 + g.y) * 10);
    ctx.globalAlpha = 0.5;
    ctx.shadowColor = ENEMY_TYPES[g.kind].color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = ENEMY_TYPES[g.kind].color;
    if (g.kind === 'drifter') polygon(ctx, 0, 0, g.r, 4, state.time * 0.8);
    else if (g.kind === 'bulwark') polygon(ctx, 0, 0, g.r, 6, state.time * 0.4);
    else if (g.kind === 'spitter') ctx.fillRect(-g.r * 0.8, -g.r * 0.8, g.r * 1.6, g.r * 1.6);
    else {
      ctx.beginPath();
      ctx.moveTo(g.r + 4, 0);
      ctx.lineTo(-g.r, g.r * 0.72);
      ctx.lineTo(-g.r, -g.r * 0.72);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  }

  centredText(ctx, 'VOIDSPARK', 218, '900 104px "Segoe UI", system-ui, sans-serif', COLORS.player, 34);
  centredText(ctx, 'N E O N   A R E N A   S U R V I V A L', 282, '700 21px "Segoe UI", system-ui, sans-serif', COLORS.core, 10);
  centredText(ctx, 'The void is spawning. Hold the arena, chain your combo,', 356, '500 19px "Segoe UI", system-ui, sans-serif', COLORS.text);
  centredText(ctx, 'and turn every kill into cores — 12 cores mend your hull.', 382, '500 19px "Segoe UI", system-ui, sans-serif', COLORS.text);

  ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.textAlign = 'center';
  ctx.fillText('WASD / ARROWS — move        MOUSE — aim        HOLD CLICK / SPACE — fire', VIEW.width / 2, 452);
  ctx.fillText('SHIFT / RIGHT CLICK — dash through danger        P — pause        M — mute', VIEW.width / 2, 480);

  if (Math.sin(state.time * 3.4) > -0.25) {
    centredText(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', 556, '800 24px "Segoe UI", system-ui, sans-serif', '#ffffff', 16);
  }
  if (state.best > 0) {
    centredText(ctx, `BEST ${state.best}`, 606, '700 17px "Segoe UI", system-ui, sans-serif', COLORS.textDim);
  }
}

function drawOver(ctx, state) {
  ctx.fillStyle = 'rgba(3, 4, 12, 0.66)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  centredText(ctx, 'THE VOID CLAIMS YOU', 208, '900 58px "Segoe UI", system-ui, sans-serif', COLORS.danger, 26);
  centredText(ctx, `SCORE  ${state.score}`, 306, '800 40px "Segoe UI", system-ui, sans-serif', COLORS.text, 8);
  const isBest = state.score >= state.best && state.score > 0;
  centredText(
    ctx,
    `WAVE ${state.wave}   ·   ${state.kills} KILLS   ·   ◆ ${state.coresHeld} CORES${isBest ? '   ·   NEW BEST!' : `   ·   BEST ${state.best}`}`,
    356,
    '600 20px "Segoe UI", system-ui, sans-serif',
    isBest ? COLORS.core : COLORS.textDim,
  );
  if (state.overTimer > 0.7 && Math.sin(state.time * 3.4) > -0.25) {
    centredText(ctx, 'PRESS R OR CLICK TO DIVE AGAIN', 448, '800 23px "Segoe UI", system-ui, sans-serif', '#ffffff', 14);
  }
}

/** Draw one frame. ui carries shell-owned extras: { bannerText, bannerT, muted }. */
export function draw(ctx, state, ui) {
  ctx.save();
  if (state.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground(ctx, state);

  for (const c of state.cores) drawCore(ctx, c, state.time);
  for (const e of state.enemies) drawEnemy(ctx, e, state.time);

  // Bullets and bolts, additive so they read as light.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = COLORS.bullet;
  ctx.lineWidth = 3.4;
  ctx.shadowColor = COLORS.bullet;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (const b of state.bullets) {
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  ctx.fillStyle = COLORS.enemyBullet;
  ctx.shadowColor = COLORS.enemyBullet;
  for (const b of state.enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5.5, 0, TAU);
    ctx.fill();
  }
  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.shadowColor = pt.color;
    ctx.shadowBlur = 7;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (state.screen !== SCREEN_TITLE) drawPlayer(ctx, state);

  // Floating score popups.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const pp of state.popups) {
    ctx.globalAlpha = Math.max(0, pp.life / pp.maxLife);
    ctx.font = `800 ${pp.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = pp.color;
    ctx.fillText(pp.text, pp.x, pp.y);
  }
  ctx.globalAlpha = 1;

  if (state.flash > 0) {
    ctx.fillStyle = `rgba(255, 45, 85, ${state.flash * 0.32})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  if (state.screen === SCREEN_PLAY) {
    drawHud(ctx, state);
    if (ui.bannerT > 0) {
      ctx.globalAlpha = Math.min(1, ui.bannerT * 1.6);
      centredText(ctx, ui.bannerText, 150, '900 46px "Segoe UI", system-ui, sans-serif', '#ffffff', 22);
      ctx.globalAlpha = 1;
    }
    if (state.paused) {
      ctx.fillStyle = 'rgba(3, 4, 12, 0.55)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      centredText(ctx, 'PAUSED', 330, '900 52px "Segoe UI", system-ui, sans-serif', COLORS.text, 18);
      centredText(ctx, 'Press P to resume', 386, '600 19px "Segoe UI", system-ui, sans-serif', COLORS.textDim);
    }
  } else if (state.screen === SCREEN_TITLE) {
    drawTitle(ctx, state);
  } else if (state.screen === SCREEN_OVER) {
    drawHud(ctx, state);
    drawOver(ctx, state);
  }

  if (ui.muted) {
    ctx.textAlign = 'right';
    ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('MUTED (M)', VIEW.width - 22, VIEW.height - 26);
  }
  ctx.restore();
}
