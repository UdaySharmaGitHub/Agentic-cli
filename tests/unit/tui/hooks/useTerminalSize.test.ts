import { describe, it, expect, vi, beforeEach } from 'vitest';

// Configurable ink mock — each test sets what useStdout returns via beforeEach
const inkMock = vi.hoisted(() => ({
  useStdout: vi.fn(),
}));

vi.mock('ink', () => ({
  useStdout: inkMock.useStdout,
}));

function makeStdout(columns: number | undefined, rows: number | undefined) {
  return { stdout: { columns, rows, on: vi.fn(), off: vi.fn() } };
}

// Lightweight React hook shims so the hook runs without a DOM.
// callCount increments across all calls in the file; each call to useTerminalSize
// gets a new idx, so stateStore.has(idx) is always false and initial value wins.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const stateStore = new Map<number, unknown>();
  let callCount = 0;
  return {
    ...actual,
    useState: (initial: unknown) => {
      const idx = callCount++;
      if (!stateStore.has(idx)) stateStore.set(idx, initial);
      return [stateStore.get(idx), (v: unknown) => stateStore.set(idx, v)];
    },
    useEffect: (fn: () => (() => void) | void) => {
      fn(); // run immediately for test purposes
    },
  };
});

import { useTerminalSize } from '../../../../src/tui/hooks/useTerminalSize.js';

describe('useTerminalSize hook', () => {
  beforeEach(() => {
    inkMock.useStdout.mockReturnValue(makeStdout(120, 40));
  });

  it('returns columns and rows from mocked stdout', () => {
    const size = useTerminalSize();
    expect(size.columns).toBe(120);
    expect(size.rows).toBe(40);
  });

  it('returns numeric values', () => {
    const size = useTerminalSize();
    expect(typeof size.columns).toBe('number');
    expect(typeof size.rows).toBe('number');
  });

  it('falls back to 80 columns and 24 rows when stdout has undefined dimensions', () => {
    inkMock.useStdout.mockReturnValueOnce(makeStdout(undefined, undefined));
    const size = useTerminalSize();
    expect(size.columns).toBe(80);
    expect(size.rows).toBe(24);
  });
});
