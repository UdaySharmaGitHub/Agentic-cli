import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
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

// fast-glob mock — override per test via fgMock.default
const fgMock = vi.hoisted(() => ({ default: vi.fn() }));
vi.mock('fast-glob', () => fgMock);

import { execute } from '../../../src/tools/searchFiles.js';

const approve = async () => true;

// Real fast-glob for most tests
async function realFg(pattern: string, opts: { cwd: string; dot: boolean; onlyFiles: boolean; ignore: string[] }) {
  const { default: fg } = await vi.importActual<typeof import('fast-glob')>('fast-glob');
  return fg(pattern, opts);
}

describe('searchFiles tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'search-test-'));
    // Default: delegate to real fast-glob
    fgMock.default.mockImplementation(realFg);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    fgMock.default.mockReset();
  });

  it('returns matching file paths for a glob pattern', async () => {
    await writeFile(path.join(tmpDir, 'foo.ts'), '', 'utf-8');
    await writeFile(path.join(tmpDir, 'bar.ts'), '', 'utf-8');
    await writeFile(path.join(tmpDir, 'baz.txt'), '', 'utf-8');
    const result = await execute({ pattern: '*.ts', directory: tmpDir }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('foo.ts');
    expect(result.output).toContain('bar.ts');
    expect(result.output).not.toContain('baz.txt');
  });

  it('returns an empty result (not error) when no files match', async () => {
    const result = await execute({ pattern: '*.nonexistent', directory: tmpDir }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('No files found');
  });

  it('returns isError: true when user rejects', async () => {
    const result = await execute({ pattern: '*.ts', directory: tmpDir }, async () => false);
    expect(result.isError).toBe(true);
  });

  it('handles more than 100 matching files (shows truncation note)', async () => {
    const files = Array.from({ length: 105 }, (_, i) => `f${i}.ts`);
    fgMock.default.mockResolvedValueOnce(files);
    const result = await execute({ pattern: '*.ts', directory: tmpDir }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('105 files');
  });

  it('returns isError: true when fast-glob throws', async () => {
    fgMock.default.mockRejectedValueOnce(new Error('glob error'));
    const result = await execute({ pattern: '*.ts', directory: tmpDir }, approve);
    expect(result.isError).toBe(true);
  });

  it('uses String(err) for non-Error throw from fast-glob', async () => {
    fgMock.default.mockRejectedValueOnce('glob-string-error');
    const result = await execute({ pattern: '*.ts', directory: tmpDir }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('glob-string-error');
  });

  it('defaults to current directory when no directory argument is provided', async () => {
    fgMock.default.mockResolvedValueOnce([]);
    const result = await execute({ pattern: '*.ts' }, approve);
    expect(result.isError).toBe(false);
  });
});
