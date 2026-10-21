import * as readFile from './readFile.js';
import * as writeFile from './writeFile.js';
import * as appendFile from './appendFile.js';
import * as modifyFile from './modifyFile.js';
import * as listDir from './listDir.js';
import * as runCommand from './runCommand.js';
import * as searchFiles from './searchFiles.js';
import * as webSearch from './webSearch.js';
import type { ToolDefinition, ToolResult, ConfirmFn } from './types.js';

export type { ToolDefinition, ToolResult, ConfirmFn };

interface ToolModule {
  definition: ToolDefinition;
  execute: (input: never, confirm: ConfirmFn) => Promise<ToolResult>;
}

const tools: ToolModule[] = [
  readFile,
  writeFile,
  appendFile,
  modifyFile,
  listDir,
  runCommand,
  searchFiles,
  webSearch,
] as unknown as ToolModule[];

const toolMap = new Map<string, ToolModule>(
  tools.map(t => [t.definition.name, t]),
);

export function getToolDefinitions(): ToolDefinition[] {
  return tools.map(t => t.definition);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  confirm: ConfirmFn,
): Promise<ToolResult> {
  const tool = toolMap.get(name);
  if (!tool) {
    return { output: `ERROR — unknown tool: '${name}'`, isError: true };
  }
  return tool.execute(args as never, confirm);
}
