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

// execa mock — configured per-test via execaMock.execa
const execaMock = vi.hoisted(() => ({ execa: vi.fn() }));
vi.mock('execa', () => execaMock);

import { execute } from '../../../src/tools/runCommand.js';

const approve = async () => true;
const reject = async () => false;

function realExeca(cmd: string, args: string[], opts: Record<string, unknown>) {
  return import('child_process').then(cp =>
    new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
      const proc = cp.spawn('bash', ['-c', cmd], { ...opts as object });
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('close', (code: number) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    })
  );
}

describe('runCommand tool', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'runcmd-test-'));
    // Default: delegate to real bash via a minimal implementation
    execaMock.execa.mockImplementation((_bin: string, _args: string[], opts: { reject?: boolean; timeout?: number }) => {
      const cmd = _args[1] as string; // bash -c <cmd>
      return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
        import('child_process').then(cp => {
          const proc = cp.spawn('bash', ['-c', cmd], { cwd: process.cwd() });
          let stdout = '';
          let stderr = '';
          proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
          proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
          proc.on('close', (code: number) => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode: code ?? 0 }));
        });
      });
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    execaMock.execa.mockReset();
  });

  it('executes echo and captures stdout', async () => {
    const result = await execute({ command: 'echo hello' }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('hello');
  });

  it('returns isError: true when confirm returns false', async () => {
    const result = await execute({ command: 'echo hello' }, reject);
    expect(result.isError).toBe(true);
    expect(execaMock.execa).not.toHaveBeenCalled();
  });

  it('returns isError: true on non-zero exit code', async () => {
    const result = await execute({ command: 'exit 1' }, approve);
    expect(result.isError).toBe(true);
  });

  it('blocks rm -rf / before execution', async () => {
    const confirmSpy = vi.fn(async () => true);
    const result = await execute({ command: 'rm -rf /' }, confirmSpy);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('blocked');
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(execaMock.execa).not.toHaveBeenCalled();
  });

  it('captures output from a real file operation', async () => {
    const fp = path.join(tmpDir, 'test.txt');
    await writeFile(fp, 'world', 'utf-8');
    const result = await execute({ command: `cat ${fp}` }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('world');
  });

  it('returns isError: true when execa itself throws', async () => {
    execaMock.execa.mockRejectedValueOnce(new Error('spawn ENOENT'));
    const result = await execute({ command: 'missing-binary' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('ERROR');
  });

  it('uses String(err) for non-Error throw from execa', async () => {
    execaMock.execa.mockRejectedValueOnce('non-error-string');
    const result = await execute({ command: 'echo hello' }, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('non-error-string');
  });
});
