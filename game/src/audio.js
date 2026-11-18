// All sound is synthesised with WebAudio: no audio files, just oscillators and
// filtered noise shaped per event. The context wakes on the first user gesture,
// as browsers require; M toggles a mute flag the game shell checks.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuffer = null;
  }

  wake() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate * 0.5;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      this.ctx = null;
    }
  }

  tone({ freq = 440, end = null, type = 'square', dur = 0.12, vol = 0.5, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.25, vol = 0.6, freq = 1200, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(120, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  shoot() {
    this.tone({ freq: 880, end: 320, type: 'square', dur: 0.07, vol: 0.16 });
  }

  hit() {
    this.tone({ freq: 300, end: 140, type: 'triangle', dur: 0.05, vol: 0.2 });
  }

  explosion(big = false) {
    this.noise({ dur: big ? 0.5 : 0.28, vol: big ? 0.8 : 0.5, freq: big ? 900 : 1400 });
    this.tone({ freq: big ? 130 : 180, end: 40, type: 'sawtooth', dur: big ? 0.4 : 0.22, vol: 0.3 });
  }

  pickup(step = 0) {
    const base = 620 + Math.min(step, 10) * 45;
    this.tone({ freq: base, end: base * 1.5, type: 'sine', dur: 0.09, vol: 0.28 });
  }

  hurt() {
    this.tone({ freq: 220, end: 55, type: 'sawtooth', dur: 0.3, vol: 0.55 });
    this.noise({ dur: 0.2, vol: 0.4, freq: 700 });
  }

  dash() {
    this.noise({ dur: 0.14, vol: 0.22, freq: 2600 });
  }

  waveStart() {
    [392, 523, 659, 784].forEach((freq, i) => {
      this.tone({ freq, type: 'square', dur: 0.12, vol: 0.22, delay: i * 0.07 });
    });
  }

  heal() {
    [523, 659, 784].forEach((freq, i) => {
      this.tone({ freq, type: 'sine', dur: 0.14, vol: 0.25, delay: i * 0.06 });
    });
  }

  gameOver() {
    [440, 349, 262, 196].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', dur: 0.3, vol: 0.35, delay: i * 0.16 });
    });
  }
}
