// Event callback type definition
type EventCallback = (data?: any) => void;

/**
 * EventBus for communication between systems and components
 */
class EventBus {
  private events: Record<string, EventCallback[]> = {};

  /**
   * Subscribe to an event
   * @param event Event name
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param callback Callback function to remove
   */
  off(event: string, callback: EventCallback): void {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Optional data to pass to listeners
   */
  emit(event: string, data?: any): void {
    if (!this.events[event]) return;
    this.events[event].forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }
    });
  }

  /**
   * Check if an event has any listeners
   * @param event Event name
   * @returns True if the event has listeners
   */
  hasListeners(event: string): boolean {
    return !!(this.events[event] && this.events[event].length > 0);
  }

  /**
   * Get the count of listeners for an event
   * @param event Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    if (!this.events[event]) return 0;
    return this.events[event].length;
  }

  /**
   * Remove all listeners for an event
   * @param event Event name
   */
  removeAllListeners(event: string): void {
    if (this.events[event]) {
      delete this.events[event];
    }
  }

  /**
   * Clear all events and listeners
   */
  clear(): void {
    this.events = {};
  }
}

// Create and export singleton instance
export const eventBus = new EventBus();
