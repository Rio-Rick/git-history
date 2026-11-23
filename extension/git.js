// Reads the history of a file with git. No dependencies: only what Node has.
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const pather = require("node:path");

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 256 * 1024 * 1024;
const CONCURRENCY = 4;
const DEFAULT_COMMIT_COUNT = 15;
const MAX_COMMIT_COUNT = 10000;
const MAX_KNOWN_HASHES = 10000;
const MAX_CONTENT_CACHE_ENTRIES = 10000;
const MAX_CONTENT_CACHE_BYTES = 64 * 1024 * 1024;

// Keep a bounded LRU cache: histories can span large files and many commits.
const contentCache = new Map();
let contentCacheBytes = 0;

function friendly(message) {
  const error = new Error(message);
  error.friendly = true;
  return error;
}

function normalizeCommitCount(value) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1) {
    return DEFAULT_COMMIT_COUNT;
  }
  return Math.min(count, MAX_COMMIT_COUNT);
}

function normalizeRevision(value) {
  if (value == null || value === "") return null;
  // `before` is a Git object id returned by this extension, not an arbitrary
  // revision expression or command-line option supplied by the webview.
  if (
    typeof value !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value)
  ) {
    throw friendly("Invalid Git revision requested.");
  }
  return value;
}

function getCachedContent(key) {
  const entry = contentCache.get(key);
  if (!entry) return undefined;

  // Refresh insertion order so frequently used entries stay in the cache.
  contentCache.delete(key);
  contentCache.set(key, entry);
  return entry.content;
}

function cacheContent(key, content) {
  // Use the in-memory UTF-16 string size, not its usually smaller UTF-8 size.
  const size = content.length * 2;
  if (size > MAX_CONTENT_CACHE_BYTES) return;

  const existing = contentCache.get(key);
  if (existing) {
    contentCacheBytes -= existing.size;
    contentCache.delete(key);
  }

  while (
    contentCache.size > 0 &&
    (contentCacheBytes + size > MAX_CONTENT_CACHE_BYTES ||
      contentCache.size >= MAX_CONTENT_CACHE_ENTRIES)
  ) {
    const oldestKey = contentCache.keys().next().value;
    const oldest = contentCache.get(oldestKey);
    contentCache.delete(oldestKey);
    contentCacheBytes -= oldest.size;
  }

  contentCache.set(key, { content, size });
  contentCacheBytes += size;
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

function resolveGitLocation(filePath) {
  if (
    typeof filePath !== "string" ||
    filePath.length === 0 ||
    filePath.includes("\0")
  ) {
    throw friendly("A valid file path is required.");
  }

  const absolutePath = pather.resolve(filePath);
  let directory = pather.dirname(absolutePath);

  // The file may have been deleted together with one or more parent folders
  // while its editor is still open. Run Git from the nearest existing folder
  // and pass the remaining path as a pathspec instead of using a missing cwd.
  while (true) {
    try {
      if (fs.statSync(directory).isDirectory()) break;
    } catch (_) {
      // Walk upward until an existing directory is found.
    }

    const parent = pather.dirname(directory);
    if (parent === directory) {
      throw friendly("Could not find an existing directory for this file.");
    }
    directory = parent;
  }

  const relativePath = pather
    .relative(directory, absolutePath)
    .split(pather.sep)
    .join("/");
  if (
    !relativePath ||
    relativePath === "." ||
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    pather.isAbsolute(relativePath)
  ) {
    throw friendly("The selected path is not a file inside this directory.");
  }

  return { directory, relativePath };
}

async function getCommits(directory, relativePath, last, before) {
  const count = last + (before ? 1 : 0);
  // NUL is not valid in Git names or commit subjects, unlike the ASCII
  // separators commonly used in pretty formats. Git inserts a newline
  // between formatted commits; that prefix is removed from each hash.
  const format = ["%H", "%aN", "%aI", "%s"].join("%x00") + "%x00";
  const stdout = await git(
    [
      "--literal-pathspecs",
      "log",
      `--max-count=${count}`,
      `--pretty=format:${format}`,
      "--no-color",
      "--no-show-signature",
      before || "HEAD",
      "--",
      relativePath
    ],
    directory
  );

  const fields = stdout.split("\0");
  const commits = [];
  for (let i = 0; i + 3 < fields.length; i += 4) {
    const hash = fields[i].replace(/^\r?\n/, "");
    if (!hash) continue;

    commits.push({
      hash,
      author: { login: fields[i + 1] },
      date: new Date(fields[i + 2]),
      message: fields[i + 3]
    });
  }

  return before ? commits.slice(1) : commits;
}

async function getContent(commit, directory, relativePath) {
  const key = [directory, commit.hash, relativePath].join("\0");
  const cached = getCachedContent(key);
  if (cached !== undefined) return cached;

  let content;
  try {
    content = await git(
      ["show", `${commit.hash}:./${relativePath}`],
      directory
    );
  } catch (e) {
    // The commit that deleted the file does not have it anymore.
    if (
      /exists on disk, but not in|does not exist in|bad object/i.test(
        `${e.stderr || ""} ${e.message || ""}`
      )
    ) {
      content = "";
    } else {
      throw e;
    }
  }

  cacheContent(key, content);
  return content;
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  let failed = false;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (!failed && next < items.length) {
        const item = items[next++];
        try {
          await fn(item);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }
  );
  await Promise.all(workers);
}

// `known` are hashes whose content the caller already has: we do not read
// them again nor send them again.
module.exports = async function getHistory(
  filePath,
  last = DEFAULT_COMMIT_COUNT,
  before = null,
  known = []
) {
  const count = normalizeCommitCount(last);
  const revision = normalizeRevision(before);
  const knownHashes = Array.isArray(known)
    ? known
        .slice(0, MAX_KNOWN_HASHES)
        .filter(
          hash =>
            typeof hash === "string" &&
            /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(hash)
        )
    : [];

  const { directory, relativePath } = resolveGitLocation(filePath);
  const commits = await getCommits(
    directory,
    relativePath,
    count,
    revision
  );
  if (commits.length === 0) {
    throw friendly(
      "No git history found for this file. Has it been committed?"
    );
  }

  const skip = new Set(knownHashes);
  await mapLimit(
    commits.filter(commit => !skip.has(commit.hash)),
    CONCURRENCY,
    async commit => {
      commit.content = await getContent(commit, directory, relativePath);
    }
  );
  return commits;
};
