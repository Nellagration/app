import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { request } from '~/lib/fetch';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions =
  Omit<Parameters<typeof _streamText>[0], 'model'> & {
    provider?: 'anthropic' | 'openai';
  };

interface StreamTextResult {
  toAIStream(): ReadableStream;
}
export async function streamText(
  messages: Messages,
  env: Env,
  options: StreamingOptions = {},
): Promise<StreamTextResult> {
  const provider = options.provider || env.LLM_PROVIDER || 'anthropic';

  if (provider === 'openai') {
    return streamOpenAIText(messages, env, options);
  }

  const { provider: _p, ...otherOptions } = options;

  const result = await _streamText({
    model: getAnthropicModel(getAPIKey(env, 'anthropic')),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages),
    ...otherOptions,
  });

  return {
    toAIStream() {
      return result.toAIStream();
    },
  };
}

async function streamOpenAIText(
  messages: Messages,
  env: Env,
  options: StreamingOptions,
): Promise<StreamTextResult> {
  const apiKey = getAPIKey(env, 'openai');

  const res = await request('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: messages.map(({ role, content }) => ({ role, content })),
      max_tokens: MAX_TOKENS,
      stream: false,
    }),
  });

  const data = await res.json();

  const text: string = data.choices?.[0]?.message?.content ?? '';
  options.onFinish?.({ text, finishReason: data.choices?.[0]?.finish_reason });

  const encoder = new TextEncoder();

  return {
    toAIStream() {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });
    },
  };
}
