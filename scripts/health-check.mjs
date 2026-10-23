// Builds assets/health-check-dark.svg and assets/health-check-light.svg: the name banner and the animated
// NCC-style terminal at the top of the README. The "latest video" and "uptime" lines change, so the workflow
// re-runs this every 6 hours.
import { writeFileSync } from "node:fs";

const FEED = "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF-Z9VvWUZUq7SNZbaAENnvA";
const FALLBACK_VIDEO = "AI Distillation Explained";

// "GURANSH DEOL" in figlet's ANSI Shadow font. Blocks are drawn as rects and the shadow as lines,
// so it looks the same whatever monospace font the viewer has.
const BANNER = [
  " ██████╗ ██╗   ██╗██████╗  █████╗ ███╗   ██╗███████╗██╗  ██╗    ██████╗ ███████╗ ██████╗ ██╗",
  "██╔════╝ ██║   ██║██╔══██╗██╔══██╗████╗  ██║██╔════╝██║  ██║    ██╔══██╗██╔════╝██╔═══██╗██║",
  "██║  ███╗██║   ██║██████╔╝███████║██╔██╗ ██║███████╗███████║    ██║  ██║█████╗  ██║   ██║██║",
  "██║   ██║██║   ██║██╔══██╗██╔══██║██║╚██╗██║╚════██║██╔══██║    ██║  ██║██╔══╝  ██║   ██║██║",
  "╚██████╔╝╚██████╔╝██║  ██║██║  ██║██║ ╚████║███████║██║  ██║    ██████╔╝███████╗╚██████╔╝███████╗",
  " ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝    ╚═════╝ ╚══════╝ ╚═════╝ ╚══════╝",
];
const SUBTITLE = "consultant @ nutanix";
const JOINED = new Date("2021-10-01T12:20:56Z"); // GitHub account created

const THEMES = {
  dark: { pass: "#3fb950", info: "#4493f8", warn: "#d29922", muted: "#8d96a0", fg: "#e6edf3", shadow: "#1f6f35",
    bg: "#0d1117", bar: "#161b22", line: "#30363d", red: "#f85149", yellow: "#d29922", green: "#3fb950" },
  light: { pass: "#1a7f37", info: "#0969da", warn: "#9a6700", muted: "#59636e", fg: "#1f2328", shadow: "#8fd19e",
    bg: "#ffffff", bar: "#f6f8fa", line: "#d1d9e0", red: "#ff5f57", yellow: "#febc2e", green: "#28c840" },
};
let C = THEMES.dark;

function uptime(now = new Date()) {
  let years = now.getUTCFullYear() - JOINED.getUTCFullYear();
  const anniversary = new Date(JOINED);
  anniversary.setUTCFullYear(JOINED.getUTCFullYear() + years);
  if (anniversary > now) anniversary.setUTCFullYear(JOINED.getUTCFullYear() + --years);
  const days = Math.floor((now - anniversary) / 86_400_000);
  return `${years} years, ${days} day${days === 1 ? "" : "s"}`;
}

// Timeline, in seconds
const T = { banner: 2.2, subtitle: 1.6, gap: 0.5, command: 3.0, step: 1.2 };
const subtitleAt = T.banner + 0.2;
const windowAt = subtitleAt + T.subtitle + T.gap;
const commandAt = windowAt + 0.4;
const linesAt = commandAt + T.command + 0.3;

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

// Returns null when the feed can't be read, so the last good SVGs stay as they are
async function latestVideo() {
  try {
    const res = await fetch(FEED, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const titles = [...(await res.text()).matchAll(/<entry>[\s\S]*?<title>([^<]*)<\/title>/g)].map((m) => decode(m[1]));
    if (!titles[0]) return null;
    // Keep the line inside the terminal: cut at a colon, then cap the length
    const short = titles[0].split(":")[0].trim();
    return short.length > 44 ? short.slice(0, 43) + "…" : short;
  } catch {
    return null;
  }
}

function banner(x0, y0, cw, ch) {
  const rects = [];
  const lines = [];
  BANNER.forEach((row, r) => {
    const y = y0 + r * ch;
    let run = -1;
    [...row, " "].forEach((char, i) => {
      if (char === "█") {
        if (run < 0) run = i;
        return;
      }
      if (run >= 0) {
        rects.push(`<rect x="${(x0 + run * cw).toFixed(1)}" y="${y}" width="${((i - run) * cw).toFixed(1)}" height="${ch}"/>`);
        run = -1;
      }
      if (char === " ") return;
      const x = x0 + i * cw, cx = x + cw / 2, cy = y + ch / 2;
      const seg = {
        "═": `M${x} ${cy}H${x + cw}`,
        "║": `M${cx} ${y}V${y + ch}`,
        "╗": `M${x} ${cy}H${cx}V${y + ch}`,
        "╔": `M${x + cw} ${cy}H${cx}V${y + ch}`,
        "╝": `M${x} ${cy}H${cx}V${y}`,
        "╚": `M${x + cw} ${cy}H${cx}V${y}`,
      }[char];
      if (seg) lines.push(seg);
    });
  });
  return `<g fill="${C.pass}">${rects.join("")}</g><path d="${lines.join("")}" stroke="${C.shadow}" stroke-width="2" fill="none"/>`;
}

function check(status, label, value) {
  const dots = ".".repeat(Math.max(3, 27 - label.length));
  return [{ t: "[ " }, { t: status.padEnd(4), c: C[status.toLowerCase()], b: true }, { t: ` ] ${label} ${dots} ${value}` }];
}

function build(video, theme) {
  C = THEMES[theme];
  const lines = [
    [{ t: "nutanix@cvm$", c: C.pass }, { t: " ncc health_checks run_all --target=guranshdeol" }],
    [{ t: "Running 9 checks against 1 human...", c: C.muted }],
    [],
    check("PASS", "role", "Consultant @ Nutanix"),
    check("PASS", "certifications", "NCM-MCI · 10× Nutanix · GitHub"),
    check("INFO", "location", "Punjab (home) ↔ Bengaluru (work)"),
    check("PASS", "clusters left healthier", "all of them"),
    check("WARN", "side project", "AI agent asks before every fix"),
    [{ t: "         └─ expected behaviour, will not fix", c: C.muted }],
    check("PASS", "latest video", video),
    check("PASS", "uptime", uptime()),
    check("PASS", "open to opportunities", "yes"),
    [],
    [{ t: "Summary:", b: true }, { t: " 7 PASS · 1 INFO · 1 WARN · 0 FAIL" }],
    [{ t: "Full report → ", c: C.muted }, { t: "guranshdeol.tech", c: C.info }],
  ];

  const W = 860, cw = 8.6, ch = 12;
  const bannerW = Math.max(...BANNER.map((r) => r.length)) * cw;
  const bannerY = 10, subtitleY = bannerY + BANNER.length * ch + 28;
  const winY = subtitleY + 22, winTop = winY + 64, lh = 23;
  const H = winTop + lines.length * lh + 6;

  // Each line waits T.step after the one before it; blank lines take no time
  let at = linesAt - T.step;
  const body = lines
    .map((parts, i) => {
      if (!parts.length) return "";
      const spans = parts.map((p) => `<tspan${p.c ? ` fill="${p.c}"` : ""}${p.b ? ' font-weight="700"' : ""}>${esc(p.t)}</tspan>`).join("");
      const cls = i === 0 ? "cmd" : "ln";
      const delay = i === 0 ? commandAt : (at += T.step);
      return `<text x="24" y="${winTop + i * lh}" class="${cls}" style="animation-delay:${delay.toFixed(2)}s">${spans}</text>`;
    })
    .filter(Boolean)
    .join("\n    ");
  const lastY = winTop + (lines.length - 1) * lh;
  const cursorAt = (at + 0.6).toFixed(2);
  const wh = H - winY - 1;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Guransh Deol. Health check: Consultant at Nutanix. NCM-MCI, 10 Nutanix certifications. From Punjab, working in Bengaluru. Latest video: ${esc(video)}. Open to opportunities.">
  <style>
    text { font: 14px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; fill: ${C.fg}; white-space: pre; }
    .banner { clip-path: inset(0 100% 0 0); animation: wipe ${T.banner}s steps(${Math.max(...BANNER.map((r) => r.length))}) forwards; }
    .sub { clip-path: inset(0 100% 0 0); animation: wipe ${T.subtitle}s steps(${SUBTITLE.length}) ${subtitleAt}s forwards; }
    .win { opacity: 0; transform: translateY(8px); animation: rise .5s ease-out ${windowAt}s forwards; }
    .ln { opacity: 0; animation: show .25s ease-out forwards; }
    .cmd { clip-path: inset(0 100% 0 0); animation: wipe ${T.command}s steps(58) forwards; }
    .cursor { opacity: 0; animation: show .01s ${cursorAt}s forwards, blink 1.1s steps(1) ${cursorAt}s infinite; }
    @keyframes wipe { to { clip-path: inset(0 0 0 0); } }
    @keyframes show { to { opacity: 1; } }
    @keyframes rise { to { opacity: 1; transform: none; } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .banner, .sub, .cmd { clip-path: none; animation: none; }
      .win, .ln, .cursor { opacity: 1; transform: none; animation: none; }
    }
  </style>
  <g class="banner">${banner((W - bannerW) / 2, bannerY, cw, ch)}</g>
  <text class="sub" x="${W / 2}" y="${subtitleY}" text-anchor="middle" style="font-size:13px;fill:${C.muted};letter-spacing:.06em">${esc(SUBTITLE)}</text>
  <g class="win">
    <rect x="0.5" y="${winY + 0.5}" width="${W - 1}" height="${wh}" rx="10" fill="${C.bg}" stroke="${C.line}"/>
    <path d="M0.5 ${winY + 10.5}a10 10 0 0 1 10-10h${W - 21}a10 10 0 0 1 10 10v24h-${W - 1}z" fill="${C.bar}"/>
    <line x1="0.5" y1="${winY + 34.5}" x2="${W - 0.5}" y2="${winY + 34.5}" stroke="${C.line}"/>
    <circle cx="20" cy="${winY + 17.5}" r="6" fill="${C.red}"/><circle cx="40" cy="${winY + 17.5}" r="6" fill="${C.yellow}"/><circle cx="60" cy="${winY + 17.5}" r="6" fill="${C.green}"/>
    <text x="${W / 2}" y="${winY + 22}" text-anchor="middle" style="font-size:12px;fill:${C.muted}">nutanix@cvm: ~</text>
    ${body}
    <rect class="cursor" x="${24 + 8.43 * 30}" y="${lastY - 13}" width="8" height="16" fill="${C.pass}"/>
  </g>
</svg>
`;
}

const video = (await latestVideo()) ?? (process.argv.includes("--force") ? FALLBACK_VIDEO : null);
if (!video) {
  console.log("YouTube feed unavailable; keeping the current SVGs (pass --force to build anyway)");
  process.exit(0);
}
for (const theme of Object.keys(THEMES)) {
  writeFileSync(new URL(`../assets/health-check-${theme}.svg`, import.meta.url), build(video, theme));
}
console.log(`wrote health-check-dark.svg and health-check-light.svg · uptime ${uptime()}`);
