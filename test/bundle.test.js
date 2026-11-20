// End to end: the page that was built, running in jsdom, with the real
// extension code reading a real git repository.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { JSDOM } = require("jsdom");
const getHistory = require("../extension/git");
const { getHtml } = require("../extension/webview-html");

const dist = path.join(__dirname, "..", "dist", "webview");

const wait = (predicate, ms = 8000) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      let ok = false;
      try {
        ok = predicate();
      } catch (e) {
        // not yet
      }
      if (ok) return resolve();
      if (Date.now() - start > ms)
        return reject(new Error("timeout: " + predicate));
      setTimeout(check, 25);
    };
    check();
  });

function openPage(file) {
  const html = getHtml({
    cspSource: "https://csp.test",
    nonce: "n",
    scriptUri: "main.js",
    styleUri: "main.css",
    data: { path: file }
  });
  const dom = new JSDOM(html, {
    url: "https://file.vscode-resource.test/",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  const { window } = dom;
  // what the webview of VS Code gives to the page
  window.acquireVsCodeApi = () => ({
    postMessage: ({ command, id, params }) => {
      if (command !== "commits") return;
      getHistory(file, params.last, null, params.known)
        .then(commits => ({ id, commits }))
        .catch(e => ({ id, error: e.friendly ? e.message : String(e.message) }))
        .then(data =>
          window.dispatchEvent(new window.MessageEvent("message", { data }))
        );
    }
  });
  window.eval(fs.readFileSync(path.join(dist, "main.js"), "utf8"));
  return window;
}

describe("the built page", () => {
  let dir, file;

  beforeAll(() => {
    if (!fs.existsSync(path.join(dist, "main.js"))) {
      throw new Error("The page is not built. Run: npm run build");
    }
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gfh-e2e-"));
    const run = cmd => execSync(cmd, { cwd: dir, stdio: "pipe" });
    run("git init -q");
    const lines = Array.from(
      { length: 40 },
      (_, i) => `const value${i} = ${i};`
    );
    for (let c = 0; c < 6; c++) {
      lines[c * 5] = `const value${c * 5} = "changed in ${c}";`;
      if (c % 2) lines.splice(c * 3, 0, `// added in ${c}`);
      fs.writeFileSync(path.join(dir, "file.js"), lines.join("\n") + "\n");
      run("git add -A");
      run(
        `git -c user.name=tester -c user.email=t@t.t commit -q -m "change ${c}"`
      );
    }
    file = path.join(dir, "file.js");
  });

  test("shows the history, moves between commits and changes, and searches", async () => {
    const window = openPage(file);
    const $ = s => window.document.querySelector(s);
    const key = (k, target = window.document.body, init = {}) =>
      target.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: k, bubbles: true, ...init })
      );

    // loading, then the newest commit with its changes
    await wait(
      () =>
        /Loading/.test(window.document.body.textContent) || $(".commit-counter")
    );
    await wait(() => $(".commit-counter"));
    expect($(".commit-counter").textContent).toBe("Commit 1 / 6");
    // auto-jump takes us to the first change
    await wait(() => /Change 1 \/ \d+/.test($(".change-nav").textContent));
    expect(window.document.querySelectorAll(".line-no").length).toBeGreaterThan(
      20
    );
    expect(window.document.body.textContent).toContain("change 5");

    // an older commit with the left arrow (the animation runs with rAF)
    key("ArrowLeft");
    await wait(() => $(".commit-counter").textContent === "Commit 2 / 6");
    await wait(() => /Change \d+ \/ \d+/.test($(".change-nav").textContent));

    // search
    key("/");
    await wait(() => $(".search-bar input"));
    const input = $(".search-bar input");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(input, "changed in");
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    await wait(() => /\d+ \/ \d+/.test($(".search-status").textContent));
    expect(
      window.document.querySelectorAll(".search-hit").length
    ).toBeGreaterThan(0);
    key("Escape", input);
    await wait(() => !$(".search-bar"));

    // help
    key("?");
    await wait(() => $(".help-dialog"));
    window.close();
  }, 30000);

  test("shows what went wrong when the file has no history", async () => {
    const lonely = path.join(dir, "not-committed.js");
    fs.writeFileSync(lonely, "x");
    const window = openPage(lonely);
    await wait(() =>
      /No git history found/.test(window.document.body.textContent)
    );
    window.close();
  });

  test("shows what went wrong when the file is not in a repository", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "gfh-nogit-"));
    const f = path.join(outside, "a.js");
    fs.writeFileSync(f, "x");
    const window = openPage(f);
    await wait(() =>
      /not inside a git repository/.test(window.document.body.textContent)
    );
    window.close();
  });
});
