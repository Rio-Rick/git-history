export function nextIndex(list, currentIndex) {
  return Math.min(list.length - 1, Math.floor(currentIndex + 1));
}

export function prevIndex(list, currentIndex) {
  return Math.max(0, Math.ceil(currentIndex - 1));
}

export function closestIndex(list, currentIndex) {
  return Math.min(Math.max(0, Math.round(currentIndex)), list.length - 1);
}

// offsets[i] is the top of row i and the last one is the total height
export function computeOffsets(heights) {
  const offsets = new Array(heights.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < heights.length; i++) {
    offsets[i + 1] = offsets[i] + heights[i];
  }
  return offsets;
}

// smallest i such that offsets[i] >= value
export function lowerBound(offsets, value) {
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// smallest i such that offsets[i] > value
export function upperBound(offsets, value) {
  let lo = 0;
  let hi = offsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function getScrollTopFromOffsets(area, offsets, containerHeight) {
  const start = offsets[area.start];
  const end = offsets[area.end + 1];
  const contentHeight = offsets[offsets.length - 1];
  const middle = (end + start) / 2;
  const halfContainer = containerHeight / 2;
  const bestTop =
    end - start > containerHeight ? start : middle - halfContainer;
  if (bestTop < 0) return 0;
  if (bestTop + containerHeight > contentHeight) {
    return contentHeight - containerHeight;
  }
  return bestTop;
}

export function getScrollTop(area, contentHeight, containerHeight, heights) {
  return getScrollTopFromOffsets(
    area,
    computeOffsets(heights),
    containerHeight
  );
}

export function isTyping(e) {
  const tag = e.target && e.target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
