import React from "react";
import { render, fireEvent } from "@testing-library/react";
import SlideWrapper from "./slide.jsx";

function makeVersion(
  texts = ["alpha", "beta", "gamma", "beta again", "delta", "epsilon"],
  changes = [1, 4]
) {
  const lines = texts.map((text, i) => ({
    key: i,
    content: text,
    tokens: [{ type: "plain", content: text }],
    left: !changes.includes(i),
    middle: true,
    right: true
  }));
  return { lines, changes: changes.map(i => ({ start: i, end: i })) };
}

let view;
const show = (version = makeVersion(), time = 0) => {
  const element = <SlideWrapper time={time} version={version} />;
  if (view) view.rerender(element);
  else view = render(element);
  return view;
};
const $ = selector => view.container.querySelector(selector);
const $$ = selector => Array.from(view.container.querySelectorAll(selector));
const nav = () => $(".change-nav");
const button = label => $(`.change-nav [aria-label="${label}"]`);
// like in a browser: the event starts in the focused element (the body here)
const key = (k, init = {}) =>
  fireEvent.keyDown(document.body, { key: k, ...init });

beforeEach(() => {
  view = null;
});

describe("change navigation", () => {
  test("shows the number of changes and markers", () => {
    show();
    expect(nav().textContent).toMatch(/Change \d \/ 2/);
    expect($$(".marker-change").length).toBe(2);
  });

  test("next and previous buttons move between changes", () => {
    show();
    // auto-jump leaves us at the first change
    expect(nav().textContent).toMatch(/Change 1 \/ 2/);
    fireEvent.click(button("Next change"));
    expect(nav().textContent).toMatch(/Change 2 \/ 2/);
    fireEvent.click(button("Previous change"));
    expect(nav().textContent).toMatch(/Change 1 \/ 2/);
  });

  test("the arrow keys move between changes", () => {
    show();
    key("ArrowDown");
    expect(nav().textContent).toMatch(/Change 2 \/ 2/);
    key("ArrowUp");
    expect(nav().textContent).toMatch(/Change 1 \/ 2/);
  });

  test("clicking a marker selects that change", () => {
    show();
    fireEvent.click($$(".marker-change")[1]);
    expect(nav().textContent).toMatch(/Change 2 \/ 2/);
  });

  test("says so when there are no changes", () => {
    show(makeVersion(["a", "b"], []));
    expect(nav().textContent).toMatch(/No changes/);
    expect(button("Next change").disabled).toBe(true);
  });
});

describe("auto-jump", () => {
  test("goes to the closest change when a version is shown", () => {
    show();
    expect(nav().textContent).toMatch(/Change 1 \/ 2/);
  });

  test("goes to the changes of the new version when switching commits", () => {
    show(makeVersion(undefined, [1, 4]));
    fireEvent.click(button("Next change"));
    expect(nav().textContent).toMatch(/Change 2 \/ 2/);
    show(makeVersion(["a", "b", "c", "d"], [2]));
    expect(nav().textContent).toMatch(/Change 1 \/ 1/);
  });

  test("can be turned off and remembers it", () => {
    show();
    const toggle = nav().querySelector(".change-nav-extra");
    expect(toggle.textContent).toBe("Auto-jump");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(window.localStorage.getItem("git-history:auto-jump")).toBe("false");

    // a new version is shown, but now we stay where we are
    show(makeVersion(["a", "b", "c", "d"], [2]));
    expect(nav().textContent).toMatch(/Change – \/ 1/);
  });

  test("does not jump while the animation is running", () => {
    show(makeVersion(), 0.4);
    expect(nav().textContent).toMatch(/Change – \/ 2/);
  });

  test("does not take you away from search results", () => {
    show();
    key("/");
    fireEvent.change($(".search-bar input"), { target: { value: "delta" } });
    show(makeVersion(["x", "delta", "y"], [1]));
    expect(nav().textContent).toMatch(/Change – \/ 1/);
  });
});

describe("search", () => {
  test("Ctrl+F opens search, highlights matches and Enter moves to the next", () => {
    show();
    expect($(".search-bar")).toBeNull();

    key("f", { ctrlKey: true });
    const input = $(".search-bar input");
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: "beta" } });
    expect($(".search-status").textContent).toBe("1 / 2");
    expect($$(".search-hit").length).toBe(2);
    expect($$(".search-hit-active").length).toBe(1);
    expect($$(".marker-match").length).toBe(2);

    fireEvent.keyDown(input, { key: "Enter" });
    expect($(".search-status").textContent).toBe("2 / 2");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect($(".search-status").textContent).toBe("1 / 2");

    fireEvent.change(input, { target: { value: "zzz" } });
    expect($(".search-status").textContent).toBe("No results");
  });

  test("Escape closes search and clears highlights", () => {
    show();
    fireEvent.click(button("Search"));
    const input = $(".search-bar input");
    fireEvent.change(input, { target: { value: "alpha" } });
    expect($$(".search-hit").length).toBe(1);
    fireEvent.keyDown(input, { key: "Escape" });
    expect($(".search-bar")).toBeNull();
    expect($$(".search-hit").length).toBe(0);
  });

  test("can match the case", () => {
    show(makeVersion(["Alpha", "alpha", "ALPHA"], []));
    key("/");
    fireEvent.change($(".search-bar input"), { target: { value: "alpha" } });
    expect($(".search-status").textContent).toBe("1 / 3");
    fireEvent.click($(".search-case"));
    expect($(".search-status").textContent).toBe("1 / 1");
    expect($$(".search-hit").length).toBe(1);
  });

  test("typing in the search box does not trigger the other shortcuts", () => {
    show();
    key("/");
    const input = $(".search-bar input");
    const before = nav().textContent;
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(nav().textContent).toBe(before);
    fireEvent.keyDown(input, { key: "?" });
    expect($(".help-dialog")).toBeNull();
  });
});

describe("help and line numbers", () => {
  test("? shows the keyboard shortcuts and Esc hides them", () => {
    show();
    expect($(".help-dialog")).toBeNull();
    key("?");
    expect($(".help-dialog")).not.toBeNull();
    key("Escape");
    expect($(".help-dialog")).toBeNull();
    fireEvent.click(button("Keyboard shortcuts"));
    expect($(".help-dialog")).not.toBeNull();
  });

  test("lines are numbered", () => {
    show();
    expect($$(".line-no").map(n => n.textContent)).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6"
    ]);
  });

  test("long lines keep their full intrinsic width and can scroll horizontally", () => {
    const longLine = `const value = "${"x".repeat(1200)}";`;
    show(makeVersion([longLine], []));

    const row = $(".line-no").parentElement;
    expect(row.style.width).toBe("max-content");
    expect(row.style.minWidth).toBe("100%");
    expect(row.textContent).toContain(longLine);
    expect($(".scroller").style.overflowX).toBe("auto");
  });
});

describe("big files", () => {
  const manyLines = count => {
    const texts = Array.from(
      { length: count },
      (_, i) => `const line${i} = ${i};`
    );
    return makeVersion(texts, [10]);
  };

  test("only the rows around the visible area are in the page", () => {
    show(manyLines(5000));
    const rows = $$(".line-no").length;
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(400);
  });

  test("lines that are not in this version take no room in the page", () => {
    const version = makeVersion(["a", "b", "c", "d"], []);
    version.lines.push({
      key: 99,
      content: "gone",
      tokens: [{ type: "plain", content: "gone" }],
      left: true,
      middle: false,
      right: false
    });
    show(version);
    expect($$(".line-no").length).toBe(4);
  });
});
