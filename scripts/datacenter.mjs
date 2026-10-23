// Builds the data-centre scene in the README: assets/datacenter-{dark,light}.svg, coloured and animated.
// Static, so this only runs by hand:  node scripts/datacenter.mjs
import { writeFileSync } from "node:fs";
import { card, createScene } from "./iso.mjs";

const RACKS = 5, RW = 6, RD = 8, RH = 15, GAP = 0.8;
const UNIT = 1.7;
// Server heights per rack, bottom to top, in rack units
const LAYOUTS = [
  [2, 1, 1, 2, 1],
  [1, 1, 2, 2, 1],
  [2, 2, 1, 1, 1],
  [1, 2, 1, 1, 2],
  [1, 1, 1, 2, 2],
];
const rackX = (r) => r * (RW + GAP);
const rowW = rackX(RACKS - 1) + RW;

const THEMES = {
  dark: { bg: "#0d1117", border: "#30363d", floor: "#161b22", grid: "#21262d", tile: "#1c2a3a", rack: "#2d333b", server: "#444c56", bezel: "#1f242b",
    switch: "#30363d", tray: "#57606a", text: "#8d96a0", title: "#e6edf3", ok: "#3fb950", warn: "#d29922", info: "#4493f8",
    cables: ["#4493f8", "#d29922", "#db61a2", "#3fb950"] },
  light: { bg: "#ffffff", border: "#d1d9e0", floor: "#eef1f4", grid: "#d8dee4", tile: "#dbe9f7", rack: "#8c959f", server: "#afb8c1", bezel: "#57606a",
    switch: "#8c959f", tray: "#afb8c1", text: "#59636e", title: "#1f2328", ok: "#1a7f37", warn: "#9a6700", info: "#0969da",
    cables: ["#0969da", "#bf8700", "#bf3989", "#1a7f37"] },
};

// deterministic "random" so the scene is the same on every build
let seed = 42;
const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

function sag(a, b, depth, n = 12) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t - depth * Math.sin(Math.PI * t)];
  });
}

function svg(themeName) {
  const C = THEMES[themeName];
  const s = createScene(11);
  seed = 42;

  // raised floor with a grid, and perforated cold-aisle tiles in front of the racks
  s.quad([[-2, -1, 0], [rowW + 2, -1, 0], [rowW + 2, RD + 7, 0], [-2, RD + 7, 0]], C.floor);
  for (let gx = -2; gx <= rowW + 2; gx += 2) s.path([[gx, -1, 0], [gx, RD + 7, 0]], C.grid, 1);
  for (let gy = -1; gy <= RD + 7; gy += 2) s.path([[-2, gy, 0], [rowW + 2, gy, 0]], C.grid, 1);
  for (let tx = 0; tx < rowW; tx += 4) s.quad([[tx, RD + 2, 0.02], [tx + 2, RD + 2, 0.02], [tx + 2, RD + 6, 0.02], [tx, RD + 6, 0.02]], C.tile);

  let warnings = 0;
  for (let r = 0; r < RACKS; r++) {
    const x = rackX(r);
    const leds = [];
    // one group per rack, so its servers and lights slide in with it
    s.raw(`<g class="rack" style="animation-delay:${(r * 0.25).toFixed(2)}s">`);
    s.box(x, 0, 0, x + RW, RD, RH, C.rack);
    // servers: bezels sitting proud of the rack front, each with a status LED and drive slots
    let z = 0.9;
    for (const units of LAYOUTS[r]) {
      const h = units * UNIT - 0.25;
      s.box(x + 0.5, RD, z, x + RW - 0.5, RD + 0.35, z + h, C.server);
      for (let d = 0; d < 4; d++) s.quad([[x + 0.9 + d * 0.9, RD + 0.36, z + 0.25], [x + 1.6 + d * 0.9, RD + 0.36, z + 0.25], [x + 1.6 + d * 0.9, RD + 0.36, z + h - 0.25], [x + 0.9 + d * 0.9, RD + 0.36, z + h - 0.25]], C.bezel);
      const roll = rnd();
      if (roll < 0.12) warnings++;
      leds.push({ p: [x + RW - 1.0, RD + 0.36, z + h / 2], color: roll < 0.12 ? C.warn : roll < 0.2 ? C.info : C.ok, delay: (rnd() * 2).toFixed(2), dur: (0.8 + rnd() * 1.6).toFixed(2) });
      z += units * UNIT;
    }
    // top-of-rack switch
    s.box(x + 0.5, RD, RH - 2.2, x + RW - 0.5, RD + 0.45, RH - 0.9, C.switch);
    for (let p = 0; p < 8; p++) leds.push({ p: [x + 0.9 + p * 0.6, RD + 0.46, RH - 1.55], color: C.ok, delay: (rnd()).toFixed(2), dur: (0.25 + rnd() * 0.5).toFixed(2), r: 1.4 });
    for (const l of leds) s.dot(l.p, l.r || 2.2, l.color, ` class="led" style="animation-duration:${l.dur}s;animation-delay:${l.delay}s"`);
    s.raw("</g>");
  }

  // risers from each rack roof, drawn before the tray they disappear into
  for (let r = 0; r < RACKS; r++) {
    const x = rackX(r) + RW / 2;
    s.path([[x, RD - 1.5, RH], [x, RD - 1.5, RH + 4]], C.cables[r % 4], 3);
  }
  // overhead tray and the patch cables that run from each switch to the next rack, with packets flowing
  s.box(-1.5, RD - 2.5, RH + 4, rowW + 1.5, RD - 0.5, RH + 4.6, C.tray);
  const motions = [];
  for (let r = 0; r < RACKS - 1; r++) {
    for (let k = 0; k < 2; k++) {
      const color = C.cables[(r + k) % 4];
      const a = [rackX(r) + 1.5 + k * 2.5, RD + 0.6, RH - 1.6];
      const b = [rackX(r + 1) + 1.5 + k * 2.2, RD + 0.6, RH - 1.6];
      const d = s.path(sag(a, b, 2.2 + k * 1.3), color, 2.6);
      // plug ends, so the cable visibly lands in a switch port
      s.dot(a, 2.4, color);
      s.dot(b, 2.4, color);
      motions.push({ d, color, dur: (1.6 + rnd() * 1.4).toFixed(2), delay: (rnd() * 1.5).toFixed(2) });
    }
  }
  // a cable down each rack front from its switch to a server
  for (let r = 0; r < RACKS; r++) {
    const x = rackX(r);
    s.path(sag([x + RW - 1.4, RD + 0.6, RH - 1.6], [x + RW - 1.2, RD + 0.6, 4 + r * 2], 0.6, 6).map(([px, py, pz], i) => [px + Math.sin(i) * 0.15, py, pz]), C.cables[(r + 2) % 4], 2);
  }
  for (const m of motions) s.raw(`<circle r="2.6" fill="${C.title}"><animateMotion dur="${m.dur}s" begin="${m.delay}s" repeatCount="indefinite" path="${m.d}"/></circle>`);

  const nodes = LAYOUTS.flat().length;
  const css = `.rack { opacity: 0; animation: up .6s ease-out forwards; }
    .led { animation: blink 1.2s steps(1) infinite; }
    @keyframes up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes blink { 50% { opacity: .15; } }
    @media (prefers-reduced-motion: reduce) { .rack { opacity: 1; animation: none; } .led { animation: none; } }`;
  return card(s, { bg: C.bg, border: C.border, title: C.title, text: C.text },
    "dc-blr-01 · row A",
    `${RACKS} racks · ${nodes} nodes · <tspan fill="${C.ok}">${nodes - warnings} healthy</tspan> · <tspan fill="${C.warn}">${warnings} warn</tspan>`,
    css, `Isometric data centre: ${RACKS} racks of ${nodes} servers with blinking status lights, a cable tray and patch cables carrying packets.`);
}

for (const theme of Object.keys(THEMES)) writeFileSync(new URL(`../assets/datacenter-${theme}.svg`, import.meta.url), svg(theme));
console.log("wrote datacenter-dark.svg, datacenter-light.svg");
