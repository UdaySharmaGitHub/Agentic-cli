import { render } from 'ink';
import { createElement } from 'react';
import { createClient } from '../openai.js';
import { initSession } from '../runbook.js';
import { DEFAULT_MODEL } from '../config.js';
import { printBanner, printWelcome } from '../ui.js';
import { App } from './App.js';

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

  // Print banner and welcome to stdout before Ink takes over the live area.
  // They stay visible in terminal scroll history above the interactive UI.
  await printBanner();
  printWelcome();

  const { waitUntilExit } = render(
    createElement(App, { client, modelId, yolo }),
  );

  await waitUntilExit();
}

