type Listener = (isLoading: boolean) => void;
const listeners = new Set<Listener>();
const activeKeys = new Set<string>();

const notify = () => {
  const isLoading = activeKeys.size > 0;
  for (const listener of listeners) {
    listener(isLoading);
  }
};

/**
 * Global singleton service to manage loading state across the application.
 * Uses unique keys to track multiple concurrent loading operations.
 */
export const loadingService = {
  /** Starts a loading operation with a specific key. */
  start(key: string) {
    activeKeys.add(key);
    notify();
  },
  /** Stops a loading operation with a specific key. */
  stop(key: string) {
    activeKeys.delete(key);
    notify();
  },
  /** Subscribes to loading state changes. Returns an unsubscribe function. */
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  /** Returns the current loading state. */
  isLoading() {
    return activeKeys.size > 0;
  },
};
