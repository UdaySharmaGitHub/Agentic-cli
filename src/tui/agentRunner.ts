import OpenAI from 'openai';
import { streamMessage } from '../openai.js';
import { executeTool, getToolDefinitions } from '../tools/index.js';
import type { ConfirmFn } from '../tools/types.js';
import type { ChatMessage } from '../memory.js';
import { recordStep } from '../runbook.js';
import { emit } from './events.js';

export async function runAgentTurn(
  client: OpenAI,
  modelId: string,
  history: ChatMessage[],
  confirm: ConfirmFn,
  maxSteps = 15,
): Promise<void> {
  const toolDefs = getToolDefinitions();
  let steps = 0;

  try {
    let continueLoop = true;

    while (continueLoop && steps < maxSteps) {
      let textStarted = false;
      let fullText = '';

      emit({ type: 'agent:thinking' });

      const response = await streamMessage(client, modelId, '', history, (text) => {
        if (!textStarted) {
          textStarted = true;
          emit({ type: 'agent:stream:start' });
        }
        emit({ type: 'agent:stream:token', text });
        fullText += text;
      });

      if (textStarted) {
        emit({ type: 'agent:stream:end', fullText });
      }

      if (response.toolCalls.length > 0) {
        history.push({ role: 'assistant', content: response.text || null, tool_calls: response.toolCalls });
      } else {
        history.push({ role: 'assistant', content: response.text });
      }

      if (response.toolCalls.length === 0) {
        if (steps > 0) emit({ type: 'agent:complete', steps });
        continueLoop = false;
      } else {
        steps++;
        if (steps > 1) emit({ type: 'step:start', step: steps, max: maxSteps });

        for (const call of response.toolCalls) {
          const args = JSON.parse(call.function.arguments) as Record<string, unknown>;
          const toolDef = toolDefs.find(t => t.name === call.function.name);

          emit({
            type: 'tool:call',
            name: call.function.name,
            description: toolDef?.description ?? '',
          });

          const toolResult = await executeTool(call.function.name, args, confirm);

          emit({ type: 'tool:result', name: call.function.name, output: toolResult.output });

          recordStep({
            reasoning: response.text ?? '',
            toolName: call.function.name,
            toolArgs: args,
            toolResult: toolResult.output,
          });

          history.push({ role: 'tool', tool_call_id: call.id, content: toolResult.output });
        }
      }
    }

    if (steps >= maxSteps) {
      emit({ type: 'agent:maxsteps', max: maxSteps });
    }
  } catch (err) {
    emit({ type: 'agent:error', msg: err instanceof Error ? err.message : String(err) });
  }
}
