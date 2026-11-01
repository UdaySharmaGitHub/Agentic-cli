import { useRef, useCallback } from 'react';

export function useHistory(maxEntries = 50) {
  const entries = useRef<string[]>([]);
  const indexRef = useRef(-1);

  const push = useCallback((entry: string) => {
    if (!entry.trim()) return;
    entries.current = [
      entry,
      ...entries.current.filter(e => e !== entry),
    ].slice(0, maxEntries);
    indexRef.current = -1;
  }, [maxEntries]);

  // Returns the older entry (up arrow), or null if already at the oldest.
  const up = useCallback((): string | null => {
    if (entries.current.length === 0) return null;
    const next = Math.min(indexRef.current + 1, entries.current.length - 1);
    indexRef.current = next;
    return entries.current[next] ?? null;
  }, []);

  // Returns the newer entry (down arrow), or null when back at the fresh prompt.
  const down = useCallback((): string | null => {
    const next = Math.max(indexRef.current - 1, -1);
    indexRef.current = next;
    return next === -1 ? null : (entries.current[next] ?? null);
  }, []);

  return { push, up, down };
}
