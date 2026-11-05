import { describe, it, expect, vi, beforeEach } from 'vitest';

// Provide lightweight React hook implementations so the hook runs without a DOM.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useCallback: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

import { useHistory } from '../../../../src/tui/hooks/useHistory.js';

describe('useHistory hook', () => {
  let hook: ReturnType<typeof useHistory>;

  beforeEach(() => {
    hook = useHistory();
  });

  it('starts empty — up() returns null', () => {
    expect(hook.up()).toBeNull();
  });

  it('push adds an entry and up() retrieves it', () => {
    hook.push('first');
    expect(hook.up()).toBe('first');
  });

  it('push deduplicates — same entry moved to front', () => {
    hook.push('a');
    hook.push('b');
    hook.push('a'); // entries = ['a', 'b']
    expect(hook.up()).toBe('a');
    expect(hook.up()).toBe('b');
    expect(hook.up()).toBe('b'); // clamps at oldest, not null
  });

  it('down() returns null at the fresh prompt (index -1)', () => {
    hook.push('cmd');
    expect(hook.down()).toBeNull();
  });

  it('up/down navigation walks history correctly', () => {
    hook.push('first');
    hook.push('second');
    expect(hook.up()).toBe('second');
    expect(hook.up()).toBe('first');
    expect(hook.up()).toBe('first'); // clamps at oldest
    expect(hook.down()).toBe('second');
    expect(hook.down()).toBeNull(); // back at fresh prompt
  });

  it('push resets navigation index to -1', () => {
    hook.push('old');
    hook.up();
    hook.push('new');
    expect(hook.up()).toBe('new');
  });

  it('ignores whitespace-only entries', () => {
    hook.push('   ');
    expect(hook.up()).toBeNull();
  });

  it('respects maxEntries limit', () => {
    const h = useHistory(3);
    h.push('a');
    h.push('b');
    h.push('c');
    h.push('d'); // 'd' pushes 'a' out; entries = ['d','c','b']
    // Collect exactly 3 entries via up()
    expect(h.up()).toBe('d');
    expect(h.up()).toBe('c');
    expect(h.up()).toBe('b');
    // 'a' was evicted; clamped up() returns 'b' again, not 'a'
    expect(h.up()).not.toBe('a');
  });
});
