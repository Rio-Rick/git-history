import { findRanges, findMatches, splitTokens } from "./search";

describe("findRanges", () => {
  test("is case insensitive and finds every occurrence", () => {
    expect(findRanges("Foo foo FOO", "foo")).toEqual([
      [0, 3],
      [4, 7],
      [8, 11]
    ]);
  });
  test("can match the case", () => {
    expect(findRanges("Foo foo FOO", "foo", true)).toEqual([[4, 7]]);
  });
  test("returns nothing for an empty query", () => {
    expect(findRanges("abc", "")).toEqual([]);
  });
});

describe("findMatches", () => {
  const line = (text, middle = true) => ({
    middle,
    tokens: [{ type: "plain", content: text }]
  });
  test("only looks at lines of the current version", () => {
    const lines = [line("const a"), line("const b", false), line("let c")];
    expect(findMatches(lines, "const")).toEqual([0]);
  });
});

describe("splitTokens", () => {
  test("splits a match that spans several tokens", () => {
    const tokens = [
      { type: "keyword", content: "const" },
      { type: "plain", content: " value" }
    ];
    const result = splitTokens(tokens, [[3, 8]]);
    expect(result.map(t => [t.content, t.hit])).toEqual([
      ["con", false],
      ["st", true],
      [" va", true],
      ["lue", false]
    ]);
  });
  test("keeps tokens untouched when there is no match", () => {
    const tokens = [{ type: "plain", content: "abc" }];
    expect(splitTokens(tokens, []).map(t => t.content)).toEqual(["abc"]);
  });
});
