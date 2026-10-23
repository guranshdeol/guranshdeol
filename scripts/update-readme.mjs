// Refreshes the live parts of the profile: the activity log and fortune in README.md, and the contribution
// topology (assets/topology-{dark,light}.svg).
// Runs in the "Update README" workflow every 6 hours. Needs GITHUB_TOKEN for the contribution calendar.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceSection } from "./sections.mjs";
import { card, createScene, isometric, shades } from "./iso.mjs";
import { esc, FONT, spans, THEMES as TERMINAL, windowFrame } from "./terminal.mjs";

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
      if (num == null) continue;
      const label = { opened: "💪 Opened", merged: "🎉 Merged", closed: p.pull_request?.merged ? "🎉 Merged" : "❌ Closed", reopened: "🔁 Reopened" }[p.action];
      if (!label) continue;
      // A burst of PRs in one repo on one day becomes one line, so posts and videos stay visible
      const key = `${label}|${e.repo.name}|${day(at)}`;
      const group = prs.get(key) || { at, label, repo: e.repo.name, nums: [] };
      if (!group.nums.includes(num)) group.nums.push(num);
      prs.set(key, group);
    } else if (e.type === "IssuesEvent" && ["opened", "closed"].includes(p.action)) {
      const num = p.issue?.number;
      if (num == null) continue;
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

// The public calendar page counts private contributions too (when "Private contributions" is on in the
// profile settings), which the API doesn't give the workflow's token. Falls back to GraphQL.
async function publicCalendar() {
  try {
    const html = await text(`https://github.com/users/${USER}/contributions`);
    const counts = new Map();
    for (const [, id, label] of html.matchAll(/<tool-tip[^>]*\bfor="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
      counts.set(id, /^No contributions/.test(label) ? 0 : parseInt(label.replace(/,/g, ""), 10));
    }
    const weeks = [];
    for (const [, attrs] of html.matchAll(/<td([^>]*class="ContributionCalendar-day"[^>]*)>/g)) {
      const date = attrs.match(/data-date="([^"]+)"/)?.[1];
      const id = attrs.match(/id="(contribution-day-component-(\d+)-(\d+))"/);
      if (!date || !id || !counts.has(id[1]) || Number.isNaN(counts.get(id[1]))) continue;
      const [dow, week] = [+id[2], +id[3]];
      (weeks[week] ??= { contributionDays: [] }).contributionDays[dow] = { date, contributionCount: counts.get(id[1]) };
    }
    const days = weeks.flatMap((w) => w?.contributionDays.filter(Boolean) ?? []);
    if (days.length < 300) return null;
    return {
      totalContributions: days.reduce((sum, d) => sum + d.contributionCount, 0),
      weeks: weeks.filter(Boolean).map((w) => ({ contributionDays: w.contributionDays.filter(Boolean) })),
    };
  } catch {
    return null;
  }
}

async function calendar() {
  const fromPage = await publicCalendar();
  if (fromPage) return fromPage;
  if (!token) return null;
  const query = `query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } } } }`;
  // A failed call keeps the last topology instead of failing the whole run
  try {
    const res = await fetch("https://api.github.com/graphql", { method: "POST", headers, body: JSON.stringify({ query }), signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const cal = (await res.json()).data?.user?.contributionsCollection?.contributionCalendar;
    return cal?.weeks?.length ? cal : null;
  } catch {
    return null;
  }
}

const LEVELS = {
  dark: { bg: "#0d1117", border: "#30363d", edge: "rgba(0,0,0,.35)", text: "#8d96a0", title: "#e6edf3", accent: "#3fb950", cells: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"] },
  light: { bg: "#ffffff", border: "#d1d9e0", edge: "rgba(0,0,0,.18)", text: "#59636e", title: "#1f2328", accent: "#1a7f37", cells: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"] },
};

// Contribution calendar → an isometric skyline that rises week by week, coloured like the GitHub graph
function topologySvg(cal, theme) {
  const C = LEVELS[theme];
  const counts = cal.weeks.flatMap((w) => w.contributionDays.map((d) => d.contributionCount));
  const max = Math.max(1, ...counts);
  const level = (c) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((3 * Math.log(1 + c)) / Math.log(1 + max) + 0.0001)));
  // a flatter 20° view and shorter bars keep the skyline wide and low
  const s = createScene(7, isometric(20));
  const cells = [];
  cal.weeks.forEach((w, x) => w.contributionDays.forEach((d, i) => cells.push({ x, y: i, c: d.contributionCount })));
  cells.sort((a, b) => a.x + a.y - (b.x + b.y));
  // Linear heights, so a 1-contribution day stays short next to the peak; scaled to the year's busiest day
  const unit = Math.min(0.6, 12 / max);
  for (const { x, y, c } of cells) {
    const h = c ? 0.5 + c * unit : 0.15;
    const color = { ...shades(C.cells[level(c)]), stroke: C.edge };
    s.box(x * 1.2, y * 1.2, 0, x * 1.2 + 1, y * 1.2 + 1, h, color, c ? ` class="b" style="animation-delay:${(x * 0.04).toFixed(2)}s"` : "");
  }
  const busiest = cal.weeks.flatMap((w) => w.contributionDays).reduce((a, b) => (b.contributionCount > a.contributionCount ? b : a));
  const css = `.b { transform-box: fill-box; transform-origin: 50% 100%; animation: rise .7s cubic-bezier(.2,.8,.3,1.2) both; }
    @keyframes rise { from { transform: scaleY(0); } }
    @media (prefers-reduced-motion: reduce) { .b { animation: none; } }`;
  return card(s, C, `${cal.totalContributions} contributions · last 12 months`,
    `peak <tspan fill="${C.accent}">${busiest.contributionCount}</tspan> on ${busiest.date}`,
    css, `Isometric contribution skyline: ${cal.totalContributions} contributions in the last year.`);
}

// Changes once a week. The uptime line and the rolling calendar still give about one commit a day.
function fortune() {
  const n = Math.floor(Date.now() / (7 * 86_400_000));
  return FORTUNES[n % FORTUNES.length];
}

// The footer: the same terminal window as the health check, running `fortune` and then `exit`
function footerSvg(theme, saying) {
  const C = TERMINAL[theme];
  const lines = [
    [{ t: "nutanix@cvm$", c: C.pass }, { t: " fortune" }],
    [{ t: saying }],
    [],
    [{ t: "nutanix@cvm$", c: C.pass }, { t: " exit" }],
    [{ t: "logout", c: C.muted }],
    [{ t: "Connection to guranshdeol closed.", c: C.muted }],
  ];
  const W = 860, top = 64, lh = 23, H = top + lines.length * lh + 4;
  const body = lines
    .map((parts, i) => (parts.length ? `<text x="24" y="${top + i * lh}" class="ln" style="animation-delay:${(i * 0.35).toFixed(2)}s">${spans(parts)}</text>` : ""))
    .filter(Boolean)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="fortune: ${esc(saying)}. exit. Connection to guranshdeol closed.">
  <style>
    text { font: 14px ${FONT}; fill: ${C.fg}; white-space: pre; }
    .ln { opacity: 0; animation: show .3s ease-out forwards; }
    @keyframes show { to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .ln { opacity: 1; animation: none; } }
  </style>
  ${windowFrame(W, 0, H - 1, C)}
  ${body}
</svg>
`;
}

let readme = readFileSync(README, "utf8");
const log = await activity();
if (log) readme = replaceSection(readme, "ACTIVITY", log);
const cal = await calendar();
if (cal) {
  for (const theme of Object.keys(LEVELS)) writeFileSync(asset(`topology-${theme}.svg`), topologySvg(cal, theme));
}
const saying = fortune();
for (const theme of Object.keys(TERMINAL)) writeFileSync(asset(`footer-${theme}.svg`), footerSvg(theme, saying));
writeFileSync(README, readme);
console.log(`activity: ${log ? "updated" : "kept"} · contributions: ${cal ? cal.totalContributions : "kept"} · fortune updated`);
