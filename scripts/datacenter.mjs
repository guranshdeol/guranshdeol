// Builds the data-centre scene in the README: assets/datacenter-{dark,light}.svg, coloured and animated.
// Static, so this only runs by hand:  node scripts/datacenter.mjs
import { writeFileSync } from "node:fs";
import { card, createScene, oblique } from "./iso.mjs";

const RACKS = 7, RW = 6, RD = 8, RH = 15, GAP = 0.8;
const UNIT = 1.7;
// Server heights per rack, bottom to top, in rack units
const LAYOUTS = [
  [2, 1, 1, 2, 1],
  [1, 1, 2, 2, 1],
  [2, 2, 1, 1, 1],
  [1, 2, 1, 1, 2],
  [1, 1, 1, 2, 2],
  [2, 1, 2, 1, 1],
  [1, 2, 2, 1, 1],
];
const rackX = (r) => r * (RW + GAP);
const rowW = rackX(RACKS - 1) + RW;

const THEMES = {
  dark: { bg: "#0d1117", border: "#30363d", nas: "#22272e", bench: "#3d444d", benchTop: "#6e5a3e", router: "#c9d1d9", standoff: "#8d96a0", pi: "#1f7a3a", port: "#adbac7", gold: "#b8913a", grille: "#6b5220", red: "#f85149", floor: "#161b22", grid: "#21262d", tile: "#1c2a3a", rack: "#2d333b", server: "#444c56", bezel: "#1f242b",
    switch: "#30363d", tray: "#57606a", text: "#8d96a0", title: "#e6edf3", ok: "#3fb950", warn: "#d29922", info: "#4493f8",
    cables: ["#4493f8", "#d29922", "#db61a2", "#3fb950"] },
  light: { bg: "#ffffff", border: "#d1d9e0", nas: "#6e7781", bench: "#8c959f", benchTop: "#b08a5a", router: "#eaeef2", standoff: "#8c959f", pi: "#2da44e", port: "#d0d7de", gold: "#c9a24a", grille: "#7a5c1e", red: "#cf222e", floor: "#eef1f4", grid: "#d8dee4", tile: "#dbe9f7", rack: "#8c959f", server: "#afb8c1", bezel: "#57606a",
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

// A bench at the end of the row: a Raspberry Pi cluster, a switch, a router and a DGX Spark,
// cabled to each other and to the last rack
const LAB = rowW + 2.5, LAB_W = 11, BENCH = 4.6;
const floorW = LAB + LAB_W + 1.5;
function homelab(s, C) {
  const blink = (p, color, r = 1.8) =>
    s.dot(p, r, color, ` class="led" style="animation-duration:${(0.5 + rnd() * 1.2).toFixed(2)}s;animation-delay:${(rnd() * 1.5).toFixed(2)}s"`);

  // bench: back legs, front legs, then the top
  for (const lx of [LAB + 0.3, LAB + LAB_W - 0.7]) s.box(lx, 2, 0, lx + 0.4, 2.4, BENCH, C.bench);
  // 2-bay NAS on the floor under the bench, drawn before the front legs that stand in front of it
  const nx = LAB + 6.4;
  s.box(nx, 3.2, 0, nx + 2.6, RD - 0.6, 3.2, C.nas);
  for (let b = 0; b < 2; b++) s.quad([[nx + 0.35 + b * 1.05, RD - 0.59, 0.5], [nx + 1.2 + b * 1.05, RD - 0.59, 0.5], [nx + 1.2 + b * 1.05, RD - 0.59, 2.4], [nx + 0.35 + b * 1.05, RD - 0.59, 2.4]], C.bezel);
  blink([nx + 0.75, RD - 0.58, 2.75], C.info, 1.2);
  blink([nx + 1.8, RD - 0.58, 2.75], C.ok, 1.2);
  for (const lx of [LAB + 0.3, LAB + LAB_W - 0.7]) s.box(lx, RD - 0.4, 0, lx + 0.4, RD, BENCH, C.bench);
  s.box(LAB, 2, BENCH, LAB + LAB_W, RD, BENCH + 0.4, C.benchTop);
  const top = BENCH + 0.4;

  // router at the back with two antennas
  s.box(LAB + 4, RD - 5, top, LAB + 6.4, RD - 3.2, top + 0.6, C.router);
  for (const ax of [LAB + 4.4, LAB + 6]) s.path([[ax, RD - 4.2, top + 0.6], [ax, RD - 4.2, top + 2.6]], C.router, 2.2);
  blink([LAB + 5.2, RD - 3.2, top + 0.3], C.info, 1.4);

  // Raspberry Pi cluster: four boards on standoffs, each with power and activity lights
  const px = LAB + 0.6, py = RD - 2.4;
  for (const sx of [px + 0.1, px + 2.5]) s.box(sx, py + 1.6, top, sx + 0.15, py + 1.75, top + 4.6, C.standoff);
  for (let i = 0; i < 4; i++) {
    const z = top + 0.35 + i * 1.1;
    s.box(px, py, z, px + 2.8, py + 1.8, z + 0.22, C.pi);
    s.box(px + 0.3, py + 1.8, z + 0.22, px + 1, py + 1.95, z + 0.5, C.port);
    blink([px + 1.9, py + 1.8, z + 0.11], C.red, 1.2);
    blink([px + 2.4, py + 1.8, z + 0.11], C.ok, 1.2);
  }

  // small switch with blinking ports
  s.box(LAB + 3.9, RD - 2.4, top, LAB + 6.6, RD - 0.3, top + 0.7, C.switch);
  for (let p = 0; p < 5; p++) blink([LAB + 4.3 + p * 0.5, RD - 0.3, top + 0.35], C.ok, 1.2);

  // DGX Spark: a small gold box with a grille
  const dx = LAB + 7.2;
  s.box(dx, RD - 3.4, top, dx + 3.2, RD - 0.3, top + 1.3, C.gold);
  for (let g = 0; g < 6; g++) s.path([[dx + 0.35 + g * 0.45, RD - 0.29, top + 0.25], [dx + 0.35 + g * 0.45, RD - 0.29, top + 1.05]], C.grille, 1.4);
  blink([dx + 2.9, RD - 0.29, top + 0.65], C.ok, 1.4);

  // patch cables: Pis to the switch, switch to the Spark, and an uplink down to the last rack
  s.path(sag([px + 1, py + 1.95, top + 1.4], [LAB + 4.3, RD - 0.3, top + 0.35], 0.8, 6), C.cables[0], 1.6);
  s.path(sag([px + 1, py + 1.95, top + 3.6], [LAB + 4.8, RD - 0.3, top + 0.35], 1.2, 6), C.cables[2], 1.6);
  s.path(sag([LAB + 6.3, RD - 0.3, top + 0.35], [dx + 0.3, RD - 0.3, top + 0.3], 0.6, 6), C.cables[1], 1.6);
  s.path(sag([LAB + 5.8, RD - 0.3, top + 0.35], [rowW - 1.2, RD + 0.6, 2.5], 3.2, 12), C.cables[3], 2);
  // NAS up to the switch
  s.path(sag([nx + 2.2, RD - 0.58, 1.6], [LAB + 6.2, RD - 0.3, top + 0.35], -0.6, 6), C.cables[1], 1.6);

  // label above the bench
  const [lx, ly] = s.project(LAB + 0.4, RD, top + 6);
  s.raw(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${C.text}">homelab</text>`);
}

function svg(themeName) {
  const C = THEMES[themeName];
  // straight-on view, so a long row of racks makes a wide, short picture
  const s = createScene(11, oblique());
  seed = 42;

  // raised floor with a grid, and perforated cold-aisle tiles in front of the racks
  s.quad([[-2, -1, 0], [floorW, -1, 0], [floorW, RD + 5, 0], [-2, RD + 5, 0]], C.floor);
  for (let gx = -2; gx <= floorW; gx += 2) s.path([[gx, -1, 0], [gx, RD + 5, 0]], C.grid, 1);
  for (let gy = -1; gy <= RD + 5; gy += 2) s.path([[-2, gy, 0], [floorW, gy, 0]], C.grid, 1);
  for (let tx = 0; tx < rowW; tx += 4) s.quad([[tx, RD + 1.5, 0.02], [tx + 2, RD + 1.5, 0.02], [tx + 2, RD + 4.5, 0.02], [tx, RD + 4.5, 0.02]], C.tile);

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

  homelab(s, C);

  const nodes = LAYOUTS.flat().length;
  const css = `.rack { opacity: 0; animation: up .6s ease-out forwards; }
    .led { animation: blink 1.2s steps(1) infinite; }
    @keyframes up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @keyframes blink { 50% { opacity: .15; } }
    @media (prefers-reduced-motion: reduce) { .rack { opacity: 1; animation: none; } .led { animation: none; } }`;
  return card(s, { bg: C.bg, border: C.border, title: C.title, text: C.text },
    "dc-blr-01 · row A",
    `${RACKS} racks · ${nodes} nodes · <tspan fill="${C.ok}">${nodes - warnings} healthy</tspan> · <tspan fill="${C.warn}">${warnings} warn</tspan> · homelab online`,
    css, `Isometric data centre: ${RACKS} racks of ${nodes} servers with blinking status lights, a cable tray and patch cables carrying packets, plus a homelab bench with a Raspberry Pi cluster, a switch, a router, a DGX Spark and a NAS.`);
}

for (const theme of Object.keys(THEMES)) writeFileSync(new URL(`../assets/datacenter-${theme}.svg`, import.meta.url), svg(theme));
console.log("wrote datacenter-dark.svg, datacenter-light.svg");
