// Small isometric SVG renderer for the coloured, animated scenes in the README (topology and data centre).
// World axes: x to the right-front, y to the left-front, z up. Faces drawn: top, right (x1) and front (y1).

export function createScene(scale = 10) {
  const items = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  const project = (x, y, z) => {
    const sx = (x - y) * 0.866 * scale, sy = (x + y) * 0.5 * scale - z * scale;
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    return [sx, sy];
  };
  const pts = (list) => list.map((p) => project(...p).map((v) => v.toFixed(1)).join(",")).join(" ");

  // colors: { top, right, front } or a single hex that gets shaded
  function box(x0, y0, z0, x1, y1, z1, colors, attrs = "") {
    const c = typeof colors === "string" ? shades(colors) : colors;
    items.push(`<g${attrs}>` +
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

export function shades(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (k) => "#" + [16, 8, 0].map((s) => Math.min(255, Math.round(((n >> s) & 255) * k)).toString(16).padStart(2, "0")).join("");
  return { top: f(1.12), right: f(0.82), front: f(0.64) };
}
