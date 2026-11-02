/** Presentation receipt only: never a call result, claim or server acknowledgement. */
export function shownCallSession(
  userId: string,
  storage: () => Pick<Storage, 'getItem' | 'setItem'>,
) {
  const key = `nora:call-center:shown:v1:${encodeURIComponent(userId)}`;
  const seen = new Set<string>();
  function restore() {
    try {
      const saved: unknown = JSON.parse(storage().getItem(key) ?? '[]');
      if (Array.isArray(saved))
        for (const id of saved) if (typeof id === 'string') seen.add(id);
    } catch {
      // A denied/quota-limited browser store must not interrupt live calls.
    }
  }
  return {
    has(id: string) {
      restore();
      return seen.has(id);
    },
    add(id: string) {
      restore();
      seen.add(id);
      try {
        storage().setItem(key, JSON.stringify([...seen]));
      } catch {
        // Keep the existing in-memory suppression when persistence is unavailable.
      }
    },
  };
}
