import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const execaMock = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('execa', () => execaMock);

vi.mock('../../../src/ui.js', () => ({
  printToolHeader: vi.fn(),
  printToolSuccess: vi.fn(),
  printToolError: vi.fn(),
  printToolBlocked: vi.fn(),
  printRejected: vi.fn(),
  printDimOutput: vi.fn(),
  printSeparator: vi.fn(),
}));

import { execute } from '../../../src/tools/listDir.js';

const approve = async () => true;

describe('listDir tool', () => {
  let tmpDir: string;

  beforeAll(async () => {
    const realMod = await vi.importActual<typeof import('execa')>('execa');
    execaMock.execa.mockImplementation((...args: Parameters<typeof realMod.execa>) => realMod.execa(...args));
  });

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'listdir-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('lists entries in a real temp directory', async () => {
    await writeFile(path.join(tmpDir, 'a.txt'), 'a', 'utf-8');
    await writeFile(path.join(tmpDir, 'b.txt'), 'b', 'utf-8');
    const result = await execute({ path: tmpDir }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain(tmpDir);
  });

  it('handles a non-existent path gracefully (returns output without crashing)', async () => {
    const result = await execute({ path: path.join(tmpDir, 'no-such-dir') }, approve);
    expect(typeof result.output).toBe('string');
  });

  it('returns isError: true when user rejects', async () => {
    const result = await execute({ path: tmpDir }, async () => false);
    expect(result.isError).toBe(true);
  });

  it('returns isError: true when execa throws unexpectedly', async () => {
    execaMock.execa.mockRejectedValueOnce(new Error('spawn ENOENT'));
    const result = await execute({ path: tmpDir }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('ENOENT');
  });

  it('uses String(err) for non-Error throw from execa', async () => {
    execaMock.execa.mockRejectedValueOnce('ls-string-error');
    const result = await execute({ path: tmpDir }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('ls-string-error');
  });

  it('uses current directory as default when no path argument is given', async () => {
    const result = await execute({} as { path: string }, approve);
    expect(typeof result.output).toBe('string');
  });
});
