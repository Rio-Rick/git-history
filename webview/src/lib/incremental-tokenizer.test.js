import { diffLines } from "diff";
import tokenize from "./tokenizer";
import { tokenizeIncremental } from "./incremental-tokenizer";
import { getSlides, resetSlidesCache } from "./differ";

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// lines that are hard for a tokenizer: they open or close multi line things
const TRICKY = [
  "/*",
  "*/",
  "`",
  "const t = `template",
  "end of template`;",
  "// just a comment",
  "const re = /ab+c/g;",
  "'unterminated",
  '"quoted string";',
  "{",
  "}",
  '<div className="x">',
  "  /* inline */ call();"
];

function makeCode(rand, lines) {
  return lines.map((l, i) => l).join("\n") + "\n";
}

function history(seed, versions, trickyRate) {
  const rand = seeded(seed);
  let lines = Array.from({ length: 80 }, (_, i) =>
    i % 9 === 0
      ? `function f${i}() {`
      : i % 9 === 8
        ? "}"
        : `  const v${i} = call(${i}, "x${i}");`
  );
  const codes = [];
  for (let v = 0; v < versions; v++) {
    const edits = 1 + Math.floor(rand() * 4);
    for (let e = 0; e < edits; e++) {
      const p = Math.floor(rand() * lines.length);
      const op = rand();
      const tricky = rand() < trickyRate;
      if (op < 0.35)
        lines[p] = tricky
          ? TRICKY[Math.floor(rand() * TRICKY.length)]
          : lines[p] + ` // v${v}`;
      else if (op < 0.7)
        lines.splice(
          p,
          0,
          tricky ? TRICKY[Math.floor(rand() * TRICKY.length)] : `added(${v});`
        );
      else lines.splice(p, 1 + Math.floor(rand() * 2));
    }
    codes.push(makeCode(rand, lines));
  }
  return codes;
}

let stats;
function check(codes, language = "javascript") {
  let prev = tokenize(codes[0], language);
  for (let i = 1; i < codes.length; i++) {
    const changes = diffLines(codes[i - 1], codes[i]);
    const full = tokenize(codes[i], language);
    const inc = tokenizeIncremental(prev, changes, codes[i], language);
    if (inc === null) {
      stats.fallback++;
    } else {
      stats.incremental++;
      const lineCount = codes[i].split("\n").length - 1;
      expect(inc.length).toBe(lineCount);
      for (let j = 0; j < lineCount; j++) expect(inc[j]).toEqual(full[j]);
    }
    prev = full;
  }
}

beforeEach(() => {
  stats = { incremental: 0, fallback: 0 };
  resetSlidesCache();
});

describe("tokenizeIncremental", () => {
  test("gives exactly the same tokens as tokenizing everything (normal edits)", () => {
    [1, 2, 3, 4, 5, 6].forEach(seed => check(history(seed, 25, 0)));
    // most of the time it should really be incremental
    expect(stats.incremental).toBeGreaterThan(stats.fallback * 4);
  });

  test("never returns wrong tokens for tricky edits (comments, templates, strings)", () => {
    for (let seed = 10; seed < 40; seed++) check(history(seed, 25, 0.6));
    expect(stats.incremental + stats.fallback).toBeGreaterThan(0);
  });

  test("falls back when a new comment swallows the lines below", () => {
    const base = Array.from({ length: 40 }, (_, i) => `const a${i} = ${i};`);
    const a = base.join("\n") + "\n";
    const withOpen = base.slice();
    withOpen.splice(10, 0, "/* oops");
    const b = withOpen.join("\n") + "\n";
    const prev = tokenize(a, "javascript");
    expect(
      tokenizeIncremental(prev, diffLines(a, b), b, "javascript")
    ).toBeNull();
  });

  test("falls back when a line that closed a comment is removed", () => {
    const lines = Array.from({ length: 40 }, (_, i) => `const a${i} = ${i};`);
    lines.splice(5, 0, "/* start");
    lines.splice(20, 0, "end */");
    const a = lines.join("\n") + "\n";
    const withoutEnd = lines.filter(l => l !== "end */");
    const b = withoutEnd.join("\n") + "\n";
    const prev = tokenize(a, "javascript");
    expect(
      tokenizeIncremental(prev, diffLines(a, b), b, "javascript")
    ).toBeNull();
  });

  test("is not used for files with Windows line endings", () => {
    const a = "const a = 1;\r\nconst b = 2;\r\n";
    expect(
      tokenizeIncremental(
        tokenize(a, "javascript"),
        diffLines(a, a),
        a,
        "javascript"
      )
    ).toBeNull();
  });
});

describe("getSlides with incremental tokens", () => {
  test("every line has the same tokens as a full tokenization of its version", () => {
    for (let seed = 50; seed < 58; seed++) {
      resetSlidesCache();
      const codes = history(seed, 20, 0.25).reverse(); // newest first
      const slides = getSlides(codes, "javascript");
      slides.forEach((slide, i) => {
        const full = tokenize(codes[i], "javascript");
        let index = 0;
        slide
          .filter(l => l.middle)
          .forEach(line => {
            expect(line.tokens).toEqual(full[index++]);
          });
      });
    }
  });
});
