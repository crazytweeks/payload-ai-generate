import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import type { PayloadHandler } from 'payload';
import type { AIPluginOptions } from '../ai-types';
import { aiComposerUICollectionSlug } from '../collections/constants';
import type { ComposerPlan } from '../composer/types';
import { createCollectionTools } from '../tools/collectionTools';
import { createReferenceTools } from '../tools/referenceTools';
import type { GeneratedFile } from '../tools/uiGenerationTools';
import { createUIGenerationTools } from '../tools/uiGenerationTools';

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
    '- For standard HTML/JS output: index.html must set isEntryPoint: true, include <link rel="stylesheet" href="styles.css">, and <script src="script.js" defer></script>.',
    '- Use Tailwind CSS via CDN (<script src="https://cdn.tailwindcss.com"></script>) unless plan specifies vanilla CSS.',
    '- Each file must be complete and self-contained — no placeholders, no TODO comments.',
    '- If the plan specifies React/Next.js components (e.g. for a Payload block), output the corresponding .tsx files using Tailwind classes, and set the main component as isEntryPoint: true.',
    '- If reference data was fetched, embed it as a JS constant or JSON (do not require a server).',
    '- Favour semantic HTML5 elements.',
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

export const uiGenerateEndpointHandler: PayloadHandler = async (req) => {
  const pluginOptions = (req.payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions;

  if (typeof req.json !== 'function') {
    return Response.json({ error: 'Request body not available.' }, { status: 400 });
  }

  const body = (await req.json()) as {
    messages?: UIMessage[];
    plan: ComposerPlan;
    references?: Array<{
      collection: string;
      isBeingUsed: boolean;
      limit: number;
      dataLoading: 'server' | 'client';
    }>;
    sessionTitle?: string;
    sessionId?: string;
    uiArtifactId?: string; // If refining an existing generated UI
  };

  if (!body.plan) {
    return Response.json({ error: 'plan is required' }, { status: 400 });
  }

  const { model: baseModel, provider } = resolveModel(pluginOptions);
  const model = baseModel;

  const writtenFiles: GeneratedFile[] = [];
  const writeFileTool = createUIGenerationTools((file) => {
    writtenFiles.push(file);
    req.payload.logger.info(
      `[ui-generate] write_file: ${file.path} (${file.content.length} chars)`
    );
  });

  const referenceFetchTools = createReferenceTools({
    payload: req.payload,
    pluginOptions,
    references: body.references ?? [],
  });

  const collectionTools = createCollectionTools({ payload: req.payload, pluginOptions });

  const tools = { ...writeFileTool, ...referenceFetchTools, ...collectionTools };

  req.payload.logger.info({
    msg: '[ui-generate] POST',
    provider,
    plan: body.plan.design?.slice(0, 80),
    referenceCount: body.references?.length ?? 0,
  });

  let initialMessages = body.messages ?? [];
  if (initialMessages.length === 0) {
    initialMessages = [
      {
        role: 'user',
        id: 'initial-user',
        parts: [{ type: 'text', text: 'Generate the UI now based on the plan above.' }],
      },
    ];
  }

  const result = streamText({
    model,
    system: buildUIGenerationSystemPrompt(body.plan),
    messages: await convertToModelMessages(initialMessages),
    tools,
    stopWhen: stepCountIs(20),
    onStepFinish: ({ toolCalls, text, finishReason }) => {
      req.payload.logger.info({
        msg: '[ui-generate] step',
        finishReason,
        textLength: text?.length ?? 0,
        toolCalls: toolCalls?.map((tc) => tc.toolName),
      });
    },
    onFinish: async ({ text, finishReason, usage }) => {
      req.payload.logger.info({
        msg: '[ui-generate] done',
        finishReason,
        filesWritten: writtenFiles.map((f) => f.path),
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      });

      // Persist the UI artifact to Payload
      try {
        const title = body.sessionTitle || body.plan.design?.slice(0, 50) || 'Generated UI';
        if (body.uiArtifactId) {
          await req.payload.update({
            collection: aiComposerUICollectionSlug,
            id: body.uiArtifactId,
            data: {
              status: 'complete',
              files: writtenFiles,
            },
          });
        } else {
          await req.payload.create({
            collection: aiComposerUICollectionSlug,
            data: {
              title,
              status: 'complete',
              plan: body.plan,
              composerSession: body.sessionId,
              files: writtenFiles,
            },
          });
        }
      } catch (err) {
        req.payload.logger.error({ msg: 'Failed to persist UI generation artifact', err });
      }
    },
  });

  return result.toUIMessageStreamResponse();
};
