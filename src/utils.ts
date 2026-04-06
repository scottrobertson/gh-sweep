import type { Repo } from "./github.js";

export type Result =
  | "skipped"
  | "archived"
  | "deleted"
  | "unarchived"
  | "error";
export type Status = Result | "archiving..." | "deleting..." | "unarchiving...";
export type Filter =
  | "all"
  | "public"
  | "private"
  | "sources"
  | "forks"
  | "archived";

export const FILTERS: Filter[] = [
  "all",
  "public",
  "private",
  "sources",
  "forks",
  "archived",
];

export interface ColWidths {
  name: number;
  vis: number;
  stars: number;
  date: number;
  lang: number;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function applyFilter(repos: Repo[], filter: Filter): Repo[] {
  switch (filter) {
    case "all":
      return repos.filter((r) => !r.isArchived);
    case "public":
      return repos.filter((r) => !r.isArchived && r.visibility === "public");
    case "private":
      return repos.filter((r) => !r.isArchived && r.visibility === "private");
    case "sources":
      return repos.filter((r) => !r.isArchived && !r.isFork);
    case "forks":
      return repos.filter((r) => !r.isArchived && r.isFork);
    case "archived":
      return repos.filter((r) => r.isArchived);
  }
}

export interface Action {
  key: string;
  label: string;
}

export function getVisibleActions(
  status: Status | undefined,
  isArchivedRepo: boolean,
): Action[] {
  const pending = status?.endsWith("...");
  const deleted = status === "deleted";
  const errored = status === "error";
  const archived = isArchivedRepo || status === "archived";
  const untouched = !status || errored;

  return [
    { key: "v", label: "view", show: true },
    {
      key: "a",
      label: "archive",
      show: (untouched || status === "unarchived") && !archived,
    },
    { key: "u", label: "unarchive", show: archived && !pending && !deleted },
    { key: "d", label: "delete", show: !pending && !deleted },
    { key: "s", label: "skip", show: untouched },
    { key: "f", label: "filter", show: true },
    { key: "r", label: "reload", show: true },
    { key: "q", label: "quit", show: true },
  ]
    .filter((a) => a.show)
    .map(({ key, label }) => ({ key, label }));
}

export function findNextUnprocessed(
  from: number,
  statuses: Map<string, Status>,
  repoNames: string[],
): number {
  let idx = from + 1;
  while (idx < repoNames.length && statuses.has(repoNames[idx])) {
    idx++;
  }
  return Math.min(idx, repoNames.length - 1);
}

export function calcWidths(repos: Repo[]): ColWidths {
  if (repos.length === 0) {
    return { name: 0, vis: 0, stars: 0, date: 0, lang: 0 };
  }
  return {
    name: Math.max(...repos.map((r) => r.nameWithOwner.length)),
    vis: Math.max(...repos.map((r) => r.visibility.length)),
    stars: Math.max(...repos.map((r) => String(r.stars).length)),
    date: Math.max(...repos.map((r) => formatDate(r.updatedAt).length)),
    lang: Math.max(...repos.map((r) => (r.language ?? "").length)),
  };
}
