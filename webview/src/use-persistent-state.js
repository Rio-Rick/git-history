import { useState, useCallback } from "react";

// useState that remembers its value (when the browser lets us)
export default function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved == null ? initial : JSON.parse(saved);
    } catch (e) {
      return initial;
    }
  });
  const set = useCallback(
    newValue => {
      setValue(newValue);
      try {
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (e) {
        // no storage, no problem
      }
    },
    [key]
  );
  return [value, set];
}
