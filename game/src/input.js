// Keyboard and mouse state, translated into the game's intent each frame:
// a movement vector, an aim point in world coordinates, and the edge-triggered
// actions (fire held, dash, confirm, pause, mute).

export class Input {
  constructor(canvas, toWorld) {
    this.canvas = canvas;
    this.toWorld = toWorld;
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.pressed = new Set();
    this.attach();
  }

  attach() {
    addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.code);
      this.keys.add(event.code);
    });
    addEventListener('keyup', (event) => this.keys.delete(event.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
    this.canvas.addEventListener('pointermove', (event) => {
      const point = this.toWorld(event.clientX, event.clientY);
      this.mouseX = point.x;
      this.mouseY = point.y;
    });
    this.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.mouseDown = true;
      if (event.button === 2) this.pressed.add('DashMouse');
    });
    addEventListener('pointerup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  /** Movement intent as a unit vector (or zero), from WASD or the arrow keys. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  aimPoint() {
    return { x: this.mouseX, y: this.mouseY };
  }

  firing() {
    return this.mouseDown || this.keys.has('Space');
  }

  /** True once per physical press; consumed by reading. */
  wasPressed(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  dashPressed() {
    return this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight') || this.wasPressed('DashMouse');
  }

  endFrame() {
    this.pressed.clear();
  }
}
