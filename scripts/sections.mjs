// Replaces the text between <!-- NAME:START --> and <!-- NAME:END --> in a README string.
// Pass { inline: true } to keep the content on the markers' line (used inside <pre>).
export function replaceSection(readme, name, content, { inline = false } = {}) {
  const re = new RegExp(`(<!-- ${name}:START -->)[\\s\\S]*?(<!-- ${name}:END -->)`);
  if (!re.test(readme)) throw new Error(`Section ${name} not found in README`);
  const nl = inline ? "" : "\n";
  return readme.replace(re, (_, a, b) => `${a}${nl}${content}${nl}${b}`);
}
