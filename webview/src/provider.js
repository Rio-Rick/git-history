import { getLanguage } from "./lib/languages.js";
import { getSlides, getChanges } from "./lib/differ.js";

// Talks with the extension (the part that can run git) and turns what it
// sends into the versions of the file.
//
// `vscode` is what acquireVsCodeApi() returns, and `path` is the file.
export function createProvider({ vscode, path, target = window }) {
  // The content of a commit never changes: we ask the extension only for the
  // ones we do not have yet, and it does not send us the others again.
  const contentCache = new Map();
  const pending = new Map();
  let nextId = 1;

  target.addEventListener("message", event => {
    const { id, commits, error } = event.data || {};
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (error) {
      const e = new Error(error);
      e.friendly = true;
      request.reject(e);
    } else {
      request.resolve(commits);
    }
  });

  function getCommits(last) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      vscode.postMessage({
        command: "commits",
        id,
        params: { last, known: Array.from(contentCache.keys()) }
      });
    }).then(commits =>
      commits.map(commit => {
        if (commit.content == null) {
          commit.content = contentCache.get(commit.hash);
        } else {
          contentCache.set(commit.hash, commit.content);
        }
        commit.date = new Date(commit.date);
        return commit;
      })
    );
  }

  async function getVersions(last) {
    const commits = await getCommits(last);
    const slides = getSlides(
      commits.map(commit => commit.content),
      getLanguage(path)
    );
    return commits.map((commit, i) => ({
      commit,
      lines: slides[i],
      changes: getChanges(slides[i])
    }));
  }

  return { path, getVersions };
}
