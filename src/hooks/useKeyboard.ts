import { useEffect, useCallback } from "react";
import { useGameStore } from "../stores/gameStore";

type KeyHandler = (e: KeyboardEvent) => void;

/**
 * Hook for handling keyboard events with game state input focus awareness
 * @param key Key to listen for (e.g., 'p', 'Escape')
 * @param handler Function to call when key is pressed
 * @param deps Dependencies array for the handler
 * @param requireFocus Whether the handler should only fire when game input is not focused
 */
export const useKeyboard = (
  key: string,
  handler: KeyHandler,
  deps: React.DependencyList = [],
  requireFocus: boolean = true
): void => {
  const inputFocused = useGameStore((state) => state.inputFocused);

  // Create a stable callback that checks input focused state
  const stableHandler = useCallback(
    (e: KeyboardEvent) => {
      // If we require focus and input is focused, ignore the key press
      if (requireFocus && inputFocused) return;

      // Check if the key matches (case insensitive)
      if (e.key.toLowerCase() === key.toLowerCase()) {
        handler(e);
      }
    },
    [key, handler, inputFocused, requireFocus, ...deps]
  );

  useEffect(() => {
    window.addEventListener("keydown", stableHandler);
    return () => window.removeEventListener("keydown", stableHandler);
  }, [stableHandler]);
};

/**
 * Hook for handling multiple keyboard shortcuts
 * @param keyMap Object mapping keys to handler functions
 * @param deps Dependencies array for the handlers
 * @param requireFocus Whether handlers should only fire when game input is not focused
 */
export const useKeyboardMap = (
  keyMap: Record<string, KeyHandler>,
  deps: React.DependencyList = [],
  requireFocus: boolean = true
): void => {
  const inputFocused = useGameStore((state) => state.inputFocused);

  // Create a stable handler that checks the key map
  const stableHandler = useCallback(
    (e: KeyboardEvent) => {
      // If we require focus and input is focused, ignore the key press
      if (requireFocus && inputFocused) return;

      // Check if the key is in our map
      const key = e.key.toLowerCase();
      const handler = keyMap[key];

      if (handler) {
        handler(e);
      }
    },
    [keyMap, inputFocused, requireFocus, ...deps]
  );

  useEffect(() => {
    window.addEventListener("keydown", stableHandler);
    return () => window.removeEventListener("keydown", stableHandler);
  }, [stableHandler]);
};
