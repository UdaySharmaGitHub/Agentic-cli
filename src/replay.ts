import fs from 'node:fs/promises';

export interface ReplayStep {
  taskLabel: string;
  reasoning: string;
  command: string;
}

export interface ParsedRunbook {
  task: string;
  model: string;
  steps: ReplayStep[];
}

export async function parseShellRunbook(filepath: string): Promise<ParsedRunbook> {
  const content = await fs.readFile(filepath, 'utf-8');
  return parseContent(content);
}

function parseContent(content: string): ParsedRunbook {
  const lines = content.split('\n');
  let task = '';
  let model = '';
  const steps: ReplayStep[] = [];

  let inHeader = true;
  let currentTaskLabel = '';
  const pendingReasoning: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (inHeader) {
      if (line.startsWith('# Task:'))  task  = line.slice('# Task:'.length).trim();
      if (line.startsWith('# Model:')) model = line.slice('# Model:'.length).trim();
      if (line === 'set -e') inHeader = false;
      continue;
    }

    if (!line) continue;

    // Task section marker written by exportShell
    if (line.startsWith('# ── Task:')) {
      currentTaskLabel = line.slice('# ── Task:'.length).trim();
      pendingReasoning.length = 0;
      continue;
    }

    // Regular comment → treat as reasoning for the next command
    if (line.startsWith('#')) {
      const text = line.slice(1).trim();
      if (text) pendingReasoning.push(text);
      continue;
    }

    // Non-comment, non-empty line → it's a command
    steps.push({
      taskLabel: currentTaskLabel || task,
      reasoning: pendingReasoning.join(' '),
      command: line,
    });
    pendingReasoning.length = 0;
  }

  return { task: task || 'Replay Session', model, steps };
}
