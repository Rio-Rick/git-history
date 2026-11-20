import React from "react";
import { lowerBound, upperBound } from "./utils";

// Renders only the rows that are near the visible area. `offsets` has the
// top of every row (and the total height at the end), so we can find the
// first and the last row to render without going through all of them.
export default function useChildren({
  items,
  offsets,
  renderRow,
  height,
  top,
  overscan = 600
}) {
  const count = items.length;
  const viewHeight = height == null ? window.innerHeight : height;

  const topT = top - overscan;
  const bottomT = top + viewHeight + overscan;

  // rows that end before topT or start after bottomT are left out
  const first = Math.max(0, lowerBound(offsets, topT) - 1);
  const last = Math.min(count - 1, upperBound(offsets, bottomT) - 1);

  const children = [];
  children.push(<div style={{ height: offsets[first] }} key="top-ph" />);
  for (let i = first; i <= last; i++) {
    // rows without height can not be seen, no need to have them in the page
    if (offsets[i + 1] !== offsets[i]) {
      children.push(renderRow(items[i], i));
    }
  }
  children.push(
    <div
      style={{ height: offsets[count] - offsets[last + 1] }}
      key="bottom-ph"
    />
  );
  return children;
}
