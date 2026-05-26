import { devToolsMiddleware } from '@ai-sdk/devtools';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import configPromise from '@payload-config';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText, wrapLanguageModel } from 'ai';
import { getPayload } from 'payload';
import type { AIPluginOptions } from '../../../../../src/ai-types';
import type { ComposerPlan } from '../../../../../src/composer/types';
import { createCollectionTools } from '../../../../../src/tools/collectionTools';
import { createReferenceTools } from '../../../../../src/tools/referenceTools';
import type { GeneratedFile } from '../../../../../src/tools/uiGenerationTools';
import { createUIGenerationTools } from '../../../../../src/tools/uiGenerationTools';

export const dynamic = 'force-dynamic';

const buildUIGenerationSystemPrompt = (plan: ComposerPlan): string =>
  [
    'You are an expert frontend engineer. Generate a complete, working multi-file UI based on the provided plan.',
    '',
    '## Your job',
    'Call write_file() once for EACH file you produce. Do NOT batch all files into one call.',
    'Generate files in this order:',
    '  1. index.html  — semantic HTML, links to styles.css and script.js',
    '  2. styles.css  — all styles (Tailwind CDN or scoped vanilla CSS)',
    '  3. script.js   — JavaScript logic (vanilla JS unless plan says otherwise)',
    '  4. data.json   — ONLY if the plan provides reference data to embed',
    '',
    '## Rules',
    '- index.html must set isEntryPoint: true',
    '- index.html must include <link rel="stylesheet" href="styles.css"> in <head>',
    '- index.html must include <script src="script.js" defer></script> before </body>',
    '- Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) unless plan specifies vanilla CSS',
    '- Each file must be complete and self-contained — no placeholders, no TODO comments',
    '- JavaScript must be vanilla (no React, Vue, etc.) unless plan explicitly specifies a framework',
    '- If reference data was fetched, embed it as a JS constant in script.js (do not require a server)',
    '- Favour semantic HTML5 elements',
    '',
    '## Generation plan',
    JSON.stringify(plan, null, 2),
  ].join('\n');

function resolveModel(pluginOptions: AIPluginOptions) {
  const openaiKey = pluginOptions.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return { model: openai('gpt-4o'), provider: 'openai' as const };
  }
  const googleKey = pluginOptions.googleApiKey ?? process.env.GOOGLE_AI_API;
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return { model: google('gemini-2.5-flash'), provider: 'google' as const };
  }
  throw new Error('No AI provider configured. Set OPENAI_API_KEY or GOOGLE_AI_API.');
}

export async function POST(req: Request) {
  const payload = await getPayload({ config: configPromise });
  const pluginOptions = (payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions;

  const body = (await req.json()) as {
    messages?: UIMessage[];
    plan: ComposerPlan;
    references?: Array<{ collection: string; isBeingUsed: boolean; limit: number; dataLoading: 'server' | 'client' }>;
    sessionTitle?: string;
  };

  if (!body.plan) {
    return Response.json({ error: 'plan is required' }, { status: 400 });
  }

  const { model: baseModel, provider } = resolveModel(pluginOptions);
  const model = wrapLanguageModel({ model: baseModel, middleware: devToolsMiddleware() });

  // Collect files as the AI writes them (for logging)
  const writtenFiles: GeneratedFile[] = [];
  const writeFileTool = createUIGenerationTools((file) => {
    writtenFiles.push(file);
    console.log(`[ui-generate] write_file: ${file.path} (${file.content.length} chars)`);
  });

  const referenceFetchTools = createReferenceTools({
    payload,
    pluginOptions,
    references: body.references ?? [],
  });

  const collectionTools = createCollectionTools({ payload, pluginOptions });

  const tools = { ...writeFileTool, ...referenceFetchTools, ...collectionTools };

  console.log('[ui-generate] POST', {
    provider,
    plan: body.plan.design?.slice(0, 80),
    referenceCount: body.references?.length ?? 0,
  });

  const result = streamText({
    model,
    system: buildUIGenerationSystemPrompt(body.plan),
    messages: body.messages?.length
      ? await convertToModelMessages(body.messages)
      : [{ role: 'user', content: 'Generate the UI now based on the plan above.' }],
    tools,
    stopWhen: stepCountIs(20),
    onStepFinish: ({ toolCalls, text, finishReason }) => {
      console.log('[ui-generate] step', {
        finishReason,
        textLength: text?.length ?? 0,
        toolCalls: toolCalls?.map((tc) => tc.toolName),
      });
    },
    onFinish: ({ text, finishReason, usage }) => {
      console.log('[ui-generate] done', {
        finishReason,
        filesWritten: writtenFiles.map((f) => f.path),
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
