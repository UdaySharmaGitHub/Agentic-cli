import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordUsage,
  getLastTurn,
  getSession,
  resetTokens,
} from '../../src/tokens.js';

describe('tokens', () => {
  beforeEach(() => {
    resetTokens();
  });

  it('getLastTurn returns null before any recording', () => {
    expect(getLastTurn()).toBeNull();
  });

  it('getSession returns zeros before any recording', () => {
    const s = getSession();
    expect(s.promptTokens).toBe(0);
    expect(s.completionTokens).toBe(0);
    expect(s.totalTokens).toBe(0);
  });

  it('recordUsage stores the last turn', () => {
    recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    const t = getLastTurn();
    expect(t).not.toBeNull();
    expect(t!.promptTokens).toBe(100);
    expect(t!.completionTokens).toBe(50);
    expect(t!.totalTokens).toBe(150);
  });

  it('getSession accumulates across multiple turns', () => {
    recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    recordUsage({ promptTokens: 200, completionTokens: 80, totalTokens: 280 });
    const s = getSession();
    expect(s.promptTokens).toBe(300);
    expect(s.completionTokens).toBe(130);
    expect(s.totalTokens).toBe(430);
  });

  it('resetTokens zeroes out all state', () => {
    recordUsage({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    resetTokens();
    expect(getLastTurn()).toBeNull();
    const s = getSession();
    expect(s.promptTokens).toBe(0);
    expect(s.totalTokens).toBe(0);
  });
});
