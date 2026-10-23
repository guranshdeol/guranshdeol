// Builds assets/health-check.svg: the animated NCC-style terminal at the top of the README.
// The "latest video" line comes from the YouTube feed, so the workflow re-runs this every 6 hours.
import { writeFileSync } from "node:fs";

const FEED = "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF-Z9VvWUZUq7SNZbaAENnvA";
const FALLBACK_VIDEO = "AI Distillation Explained";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

async function latestVideo() {
  try {
    const xml = await (await fetch(FEED)).text();
    const titles = [...xml.matchAll(/<entry>[\s\S]*?<title>([^<]*)<\/title>/g)].map((m) => decode(m[1]));
    if (!titles[0]) return FALLBACK_VIDEO;
    // Keep the line inside the terminal: cut at a colon, then cap the length
    const short = titles[0].split(":")[0].trim();
    return short.length > 44 ? short.slice(0, 43) + "…" : short;
  } catch {
    return FALLBACK_VIDEO;
  }
}

const COLORS = { pass: "#3fb950", info: "#4493f8", warn: "#d29922", muted: "#8d96a0", fg: "#e6edf3" };

function check(status, label, value) {
  const dots = ".".repeat(Math.max(3, 27 - label.length));
  return [
    { t: "[ " },
    { t: status.padEnd(4), c: COLORS[status.toLowerCase()], b: true },
    { t: ` ] ${label} ${dots} ${value}` },
  ];
}

async function build() {
  const video = await latestVideo();
  const lines = [
    [{ t: "nutanix@cvm$", c: COLORS.pass }, { t: " ncc health_checks run_all --target=guranshdeol" }],
    [{ t: "Running 8 checks against 1 human...", c: COLORS.muted }],
    [],
    check("PASS", "role", "Consultant @ Nutanix"),
    check("PASS", "certifications", "NCM-MCI · 10× Nutanix · GitHub"),
    check("INFO", "location", "Punjab (home) ↔ Bengaluru (work)"),
    check("PASS", "clusters left healthier", "all of them"),
    check("WARN", "side project", "AI agent asks before every fix"),
    [{ t: "         └─ expected behaviour, will not fix", c: COLORS.muted }],
    check("PASS", "latest video", video),
    check("PASS", "open to opportunities", "yes"),
    [],
    [{ t: "Summary:", b: true }, { t: " 6 PASS · 1 INFO · 1 WARN · 0 FAIL" }],
    [{ t: "Full report → ", c: COLORS.muted }, { t: "guranshdeol.tech", c: COLORS.info }],
  ];

  const W = 860, top = 64, lh = 23, H = top + lines.length * lh + 22;
  const step = 0.32; // seconds between lines
  const typeDur = 1.6; // the first command types out
  const body = lines
    .map((parts, i) => {
      const y = top + i * lh;
      const spans = parts
        .map((p) => `<tspan${p.c ? ` fill="${p.c}"` : ""}${p.b ? ' font-weight="700"' : ""}>${esc(p.t)}</tspan>`)
        .join("");
      const delay = i === 0 ? 0 : typeDur + i * step;
      const cls = i === 0 ? "cmd" : "ln";
      return `<text x="24" y="${y}" class="${cls}" style="animation-delay:${delay.toFixed(2)}s">${spans}</text>`;
    })
    .join("\n  ");
  const lastY = top + (lines.length - 1) * lh;
  const cursorDelay = (typeDur + (lines.length - 1) * step + 0.3).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Health check: Guransh Deol, Consultant at Nutanix. NCM-MCI, 10 Nutanix certifications. From Punjab, working in Bengaluru. Latest video: ${esc(video)}. Open to opportunities.">
  <style>
    text { font: 14px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; fill: ${COLORS.fg}; white-space: pre; }
    .ln { opacity: 0; animation: show .2s ease-out forwards; }
    .cmd { clip-path: inset(0 100% 0 0); animation: type ${typeDur}s steps(58) forwards; }
    .cursor { opacity: 0; animation: show .01s forwards ${cursorDelay}s, blink 1.1s steps(1) infinite ${cursorDelay}s; }
    @keyframes show { to { opacity: 1; } }
    @keyframes type { to { clip-path: inset(0 0 0 0); } }
    @keyframes blink { 50% { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .ln, .cursor { opacity: 1; animation: none; }
      .cmd { clip-path: none; animation: none; }
    }
  </style>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="#0d1117" stroke="#30363d"/>
  <path d="M0.5 10.5a10 10 0 0 1 10-10h${W - 21}a10 10 0 0 1 10 10v24h-${W - 1}z" fill="#161b22"/>
  <line x1="0.5" y1="34.5" x2="${W - 0.5}" y2="34.5" stroke="#30363d"/>
  <circle cx="20" cy="17.5" r="6" fill="#f85149"/><circle cx="40" cy="17.5" r="6" fill="#d29922"/><circle cx="60" cy="17.5" r="6" fill="#3fb950"/>
  <text x="${W / 2}" y="22" text-anchor="middle" style="font-size:12px;fill:${COLORS.muted}">nutanix@cvm: ~</text>
  ${body}
  <rect class="cursor" x="${24 + 8.43 * 30}" y="${lastY - 13}" width="8" height="16" fill="${COLORS.pass}"/>
</svg>
`;
}

writeFileSync(new URL("../assets/health-check.svg", import.meta.url), await build());
console.log("wrote assets/health-check.svg");
