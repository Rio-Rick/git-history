# Changelog

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
