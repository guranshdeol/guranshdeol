// Refreshes the live parts of README.md: the activity log, the 3D contribution model and the fortune.
// Runs in the "Update README" workflow every 6 hours. Needs GITHUB_TOKEN for the contribution calendar.
import { readFileSync, writeFileSync } from "node:fs";
import { createModel, replaceSection } from "./stl.mjs";
import { createScene, shades } from "./iso.mjs";

const USER = "guranshdeol";
const YOUTUBE = "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF-Z9VvWUZUq7SNZbaAENnvA";
const HASHNODE = "https://guranshdeol.hashnode.dev/rss.xml";
const README = new URL("../README.md", import.meta.url);
const MAX_ACTIVITY = 5;
const asset = (name) => new URL(`../assets/${name}`, import.meta.url);
const token = process.env.GITHUB_TOKEN;

const FORTUNES = [
  "It's always DNS. Except when it's the MTU.",
  "Snapshots are not backups. Backups you have never restored aren't either.",
  "Automate it the third time. Document it the first.",
  "The best incident is the one the alert caught before the customer did.",
  "Read-only first. Write access after a human says yes.",
  "Every quick change in production deserves a rollback plan.",
  "A cluster you don't upgrade is a cluster you'll upgrade at 2 a.m.",
  "Leave the cluster healthier than you found it.",
  "If the runbook needs tribal knowledge, it isn't a runbook yet.",
  "Green dashboards are a hypothesis. Logs are the evidence.",
];

const decode = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const md = (s) => s.replace(/([\[\]*_`<>\\])/g, "\\$1");
// "Oct 21" this year, "Oct 14 2024" for anything older
const day = (d) =>
  d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "Asia/Kolkata" }).replace(",", "") +
  (d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`);
const repoLink = (name) => `[${name.split("/")[1]}](https://github.com/${name})`;
const headers = { "User-Agent": USER, ...(token ? { Authorization: `Bearer ${token}` } : {}) };

async function text(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function githubEvents() {
  const res = await fetch(`https://api.github.com/users/${USER}/events/public?per_page=100`, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`events → ${res.status}`);
  const out = [];
  const prs = new Map();
  for (const e of await res.json()) {
    const p = e.payload || {};
    const at = new Date(e.created_at);
    if (e.type === "PullRequestEvent") {
      const num = p.pull_request?.number ?? p.number;
      const label = { opened: "💪 Opened", merged: "🎉 Merged", closed: p.pull_request?.merged ? "🎉 Merged" : "❌ Closed", reopened: "🔁 Reopened" }[p.action];
      if (!label) continue;
      // A burst of PRs in one repo on one day becomes one line, so posts and videos stay visible
      const key = `${label}|${e.repo.name}|${day(at)}`;
      const group = prs.get(key) || { at, label, repo: e.repo.name, nums: [] };
      if (!group.nums.includes(num)) group.nums.push(num);
      prs.set(key, group);
    } else if (e.type === "IssuesEvent" && ["opened", "closed"].includes(p.action)) {
      const num = p.issue?.number;
      const label = p.action === "opened" ? "❗ Opened" : "✔️ Closed";
      out.push({ at, line: `${label} issue [#${num}](https://github.com/${e.repo.name}/issues/${num}) in ${repoLink(e.repo.name)}` });
    } else if (e.type === "ReleaseEvent" && p.action === "published") {
      const tag = p.release?.tag_name || "a release";
      out.push({ at, line: `🚀 Released [${md(tag)}](https://github.com/${e.repo.name}/releases/tag/${encodeURIComponent(tag)}) of ${repoLink(e.repo.name)}` });
    } else if (e.type === "CreateEvent" && p.ref_type === "repository") {
      out.push({ at, line: `📦 Created ${repoLink(e.repo.name)}` });
    } else if (e.type === "PublicEvent") {
      out.push({ at, line: `🔓 Open-sourced ${repoLink(e.repo.name)}` });
    }
  }
  // An "opened" line adds nothing when the same PR's merge is already listed
  const merged = new Set([...prs.values()].filter((g) => g.label === "🎉 Merged").flatMap((g) => g.nums.map((n) => `${g.repo}#${n}`)));
  for (const g of prs.values()) if (g.label === "💪 Opened") g.nums = g.nums.filter((n) => !merged.has(`${g.repo}#${n}`));
  for (const { at, label, repo, nums } of prs.values()) {
    if (!nums.length) continue;
    const links = nums.sort((a, b) => a - b).map((n) => `[#${n}](https://github.com/${repo}/pull/${n})`).join(" ");
    out.push({ at, line: `${label} ${nums.length > 1 ? `${nums.length} PRs` : "PR"} ${links} in ${repoLink(repo)}` });
  }
  return out;
}

async function videos() {
  const xml = await text(YOUTUBE);
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    at: new Date(e.match(/<published>([^<]+)/)[1]),
    line: `🎥 Uploaded [${md(decode(e.match(/<title>([^<]*)<\/title>/)[1]))}](${e.match(/<link rel="alternate" href="([^"]+)"/)[1]})`,
  }));
}

async function posts() {
  const xml = await text(HASHNODE);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, e]) => ({
    at: new Date(e.match(/<pubDate>([^<]+)/)[1]),
    line: `✍️ Published [${md(decode(e.match(/<title>([\s\S]*?)<\/title>/)[1]))}](${decode(e.match(/<link>([^<]+)/)[1])})`,
  }));
}

async function activity() {
  const sources = await Promise.allSettled([githubEvents(), videos(), posts()]);
  // Only rewrite the log when every source answered, so an outage doesn't drop lines for a run
  if (sources.some((s) => s.status === "rejected")) return null;
  const items = sources.flatMap((s) => s.value);
  if (!items.length) return null;
  const seen = new Set();
  return items
    .sort((a, b) => b.at - a.at)
    .filter((i) => !seen.has(i.line) && seen.add(i.line))
    .slice(0, MAX_ACTIVITY)
    .map((i, n) => `${n + 1}. ${i.line}`)
    .join("\n");
}

async function calendar() {
  if (!token) return null;
  const query = `query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }`;
  const res = await fetch("https://api.github.com/graphql", { method: "POST", headers, body: JSON.stringify({ query }) });
  if (!res.ok) return null;
  return (await res.json()).data?.user?.contributionsCollection?.contributionCalendar ?? null;
}

const LEVELS = {
  dark: { bg: "#0d1117", text: "#8d96a0", title: "#e6edf3", accent: "#3fb950", cells: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
  light: { bg: "#ffffff", text: "#59636e", title: "#1f2328", accent: "#1a7f37", cells: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] },
};

// Contribution calendar → an isometric skyline that rises week by week, coloured like the GitHub graph
function topologySvg(cal, theme) {
  const C = LEVELS[theme];
  const counts = cal.weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount));
  const max = Math.max(1, ...counts);
  const level = (c) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((3 * Math.log(1 + c)) / Math.log(1 + max) + 0.0001)));
  const s = createScene(7);
  const cells = [];
  cal.weeks.forEach((w, x) => w.contributionDays.forEach((d, i) => cells.push({ x, y: i, c: d.contributionCount })));
  cells.sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const { x, y, c } of cells) {
    const h = c ? 0.6 + 2.6 * Math.log2(1 + c) : 0.15;
    const color = shades(C.cells[level(c)]);
    s.box(x * 1.2, y * 1.2, 0, x * 1.2 + 1, y * 1.2 + 1, h, color, c ? ` class="b" style="animation-delay:${(x * 0.04).toFixed(2)}s"` : "");
  }
  const busiest = cal.weeks.flatMap((w) => w.contributionDays).reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a));
  const b = s.bounds(14), head = 46;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" viewBox="${b.x.toFixed(0)} ${(b.y - head).toFixed(0)} ${b.w.toFixed(0)} ${(b.h + head).toFixed(0)}" role="img" aria-label="Isometric contribution skyline: ${cal.totalContributions} contributions in the last year.">
  <style>
    text { font: 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .b { transform-box: fill-box; transform-origin: 50% 100%; animation: rise .7s cubic-bezier(.2,.8,.3,1.2) both; }
    @keyframes rise { from { transform: scaleY(0); } }
    @media (prefers-reduced-motion: reduce) { .b { animation: none; } }
  </style>
  <rect x="${b.x.toFixed(0)}" y="${(b.y - head).toFixed(0)}" width="${b.w.toFixed(0)}" height="${(b.h + head).toFixed(0)}" rx="12" fill="${C.bg}"/>
  <text x="${(b.x + 18).toFixed(0)}" y="${(b.y - head + 26).toFixed(0)}" fill="${C.title}" font-weight="700">${cal.totalContributions} contributions · last 12 months</text>
  <text x="${(b.x + 18).toFixed(0)}" y="${(b.y - head + 44).toFixed(0)}" fill="${C.text}">peak <tspan fill="${C.accent}">${busiest.contributionCount}</tspan> on ${busiest.date} · click to open in 3D</text>
  ${s.toString()}
</svg>
`;
}

// The same calendar as a 3D model, opened from the topology image
function contributionModel(cal) {
  const m = createModel("contributions");
  const cell = 1, gap = 0.25, pitch = cell + gap, plate = 0.5;
  const weeks = cal.weeks.length;
  m.box(-0.6, -0.6, -plate, weeks * pitch + 0.35, 7 * pitch + 0.35, 0);
  cal.weeks.forEach((w, x) =>
    w.contributionDays.forEach((d, i) => {
      if (!d.contributionCount) return;
      // Tall bars, so the model still reads as a skyline from the viewer's default camera
      const h = 1.5 + 4.5 * Math.log2(1 + d.contributionCount);
      // Sunday at the back, like the calendar on the profile
      const y = (6 - i) * pitch;
      m.box(x * pitch, y, 0, x * pitch + cell, y + cell, h, { bottom: false });
    }),
  );
  return m.toString();
}

// Changes once a week, so the repo isn't committed to every day just for this
function fortune() {
  const n = Math.floor(Date.now() / (7 * 86_400_000));
  return FORTUNES[n % FORTUNES.length];
}

let readme = readFileSync(README, "utf8");
const log = await activity();
if (log) readme = replaceSection(readme, "ACTIVITY", log);
const cal = await calendar();
if (cal) {
  for (const theme of Object.keys(LEVELS)) writeFileSync(asset(`topology-${theme}.svg`), topologySvg(cal, theme));
  writeFileSync(asset("contributions.stl"), contributionModel(cal) + "\n");
}
readme = replaceSection(readme, "FORTUNE", fortune(), { inline: true });
writeFileSync(README, readme);
console.log(`activity: ${log ? "updated" : "kept"} · contributions: ${cal ? cal.totalContributions : "kept"} · fortune updated`);
