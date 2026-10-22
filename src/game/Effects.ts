import type { Vec2 } from '../levels/levelTypes';

type ParticleKind = 'dash' | 'scribble' | 'star';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  life: number;
  maxLife: number;
  size: number;
}

/** Tiny deterministic-ish pseudo random so effects look hand-scattered without Math.random in render math. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Purely cosmetic ink effects. Never feeds back into the simulation. */
export class Effects {
  readonly particles: Particle[] = [];
  private rand = makeRandom(1234);

  clear(): void {
    this.particles.length = 0;
  }

  dust(at: Vec2, strength01: number): void {
    const n = 3 + Math.round(strength01 * 5);
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.particles.push({
        kind: 'dash',
        x: at.x,
        y: at.y,
        vx: dir * (40 + this.rand() * 120 * (0.4 + strength01)),
        vy: -30 - this.rand() * 90,
        angle: 0,
        life: 0.4,
        maxLife: 0.4,
        size: 5 + this.rand() * 6,
      });
    }
  }

  crash(at: Vec2): void {
    for (let i = 0; i < 9; i++) {
      this.particles.push({
        kind: 'scribble',
        x: at.x,
        y: at.y,
        vx: (this.rand() - 0.5) * 360,
        vy: -80 - this.rand() * 260,
        angle: this.rand() * Math.PI,
        life: 0.5,
        maxLife: 0.5,
        size: 8 + this.rand() * 10,
      });
    }
  }

  celebrate(at: Vec2): void {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      this.particles.push({
        kind: 'star',
        x: at.x,
        y: at.y - 40,
        vx: Math.cos(a) * (120 + this.rand() * 120),
        vy: Math.sin(a) * (120 + this.rand() * 120) - 60,
        angle: this.rand() * Math.PI,
        life: 1.1,
        maxLife: 1.1,
        size: 7 + this.rand() * 6,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += 600 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += dt * 4;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#25252b';
    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a * 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (p.kind === 'dash') {
        const len = p.size * 0.6;
        const ang = Math.atan2(p.vy, p.vx);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(ang) * len, p.y - Math.sin(ang) * len);
      } else if (p.kind === 'scribble') {
        ctx.strokeStyle = '#c0392b';
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * p.size, p.y + Math.sin(p.angle) * p.size);
        ctx.lineTo(p.x - Math.sin(p.angle) * p.size * 0.6, p.y + Math.cos(p.angle) * p.size * 0.6);
      } else {
        for (let k = 0; k < 2; k++) {
          const ang = p.angle + (k * Math.PI) / 2;
          ctx.moveTo(p.x - Math.cos(ang) * p.size, p.y - Math.sin(ang) * p.size);
          ctx.lineTo(p.x + Math.cos(ang) * p.size, p.y + Math.sin(ang) * p.size);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = '#25252b';
    }
    ctx.restore();
  }
}
