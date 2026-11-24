import React, { useCallback, useEffect, useMemo, useState } from "react";
import { planAnimation, animateLines } from "./animation";
import { addRemovedHeaders } from "./lib/differ";
import theme from "./night-owl";
import Scroller from "./scroller";
import usePersistentState from "./use-persistent-state";
import { useHelp, HelpDialog } from "./help";
import {
  useSearch,
  SearchBar,
  findRanges,
  lineText,
  splitTokens
} from "./search";
import "./removed.css";

const themeStylesByType = Object.create(null);
theme.styles.forEach(({ types, style }) => {
  types.forEach(type => {
    themeStylesByType[type] = Object.assign(
      themeStylesByType[type] || {},
      style
    );
  });
});

const ROW_HEIGHT = 15;

// Lines removed by a version are not part of it, so once the version is
// settled they take no room, unless the person opens them.
const HIDDEN_STYLE = Object.freeze({ height: 0, opacity: 0 });
const HEADER_STYLE = Object.freeze({ height: ROW_HEIGHT, opacity: 1 });
const REMOVED_STYLE = Object.freeze({ height: ROW_HEIGHT, opacity: 0.9 });
const NO_KEYS = new Set();

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// A row is only drawn again when something that is shown in it changes:
// scrolling or typing in the search box does not redraw the whole page.
const Row = React.memo(function Row({
  line,
  style,
  query,
  matchCase,
  active,
  lineNo,
  digits,
  removed
}) {
  const ranges =
    query && line.middle && line.tokens.length
      ? findRanges(lineText(line), query, matchCase)
      : [];
  const tokens = ranges.length ? splitTokens(line.tokens, ranges) : line.tokens;
  const hitClass = active ? "search-hit search-hit-active" : "search-hit";
  return (
    <div
      className={removed ? "removed-line" : undefined}
      style={Object.assign(
        {
          overflow: "hidden",
          height: ROW_HEIGHT + "px",
          width: "max-content",
          minWidth: "100%"
        },
        style
      )}
    >
      <span className="line-no" style={{ width: digits + "ch" }}>
        {lineNo || (removed ? "−" : "")}
      </span>
      {!line.tokens.length && <br />}
      {tokens.map((token, i) => {
        const style = themeStylesByType[token.type] || {};
        return (
          <span
            style={style}
            className={token.hit ? hitClass : undefined}
            key={i}
          >
            {token.content}
          </span>
        );
      })}
    </div>
  );
});

// "3 lines removed": the place where lines were deleted. Click to see them.
const RemovedHeader = React.memo(function RemovedHeader({
  line,
  style,
  open,
  whole,
  digits,
  onToggle
}) {
  const label = whole
    ? `All ${plural(line.count, "line")} removed in this commit`
    : `${plural(line.count, "line")} removed`;
  return (
    <div
      className="removed-header"
      style={Object.assign(
        {
          height: ROW_HEIGHT + "px",
          paddingLeft: `calc(${digits}ch + 1.4ch)`
        },
        style
      )}
    >
      {whole ? (
        <span className="removed-label">− {label}</span>
      ) : (
        <button
          type="button"
          className="removed-toggle"
          aria-expanded={open}
          title={open ? "Hide the removed lines" : "Show the removed lines"}
          onClick={() => onToggle(line.key)}
        >
          <span className="removed-caret">{open ? "▾" : "▸"}</span>− {label}
        </button>
      )}
    </div>
  );
});

// Number of every line in its version (0 for the ones that are not in it)
function useLineNumbers(lines) {
  return useMemo(() => {
    let count = 0;
    const numbers = lines.map(line => (line.middle ? ++count : 0));
    return { numbers, digits: String(count).length };
  }, [lines]);
}

// Positions (0 to 1) of changes and search matches along the file
function useMarkers(lines, changes, matches) {
  return useMemo(() => {
    const before = [0];
    lines.forEach((l, i) => before.push(before[i] + (l.middle ? 1 : 0)));
    const total = before[lines.length] || 1;
    return {
      changes: changes.map(c => ({
        top: before[c.start] / total,
        height: (before[c.end + 1] - before[c.start]) / total,
        kind: c.kind || "added",
        added: c.added || 0,
        removed: c.removed || 0
      })),
      matches: matches.map(row => before[row] / total)
    };
  }, [lines, changes, matches]);
}

function Slide({
  lines,
  styles,
  changes,
  search,
  settled,
  stats,
  showRemoved,
  onToggleShowRemoved,
  isOpen,
  forceOpen,
  onToggleHeader
}) {
  const heights = useMemo(
    () =>
      styles.map(style => (style.height != null ? style.height : ROW_HEIGHT)),
    [styles]
  );
  const markers = useMarkers(lines, changes, search.matches);
  const { numbers, digits } = useLineNumbers(lines);
  const help = useHelp();
  const [autoJump, setAutoJump] = usePersistentState(
    "git-history:auto-jump",
    true
  );

  // When a version is on screen and it stopped moving, go to its closest
  // change (unless the person is looking at search results)
  const [jumpRequest, setJumpRequest] = useState(null);
  const searching = !!search.query;
  useEffect(() => {
    if (settled && autoJump && !searching) {
      setJumpRequest({});
    }
  }, [lines, settled, autoJump]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderRow = (line, i) =>
    line.removedHeader ? (
      <RemovedHeader
        key={line.key}
        line={line}
        style={styles[i]}
        open={forceOpen || isOpen(line.key)}
        whole={forceOpen}
        digits={digits}
        onToggle={onToggleHeader}
      />
    ) : (
      <Row
        key={line.key}
        line={line}
        style={styles[i]}
        query={search.query}
        matchCase={search.matchCase}
        active={i === search.activeRow}
        lineNo={numbers[i]}
        digits={digits}
        removed={line.left && !line.middle}
      />
    );

  return (
    <React.Fragment>
      {search.open && (
        <SearchBar
          query={search.query}
          matchCase={search.matchCase}
          onToggleMatchCase={search.toggleMatchCase}
          total={search.matches.length}
          current={search.current}
          focusToken={search.focusToken}
          onChange={search.changeQuery}
          onNext={search.next}
          onPrev={search.prev}
          onClose={search.close}
        />
      )}
      {help.open && <HelpDialog onClose={help.hide} />}
      <pre
        style={{
          backgroundColor: theme.plain.backgroundColor,
          color: theme.plain.color,
          paddingTop: "100px",
          margin: 0,
          height: "100%",
          width: "100%",
          boxSizing: "border-box"
        }}
      >
        <Scroller
          items={lines}
          heights={heights}
          renderRow={renderRow}
          snapAreas={changes}
          focusRow={search.focus}
          jumpRequest={jumpRequest}
          markers={markers}
          onOpenSearch={search.openSearch}
          onOpenHelp={help.show}
          autoJump={autoJump}
          onToggleAutoJump={() => setAutoJump(!autoJump)}
          stats={stats}
          showRemoved={showRemoved}
          onToggleShowRemoved={onToggleShowRemoved}
        />
      </pre>
    </React.Fragment>
  );
}

export default function SlideWrapper({ time, version }) {
  const { lines: versionLines, changes: versionChanges } = version;

  // Lines removed by this version get a header so they can be shown
  const view = useMemo(
    () => addRemovedHeaders(versionLines, versionChanges),
    [versionLines, versionChanges]
  );
  const { lines, changes, headers } = view;

  // Most lines do not move: only the ones that enter or leave are animated
  const plan = useMemo(() => planAnimation(lines), [lines]);
  const t = (time + 1) / 2;
  const settled = time === 0;

  // Removed lines are hidden unless the person opens them: all of them with
  // the button, or one place at a time by clicking its header. The clicks
  // are forgotten when another version is shown.
  const [showRemoved, setShowRemoved] = usePersistentState(
    "git-history:show-removed",
    false
  );
  const [toggled, setToggled] = useState({ lines: null, keys: NO_KEYS });
  const toggledKeys = toggled.lines === versionLines ? toggled.keys : NO_KEYS;
  const onToggleHeader = useCallback(
    key =>
      setToggled(old => {
        const keys = new Set(old.lines === versionLines ? old.keys : NO_KEYS);
        if (keys.has(key)) keys.delete(key);
        else keys.add(key);
        return { lines: versionLines, keys };
      }),
    [versionLines]
  );
  const isOpen = useCallback(
    key => showRemoved !== toggledKeys.has(key),
    [showRemoved, toggledKeys]
  );

  // When the version has nothing left (the file was emptied or deleted) a
  // closed list would be an empty page, so the removed lines are shown.
  const forceOpen = useMemo(
    () => headers.length > 0 && !lines.some(line => line.middle),
    [headers, lines]
  );

  const styles = useMemo(() => {
    const result = animateLines(t, plan);
    if (!headers.length) return result;
    if (!settled) {
      // While it moves the removed lines follow the animation; the headers
      // are not part of it
      headers.forEach(h => {
        result[h] = HIDDEN_STYLE;
      });
      return result;
    }
    changes.forEach(change => {
      if (change.header < 0) return;
      const open = forceOpen || isOpen(lines[change.header].key);
      result[change.header] = HEADER_STYLE;
      for (let i = change.header + 1; i <= change.end; i++) {
        if (lines[i].left && !lines[i].middle) {
          result[i] = open ? REMOVED_STYLE : HIDDEN_STYLE;
        }
      }
    });
    return result;
  }, [t, plan, settled, headers, changes, lines, forceOpen, isOpen]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    changes.forEach(change => {
      added += change.added || 0;
      removed += change.removed || 0;
    });
    return { added, removed };
  }, [changes]);

  const search = useSearch(lines);
  return (
    <Slide
      lines={lines}
      styles={styles}
      changes={changes}
      search={search}
      settled={settled}
      stats={stats}
      showRemoved={showRemoved}
      onToggleShowRemoved={() => setShowRemoved(!showRemoved)}
      isOpen={isOpen}
      forceOpen={forceOpen}
      onToggleHeader={onToggleHeader}
    />
  );
}
