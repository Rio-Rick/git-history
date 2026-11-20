import { createProvider } from "./provider.js";

describe("provider (the webview side of the extension)", () => {
  let provider, posted;

  beforeEach(() => {
    posted = [];
    provider = createProvider({
      vscode: { postMessage: m => posted.push(m) },
      path: "/repo/file.js"
    });
  });

  const reply = data =>
    window.dispatchEvent(new MessageEvent("message", { data }));
  const commit = (hash, content) => ({
    hash,
    author: { login: "a" },
    date: new Date(0),
    message: hash,
    content
  });
  const tick = () => new Promise(r => setTimeout(r));

  test("asks for commits and builds the versions", async () => {
    const promise = provider.getVersions(10);
    await tick();
    expect(posted[0]).toMatchObject({
      command: "commits",
      params: { last: 10, known: [] }
    });
    reply({
      id: posted[0].id,
      commits: [commit("b", "one\ntwo\n"), commit("a", "one\n")]
    });
    const versions = await promise;
    expect(versions.length).toBe(2);
    expect(versions[0].lines.length).toBeGreaterThan(0);
    expect(versions[0].commit.date instanceof Date).toBe(true);
  });

  test("says which commits it already has on the next request, and reuses them", async () => {
    const first = provider.getVersions(10);
    await tick();
    reply({
      id: posted[0].id,
      commits: [commit("b", "one\ntwo\n"), commit("a", "one\n")]
    });
    await first;

    const second = provider.getVersions(20);
    await tick();
    expect(posted[1].params.known.sort()).toEqual(["a", "b"]);
    // the extension does not send the content of the known ones
    reply({
      id: posted[1].id,
      commits: [commit("b"), commit("a"), commit("0", "")]
    });
    const versions = await second;
    expect(versions.length).toBe(3);
    expect(versions[0].commit.content).toBe("one\ntwo\n");
  });

  test("ignores replies for other requests", async () => {
    const promise = provider.getVersions(10);
    await tick();
    reply({ id: 999, commits: [] });
    reply({ id: posted[0].id, commits: [commit("a", "one\n")] });
    expect((await promise).length).toBe(1);
  });

  test("passes on the error message of the extension", async () => {
    const promise = provider.getVersions(10);
    await tick();
    reply({
      id: posted[0].id,
      error: "This file is not inside a git repository."
    });
    await expect(promise).rejects.toMatchObject({
      friendly: true,
      message: "This file is not inside a git repository."
    });
  });
});
