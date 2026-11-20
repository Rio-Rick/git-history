import { getLanguage, languages, PLAIN } from "./languages.js";
import tokenize from "./tokenizer.js";
import Prism from "./prism-core.js";
import "./prism-languages.js";

describe("getLanguage", () => {
  test.each([
    ["my-file.js", "javascript"],
    ["my-file.MJS", "javascript"],
    ["my-file.jsx", "jsx"],
    ["my-file.ts", "typescript"],
    ["my-file.tsx", "tsx"],
    ["my-file.json", "json"],
    ["my-file.babelrc", "json"],
    ["config.yml", "yaml"],
    ["run.sh", "bash"],
    ["main.py", "python"],
    ["style.css", "css"],
    ["style.scss", "scss"],
    ["page.html", "markup"],
    ["icon.svg", "markup"],
    ["main.c", "c"],
    ["main.cpp", "cpp"],
    ["main.cs", "csharp"],
    ["Dockerfile", "docker"],
    ["README.md", "markdown"],
    ["lib.rs", "rust"],
    ["main.go", "go"],
    ["Main.java", "java"],
    ["Gemfile.rb", "ruby"],
    ["a/b/Makefile", "makefile"],
    ["Cargo.toml", "toml"]
  ])("%s is %s", (file, lang) => {
    expect(getLanguage(file)).toBe(lang);
  });

  test("files we do not know are plain text", () => {
    expect(getLanguage("notes.txt")).toBe(PLAIN);
    expect(getLanguage("LICENSE")).toBe(PLAIN);
  });

  test("a part of a name is not enough (xpm is not perl)", () => {
    expect(getLanguage("image.xpm")).toBe(PLAIN);
  });
});

describe("every language we map to can be highlighted", () => {
  test.each([...new Set(languages)])("%s", lang => {
    expect(Prism.languages[lang]).toBeTruthy();
    expect(() => tokenize("let a = 1;\n", lang)).not.toThrow();
  });
});

describe("tokenize", () => {
  test("splits tokens in lines", () => {
    const lines = tokenize("a = 1;\nb = 2;\n", "javascript");
    expect(lines.length).toBe(3);
    expect(lines[0].map(t => t.content).join("")).toBe("a = 1;");
  });

  test("a language that does not exist is plain text", () => {
    const lines = tokenize("hello world\nbye", "no-such-language");
    expect(lines).toEqual([
      [{ type: "plain", content: "hello world" }],
      [{ type: "plain", content: "bye" }]
    ]);
  });

  test("highlights things that need another language (tsx needs jsx)", () => {
    const [line] = tokenize("const a = <div className='x'>{b}</div>;", "tsx");
    expect(line.some(t => t.type === "tag")).toBe(true);
  });
});
