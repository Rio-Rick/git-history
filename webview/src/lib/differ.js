import { diffLines } from "diff";
import tokenize from "./tokenizer.js";
import { tokenizeIncremental } from "./incremental-tokenizer.js";
const newlineRe = /\r\n|\r|\n/;

function myDiff(oldCode, newCode, changes = diffLines(oldCode || "", newCode)) {
  let oldIndex = -1;
  return changes.map(({ value, count, removed, added }) => {
    const lines = value.split(newlineRe);
    // check if last line is empty, if it is, remove it
    const lastLine = lines.pop();
    if (lastLine) {
      lines.push(lastLine);
    }
    const result = {
      oldIndex,
      lines,
      count,
      removed,
      added
    };
    if (!added) {
      oldIndex += count;
    }
    return result;
  });
}

function insert(array, index, elements) {
  return array.splice(index, 0, ...elements);
}

// A line lives in a contiguous range of slides, so instead of keeping a list
// of slide indexes per line (and calling includes() on it, which made the
// whole thing quadratic) we only keep the first and the last one.
function isIn(line, slideIndex) {
  return line.first <= slideIndex && slideIndex <= line.last;
}

function slideDiff(lines, codes, slideIndex, language, state) {
  const prevLines = lines.filter(l => isIn(l, slideIndex - 1));
  const prevCode = codes[slideIndex - 1] || "";
  const currCode = codes[slideIndex];

  const rawChanges = diffLines(prevCode, currCode);
  const changes = myDiff(prevCode, currCode, rawChanges);

  changes.forEach(change => {
    if (change.added) {
      const prevLine = prevLines[change.oldIndex];
      const addAtIndex = lines.indexOf(prevLine) + 1;
      const addLines = change.lines.map(content => ({
        content,
        first: slideIndex,
        last: slideIndex
      }));
      insert(lines, addAtIndex, addLines);
    } else if (!change.removed) {
      for (let j = 1; j <= change.count; j++) {
        prevLines[change.oldIndex + j].last = slideIndex;
      }
    }
  });

  const tokenLines =
    (slideIndex > 0 &&
      tokenizeIncremental(state.tokenLines, rawChanges, currCode, language)) ||
    tokenize(currCode, language);
  // Every version keeps the tokens of its own code
  state.tokenLines = tokenLines;
  state.allTokens[slideIndex] = tokenLines;
}

// The position of a line in the code of a version is its position among the
// lines that belong to that version, so we count them while we go through
// all the lines.
function buildSlide(lines, slideIndex, allTokens) {
  const slide = [];
  const leftTokens = allTokens[slideIndex + 1];
  const middleTokens = allTokens[slideIndex];
  const rightTokens = allTokens[slideIndex - 1];
  let leftPos = 0;
  let middlePos = 0;
  let rightPos = 0;
  lines.forEach((line, lineIndex) => {
    const left = isIn(line, slideIndex + 1);
    const middle = isIn(line, slideIndex);
    const right = isIn(line, slideIndex - 1);
    let tokens;
    if (middle) tokens = middleTokens[middlePos];
    else if (left) tokens = leftTokens[leftPos];
    else if (right) tokens = rightTokens[rightPos];
    if (left) leftPos++;
    if (middle) middlePos++;
    if (right) rightPos++;
    if (left || middle || right) {
      slide.push({
        content: line.content,
        tokens,
        left,
        middle,
        right,
        key: lineIndex
      });
    }
  });
  return slide;
}

// The app asks for more commits again and again (10, 20, 30...) and each
// time the new list starts with the same commits as the previous one (the
// new ones are older, so they go at the end). Instead of diffing and
// tokenizing the whole history every time we keep what we already computed
// and only process the new commits.
const defaultSlidesCache = { current: null };

export function createSlidesCache() {
  return { current: null };
}

function startsWith(codes, prefix) {
  if (prefix.length > codes.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (codes[i] !== prefix[i]) return false;
  }
  return true;
}

export function resetSlidesCache(slidesCache = defaultSlidesCache) {
  slidesCache.current = null;
}

// Returns a function that processes one more commit each time it is called
// and returns true when there is nothing left to do. It lets callers yield
// to the UI between commits.
export function createSlidesBuilder(
  codes,
  language,
  slidesCache = defaultSlidesCache
) {
  let cache = slidesCache.current;
  if (
    !cache ||
    cache.language !== language ||
    !startsWith(codes, cache.codes)
  ) {
    cache = {
      language,
      codes: [],
      lines: [],
      slides: [],
      tokenState: { tokenLines: null, allTokens: [] }
    };
    slidesCache.current = cache;
  }
  const c = cache;
  const done = c.codes.length;
  let next = done;
  function step() {
    if (next < codes.length) {
      const slideIndex = next;
      slideDiff(c.lines, codes, slideIndex, language, c.tokenState);
      next++;

      // A slide needs its newer and older neighbours' token lines. Once the
      // next commit is processed, the previous slide can be finalized.
      if (slideIndex > 0) {
        c.slides[slideIndex - 1] = buildSlide(
          c.lines,
          slideIndex - 1,
          c.tokenState.allTokens
        );
      }

      // The oldest slide has no older neighbour, so it can be finalized last.
      if (next === codes.length && codes.length > 0) {
        c.slides[codes.length - 1] = buildSlide(
          c.lines,
          codes.length - 1,
          c.tokenState.allTokens
        );
      }
    }
    return next >= codes.length;
  }

  function finish() {
    while (next < codes.length) step();
    c.codes = codes.slice();
    c.slides.length = codes.length;
    return c.slides.slice();
  }

  return { step, finish };
}

export function getSlides(codes, language) {
  // codes are in reverse cronological order
  return createSlidesBuilder(codes, language).finish();
}

const changesCache = new WeakMap();

export function getChanges(lines) {
  let changes = changesCache.get(lines);
  if (!changes) {
    changes = computeChanges(lines);
    changesCache.set(lines, changes);
  }
  return changes;
}

// A change is a run of lines that were added or removed by this version,
// without any line that stayed the same in between.
//   added:   in this version, not in the older one   (!left && middle)
//   removed: in the older version, not in this one   (left && !middle)
// Lines that belong only to the newer version (!left && !middle) take no
// room in this one, so they do not split a change.
function computeChanges(lines) {
  const changes = [];
  let current = null;

  const close = () => {
    if (!current) return;
    current.kind =
      current.added && current.removed
        ? "modified"
        : current.removed
          ? "removed"
          : "added";
    changes.push(current);
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const { left, middle } = lines[i];
    const isAdded = !left && middle;
    const isRemoved = left && !middle;
    if (isAdded || isRemoved) {
      if (!current) {
        current = { start: i, end: i, added: 0, removed: 0, firstRemoved: -1 };
      }
      current.end = i;
      if (isAdded) {
        current.added++;
      } else {
        current.removed++;
        if (current.firstRemoved < 0) current.firstRemoved = i;
      }
    } else if (left || middle) {
      close();
    }
  }
  close();

  return changes;
}

// Removed lines are in `lines` (the animation needs them) but they take no
// room once the version is settled. To be able to show them, a header row
// ("3 lines removed") is put in front of the removed lines of every change
// that has some. Inside a change the removed lines go first and the added
// ones after them, like in any diff: what it was, then what it is now.
// Rows are renumbered, so the changes are returned again with their new
// positions; `header` is the position of the header (or -1).
export function addRemovedHeaders(lines, changes) {
  if (!changes.some(change => change.removed > 0)) {
    return { lines, changes, headers: [] };
  }

  const isRemoved = line => line.left && !line.middle;
  const out = [];
  const outChanges = [];
  const headers = [];
  let pos = 0;

  changes.forEach(change => {
    for (; pos < change.start; pos++) out.push(lines[pos]);
    const start = out.length;
    let header = -1;
    if (change.removed > 0) {
      header = out.length;
      headers.push(header);
      out.push({
        key: `removed-${lines[change.firstRemoved].key}`,
        content: "",
        tokens: [],
        left: false,
        middle: false,
        right: false,
        removedHeader: true,
        count: change.removed
      });
      for (let i = change.start; i <= change.end; i++) {
        if (isRemoved(lines[i])) out.push(lines[i]);
      }
    }
    for (let i = change.start; i <= change.end; i++) {
      if (!isRemoved(lines[i])) out.push(lines[i]);
    }
    pos = change.end + 1;
    outChanges.push({ ...change, start, end: out.length - 1, header });
  });
  for (; pos < lines.length; pos++) out.push(lines[pos]);

  return { lines: out, changes: outChanges, headers };
}
