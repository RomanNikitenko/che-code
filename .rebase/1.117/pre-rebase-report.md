# Pre-Rebase Report

> Previous: release/1.116 -> Target: release/1.117
> git subtree pull failed (exit 128) but no file-level conflicts detected.
> This may indicate a subtree merge strategy issue. Try running rebase.sh directly.

## Merge output

```
From https://github.com/microsoft/vscode
 * branch                    356d9f0a1f27b7ee5c2e9e47b23d1f92b6cbeb49 -> FETCH_HEAD
Downloading code/extensions/copilot/test/simulation/cache/base.sqlite (21 MB)
Error downloading object: code/extensions/copilot/test/simulation/cache/base.sqlite (d326ad1): Smudge error: Error downloading code/extensions/copilot/test/simulation/cache/base.sqlite (d326ad15c05af772811eb87a55e2a64ef9d23dcd5491efd7e494375e8f111b96): [d326ad15c05af772811eb87a55e2a64ef9d23dcd5491efd7e494375e8f111b96] Object does not exist on the server: [404] Object does not exist on the server

Errors logged to '/projects/che-code/.git/lfs/logs/20260428T111019.336219353.log'.
Use `git lfs logs last` to view the log.
error: external filter 'git-lfs filter-process' failed
fatal: code/extensions/copilot/test/simulation/cache/base.sqlite: smudge filter lfs failed
```
