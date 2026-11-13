import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  initSession,
  setCurrentTask,
  recordStep,
  hasSteps,
  getSession,
  exportMarkdown,
  exportShell,
  exportHtml,
} from '../../src/runbook.js';

function makeStep(overrides: Partial<Parameters<typeof recordStep>[0]> = {}) {
  return {
    reasoning: 'test reasoning',
    toolName: 'read_file',
    toolArgs: { filepath: '/tmp/test.txt' },
    toolResult: 'file contents',
    ...overrides,
  };
}

// ── Null-session guard tests (session starts as null before initSession) ──────
// These run before the main describe's beforeEach calls initSession.
describe('runbook — null session guards', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'runbook-null-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('recordStep is a no-op when session has not been initialized', () => {
    recordStep(makeStep());
    expect(hasSteps()).toBe(false);
    expect(getSession()).toBeNull();
  });

  it('exportMarkdown throws when session is null', async () => {
    await expect(exportMarkdown(tmpDir)).rejects.toThrow('No active session');
  });

  it('exportShell throws when session is null', async () => {
    await expect(exportShell(tmpDir)).rejects.toThrow('No active session');
  });

  it('exportHtml throws when session is null', async () => {
    await expect(exportHtml(tmpDir)).rejects.toThrow('No active session');
  });
});

describe('runbook', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'runbook-test-'));
    // reset module-level state by calling initSession
    initSession('gpt-4.1-mini');
    setCurrentTask('');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('initSession', () => {
    it('creates a session with correct model', () => {
      initSession('test-model');
      const s = getSession();
      expect(s).not.toBeNull();
      expect(s!.model).toBe('test-model');
    });

    it('sets startedAt to a Date', () => {
      initSession('test-model');
      const s = getSession();
      expect(s!.startedAt).toBeInstanceOf(Date);
    });

    it('starts with no steps', () => {
      initSession('test-model');
      expect(hasSteps()).toBe(false);
    });
  });

  describe('recordStep', () => {
    it('appends steps in order', () => {
      recordStep(makeStep({ reasoning: 'step 1' }));
      recordStep(makeStep({ reasoning: 'step 2' }));
      const s = getSession()!;
      expect(s.steps).toHaveLength(2);
      expect(s.steps[0].reasoning).toBe('step 1');
      expect(s.steps[1].reasoning).toBe('step 2');
    });

    it('auto-increments stepNumber', () => {
      recordStep(makeStep());
      recordStep(makeStep());
      const s = getSession()!;
      expect(s.steps[0].stepNumber).toBe(1);
      expect(s.steps[1].stepNumber).toBe(2);
    });

    it('assigns current task to step', () => {
      setCurrentTask('my task');
      recordStep(makeStep());
      expect(getSession()!.steps[0].task).toBe('my task');
    });
  });

  describe('hasSteps', () => {
    it('returns false before any step', () => {
      expect(hasSteps()).toBe(false);
    });

    it('returns true after a step is recorded', () => {
      recordStep(makeStep());
      expect(hasSteps()).toBe(true);
    });
  });

  it('exportShell includes "No shell commands" comment when no run_command steps recorded', async () => {
    setCurrentTask('lint only');
    recordStep(makeStep({ toolName: 'read_file' }));
    const fp = await exportShell(tmpDir);
    const content = await readFile(fp, 'utf-8');
    expect(content).toContain('#!/bin/bash');
    expect(content).toContain('# No shell commands were executed');
  });

  describe('exports', () => {
    beforeEach(() => {
      setCurrentTask('deploy app');
      recordStep({
        reasoning: 'List the files',
        toolName: 'run_command',
        toolArgs: { command: 'ls -la' },
        toolResult: 'total 0\n-rw-r--r-- 1 user user 0 Jan 1 00:00 file.txt',
      });
    });

    it('exportMarkdown writes a .md file with expected content', async () => {
      const fp = await exportMarkdown(tmpDir);
      expect(fp.endsWith('.md')).toBe(true);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('# Agent Runbook');
      expect(content).toContain('deploy app');
      expect(content).toContain('run_command');
    });

    it('exportShell writes a .sh file with expected content', async () => {
      const fp = await exportShell(tmpDir);
      expect(fp.endsWith('.sh')).toBe(true);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('#!/bin/bash');
      expect(content).toContain('ls -la');
    });

    it('exportHtml writes an .html file with expected content', async () => {
      const fp = await exportHtml(tmpDir);
      expect(fp.endsWith('.html')).toBe(true);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain('deploy app');
    });

    it('exportMarkdown omits reasoning block when reasoning is empty', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('quiet task');
      recordStep({
        reasoning: '   ',
        toolName: 'read_file',
        toolArgs: { filepath: '/tmp/x.txt' },
        toolResult: 'hello',
      });
      const fp = await exportMarkdown(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).not.toContain('**Reasoning:**');
    });

    it('exportMarkdown truncates toolResult longer than 600 chars', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('long result');
      recordStep({
        reasoning: 'read big file',
        toolName: 'read_file',
        toolArgs: { filepath: '/tmp/big.txt' },
        toolResult: 'x'.repeat(700),
      });
      const fp = await exportMarkdown(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('... (truncated)');
    });

    it('exportMarkdown groups steps by task when multiple tasks are set', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('task-alpha');
      recordStep({ reasoning: 'do alpha', toolName: 'read_file', toolArgs: {}, toolResult: 'a' });
      setCurrentTask('task-beta');
      recordStep({ reasoning: 'do beta', toolName: 'write_file', toolArgs: {}, toolResult: 'b' });
      const fp = await exportMarkdown(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('task-alpha');
      expect(content).toContain('task-beta');
    });

    it('exportHtml uses fallback badge style for unknown tool names', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('unknown tool');
      recordStep({
        reasoning: 'using unknown tool',
        toolName: 'some_unknown_tool',
        toolArgs: {},
        toolResult: 'result',
      });
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('some_unknown_tool');
      expect(content).toContain('#8b949e');
    });

    it('exportHtml truncates toolResult longer than 800 chars', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('big result');
      recordStep({
        reasoning: 'read huge file',
        toolName: 'read_file',
        toolArgs: {},
        toolResult: 'y'.repeat(900),
      });
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('... (truncated)');
    });

    it('exportHtml shows preview ellipsis for reasoning longer than 80 chars', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('long reason');
      recordStep({
        reasoning: 'A'.repeat(90),
        toolName: 'run_command',
        toolArgs: { command: 'echo hi' },
        toolResult: 'hi',
      });
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('…');
    });

    it('exportHtml handles steps with empty reasoning (no reasoning block)', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('no reasoning');
      recordStep({
        reasoning: '',
        toolName: 'run_command',
        toolArgs: { command: 'ls' },
        toolResult: 'file.txt',
      });
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('run_command');
      expect(content).not.toContain('<div class="reasoning-block">');
    });

    it('exportHtml with multiple steps in same task (covers plural step count)', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('multi-step task');
      recordStep({ reasoning: 'step one', toolName: 'read_file', toolArgs: {}, toolResult: 'a' });
      recordStep({ reasoning: 'step two', toolName: 'write_file', toolArgs: {}, toolResult: 'b' });
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('2 steps');
    });

    it('exportHtml with multiple task groups (covers plural task count)', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('group-alpha');
      recordStep({ reasoning: 'alpha', toolName: 'read_file', toolArgs: {}, toolResult: 'a' });
      setCurrentTask('group-beta');
      recordStep({ reasoning: 'beta', toolName: 'write_file', toolArgs: {}, toolResult: 'b' });
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('2 tasks');
    });

    it('exportShell handles two run_command steps with same task (no duplicate header)', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('same-task');
      recordStep({ reasoning: 'first cmd', toolName: 'run_command', toolArgs: { command: 'echo 1' }, toolResult: '1' });
      recordStep({ reasoning: 'second cmd', toolName: 'run_command', toolArgs: { command: 'echo 2' }, toolResult: '2' });
      const fp = await exportShell(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content.match(/# ── Task: same-task/g)).toHaveLength(1);
    });

    it('exportShell skips reasoning comment when run_command step has empty reasoning', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('silent cmd');
      recordStep({ reasoning: '', toolName: 'run_command', toolArgs: { command: 'echo hi' }, toolResult: 'hi' });
      const fp = await exportShell(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('echo hi');
      const commentLines = content.split('\n').filter(l => l.startsWith('#'));
      expect(commentLines.some(l => l === '#')).toBe(false);
    });

    it('exportMarkdown with no steps uses "session" as filename slug', async () => {
      initSession('gpt-4.1-mini');
      const fp = await exportMarkdown(tmpDir);
      expect(fp).toContain('session');
    });

    it('exportShell with no steps uses empty task in header', async () => {
      initSession('gpt-4.1-mini');
      const fp = await exportShell(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('# Task:');
    });

    it('exportHtml with no steps uses "Session" as title fallback', async () => {
      initSession('gpt-4.1-mini');
      const fp = await exportHtml(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('Session');
    });

    it('exportShell uses empty string for run_command step with no command key', async () => {
      initSession('gpt-4.1-mini');
      setCurrentTask('no-cmd');
      recordStep({ reasoning: 'run it', toolName: 'run_command', toolArgs: {}, toolResult: 'ok' });
      const fp = await exportShell(tmpDir);
      const content = await readFile(fp, 'utf-8');
      expect(content).toContain('#!/bin/bash');
    });
  });
});
