import { parallel, chain, delay, tween, stagger } from "./airframe/airframe.js";
import easing from "./airframe/easing.js";

const dx = 250;
const offOpacity = 0.6;

const slideToLeft = tween({
  from: { x: 0, opacity: 1 },
  to: { x: -dx, opacity: 0 },
  ease: easing.easeInQuad
});

const shrinkHeight = tween({
  from: { height: 15 },
  to: { height: 0 },
  ease: easing.easeInOutQuad
});

const slideFromRight = tween({
  from: { x: dx, opacity: 0 },
  to: { x: 0, opacity: 1 },
  ease: easing.easeOutQuad
});

const growHeight = tween({
  from: { height: 0 },
  to: { height: 15 },
  ease: easing.easeInOutQuad
});

function switchLines({ filterExit, filterEnter, filterFadeOut }) {
  return parallel(
    stagger(
      { interval: 0.2, filter: filterExit },
      chain([0.35, 0.3, 0.35], slideToLeft, shrinkHeight)
    ),
    stagger(
      { interval: 0.2, filter: filterEnter },
      chain([0.35, 0.3, 0.35], delay(), growHeight, slideFromRight)
    ),
    stagger(
      { interval: 0, filter: filterEnter },
      tween({ from: { opacity: offOpacity }, to: { opacity: 1 } })
    ),
    stagger(
      { interval: 0, filter: filterFadeOut },
      tween({
        from: { opacity: 1 },
        to: { opacity: offOpacity },
        ease: easing.easeOutCubic
      })
    ),
    stagger(
      { interval: 0, filter: l => !filterEnter(l) && !filterFadeOut(l) },
      tween({ from: { opacity: offOpacity }, to: { opacity: offOpacity } })
    )
  );
}

export const fullAnimation = chain(
  [0.5, 0.5],
  switchLines({
    filterExit: line => line.left && !line.middle,
    filterEnter: line => !line.left && line.middle,
    filterFadeOut: () => false
  }),
  switchLines({
    filterExit: line => line.middle && !line.right,
    filterEnter: line => !line.middle && line.right,
    filterFadeOut: line => !line.left && line.middle
  })
);

// A line that is in this version and in the previous and the next ones does
// not move, it only has the "not highlighted" opacity, whatever the time is.
// Those are most of the lines of a file, so instead of running the animation
// for all of them on every frame we use the same style for all and run the
// animation only for the lines that enter or leave.
export const STATIC_STYLE = Object.freeze({ opacity: offOpacity });

export const isStatic = line => line.left && line.middle && line.right;

export function planAnimation(lines) {
  const animated = [];
  const indexes = [];
  lines.forEach((line, i) => {
    if (!isStatic(line)) {
      animated.push(line);
      indexes.push(i);
    }
  });
  return { size: lines.length, animated, indexes };
}

export function animateLines(t, plan) {
  const styles = new Array(plan.size).fill(STATIC_STYLE);
  if (plan.animated.length > 0) {
    const results = fullAnimation(t, plan.animated);
    for (let k = 0; k < results.length; k++) {
      styles[plan.indexes[k]] = results[k];
    }
  }
  return styles;
}
