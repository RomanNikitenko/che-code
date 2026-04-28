# Dependency Pin Audit

> Target: upstream-code/release/1.117
> Date: 2026-04-28

## Actions Required

### REMOVE (5 items)

| # | File | Section | Dependency | Che Pin | Upstream 1.117 | Reason |
|---|------|---------|-----------|---------|---------------|--------|
| 1 | .rebase/add/code/package.json | dependencies | ws | 8.2.3 | ^8.19.0 | Upstream has higher version. Add downgrades. |
| 2 | .rebase/add/code/package.json | devDependencies | @types/ws | 8.2.0 | ^8.18.1 | Upstream has higher version. Add downgrades. |
| 3 | .rebase/add/code/remote/package.json | dependencies | ws | 8.2.3 | ^8.19.0 | Upstream has higher version. Add downgrades. |
| 4 | .rebase/override/code/package.json | dependencies | undici | ^7.24.0 | ^7.24.0 | Upstream identical. Override redundant. |
| 5 | .rebase/override/code/package.json | devDependencies | minimatch | ^3.1.5 | ^3.1.5 | Upstream identical. Override redundant. |

### KEEP (exception)

| File | Section | Dependency | Che Pin | Upstream 1.117 | Reason |
|------|---------|-----------|---------|---------------|--------|
| .rebase/override/code/package.json | devDependencies | @vscode/l10n-dev | 0.0.18 | 0.0.35 | Pinned exception — never change |

### KEEP (Che pins higher than upstream)

| File | Section | Dependency | Che Pin | Upstream 1.117 |
|------|---------|-----------|---------|---------------|
| .rebase/override/code/package.json | devDependencies | @vscode/test-cli | ^0.0.12 | ^0.0.6 |
| .rebase/override/code/package.json | devDependencies | @vscode/test-web | ^0.0.77 | ^0.0.76 |
| .rebase/override/code/package.json | devDependencies | eslint | ^9.39.3 | ^9.36.0 |
| .rebase/override/code/build/package.json | devDependencies | @types/minimatch | ^3.0.5 | ^3.0.3 |
| .rebase/override/code/extensions/npm/package.json | dependencies | minimatch | ^5.1.9 | ^5.1.8 |

### KEEP (Che-specific, absent from upstream)

All remaining entries in `.rebase/add/` files are Che-specific dependencies or CVE override pins that upstream does not have. No changes needed.

### KEEP (overrides — CVE/security pins)

All override entries in `.rebase/add/code/package.json` overrides section (micromatch, braces, ajv, tar, undici, svgo, minimatch scoped, etc.) remain valid — upstream has no corresponding overrides.

## Changes Applied

1. Removed `ws` from `.rebase/add/code/package.json` dependencies
2. Removed `@types/ws` from `.rebase/add/code/package.json` devDependencies
3. Removed `ws` from `.rebase/add/code/remote/package.json` dependencies
4. Removed `undici` from `.rebase/override/code/package.json` dependencies section
5. Removed `minimatch` from `.rebase/override/code/package.json` devDependencies
6. Updated `code/package.json`: restored `ws` to upstream `^8.19.0`, `@types/ws` to upstream `^8.18.1`
7. Updated `code/remote/package.json`: restored `ws` to upstream `^8.19.0`
8. `undici` and `minimatch` in `code/package.json` already match upstream — no code/ changes needed
