import { execSync } from "child_process";
import { createOctokit, fetchRepos, archiveRepo, deleteRepo } from "./github.js";
import { repoLine, displaySummary, calcWidths } from "./display.js";
import { promptAction, type Action } from "./prompt.js";
import { initLayout, resetLayout, printLine, updateLastLine } from "./tui.js";

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
      process.platform === "darwin" ? "open" :
      process.platform === "win32" ? "start" :
      "xdg-open";
    execSync(`${cmd} "${url}"`);
  } catch {
    printLine(`  Open: ${url}`);
  }
}

function cleanup(): void {
  resetLayout();
}

async function main(): Promise<void> {
  const archivedMode = process.argv.includes("--archived");

  console.log("Fetching repos...");

  const token = getToken();
  const octokit = createOctokit(token);
  const repos = await fetchRepos(octokit, archivedMode);

  initLayout();
  process.on("exit", cleanup);
  process.on("SIGINT", () => { cleanup(); process.exit(0); });

  const widths = calcWidths(repos);
  const counts: Record<string, number> = { archived: 0, deleted: 0, skipped: 0 };

  printLine(`${repos.length} ${archivedMode ? "archived " : ""}repos to review`);
  printLine("");

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];
    const [owner, name] = repo.nameWithOwner.split("/");
    const line = repoLine(repo, i, repos.length, widths);

    printLine(line);

    const actions: Action[] = [
      {
        key: "v", label: "iew", advances: false,
        run: async () => { openUrl(repo.url); },
      },
      ...(!archivedMode ? [{
        key: "a", label: "rchive", advances: true,
        run: async () => {
          await archiveRepo(octokit, owner, name);
          counts.archived++;
        },
      }] : []),
      {
        key: "d", label: "elete", advances: true,
        run: async () => {
          await deleteRepo(octokit, owner, name);
          counts.deleted++;
        },
      },
      {
        key: "s", label: "kip", advances: true,
        run: async () => { counts.skipped++; },
      },
      {
        key: "q", label: "uit", advances: true,
        run: async () => {
          resetLayout();
          displaySummary(counts);
          process.exit(0);
        },
      },
    ];

    const result = await promptAction(actions);
    updateLastLine(`${line}  → ${result}`);
  }

  resetLayout();
  displaySummary(counts);
}

main();
