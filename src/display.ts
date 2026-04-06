const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export interface Repo {
  nameWithOwner: string;
  updatedAt: string;
  visibility: string;
  url: string;
  stars: number;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export interface ColumnWidths {
  name: number;
  date: number;
  vis: number;
  stars: number;
}

export function calcWidths(repos: Repo[]): ColumnWidths {
  const dates = repos.map((r) => formatDate(r.updatedAt));
  return {
    name: Math.max(...repos.map((r) => r.nameWithOwner.length)),
    date: Math.max(...dates.map((d) => d.length)),
    vis: Math.max(...repos.map((r) => r.visibility.length)),
    stars: Math.max(...repos.map((r) => String(r.stars).length)),
  };
}

export function repoLine(repo: Repo, index: number, total: number, widths: ColumnWidths): string {
  const name = repo.nameWithOwner.padEnd(widths.name);
  const date = formatDate(repo.updatedAt).padEnd(widths.date);
  const vis = repo.visibility.toUpperCase().padEnd(widths.vis);
  const stars = String(repo.stars).padStart(widths.stars);
  const counter = `${index + 1}/${total}`;

  return `${bold(name)}  ${dim(`${counter}  ${date}  ${vis}  ★${stars}`)}`;
}

export function displaySummary(counts: Record<string, number>): void {
  const parts = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`);

  console.log();
  console.log(`Done! ${parts.join(", ")}.`);
}
