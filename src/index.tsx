import React, { useState, useEffect, useMemo, useCallback } from "react";
import { render, Box, Text, useInput, useApp, useStdout } from "ink";
import { execSync } from "child_process";
import {
  createOctokit,
  fetchAllRepos,
  archiveRepo,
  deleteRepo,
  type Repo,
} from "./github.js";

function getToken(): string {
  try {
    return execSync("gh auth token", { stdio: ["pipe", "pipe", "pipe"] })
      .toString()
      .trim();
  } catch {
    // gh CLI not available or not authenticated
  }

  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }

  console.error(
    "No GitHub token found. Install the gh CLI and run `gh auth login`, or set GITHUB_TOKEN.",
  );
  process.exit(1);
}

function openUrl(url: string): void {
  try {
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    execSync(`${cmd} "${url}"`);
  } catch {}
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

type Result = "skipped" | "archived" | "deleted";
type Status = Result | "archiving..." | "deleting...";
type Filter = "all" | "public" | "private" | "sources" | "forks" | "archived";

const FILTERS: Filter[] = ["all", "public", "private", "sources", "forks", "archived"];

function applyFilter(repos: Repo[], filter: Filter): Repo[] {
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

function Header({
  current,
  total,
  filter,
}: {
  current: number;
  total: number;
  filter: Filter;
}) {
  return (
    <Box justifyContent="space-between">
      <Box gap={1}>
        <Text bold>gh-cleanup</Text>
        <Text dimColor>[{filter}]</Text>
      </Box>
      <Text dimColor>
        {current}/{total}
      </Text>
    </Box>
  );
}

interface ColWidths {
  name: number;
  vis: number;
  stars: number;
  date: number;
  lang: number;
}

function calcWidths(repos: Repo[]): ColWidths {
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

function RepoListItem({
  repo,
  status,
  isCurrent,
  widths,
}: {
  repo: Repo;
  status?: Status;
  isCurrent: boolean;
  widths: ColWidths;
}) {
  const cols = [
    repo.nameWithOwner.padEnd(widths.name),
    repo.visibility.toUpperCase().padEnd(widths.vis),
    (repo.isFork ? "FORK" : "").padEnd(4),
    ("★" + String(repo.stars)).padStart(widths.stars + 1),
    formatDate(repo.updatedAt).padEnd(widths.date),
    (repo.language ?? "").padEnd(widths.lang),
  ].join("  ");

  const isPending = status === "archiving..." || status === "deleting...";

  return (
    <Box>
      <Text color={isCurrent ? "cyan" : undefined} bold={isCurrent}>
        {isCurrent ? "❯ " : "  "}
      </Text>
      <Text bold={isCurrent} dimColor={!isCurrent}>
        {cols}
      </Text>
      {status && (
        <Text color={isPending ? "gray" : "yellow"}>
          {"  "}
          {isPending ? status : `→ ${status}`}
        </Text>
      )}
    </Box>
  );
}

function RepoDetail({ repo }: { repo: Repo }) {
  return (
    <Box
      borderStyle="round"
      paddingX={2}
      paddingY={1}
      flexDirection="column"
      gap={1}
    >
      <Text bold>{repo.nameWithOwner}</Text>
      <Text wrap="truncate">{repo.description ?? " "}</Text>
      <Box gap={2}>
        <Text dimColor>{repo.visibility.toUpperCase()}</Text>
        {repo.isFork && <Text color="yellow">FORK</Text>}
        {repo.isArchived && <Text color="gray">ARCHIVED</Text>}
        <Text dimColor>★{repo.stars}</Text>
        <Text dimColor>{formatDate(repo.updatedAt)}</Text>
        {repo.language && <Text dimColor>{repo.language}</Text>}
      </Box>
    </Box>
  );
}

function FilterPicker({
  current,
  selected,
}: {
  current: Filter;
  selected: number;
}) {
  return (
    <Box
      borderStyle="round"
      flexDirection="column"
      paddingX={2}
      paddingY={1}
    >
      <Text bold>Select type</Text>
      <Text> </Text>
      {FILTERS.map((f, i) => (
        <Text key={f} color={i === selected ? "cyan" : undefined} bold={i === selected}>
          {i === selected ? "❯ " + f : "  " + f}
        </Text>
      ))}
    </Box>
  );
}

function ActionBar({
  processed,
  filter,
}: {
  processed: boolean;
  filter: Filter;
}) {
  const isArchived = filter === "archived";

  const actions = [
    { key: "v", label: "view" },
    ...(!processed && !isArchived ? [{ key: "a", label: "archive" }] : []),
    ...(!processed ? [{ key: "d", label: "delete" }] : []),
    ...(!processed ? [{ key: "s", label: "skip" }] : []),
    { key: "f", label: "filter" },
    { key: "r", label: "reload" },
    { key: "q", label: "quit" },
  ];

  return (
    <Box gap={2}>
      {actions.map((action) => (
        <Text key={action.key}>
          <Text bold>({action.key})</Text>
          {action.label.slice(1)}
        </Text>
      ))}
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termHeight = stdout.rows ?? 24;
  const [allRepos, setAllRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [statuses, setStatuses] = useState<Map<string, Status>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSelected, setFilterSelected] = useState(0);
  const [octokit] = useState(() => createOctokit(getToken()));

  const loadRepos = useCallback(() => {
    setLoading(true);
    fetchAllRepos(octokit).then((r) => {
      setAllRepos(r);
      setLoading(false);
    });
  }, [octokit]);

  useEffect(() => {
    loadRepos();
  }, []);

  const repos = useMemo(() => applyFilter(allRepos, filter), [allRepos, filter]);

  const widths = useMemo(() => calcWidths(repos), [repos]);

  const repo = repos[current] ?? null;

  const setStatus = useCallback((repoName: string, status: Status) => {
    setStatuses((prev) => new Map(prev).set(repoName, status));
  }, []);

  const findNextUnprocessed = useCallback(
    (from: number, currentStatuses: Map<string, Status>, repoList: Repo[]) => {
      let idx = from + 1;
      while (
        idx < repoList.length &&
        currentStatuses.has(repoList[idx].nameWithOwner)
      ) {
        idx++;
      }
      return Math.min(idx, repoList.length - 1);
    },
    [],
  );

  useInput((input, key) => {
    if (loading) return;

    // Filter picker mode
    if (filterOpen) {
      if (key.upArrow) {
        setFilterSelected((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow) {
        setFilterSelected((c) => Math.min(FILTERS.length - 1, c + 1));
        return;
      }
      if (key.return) {
        setFilter(FILTERS[filterSelected]);
        setCurrent(0);
        setFilterOpen(false);
        return;
      }
      if (key.escape || input.toLowerCase() === "f") {
        setFilterOpen(false);
        return;
      }
      return;
    }

    // Normal mode
    if (key.upArrow) {
      setCurrent((c) => Math.max(0, c - 1));
      return;
    }

    if (key.downArrow) {
      setCurrent((c) => Math.min(repos.length - 1, c + 1));
      return;
    }

    const k = input.toLowerCase();
    const r = repos[current];
    if (!r) return;

    if (k === "v") {
      openUrl(r.url);
      return;
    }

    if (k === "f") {
      setFilterSelected(FILTERS.indexOf(filter));
      setFilterOpen(true);
      return;
    }

    if (k === "r") {
      setLoading(true);
      setAllRepos([]);
      setStatuses(new Map());
      setCurrent(0);
      loadRepos();
      return;
    }

    if (k === "q") {
      exit();
      return;
    }

    // Don't allow actions on already-processed or in-progress repos
    if (statuses.has(r.nameWithOwner)) return;

    const [owner, name] = r.nameWithOwner.split("/");
    const repoName = r.nameWithOwner;

    if (k === "s") {
      setStatus(repoName, "skipped");
      const next = new Map(statuses).set(repoName, "skipped");
      setCurrent(findNextUnprocessed(current, next, repos));
      return;
    }

    if (k === "a" && filter !== "archived") {
      setStatus(repoName, "archiving...");
      const next = new Map(statuses).set(repoName, "archiving...");
      setCurrent(findNextUnprocessed(current, next, repos));
      archiveRepo(octokit, owner, name).then(() => {
        setStatus(repoName, "archived");
      });
      return;
    }

    if (k === "d") {
      setStatus(repoName, "deleting...");
      const next = new Map(statuses).set(repoName, "deleting...");
      setCurrent(findNextUnprocessed(current, next, repos));
      deleteRepo(octokit, owner, name).then(() => {
        setStatus(repoName, "deleted");
      });
    }
  });

  // Single consistent layout for all states
  const listHeight = Math.max(1, termHeight - 12);
  const scrollStart = Math.max(0, current - listHeight + 1);
  const visibleRepos = repos.slice(scrollStart, scrollStart + listHeight);

  return (
    <Box height={termHeight} flexDirection="column">
      <Header current={current + 1} total={repos.length} filter={filter} />

      <Box flexDirection="column" marginTop={1} height={listHeight}>
        {loading ? (
          <Text>Fetching repos...</Text>
        ) : repos.length === 0 ? (
          <Text dimColor>No repos found</Text>
        ) : (
          visibleRepos.map((r, i) => {
            const idx = scrollStart + i;
            return (
              <RepoListItem
                key={r.nameWithOwner}
                repo={r}
                status={statuses.get(r.nameWithOwner)}
                isCurrent={idx === current}
                widths={widths}
              />
            );
          })
        )}
      </Box>

      <Box flexGrow={1} flexDirection="column" justifyContent="center">
        {filterOpen ? (
          <FilterPicker current={filter} selected={filterSelected} />
        ) : (
          repo && <RepoDetail repo={repo} />
        )}
      </Box>

      <Box flexDirection="column" gap={1}>
        {filterOpen ? (
          <Text dimColor>↑↓ select  enter confirm  esc cancel</Text>
        ) : (
          <ActionBar
            processed={repo ? statuses.has(repo.nameWithOwner) : false}
            filter={filter}
          />
        )}
      </Box>
    </Box>
  );
}

render(<App />);
