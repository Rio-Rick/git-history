// Reads the history of a file with git. No dependencies: only what Node has.
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const pather = require("node:path");

const execFileAsync = promisify(execFile);

const FIELD = "\x1f";
const RECORD = "\x1e";
const MAX_BUFFER = 256 * 1024 * 1024;
const CONCURRENCY = 8;

// The content of a file in a commit never changes, so it is fetched once
const contentCache = new Map();

function friendly(message) {
  const error = new Error(message);
  error.friendly = true;
  return error;
}

async function git(args, cwd) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: MAX_BUFFER,
      encoding: "utf8",
      windowsHide: true
    });
    return stdout;
  } catch (e) {
    const text = `${e.stderr || ""} ${e.message || ""}`;
    if (/not a git repository/i.test(text)) {
      throw friendly("This file is not inside a git repository.");
    }
    if (e.code === "ENOENT") {
      throw friendly("Git was not found. Is it installed and in your PATH?");
    }
    throw e;
  }
}

async function getCommits(path, last, before) {
  const count = Number(last) + (before ? 1 : 0);
  // One record per commit, separated with characters that can not be part
  // of an author name or a message (so quotes and such are not a problem)
  const format = ["%h", "%aN", "%ad", "%s"].join(FIELD) + RECORD;
  const stdout = await git(
    [
      "log",
      `--max-count=${count}`,
      `--pretty=format:${format}`,
      "--date=iso",
      before || "HEAD",
      "--",
      pather.basename(path)
    ],
    pather.dirname(path)
  );

  const commits = stdout
    .split(RECORD)
    .map(record => record.replace(/^\r?\n/, ""))
    .filter(record => record.length > 0)
    .map(record => {
      const [hash, login, date, ...message] = record.split(FIELD);
      return {
        hash,
        author: { login },
        date: new Date(date),
        message: message.join(FIELD)
      };
    });

  return before ? commits.slice(1) : commits;
}

async function getContent(commit, path) {
  const dir = pather.dirname(path);
  const name = pather.basename(path);
  const key = [dir, commit.hash, name].join("\0");
  if (contentCache.has(key)) {
    return contentCache.get(key);
  }
  let content;
  try {
    content = await git(["show", `${commit.hash}:./${name}`], dir);
  } catch (e) {
    // The commit that deleted the file does not have it anymore
    if (
      /exists on disk, but not in|does not exist in|bad object/i.test(
        `${e.stderr} ${e.message}`
      )
    ) {
      content = "";
    } else {
      throw e;
    }
  }
  contentCache.set(key, content);
  return content;
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    }
  );
  await Promise.all(workers);
}

// `known` are hashes whose content the caller already has: we do not read
// them again nor send them again.
module.exports = async function getHistory(path, last, before, known = []) {
  const commits = await getCommits(path, last, before);
  if (commits.length === 0) {
    throw friendly(
      "No git history found for this file. Has it been committed?"
    );
  }
  const skip = new Set(known);
  await mapLimit(
    commits.filter(commit => !skip.has(commit.hash)),
    CONCURRENCY,
    async commit => {
      commit.content = await getContent(commit, path);
    }
  );
  return commits;
};
