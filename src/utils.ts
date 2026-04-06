import type { Repo } from "./github.js";

export type Result = "skipped" | "archived" | "deleted" | "unarchived" | "error";
export type Status = Result | "archiving..." | "deleting..." | "unarchiving...";
export type Filter = "all" | "public" | "private" | "sources" | "forks" | "archived";

export const FILTERS: Filter[] = ["all", "public", "private", "sources", "forks", "archived"];

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
