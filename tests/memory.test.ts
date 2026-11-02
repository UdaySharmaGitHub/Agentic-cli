// tests/memory.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadHistory, saveHistory, clearMessages, pushMessage, getMessages } from '../src/memory.js';

describe('memory persistence', () => {
  let tmpDir: string;
  let historyFile: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `agentic-mem-test-${Date.now()}`);
    await fs.mkdir(tmpDir, { recursive: true });
    historyFile = path.join(tmpDir, 'chat_history.json');
    clearMessages();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    clearMessages();
  });

  it('saveHistory writes messages to sessionPath/chat_history.json', async () => {
    pushMessage({ role: 'user', content: 'hello' });
    pushMessage({ role: 'assistant', content: 'hi there' });

    await saveHistory(tmpDir);

    const raw = JSON.parse(await fs.readFile(historyFile, 'utf-8')) as unknown[];
    expect(raw).toHaveLength(2);
  });

  it('loadHistory reads messages from sessionPath/chat_history.json', async () => {
    const msgs = [
      { role: 'user', content: 'foo' },
      { role: 'assistant', content: 'bar' },
    ];
    await fs.writeFile(historyFile, JSON.stringify(msgs), 'utf-8');

    await loadHistory(tmpDir);

    expect(getMessages()).toHaveLength(2);
    expect(getMessages()[0]).toMatchObject({ role: 'user', content: 'foo' });
  });

  it('loadHistory on missing file starts with empty history', async () => {
    await loadHistory(path.join(tmpDir, 'nonexistent'));
    expect(getMessages()).toHaveLength(0);
  });

  it('save → load round-trip preserves all messages', async () => {
    pushMessage({ role: 'user', content: 'round-trip test' });
    await saveHistory(tmpDir);
    clearMessages();
    await loadHistory(tmpDir);
    expect(getMessages()[0]).toMatchObject({ role: 'user', content: 'round-trip test' });
  });

  it('history is isolated between session paths', async () => {
    const sessionA = path.join(os.tmpdir(), `session-a-${Date.now()}`);
    const sessionB = path.join(os.tmpdir(), `session-b-${Date.now()}`);
    await fs.mkdir(sessionA, { recursive: true });
    await fs.mkdir(sessionB, { recursive: true });

    try {
      pushMessage({ role: 'user', content: 'from session A' });
      await saveHistory(sessionA);

      clearMessages();
      pushMessage({ role: 'user', content: 'from session B' });
      await saveHistory(sessionB);

      clearMessages();
      await loadHistory(sessionA);
      expect(getMessages()[0]).toMatchObject({ content: 'from session A' });

      clearMessages();
      await loadHistory(sessionB);
      expect(getMessages()[0]).toMatchObject({ content: 'from session B' });
    } finally {
      await fs.rm(sessionA, { recursive: true, force: true });
      await fs.rm(sessionB, { recursive: true, force: true });
    }
  });
});
