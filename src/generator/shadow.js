import { hexToRgb } from './color.js';

export const REFERENCE = Object.freeze({ strength: 50, hardness: 20, angle: 0, elevation: 50 });
export const LEVELS = Object.freeze(Object.fromEntries(Object.entries({
  header: [[1, 2, 0, 0.06], [4, 12, -2, 0.1]],
  'header-panel': [[1, 2, 0, 0.03], [4, 12, -2, 0.05]],
  panel: [[2, 6, 0, 0.025], [16, 40, -8, 0.09]],
  page: [[4, 10, 0, 0.03], [24, 48, -12, 0.11]],
  box: [[1, 2, 0, 0.018], [6, 16, -4, 0.048]],
  'box-lifted': [[2, 4, 0, 0.018], [12, 32, -8, 0.048]],
}).map(([name, parts]) => [name, Object.freeze(parts.map(Object.freeze))])));
const TARGET = { header: 'header', 'header-panel': 'header', panel: 'panel', page: 'page', box: 'box', 'box-lifted': 'box' };

export function shadow([near, far], { strength, hardness, angle, elevation }, color, boost = 1) {
  if (strength <= 0) return 'none';
  const ink = hexToRgb(color).map((v) => Math.round(v * 255)).join(' ');
  const k = elevation / REFERENCE.elevation;
  const soft = hardness < REFERENCE.hardness ? (REFERENCE.hardness - hardness) / REFERENCE.hardness : 0;
  const hard = hardness > REFERENCE.hardness ? (hardness - REFERENCE.hardness) / (100 - REFERENCE.hardness) : 0;
  const spreadOut = (1 + soft) * (1 - hard);
  const m = strength / REFERENCE.strength, rad = angle * Math.PI / 180;
  const len = (v) => {
    const r = hardness === 100 ? Math.round(v) : Math.round(v * 100) / 100;
    return r === 0 ? '0' : `${r}px`;
  };
  const parts = [];
  for (const [i, [y, blur, spread, a0]] of [near, far].entries()) {
    const d = y * k;
    let a = a0 * m * boost;
    if (i === 0) a *= 1 - hard;
    else a += (1 - a) * hard * hard;
    a = Math.min(1, a);
    if (a <= 0) continue;
    const s = spread * k * spreadOut;
    parts.push(`${len(-d * Math.sin(rad))} ${len(d * Math.cos(rad))} ${len(blur * k * spreadOut)}${len(s) === '0' ? '' : ' ' + len(s)} rgb(${ink} / ${Math.round(a * 1000) / 1000})`);
  }
  return parts.length ? parts.join(', ') : 'none';
}

export function resolveColor(choice, { text, colors }) {
  if (choice === 'default') return text;
  if (choice === 'black') return '#000000';
  if (choice.startsWith('#')) return choice;
  if (!colors[choice]) throw new TypeError(`Unavailable colour choice: ${choice}`);
  return colors[choice];
}

// Default ink on dark Surfaces is black at three times the opacity.
export function shadowsForSurface(settings, { polarity = 'light', text, colors = {} }) {
  const useDarkRule = settings.color === 'default' && polarity === 'dark';
  const color = useDarkRule ? '#000000' : resolveColor(settings.color, { text, colors });
  return Object.fromEntries(Object.entries(LEVELS).map(([name, level]) => [name,
    settings.targets[TARGET[name]] ? shadow(level, settings, color, useDarkRule ? 3 : 1) : 'none',
  ]));
}
