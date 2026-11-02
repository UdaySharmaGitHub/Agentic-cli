import React from 'react';
import { render } from 'ink';
import { createClient } from '../openai.js';
import { initSession } from '../runbook.js';
import { DEFAULT_MODEL } from '../config.js';
import { initSessions } from '../sessions.js';
import { loadHistory } from '../memory.js';
import { App } from './App.js';
import { printBanner, printWelcome } from './components/Banner.js';

export async function startTUI(): Promise<void> {
  const apiKey = process.env['API_KEY'];
  if (!apiKey) {
    console.error('Error: API_KEY is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const yolo = process.argv.includes('--yolo');
  const modelId = DEFAULT_MODEL;
  const client = createClient(modelId);

  // Parse --session <name> flag
  const sessionIdx = process.argv.indexOf('--session');
  const requestedSession = sessionIdx !== -1 ? process.argv[sessionIdx + 1] : undefined;

  const { name: sessionName, path: sessionPath } = await initSessions(requestedSession);
  await loadHistory(sessionPath);

  initSession(modelId);

  printBanner();
  printWelcome();

  const { waitUntilExit } = render(
    <App
      client={client}
      modelId={modelId}
      yolo={yolo}
      sessionName={sessionName}
      sessionPath={sessionPath}
    />,
  );

  await waitUntilExit();
}
