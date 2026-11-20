import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSwipeable } from "react-swipeable";
import useSpring from "./use-spring";
import Slide from "./slide";
import { isTyping } from "./utils";
import "./comment-box.css";

function CommitInfo({ commit, move, onClick }) {
  const message = commit.message.split("\n")[0].slice(0, 80);
  const isActive = Math.abs(move) < 0.5;
  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        transform: `translateX(-50%) translateX(${250 * move}px)`,
        opacity: 1 / (1 + Math.min(0.8, Math.abs(move))),
        zIndex: !isActive && 2
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          padding: "5px 0 15px"
        }}
        onClick={onClick}
      >
        {commit.author.avatar && (
          <img
            src={commit.author.avatar}
            alt={commit.author.login}
            height={40}
            width={40}
            style={{ borderRadius: "4px" }}
          />
        )}
        <div style={{ paddingLeft: "6px" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: "500" }}>
            {commit.author.login}
          </div>
          <div style={{ fontSize: "0.85rem", opacity: "0.9" }}>
            {isActive && commit.commitUrl ? (
              <a
                href={commit.commitUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                on {commit.date.toDateString()}
              </a>
            ) : (
              `on ${commit.date.toDateString()}`
            )}
          </div>
        </div>
      </div>
      {isActive && (
        <div
          className="comment-box"
          title={commit.message}
          style={{ opacity: 1 - 2 * Math.abs(move) }}
        >
          {message}
          {message !== commit.message ? " ..." : ""}
        </div>
      )}
    </div>
  );
}

// Each commit takes 250px of the strip and the ones far from the center
// can not be seen, so only the ones around it are drawn.
const COMMIT_WIDTH = 250;

function visibleRange(count, currentIndex, width) {
  const around = Math.ceil(width / COMMIT_WIDTH / 2) + 2;
  return [
    Math.max(0, Math.floor(currentIndex) - around),
    Math.min(count - 1, Math.ceil(currentIndex) + around)
  ];
}

function CommitList({ commits, currentIndex, selectCommit }) {
  const [from, to] = visibleRange(
    commits.length,
    currentIndex,
    window.innerWidth
  );
  const shown = [];
  for (let commitIndex = from; commitIndex <= to; commitIndex++) {
    shown.push(
      <CommitInfo
        commit={commits[commitIndex]}
        move={currentIndex - commitIndex}
        key={commitIndex}
        onClick={() => selectCommit(commitIndex)}
      />
    );
  }
  const mouseWheelEvent = e => {
    e.preventDefault();
    selectCommit(currentIndex - (e.deltaX + e.deltaY) / 100);
  };
  return (
    <div
      onWheel={mouseWheelEvent}
      style={{
        overflow: "hidden",
        width: "100%",
        height: "100px",
        position: "fixed",
        top: 0,
        background: "rgb(1, 22, 39)",
        zIndex: 1
      }}
    >
      {shown}
    </div>
  );
}

export default function History({ versions, loadMore }) {
  return <Slides versions={versions} loadMore={loadMore} />;
}

function Slides({ versions, loadMore }) {
  const [current, target, setTarget] = useSliderSpring(0);
  const commits = useMemo(() => versions.map(v => v.commit), [versions]);
  const setClampedTarget = newTarget => {
    setTarget(Math.min(commits.length - 0.75, Math.max(-0.25, newTarget)));
    if (newTarget >= commits.length - 5) {
      loadMore();
    }
  };
  const index = Math.round(current);
  const nextSlide = () => setClampedTarget(Math.round(target - 0.51));
  const prevSlide = () => setClampedTarget(Math.round(target + 0.51));

  // One listener that always uses the latest values
  const latest = useRef();
  latest.current = { nextSlide, prevSlide, setClampedTarget, current };
  useEffect(() => {
    const onKeyDown = e => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      const { nextSlide, prevSlide, setClampedTarget, current } =
        latest.current;
      if (e.key === "ArrowRight") {
        nextSlide();
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === " ") {
        setClampedTarget(current);
      }
    };
    document.body.addEventListener("keydown", onKeyDown);
    return () => document.body.removeEventListener("keydown", onKeyDown);
  }, []);

  const swipe = useSwipeable({
    onSwipedLeft: nextSlide,
    onSwipedRight: prevSlide
  });

  return (
    <React.Fragment>
      <CommitList
        commits={commits}
        currentIndex={current}
        selectCommit={index => setClampedTarget(index)}
      />
      <div className="commit-counter" title="Commit position">
        Commit {Math.min(index, commits.length - 1) + 1} / {commits.length}
      </div>
      <div {...swipe} style={{ height: "100%" }}>
        <Slide time={index - current} version={versions[index]} />
      </div>
    </React.Fragment>
  );
}

function useSliderSpring(initial) {
  const [target, setTarget] = useState(initial);
  const value = useSpring({ target, tension: 0, friction: 10 });
  return [Math.round(value * 100) / 100, target, setTarget];
}
