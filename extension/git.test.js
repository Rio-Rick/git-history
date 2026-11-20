/**
 * Tests of the part of the VS Code extension that talks to git.
 * They use a real (temporary) git repository.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

let getCommits = null;
try {
  getCommits = require("./git");
} catch (e) {
  // the extension dependencies (execa) are not installed
}
const maybe = getCommits ? describe : describe.skip;

maybe("vscode-ext/git", () => {
  let dir;
  const run = cmd => execSync(cmd, { cwd: dir, stdio: "pipe" });
  const commit = (content, message, author = "Test User") => {
    fs.writeFileSync(path.join(dir, "file.js"), content);
    run("git add -A");
    run(
      `git -c user.name="${author.replace(
        /"/g,
        '\\"'
      )}" -c user.email=t@t.t commit -q -m "${message.replace(/"/g, '\\"')}"`
    );
  };

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "gfh-"));
    run("git init -q");
    commit("one\n", "first");
    commit("one\ntwo\n", 'second "quoted"', 'Ana "The Dev" Smith');
    commit("one\ntwo\nthree\n", "third | with, odd: chars {}");
    fs.writeFileSync(path.join(dir, "other.js"), "x\n");
    run("git add -A");
    run('git -c user.name=a -c user.email=a@a.a commit -q -m "unrelated"');
    commit("one\ntwo\nthree\nfour\n", "fourth");
  });

  test("returns the commits of the file, newest first, with their content", async () => {
    const commits = await getCommits(path.join(dir, "file.js"), 10);
    expect(commits.map(c => c.message)).toEqual([
      "fourth",
      "third | with, odd: chars {}",
      'second "quoted"',
      "first"
    ]);
    expect(commits.map(c => c.content)).toEqual([
      "one\ntwo\nthree\nfour\n",
      "one\ntwo\nthree\n",
      "one\ntwo\n",
      "one\n"
    ]);
    expect(commits[0].date instanceof Date).toBe(true);
    expect(commits[0].hash).toMatch(/^[0-9a-f]{7,}$/);
  });

  test("quotes in author names and messages do not break anything", async () => {
    const commits = await getCommits(path.join(dir, "file.js"), 10);
    expect(commits[2].author.login).toBe('Ana "The Dev" Smith');
  });

  test("`last` limits the number of commits", async () => {
    const commits = await getCommits(path.join(dir, "file.js"), 2);
    expect(commits.map(c => c.message)).toEqual([
      "fourth",
      "third | with, odd: chars {}"
    ]);
  });

  test("`before` gives the commits after that one with the right messages", async () => {
    const all = await getCommits(path.join(dir, "file.js"), 10);
    const older = await getCommits(path.join(dir, "file.js"), 2, all[1].hash);
    expect(older.map(c => c.message)).toEqual(['second "quoted"', "first"]);
    expect(older.map(c => c.content)).toEqual(["one\ntwo\n", "one\n"]);
  });

  test("does not read the content of the commits that are already known", async () => {
    const all = await getCommits(path.join(dir, "file.js"), 10);
    const known = all.slice(2).map(c => c.hash);
    const commits = await getCommits(
      path.join(dir, "file.js"),
      10,
      null,
      known
    );
    expect(commits.map(c => c.content !== undefined)).toEqual([
      true,
      true,
      false,
      false
    ]);
  });

  test("a commit that deleted the file has empty content", async () => {
    run("git rm -q file.js");
    run('git -c user.name=a -c user.email=a@a.a commit -q -m "delete file"');
    const commits = await getCommits(path.join(dir, "file.js"), 10);
    expect(commits[0].message).toBe("delete file");
    expect(commits[0].content).toBe("");
    expect(commits[1].content).toBe("one\ntwo\nthree\nfour\n");
  });

  test("says it clearly when the file is outside a git repository", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "nogit-"));
    fs.writeFileSync(path.join(outside, "a.js"), "x");
    await expect(
      getCommits(path.join(outside, "a.js"), 5)
    ).rejects.toMatchObject({
      friendly: true,
      message: expect.stringMatching(/not inside a git repository/)
    });
  });

  test("says it clearly when the file has no history", async () => {
    fs.writeFileSync(path.join(dir, "new.js"), "x");
    await expect(getCommits(path.join(dir, "new.js"), 5)).rejects.toMatchObject(
      {
        friendly: true,
        message: expect.stringMatching(/No git history/)
      }
    );
  });
});
