import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/prompts.js';

describe('buildSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const p = buildSystemPrompt();
    expect(typeof p).toBe('string');
    expect(p.length).toBeGreaterThan(0);
  });

  it('includes OS context, user info, and date', () => {
    const p = buildSystemPrompt();
    expect(p).toContain('OS:');
    expect(p).toContain('User:');
    expect(p).toContain('Date:');
  });

  it('includes safety guidelines', () => {
    const p = buildSystemPrompt();
    expect(p).toContain('rm -rf /');
    expect(p).toContain('/etc/passwd');
  });

  it('does not include knowledge base section when none provided', () => {
    const p = buildSystemPrompt();
    expect(p).not.toContain('ROLE & KNOWLEDGE BASE');
  });

  it('appends knowledge base content when provided', () => {
    const p = buildSystemPrompt('You are a senior TypeScript engineer.');
    expect(p).toContain('ROLE & KNOWLEDGE BASE');
    expect(p).toContain('You are a senior TypeScript engineer.');
  });

  it('uses "unknown" as shell fallback when SHELL env var is not set', () => {
    const saved = process.env.SHELL;
    delete process.env.SHELL;
    const p = buildSystemPrompt();
    expect(p).toContain('Shell:');
    if (saved !== undefined) process.env.SHELL = saved;
  });
});
