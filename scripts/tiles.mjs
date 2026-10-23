// Builds the skill tiles Skill Icons doesn't have, in its style (256px tiles, 60px corners, 44px gaps):
//   assets/nutanix-{dark,light}.svg   one tile, first in the big row
//   assets/ai-{dark,light}.svg        Claude, MCP, Ollama and Hugging Face in one row
// Logos come from simple-icons and lobe-icons. Static, so this only runs by hand:  node scripts/tiles.mjs
import { writeFileSync } from "node:fs";

const SOURCES = {
  nutanix: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/nutanix.svg",
  claude: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/claude.svg",
  mcp: "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.40.0/icons/mcp.svg",
  ollama: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/ollama.svg",
  huggingface: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/huggingface.svg",
};
// Brand colour, or null for a mark that is plain black or white
const COLORS = { nutanix: "#7855FA", claude: "#D97757", mcp: null, ollama: null, huggingface: "#FFD21E" };
const THEMES = { dark: { tile: "#242938", mark: "#FFFFFF" }, light: { tile: "#F4F2ED", mark: "#000000" } };

async function paths(name) {
  const svg = await (await fetch(SOURCES[name])).text();
  const found = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  if (!found.length) throw new Error(`no path in ${name}`);
  return found;
}

function row(names, marks, theme, label) {
  const T = THEMES[theme];
  const W = names.length * 300 - 44;
  const tiles = names
    .map((n, i) => {
      const fill = COLORS[n] ?? T.mark;
      const d = marks[n].map((p) => `<path d="${p}" fill="${fill}" fill-rule="evenodd"/>`).join("");
      return `<g transform="translate(${i * 300} 0)"><rect width="256" height="256" rx="60" fill="${T.tile}"/><g transform="translate(53 53) scale(6.25)">${d}</g></g>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(W / 256) * 48}" height="48" viewBox="0 0 ${W} 256" role="img" aria-label="${label}">${tiles}</svg>\n`;
}

const marks = {};
for (const name of Object.keys(SOURCES)) marks[name] = await paths(name);
for (const theme of Object.keys(THEMES)) {
  writeFileSync(new URL(`../assets/nutanix-${theme}.svg`, import.meta.url), row(["nutanix"], marks, theme, "Nutanix"));
  writeFileSync(new URL(`../assets/ai-${theme}.svg`, import.meta.url), row(["claude", "mcp", "ollama", "huggingface"], marks, theme, "Claude, Model Context Protocol, Ollama, Hugging Face"));
}
console.log("wrote nutanix-{dark,light}.svg and ai-{dark,light}.svg");
