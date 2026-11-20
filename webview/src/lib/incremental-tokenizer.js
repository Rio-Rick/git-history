import tokenize from "./tokenizer.js";

// Tokenizing a whole file with Prism is slow (~60ms for 2500 lines) and a
// commit usually changes only a few lines. So instead of tokenizing every
// version from scratch we reuse the tokens of the previous version for the
// lines that did not change, and tokenize again only the changed areas plus
// some lines around them.
//
// A change could alter the tokens of lines far away (for example a new `/*`
// or a backtick), so the lines around the changed area are used as a check:
// their tokens must be exactly the same as in the previous version. If they
// are not, we give up and the caller tokenizes the whole file.

const MIN_CONTEXT_LINES = 6; // non blank lines to check on each side
const MAX_CONTEXT_LINES = 40;

function isBlank(line) {
  return !line || line.trim() === "";
}

// Things that can start or end something that goes on over several lines.
// A line that has one without its other half can change the tokens of lines
// that are far from it, and then the lines around it are not a good check.
const SAME_DELIMITERS = ["`", "'''", '"""'];
const PAIR_DELIMITERS = [
  ["/*", "*/"],
  ["<!--", "-->"],
  ["(*", "*)"],
  ["{-", "-}"],
  ["--[[", "]]"],
  ["<script", "</script"],
  ["<style", "</style"],
  ["<?", "?>"],
  ["<%", "%>"],
  ["=begin", "=end"]
];

function count(text, part) {
  let n = 0;
  let at = text.indexOf(part);
  while (at !== -1) {
    n++;
    at = text.indexOf(part, at + part.length);
  }
  return n;
}

export function isRisky(line) {
  if (line.endsWith("\\")) return true; // line continuation
  if (SAME_DELIMITERS.some(d => count(line, d) % 2 === 1)) return true;
  return PAIR_DELIMITERS.some(
    ([open, close]) => count(line, open) !== count(line, close)
  );
}

function hasRiskyLines(changes) {
  return changes.some(
    change =>
      (change.added || change.removed) && change.value.split("\n").some(isRisky)
  );
}

function sameTokens(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].type !== b[i].type || a[i].content !== b[i].content) return false;
  }
  return true;
}

// Position in the new code of every line of the old one, -1 for new lines.
// Also returns the places where something changed.
export function mapLines(changes) {
  const newToOld = [];
  const touched = []; // [start, end] in new code, end = start - 1 for removals
  let oldPtr = 0;
  changes.forEach(change => {
    if (change.added) {
      const start = newToOld.length;
      for (let i = 0; i < change.count; i++) newToOld.push(-1);
      touched.push([start, newToOld.length - 1]);
    } else if (change.removed) {
      oldPtr += change.count;
      touched.push([newToOld.length, newToOld.length - 1]);
    } else {
      for (let i = 0; i < change.count; i++) newToOld.push(oldPtr++);
    }
  });
  return { newToOld, touched };
}

function mergeTouched(touched) {
  const merged = [];
  touched.forEach(([start, end]) => {
    const last = merged[merged.length - 1];
    if (last && start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  });
  return merged;
}

function contextBefore(codeLines, start) {
  let i = start - 1;
  let seen = 0;
  while (i >= 0 && seen < MIN_CONTEXT_LINES && start - i <= MAX_CONTEXT_LINES) {
    if (!isBlank(codeLines[i])) seen++;
    i--;
  }
  return { from: i + 1, enough: seen >= MIN_CONTEXT_LINES || i < 0 };
}

function contextAfter(codeLines, end) {
  let i = end + 1;
  let seen = 0;
  while (
    i < codeLines.length &&
    seen < MIN_CONTEXT_LINES &&
    i - end <= MAX_CONTEXT_LINES
  ) {
    if (!isBlank(codeLines[i])) seen++;
    i++;
  }
  return {
    to: i - 1,
    enough: seen >= MIN_CONTEXT_LINES || i >= codeLines.length
  };
}

// Returns an array with the tokens of every line, or null when it is not
// safe to do it incrementally.
export function tokenizeIncremental(prevTokenLines, changes, code, language) {
  if (!prevTokenLines || code.indexOf("\r") !== -1) return null;

  if (hasRiskyLines(changes)) return null;

  const codeLines = code.split("\n");
  if (codeLines[codeLines.length - 1] === "") codeLines.pop();

  const { newToOld, touched } = mapLines(changes);
  if (newToOld.length !== codeLines.length) return null;

  const result = new Array(codeLines.length);
  for (let i = 0; i < newToOld.length; i++) {
    if (newToOld[i] !== -1) {
      const tokens = prevTokenLines[newToOld[i]];
      if (!tokens) return null;
      result[i] = tokens;
    }
  }

  // Fresh lines of every changed area, to be filled in
  const areas = [];
  for (const [start, end] of mergeTouched(touched)) {
    const before = contextBefore(codeLines, start);
    const after = contextAfter(codeLines, end);
    if (!before.enough || !after.enough) return null;
    const last = areas[areas.length - 1];
    if (last && before.from <= last.to + 1) {
      // windows overlap: handle them as one
      last.to = after.to;
      last.end = end;
    } else {
      areas.push({ from: before.from, to: after.to, start, end });
    }
  }

  for (const area of areas) {
    const text = codeLines.slice(area.from, area.to + 1).join("\n");
    const windowLines = tokenize(text, language);
    const at = i => windowLines[i - area.from] || [];

    for (let i = area.from; i < area.start; i++) {
      if (!sameTokens(at(i), result[i])) return null;
    }
    for (let i = area.end + 1; i <= area.to; i++) {
      if (!sameTokens(at(i), result[i])) return null;
    }
    for (let i = area.start; i <= area.end; i++) {
      result[i] = at(i);
    }
  }

  return result;
}
