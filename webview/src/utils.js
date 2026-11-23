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

export function clampScrollTop(top, contentHeight, containerHeight) {
  const viewportHeight = Math.max(0, Number(containerHeight) || 0);
  const maxTop = Math.max(
    0,
    (Number(contentHeight) || 0) - viewportHeight
  );
  const requestedTop = Number(top);
  const safeTop = Number.isFinite(requestedTop) ? requestedTop : 0;
  return Math.min(maxTop, Math.max(0, safeTop));
}

export function getScrollTopFromOffsets(area, offsets, containerHeight) {
  const start = offsets[area.start];
  const end = offsets[area.end + 1];
  const contentHeight = offsets[offsets.length - 1];
  const viewportHeight = Math.max(0, Number(containerHeight) || 0);
  const middle = (end + start) / 2;
  const bestTop =
    end - start > viewportHeight ? start : middle - viewportHeight / 2;
  return clampScrollTop(bestTop, contentHeight, viewportHeight);
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
