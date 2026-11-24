# Changelog

## 2.1.0

- Removed lines are now part of the change navigation. A commit that only
  deletes lines has changes (before, it said "No changes" and the lines just
  disappeared), so the previous / next buttons, the counter and auto-jump work
  for it too.
- A red "N lines removed" row shows where lines were deleted. Click it to see
  the old lines (red, struck through, not numbered); the new Removed button
  opens all of them and remembers the choice. Inside a replaced block the old
  lines come first and the new ones after them.
- When a commit deletes the whole file (or empties it) its old content is
  shown instead of a blank page.
- The strip next to the scrollbar has colours: green added, blue replaced,
  red removed. The navigator shows `+added −removed` for the commit.

## 2.0.0

- New project that is only the VS Code extension, built with the latest tools:
  Vite 8, React 19, Vitest 5 and the latest `diff`, `prismjs` and `@vscode/vsce`.
- No runtime dependencies (git is read with Node's own `child_process`).
- The page is one script with a Content Security Policy and `asWebviewUri`.
- Languages are part of the page (no loading while you browse), the ones that
  did not exist in Prism were fixed and more file types were added. Unknown
  files are plain text instead of being read as JavaScript.
- Colors for the kinds of tokens that newer Prism versions have.
- Disabled in untrusted workspaces; runs where the files are in remote windows.

## 1.2.0

- Much faster loading and animation, auto-jump, line numbers, match case, `?`
  help, clear errors, explorer menu.

## 1.1.0

- Change navigation, markers and search.
