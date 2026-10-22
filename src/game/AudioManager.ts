const MUTE_KEY = 'inkskater.muted';

/** Procedural Web Audio sound effects. No audio files, no music. */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private muted: boolean;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* storage unavailable: mute still applies for this session */
    }
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
  }

  /** Create or resume the context. Must be called from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
        this.buildRoll();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private noise(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
    return buf;
  }

  private buildRoll(): void {
    const ctx = this.ctx;
    const buf = this.noise();
    if (!ctx || !buf || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.rollFilter = filter;
    this.rollGain = gain;
  }

  /** Continuous rolling rumble, driven each frame by speed and ground contact. */
  setRolling(speed: number, grounded: boolean): void {
    if (!this.ctx || !this.rollGain || !this.rollFilter) return;
    const level = grounded ? Math.min(1, speed / 900) * 0.11 : 0;
    this.rollGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.05);
    this.rollFilter.frequency.setTargetAtTime(250 + speed * 0.9, this.ctx.currentTime, 0.08);
  }

  silenceRolling(): void {
    if (this.ctx && this.rollGain)
      this.rollGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }

  private blip(opts: {
    from: number;
    to: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
    delay?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(opts.from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + opts.duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opts.duration + 0.02);
  }

  private thud(duration: number, gain: number, freq: number): void {
    const ctx = this.ctx;
    const buf = this.noise();
    if (!ctx || !buf || !this.master || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  jump(charge01: number): void {
    this.blip({ from: 260 + charge01 * 120, to: 620 + charge01 * 300, duration: 0.16, gain: 0.22 });
  }

  land(impact01: number): void {
    this.thud(0.09 + impact01 * 0.12, 0.25 + impact01 * 0.4, 500 + impact01 * 500);
  }

  crash(): void {
    this.thud(0.28, 0.6, 900);
    this.blip({ from: 220, to: 70, duration: 0.25, gain: 0.25, type: 'sawtooth' });
  }

  victory(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      this.blip({ from: f, to: f * 1.01, duration: 0.22, gain: 0.2, delay: i * 0.1 });
    });
  }

  click(): void {
    this.blip({ from: 520, to: 380, duration: 0.05, gain: 0.1, type: 'square' });
  }
}
