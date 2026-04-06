# Sweep

Quickly review and clean up your GitHub repos from the terminal. Flip through your repos one by one, archiving or deleting as you go.

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

## License

MIT

---

Built with [Claude Code](https://claude.ai/code)
