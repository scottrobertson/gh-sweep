import { Octokit } from "@octokit/rest";

export interface Repo {
  nameWithOwner: string;
  updatedAt: string;
  visibility: string;
  url: string;
  stars: number;
  description: string | null;
  language: string | null;
  isFork: boolean;
  isArchived: boolean;
}

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export async function fetchAllRepos(octokit: Octokit): Promise<Repo[]> {
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
    .map((r) => ({
      nameWithOwner: r.full_name,
      updatedAt: r.updated_at ?? "",
      visibility: r.visibility ?? (r.private ? "private" : "public"),
      url: r.html_url,
      stars: r.stargazers_count ?? 0,
      description: r.description ?? null,
      language: r.language ?? null,
      isFork: r.fork,
      isArchived: r.archived ?? false,
    }))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

export async function archiveRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  await octokit.rest.repos.update({ owner, repo, archived: true });
}

export async function unarchiveRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  await octokit.rest.repos.update({ owner, repo, archived: false });
}

export async function deleteRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  await octokit.rest.repos.delete({ owner, repo });
}
