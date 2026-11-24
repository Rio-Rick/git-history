import { diffLines } from "diff";
import {
  getSlides,
  getChanges,
  resetSlidesCache,
  createSlidesBuilder,
  createSlidesCache,
  addRemovedHeaders
} from "./differ";

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

  test("can be processed one commit at a time", () => {
    const codes = makeHistory(12, 17);
    const builder = createSlidesBuilder(codes, "javascript");
    let steps = 0;
    let done = false;
    while (!done) {
      done = builder.step();
      steps++;
    }

    expect(steps).toBe(codes.length);
    expect(simple(builder.finish())).toEqual(refSlides(codes));
  });

  test("independent builders do not share mutable cache state", () => {
    const codes = makeHistory(21, 12);
    const cacheA = createSlidesCache();
    const cacheB = createSlidesCache();
    const builderA = createSlidesBuilder(codes, "javascript", cacheA);
    const builderB = createSlidesBuilder(codes, "javascript", cacheB);
    let doneA = false;
    let doneB = false;

    while (!doneA || !doneB) {
      if (!doneA) doneA = builderA.step();
      if (!doneB) doneB = builderB.step();
    }

    expect(simple(builderA.finish())).toEqual(refSlides(codes));
    expect(simple(builderB.finish())).toEqual(refSlides(codes));
  });

  test("continues incrementally after a previous page was built", () => {
    const codes = makeHistory(13, 18);
    getSlides(codes.slice(0, 7), "javascript");
    const builder = createSlidesBuilder(codes, "javascript");
    let done = false;
    while (!done) done = builder.step();
    expect(simple(builder.finish())).toEqual(refSlides(codes));
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

describe("removed lines are changes too", () => {
  // newest first, like the app asks for them
  const slidesOf = (...codes) => getSlides(codes, "javascript");
  const changesOf = (...codes) => getChanges(slidesOf(...codes)[0]);

  test("a commit that only deletes lines has a change (kind removed)", () => {
    const changes = changesOf("a\nb\nd\n", "a\nb\nc\nd\n");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "removed", added: 0, removed: 1 });
  });

  test("a commit that only adds lines is still an added change", () => {
    const changes = changesOf("a\nb\nc\n", "a\nc\n");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "added", added: 1, removed: 0 });
  });

  test("a replaced block is one modified change", () => {
    const changes = changesOf("a\nX\nY\nZ\nd\n", "a\nb\nc\nd\n");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "modified",
      added: 3,
      removed: 2
    });
  });

  test("separate deletions are separate changes", () => {
    const changes = changesOf("a\nc\ne\n", "a\nb\nc\nd\ne\n");
    expect(changes.map(c => c.kind)).toEqual(["removed", "removed"]);
  });

  test("deleting the file removes every line", () => {
    const slide = slidesOf("", "a\nb\nc\n")[0];
    expect(slide.some(l => l.middle)).toBe(false);
    const changes = getChanges(slide);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "removed", removed: 3 });
  });

  test("the first version has nothing removed", () => {
    const slides = slidesOf("a\nb\n");
    expect(getChanges(slides[0])).toEqual([
      expect.objectContaining({ kind: "added", added: 2, removed: 0 })
    ]);
  });

  [1, 2, 3, 4, 5].forEach(seed => {
    test(`the counts match the lines of every version (seed ${seed})`, () => {
      const slides = getSlides(makeHistory(seed, 14), "javascript");
      slides.forEach(slide => {
        const changes = getChanges(slide);
        const added = slide.filter(l => !l.left && l.middle).length;
        const removed = slide.filter(l => l.left && !l.middle).length;
        expect(changes.reduce((n, c) => n + c.added, 0)).toBe(added);
        expect(changes.reduce((n, c) => n + c.removed, 0)).toBe(removed);
        // changes do not overlap and are in order
        changes.forEach((c, i) => {
          expect(c.start).toBeLessThanOrEqual(c.end);
          if (i > 0) expect(c.start).toBeGreaterThan(changes[i - 1].end);
        });
      });
    });
  });
});

describe("addRemovedHeaders", () => {
  const slideOf = (...codes) => getSlides(codes, "javascript")[0];

  test("gives the same lines and changes when nothing was removed", () => {
    const slide = slideOf("a\nb\nc\n", "a\nc\n");
    const changes = getChanges(slide);
    const view = addRemovedHeaders(slide, changes);
    expect(view.lines).toBe(slide);
    expect(view.changes).toBe(changes);
    expect(view.headers).toEqual([]);
  });

  test("puts a header in front of the removed lines", () => {
    const slide = slideOf("a\nb\nd\ne\n", "a\nb\nc\nc2\nd\ne\n");
    const view = addRemovedHeaders(slide, getChanges(slide));
    expect(view.lines).toHaveLength(slide.length + 1);
    expect(view.headers).toHaveLength(1);

    const [change] = view.changes;
    const header = view.lines[change.header];
    expect(header).toMatchObject({ removedHeader: true, count: 2 });
    expect(header.middle).toBe(false);
    // the header is the first row of the change, the removed rows follow it
    expect(change.start).toBe(change.header);
    expect(view.lines[change.header + 1]).toMatchObject({
      content: "c",
      left: true,
      middle: false
    });
    expect(view.lines[change.end]).toMatchObject({ content: "c2" });
  });

  test("a modified change has the header before the removed lines and the added ones after", () => {
    const slide = slideOf("a\nX\nd\n", "a\nb\nc\nd\n");
    const view = addRemovedHeaders(slide, getChanges(slide));
    const [change] = view.changes;
    const rows = view.lines.slice(change.start, change.end + 1);
    expect(rows.map(r => r.content)).toEqual(["", "b", "c", "X"]);
    expect(rows[0].removedHeader).toBe(true);
  });

  test("moves the next changes by the headers that are before them", () => {
    // removes "b" and "d", adds "f"
    const slide = slideOf("a\nc\ne\nf\n", "a\nb\nc\nd\ne\n");
    const changes = getChanges(slide);
    const view = addRemovedHeaders(slide, changes);
    expect(changes.map(c => c.kind)).toEqual(["removed", "removed", "added"]);
    expect(view.headers).toHaveLength(2);
    expect(view.lines).toHaveLength(slide.length + 2);

    view.changes.forEach((change, i) => {
      const original = changes[i];
      const rows = view.lines.slice(change.start, change.end + 1);
      expect(rows.filter(r => r.removedHeader)).toHaveLength(
        original.removed ? 1 : 0
      );
      expect(rows.length).toBe(
        original.end - original.start + 1 + (original.removed ? 1 : 0)
      );
    });
    expect(view.changes[2].header).toBe(-1);
    // every header sits right before its first removed line
    view.headers.forEach(h => {
      expect(view.lines[h + 1].left && !view.lines[h + 1].middle).toBe(true);
    });
  });

  test("the headers have unique keys", () => {
    const slides = getSlides(makeHistory(3, 14), "javascript");
    slides.forEach(slide => {
      const view = addRemovedHeaders(slide, getChanges(slide));
      const keys = view.lines.map(l => l.key);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });
});
