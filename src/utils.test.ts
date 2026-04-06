import { describe, expect, it } from "vitest";
import type { Repo } from "./github.js";
import {
  applyFilter,
  calcWidths,
  findNextUnprocessed,
  formatDate,
  getVisibleActions,
  type Status,
} from "./utils.js";

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    nameWithOwner: "user/repo",
    updatedAt: "2024-06-15T00:00:00Z",
    visibility: "public",
    url: "https://github.com/user/repo",
    stars: 0,
    description: null,
    language: null,
    isFork: false,
    isArchived: false,
    ...overrides,
  };
}

describe("formatDate", () => {
  it("formats an ISO date to month and year", () => {
    expect(formatDate("2024-06-15T00:00:00Z")).toBe("Jun 2024");
  });

  it("handles January", () => {
    expect(formatDate("2023-01-01T00:00:00Z")).toBe("Jan 2023");
  });

  it("handles December", () => {
    expect(formatDate("2025-12-31T00:00:00Z")).toBe("Dec 2025");
  });
});

describe("applyFilter", () => {
  const repos = [
    makeRepo({ nameWithOwner: "u/public-src", visibility: "public" }),
    makeRepo({ nameWithOwner: "u/private", visibility: "private" }),
    makeRepo({ nameWithOwner: "u/fork", isFork: true }),
    makeRepo({ nameWithOwner: "u/archived", isArchived: true }),
    makeRepo({
      nameWithOwner: "u/archived-fork",
      isArchived: true,
      isFork: true,
    }),
  ];

  it("all excludes archived", () => {
    const result = applyFilter(repos, "all");
    expect(result.map((r) => r.nameWithOwner)).toEqual([
      "u/public-src",
      "u/private",
      "u/fork",
    ]);
  });

  it("public shows only public non-archived", () => {
    const result = applyFilter(repos, "public");
    expect(result.map((r) => r.nameWithOwner)).toEqual([
      "u/public-src",
      "u/fork",
    ]);
  });

  it("private shows only private non-archived", () => {
    const result = applyFilter(repos, "private");
    expect(result.map((r) => r.nameWithOwner)).toEqual(["u/private"]);
  });

  it("sources excludes forks and archived", () => {
    const result = applyFilter(repos, "sources");
    expect(result.map((r) => r.nameWithOwner)).toEqual([
      "u/public-src",
      "u/private",
    ]);
  });

  it("forks shows only forks, excludes archived", () => {
    const result = applyFilter(repos, "forks");
    expect(result.map((r) => r.nameWithOwner)).toEqual(["u/fork"]);
  });

  it("archived shows only archived", () => {
    const result = applyFilter(repos, "archived");
    expect(result.map((r) => r.nameWithOwner)).toEqual([
      "u/archived",
      "u/archived-fork",
    ]);
  });
});

describe("calcWidths", () => {
  it("returns zeros for empty array", () => {
    expect(calcWidths([])).toEqual({
      name: 0,
      vis: 0,
      stars: 0,
      date: 0,
      lang: 0,
    });
  });

  it("calculates max widths across repos", () => {
    const repos = [
      makeRepo({
        nameWithOwner: "u/short",
        visibility: "public",
        stars: 5,
        language: "Go",
      }),
      makeRepo({
        nameWithOwner: "u/much-longer-name",
        visibility: "private",
        stars: 1234,
        language: "TypeScript",
      }),
    ];
    const widths = calcWidths(repos);
    expect(widths.name).toBe("u/much-longer-name".length);
    expect(widths.vis).toBe("private".length);
    expect(widths.stars).toBe("1234".length);
    expect(widths.lang).toBe("TypeScript".length);
  });

  it("handles null language", () => {
    const repos = [makeRepo({ language: null })];
    const widths = calcWidths(repos);
    expect(widths.lang).toBe(0);
  });
});

function keys(status: Status | undefined, isArchived: boolean): string[] {
  return getVisibleActions(status, isArchived).map((a) => a.key);
}

describe("getVisibleActions", () => {
  it("untouched non-archived repo", () => {
    expect(keys(undefined, false)).toEqual(["v", "a", "d", "s", "f", "r", "q"]);
  });

  it("untouched archived repo", () => {
    expect(keys(undefined, true)).toEqual(["v", "u", "d", "s", "f", "r", "q"]);
  });

  it("after archiving", () => {
    expect(keys("archived", false)).toEqual(["v", "u", "d", "f", "r", "q"]);
  });

  it("after deleting", () => {
    expect(keys("deleted", false)).toEqual(["v", "f", "r", "q"]);
  });

  it("while archiving", () => {
    expect(keys("archiving...", false)).toEqual(["v", "f", "r", "q"]);
  });

  it("while deleting", () => {
    expect(keys("deleting...", false)).toEqual(["v", "f", "r", "q"]);
  });

  it("while unarchiving", () => {
    expect(keys("unarchiving...", true)).toEqual(["v", "f", "r", "q"]);
  });

  it("after error shows retryable actions", () => {
    expect(keys("error", false)).toEqual(["v", "a", "d", "s", "f", "r", "q"]);
  });

  it("after unarchiving allows re-archive", () => {
    expect(keys("unarchived", false)).toEqual(["v", "a", "d", "f", "r", "q"]);
  });

  it("skipped repo", () => {
    expect(keys("skipped", false)).toEqual(["v", "d", "f", "r", "q"]);
  });
});

describe("findNextUnprocessed", () => {
  const names = ["a", "b", "c", "d", "e"];

  it("returns next index when unprocessed", () => {
    expect(findNextUnprocessed(0, new Map(), names)).toBe(1);
  });

  it("skips over processed repos", () => {
    const statuses = new Map<string, Status>([
      ["b", "skipped"],
      ["c", "archived"],
    ]);
    expect(findNextUnprocessed(0, statuses, names)).toBe(3);
  });

  it("returns last index when all remaining are processed", () => {
    const statuses = new Map<string, Status>([
      ["b", "skipped"],
      ["c", "skipped"],
      ["d", "skipped"],
      ["e", "skipped"],
    ]);
    expect(findNextUnprocessed(0, statuses, names)).toBe(4);
  });

  it("stays at last index when already there", () => {
    expect(findNextUnprocessed(4, new Map(), names)).toBe(4);
  });
});
