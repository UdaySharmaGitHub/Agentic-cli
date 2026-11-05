import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, chmod, rm, access, writeFile as fsWriteFile } from 'node:fs/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

vi.mock('../../../src/ui.js', () => ({
  printToolHeader: vi.fn(),
  printToolSuccess: vi.fn(),
  printToolError: vi.fn(),
  printToolBlocked: vi.fn(),
  printRejected: vi.fn(),
  printDimOutput: vi.fn(),
  printSeparator: vi.fn(),
}));

import { execute } from '../../../src/tools/writeFile.js';

const approve = async () => true;
const reject = async () => false;

describe('writeFile tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'write-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates a new file with given content', async () => {
    const fp = path.join(tmpDir, 'new.txt');
    const result = await execute({ filepath: fp, content: 'hello' }, approve);
    expect(result.isError).toBe(false);
    const written = await readFile(fp, 'utf-8');
    expect(written).toContain('hello');
  });

  it('overwrites an existing file', async () => {
    const fp = path.join(tmpDir, 'existing.txt');
    await import('node:fs/promises').then(fs => fs.writeFile(fp, 'old', 'utf-8'));
    const result = await execute({ filepath: fp, content: 'new content' }, approve);
    expect(result.isError).toBe(false);
    const written = await readFile(fp, 'utf-8');
    expect(written).toContain('new content');
  });

  it('returns isError: true when user rejects', async () => {
    const fp = path.join(tmpDir, 'rejected.txt');
    const result = await execute({ filepath: fp, content: 'data' }, reject);
    expect(result.isError).toBe(true);
    await expect(access(fp)).rejects.toThrow();
  });

  it('blocks writing to protected paths', async () => {
    const result = await execute({ filepath: '/etc/passwd', content: 'x' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('protected');
  });

  it('handles content with more than 20 lines (shows truncation note)', async () => {
    const fp = path.join(tmpDir, 'long.txt');
    const content = Array.from({ length: 25 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = await execute({ filepath: fp, content }, approve);
    expect(result.isError).toBe(false);
    const written = await readFile(fp, 'utf-8');
    expect(written).toContain('line 1');
  });

  it('returns isError: true when write fails (read-only file)', async () => {
    const fp = path.join(tmpDir, 'perm.txt');
    await fsWriteFile(fp, 'existing', 'utf-8');
    await chmod(fp, 0o444);
    const result = await execute({ filepath: fp, content: 'new content' }, approve);
    await chmod(fp, 0o644);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('failed to write file');
  });

  it('uses String(err) for non-Error throw on writeFile failure', async () => {
    const fp = path.join(tmpDir, 'target.txt');
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce('write-string-error');
    const result = await execute({ filepath: fp, content: 'data' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('write-string-error');
    vi.restoreAllMocks();
  });
});
