// Refreshes the live parts of README.md: the activity log, the 3D contribution model and the fortune.
// Runs in the "Update README" workflow every 6 hours. Needs GITHUB_TOKEN for the contribution calendar.
import { readFileSync, writeFileSync } from "node:fs";
import { createModel, replaceSection } from "./stl.mjs";

const USER = "guranshdeol";
const YOUTUBE = "https://www.youtube.com/feeds/videos.xml?playlist_id=UULF-Z9VvWUZUq7SNZbaAENnvA";
const HASHNODE = "https://guranshdeol.hashnode.dev/rss.xml";
const README = new URL("../README.md", import.meta.url);
const MAX_ACTIVITY = 8;
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
const md = (s) => s.replace(/([\[\]])/g, "\\$1");
// "Oct 21" this year, "Oct 14 2024" for anything older
const day = (d) =>
  d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "Asia/Kolkata" }).replace(",", "") +
  (d.getFullYear() === new Date().getFullYear() ? "" : ` ${d.getFullYear()}`);
const repoLink = (name) => `[${name.split("/")[1]}](https://github.com/${name})`;
const headers = { "User-Agent": USER, ...(token ? { Authorization: `Bearer ${token}` } : {}) };

async function text(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function githubEvents() {
  const res = await fetch(`https://api.github.com/users/${USER}/events/public?per_page=100`, { headers });
  if (!res.ok) return [];
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
  for (const { at, label, repo, nums } of prs.values()) {
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
  const items = sources.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  if (!items.length) return null;
  const seen = new Set();
  return items
    .sort((a, b) => b.at - a.at)
    .filter((i) => !seen.has(i.line) && seen.add(i.line))
    .slice(0, MAX_ACTIVITY)
    .map((i) => `- \`${day(i.at)}\` ${i.line}`)
    .join("\n");
}

// Contribution calendar → a city of bars on a base plate, one bar per day with contributions.
async function contributionModel() {
  if (!token) return null;
  const query = `query { user(login: "${USER}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount } } } } } }`;
  const res = await fetch("https://api.github.com/graphql", { method: "POST", headers, body: JSON.stringify({ query }) });
  if (!res.ok) return null;
  const cal = (await res.json()).data?.user?.contributionsCollection?.contributionCalendar;
  if (!cal) return null;

  const m = createModel("contributions");
  const cell = 1, gap = 0.25, pitch = cell + gap, plate = 0.5;
  const weeks = cal.weeks.length;
  m.box(-0.6, -0.6, -plate, weeks * pitch + 0.35, 7 * pitch + 0.35, 0);
  cal.weeks.forEach((w, x) =>
    w.contributionDays.forEach((d, i) => {
      if (!d.contributionCount) return;
      const h = 0.6 + 2.4 * Math.log2(1 + d.contributionCount);
      // Sunday at the back, like the calendar on the profile
      const y = (6 - i) * pitch;
      m.box(x * pitch, y, 0, x * pitch + cell, y + cell, h, { bottom: false });
    }),
  );
  return { stl: m.toString(), total: cal.totalContributions };
}

function fortune() {
  const n = Math.floor(Date.now() / 86_400_000);
  return FORTUNES[n % FORTUNES.length];
}

let readme = readFileSync(README, "utf8");
const log = await activity();
if (log) readme = replaceSection(readme, "ACTIVITY", log);
const model = await contributionModel();
if (model) readme = replaceSection(readme, "CONTRIB", `<sub>${model.total} contributions in the last year · drag to rotate</sub>\n\n\`\`\`stl\n${model.stl}\n\`\`\``);
readme = replaceSection(readme, "FORTUNE", fortune(), { inline: true });
writeFileSync(README, readme);
console.log(`activity: ${log ? "updated" : "kept"} · contributions: ${model ? model.total : "kept"} · fortune updated`);
