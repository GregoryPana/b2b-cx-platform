// A resource owns its latest request; cancellation alone cannot guard JSON/blob awaits.
export function createRequestScope() {
  const requests = new Map();
  return {
    begin(key) {
      requests.get(key)?.abort();
      const controller = new AbortController();
      requests.set(key, controller);
      return { signal: controller.signal, cancel: () => controller.abort(), isStale: () => controller.signal.aborted || requests.get(key) !== controller };
    },
    invalidate(key) { requests.get(key)?.abort(); requests.delete(key); },
    invalidateAll() { for (const controller of requests.values()) controller.abort(); requests.clear(); },
  };
}
