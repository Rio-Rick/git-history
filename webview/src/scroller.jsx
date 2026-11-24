import React from "react";
import useChildren from "./use-virtual-children";
import "./scroller.css";
import useSpring from "./use-spring";
import {
  nextIndex,
  prevIndex,
  closestIndex,
  computeOffsets,
  lowerBound,
  getScrollTopFromOffsets,
  clampScrollTop,
  isTyping
} from "./utils";

const initialState = {
  snap: false,
  targetTop: 0,
  currentTop: 0,
  areaIndex: 0,
  areaKnown: false
};

export default function Scroller({
  items,
  heights,
  renderRow,
  snapAreas,
  focusRow,
  jumpRequest,
  markers,
  onOpenSearch,
  onOpenHelp,
  autoJump,
  onToggleAutoJump,
  stats,
  showRemoved,
  onToggleShowRemoved
}) {
  const ref = React.useRef();
  const height = useHeight(ref);
  const containerHeight =
    height ?? ref.current?.clientHeight ?? window.innerHeight;

  // Only changes when the heights change (while the animation runs)
  const offsets = React.useMemo(() => computeOffsets(heights), [heights]);
  const contentHeight = offsets[offsets.length - 1] || 0;

  const reducer = (prevState, action) => {
    switch (action.type) {
      case "unsnap":
        return !prevState.snap ? prevState : { ...prevState, snap: false };
      case "change-area": {
        if (snapAreas.length === 0) {
          return prevState;
        }

        const { changeIndex, recalculate } = action;
        const movingFromUnknownIndex =
          !prevState.snap || !prevState.areaKnown || recalculate;

        let newIndex;
        if (movingFromUnknownIndex) {
          const oldIndex = getAreaIndex(
            prevState.targetTop,
            snapAreas,
            offsets,
            containerHeight
          );

          newIndex = changeIndex(snapAreas, oldIndex);
        } else {
          newIndex = changeIndex(snapAreas, prevState.areaIndex);
        }

        if (newIndex === prevState.areaIndex && !movingFromUnknownIndex) {
          return prevState;
        }

        return {
          ...prevState,
          areaIndex: newIndex,
          areaKnown: true,
          snap: true,
          currentTop: null,
          targetTop: getScrollTopFromOffsets(
            snapAreas[newIndex],
            offsets,
            containerHeight
          )
        };
      }
      case "goto-row":
        return {
          ...prevState,
          areaKnown: false,
          snap: true,
          currentTop: null,
          targetTop: getScrollTopFromOffsets(
            { start: action.row, end: action.row },
            offsets,
            containerHeight
          )
        };
      case "manual-scroll": {
        const { newTop } = action;
        if (newTop === prevState.currentTop && !prevState.snap) {
          return prevState;
        }
        return {
          ...prevState,
          snap: false,
          currentTop: newTop,
          targetTop: newTop
        };
      }
      default:
        throw Error();
    }
  };

  const [{ snap, targetTop, currentTop, areaIndex, areaKnown }, dispatch] =
    React.useReducer(reducer, initialState);

  // A version can be much shorter than the one shown before it. Clamp both
  // ends of the spring so stale scroll positions cannot virtualize past EOF.
  const safeTargetTop = clampScrollTop(
    targetTop,
    contentHeight,
    containerHeight
  );
  const safeCurrentTop =
    currentTop == null
      ? null
      : clampScrollTop(currentTop, contentHeight, containerHeight);
  const top = useSpring({
    target: safeTargetTop,
    current: safeCurrentTop,
    round: Math.round
  });
  // console.log("render", targetTop, top);

  const children = useChildren({
    height,
    top: clampScrollTop(top, contentHeight, containerHeight),
    items,
    offsets,
    renderRow
  });

  const goPrev = React.useCallback(
    () => dispatch({ type: "change-area", changeIndex: prevIndex }),
    []
  );
  const goNext = React.useCallback(
    () => dispatch({ type: "change-area", changeIndex: nextIndex }),
    []
  );
  const selectChange = React.useCallback(
    i => dispatch({ type: "change-area", changeIndex: () => i }),
    []
  );

  React.useEffect(() => {
    const onKeyDown = e => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key === "ArrowUp") {
        goPrev();
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        goNext();
        e.preventDefault();
      }
    };
    document.body.addEventListener("keydown", onKeyDown);
    return () => document.body.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext]);

  // Scroll to a row when asked from the outside (search results)
  React.useEffect(() => {
    if (focusRow) {
      dispatch({ type: "goto-row", row: focusRow.row });
    }
  }, [focusRow]);

  // Go to the closest change when asked from the outside (a new version
  // is on screen)
  React.useEffect(() => {
    if (jumpRequest) {
      dispatch({
        type: "change-area",
        recalculate: true,
        changeIndex: closestIndex
      });
    }
  }, [jumpRequest]);

  React.useEffect(() => {
    dispatch({
      type: "unsnap"
    });
  }, [snapAreas]);

  React.useLayoutEffect(() => {
    if (snap) {
      ref.current.scrollTop = top;
    }
  }, [snap, top]);

  return (
    <React.Fragment>
      <ChangeNav
        total={snapAreas.length}
        index={snap && areaKnown ? areaIndex : null}
        onPrev={goPrev}
        onNext={goNext}
        onOpenSearch={onOpenSearch}
        onOpenHelp={onOpenHelp}
        autoJump={autoJump}
        onToggleAutoJump={onToggleAutoJump}
        stats={stats}
        showRemoved={showRemoved}
        onToggleShowRemoved={onToggleShowRemoved}
      />
      <Markers
        markers={markers}
        onSelectChange={selectChange}
        activeChange={snap && areaKnown ? areaIndex : null}
      />
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "auto"
        }}
        className="scroller"
        ref={ref}
        onScroll={e => {
          const newTop = e.target.scrollTop;
          if (newTop === top) {
            return;
          }
          dispatch({ type: "manual-scroll", newTop });
        }}
      >
        <code
          style={{
            display: "block",
            width: "calc(100% - 20px)",
            maxWidth: "900px",
            margin: "auto",
            padding: "10px",
            boxSizing: "border-box",
            height: "100%"
          }}
          children={children}
        />
      </div>
    </React.Fragment>
  );
}

const ChangeNav = React.memo(function ChangeNav({
  total,
  index,
  onPrev,
  onNext,
  onOpenSearch,
  onOpenHelp,
  autoJump,
  onToggleAutoJump,
  stats,
  showRemoved,
  onToggleShowRemoved
}) {
  const label = total ? `${index == null ? "–" : index + 1} / ${total}` : "";
  return (
    <div className="change-nav">
      <button
        title="Previous change (↑)"
        disabled={!total}
        onClick={onPrev}
        aria-label="Previous change"
      >
        ▲
      </button>
      <span className="change-nav-label">
        {total ? `Change ${label}` : "No changes"}
      </span>
      <button
        title="Next change (↓)"
        disabled={!total}
        onClick={onNext}
        aria-label="Next change"
      >
        ▼
      </button>
      {stats && (stats.added > 0 || stats.removed > 0) && (
        <span
          className="change-nav-stats"
          title="Lines added and removed by this commit"
        >
          {stats.added > 0 && <span className="stat-add">+{stats.added}</span>}
          {stats.removed > 0 && (
            <span className="stat-del">−{stats.removed}</span>
          )}
        </span>
      )}
      {onToggleAutoJump && (
        <button
          className={"change-nav-extra" + (autoJump ? " on" : "")}
          title={
            autoJump
              ? "Auto-jump is on: switching commits scrolls to the closest change"
              : "Auto-jump is off: click to scroll to the closest change when switching commits"
          }
          aria-pressed={!!autoJump}
          onClick={onToggleAutoJump}
        >
          Auto-jump
        </button>
      )}
      {onToggleShowRemoved && stats && stats.removed > 0 && (
        <button
          className={"change-nav-extra" + (showRemoved ? " on" : "")}
          title={
            showRemoved
              ? "Removed lines are shown: click to hide them"
              : "Show the lines this commit removed"
          }
          aria-pressed={!!showRemoved}
          onClick={onToggleShowRemoved}
        >
          Removed
        </button>
      )}
      {onOpenSearch && (
        <button
          className="change-nav-extra"
          title="Search (Ctrl+F or /)"
          onClick={onOpenSearch}
          aria-label="Search"
        >
          Search
        </button>
      )}
      {onOpenHelp && (
        <button
          className="change-nav-extra"
          title="Keyboard shortcuts (?)"
          onClick={onOpenHelp}
          aria-label="Keyboard shortcuts"
        >
          ?
        </button>
      )}
    </div>
  );
});

// Thin strip next to the scrollbar showing where changes and matches are
const Markers = React.memo(function Markers({
  markers,
  onSelectChange,
  activeChange
}) {
  if (!markers) {
    return null;
  }
  return (
    <div className="markers">
      {markers.changes.map((c, i) => (
        <div
          key={"c" + i}
          className={
            "marker-change marker-" +
            c.kind +
            (i === activeChange ? " active" : "")
          }
          style={{ top: `${c.top * 100}%`, height: `${c.height * 100}%` }}
          title={describeChange(i, c)}
          onClick={() => onSelectChange(i)}
        />
      ))}
      {markers.matches.map((top, i) => (
        <div
          key={"m" + i}
          className="marker-match"
          style={{ top: `${top * 100}%` }}
        />
      ))}
    </div>
  );
});

function describeChange(index, change) {
  const parts = [];
  if (change.added) parts.push(`+${change.added}`);
  if (change.removed) parts.push(`−${change.removed}`);
  return `Change ${index + 1}${parts.length ? ` (${parts.join(" ")})` : ""}`;
}

function getAreaIndex(scrollTop, areas, offsets, containerHeight) {
  if (areas.length === 0) {
    return 0;
  }

  const scrollMiddle = scrollTop + containerHeight / 2;

  // number of rows that fit before the middle of the visible area
  const middleRow = Math.min(lowerBound(offsets, scrollMiddle), offsets.length);

  const areaCenters = areas.map(a => (a.start + a.end) / 2);
  areaCenters.unshift(0);
  for (let a = 0; a < areas.length; a++) {
    if (middleRow < areaCenters[a + 1]) {
      return (
        a -
        (areaCenters[a + 1] - middleRow) / (areaCenters[a + 1] - areaCenters[a])
      );
    }
  }

  return areas.length - 0.9;
}

function useHeight(ref) {
  const [height, setHeight] = React.useState(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const updateHeight = () => {
      const nextHeight = element.clientHeight;
      setHeight(previous => (previous === nextHeight ? previous : nextHeight));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateHeight)
        : null;
    observer?.observe(element);

    return () => {
      window.removeEventListener("resize", updateHeight);
      observer?.disconnect();
    };
  }, [ref]);

  return height;
}
