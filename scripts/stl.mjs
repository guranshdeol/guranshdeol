// Tiny ASCII STL writer shared by the 3D blocks in the README. Units are arbitrary; z is up.
export function createModel(name) {
  const facets = [];
  const n = (v) => +v.toFixed(2);
  const tri = (normal, a, b, c) => facets.push([normal, a, b, c]);

  // Axis-aligned box. Pass { bottom: false } to skip the face nobody sees.
  function box(x0, y0, z0, x1, y1, z1, { bottom = true } = {}) {
    const v = (x, y, z) => [x ? x1 : x0, y ? y1 : y0, z ? z1 : z0];
    const quad = (nrm, a, b, c, d) => { tri(nrm, a, b, c); tri(nrm, a, c, d); };
    if (bottom) quad([0, 0, -1], v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0));
    quad([0, 0, 1], v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1));
    quad([0, -1, 0], v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1));
    quad([0, 1, 0], v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0));
    quad([-1, 0, 0], v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0));
    quad([1, 0, 0], v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1));
  }

  function toString() {
    const body = facets
      .map(([nrm, a, b, c]) => `facet normal ${nrm.join(" ")}\nouter loop\nvertex ${a.map(n).join(" ")}\nvertex ${b.map(n).join(" ")}\nvertex ${c.map(n).join(" ")}\nendloop\nendfacet`)
      .join("\n");
    return `solid ${name}\n${body}\nendsolid ${name}`;
  }

  return { box, toString, get size() { return facets.length; } };
}

// Replaces the text between <!-- NAME:START --> and <!-- NAME:END --> in a README string.
// Pass { inline: true } to keep the content on the markers' line (used inside <pre>).
export function replaceSection(readme, name, content, { inline = false } = {}) {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(readme)) throw new Error(`Section ${name} not found in README`);
  const nl = inline ? "" : "\n";
  return readme.replace(re, (_, a, b) => `${a}${nl}${content}${nl}${b}`);
}
