const { getHtml } = require("./webview-html");

const base = {
  cspSource: "https://x.vscode-cdn.net",
  nonce: "abc123",
  scriptUri: "https://x.vscode-cdn.net/main.js",
  styleUri: "https://x.vscode-cdn.net/main.css",
  data: { path: "/repo/file.js" }
};

describe("getHtml", () => {
  test("only scripts with the nonce can run", () => {
    const html = getHtml(base);
    expect(html).toContain("script-src 'nonce-abc123'");
    expect(html).toContain(`<script nonce="abc123" src="${base.scriptUri}">`);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain(`href="${base.styleUri}"`);
  });

  test("the file goes in a data block the page can read", () => {
    const html = getHtml(base);
    const match = html.match(
      /<script id="gfh-data" type="application\/json">(.*?)<\/script>/s
    );
    expect(JSON.parse(match[1])).toEqual({ path: "/repo/file.js" });
  });

  test("a file name can not close the data block", () => {
    const evil = "/repo/</script><script>alert(1)</script>.js";
    const html = getHtml({ ...base, data: { path: evil } });
    expect(html).not.toContain("<script>alert(1)");
    const match = html.match(
      /<script id="gfh-data" type="application\/json">(.*?)<\/script>/s
    );
    expect(JSON.parse(match[1]).path).toBe(evil);
  });

  test("has the place where the app is drawn", () => {
    expect(getHtml(base)).toContain('<div id="root"></div>');
  });
});
