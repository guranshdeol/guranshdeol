// Builds the "data centre" 3D block in README.md: a row of racks on a raised floor, servers with drive bays,
// top-of-rack switches, an overhead cable tray and patch cables. Static, so this only runs by hand:
//   node scripts/datacenter.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createModel, replaceSection } from "./stl.mjs";

const README = new URL("../README.md", import.meta.url);
const m = createModel("datacenter");

const RACKS = 3, RW = 6, RD = 9, RH = 20, GAP = 0.8, POST = 0.45;
const rowW = RACKS * RW + (RACKS - 1) * GAP;

// Raised floor with a row of perforated tiles in front of the racks
m.box(-3, -7, -0.6, rowW + 3, RD + 3, 0);
for (let i = 0; i < 6; i++) m.box(-1 + i * 4, -5.5, 0, 1.8 + i * 4, -2.7, 0.08, { bottom: false });

// A cable from a to b, drawn as short box segments that sag in the middle
function cable(a, b, sag, t = 0.28, segments = 7) {
  const pt = (s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s - sag * Math.sin(Math.PI * s)];
  for (let i = 0; i < segments; i++) {
    const p = pt(i / segments), q = pt((i + 1) / segments);
    m.box(Math.min(p[0], q[0]) - t / 2, Math.min(p[1], q[1]) - t / 2, Math.min(p[2], q[2]) - t / 2,
      Math.max(p[0], q[0]) + t / 2, Math.max(p[1], q[1]) + t / 2, Math.max(p[2], q[2]) + t / 2, { bottom: false });
  }
}

// Server layout per rack, bottom to top: heights in rack units of 1.7
const LAYOUTS = [
  [2, 1, 1, 2, 1, 1, 1],
  [1, 1, 2, 2, 1, 1, 1],
  [2, 2, 1, 1, 1, 1, 1],
];

for (let r = 0; r < RACKS; r++) {
  const x = r * (RW + GAP);
  // frame: plinth, four posts, roof
  m.box(x, 0, 0, x + RW, RD, 0.7, { bottom: false });
  for (const [px, py] of [[0, 0], [RW - POST, 0], [0, RD - POST], [RW - POST, RD - POST]]) m.box(x + px, py, 0.7, x + px + POST, py + POST, RH - 0.5, { bottom: false });
  m.box(x, 0, RH - 0.5, x + RW, RD, RH);

  // servers with a strip of drive bays on the front
  let z = 1.1;
  for (const units of LAYOUTS[r]) {
    const h = units * 1.7 - 0.3;
    m.box(x + 0.55, 0.35, z, x + RW - 0.55, RD - 0.6, z + h, { bottom: false });
    m.box(x + 0.9, 0.1, z + 0.25, x + RW - 2.2, 0.35, z + h - 0.25, { bottom: false });
    m.box(x + RW - 1.5, 0.1, z + h / 2 - 0.2, x + RW - 0.9, 0.35, z + h / 2 + 0.2, { bottom: false }); // power button
    z += units * 1.7;
  }

  // top-of-rack switch with a row of ports, and patch cables down to the servers
  const sw = RH - 2.1;
  m.box(x + 0.55, 0.2, sw, x + RW - 0.55, RD - 0.6, sw + 1.2, { bottom: false });
  for (let p = 0; p < 6; p++) m.box(x + 0.95 + p * 0.75, 0.05, sw + 0.4, x + 1.4 + p * 0.75, 0.2, sw + 0.8, { bottom: false });
  cable([x + 1.2, -0.15, sw + 0.4], [x + 1.6, -0.15, 6.2], 0, 0.22, 5);
  cable([x + 4.0, -0.15, sw + 0.4], [x + RW - 1.2, -0.25, 3.0], 0, 0.22, 6);
  cable([x + 2.4, -0.25, sw + 0.3], [x + 4.6, -0.3, 9.5], 1.4, 0.22, 6);

  // bundle rising from the roof to the tray
  m.box(x + RW / 2 - 0.35, RD / 2 - 0.35, RH, x + RW / 2 + 0.35, RD / 2 + 0.35, RH + 3, { bottom: false });
}

// Overhead cable tray on hangers, plus two bundles that sag between it and the end racks
const trayZ = RH + 3;
m.box(-1.5, RD / 2 - 1, trayZ, rowW + 1.5, RD / 2 + 1, trayZ + 0.5);
m.box(-1.5, RD / 2 - 1, trayZ + 0.5, rowW + 1.5, RD / 2 - 0.8, trayZ + 1.1, { bottom: false });
m.box(-1.5, RD / 2 + 0.8, trayZ + 0.5, rowW + 1.5, RD / 2 + 1, trayZ + 1.1, { bottom: false });
for (const hx of [-1, rowW / 2, rowW + 1]) m.box(hx - 0.15, RD / 2 - 0.15, trayZ + 1.1, hx + 0.15, RD / 2 + 0.15, trayZ + 5, { bottom: false });
cable([-1.2, RD / 2, trayZ], [-1.2, RD / 2, 0.2], 0, 0.5, 1);
cable([rowW + 1.2, RD / 2, trayZ], [rowW + 1.2, RD / 2, 0.2], 0, 0.5, 1);
cable([0.6, RD / 2, trayZ + 0.6], [rowW - 0.6, RD / 2, trayZ + 0.6], -0.8, 0.35, 10);

const readme = readFileSync(README, "utf8");
writeFileSync(README, replaceSection(readme, "DATACENTER", "```stl\n" + m.toString() + "\n```"));
console.log(`datacenter: ${m.size} facets`);
