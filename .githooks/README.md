# Git hooks

Shared git hooks for this repo. Enable once per clone:

```sh
git config core.hooksPath .githooks
```

On Windows, make sure Git Bash (bundled with Git for Windows) is available —
Git uses it to execute `sh` scripts regardless of OS.

## Hooks

- **pre-push**: runs `npm run lint` and `npm run typecheck`. Blocks the push
  on any error. Bypass once with `git push --no-verify` (avoid unless urgent).
