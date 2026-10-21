#!/usr/bin/env node
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createInterface } from "node:readline";
import { getToolDefinitions, executeTool } from "./tools/index.js";
import type { ConfirmFn } from "./tools/types.js";
import {
  printBanner,
  printWelcome,
  printHelp,
  printStatus,
  printAgentResponse,
  printAgentStep,
  printAgentComplete,
  printAgentMaxSteps,
  printAgentError,
  printToolResult,
  createSpinner,
  formatConfirmPrompt,
} from "./ui.js";

async function main() {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }

  const yolo = process.argv.includes("--yolo");
  const modelId = "gemini-2.5-flash";

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });

  const toolDefs = getToolDefinitions();
  const history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

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

    history.push({ role: "user", parts: [{ text: input }] });

    const spinner = createSpinner("Thinking…").start();
    let steps = 0;
    const maxSteps = 15;

    try {
      const chat = model.startChat({
        history,
        tools: [{
          functionDeclarations: toolDefs.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters as never,
          })),
        }],
      });

      let result = await chat.sendMessage(input);
      spinner.stop();

      // Agentic tool-call loop
      while (result.response.functionCalls()?.length && steps < maxSteps) {
        steps++;
        if (steps > 1) printAgentStep(steps, maxSteps);

        const calls = result.response.functionCalls()!;
        const toolResponses: Array<{ functionResponse: { name: string; response: unknown } }> = [];

        for (const call of calls) {
          const toolResult = await executeTool(
            call.name,
            call.args as Record<string, unknown>,
            confirm,
          );
          printToolResult(call.name, toolResult.output);
          toolResponses.push({
            functionResponse: { name: call.name, response: { output: toolResult.output } },
          });
        }

        spinner.start("Thinking…");
        result = await chat.sendMessage(toolResponses as never);
        spinner.stop();
      }

      if (steps >= maxSteps) {
        printAgentMaxSteps(maxSteps);
      } else {
        const text = result.response.text();
        if (text) {
          printAgentResponse(text);
          history.push({ role: "model", parts: [{ text }] });
        }
        if (steps > 0) printAgentComplete(steps);
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
