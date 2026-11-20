import React, { useEffect, useRef, useState } from "react";
import { isTyping } from "./utils";
import "./help.css";

const SHORTCUTS = [
  ["←  /  →", "Older / newer commit"],
  ["↑  /  ↓", "Previous / next change"],
  ["Ctrl/Cmd + F   or   /", "Search in the file"],
  ["Enter  /  Shift + Enter", "Next / previous search result"],
  ["Esc", "Close search or this help"],
  ["?", "Show or hide this help"]
];

export function useHelp() {
  const [open, setOpen] = useState(false);
  const latest = useRef();
  latest.current = open;

  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === "?" && !isTyping(e)) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === "Escape" && latest.current) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return {
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false)
  };
}

export function HelpDialog({ onClose }) {
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div
        className="help-dialog"
        role="dialog"
        aria-label="Keyboard shortcuts"
        onClick={e => e.stopPropagation()}
      >
        <h2>Keyboard shortcuts</h2>
        <table>
          <tbody>
            {SHORTCUTS.map(([keys, what]) => (
              <tr key={keys}>
                <td className="help-keys">{keys}</td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="help-note">
          Auto-jump scrolls to the closest change every time you switch commit.
        </p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
