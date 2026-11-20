const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execSync } = require("node:child_process");

// A VS Code that is just enough for the extension
function fakeVscode() {
  const state = { command: null, panels: [], infos: [] };
  const vscode = {
    Uri: { file: p => ({ fsPath: p, toString: () => `file://${p}` }) },
    ViewColumn: { One: 1 },
    window: {
      activeTextEditor: null,
      showInformationMessage: m => state.infos.push(m),
      createWebviewPanel: (type, title, column, options) => {
        const panel = {
          type,
          title,
          options,
          revealed: 0,
          posted: [],
          disposeHandler: null,
          reveal() {
            this.revealed++;
          },
          onDidDispose(handler) {
            this.disposeHandler = handler;
          },
          webview: {
            cspSource: "https://csp.test",
            asWebviewUri: uri => `https://webview.test${uri.fsPath}`,
            html: "",
            onDidReceiveMessage(handler) {
              panel.messageHandler = handler;
            },
            postMessage(message) {
              panel.posted.push(message);
            }
          }
        };
        state.panels.push(panel);
        return panel;
      }
    },
    commands: {
      registerCommand: (id, handler) => {
        state.command = { id, handler };
        return { dispose() {} };
      }
    }
  };
  return { vscode, state };
}

function load(vscode) {
  const original = Module._load;
  Module._load = function (request, ...rest) {
    return request === "vscode"
      ? vscode
      : original.call(this, request, ...rest);
  };
  try {
    const file = require.resolve("./extension.js");
    delete require.cache[file];
    return require(file);
  } finally {
    Module._load = original;
  }
}

const wait = (predicate, ms = 5000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > ms) return reject(new Error("timeout"));
      setTimeout(check, 20);
    };
    check();
  });

describe("extension", () => {
  let dir, file, env;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gfh-ext-"));
    const run = cmd => execSync(cmd, { cwd: dir, stdio: "pipe" });
    run("git init -q");
    for (const text of ["one\n", "one\ntwo\n", "one\ntwo\nthree\n"]) {
      fs.writeFileSync(path.join(dir, "file.js"), text);
      run("git add -A");
      run(`git -c user.name=t -c user.email=t@t.t commit -q -m "c"`);
    }
    file = path.join(dir, "file.js");
  });

  beforeEach(() => {
    env = fakeVscode();
    const extension = load(env.vscode);
    extension.activate({ extensionPath: "/ext", subscriptions: [] });
  });

  const run = arg => env.state.command.handler(arg);

  test("registers the command", () => {
    expect(env.state.command.id).toBe("gitFileHistoryNav.open");
  });

  test("says so when there is no file", () => {
    run();
    expect(env.state.infos).toEqual(["No active file"]);
    expect(env.state.panels.length).toBe(0);
  });

  test("opens the file of the active editor, with scripts and a locked down page", () => {
    env.vscode.window.activeTextEditor = { document: { fileName: file } };
    run();
    const [panel] = env.state.panels;
    expect(panel.title).toBe("file.js (Git History)");
    expect(panel.options.enableScripts).toBe(true);
    expect(panel.options.localResourceRoots[0].fsPath).toBe(
      path.join("/ext", "dist", "webview")
    );
    expect(panel.webview.html).toContain(
      "https://webview.test/ext/dist/webview/main.js"
    );
    expect(panel.webview.html).toContain(
      "https://webview.test/ext/dist/webview/main.css"
    );
    expect(panel.webview.html).toContain("script-src 'nonce-");
    expect(panel.webview.html).toContain(JSON.stringify({ path: file }));
  });

  test("running it again for the same file shows the same panel", () => {
    run({ fsPath: file });
    run({ fsPath: file });
    expect(env.state.panels.length).toBe(1);
    expect(env.state.panels[0].revealed).toBe(1);
  });

  test("a closed panel can be opened again", () => {
    run({ fsPath: file });
    env.state.panels[0].disposeHandler();
    run({ fsPath: file });
    expect(env.state.panels.length).toBe(2);
  });

  test("the file of the explorer is used when there is one", () => {
    env.vscode.window.activeTextEditor = {
      document: { fileName: "/other.js" }
    };
    run({ fsPath: file });
    expect(env.state.panels[0].title).toBe("file.js (Git History)");
  });

  test("answers the page with the history of the file of the panel", async () => {
    run({ fsPath: file });
    const [panel] = env.state.panels;
    // the page asks for another file: it is ignored
    panel.messageHandler({
      command: "commits",
      id: 7,
      params: { path: "/etc/passwd", last: 2, known: [] }
    });
    await wait(() => panel.posted.length === 1);
    const reply = panel.posted[0];
    expect(reply.id).toBe(7);
    expect(reply.commits.map(c => c.content)).toEqual([
      "one\ntwo\nthree\n",
      "one\ntwo\n"
    ]);

    // it does not send what the page already has
    const known = [reply.commits[0].hash];
    panel.messageHandler({
      command: "commits",
      id: 8,
      params: { last: 3, known }
    });
    await wait(() => panel.posted.length === 2);
    expect(panel.posted[1].commits.map(c => c.content === undefined)).toEqual([
      true,
      false,
      false
    ]);
  });

  test("tells the page when there is no history", async () => {
    const lonely = path.join(dir, "new.js");
    fs.writeFileSync(lonely, "x");
    run({ fsPath: lonely });
    const [panel] = env.state.panels;
    panel.messageHandler({
      command: "commits",
      id: 1,
      params: { last: 3, known: [] }
    });
    await wait(() => panel.posted.length === 1);
    expect(panel.posted[0]).toEqual({
      id: 1,
      error: "No git history found for this file. Has it been committed?"
    });
  });

  test("ignores messages it does not know", () => {
    run({ fsPath: file });
    const [panel] = env.state.panels;
    expect(() => panel.messageHandler({ command: "nope" })).not.toThrow();
    expect(() => panel.messageHandler(null)).not.toThrow();
    expect(panel.posted).toEqual([]);
  });
});
