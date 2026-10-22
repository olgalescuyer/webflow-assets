/*
  Webflow stickers + Halloween spider.
  Pair with stickers.css. Load with `defer`. See README.md for setup.

  Turn the spider off with: <script src=".../stickers.js" data-spider="false" defer></script>
*/
(() => {
  const script = document.currentScript;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rand = (min, max) => min + Math.random() * (max - min);
  const easeOutCubic = (t) => 1 - (1 - t) ** 3;
  const easeOutBack = (t, c = 1.9) => 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;

  // Shared cursor position (null when the cursor is off the page).
  const mouse = { x: null, y: null };
  addEventListener(
    "pointermove",
    (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    mouse.x = mouse.y = null;
  });

  /* ======================= Click burst ======================= */

  const BURST = {
    max: 150, // safety cap for rapid clicking
    magnetRadius: 150, // px around the cursor that pulls particles
    magnetPull: 0.45, // how far toward the cursor (share of the distance)
  };

  let layer = null;
  let running = false;
  const particles = [];

  /**
   * Fly copies of an image up to the top of the screen.
   * @param {{ make: () => Element | null, size?: number, count?: number, x: number, y: number }} opts
   */
  const burst = ({ make, size = 60, count = 18, x, y }) => {
    if (count <= 0 || reduceMotion) return;

    if (!layer) {
      layer = document.createElement("div");
      layer.className = "sticker-burst-layer";
      document.body.append(layer);
    }

    const base = Math.max(24, Math.min(size, 100));
    const now = performance.now();

    for (let i = 0; i < count && particles.length < BURST.max; i++) {
      const node = make();
      if (!node) return;

      // mostly small copies with the odd bigger one: 15%–55% of the source
      const s = base * (0.15 + Math.random() ** 1.8 * 0.4);
      node.style.width = `${s}px`;
      node.style.opacity = "0";
      layer.append(node);

      const angle = rand(0, Math.PI * 2);
      const spread = rand(40, 160);
      particles.push({
        node,
        size: s,
        start: now + i * rand(15, 35), // slight stagger so they don't all leave at once
        duration: rand(2600, 4600),
        x0: x,
        y0: y,
        burstX: Math.cos(angle) * spread,
        burstY: Math.sin(angle) * spread * 0.6 - 40,
        drift: rand(-120, 120),
        rise: y + s + rand(60, 200), // enough to clear the top of the screen
        sway: rand(10, 35),
        swayFreq: rand(2, 5),
        phase: rand(0, Math.PI * 2),
        rot0: rand(-50, 50), // every copy starts at its own tilt…
        spin: (Math.random() < 0.5 ? -1 : 1) * rand(30, 220), // …and turns its own way and speed
        ox: 0,
        oy: 0,
      });
    }

    if (!running) {
      running = true;
      requestAnimationFrame(burstTick);
    }
  };

  const burstTick = (now) => {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const t = (now - p.start) / p.duration;
      if (t < 0) continue;
      if (t >= 1) {
        p.node.remove();
        particles.splice(i, 1);
        continue;
      }

      // path: quick outward pop, then accelerate upward with a soft sway
      const pop = easeOutCubic(Math.min(t * 4, 1));
      const bx = p.x0 + p.burstX * pop + p.drift * t + Math.sin(t * p.swayFreq * Math.PI + p.phase) * p.sway;
      const by = p.y0 + p.burstY * pop - p.rise * t ** 1.5;

      // magnet: ease toward the cursor when it's close, ease back when it leaves
      let tx = 0;
      let ty = 0;
      if (mouse.x !== null) {
        const dx = mouse.x - bx;
        const dy = mouse.y - by;
        const dist = Math.hypot(dx, dy);
        if (dist < BURST.magnetRadius) {
          const f = (1 - dist / BURST.magnetRadius) * BURST.magnetPull;
          tx = dx * f;
          ty = dy * f;
        }
      }
      p.ox += (tx - p.ox) * 0.12;
      p.oy += (ty - p.oy) * 0.12;

      const scale = easeOutBack(Math.min(t / 0.15, 1));
      const opacity = t > 0.8 ? (1 - t) / 0.2 : 1;
      const rot = p.rot0 + p.spin * t + p.ox * 0.3;

      p.node.style.opacity = opacity;
      p.node.style.transform =
        `translate3d(${bx + p.ox - p.size / 2}px, ${by + p.oy - p.size / 2}px, 0) ` +
        `rotate(${rot}deg) scale(${scale})`;
    }

    if (particles.length) requestAnimationFrame(burstTick);
    else running = false;
  };

  /* ======================= Stickers ======================= */

  const reveal = (el) => {
    el.classList.add("sticker-in");
    const delay = parseFloat(el.dataset.stickerDelay) || 0;
    setTimeout(() => el.classList.add("sticker-ready"), delay + 650);
  };

  // A fresh copy of the sticker's image (img or inline svg) for the burst.
  const makeStickerCopy = (el) => {
    const src = el.dataset.stickerBurstSrc;
    if (src) {
      const img = new Image();
      img.src = src;
      img.alt = "";
      return img;
    }
    const source = el.matches("img, svg") ? el : el.querySelector("img, svg");
    if (!source) return null;

    const copy = source.cloneNode(true);
    for (const name of copy.getAttributeNames()) {
      if (name.startsWith("data-sticker") || ["class", "id", "style", "loading", "srcset", "sizes"].includes(name)) {
        copy.removeAttribute(name);
      }
    }
    if (copy instanceof HTMLImageElement) copy.src = source.currentSrc || source.src;
    copy.setAttribute("aria-hidden", "true");
    return copy;
  };

  const initStickers = () => {
    const stickers = document.querySelectorAll("[data-sticker]");
    if (!stickers.length) return;

    // Group stickers by their trigger (nearest section) so they pop in together.
    const groups = new Map();

    for (const el of stickers) {
      const { stickerDelay, stickerFloat, stickerRotate } = el.dataset;
      if (stickerDelay) el.style.setProperty("--sticker-delay", `${parseFloat(stickerDelay)}ms`);
      if (stickerFloat) el.style.setProperty("--sticker-float", `${parseFloat(stickerFloat)}s`);
      if (stickerRotate) el.style.setProperty("--sticker-rotate", `${parseFloat(stickerRotate)}deg`);

      el.addEventListener("click", (e) => {
        const count = parseInt(el.dataset.stickerBurst, 10);
        burst({
          make: () => makeStickerCopy(el),
          size: el.getBoundingClientRect().width,
          count: Number.isNaN(count) ? 18 : count,
          x: e.clientX,
          y: e.clientY,
        });
      });

      const trigger = el.closest("[data-sticker-trigger], section") ?? el.parentElement;
      if (!groups.has(trigger)) groups.set(trigger, []);
      groups.get(trigger).push(el);
    }

    if (!("IntersectionObserver" in window)) {
      stickers.forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          groups.get(entry.target).forEach(reveal);
        }
      },
      // fire once the trigger's top is ~20% up from the bottom of the screen
      { threshold: 0, rootMargin: "0px 0px -20% 0px" },
    );
    for (const trigger of groups.keys()) io.observe(trigger);
  };

  /* ======================= Spider ======================= */

  const SPIDER = {
    startAfter: 1, // drop once scrolled past this many screen heights (1 = 100vh)
    dropTo: 0.3, // how far down it hangs, as a share of the screen height
    magnetRadius: 260, // px around the spider where the cursor pulls it
    magnetPull: 0.35, // how strongly it leans toward the cursor
    burstCount: 16, // little spiders per click
    storageKey: "tb-spider-closed",
  };

  // The spider art without its thread; the thread is drawn separately so it can stretch.
  const VB = { x: 15, y: 100, w: 370, h: 240 };
  const LEGS = [
    { d: "M128 150C95 120 55 125 28 160", x: 128, y: 150, side: 1 },
    { d: "M115 185C80 165 45 175 25 215", x: 115, y: 185, side: 1 },
    { d: "M117 220C85 215 55 235 40 275", x: 117, y: 220, side: 1 },
    { d: "M135 250C105 260 85 290 80 325", x: 135, y: 250, side: 1 },
    { d: "M272 150C305 120 345 125 372 160", x: 272, y: 150, side: -1 },
    { d: "M285 185C320 165 355 175 375 215", x: 285, y: 185, side: -1 },
    { d: "M283 220C315 215 345 235 360 275", x: 283, y: 220, side: -1 },
    { d: "M265 250C295 260 315 290 320 325", x: 265, y: 250, side: -1 },
  ];
  const EYES = [
    { x: 172, y: 205 },
    { x: 232, y: 205 },
  ];
  const LOOK_UP = { x: 5, y: -9 }; // resting gaze: up at the thread

  const spiderSvg = () => `
    <svg class="tb-spider-svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" fill="none" aria-hidden="true" focusable="false">
      <g class="tb-legs" stroke="#2b2224" stroke-width="12" stroke-linecap="round">
        ${LEGS.map(({ d }) => `<path d="${d}"/>`).join("")}
      </g>
      <ellipse cx="200" cy="190" rx="88" ry="82" fill="#2b2224"/>
      <path d="M135 160C145 132 168 118 192 115" stroke="#4a3d40" stroke-width="7" stroke-linecap="round"/>
      ${EYES.map(
        ({ x, y }) => `
        <g class="tb-eye">
          <ellipse cx="${x}" cy="${y}" rx="27" ry="30" fill="#f4efea"/>
          <circle class="tb-pupil" cx="${x}" cy="${y}" r="10" fill="#2b2224" transform="translate(${LOOK_UP.x} ${LOOK_UP.y})"/>
        </g>`,
      ).join("")}
      <path d="M178 252Q202 268 226 252" stroke="#6b5b5e" stroke-width="5" stroke-linecap="round"/>
    </svg>`;

  const wasClosed = () => {
    try {
      return sessionStorage.getItem(SPIDER.storageKey) === "1";
    } catch {
      return false;
    }
  };
  const rememberClosed = () => {
    try {
      sessionStorage.setItem(SPIDER.storageKey, "1");
    } catch {}
  };

  const initSpider = () => {
    // "any-" = any connected mouse counts, even if the browser also reports touch (e.g. Arc)
    const desktop = matchMedia("(min-width: 992px) and (any-hover: hover) and (any-pointer: fine)").matches;
    if (!desktop || reduceMotion || wasClosed()) return;

    const root = document.createElement("div");
    root.className = "tb-spider";
    root.innerHTML = `
      <div class="tb-spider-swing">
        <div class="tb-spider-thread"></div>
        <div class="tb-spider-body">
          ${spiderSvg()}
          <button type="button" class="tb-spider-close" aria-label="Remove spider">×</button>
        </div>
      </div>`;
    document.body.append(root);

    const swing = root.querySelector(".tb-spider-swing");
    const thread = root.querySelector(".tb-spider-thread");
    const body = root.querySelector(".tb-spider-body");
    const svg = root.querySelector(".tb-spider-svg");
    const closeBtn = root.querySelector(".tb-spider-close");
    const legEls = [...svg.querySelectorAll(".tb-legs path")];
    const eyeEls = [...svg.querySelectorAll(".tb-eye")];
    const pupilEls = [...svg.querySelectorAll(".tb-pupil")];

    const size = root.getBoundingClientRect().width; // from --spider-size in the CSS
    const h = (size * VB.h) / VB.w;
    const HIDDEN = -h - 30; // fully above the screen

    const state = {
      len: HIDDEN, // thread length (px)
      lenV: 0,
      angle: 0, // pendulum angle (deg)
      angleV: 0,
      legPhase: 0,
      gaze: EYES.map(() => ({ ...LOOK_UP })),
      nextBlink: performance.now() + rand(1500, 4000),
      blinkStart: -1,
      closed: false,
      hover: false,
      running: false,
      last: 0,
    };

    const targetLen = () => {
      const shown = !state.closed && scrollY > innerHeight * SPIDER.startAfter;
      return shown ? innerHeight * SPIDER.dropTo : HIDDEN;
    };

    const tick = (now) => {
      const s = state;
      const f = Math.min((now - s.last) / 16.67, 3); // frame-rate independence
      s.last = now;

      const target = targetLen();
      const shown = target > 0;
      const anchorX = root.getBoundingClientRect().left + size / 2;
      const reach = Math.max(s.len + h * 0.55, 60); // thread top → spider centre

      // magnet: lean and stretch toward a nearby cursor
      let dx = 0;
      let dy = 0;
      let pull = 0;
      if (shown && mouse.x !== null) {
        dx = mouse.x - anchorX;
        dy = mouse.y - (s.len + h * 0.55);
        const dist = Math.hypot(dx, dy);
        if (dist < SPIDER.magnetRadius) pull = (1 - dist / SPIDER.magnetRadius) * SPIDER.magnetPull;
      }

      // thread length: springy drop + gentle bob
      const goalLen = target + (shown ? Math.sin(now * 0.0016) * 6 + dy * pull * 0.6 : 0);
      s.lenV += (goalLen - s.len) * 0.02 * f;
      s.lenV *= 0.88 ** f;
      s.len += s.lenV * f;

      // pendulum: slow idle sway + lean toward the cursor
      const goalAngle = shown ? Math.sin(now * 0.0011) * 3 - ((dx * pull) / reach) * 57.3 : 0;
      s.angleV += (goalAngle - s.angle) * 0.03 * f;
      s.angleV *= 0.86 ** f;
      s.angle += s.angleV * f;

      swing.style.transform = `rotate(${s.angle.toFixed(3)}deg)`;
      thread.style.transform = `scaleY(${Math.max(s.len + 6, 0).toFixed(1)})`;
      body.style.transform = `translateY(${s.len.toFixed(2)}px)`;

      // legs: little wiggle, faster when hovered
      s.legPhase += (s.hover ? 0.2 : 0.06) * f;
      const amp = s.hover ? 9 : 4;
      legEls.forEach((el, i) => {
        const { x, y, side } = LEGS[i];
        const a = Math.sin(s.legPhase + (i % 4) * 1.1 + (side < 0 ? Math.PI : 0)) * amp * side;
        el.setAttribute("transform", `rotate(${a.toFixed(2)} ${x} ${y})`);
      });

      // eyes: pupils follow the cursor, otherwise look up at the thread
      const box = svg.getBoundingClientRect();
      pupilEls.forEach((el, i) => {
        let goal = LOOK_UP;
        if (mouse.x !== null) {
          const ex = box.left + ((EYES[i].x - VB.x) / VB.w) * box.width;
          const ey = box.top + ((EYES[i].y - VB.y) / VB.h) * box.height;
          const ux = mouse.x - ex;
          const uy = mouse.y - ey;
          const d = Math.hypot(ux, uy) || 1;
          const k = Math.min(d / 120, 1);
          goal = { x: (ux / d) * 13 * k, y: (uy / d) * 15 * k };
        }
        const g = s.gaze[i];
        g.x += (goal.x - g.x) * 0.2 * f;
        g.y += (goal.y - g.y) * 0.2 * f;
        el.setAttribute("transform", `translate(${g.x.toFixed(2)} ${g.y.toFixed(2)})`);
      });

      // blink every few seconds
      if (now > s.nextBlink) {
        s.blinkStart = now;
        s.nextBlink = now + rand(2500, 6000);
      }
      let squash = 1;
      if (s.blinkStart >= 0) {
        const p = (now - s.blinkStart) / 160;
        if (p >= 1) s.blinkStart = -1;
        else squash = 1 - Math.sin(p * Math.PI) * 0.9;
      }
      eyeEls.forEach((el, i) => {
        const { x, y } = EYES[i];
        el.setAttribute("transform", `translate(${x} ${y}) scale(1 ${squash.toFixed(3)}) translate(${-x} ${-y})`);
      });

      // closed and back above the screen: remove it for good
      if (s.closed && s.len <= HIDDEN + 1) {
        root.remove();
        removeEventListener("scroll", start);
        s.running = false;
        return;
      }
      // tucked away above the screen: sleep until the next scroll
      if (!shown && Math.abs(s.len - HIDDEN) < 0.5 && Math.abs(s.lenV) < 0.05) {
        s.running = false;
        return;
      }
      requestAnimationFrame(tick);
    };

    const start = () => {
      if (state.running) return;
      state.running = true;
      state.last = performance.now();
      requestAnimationFrame(tick);
    };

    svg.addEventListener("mouseenter", () => (state.hover = true));
    svg.addEventListener("mouseleave", () => (state.hover = false));

    svg.addEventListener("click", (e) => {
      state.lenV -= 6; // little hop up the thread
      start();
      burst({
        make: () => {
          const copy = svg.cloneNode(true);
          copy.removeAttribute("class"); // copies must not catch clicks
          return copy;
        },
        size,
        count: SPIDER.burstCount,
        x: e.clientX,
        y: e.clientY,
      });
    });

    closeBtn.addEventListener("click", () => {
      state.closed = true;
      closeBtn.remove();
      rememberClosed();
      start();
    });

    addEventListener("scroll", start, { passive: true });
    start();
  };

  /* ======================= Start ======================= */

  const init = () => {
    initStickers();
    if (script?.dataset.spider !== "false") initSpider();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
