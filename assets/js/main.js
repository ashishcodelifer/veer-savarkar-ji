/* ═══════════════════════════════════════════════════════════
   SWATANTRYA VEER — motion
   Method: calm interpolated loops, transform-only, one clock
   per scene, paused off-screen, still under reduced motion.
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hasIO = 'IntersectionObserver' in window;

  /* ── seeded random (stable per item, never per frame) ── */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── nav state + progress ── */
  const nav = document.getElementById('siteNav');
  const progress = document.querySelector('.progress span');
  let scrollQueued = false;

  function updateScrollUI() {
    const y = window.scrollY || window.pageYOffset || 0;
    if (nav) nav.classList.toggle('is-scrolled', y > 24);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const value = max > 0 ? Math.min(y / max, 1) : 0;
      progress.style.transform = `scaleX(${value})`;
    }
    scrollQueued = false;
  }

  window.addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(updateScrollUI);
  }, { passive: true });
  updateScrollUI();

  /* ── reveal on enter (transform + opacity only) ── */
  const revealEls = Array.from(document.querySelectorAll('[data-reveal]'));

  if (hasIO && !reduceMotion.matches) {
    const revealIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        revealIO.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });

    revealEls.forEach((el) => revealIO.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ── live scenes: run loops only while visible ── */
  const liveEls = Array.from(document.querySelectorAll('.hero, .marquee, .kalapani, .poet'));

  if (hasIO) {
    const liveIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle('is-live', entry.isIntersecting);
      }
    }, { threshold: 0.01 });
    liveEls.forEach((el) => liveIO.observe(el));
  } else {
    liveEls.forEach((el) => el.classList.add('is-live'));
  }

  /* ── counters (27, 10, 1): ease-out, once ── */
  const counters = Array.from(document.querySelectorAll('.stat-row dt, .kp-stats dt'))
    .filter((el) => /^\d+$/.test(el.textContent.trim()));

  function countUp(el) {
    const target = parseInt(el.textContent, 10);
    if (reduceMotion.matches || target < 5 || target > 100) return;

    const duration = 1300;
    const start = performance.now();

    function step(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = String(target);
    }

    requestAnimationFrame(step);
  }

  if (hasIO && !reduceMotion.matches) {
    const counterIO = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        countUp(entry.target);
        counterIO.unobserve(entry.target);
      }
    }, { threshold: 0.6 });
    counters.forEach((el) => counterIO.observe(el));
  }

  /* ══════════════ ember field ══════════════
     One clock, one canvas. Particles wrap with a bell fade,
     never a pop. Frozen frame 0 under reduced motion. */

  class EmberField {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.time = 0;
      this.last = 0;
      this.rafId = 0;
      this.running = false;
      this.visible = false;
      this.w = 1;
      this.h = 1;
      this.region = canvas.parentElement;

      this.makeSprites();
      this.resize();
      this.buildParticles();

      window.addEventListener('resize', () => {
        this.resize();
        this.buildParticles();
        if (reduceMotion.matches) this.drawStatic();
      }, { passive: true });

      if (hasIO) {
        new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting;
          this.sync();
        }, { threshold: 0 }).observe(canvas);
      } else {
        this.visible = true;
        this.sync();
      }

      document.addEventListener('visibilitychange', () => this.sync());

      if (reduceMotion.addEventListener) {
        reduceMotion.addEventListener('change', () => {
          this.sync();
          if (reduceMotion.matches) this.drawStatic();
        });
      }

      if (reduceMotion.matches) this.drawStatic();
    }

    makeSprites() {
      const tints = ['255, 176, 112', '224, 96, 43', '255, 214, 160'];
      this.sprites = tints.map((rgb) => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `rgba(${rgb}, 0.95)`);
        grad.addColorStop(0.32, `rgba(${rgb}, 0.42)`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        return c;
      });
    }

    buildParticles() {
      const area = Math.max(this.w * this.h, 1);
      const count = Math.max(24, Math.min(72, Math.round(area / 20000)));
      const rand = mulberry32(18830528);
      this.particles = Array.from({ length: count }, () => ({
        x: rand(),
        size: 0.8 + rand() * 2.1,
        period: 9000 + rand() * 10000,
        phase: rand(),
        alpha: 0.26 + rand() * 0.55,
        swayFreq: 0.5 + rand() * 1.4,
        swayPhase: rand() * Math.PI * 2,
        swayAmp: 6 + rand() * 30,
        tint: Math.floor(rand() * 3)
      }));
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      this.w = Math.max(rect.width, 1);
      this.h = Math.max(rect.height, 1);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    draw(time) {
      const { ctx, w, h } = this;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (const p of this.particles) {
        const progress = ((time / p.period) + p.phase) % 1;
        const y = h * 1.04 - progress * (h * 1.1);
        const bell = Math.sin(Math.PI * progress);
        const alpha = bell * p.alpha;
        if (alpha <= 0.004) continue;

        const x = p.x * w
          + Math.sin(progress * Math.PI * 2 * p.swayFreq + p.swayPhase)
            * p.swayAmp * (0.35 + progress * 0.65);
        const r = p.size * (0.55 + 0.45 * bell) * 6;
        if (y < -r || y > h + r) continue;

        ctx.globalAlpha = alpha;
        ctx.drawImage(this.sprites[p.tint], x - r, y - r, r * 2, r * 2);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawStatic() {
      this.draw(6000);
    }

    loop = (now) => {
      if (!this.running) return;
      const delta = Math.min(now - this.last, 64);
      this.last = now;
      this.time += delta;
      this.draw(this.time);
      this.rafId = requestAnimationFrame(this.loop);
    };

    start() {
      if (this.running) return;
      this.running = true;
      this.last = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    }

    sync() {
      if (reduceMotion.matches) {
        this.stop();
        this.drawStatic();
        return;
      }
      if (this.visible && !document.hidden) this.start();
      else this.stop();
    }
  }

  const emberCanvas = document.querySelector('.embers');
  if (emberCanvas && emberCanvas.getContext) {
    new EmberField(emberCanvas);
  }

  /* ── gentle pointer parallax on the hero wreath ── */
  const hero = document.querySelector('.hero');
  const wreath = document.querySelector('.arch-wreath');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  if (hero && wreath && finePointer.matches && !reduceMotion.matches) {
    let tx = 0, ty = 0, targetX = 0, targetY = 0, rafId = 0, active = false;

    const render = () => {
      tx += (targetX - tx) * 0.08;
      ty += (targetY - ty) * 0.08;
      wreath.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0)`;
      if (Math.abs(targetX - tx) > 0.05 || Math.abs(targetY - ty) > 0.05) {
        rafId = requestAnimationFrame(render);
      } else {
        active = false;
      }
    };

    const request = () => {
      if (active) return;
      active = true;
      rafId = requestAnimationFrame(render);
    };

    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 10;
      request();
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
      targetX = 0;
      targetY = 0;
      request();
    }, { passive: true });

    window.addEventListener('pagehide', () => cancelAnimationFrame(rafId));
  }

  /* ── footer year ── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
