import { diffLines } from "diff";
import { getSlides, getChanges, resetSlidesCache } from "./differ";

// ---- The original (slow) implementation, kept as a reference ----
const newlineRe = /\r\n|\r|\n/;
function refDiff(oldCode, newCode) {
  const changes = diffLines(oldCode || "", newCode);
  let oldIndex = -1;
  return changes.map(({ value, count, removed, added }) => {
    const lines = value.split(newlineRe);
    const lastLine = lines.pop();
    if (lastLine) lines.push(lastLine);
    const result = { oldIndex, lines, count, removed, added };
    if (!added) oldIndex += count;
    return result;
  });
}
function refSlides(codes) {
  const lines = [];
  codes.forEach((_, slideIndex) => {
    const prevLines = lines.filter(l => l.slides.includes(slideIndex - 1));
    const changes = refDiff(codes[slideIndex - 1] || "", codes[slideIndex]);
    changes.forEach(change => {
      if (change.added) {
        const at = lines.indexOf(prevLines[change.oldIndex]) + 1;
        lines.splice(
          at,
          0,
          ...change.lines.map(content => ({ content, slides: [slideIndex] }))
        );
      } else if (!change.removed) {
        for (let j = 1; j <= change.count; j++) {
          prevLines[change.oldIndex + j].slides.push(slideIndex);
        }
      }
    });
  });
  return codes.map((_, slideIndex) =>
    lines
      .map(line => ({
        content: line.content,
        left: line.slides.includes(slideIndex + 1),
        middle: line.slides.includes(slideIndex),
        right: line.slides.includes(slideIndex - 1)
      }))
      .filter(l => l.left || l.middle || l.right)
  );
}
// -----------------------------------------------------------------

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeHistory(seed, versions) {
  const rand = seeded(seed);
  let lines = Array.from({ length: 30 }, (_, i) => `const value${i} = ${i};`);
  const codes = [];
  for (let v = 0; v < versions; v++) {
    const edits = 1 + Math.floor(rand() * 5);
    for (let e = 0; e < edits; e++) {
      const p = Math.floor(rand() * lines.length);
      const op = rand();
      if (op < 0.4) lines[p] = lines[p] + ` // v${v}`;
      else if (op < 0.7) lines.splice(p, 0, `added(${v}, ${p});`);
      else lines.splice(p, 1 + Math.floor(rand() * 2));
    }
    codes.push(lines.join("\n") + "\n");
  }
  return codes.reverse(); // newest first
}

const simple = slides =>
  slides.map(s =>
    s.map(({ content, left, middle, right }) => ({
      content,
      left,
      middle,
      right
    }))
  );

beforeEach(() => resetSlidesCache());

describe("getSlides", () => {
  [1, 2, 3, 4, 5].forEach(seed => {
    test(`same result as the original implementation (seed ${seed})`, () => {
      const codes = makeHistory(seed, 14);
      expect(simple(getSlides(codes, "javascript"))).toEqual(refSlides(codes));
    });

    test(`loading more commits step by step gives the same result (seed ${seed})`, () => {
      const codes = makeHistory(seed, 15);
      getSlides(codes.slice(0, 5), "javascript");
      getSlides(codes.slice(0, 9), "javascript");
      const result = getSlides(codes, "javascript");
      expect(simple(result)).toEqual(refSlides(codes));
      result.forEach(slide => {
        const keys = slide.map(l => l.key);
        expect(new Set(keys).size).toBe(keys.length);
      });
    });
  });

  test("keeps the slides it already built (same identity)", () => {
    const codes = makeHistory(9, 12);
    const first = getSlides(codes.slice(0, 8), "javascript");
    const second = getSlides(codes, "javascript");
    // all but the last one (its older neighbour is new) are reused
    for (let i = 0; i < 7; i++) expect(second[i]).toBe(first[i]);
    expect(second[7]).not.toBe(first[7]);
  });

  test("starts over when the history is a different one", () => {
    const a = makeHistory(1, 8);
    const b = makeHistory(2, 8);
    getSlides(a, "javascript");
    expect(simple(getSlides(b, "javascript"))).toEqual(refSlides(b));
  });

  test("has tokens for every line of the version", () => {
    const codes = makeHistory(3, 6);
    getSlides(codes, "javascript").forEach(slide =>
      slide
        .filter(l => l.middle)
        .forEach(l => expect(l.tokens.length).toBeGreaterThan(0))
    );
  });
});

describe("getChanges", () => {
  test("is cached per slide", () => {
    const slide = getSlides(makeHistory(4, 5), "javascript")[0];
    expect(getChanges(slide)).toBe(getChanges(slide));
  });
});
