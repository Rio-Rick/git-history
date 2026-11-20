import React, { useEffect, useMemo, useRef, useState } from "react";
import { isTyping } from "./utils";
import "./search.css";

export function lineText(line) {
  return line.tokens.map(t => t.content).join("");
}

// Non-overlapping [start, end) ranges of query in text
export function findRanges(text, query, matchCase = false) {
  const ranges = [];
  if (!query) return ranges;
  const haystack = matchCase ? text : text.toLowerCase();
  const needle = matchCase ? query : query.toLowerCase();
  let from = 0;
  let index;
  while ((index = haystack.indexOf(needle, from)) !== -1) {
    ranges.push([index, index + needle.length]);
    from = index + needle.length;
  }
  return ranges;
}

// Indexes (in `lines`) of the lines of the current version that contain query
export function findMatches(lines, query, matchCase = false) {
  if (!query) return [];
  const matches = [];
  lines.forEach((line, i) => {
    if (
      line.middle &&
      line.tokens &&
      findRanges(lineText(line), query, matchCase).length
    ) {
      matches.push(i);
    }
  });
  return matches;
}

// Split tokens so that every piece is either fully inside or outside a range
export function splitTokens(tokens, ranges) {
  const out = [];
  let pos = 0;
  tokens.forEach(token => {
    const start = pos;
    const end = pos + token.content.length;
    pos = end;
    let cursor = start;
    ranges.forEach(([rangeStart, rangeEnd]) => {
      if (rangeEnd <= cursor || rangeStart >= end) return;
      const s = Math.max(rangeStart, cursor);
      const e = Math.min(rangeEnd, end);
      if (s > cursor) {
        out.push({
          ...token,
          content: token.content.slice(cursor - start, s - start),
          hit: false
        });
      }
      out.push({
        ...token,
        content: token.content.slice(s - start, e - start),
        hit: true
      });
      cursor = e;
    });
    if (cursor < end) {
      out.push({
        ...token,
        content: token.content.slice(cursor - start),
        hit: false
      });
    }
  });
  return out;
}

export function useSearch(lines) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [focus, setFocus] = useState(null);
  const [focusToken, setFocusToken] = useState(0);
  const idRef = useRef(0);

  const matches = useMemo(
    () => findMatches(lines, query, matchCase),
    [lines, query, matchCase]
  );
  const safeCursor = matches.length ? Math.min(cursor, matches.length - 1) : 0;
  const activeRow = matches.length ? matches[safeCursor] : null;

  const scrollTo = row => setFocus({ row, id: ++idRef.current });

  const jump = delta => {
    if (!matches.length) return;
    const next = (safeCursor + delta + matches.length) % matches.length;
    setCursor(next);
    scrollTo(matches[next]);
  };

  const changeQuery = value => {
    setQuery(value);
    setCursor(0);
  };

  // Go to the first match whenever the search changes
  useEffect(() => {
    if (query && matches.length) {
      setCursor(0);
      scrollTo(matches[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, matchCase]);

  const openSearch = () => {
    setOpen(true);
    setFocusToken(t => t + 1);
  };

  const close = () => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  };

  // The listener is added only once, it always calls the latest functions
  const latest = useRef();
  latest.current = { open, openSearch, close };
  useEffect(() => {
    const onKeyDown = e => {
      const { open, openSearch, close } = latest.current;
      const isFind =
        (e.ctrlKey || e.metaKey) && e.key && e.key.toLowerCase() === "f";
      const isSlash = e.key === "/" && !isTyping(e);
      if (isFind || isSlash) {
        e.preventDefault();
        openSearch();
      } else if (e.key === "Escape" && open) {
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    open,
    query,
    matchCase,
    toggleMatchCase: () => setMatchCase(m => !m),
    matches,
    activeRow,
    current: matches.length ? safeCursor + 1 : 0,
    focus,
    focusToken,
    changeQuery,
    openSearch,
    close,
    next: () => jump(1),
    prev: () => jump(-1)
  };
}

export function SearchBar({
  query,
  matchCase,
  onToggleMatchCase,
  total,
  current,
  focusToken,
  onChange,
  onNext,
  onPrev,
  onClose
}) {
  const inputRef = useRef();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [focusToken]);

  const onKeyDown = e => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.shiftKey ? onPrev() : onNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const status = !query ? "" : total ? `${current} / ${total}` : "No results";

  return (
    <div className="search-bar">
      <input
        ref={inputRef}
        value={query}
        placeholder="Search in this version…"
        spellCheck={false}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        className={"search-case" + (matchCase ? " on" : "")}
        title="Match case"
        aria-pressed={!!matchCase}
        onClick={onToggleMatchCase}
      >
        Aa
      </button>
      <span className="search-status">{status}</span>
      <button title="Previous match (Shift+Enter)" onClick={onPrev}>
        ▲
      </button>
      <button title="Next match (Enter)" onClick={onNext}>
        ▼
      </button>
      <button title="Close (Esc)" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}
