import { useState, useEffect, useCallback } from "react";
import { eventBus } from "../utils/EventBus";

/**
 * Hook that combines event listening with state management
 * Returns state and setter like useState, but also updates when the specified event fires
 *
 * @param event Event name to subscribe to
 * @param initialState Optional initial state value
 * @returns [state, setState] tuple like useState
 */
export function useEventState<T>(
  event: string,
  initialState?: T
): [T | undefined, (value: T) => void] {
  // State to track the latest event data
  const [state, setState] = useState<T | undefined>(initialState);

  // Subscribe to the event
  useEffect(() => {
    // Create event handler
    const handleEvent = (data?: T) => {
      if (data !== undefined) {
        setState(data);
      }
    };

    // Subscribe to the event
    const unsubscribe = eventBus.on(event, handleEvent);

    // Clean up subscription on unmount
    return unsubscribe;
  }, [event]);

  // Function to emit an event and update state
  const setEventState = useCallback(
    (value: T) => {
      eventBus.emit(event, value);
      setState(value);
    },
    [event]
  );

  return [state, setEventState];
}

export default useEventState;
