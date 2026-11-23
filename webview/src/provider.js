import { getLanguage } from "./lib/languages.js";
import {
  createSlidesBuilder,
  createSlidesCache,
  getChanges,
  resetSlidesCache
} from "./lib/differ.js";

const MAX_CONTENT_CACHE_BYTES = 64 * 1024 * 1024;
const MAX_CONTENT_CACHE_ENTRIES = 10000;

// Talks with the extension (the part that can run git) and turns what it
// sends into the versions of the file.
//
// `vscode` is what acquireVsCodeApi() returns, and `path` is the file.
export function createProvider({ vscode, path, target = window }) {
  // Content is kept between pagination requests so the extension does not
  // need to transfer old file versions again. Keep the cache bounded because
  // a long history can contain many large files.
  const contentCache = new Map();
  let contentCacheBytes = 0;
  const pending = new Map();
  const slidesCache = createSlidesCache();
  let nextId = 1;
  let disposed = false;

  function getCachedContent(hash) {
    const entry = contentCache.get(hash);
    if (!entry) return undefined;

    contentCache.delete(hash);
    contentCache.set(hash, entry);
    return entry.content;
  }

  function cacheContent(hash, content) {
    // UTF-16 is a conservative estimate of the memory occupied by a JS string.
    const size = content.length * 2;
    if (size > MAX_CONTENT_CACHE_BYTES) return;

    const previous = contentCache.get(hash);
    if (previous) {
      contentCacheBytes -= previous.size;
      contentCache.delete(hash);
    }

    while (
      contentCache.size > 0 &&
      (contentCacheBytes + size > MAX_CONTENT_CACHE_BYTES ||
        contentCache.size >= MAX_CONTENT_CACHE_ENTRIES)
    ) {
      const oldestHash = contentCache.keys().next().value;
      const oldest = contentCache.get(oldestHash);
      contentCache.delete(oldestHash);
      contentCacheBytes -= oldest.size;
    }

    contentCache.set(hash, { content, size });
    contentCacheBytes += size;
  }

  const onMessage = event => {
    const data = event.data || {};
    const { id, commits, error } = data;
    if (!Number.isSafeInteger(id)) return;

    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);

    if (error) {
      const failure = new Error(String(error));
      failure.friendly = true;
      request.reject(failure);
    } else if (!Array.isArray(commits)) {
      request.reject(new Error("Invalid history response from the extension."));
    } else {
      request.resolve(commits);
    }
  };

  target.addEventListener("message", onMessage);

  function getCommits(last) {
    return new Promise((resolve, reject) => {
      if (disposed) {
        reject(new Error("The history panel has already been closed."));
        return;
      }

      const id = nextId++;
      const known = Array.from(contentCache.keys()).slice(
        -MAX_CONTENT_CACHE_ENTRIES
      );
      pending.set(id, { resolve, reject });

      try {
        const result = vscode.postMessage({
          command: "commits",
          id,
          params: { last, known }
        });
        // VS Code returns a Thenable<boolean>; the test double may return void.
        if (result && typeof result.then === "function") {
          Promise.resolve(result).then(
            accepted => {
              if (accepted === false) {
                const request = pending.get(id);
                if (!request) return;
                pending.delete(id);
                reject(new Error("The history panel is no longer available."));
              }
            },
            error => {
              const request = pending.get(id);
              if (!request) return;
              pending.delete(id);
              reject(error);
            }
          );
        }
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    }).then(commits =>
      commits.map(commit => {
        if (!commit || typeof commit.hash !== "string") {
          throw new Error("Invalid commit data received from the extension.");
        }

        if (commit.content == null) {
          const cached = getCachedContent(commit.hash);
          if (cached === undefined) {
            throw new Error(
              `The extension did not provide content for commit ${commit.hash}.`
            );
          }
          commit.content = cached;
        } else if (typeof commit.content === "string") {
          cacheContent(commit.hash, commit.content);
        } else {
          throw new Error(
            `Invalid file content received for commit ${commit.hash}.`
          );
        }

        commit.date = new Date(commit.date);
        if (!Number.isFinite(commit.date.getTime())) {
          throw new Error(`Invalid commit date received for ${commit.hash}.`);
        }
        return commit;
      })
    );
  }

  async function getVersions(last) {
    if (disposed) {
      throw new Error("The history panel has already been closed.");
    }
    const commits = await getCommits(last);
    const builder = createSlidesBuilder(
      commits.map(commit => commit.content),
      getLanguage(path),
      slidesCache
    );

    try {
      // Diff/tokenization can be expensive for large files. Yield between
      // commits so the webview can paint and respond to input.
      let done = false;
      while (!done) {
        done = builder.step();
        if (disposed) {
          throw new Error("The history panel has already been closed.");
        }
        if (!done) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      const slides = builder.finish();
      return commits.map((commit, i) => ({
        commit,
        lines: slides[i],
        changes: getChanges(slides[i])
      }));
    } catch (error) {
      // A failed step may have partially modified the shared incremental cache.
      // Reset this provider's cache rather than reusing partial diff state.
      resetSlidesCache(slidesCache);
      throw error;
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    target.removeEventListener("message", onMessage);
    for (const request of pending.values()) {
      request.reject(new Error("The history panel was closed."));
    }
    pending.clear();
    contentCache.clear();
    contentCacheBytes = 0;
  }

  return { path, getVersions, dispose };
}
