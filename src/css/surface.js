import { ROLES } from '../generator/surface.js';

const pair = (light, dark) => light === dark ? light : `light-dark(${light}, ${dark})`;

// Geometry is shared by both modes; only the generated shadow ink/alpha changes.
function shadowPair(light, dark) {
  const inks = dark.match(/rgb\([^)]*\)/g) ?? [];
  let i = 0;
  return light.replace(/rgb\([^)]*\)/g, (ink) => pair(ink, inks[i++]));
}

export function surfaceCss(surfaces) {
  const blocks = [
    ':where(:root) {\n  --kn-mode: light;\n}',
    ':where([data-kn-mode="light"]) {\n  --kn-mode: light;\n  color-scheme: light;\n}',
    ':where([data-kn-mode="dark"]) {\n  --kn-mode: dark;\n  color-scheme: dark;\n}',
  ];
  for (const kind of Object.keys(surfaces)) {
    const { light, dark } = surfaces[kind];
    const selector = kind === 'page' ? ':root,\n[data-kn-surface="page"]' : `[data-kn-surface="${kind}"]`;
    const polarity = light.polarity === dark.polarity ? light.polarity : 'var(--kn-mode)';
    const lines = ROLES.map((role) => `  --kn-${role}: ${pair(light.roles[role], dark.roles[role])};`);
    lines.push(`  --kn-polarity: ${polarity};`, `  color-scheme: ${polarity};`);
    for (const name of Object.keys(light.shadow)) lines.push(`  --kn-shadow-${name}: ${shadowPair(light.shadow[name], dark.shadow[name])};`);
    lines.push(`  --kn-frame-color: ${pair(light['frame-color'], dark['frame-color'])};`, '  background: var(--kn-background);', '  color: var(--kn-text);');
    if (light.scrim) {
      const { color, opacity } = light.scrim;
      const scrim = `rgb(from ${color} r g b / ${opacity})`;
      lines.push(`  background-image: linear-gradient(${scrim}, ${scrim}), var(--kn-picture-image, none);`);
    }
    blocks.push(`${selector} {\n${lines.join('\n')}\n}`);
  }
  return blocks.join('\n\n');
}
