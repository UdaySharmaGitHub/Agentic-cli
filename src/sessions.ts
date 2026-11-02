// src/sessions.ts
import fs from 'node:fs/promises';
import path from 'node:path';
import { SESSIONS_DIR, SESSIONS_INDEX_FILE, DEFAULT_SESSION } from './config.js';

export interface SessionEntry {
  name: string;
  createdAt: string;
  lastActiveAt: string;
  turns: number;
}

export interface SessionsIndex {
  active: string;
  sessions: SessionEntry[];
}

export function getSessionDir(name: string): string {
  return path.join(SESSIONS_DIR, name);
}

export function getHistoryPath(name: string): string {
  return path.join(SESSIONS_DIR, name, 'chat_history.json');
}

export async function loadIndex(): Promise<SessionsIndex> {
  try {
    const data = await fs.readFile(SESSIONS_INDEX_FILE, 'utf-8');
    return JSON.parse(data) as SessionsIndex;
  } catch {
    return { active: DEFAULT_SESSION, sessions: [] };
  }
}

export async function saveIndex(index: SessionsIndex): Promise<void> {
  const dir = path.dirname(SESSIONS_INDEX_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(SESSIONS_INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

export async function ensureSession(name: string): Promise<void> {
  await fs.mkdir(getSessionDir(name), { recursive: true });
}

/** Bootstrap on startup. Returns the active session name and its directory path. */
export async function initSessions(requested?: string): Promise<{ name: string; path: string }> {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  const index = await loadIndex();

  const targetName = requested ?? index.active ?? DEFAULT_SESSION;

  if (!index.sessions.find(s => s.name === targetName)) {
    const now = new Date().toISOString();
    index.sessions.push({ name: targetName, createdAt: now, lastActiveAt: now, turns: 0 });
  }
  index.active = targetName;

  await ensureSession(targetName);
  await saveIndex(index);

  return { name: targetName, path: getSessionDir(targetName) };
}

export async function createSession(name: string): Promise<void> {
  const index = await loadIndex();
  if (index.sessions.find(s => s.name === name)) {
    throw new Error(`Session "${name}" already exists`);
  }
  const now = new Date().toISOString();
  index.sessions.push({ name, createdAt: now, lastActiveAt: now, turns: 0 });
  await ensureSession(name);
  await saveIndex(index);
}

export async function deleteSession(name: string, active: string): Promise<void> {
  if (name === active) {
    throw new Error('Cannot delete the active session. Switch to another session first.');
  }
  const index = await loadIndex();
  const exists = index.sessions.find(s => s.name === name);
  if (!exists) throw new Error(`Session "${name}" not found`);
  index.sessions = index.sessions.filter(s => s.name !== name);
  await saveIndex(index);
  await fs.rm(getSessionDir(name), { recursive: true, force: true });
}

export async function renameSession(oldName: string, newName: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.sessions.find(s => s.name === oldName);
  if (!entry) throw new Error(`Session "${oldName}" not found`);
  if (index.sessions.find(s => s.name === newName)) {
    throw new Error(`Session "${newName}" already exists`);
  }
  // Rename directory
  await fs.rename(getSessionDir(oldName), getSessionDir(newName));
  entry.name = newName;
  if (index.active === oldName) index.active = newName;
  await saveIndex(index);
}

export async function updateLastActive(name: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.sessions.find(s => s.name === name);
  if (entry) {
    entry.lastActiveAt = new Date().toISOString();
    await saveIndex(index);
  }
}

export async function incrementTurns(name: string): Promise<void> {
  const index = await loadIndex();
  const entry = index.sessions.find(s => s.name === name);
  if (entry) {
    entry.turns += 1;
    entry.lastActiveAt = new Date().toISOString();
    await saveIndex(index);
  }
}
