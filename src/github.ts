import { Octokit } from "@octokit/rest";
import type { Repo } from "./display.js";

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function fetchRepos(
  octokit: Octokit,
  archived: boolean,
): Promise<Repo[]> {
  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    {
      per_page: 100,
      affiliation: "owner",
      sort: "updated",
      direction: "asc",
    },
  );

  return repos
    .filter((r) => r.archived === archived)
    .map((r) => ({
      nameWithOwner: r.full_name,
      updatedAt: r.updated_at ?? "",
      visibility: r.visibility ?? (r.private ? "private" : "public"),
      url: r.html_url,
      stars: r.stargazers_count ?? 0,
    }))
    .sort((a, b) => {
      // Sort by visibility then by updated date
      if (a.visibility !== b.visibility) {
        return a.visibility.localeCompare(b.visibility);
      }
      return a.updatedAt.localeCompare(b.updatedAt);
    });
}

export async function archiveRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  await octokit.rest.repos.update({ owner, repo, archived: true });
}

export async function deleteRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  await octokit.rest.repos.delete({ owner, repo });
}
