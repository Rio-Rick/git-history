# Git File History (Change Navigation & Search)

Browse the history of a file inside VS Code: step through its commits and see
what changed, with an animation, in the file itself.

Based on [pomber/git-history](https://github.com/pomber/git-history) (MIT),
rebuilt as a small extension of its own and with these additions:

- **Previous / next change** buttons (or `↑` / `↓`) with a "Change 2 / 5" counter.
- **Auto-jump**: when you switch commit it scrolls to the closest change, so you do not have to look for what changed. It can be turned off.
- **Change markers** next to the scrollbar. Click one to jump to that change.
- **Search in the file**: `Ctrl/Cmd + F`, `/` or the Search button. `Enter` / `Shift + Enter` go to the next / previous match, `Esc` closes it and `Aa` matches the case.
- **Line numbers**, a commit counter and a `?` help with all the shortcuts.
- **Fast**: long histories and big files load in a fraction of the time and the animation stays smooth. Only the commits that are new are processed when more are loaded.
- Clear messages when the file is not in a git repository or has no history.

## Use

Open a file that is in a git repository, then run **Git File History (Nav & Search)**
from the Command Palette, or right-click the file in the editor or in the explorer.

| Action                 | How                                                           |
| ---------------------- | ------------------------------------------------------------- |
| Older / newer commit   | `←` / `→`, swipe, or click a commit at the top                |
| Previous / next change | `↑` / `↓`, or the ▲ ▼ buttons at the bottom                   |
| Auto-jump              | Scrolls to the closest change when you switch commit (toggle) |
| Jump to a change       | Click a green mark on the strip next to the scrollbar         |
| Search in the file     | `Ctrl/Cmd + F`, `/`, or the Search button                     |
| Next / previous match  | `Enter` / `Shift + Enter` (yellow marks show all matches)     |
| Match case             | The `Aa` button in the search box                             |
| Close search / help    | `Esc`                                                         |
| Keyboard shortcuts     | `?`                                                           |

`Ctrl/Cmd + F` can be taken by VS Code while the page is open; `/` and the
Search button always work.

Files whose language is not known are shown as plain text.

## Build it

The extension runtime remains compatible with Node.js 20.19+. For local development and tests with the current locked dependencies (including jsdom 31), use Node.js 22.22.2+ in the 22.x line, 24.15+ in the 24.x line, or 26+, plus git.

```bash
npm install
npm test            # builds the page and runs all the tests
npm run package     # creates git-file-history-nav-<version>.vsix
```

Then, in VS Code: Extensions → `⋯` → **Install from VSIX…**, or

```bash
code --install-extension git-file-history-nav-2.0.1.vsix
```

To try it without installing: open this folder in VS Code and press **F5**.
`npm run watch` rebuilds the page when you change it (reload the window of the
extension to see it).

## How it is made

```
extension/   what runs in VS Code (plain Node, no dependencies)
  extension.js     the command and the panel
  git.js           reads the history with git
  webview-html.js  the page of the panel (strict Content Security Policy)
webview/     the page that shows the history (React, built with Vite)
  src/lib/         diff, tokenizing, languages
dist/        the build (not in git)
```

The page is built as one script and one stylesheet. The extension sends it the
commits of the file; it asks for more as you go back in time, and the content of
a commit is sent only once.

## Credits

[pomber/git-history](https://github.com/pomber/git-history) by Rodrigo Pombo
(MIT, see `LICENSE`).
