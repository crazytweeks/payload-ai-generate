import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import { buildBlockGenerationSystemPrompt } from '../../../../src/block-generation/prompt';
import { createContextTools } from '../../../../src/tools/contextTools';

const BLOCK_SCHEMA_HINT = `
Output a JSON object matching this schema wrapped in <block_json>…</block_json> tags when you have the final result:
{
  "html": string,        // required — semantic HTML markup
  "css": string,         // optional — scoped styles
  "js": string,          // optional — minimal vanilla JS
  "variables": [         // optional — runtime substitution tokens
    { "key": string, "value": string }
  ],
  "data": any            // optional — structured runtime data object
}
`.trim();

function resolveModel() {
  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return openai('gpt-5.5');
  }
  if (process.env.GOOGLE_AI_API) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API });
    return google('gemini-2.5-flash');
  }
  throw new Error('No AI provider configured. Set OPENAI_API_KEY or GOOGLE_AI_API.');
}

export async function POST(req: Request) {
  const { messages, references, systemPrompt } = (await req.json()) as {
    messages: UIMessage[];
    references?: Array<{ collection: string; filtersJSON?: string; limit?: number }>;
    systemPrompt?: string;
  };

  const model = resolveModel();

  const refContext =
    references && references.length > 0
      ? [
          'Reference collections in scope for this session:',
          JSON.stringify(references, null, 2),
        ].join('\n')
      : '';

  const system = [buildBlockGenerationSystemPrompt(systemPrompt), BLOCK_SCHEMA_HINT, refContext]
    .filter(Boolean)
    .join('\n\n');

  const pluginOptions = {
    contextAllowlist: [process.cwd()],
    contextMaxToolCallsPerRequest: 6,
    contextRoots: [process.cwd()],
  };

  const tools = createContextTools(pluginOptions);

  const result = streamText({
    model,
    system,
    messages: await convertToModelMessages(messages),
    tools: Object.keys(tools).length > 0 ? tools : undefined,
    stopWhen: stepCountIs(12),
    providerOptions: undefined,
  });

  return result.toUIMessageStreamResponse();
}
