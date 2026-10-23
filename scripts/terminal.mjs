// Shared look for the terminal windows in the README: the health check at the top and the footer.
export const THEMES = {
  dark: { pass: "#3fb950", info: "#4493f8", warn: "#d29922", muted: "#8d96a0", fg: "#e6edf3", shadow: "#1f6f35",
    bg: "#0d1117", bar: "#161b22", line: "#30363d", red: "#f85149", yellow: "#d29922", green: "#3fb950" },
  light: { pass: "#1a7f37", info: "#0969da", warn: "#9a6700", muted: "#59636e", fg: "#1f2328", shadow: "#8fd19e",
    bg: "#ffffff", bar: "#f6f8fa", line: "#d1d9e0", red: "#ff5f57", yellow: "#febc2e", green: "#28c840" },
};

export const FONT = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;

export const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Window frame W wide and h tall at y: border, title bar, traffic lights and the title
export function windowFrame(W, y, h, C, title = "nutanix@cvm: ~") {
  return `<rect x="0.5" y="${y + 0.5}" width="${W - 1}" height="${h}" rx="10" fill="${C.bg}" stroke="${C.line}"/>
    <path d="M0.5 ${y + 10.5}a10 10 0 0 1 10-10h${W - 21}a10 10 0 0 1 10 10v24h-${W - 1}z" fill="${C.bar}"/>
    <line x1="0.5" y1="${y + 34.5}" x2="${W - 0.5}" y2="${y + 34.5}" stroke="${C.line}"/>
    <circle cx="20" cy="${y + 17.5}" r="6" fill="${C.red}"/><circle cx="40" cy="${y + 17.5}" r="6" fill="${C.yellow}"/><circle cx="60" cy="${y + 17.5}" r="6" fill="${C.green}"/>
    <text x="${W / 2}" y="${y + 22}" text-anchor="middle" style="font-size:12px;fill:${C.muted}">${esc(title)}</text>`;
}

// One line of coloured spans: [{ t: "text", c: "#hex", b: true }]
export const spans = (parts) =>
  parts.map((p) => `<tspan${p.c ? ` fill="${p.c}"` : ""}${p.b ? ' font-weight="700"' : ""}>${esc(p.t)}</tspan>`).join("");
