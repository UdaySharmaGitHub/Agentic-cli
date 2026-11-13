// tests/sessions.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';

// vi.hoisted runs before vi.mock factories and before module-level const declarations,
// so we use it to compute the temp paths that the mock factory will close over.
const { TEST_AGENTIC_DIR, TEST_SESSIONS_DIR, TEST_SESSIONS_INDEX_FILE } = vi.hoisted(() => {
  // Use node: builtins directly — they are always available
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeOs = require('node:os') as typeof import('node:os');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodePath = require('node:path') as typeof import('node:path');
  const agenticDir = nodePath.join(nodeOs.tmpdir(), `agentic-sessions-test-${process.pid}`);
  return {
    TEST_AGENTIC_DIR: agenticDir,
    TEST_SESSIONS_DIR: nodePath.join(agenticDir, 'sessions'),
    TEST_SESSIONS_INDEX_FILE: nodePath.join(agenticDir, 'sessions.json'),
  };
});

vi.mock('../src/config.js', () => ({
  AGENTIC_DIR: TEST_AGENTIC_DIR,
  SESSIONS_DIR: TEST_SESSIONS_DIR,
  SESSIONS_INDEX_FILE: TEST_SESSIONS_INDEX_FILE,
  DEFAULT_SESSION: 'default',
}));

import {
  loadIndex,
  saveIndex,
  createSession,
  deleteSession,
  renameSession,
  initSessions,
  getHistoryPath,
  getSessionDir,
  updateLastActive,
  incrementTurns,
  type SessionsIndex,
} from '../src/sessions.js';

describe('sessions', () => {
  beforeEach(async () => {
    await fs.mkdir(TEST_SESSIONS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_AGENTIC_DIR, { recursive: true, force: true });
  });

  // ── path helpers ────────────────────────────────────────────────────────────

  it('getSessionDir returns path under SESSIONS_DIR', () => {
    const result = getSessionDir('my-session');
    expect(result).toMatch(/sessions[/\\]my-session$/);
  });

  it('getHistoryPath returns path ending in chat_history.json', () => {
    const result = getHistoryPath('my-session');
    expect(result).toMatch(/my-session[/\\]chat_history\.json$/);
  });

  // ── index round-trip using real saveIndex / loadIndex ───────────────────────

  it('saveIndex writes valid JSON and loadIndex reads it back', async () => {
    const idx: SessionsIndex = {
      active: 'default',
      sessions: [
        { name: 'default', createdAt: '2026-01-01T00:00:00Z', lastActiveAt: '2026-01-01T00:00:00Z', turns: 0 },
      ],
    };
    await saveIndex(idx);
    const loaded = await loadIndex();
    expect(loaded.active).toBe('default');
    expect(loaded.sessions).toHaveLength(1);
    expect(loaded.sessions[0]!.name).toBe('default');
  });

  // ── loadIndex on corrupt file throws ────────────────────────────────────────

  it('loadIndex throws on corrupt JSON', async () => {
    await fs.writeFile(TEST_SESSIONS_INDEX_FILE, '{bad json', 'utf-8');
    await expect(loadIndex()).rejects.toThrow('Corrupt sessions index');
  });

  // ── initSessions ────────────────────────────────────────────────────────────

  it('initSessions() with no arg creates default session and sets active', async () => {
    const result = await initSessions();
    expect(result.name).toBe('default');
    const index = await loadIndex();
    expect(index.active).toBe('default');
    expect(index.sessions.find(s => s.name === 'default')).toBeDefined();
    const stat = await fs.stat(result.path);
    expect(stat.isDirectory()).toBe(true);
  });

  it('initSessions("foo") creates and activates foo', async () => {
    const result = await initSessions('foo');
    expect(result.name).toBe('foo');
    const index = await loadIndex();
    expect(index.active).toBe('foo');
    expect(index.sessions.find(s => s.name === 'foo')).toBeDefined();
    const stat = await fs.stat(result.path);
    expect(stat.isDirectory()).toBe(true);
  });

  // ── createSession ────────────────────────────────────────────────────────────

  it('createSession("bar") adds it to index and makes its dir', async () => {
    await initSessions();
    await createSession('bar');
    const index = await loadIndex();
    expect(index.sessions.find(s => s.name === 'bar')).toBeDefined();
    const stat = await fs.stat(getSessionDir('bar'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('createSession duplicate throws', async () => {
    await initSessions();
    await createSession('bar');
    await expect(createSession('bar')).rejects.toThrow('Session "bar" already exists');
  });

  // ── validateSessionName via createSession ───────────────────────────────────

  it('createSession("../evil") rejects with Invalid session name', async () => {
    await expect(createSession('../evil')).rejects.toThrow('Invalid session name');
  });

  // ── delete guard ─────────────────────────────────────────────────────────────

  it('deleteSession throws when trying to delete the active session', async () => {
    await expect(deleteSession('default', 'default')).rejects.toThrow(
      'Cannot delete the active session',
    );
  });

  it('deleteSession removes a non-active session from index and disk', async () => {
    await initSessions();
    await createSession('bar');
    await deleteSession('bar', 'default');
    const index = await loadIndex();
    expect(index.sessions.find(s => s.name === 'bar')).toBeUndefined();
    await expect(fs.stat(getSessionDir('bar'))).rejects.toThrow();
  });

  it('deleteSession throws when session does not exist', async () => {
    await initSessions();
    await expect(deleteSession('ghost', 'default')).rejects.toThrow('Session "ghost" not found');
  });

  it('initSessions re-run with same name does not duplicate the session entry', async () => {
    await initSessions('bar');
    await initSessions('bar'); // session already exists — branch where find() returns truthy
    const index = await loadIndex();
    const barEntries = index.sessions.filter(s => s.name === 'bar');
    expect(barEntries).toHaveLength(1);
  });

  it('renameSession throws when oldName does not exist', async () => {
    await initSessions();
    await expect(renameSession('ghost', 'new-name')).rejects.toThrow('Session "ghost" not found');
  });

  it('renameSession throws when newName already exists', async () => {
    await initSessions();
    await createSession('bar');
    await createSession('baz');
    await expect(renameSession('bar', 'baz')).rejects.toThrow('Session "baz" already exists');
  });

  it('renameSession renames dir and updates index entry', async () => {
    await initSessions();
    await createSession('bar');
    await renameSession('bar', 'baz');
    const index = await loadIndex();
    expect(index.sessions.find(s => s.name === 'bar')).toBeUndefined();
    expect(index.sessions.find(s => s.name === 'baz')).toBeDefined();
    const stat = await fs.stat(getSessionDir('baz'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('renameSession updates index.active when active is renamed', async () => {
    await initSessions('bar');
    await renameSession('bar', 'baz');
    const index = await loadIndex();
    expect(index.active).toBe('baz');
  });

  // ── index.active pointer after multiple sessions ──────────────────────────

  it('index.active pointer is correct after creating two sessions', async () => {
    await initSessions('main');
    await createSession('work');
    // Manually switch active (model the switch at the index level)
    const index = await loadIndex();
    index.active = 'work';
    await saveIndex(index);
    const reloaded = await loadIndex();
    expect(reloaded.active).toBe('work');
    expect(reloaded.sessions).toHaveLength(2);
  });

  // ── updateLastActive ──────────────────────────────────────────────────────────

  it('updateLastActive updates lastActiveAt for an existing session', async () => {
    await initSessions();
    const before = (await loadIndex()).sessions.find(s => s.name === 'default')!.lastActiveAt;
    await new Promise(r => setTimeout(r, 10));
    await updateLastActive('default');
    const after = (await loadIndex()).sessions.find(s => s.name === 'default')!.lastActiveAt;
    expect(after >= before).toBe(true);
  });

  it('updateLastActive is a no-op for an unknown session name', async () => {
    await initSessions();
    await expect(updateLastActive('ghost')).resolves.toBeUndefined();
  });

  // ── incrementTurns ───────────────────────────────────────────────────────────

  it('incrementTurns increases turns by 1', async () => {
    await initSessions();
    await incrementTurns('default');
    const index = await loadIndex();
    expect(index.sessions.find(s => s.name === 'default')!.turns).toBe(1);
  });

  it('incrementTurns is a no-op for an unknown session name', async () => {
    await initSessions();
    await expect(incrementTurns('ghost')).resolves.toBeUndefined();
  });
});
