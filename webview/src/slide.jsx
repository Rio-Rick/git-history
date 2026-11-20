import React, { useEffect, useMemo, useState } from "react";
import { planAnimation, animateLines } from "./animation";
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

// A row is only drawn again when something that is shown in it changes:
// scrolling or typing in the search box does not redraw the whole page.
const Row = React.memo(function Row({
  line,
  style,
  query,
  matchCase,
  active,
  lineNo,
  digits
}) {
  const ranges =
    query && line.middle && line.tokens.length
      ? findRanges(lineText(line), query, matchCase)
      : [];
  const tokens = ranges.length ? splitTokens(line.tokens, ranges) : line.tokens;
  const hitClass = active ? "search-hit search-hit-active" : "search-hit";
  return (
    <div
      style={Object.assign(
        { overflow: "hidden", height: ROW_HEIGHT + "px" },
        style
      )}
    >
      <span className="line-no" style={{ width: digits + "ch" }}>
        {lineNo || ""}
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
        height: (before[c.end + 1] - before[c.start]) / total
      })),
      matches: matches.map(row => before[row] / total)
    };
  }, [lines, changes, matches]);
}

function Slide({ lines, styles, changes, search, settled }) {
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

  const renderRow = (line, i) => (
    <Row
      key={line.key}
      line={line}
      style={styles[i]}
      query={search.query}
      matchCase={search.matchCase}
      active={i === search.activeRow}
      lineNo={numbers[i]}
      digits={digits}
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
        />
      </pre>
    </React.Fragment>
  );
}

export default function SlideWrapper({ time, version }) {
  const { lines, changes } = version;
  // Most lines do not move: only the ones that enter or leave are animated
  const plan = useMemo(() => planAnimation(lines), [lines]);
  const t = (time + 1) / 2;
  const styles = useMemo(() => animateLines(t, plan), [t, plan]);
  const search = useSearch(lines);
  return (
    <Slide
      lines={lines}
      styles={styles}
      changes={changes}
      search={search}
      settled={time === 0}
    />
  );
}
