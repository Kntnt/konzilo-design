// Resolve logical column positions across rectangular spans within one row group.
// Header, body and footer are separate groups; spans never cross their boundaries.
export function tableRows(rows, columns) {
  const occupied = rows.map(() => Array(columns.length).fill(false));
  return rows.map((row, r) => {
    let column = 0;
    const cells = row.map((value) => {
      while (occupied[r][column]) column++;
      const cell = typeof value === 'string' ? { text: value } : value;
      const colspan = cell.colspan ?? 1, rowspan = cell.rowspan ?? 1;
      if (!Number.isInteger(colspan) || !Number.isInteger(rowspan) || colspan < 1 || rowspan < 1 || column + colspan > columns.length || r + rowspan > rows.length) throw new RangeError('Invalid table cell span');
      for (let y = r; y < r + rowspan; y++) for (let x = column; x < column + colspan; x++) {
        if (occupied[y][x]) throw new RangeError('Table cells overlap');
        occupied[y][x] = true;
      }
      const result = { ...cell, column, colspan, rowspan, align: columns[column].numeric ? 'end' : columns[column].align ?? 'start', numeric: !!columns[column].numeric };
      column += colspan;
      return result;
    });
    if (occupied[r].some((value) => !value)) throw new RangeError('Table row must fill its columns');
    return cells;
  });
}
