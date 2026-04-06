# Sweep

Quickly review and clean up your GitHub repos from the terminal. Flip through your repos one by one, archiving or deleting as you go.

<img width="2098" height="1558" alt="2026-04-06 at 16 16 16@2x" src="https://github.com/user-attachments/assets/10301721-cc70-45ca-a8cb-0a9a4aaaf997" />

## Install

```
npx gh-sweep
```

Or install globally:

```
npm install -g gh-sweep
```

## Authentication

gh-sweep tries to get a token from the GitHub CLI first (`gh auth token`), then falls back to the `GITHUB_TOKEN` environment variable.

## Usage

Run `gh-sweep` and use the keyboard to navigate:

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate the repo list |
| `v` | Open repo in browser |
| `a` | Archive repo |
| `u` | Unarchive repo |
| `d` | Delete repo |
| `s` | Skip repo |
| `f` | Filter repos (all, public, private, sources, forks, archived) |
| `r` | Reload repo list |
| `q` | Quit |

## Releasing

```
npm version patch # or minor, major
git push --follow-tags
```

Then create a GitHub release from the tag to trigger the npm publish.

## License

MIT

---

Built with [Claude Code](https://claude.ai/code)
