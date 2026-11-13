import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.hoisted ensures mockFs is defined before vi.mock() factories run
const mockFs = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({ default: mockFs }));
vi.mock('chalk', () => ({ default: { cyan: Object.assign((s: string) => s, { bold: (s: string) => s }) } }));

import {
  getMessages,
  pushMessage,
  clearMessages,
  messageCount,
  loadHistory,
  saveHistory,
} from '../../src/memory.js';
import type { ChatMessage } from '../../src/memory.js';

describe('memory', () => {
  beforeEach(() => {
    clearMessages();
  });

  it('starts with an empty message list', () => {
    expect(getMessages()).toEqual([]);
    expect(messageCount()).toBe(0);
  });

  it('pushMessage appends messages', () => {
    const msg: ChatMessage = { role: 'user', content: 'hello' };
    pushMessage(msg);
    expect(getMessages()).toHaveLength(1);
    expect(getMessages()[0]).toEqual(msg);
  });

  it('clearMessages resets to empty', () => {
    pushMessage({ role: 'user', content: 'a' });
    pushMessage({ role: 'user', content: 'b' });
    clearMessages();
    expect(getMessages()).toEqual([]);
    expect(messageCount()).toBe(0);
  });

  it('messageCount tracks pushes and clears', () => {
    expect(messageCount()).toBe(0);
    pushMessage({ role: 'user', content: 'x' });
    expect(messageCount()).toBe(1);
    pushMessage({ role: 'user', content: 'y' });
    expect(messageCount()).toBe(2);
    clearMessages();
    expect(messageCount()).toBe(0);
  });

  it('handles assistant message with tool_calls', () => {
    const msg: ChatMessage = {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{}' } },
      ],
    };
    pushMessage(msg);
    const stored = getMessages()[0] as Extract<ChatMessage, { role: 'assistant' }>;
    expect(stored.role).toBe('assistant');
    expect(stored.tool_calls).toHaveLength(1);
    expect(stored.tool_calls![0].function.name).toBe('read_file');
  });

  it('handles tool role message', () => {
    const msg: ChatMessage = { role: 'tool', tool_call_id: 'call-1', content: 'file contents' };
    pushMessage(msg);
    const stored = getMessages()[0] as Extract<ChatMessage, { role: 'tool' }>;
    expect(stored.role).toBe('tool');
    expect(stored.tool_call_id).toBe('call-1');
    expect(stored.content).toBe('file contents');
  });

  it('preserves insertion order', () => {
    pushMessage({ role: 'user', content: 'first' });
    pushMessage({ role: 'assistant', content: 'second' });
    const msgs = getMessages();
    expect((msgs[0] as { content: string }).content).toBe('first');
    expect((msgs[1] as { content: string }).content).toBe('second');
  });
});

describe('memory — loadHistory', () => {
  beforeEach(() => {
    clearMessages();
    mockFs.readFile.mockReset();
  });

  it('loads messages from the history file', async () => {
    const stored: ChatMessage[] = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ];
    mockFs.readFile.mockResolvedValueOnce(JSON.stringify(stored));
    await loadHistory('/test/session');
    expect(getMessages()).toEqual(stored);
    expect(messageCount()).toBe(2);
  });

  it('starts fresh when history file does not exist', async () => {
    mockFs.readFile.mockRejectedValueOnce(new Error('ENOENT'));
    await loadHistory('/test/session');
    expect(getMessages()).toEqual([]);
  });

  it('starts fresh when history file contains invalid JSON', async () => {
    mockFs.readFile.mockRejectedValueOnce(new SyntaxError('Unexpected token'));
    await loadHistory('/test/session');
    expect(getMessages()).toEqual([]);
  });
});

describe('memory — saveHistory', () => {
  beforeEach(() => {
    clearMessages();
    mockFs.writeFile.mockReset();
    mockFs.mkdir.mockReset();
    mockFs.mkdir.mockResolvedValue(undefined);
  });

  it('writes current messages as JSON to the history file', async () => {
    mockFs.writeFile.mockResolvedValueOnce(undefined);
    pushMessage({ role: 'user', content: 'test message' });
    await saveHistory('/test/session');
    expect(mockFs.writeFile).toHaveBeenCalledOnce();
    const [, data] = mockFs.writeFile.mock.calls[0];
    const parsed = JSON.parse(data as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ role: 'user', content: 'test message' });
  });

  it('silently ignores write failures', async () => {
    mockFs.writeFile.mockRejectedValueOnce(new Error('EACCES'));
    pushMessage({ role: 'user', content: 'x' });
    await expect(saveHistory('/test/session')).resolves.toBeUndefined();
  });
});
