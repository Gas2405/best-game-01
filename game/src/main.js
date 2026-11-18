// VOIDSPARK's shell: owns the canvas and its letterbox transform, the screen
// state machine (title -> play -> game over -> restart), the fixed-step loop,
// and the wiring from input intents to the world and from world events to the
// synthesiser. With ?shot=<scene> it instead builds one frozen screenshot
// scene (see shots.js) and holds it for the camera.

import { SoundBank } from './audio.js';
import { VIEW } from './config.js';
import { Input } from './input.js';
import { draw } from './render.js';
import { buildScene } from './shots.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, createWorld, startRun, stepWorld } from './world.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const sound = new SoundBank();

let viewScale = 1;
let viewX = 0;
let viewY = 0;

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  viewScale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
  viewX = (canvas.width - VIEW.width * viewScale) / 2;
  viewY = (canvas.height - VIEW.height * viewScale) / 2;
}
addEventListener('resize', resize);
resize();

function toWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = ((clientX - rect.left) / rect.width) * canvas.width;
  const py = ((clientY - rect.top) / rect.height) * canvas.height;
  return { x: (px - viewX) / viewScale, y: (py - viewY) / viewScale };
}

const input = new Input(canvas, toWorld);
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') ?? 1) || 1;

let state = createWorld(shotSeed);
try {
  state.best = Number(localStorage.getItem('voidspark-best') ?? 0) || 0;
} catch {
  state.best = 0;
}
const ui = { bannerText: '', bannerT: 0, muted: false };
let shotMode = false;

if (shotName) {
  const scene = buildScene(shotName, shotSeed);
  state = scene.state;
  ui.bannerText = scene.bannerText;
  ui.bannerT = scene.bannerT;
  shotMode = true;
}

function announce(text) {
  if (status) status.textContent = text;
}

function playEvents(events) {
  for (const name of events) {
    if (name === 'shoot') sound.shoot();
    else if (name === 'hit') sound.hit();
    else if (name === 'boom') sound.explosion(false);
    else if (name === 'boomBig') sound.explosion(true);
    else if (name === 'pickup') sound.pickup(state.coresHeld % 12);
    else if (name === 'hurt') sound.hurt();
    else if (name === 'dash') sound.dash();
    else if (name === 'heal') sound.heal();
    else if (name === 'over') sound.gameOver();
    else if (name === 'wave') {
      sound.waveStart();
      ui.bannerText = `WAVE ${state.wave}`;
      ui.bannerT = 1.7;
    }
  }
}

const STEP = 1 / 120;
let accumulator = 0;
let lastTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = lastTime ? Math.min(0.75, (now - lastTime) / 1000) : 1 / 60;
  lastTime = now;
  ui.bannerT = Math.max(0, ui.bannerT - elapsed);

  if (!shotMode) {
    // Screen transitions come first: they consume this frame's presses.
    if (input.wasPressed('KeyM')) {
      sound.muted = !sound.muted;
      ui.muted = sound.muted;
    }
    if (state.screen === SCREEN_TITLE) {
      if (input.mouseDown || input.wasPressed('Enter') || input.wasPressed('Space')) {
        sound.wake();
        startRun(state);
        announce('Run started. Wave 1.');
      }
    } else if (state.screen === SCREEN_OVER) {
      if (state.overTimer > 0.6 && (input.wasPressed('KeyR') || input.wasPressed('Enter') || input.mouseDown)) {
        sound.wake();
        startRun(state);
        announce('Run restarted. Wave 1.');
      }
    } else if (state.screen === SCREEN_PLAY) {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
        state.paused = !state.paused;
        announce(state.paused ? 'Paused.' : 'Resumed.');
      }
    }
    if (input.mouseDown) sound.wake();

    const move = input.moveVector();
    const aim = input.aimPoint();
    const intent = {
      moveX: move.x,
      moveY: move.y,
      aimX: aim.x,
      aimY: aim.y,
      firing: input.firing(),
      dash: input.dashPressed(),
    };
    // Fixed-step simulation: real elapsed time is fed in at 120 steps a
    // second, so the game runs at the same speed on any display (a clamped
    // per-frame dt would slow it down wherever frames arrive slowly).
    const wasAlive = state.player.alive;
    accumulator += elapsed;
    let steps = 0;
    while (accumulator >= STEP && steps < 90) {
      stepWorld(state, intent, STEP);
      playEvents(state.events);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 90) accumulator = 0;
    if (wasAlive && !state.player.alive) {
      announce(`Game over. Score ${state.score}, wave ${state.wave}. Press R to dive again.`);
      try {
        localStorage.setItem('voidspark-best', String(state.best));
      } catch {
        /* storage is a bonus, never a requirement */
      }
    }
    input.endFrame();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#02030a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewX, viewY);
  draw(ctx, state, ui);
}
requestAnimationFrame(frame);

// Hooks the screenshot scenes and any curious player can inspect.
window.__voidspark = state;
if (shotMode) window.__shotReady = true;
