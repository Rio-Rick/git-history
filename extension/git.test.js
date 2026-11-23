/**
 * Tests of the part of the VS Code extension that talks to git.
 * They use a real (temporary) git repository.
 */
const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const getHistory = require("./git");

describe("vscode-ext/git", () => {
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
    const commits = await getHistory(path.join(dir, "file.js"), 10);
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
    const commits = await getHistory(path.join(dir, "file.js"), 10);
    expect(commits[2].author.login).toBe('Ana "The Dev" Smith');
  });

  test("`last` limits the number of commits", async () => {
    const commits = await getHistory(path.join(dir, "file.js"), 2);
    expect(commits.map(c => c.message)).toEqual([
      "fourth",
      "third | with, odd: chars {}"
    ]);
  });

  test("`before` gives the commits after that one with the right messages", async () => {
    const all = await getHistory(path.join(dir, "file.js"), 10);
    const older = await getHistory(path.join(dir, "file.js"), 2, all[1].hash);
    expect(older.map(c => c.message)).toEqual(['second "quoted"', "first"]);
    expect(older.map(c => c.content)).toEqual(["one\ntwo\n", "one\n"]);
  });

  test("does not read the content of the commits that are already known", async () => {
    const all = await getHistory(path.join(dir, "file.js"), 10);
    const known = all.slice(2).map(c => c.hash);
    const commits = await getHistory(
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
    const commits = await getHistory(path.join(dir, "file.js"), 10);
    expect(commits[0].message).toBe("delete file");
    expect(commits[0].content).toBe("");
    expect(commits[1].content).toBe("one\ntwo\nthree\nfour\n");
  });

  test("reads files from nested directories", async () => {
    const nested = path.join(dir, "src", "nested");
    fs.mkdirSync(nested, { recursive: true });
    const nestedFile = path.join(nested, "nested.js");
    fs.writeFileSync(nestedFile, "nested one\n");
    run("git add -A");
    run('git -c user.name=t -c user.email=t@t.t commit -q -m "nested first"');
    fs.writeFileSync(nestedFile, "nested one\nnested two\n");
    run("git add -A");
    run('git -c user.name=t -c user.email=t@t.t commit -q -m "nested second"');

    const commits = await getHistory(nestedFile, 2);
    expect(commits.map(commit => commit.message)).toEqual([
      "nested second",
      "nested first"
    ]);
    expect(commits.map(commit => commit.content)).toEqual([
      "nested one\nnested two\n",
      "nested one\n"
    ]);

    // The active editor can outlive a deleted folder. Git should still be
    // able to read the file's history from the nearest existing directory.
    fs.rmSync(nested, { recursive: true, force: true });
    const afterFolderDeletion = await getHistory(nestedFile, 2);
    expect(afterFolderDeletion.map(commit => commit.message)).toEqual([
      "nested second",
      "nested first"
    ]);
  });

  test("treats pathspec metacharacters as literal file-name characters", async () => {
    const name = ":(exclude)literal[1]*.js";
    const unusualFile = path.join(dir, name);
    fs.writeFileSync(unusualFile, "const literal = true;\n");
    run("git add -A");
    run('git -c user.name=t -c user.email=t@t.t commit -q -m "literal path"');

    const commits = await getHistory(unusualFile, 1);
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe("literal path");
    expect(commits[0].content).toBe("const literal = true;\n");
  });

  test("preserves control characters in commit subjects", async () => {
    const specialDir = fs.mkdtempSync(path.join(os.tmpdir(), "gfh-special-"));
    const specialFile = path.join(specialDir, "special.js");
    const messageFile = path.join(specialDir, "message.txt");
    const runGit = args =>
      execFileSync("git", args, { cwd: specialDir, stdio: "pipe" });

    runGit(["init", "-q"]);
    fs.writeFileSync(specialFile, "const value = 1;\n");
    runGit(["add", "-A"]);
    const message = "subject with \x1f and \x1e separators";
    fs.writeFileSync(messageFile, `${message}\n`);
    runGit([
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "commit",
      "-q",
      "-F",
      messageFile
    ]);

    const commits = await getHistory(specialFile, 1);
    expect(commits[0].message).toBe(message);
  });

  test("rejects non-hash pagination revisions", async () => {
    await expect(
      getHistory(path.join(dir, "file.js"), 5, "--upload-pack=unexpected")
    ).rejects.toMatchObject({
      friendly: true,
      message: "Invalid Git revision requested."
    });
  });

  test("says it clearly when the file is outside a git repository", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "nogit-"));
    fs.writeFileSync(path.join(outside, "a.js"), "x");
    await expect(
      getHistory(path.join(outside, "a.js"), 5)
    ).rejects.toMatchObject({
      friendly: true,
      message: expect.stringMatching(/not inside a git repository/)
    });
  });

  test("says it clearly when the file has no history", async () => {
    fs.writeFileSync(path.join(dir, "new.js"), "x");
    await expect(getHistory(path.join(dir, "new.js"), 5)).rejects.toMatchObject(
      {
        friendly: true,
        message: expect.stringMatching(/No git history/)
      }
    );
  });
});
