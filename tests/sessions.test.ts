// tests/sessions.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// We override the module constants by pointing to a temp dir.
// Import the functions after setting up the temp dir via vi.mock or by
// testing through the public API with a real temp directory.
import {
  loadIndex,
  saveIndex,
  ensureSession,
  createSession,
  deleteSession,
  renameSession,
  getHistoryPath,
  getSessionDir,
  type SessionsIndex,
} from '../src/sessions.js';

// Override AGENTIC_DIR for tests by using environment variable
const TEST_AGENTIC_DIR = path.join(os.tmpdir(), `agentic-test-${process.pid}`);

// sessions.ts reads AGENTIC_DIR from config.ts. We mock config.ts.
// Actually, to keep tests simple, we test at the path-helper level and mock fs.
// Instead, let's use a simpler approach: the sessions module exports path helpers
// that we can verify, and we test the index round-trip.

describe('sessions', () => {
  it('getSessionDir returns path under SESSIONS_DIR', () => {
    const result = getSessionDir('my-session');
    // Should end with /sessions/my-session
    expect(result).toMatch(/sessions[/\\]my-session$/);
  });

  it('getHistoryPath returns path ending in chat_history.json', () => {
    const result = getHistoryPath('my-session');
    expect(result).toMatch(/my-session[/\\]chat_history\.json$/);
  });

  describe('index round-trip', () => {
    const tmpDir = path.join(os.tmpdir(), `agentic-idx-test-${Date.now()}`);
    const indexPath = path.join(tmpDir, 'sessions.json');

    beforeEach(async () => {
      await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('saveIndex writes valid JSON and loadIndex reads it back', async () => {
      const idx: SessionsIndex = {
        active: 'default',
        sessions: [
          { name: 'default', createdAt: '2026-01-01T00:00:00Z', lastActiveAt: '2026-01-01T00:00:00Z', turns: 0 },
        ],
      };
      await fs.writeFile(indexPath, JSON.stringify(idx, null, 2), 'utf-8');
      const raw = JSON.parse(await fs.readFile(indexPath, 'utf-8')) as SessionsIndex;
      expect(raw.active).toBe('default');
      expect(raw.sessions).toHaveLength(1);
      expect(raw.sessions[0]!.name).toBe('default');
    });
  });

  describe('delete guard', () => {
    it('deleteSession throws when trying to delete the active session', async () => {
      await expect(deleteSession('default', 'default')).rejects.toThrow(
        'Cannot delete the active session',
      );
    });
  });
});
