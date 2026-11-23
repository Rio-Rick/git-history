# Git File History 2.0.1 — Audit and Fixes

## Fixed issues

- **Long source lines were clipped.** Rows now use their intrinsic content width, and the file viewport allows horizontal scrolling. The fixed row height and vertical animation clipping remain unchanged.
- **Stale scroll offsets could hide short revisions.** Scroll targets and current spring values are clamped to the valid range for the current document and viewport, including after switching from a long revision to a short one.
- **The commit-history slider used zero spring tension.** Its spring now has a positive tension; the spring hook also applies the initial target once the spring instance exists and disposes the spring/listener on unmount.
- **History diff/tokenization could monopolize the webview.** Processing now advances one revision at a time and yields between revisions. Previously completed slides are finalized incrementally rather than rebuilt together at the end.
- **Independent webviews could share mutable diff-cache state.** Each provider now owns a separate incremental slides cache.
- **Closing a panel could leave message listeners, pending requests, or diff work alive.** The listener and pending requests are cleaned up, a rejected `postMessage` is surfaced, and incremental processing exits after disposal.
- **An error while loading older commits replaced the working history view.** Existing revisions remain visible and the load-more error is shown without discarding them.
- **Git history lookup was fragile for nested paths and deleted parent folders.** Git now runs from the nearest existing parent and receives a path relative to the nearest existing working directory. Pathspecs are literal, so wildcard/colon characters in filenames cannot change the selected path.
- **Git pagination accepted arbitrary revision expressions.** `before` is now restricted to full SHA-1/SHA-256 object IDs; commit counts and known hashes are bounded.
- **The extension-side content cache was unbounded.** It now uses LRU eviction with entry and estimated in-memory size limits; Git content reads use lower concurrency, and a failed read stops workers from scheduling more work.
- **Commit metadata parsing could collide with ASCII separator characters.** Git's NUL-delimited fields and full object IDs are used instead.
- **Git test coverage could silently skip loading the Git module.** The tests now require it directly and include nested paths, pathspec metacharacters, deleted parent folders, control characters in subjects, and invalid pagination revisions.

## Verification performed

- Node syntax checks passed for the extension runtime and its CommonJS tests.
- The TypeScript parser successfully parsed all 41 JavaScript/JSX source and test files.
- Manual integration checks against temporary Git repositories passed for nested files, spaces, pagination, deleted parent folders, literal pathspec metacharacters, and invalid revisions.
- Regression tests were added for long lines, scroll clamping, incremental diff construction/cache isolation, provider cleanup, and message-posting failure.

## Verification not completed

The Vite build and Vitest suite could not be run in this environment because the project dependencies are not installed (`vite: not found`). Dependency installation was unavailable earlier due to an npm registry DNS/network error. Therefore the added automated tests and final packaged webview bundle still need to be run in an environment with the locked dependencies installed.

The extension runtime requirement remains `Node.js >=20.19`; the newer Node requirement documented in `README.md` applies only to the current local development/test dependency set.
