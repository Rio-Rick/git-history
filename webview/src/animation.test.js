import {
  fullAnimation,
  planAnimation,
  animateLines,
  STATIC_STYLE
} from "./animation";
import {
  computeOffsets,
  lowerBound,
  upperBound,
  getScrollTop,
  getScrollTopFromOffsets
} from "./utils";

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function randomLines(rand, n) {
  const lines = [];
  while (lines.length < n) {
    const left = rand() < 0.8;
    const middle = rand() < 0.8;
    const right = rand() < 0.8;
    if (left || middle || right) lines.push({ left, middle, right });
  }
  return lines;
}

describe("animation", () => {
  test("gives exactly the same styles as running the whole animation", () => {
    const rand = seeded(42);
    for (let round = 0; round < 40; round++) {
      const lines = randomLines(rand, 5 + Math.floor(rand() * 60));
      const plan = planAnimation(lines);
      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        expect(animateLines(t, plan)).toEqual(fullAnimation(t, lines));
      }
    }
  });

  test("lines that do not move share one style and are not animated", () => {
    const lines = [
      { left: true, middle: true, right: true },
      { left: false, middle: true, right: true },
      { left: true, middle: true, right: true }
    ];
    const plan = planAnimation(lines);
    expect(plan.animated.length).toBe(1);
    const styles = animateLines(0.3, plan);
    expect(styles[0]).toBe(STATIC_STYLE);
    expect(styles[2]).toBe(STATIC_STYLE);
    expect(styles[1]).not.toBe(STATIC_STYLE);
  });

  test("works with a version where nothing changes", () => {
    const lines = [{ left: true, middle: true, right: true }];
    expect(animateLines(0.5, planAnimation(lines))).toEqual([STATIC_STYLE]);
    expect(animateLines(0.5, planAnimation([]))).toEqual([]);
  });
});

describe("offsets", () => {
  const heights = [15, 0, 15, 15, 0, 0, 15];
  const offsets = computeOffsets(heights);

  test("computeOffsets", () => {
    expect(offsets).toEqual([0, 15, 15, 30, 45, 45, 45, 60]);
  });

  test("lowerBound and upperBound", () => {
    expect(lowerBound(offsets, 0)).toBe(0);
    expect(lowerBound(offsets, 15)).toBe(1);
    expect(upperBound(offsets, 15)).toBe(3);
    expect(lowerBound(offsets, 46)).toBe(7);
    expect(upperBound(offsets, 1000)).toBe(8);
  });

  test("getScrollTop did not change its result", () => {
    const area = { start: 2, end: 3 };
    // the old implementation, for reference
    const sum = a => a.reduce((x, y) => x + y, 0);
    const old = (area, content, container, hs) => {
      const start = sum(hs.slice(0, area.start));
      const end = start + sum(hs.slice(area.start, area.end + 1));
      const middle = (end + start) / 2;
      const best = end - start > container ? start : middle - container / 2;
      if (best < 0) return 0;
      if (best + container > content) return content - container;
      return best;
    };
    [10, 20, 40, 100].forEach(container => {
      [
        { start: 0, end: 0 },
        { start: 2, end: 3 },
        { start: 6, end: 6 },
        { start: 0, end: 6 }
      ].forEach(a => {
        expect(getScrollTop(a, 60, container, heights)).toBe(
          old(a, 60, container, heights)
        );
        expect(getScrollTopFromOffsets(a, offsets, container)).toBe(
          old(a, 60, container, heights)
        );
      });
    });
  });
});

describe("animation (compared with the first implementation)", () => {
  // These styles were produced by the original JSX version of the animation
  test("gives the same styles as the original at every time", async () => {
    const golden = (await import("./fixtures/animation-golden.json")).default;
    const plan = planAnimation(golden.lines);
    golden.results.forEach(({ t, styles }) => {
      expect(JSON.parse(JSON.stringify(animateLines(t, plan)))).toEqual(styles);
    });
  });
});
