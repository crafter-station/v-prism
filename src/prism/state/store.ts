import { useSyncExternalStore } from "react";

export interface Store<T extends object> {
  readonly get: () => T;
  readonly set: (patch: Partial<T> | ((state: T) => Partial<T>)) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (patch) => {
      state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T extends object, S>(store: Store<T>, select: (state: T) => S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.get()),
    () => select(store.get()),
  );
}

export function watch<T extends object, K extends keyof T>(
  store: Store<T>,
  key: K,
  onChange: (value: T[K]) => void,
): () => void {
  let previous = store.get()[key];
  return store.subscribe(() => {
    const next = store.get()[key];
    if (!Object.is(previous, next)) {
      previous = next;
      onChange(next);
    }
  });
}
