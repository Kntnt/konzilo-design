import { ROLES } from '../generator/surface.js';

// light-dark() answers to the element's own colour scheme, so it serves only a kind whose scheme follows the mode.
const pair = (light, dark) => light === dark ? light : `light-dark(${light}, ${dark})`;
// A kind that keeps one colour scheme in both modes reads the mode from two switches instead. The switch of the current
// mode is `initial`, which gives the fallback, and the other is empty, which gives nothing.
const switched = (light, dark) => light === dark ? light : `var(--kn-in-light, ${light}) var(--kn-in-dark, ${dark})`;
const switches = { light: '  --kn-in-light: initial;\n  --kn-in-dark: ;', dark: '  --kn-in-light: ;\n  --kn-in-dark: initial;' };

// Geometry is shared by both modes; only the generated shadow ink/alpha changes.
function shadowPair(light, dark, choose) {
  const inks = dark.match(/rgb\([^)]*\)/g) ?? [];
  let i = 0;
  return light.replace(/rgb\([^)]*\)/g, (ink) => choose(ink, inks[i++]));
}

export function surfaceCss(surfaces) {
  const blocks = [
    `:where(:root) {\n  --kn-mode: light;\n${switches.light}\n}`,
    `:where([data-kn-mode="light"]) {\n  --kn-mode: light;\n  color-scheme: light;\n${switches.light}\n}`,
    `:where([data-kn-mode="dark"]) {\n  --kn-mode: dark;\n  color-scheme: dark;\n${switches.dark}\n}`,
  ];
  for (const kind of Object.keys(surfaces)) {
    const { light, dark } = surfaces[kind];
    const selector = kind === 'page' ? ':root,\n[data-kn-surface="page"]' : `[data-kn-surface="${kind}"]`;
    const polarity = light.polarity === dark.polarity ? light.polarity : 'var(--kn-mode)';
    const choose = light.polarity === dark.polarity ? switched : pair;
    const lines = ROLES.map((role) => `  --kn-${role}: ${choose(light.roles[role], dark.roles[role])};`);
    lines.push(`  --kn-polarity: ${polarity};`, `  color-scheme: ${polarity};`);
    for (const name of Object.keys(light.shadow)) lines.push(`  --kn-shadow-${name}: ${shadowPair(light.shadow[name], dark.shadow[name], choose)};`);
    lines.push(`  --kn-frame-color: ${choose(light['frame-color'], dark['frame-color'])};`, '  background: var(--kn-background);', '  color: var(--kn-text);');
    if (light.scrim) {
      const { color, opacity } = light.scrim;
      const scrim = `rgb(from ${color} r g b / ${opacity})`;
      const length = 'var(--kn-scrim-fade-length)';
      const share = (value) => `rgb(0 0 0 / ${value})`;
      lines.push(
        `  background-image: linear-gradient(${scrim}, ${scrim}), var(--kn-picture-image, none);`,
        // For a component whose text stands on part of the picture: one layer in this colour, with these as its masks.
        // Masks add up to at most the whole layer, so however they overlap it never passes the tested strength. To have
        // the fade strongest at the top and clear downwards, the component turns it round with --kn-scrim-fade-direction.
        `  --kn-scrim: ${scrim};`,
        `  --kn-scrim-fade: linear-gradient(var(--kn-scrim-fade-direction, to bottom), ${share(0)} 0, ${share(0.16)} calc(${length} * 0.25), ${share(0.5)} calc(${length} * 0.5), ${share(0.84)} calc(${length} * 0.75), ${share(1)} ${length});`,
        `  --kn-scrim-header: linear-gradient(to bottom, ${share(1)} var(--kn-header-height), ${share(0)} calc(var(--kn-header-height) + 6rem));`,
      );
    }
    blocks.push(`${selector} {\n${lines.join('\n')}\n}`);
  }
  return blocks.join('\n\n');
}
