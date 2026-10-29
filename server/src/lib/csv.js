// Formula prefixes are neutralised so a CSV opened in a spreadsheet cannot run a formula.
const FORMULA = /^[=+\-@\t\r]/

const cell = (value) => {
  if (value === null || value === undefined) return ''
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (FORMULA.test(text) && !/^[+-]?\d/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** CSV text (RFC 4180, CRLF) for `rows` with `columns` as the header, in that order. */
export function toCsv(rows, columns) {
  const lines = [columns.map(cell).join(',')]
  for (const row of rows) lines.push(columns.map((c) => cell(row[c])).join(','))
  return `${lines.join('\r\n')}\r\n`
}
