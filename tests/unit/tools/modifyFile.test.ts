import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, readFile, chmod, rm } from 'node:fs/promises';
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

import { execute } from '../../../src/tools/modifyFile.js';

const approve = async () => true;

describe('modifyFile tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'modify-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('replaces a specific substring in a file', async () => {
    const fp = path.join(tmpDir, 'file.txt');
    await writeFile(fp, 'hello world', 'utf-8');
    const result = await execute({ filepath: fp, find: 'world', replace: 'there' }, approve);
    expect(result.isError).toBe(false);
    const content = await readFile(fp, 'utf-8');
    expect(content).toContain('there');
    expect(content).not.toContain('world');
  });

  it('returns isError: true when find text is not found', async () => {
    const fp = path.join(tmpDir, 'file.txt');
    await writeFile(fp, 'hello world', 'utf-8');
    const result = await execute({ filepath: fp, find: 'nonexistent', replace: 'x' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('not found');
  });

  it('returns isError: true when file does not exist', async () => {
    const fp = path.join(tmpDir, 'missing.txt');
    const result = await execute({ filepath: fp, find: 'x', replace: 'y' }, approve);
    expect(result.isError).toBe(true);
  });

  it('returns isError: true when user rejects', async () => {
    const fp = path.join(tmpDir, 'file.txt');
    await writeFile(fp, 'hello world', 'utf-8');
    const result = await execute({ filepath: fp, find: 'world', replace: 'there' }, async () => false);
    expect(result.isError).toBe(true);
    const content = await readFile(fp, 'utf-8');
    expect(content).toContain('world');
  });

  it('blocks modifying protected paths', async () => {
    const result = await execute({ filepath: '/etc/passwd', find: 'root', replace: 'evil' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('protected');
  });

  it('returns isError: true when write fails (read-only file)', async () => {
    const fp = path.join(tmpDir, 'readonly.txt');
    await writeFile(fp, 'hello world', 'utf-8');
    await chmod(fp, 0o444);
    const result = await execute({ filepath: fp, find: 'world', replace: 'there' }, approve);
    await chmod(fp, 0o644);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('modification failed');
  });

  it('uses String(err) for non-Error throw on writeFile failure', async () => {
    const fp = path.join(tmpDir, 'modify-target.txt');
    await writeFile(fp, 'hello world', 'utf-8');
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce('write-string-error');
    const result = await execute({ filepath: fp, find: 'world', replace: 'there' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('write-string-error');
    vi.restoreAllMocks();
  });
});
