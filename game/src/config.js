// VOIDSPARK tuning: arena size, palette and every gameplay number in one place.

export const VIEW = { width: 1280, height: 720 };

export const COLORS = {
  bgDeep: '#05060f',
  bgGlow: '#0d1030',
  grid: 'rgba(64, 84, 190, 0.16)',
  star: '#aebaff',
  player: '#3df5ff',
  playerCore: '#eaffff',
  bullet: '#aef7ff',
  enemyBullet: '#ff5d7a',
  core: '#ffd94a',
  text: '#dfe8ff',
  textDim: '#8fa3d9',
  danger: '#ff3d68',
  good: '#4dff9d',
};

export const ENEMY_TYPES = {
  drifter: { radius: 17, hp: 3, speed: 74, score: 100, color: '#ff4dd8', cores: 1 },
  dart: { radius: 13, hp: 2, speed: 118, score: 150, color: '#ff9a3d', cores: 1 },
  bulwark: { radius: 30, hp: 16, speed: 33, score: 400, color: '#37e0a0', cores: 4 },
  spitter: { radius: 16, hp: 4, speed: 88, score: 250, color: '#b6ff3d', cores: 2 },
};

export const PLAYER = {
  radius: 14,
  speed: 268,
  accel: 2400,
  friction: 6.5,
  hp: 5,
  fireRate: 7.5,
  bulletSpeed: 660,
  bulletLife: 0.85,
  dashSpeed: 820,
  dashTime: 0.16,
  dashCooldown: 1.5,
};

export const WAVE = {
  baseCount: 7,
  perWave: 4,
  spawnInterval: 0.55,
  intermission: 3.0,
  clearBonus: 250,
};

export const COMBO = { window: 4.0, killsPerStep: 4, maxBonus: 7 };
export const CORES_PER_HEAL = 12;
