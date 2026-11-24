import React from "react";
import { render, fireEvent } from "@testing-library/react";
import SlideWrapper from "./slide.jsx";
import { getSlides, getChanges } from "./lib/differ.js";

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

// A real version, made by diffing: `codes` are newest first and the version
// shown is the first one.
function versionOf(...codes) {
  const lines = getSlides(codes, "javascript")[0];
  return { lines, changes: getChanges(lines) };
}

describe("removed lines", () => {
  const before = "one\ntwo\nthree\nfour\nfive\n";
  const deleted = "one\nfive\n"; // removes "two", "three" and "four"
  const texts = () => $$(".line-no").map(n => n.parentElement.textContent);

  test("a commit that only deletes lines is a change you can go to", () => {
    show(versionOf(deleted, before));
    expect(nav().textContent).toMatch(/Change 1 \/ 1/);
    expect(nav().textContent).not.toMatch(/No changes/);
    expect($$(".marker-change.marker-removed").length).toBe(1);
    expect($(".marker-change").title).toContain("−3");
    expect($(".change-nav-stats").textContent).toBe("−3");
  });

  test("shows where the lines were removed, closed", () => {
    show(versionOf(deleted, before));
    expect($(".removed-header").textContent).toContain("3 lines removed");
    expect($(".removed-toggle").getAttribute("aria-expanded")).toBe("false");
    // only the lines of the version are there
    expect($$(".removed-line").length).toBe(0);
    expect($$(".line-no").map(n => n.textContent)).toEqual(["1", "2"]);
  });

  test("clicking the header shows the removed lines, clicking again hides them", () => {
    show(versionOf(deleted, before));
    fireEvent.click($(".removed-toggle"));
    expect($(".removed-toggle").getAttribute("aria-expanded")).toBe("true");
    expect($$(".removed-line").length).toBe(3);
    expect($$(".removed-line").map(r => r.textContent)).toEqual([
      "−two",
      "−three",
      "−four"
    ]);
    // they are not numbered and the lines of the version keep their numbers
    expect(
      $$(".line-no")
        .filter(n => !n.parentElement.classList.contains("removed-line"))
        .map(n => n.textContent)
    ).toEqual(["1", "2"]);

    fireEvent.click($(".removed-toggle"));
    expect($$(".removed-line").length).toBe(0);
  });

  test("the Removed button opens all of them and remembers it", () => {
    show(versionOf("one\nthree\nfive\n", "one\ntwo\nthree\nfour\nfive\n"));
    expect($$(".removed-header").length).toBe(2);
    expect($$(".removed-line").length).toBe(0);

    const toggle =
      button("Removed") || $(".change-nav-extra.on, .change-nav-extra");
    const removedButton = $$(".change-nav button").find(
      b => b.textContent === "Removed"
    );
    expect(removedButton).toBeTruthy();
    expect(toggle).toBeTruthy();
    fireEvent.click(removedButton);
    expect($$(".removed-line").length).toBe(2);
    expect(window.localStorage.getItem("git-history:show-removed")).toBe(
      "true"
    );

    // one place can still be closed
    fireEvent.click($$(".removed-toggle")[0]);
    expect($$(".removed-line").length).toBe(1);
  });

  test("the Removed button is only there when the commit removed something", () => {
    show(versionOf("a\nb\nc\n", "a\nc\n"));
    const names = $$(".change-nav button").map(b => b.textContent);
    expect(names).not.toContain("Removed");
    expect($(".change-nav-stats").textContent).toBe("+1");
  });

  test("a replaced block has both the removed and the added lines", () => {
    show(versionOf("a\nNEW\nd\n", "a\nb\nc\nd\n"));
    expect($$(".marker-change.marker-modified").length).toBe(1);
    expect($(".change-nav-stats").textContent).toBe("+1−2");
    expect($(".removed-header").textContent).toContain("2 lines removed");
    fireEvent.click($(".removed-toggle"));
    expect(texts()).toEqual(["1a", "−b", "−c", "2NEW", "3d"].map(t => t));
  });

  test("when nothing is left, the removed lines are shown", () => {
    show(versionOf("", "a\nb\nc\n"));
    expect($(".removed-header").textContent).toContain(
      "All 3 lines removed in this commit"
    );
    expect($(".removed-toggle")).toBeNull();
    expect($$(".removed-line").map(r => r.textContent)).toEqual([
      "−a",
      "−b",
      "−c"
    ]);
    expect(nav().textContent).toMatch(/Change 1 \/ 1/);
  });

  test("search does not look into the removed lines", () => {
    show(versionOf(deleted, before));
    fireEvent.click($(".removed-toggle"));
    key("/");
    fireEvent.change($(".search-bar input"), { target: { value: "three" } });
    expect($(".search-status").textContent).toBe("No results");
    expect($$(".search-hit").length).toBe(0);
  });

  test("while the animation runs the header is not in the way", () => {
    show(versionOf(deleted, before), 0.4);
    expect($(".removed-header")).toBeNull();
  });

  test("what was opened is forgotten when another version is shown", () => {
    show(versionOf(deleted, before));
    fireEvent.click($(".removed-toggle"));
    expect($$(".removed-line").length).toBe(3);
    show(versionOf("one\nfive\n", "one\ntwo\nfive\n"));
    expect($$(".removed-line").length).toBe(0);
    expect($(".removed-header").textContent).toContain("1 line removed");
  });
});
