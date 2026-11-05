import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  initSession,
  setCurrentTask,
  recordStep,
  exportMarkdown,
  exportShell,
  exportHtml,
} from '../../src/runbook.js';
import { parseShellRunbook } from '../../src/replay.js';

describe('runbook export → replay round-trip', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'roundtrip-test-'));
    initSession('gpt-4.1-mini');
    setCurrentTask('build project');
    recordStep({
      reasoning: 'Install dependencies',
      toolName: 'run_command',
      toolArgs: { command: 'npm install' },
      toolResult: 'added 100 packages',
    });
    recordStep({
      reasoning: 'Run tests',
      toolName: 'run_command',
      toolArgs: { command: 'npm test' },
      toolResult: 'All tests passed',
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('shell export → parseShellRunbook round-trip is lossless', async () => {
    const fp = await exportShell(tmpDir);
    const parsed = await parseShellRunbook(fp);

    expect(parsed.task).toBe('build project');
    expect(parsed.model).toBe('gpt-4.1-mini');
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].command).toBe('npm install');
    expect(parsed.steps[0].reasoning).toBe('Install dependencies');
    expect(parsed.steps[1].command).toBe('npm test');
    expect(parsed.steps[1].reasoning).toBe('Run tests');
  });

  it('markdown export produces a file containing all recorded tasks and tools', async () => {
    const fp = await exportMarkdown(tmpDir);
    const content = await readFile(fp, 'utf-8');

    expect(content).toContain('# Agent Runbook');
    expect(content).toContain('build project');
    expect(content).toContain('npm install');
    expect(content).toContain('npm test');
    expect(content).toContain('Install dependencies');
  });

  it('html export produces a valid HTML file with session data', async () => {
    const fp = await exportHtml(tmpDir);
    const content = await readFile(fp, 'utf-8');

    expect(content.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(content).toContain('build project');
    expect(content).toContain('npm install');
    expect(content).toContain('gpt-4.1-mini');
  });

  it('all three formats write to the given output directory', async () => {
    const mdPath = await exportMarkdown(tmpDir);
    const shPath = await exportShell(tmpDir);
    const htmlPath = await exportHtml(tmpDir);

    expect(path.dirname(mdPath)).toBe(tmpDir);
    expect(path.dirname(shPath)).toBe(tmpDir);
    expect(path.dirname(htmlPath)).toBe(tmpDir);
  });
});
