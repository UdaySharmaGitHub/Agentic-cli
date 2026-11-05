import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
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

import { execute } from '../../../src/tools/appendFile.js';

const approve = async () => true;

describe('appendFile tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'append-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appends content to an existing file', async () => {
    const fp = path.join(tmpDir, 'data.txt');
    await writeFile(fp, 'line1', 'utf-8');
    const result = await execute({ filepath: fp, content: 'line2' }, approve);
    expect(result.isError).toBe(false);
    const content = await readFile(fp, 'utf-8');
    expect(content).toContain('line1');
    expect(content).toContain('line2');
  });

  it('creates the file if it does not exist', async () => {
    const fp = path.join(tmpDir, 'new.txt');
    const result = await execute({ filepath: fp, content: 'first line' }, approve);
    expect(result.isError).toBe(false);
    const content = await readFile(fp, 'utf-8');
    expect(content).toContain('first line');
  });

  it('returns isError: true when user rejects', async () => {
    const fp = path.join(tmpDir, 'data.txt');
    await writeFile(fp, 'existing', 'utf-8');
    const result = await execute({ filepath: fp, content: 'rejected' }, async () => false);
    expect(result.isError).toBe(true);
  });

  it('blocks appending to protected paths', async () => {
    const result = await execute({ filepath: '/etc/passwd', content: 'x' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('protected');
  });

  it('returns isError: true when parent directory does not exist', async () => {
    const fp = path.join(tmpDir, 'no-such-dir', 'file.txt');
    const result = await execute({ filepath: fp, content: 'data' }, approve);
    expect(result.isError).toBe(true);
  });

  it('uses String(err) for non-Error throw on appendFile failure', async () => {
    const fp = path.join(tmpDir, 'x.txt');
    await writeFile(fp, 'existing', 'utf-8');
    vi.spyOn(fs, 'appendFile').mockRejectedValueOnce('append-failed');
    const result = await execute({ filepath: fp, content: 'data' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('append-failed');
    vi.restoreAllMocks();
  });
});
