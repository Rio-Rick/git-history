import easing from "./easing.js";

const MULTIPLY = "multiply";

function mergeResults(results, composite) {
  const firstResult = results[0];
  if (results.length < 2) {
    return firstResult;
  }
  if (Array.isArray(firstResult)) {
    return firstResult.map((_, i) => {
      return mergeResults(
        results.map(result => result[i]),
        composite
      );
    });
  } else {
    const merged = Object.assign({}, ...results);

    if (composite === MULTIPLY) {
      const opacities = results.map(x => x.opacity).filter(x => x != null);
      if (opacities.length !== 0) {
        merged.opacity = opacities.reduce((a, b) => a * b);
      }
    }
    return merged;
  }
}

// Every animation is a function of the time (from 0 to 1) that returns
// the style of what is animated.

export const parallel =
  (...fns) =>
  (t, ...args) => {
    const styles = fns.map(fn => fn(t, ...args));
    return mergeResults(styles, MULTIPLY);
  };

export const chain =
  (durations, ...fns) =>
  (t, ...args) => {
    let style = fns[0](0, ...args);
    let lowerDuration = 0;
    for (let i = 0; i < fns.length; i++) {
      const fn = fns[i];
      const thisDuration = durations[i];
      const upperDuration = lowerDuration + thisDuration;
      if (lowerDuration <= t && t <= upperDuration) {
        const innerT = (t - lowerDuration) / thisDuration;
        style = mergeResults([style, fn(innerT, ...args)]);
      } else if (upperDuration < t) {
        // merge the end of previous animation
        style = mergeResults([style, fn(1, ...args)]);
      } else if (t < lowerDuration) {
        // merge the start of future animation
        style = mergeResults([fn(0, ...args), style]);
      }
      lowerDuration = upperDuration;
    }
    return style;
  };

export const delay = () => () => ({});

export const tween =
  ({ from, to, ease = easing.linear }) =>
  t => {
    const style = {};
    Object.keys(from).forEach(key => {
      const value = from[key] + (to[key] - from[key]) * ease(t);
      if (key === "x") {
        style["transform"] = `translateX(${value}px)`;
      } else {
        style[key] = value;
      }
    });
    return style;
  };

// Runs `animation` for every target that passes the filter, each one a bit
// after the previous (`interval` is the part of the time that is shared
// between all of them). The ones that do not pass get an empty style.
export const stagger =
  ({ interval, filter }, animation) =>
  (t, targets) => {
    const matches = targets.map(target => !filter || !!filter(target));
    const count = matches.reduce((n, matched) => (matched ? n + 1 : n), 0);
    const step = count < 2 ? 0 : interval / (count - 1);
    let i = 0;
    return targets.map((target, index) => {
      if (!matches[index]) {
        return {};
      }
      const run = parallel(chain([i * step, 1 - interval], delay(), animation));
      i++;
      return run(t, target);
    });
  };
