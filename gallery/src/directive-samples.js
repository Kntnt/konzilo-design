// Invented pictures for the directive chapters: logos, badges and symbols of made-up names, self-contained as data URIs.
const image = (markup) => `data:image/svg+xml,${encodeURIComponent(markup)}`;
const svg = (width, height, body, sized = false) => image(`<svg xmlns="http://www.w3.org/2000/svg"${sized ? ` width="${width}" height="${height}"` : ''} viewBox="0 0 ${width} ${height}">${body}</svg>`);
const word = (x, y, size, text, fill = '#4d5b56') => `<text x="${x}" y="${y}" font-family="system-ui, sans-serif" font-size="${size}" font-weight="700" fill="${fill}">${text}</text>`;

// The invented studio's own mark in its light version, for the hero on a dark plate.
export const studioLogo = svg(320, 64, `<rect x="4" y="8" width="48" height="48" rx="10" fill="#f3efe4"/><path d="M16 44 28 18l12 26Z" fill="#2f6f66"/>${word(64, 44, 30, 'Juniper Atlas', '#f3efe4')}`);

// Logos of one band: wide, square and tall files, which the band shows at one height.
export const logos = {
  wide: svg(300, 80, `<circle cx="40" cy="40" r="26" fill="#7d8f88"/>${word(80, 52, 32, 'Orchard Hall')}`),
  square: svg(120, 120, `<rect x="10" y="10" width="100" height="100" rx="18" fill="#5f7a72"/>${word(26, 76, 40, 'NB', '#ffffff')}`),
  tall: svg(90, 140, `<path d="M45 10 80 70H10Z" fill="#6f8580"/>${word(8, 118, 22, 'Ridge')}`),
  press: svg(280, 70, `<rect x="8" y="14" width="42" height="42" rx="4" fill="none" stroke="#5f7a72" stroke-width="6"/>${word(64, 48, 30, 'River Press')}`),
};

// A badge beside a section's picture. Its file states its size: Firefox draws a badge without one at no size at all.
export const badge = svg(120, 120, '<circle cx="60" cy="60" r="54" fill="#f3d28d"/><circle cx="60" cy="60" r="40" fill="none" stroke="#8a6a21" stroke-width="5"/><path d="m60 34 7 16 17 2-13 11 4 17-15-9-15 9 4-17-13-11 17-2Z" fill="#8a6a21"/>', true);

// Symbols: a square, a wide and a very large file, which a card shows whole in a box the same on every card.
export const symbols = {
  square: svg(48, 48, '<rect x="4" y="4" width="40" height="40" rx="10" fill="#2f6f66"/><circle cx="24" cy="24" r="9" fill="#f3d28d"/>'),
  wide: svg(96, 40, '<rect x="2" y="6" width="92" height="28" rx="14" fill="#2f6f66"/><circle cx="24" cy="20" r="8" fill="#f3d28d"/><circle cx="48" cy="20" r="8" fill="#f3d28d"/><circle cx="72" cy="20" r="8" fill="#f3d28d"/>'),
  huge: svg(2400, 2400, '<circle cx="1200" cy="1200" r="1100" fill="#35645c"/><path d="M700 1500 1200 600l500 900Z" fill="#f3d28d"/>'),
};
