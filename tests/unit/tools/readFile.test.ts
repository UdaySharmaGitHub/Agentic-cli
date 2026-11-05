import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

// Silence console output from tool modules during tests
vi.mock('../../../src/ui.js', () => ({
  printToolHeader: vi.fn(),
  printToolSuccess: vi.fn(),
  printToolError: vi.fn(),
  printToolBlocked: vi.fn(),
  printRejected: vi.fn(),
  printDimOutput: vi.fn(),
  printSeparator: vi.fn(),
}));

import { execute } from '../../../src/tools/readFile.js';

const approve = async () => true;
const reject = async () => false;

describe('readFile tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'read-test-'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads an existing file and returns its content', async () => {
    const fp = path.join(tmpDir, 'hello.txt');
    await writeFile(fp, 'hello world', 'utf-8');
    const result = await execute({ filepath: fp }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('hello world');
  });

  it('returns isError: true when file does not exist', async () => {
    const fp = path.join(tmpDir, 'nonexistent.txt');
    const result = await execute({ filepath: fp }, approve);
    expect(result.isError).toBe(true);
  });

  it('returns isError: true when user rejects', async () => {
    const fp = path.join(tmpDir, 'hello.txt');
    await writeFile(fp, 'data', 'utf-8');
    const result = await execute({ filepath: fp }, reject);
    expect(result.isError).toBe(true);
  });

  it('blocks reading protected paths', async () => {
    const result = await execute({ filepath: '/etc/passwd' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('protected');
  });

  it('handles a file with more than 80 lines (shows truncation note)', async () => {
    const fp = path.join(tmpDir, 'long.txt');
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    await writeFile(fp, lines, 'utf-8');
    const result = await execute({ filepath: fp }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('line 1');
  });

  it('truncates content longer than 12000 chars', async () => {
    const fp = path.join(tmpDir, 'big.txt');
    await writeFile(fp, 'x'.repeat(13_000), 'utf-8');
    const result = await execute({ filepath: fp }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('truncated');
  });

  it('uses String(err) for non-Error catch on stat failure', async () => {
    const fp = path.join(tmpDir, 'existing.txt');
    await writeFile(fp, 'data', 'utf-8');
    vi.spyOn(fs, 'stat').mockRejectedValueOnce('stat-failed');
    const result = await execute({ filepath: fp }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('stat-failed');
  });
});
