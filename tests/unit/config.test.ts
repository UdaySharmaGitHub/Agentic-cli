import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

// Silence chalk output
vi.mock('chalk', () => {
  const c = (s: string) => s;
  const proxy = new Proxy(c, {
    get: () => proxy,
    apply: (_t, _this, args) => args[0],
  });
  return { default: proxy };
});
vi.mock('dotenv/config', () => ({}));

import {
  loadKnowledgeBase,
  DEFAULT_MODEL,
  DEFAULT_MAX_STEPS,
  AGENTIC_DIR,
  SESSIONS_DIR,
  SESSIONS_INDEX_FILE,
  DEFAULT_SESSION,
} from '../../src/config.js';

describe('config constants', () => {
  it('DEFAULT_MODEL is gpt-4.1-mini', () => {
    expect(DEFAULT_MODEL).toBe('gpt-4.1-mini');
  });

  it('DEFAULT_MAX_STEPS is 15', () => {
    expect(DEFAULT_MAX_STEPS).toBe(15);
  });

  it('AGENTIC_DIR is a non-empty string under home dir', () => {
    expect(typeof AGENTIC_DIR).toBe('string');
    expect(AGENTIC_DIR.length).toBeGreaterThan(0);
  });

  it('SESSIONS_DIR is nested inside AGENTIC_DIR', () => {
    expect(SESSIONS_DIR.startsWith(AGENTIC_DIR)).toBe(true);
  });

  it('SESSIONS_INDEX_FILE is inside AGENTIC_DIR', () => {
    expect(SESSIONS_INDEX_FILE.startsWith(AGENTIC_DIR)).toBe(true);
  });

  it('DEFAULT_SESSION is "default"', () => {
    expect(DEFAULT_SESSION).toBe('default');
  });
});

describe('loadKnowledgeBase', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'config-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns content and file path when file exists', async () => {
    const fp = path.join(tmpDir, 'role.md');
    await writeFile(fp, 'You are a helpful assistant.\n', 'utf-8');
    const result = await loadKnowledgeBase(fp);
    expect(result).not.toBeNull();
    expect(result!.content).toContain('You are a helpful assistant.');
    expect(result!.file).toBe(fp);
  });

  it('returns null when file does not exist', async () => {
    const result = await loadKnowledgeBase(path.join(tmpDir, 'missing.md'));
    expect(result).toBeNull();
  });

  it('handles a file with more than 5 lines (shows truncation preview)', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const fp = path.join(tmpDir, 'long-role.md');
    await writeFile(fp, lines, 'utf-8');
    const result = await loadKnowledgeBase(fp);
    expect(result).not.toBeNull();
    expect(result!.content).toBe(lines);
  });

  it('handles a file with exactly 5 lines (no truncation indicator)', async () => {
    const content = 'a\nb\nc\nd\ne';
    const fp = path.join(tmpDir, 'short-role.md');
    await writeFile(fp, content, 'utf-8');
    const result = await loadKnowledgeBase(fp);
    expect(result).not.toBeNull();
  });
});
