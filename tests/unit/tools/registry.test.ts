import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/ui.js', () => ({
  printToolHeader: vi.fn(),
  printToolSuccess: vi.fn(),
  printToolError: vi.fn(),
  printToolBlocked: vi.fn(),
  printRejected: vi.fn(),
  printDimOutput: vi.fn(),
  printSeparator: vi.fn(),
}));

import { getToolDefinitions, executeTool } from '../../../src/tools/index.js';

const approve = async () => true;

describe('tool registry', () => {
  it('getToolDefinitions returns definitions for all 8 tools', () => {
    const defs = getToolDefinitions();
    expect(defs).toHaveLength(8);
    const names = defs.map(d => d.name);
    expect(names).toContain('read_file');
    expect(names).toContain('write_file');
    expect(names).toContain('append_file');
    expect(names).toContain('modify_file');
    expect(names).toContain('list_directory');
    expect(names).toContain('run_command');
    expect(names).toContain('search_files');
    expect(names).toContain('web_search');
  });

  it('each definition has name, description, and parameters', () => {
    for (const def of getToolDefinitions()) {
      expect(typeof def.name).toBe('string');
      expect(typeof def.description).toBe('string');
      expect(def.parameters.type).toBe('object');
      expect(typeof def.parameters.properties).toBe('object');
    }
  });

  it('executeTool dispatches to the correct module', async () => {
    const result = await executeTool('run_command', { command: 'echo registry-test' }, approve);
    expect(result.isError).toBe(false);
    expect(result.output).toContain('registry-test');
  });

  it('executeTool returns isError: true for an unknown tool name', async () => {
    const result = await executeTool('no_such_tool', {}, approve);
    expect(result.isError).toBe(true);
    expect(result.output).toContain('unknown tool');
  });
});
