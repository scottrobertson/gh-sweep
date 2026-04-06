const { stdout } = process;

const rows = () => stdout.rows ?? 24;

let contentRow = 1;

export function initLayout(): void {
  stdout.write(`\x1b[2J`); // clear screen
  stdout.write(`\x1b[1;${rows() - 2}r`); // scroll region: everything except bottom 2 rows
  contentRow = 1;
  moveTo(contentRow);
}

export function resetLayout(): void {
  stdout.write(`\x1b[r`); // reset scroll region
  moveTo(rows());
  stdout.write(`\x1b[K`);
}

export function printLine(text: string): void {
  moveTo(contentRow);
  stdout.write(text + "\n");
  contentRow = Math.min(contentRow + 1, rows() - 2);
}

export function updateLastLine(text: string): void {
  const targetRow = Math.max(contentRow - 1, 1);
  moveTo(targetRow);
  stdout.write(`\x1b[K${text}`);
  moveTo(contentRow);
}

export function setBar(text: string): void {
  moveTo(rows());
  stdout.write(`\x1b[K${text}`);
}

export function clearBar(): void {
  moveTo(rows());
  stdout.write(`\x1b[K`);
}

function moveTo(row: number, col = 1): void {
  stdout.write(`\x1b[${row};${col}H`);
}
