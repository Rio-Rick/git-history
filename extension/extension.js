const vscode = require("vscode");
const path = require("path");
const crypto = require("crypto");
const getHistory = require("./git");
const { getHtml } = require("./webview-html");

const COMMAND = "gitFileHistoryNav.open";

function getCurrentPath() {
  const editor = vscode.window.activeTextEditor;
  return editor ? editor.document.fileName : null;
}

function activate(context) {
  // One panel per file: running the command again shows the one that is open
  const panels = new Map();
  const webviewRoot = vscode.Uri.file(
    path.join(context.extensionPath, "dist", "webview")
  );

  const disposable = vscode.commands.registerCommand(
    COMMAND,
    // `uri` is there when it is run from the explorer or from an editor menu
    function (uri) {
      const filePath = (uri && uri.fsPath) || getCurrentPath();
      if (!filePath) {
        vscode.window.showInformationMessage("No active file");
        return;
      }

      const existing = panels.get(filePath);
      if (existing) {
        existing.reveal();
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        "gitFileHistoryNav",
        `${path.basename(filePath)} (Git History)`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [webviewRoot]
        }
      );
      panels.set(filePath, panel);
      panel.onDidDispose(() => panels.delete(filePath));

      const { webview } = panel;
      const asset = name =>
        webview.asWebviewUri(
          vscode.Uri.file(path.join(webviewRoot.fsPath, name))
        );

      webview.html = getHtml({
        cspSource: webview.cspSource,
        nonce: crypto.randomBytes(16).toString("hex"),
        scriptUri: asset("main.js"),
        styleUri: asset("main.css"),
        data: { path: filePath }
      });

      webview.onDidReceiveMessage(
        message => {
          if (!message || message.command !== "commits") return;
          const { id } = message;
          const { last = 15, before = null, known = [] } = message.params || {};
          // always the file of this panel, whatever the page asks for
          getHistory(filePath, last, before, known)
            .then(commits => webview.postMessage({ id, commits }))
            .catch(e => {
              if (!e.friendly) console.error(e);
              webview.postMessage({
                id,
                error: e.friendly
                  ? e.message
                  : `Could not read the history: ${(e.stderr || e.message || "")
                      .toString()
                      .trim()}`
              });
            });
        },
        undefined,
        context.subscriptions
      );
    }
  );

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate, COMMAND };
