#!/usr/bin/env node
import "dotenv/config";
import { createInterface } from "node:readline";
import { executeTool } from "./tools/index.js";
import type { ConfirmFn } from "./tools/types.js";
import type { ChatMessage } from "./memory.js";
import { createClient, streamMessage } from "./openai.js";
import { DEFAULT_MODEL } from "./config.js";
import {
  printBanner,
  printWelcome,
  printHelp,
  printStatus,
  printAgentStep,
  printAgentComplete,
  printAgentMaxSteps,
  printAgentError,
  printToolResult,
  createSpinner,
  formatConfirmPrompt,
} from "./ui.js";

async function main() {
  const apiKey = process.env["API_KEY"];
  if (!apiKey) {
    console.error("Error: API_KEY is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const yolo = process.argv.includes("--yolo");
  const modelId = DEFAULT_MODEL;

  const client = createClient(modelId);
  const history: ChatMessage[] = [];

  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });

  // Pending confirmation: set when a tool asks for approval,
  // resolved by the next line event (avoids rl.question() state conflicts).
  let pendingAnswer: ((answer: string) => void) | null = null;

  const confirm: ConfirmFn = yolo
    ? async () => true
    : (message: string) =>
        new Promise<boolean>((resolve) => {
          process.stdout.write(formatConfirmPrompt(message));
          pendingAnswer = (input: string) => {
            pendingAnswer = null;
            resolve(input === "y" || input === "yes");
          };
        });

  await printBanner();
  printWelcome();
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();

    // Route line to pending confirmation before treating it as a new command.
    if (pendingAnswer) {
      pendingAnswer(input.toLowerCase());
      return;
    }

    if (!input) { rl.prompt(); return; }

    if (input === "/exit" || input === "/quit") { process.exit(0); }
    if (input === "/clear") { history.length = 0; console.clear(); rl.prompt(); return; }
    if (input === "/help") { printHelp(); rl.prompt(); return; }
    if (input === "/status") { printStatus(modelId, history.length); rl.prompt(); return; }

    history.push({ role: "user", content: input });

    const spinner = createSpinner("Thinking…").start();
    let steps = 0;
    const maxSteps = 15;

    try {
      let continueLoop = true;

      while (continueLoop && steps < maxSteps) {
        let textStarted = false;

        const response = await streamMessage(client, modelId, "", history, (text) => {
          if (!textStarted) {
            spinner.stop();
            textStarted = true;
            console.log();
          }
          process.stdout.write(text);
        });

        if (!textStarted) spinner.stop();
        if (textStarted) console.log();

        // Add assistant message to history
        if (response.toolCalls.length > 0) {
          history.push({
            role: "assistant",
            content: response.text || null,
            tool_calls: response.toolCalls,
          });
        } else {
          history.push({ role: "assistant", content: response.text });
        }

        if (response.toolCalls.length === 0) {
          if (steps > 0) printAgentComplete(steps);
          continueLoop = false;
        } else {
          steps++;
          if (steps > 1) printAgentStep(steps, maxSteps);

          for (const call of response.toolCalls) {
            const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
            const toolResult = await executeTool(call.function.name, args, confirm);
            printToolResult(call.function.name, toolResult.output);
            history.push({
              role: "tool",
              tool_call_id: call.id,
              content: toolResult.output,
            });
          }

          spinner.start("Thinking…");
        }
      }

      if (steps >= maxSteps) {
        printAgentMaxSteps(maxSteps);
      }
    } catch (err) {
      spinner.stop();
      printAgentError(err instanceof Error ? err.message : String(err));
    }

    rl.prompt();
  });

  rl.on("close", () => process.exit(0));
}

main();
