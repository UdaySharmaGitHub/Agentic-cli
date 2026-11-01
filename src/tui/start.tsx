import React from 'react';
import { render } from 'ink';
import { createClient } from '../openai.js';
import { initSession } from '../runbook.js';
import { DEFAULT_MODEL } from '../config.js';
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

  initSession(modelId);

  // Printed to stdout before Ink takes over — stays in terminal scroll history
  // and is never re-painted by Ink's reconciler.
  printBanner();
  printWelcome();

  const { waitUntilExit } = render(
    <App client={client} modelId={modelId} yolo={yolo} />,
  );

  await waitUntilExit();
}

