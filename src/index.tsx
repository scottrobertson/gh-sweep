import React, { useState, useEffect, useMemo } from "react";
import { render, Box, Text, useInput, useApp, useStdout, Static } from "ink";
import { execSync } from "child_process";
import {
  createOctokit,
  fetchRepos,
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

interface Action {
  key: string;
  label: string;
}

type Result = "skip" | "archive" | "delete";

const archivedMode = process.argv.includes("--archived");

const ACTIONS: Action[] = [
  { key: "v", label: "view" },
  ...(!archivedMode ? [{ key: "a", label: "archive" }] : []),
  { key: "d", label: "delete" },
  { key: "s", label: "skip" },
  { key: "q", label: "quit" },
];

interface ColumnWidths {
  name: number;
  date: number;
  vis: number;
  stars: number;
  counter: number;
}

function calcWidths(repos: Repo[]): ColumnWidths {
  return {
    name: Math.max(...repos.map((r) => r.nameWithOwner.length)),
    date: Math.max(...repos.map((r) => formatDate(r.updatedAt).length)),
    vis: Math.max(...repos.map((r) => r.visibility.length)),
    stars: Math.max(...repos.map((r) => String(r.stars).length)),
    counter: String(repos.length).length * 2 + 1,
  };
}

function RepoRow({
  repo,
  index,
  total,
  result,
  widths,
}: {
  repo: Repo;
  index: number;
  total: number;
  result?: Result;
  widths: ColumnWidths;
}) {
  const date = formatDate(repo.updatedAt);
  const vis = repo.visibility.toUpperCase();
  const stars = String(repo.stars);

  return (
    <Box>
      <Text bold>{repo.nameWithOwner.padEnd(widths.name)}</Text>
      <Text dimColor>
        {"  "}
        {`${index + 1}/${total}`.padStart(widths.counter)}
        {"  "}
        {date.padEnd(widths.date)}
        {"  "}
        {vis.padEnd(widths.vis)}
        {"  "}
        {"★" + stars.padStart(widths.stars)}
      </Text>
      {result && <Text color="yellow">{`  → ${result}`}</Text>}
    </Box>
  );
}

function ActionBar() {
  return (
    <Box>
      {ACTIONS.map((action, i) => (
        <Text key={action.key}>
          {i > 0 ? "  " : ""}
          <Text bold>({action.key})</Text>
          {action.label.slice(1)}
        </Text>
      ))}
    </Box>
  );
}

function StatusBar({ counts, done, busy }: { counts: Record<string, number>; done: boolean; busy: string | false }) {
  if (done) {
    const summary = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([label, c]) => `${label} ${c}`)
      .join(", ");
    return <Text>Done! {summary}.</Text>;
  }

  if (busy) {
    return <Text dimColor>{busy}</Text>;
  }

  return <ActionBar />;
}

function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const termHeight = stdout.rows ?? 24;
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<Map<number, Result>>(new Map());
  const [busy, setBusy] = useState<string | false>(false);
  const [octokit] = useState(() => createOctokit(getToken()));

  useEffect(() => {
    fetchRepos(octokit, archivedMode).then((r) => {
      setRepos(r);
      setLoading(false);
    });
  }, []);

  const widths = useMemo(() => (repos.length ? calcWidths(repos) : null), [repos]);

  const counts: Record<string, number> = { archived: 0, deleted: 0, skipped: 0 };
  for (const r of results.values()) {
    if (r === "archive") counts.archived++;
    if (r === "delete") counts.deleted++;
    if (r === "skip") counts.skipped++;
  }

  const done = !loading && current >= repos.length;

  useInput((input) => {
    if (loading || done || busy) return;

    const repo = repos[current];
    const [owner, name] = repo.nameWithOwner.split("/");
    const key = input.toLowerCase();

    if (key === "v") {
      openUrl(repo.url);
      return;
    }

    if (key === "s") {
      setResults(new Map(results.set(current, "skip")));
      setCurrent(current + 1);
      return;
    }

    if (key === "a" && !archivedMode) {
      setBusy("Archiving...");
      archiveRepo(octokit, owner, name).then(() => {
        setResults(new Map(results.set(current, "archive")));
        setCurrent(current + 1);
        setBusy(false);
      });
      return;
    }

    if (key === "d") {
      setBusy("Deleting...");
      deleteRepo(octokit, owner, name).then(() => {
        setResults(new Map(results.set(current, "delete")));
        setCurrent(current + 1);
        setBusy(false);
      });
      return;
    }

    if (key === "q") {
      exit();
    }
  });

  if (loading) {
    return (
      <Box height={termHeight} flexDirection="column">
        <Text>Fetching repos...</Text>
      </Box>
    );
  }

  const visibleRepos = repos.slice(0, done ? repos.length : current + 1);

  // Header (2 lines) + status bar (1 line) + padding (2 lines) = 5
  const contentHeight = termHeight - 5;

  // If we have more repos than fit, show the tail end
  const scrollStart = Math.max(0, visibleRepos.length - contentHeight);
  const visibleSlice = visibleRepos.slice(scrollStart);

  return (
    <Box height={termHeight} flexDirection="column">
      <Box flexDirection="column">
        <Text>
          {repos.length} {archivedMode ? "archived " : ""}repos to review
        </Text>
        <Text> </Text>
      </Box>

      <Box flexDirection="column" flexGrow={1}>
        {visibleSlice.map((repo, i) => (
          <RepoRow
            key={repo.nameWithOwner}
            repo={repo}
            index={scrollStart + i}
            total={repos.length}
            result={results.get(scrollStart + i)}
            widths={widths!}
          />
        ))}
      </Box>

      <Box flexDirection="column">
        <Text> </Text>
        <StatusBar counts={counts} done={done} busy={busy} />
      </Box>
    </Box>
  );
}

render(<App />);
