import { useCallback, useEffect, useRef } from "react";
import { eventBus } from "../utils/EventBus";

// Event callback type definition
type EventCallback = (data?: any) => void;

/**
 * React hook for using the event bus
 * @param event Event name to listen to
 * @param callback Callback function when event is triggered
 */
export const useEventBus = (event: string, callback: EventCallback): void => {
  // Keep stable reference to callback
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create stable wrapper function
  const stableCallback = useCallback((data?: any) => {
    callbackRef.current(data);
  }, []);

  // Subscribe to event on mount, unsubscribe on unmount
  useEffect(() => {
    const unsubscribe = eventBus.on(event, stableCallback);
    return unsubscribe;
  }, [event, stableCallback]);
};

/**
 * Hook for emitting events (returns stable function)
 * @returns emit function
 */
export const useEmitEvent = () => {
  return useCallback((event: string, data?: any) => {
    eventBus.emit(event, data);
  }, []);
};

export default useEventBus;
