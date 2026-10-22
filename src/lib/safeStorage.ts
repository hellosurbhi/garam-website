type SafeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// WHY try/catch on the property access itself, not just the methods: Safari
// private browsing and partitioned in-app-browser storage throw
// SecurityError on the `window.localStorage`/`window.sessionStorage` getter
// itself, before any method is even called. See #197.
function wrap(getStorage: () => Storage): SafeStorage {
  return {
    getItem(key) {
      try {
        return getStorage().getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        getStorage().setItem(key, value);
      } catch {
        // Storage inaccessible; the feature that wanted to persist degrades
        // silently rather than crashing the page.
      }
    },
    removeItem(key) {
      try {
        getStorage().removeItem(key);
      } catch {
        // Nothing to clean up if storage was never reachable.
      }
    },
  };
}

export const safeLocalStorage = wrap(() => window.localStorage);
export const safeSessionStorage = wrap(() => window.sessionStorage);
