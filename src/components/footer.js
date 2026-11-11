// What the footer decides at build time: its cells, their spans and hairlines. Its attachment is CSS (footer.css),
// and how it meets the page is the Page's CSS (page.css), so no script runs for it.

// A band's four cells, column by column.
export const FOOTER_CELLS = ['a1', 'a2', 'b1', 'b2'];
// The order each band's cells are written in, which is the order they stack in on a narrow screen: the upper band
// column by column, A before B, and the lower band row by row (the owner, 2026-11-11). The wide grid places every cell
// by its own column and row, so the order changes nothing there.
export const FOOTER_STACKING = { upper: ['a1', 'a2', 'b1', 'b2'], lower: ['a1', 'b1', 'a2', 'b2'] };

// What the filled cells of one band cover. An empty column or row always gives way to the other, and where
// a cell could fill either way, `fill` says which. Whatever a cell covers, its content box stays where it was.
export function footerSpans(cells, fill = 'column') {
  const on = (cell) => !!cells[cell];
  return FOOTER_CELLS.filter(on).map((cell) => {
    const [column, row] = cell;
    const across = column === 'a' ? 'b' : 'a';
    const over = row === '1' ? '2' : '1';
    return {
      cell,
      wide: (!on(`${across}1`) && !on(`${across}2`)) || (fill === 'row' && !on(`${across}${row}`)),
      tall: (!on(`a${over}`) && !on(`b${over}`)) || (fill === 'column' && !on(`${column}${over}`)),
    };
  });
}

function layoutBand(name, band, { fill, horizontalRules, verticalRule }) {
  const order = FOOTER_STACKING[name];
  const spans = footerSpans(band?.cells ?? {}, fill).sort((one, other) => order.indexOf(one.cell) - order.indexOf(other.cell));
  // A row with nothing of its own has no height, so where every cell is tall the band has one row.
  const rows = spans.every(({ tall }) => tall) ? 1 : 2;
  const cells = spans.map(({ cell, wide, tall }) => ({
    ...(typeof band.cells[cell] === 'object' ? band.cells[cell] : {}),
    name: cell,
    column: cell[0].toUpperCase(),
    columns: wide ? 2 : 1,
    row: tall ? 'all' : cell[1],
  }));
  const tallIn = (column) => cells.some((cell) => cell.column === column && cell.row === 'all');
  const wideIn = (row) => cells.some((cell) => cell.columns === 2 && (cell.row === row || cell.row === 'all'));
  return {
    name,
    surface: band?.surface ?? { upper: 'brand', lower: 'inverse' }[name],
    rows,
    cells,
    // Hairlines stop at a merged cell, and never cross one.
    horizontal: horizontalRules && rows === 2 ? (tallIn('A') ? 'b' : tallIn('B') ? 'a' : 'both') : null,
    vertical: !verticalRule || (wideIn('1') && wideIn('2')) ? null : wideIn('1') ? '2' : wideIn('2') ? '1' : 'all',
  };
}

export function layoutFooter({ upper, lower, fill = 'column', horizontalRules = false, verticalRule = false } = {}) {
  const options = { fill, horizontalRules, verticalRule };
  const bands = [layoutBand('upper', upper, options), layoutBand('lower', lower, options)].filter((band) => band.cells.length);
  // Two bands on one colour close up, as any two Bands do, and only there can a line part them.
  if (bands.length === 2 && bands[0].surface === bands[1].surface) {
    bands.forEach((band) => { band.joined = true; });
    bands[1].join = horizontalRules;
  }
  return { bands };
}

// What a design's settings and a site's content give a Footer. A cell that is off stays empty, whatever the
// site has for it, and a cell that is on without content here is filled by a slot of the same name.
export function footerFromDesign(settings, content = {}) {
  const band = (name) => ({
    surface: settings[name].surface,
    cells: Object.fromEntries(FOOTER_CELLS.map((cell) => [cell, settings[name].cells[cell] ? content[name]?.[cell] ?? true : false])),
  });
  return {
    upper: band('upper'),
    lower: band('lower'),
    fill: settings.fill,
    attachment: settings.attachment,
    rules: settings['rule-extent'],
    horizontalRules: settings['horizontal-rules'],
    verticalRule: settings['vertical-rule'],
  };
}
