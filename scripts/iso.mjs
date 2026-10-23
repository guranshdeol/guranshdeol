// Small 2.5D SVG renderer for the coloured, animated scenes in the README (topology and data centre).
// World axes: x, y (larger y is nearer the viewer), z up. Faces drawn: top, right (x1) and front (y1).
// Projections:
//   isometric(angle): x runs right-down, y left-down; a lower angle flattens the view and the picture
//   oblique: x runs straight across, depth recedes up-right, so a long row stays wide and short
export const isometric = (deg = 30) => {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180);
  return { ax: c, bx: c, ay: s, by: s };
};
export const oblique = (depth = 0.38) => ({ ax: 1, bx: depth, ay: 0, by: depth });

export function createScene(scale = 10, proj = isometric()) {
  const items = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const project = (x, y, z) => {
    const sx = (x * proj.ax - y * proj.bx) * scale, sy = (x * proj.ay + y * proj.by) * scale - z * scale;
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    return [sx, sy];
  };
  const pts = (list) => list.map((p) => project(...p).map((v) => v.toFixed(1)).join(",")).join(" ");

  // colors: { top, right, front } or a single hex that gets shaded
  function box(x0, y0, z0, x1, y1, z1, colors, attrs = "") {
    const c = typeof colors === "string" ? shades(colors) : colors;
    // optional thin edge so neighbouring bars of the same colour stay distinct
    const edge = c.stroke ? ` stroke="${c.stroke}" stroke-width=".4" stroke-linejoin="round"` : "";
    items.push(`<g${attrs}${edge}>` +
      `<polygon points="${pts([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]])}" fill="${c.right}"/>` +
      `<polygon points="${pts([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]])}" fill="${c.front}"/>` +
      `<polygon points="${pts([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]])}" fill="${c.top}"/></g>`);
  }

  // flat quad on the ground or any plane, given four world points
  function quad(points, fill, attrs = "") {
    items.push(`<polygon points="${pts(points)}" fill="${fill}"${attrs}/>`);
  }

  // polyline through world points; returns the SVG path so it can be reused for motion
  function path(points, stroke, width, attrs = "") {
    const d = "M" + points.map((p) => project(...p).map((v) => v.toFixed(1)).join(" ")).join("L");
    items.push(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${attrs}/>`);
    return d;
  }

  function dot(point, r, fill, attrs = "") {
    const [x, y] = project(...point);
    items.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"${attrs}/>`);
  }

  const raw = (svg) => items.push(svg);
  const bounds = (pad = 0) => ({ x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad });

  return { box, quad, path, dot, raw, project, bounds, toString: () => items.join("\n") };
}

// Wraps a scene in a card that renders at 860px wide with the same 13px captions, 10px corners and
// 1px border as the health-check terminal, whatever the scene's own scale is.
export function card(scene, { bg, border, title, text }, titleHtml, captionHtml, css = "", label = "") {
  const W = 860;
  const raw = scene.bounds(0);
  const k = (raw.w * 1.04) / W; // viewBox units per rendered px
  const pad = 16 * k, head = 50 * k;
  const b = scene.bounds(pad);
  const vb = [b.x, b.y - head, b.w, b.h + head].map((v) => v.toFixed(1));
  const x = (b.x + 18 * k).toFixed(1);
  const H = Math.round((W * (b.h + head)) / b.w);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vb.join(" ")}" role="img" aria-label="${label}">
  <style>
    text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: ${(13 * k).toFixed(2)}px; }
    ${css}
  </style>
  <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" rx="${(10 * k).toFixed(2)}" fill="${bg}" stroke="${border}" stroke-width="${k.toFixed(2)}"/>
  <text x="${x}" y="${(b.y - head + 26 * k).toFixed(1)}" fill="${title}" font-weight="700">${titleHtml}</text>
  <text x="${x}" y="${(b.y - head + 44 * k).toFixed(1)}" fill="${text}">${captionHtml}</text>
  ${scene.toString()}
</svg>
`;
}

export function shades(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (k) => "#" + [16, 8, 0].map((s) => Math.min(255, Math.round(((n >> s) & 255) * k)).toString(16).padStart(2, "0")).join("");
  return { top: f(1.12), right: f(0.82), front: f(0.64) };
}
