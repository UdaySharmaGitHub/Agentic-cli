import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { resolvePath } from '../../../src/tools/helpers.js';

describe('resolvePath', () => {
  const ORIG_HOME = process.env.HOME;

  afterEach(() => {
    process.env.HOME = ORIG_HOME;
  });

  it('resolves a relative path to absolute', () => {
    const result = resolvePath('./src/index.ts');
    expect(path.isAbsolute(result)).toBe(true);
    expect(result).toContain('src/index.ts');
  });

  it('resolves an already-absolute path unchanged', () => {
    const result = resolvePath('/tmp/file.txt');
    expect(result).toBe('/tmp/file.txt');
  });

  it('expands a tilde path to the HOME directory', () => {
    process.env.HOME = '/Users/testuser';
    const result = resolvePath('~/Documents/notes.txt');
    expect(result).toBe('/Users/testuser/Documents/notes.txt');
  });

  it('uses / as fallback when HOME is not set', () => {
    delete process.env.HOME;
    const result = resolvePath('~/notes.txt');
    expect(result).toBe('/notes.txt');
  });
});
