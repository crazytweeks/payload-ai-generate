import { devToolsMiddleware } from '@ai-sdk/devtools';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import configPromise from '@payload-config';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText, wrapLanguageModel } from 'ai';
import { getPayload } from 'payload';
import type { AIPluginOptions } from '@plugin/ai-types';
import { aiComposerUICollectionSlug } from '@plugin/collections/constants';
import type { ComposerPlan } from '@plugin/composer/types';
import { createCollectionTools } from '@plugin/tools/collectionTools';
import { createReferenceTools } from '@plugin/tools/referenceTools';
import type { GeneratedFile } from '@plugin/tools/uiGenerationTools';
import { createUIGenerationTools } from '@plugin/tools/uiGenerationTools';

export const dynamic = 'force-dynamic';

type ReferenceRequest = {
  collection: string;
  dataLoading: 'server' | 'client';
  isBeingUsed: boolean;
  limit: number;
};

type ComposerUIUpdate = {
  files?: GeneratedFile[];
  generationLog?: string;
  plan?: ComposerPlan;
  status?: 'draft' | 'generating' | 'complete' | 'error';
  title?: string;
};

const buildUIGenerationSystemPrompt = (plan: ComposerPlan): string =>
  [
    'You are an expert frontend engineer. Generate a complete, working multi-file UI based on the provided plan.',
    '',
    '## Your job',
    'Call write_file() once for EACH file you produce. Do NOT batch all files into one call.',
    'Generate files in this order:',
    '  1. index.html  - semantic HTML, links to styles.css and script.js',
    '  2. styles.css  - all styles',
    '  3. script.js   - JavaScript logic',
    '  4. data.json   - only if useful for embedded reference data',
    '',
    '## Rules',
    '- index.html must set isEntryPoint: true',
    '- Each file must be complete and self-contained; no placeholders or TODO comments',
    '- Use vanilla HTML/CSS/JS so the preview iframe can render it immediately',
    '- If reference data was fetched, embed it directly in the generated files',
    '- Favour semantic HTML5 elements and responsive CSS',
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

const titleFromPlan = (plan: ComposerPlan, fallback?: string) => {
  if (fallback?.trim()) return fallback.trim().slice(0, 120);
  const design = plan.design?.replace(/\s+/g, ' ').trim();
  return design ? design.slice(0, 80) : `Composer UI ${new Date().toISOString()}`;
};

export async function POST(req: Request) {
  const payload = await getPayload({ config: configPromise });
  const pluginOptions = (payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions;

  const body = (await req.json()) as {
    composerSessionId?: string;
    composerUiId?: string;
    messages?: UIMessage[];
    plan: ComposerPlan;
    references?: ReferenceRequest[];
    sessionTitle?: string;
  };

  if (!body.plan) {
    return Response.json({ error: 'plan is required' }, { status: 400 });
  }

  const { model: baseModel, provider } = resolveModel(pluginOptions);
  const model = wrapLanguageModel({ model: baseModel, middleware: devToolsMiddleware() });

  const writtenFiles = new Map<string, GeneratedFile>();
  const generationEvents: string[] = [];
  let composerUiId = body.composerUiId;

  const ensureComposerUIDoc = async () => {
    if (composerUiId) return composerUiId;

    const created = await payload.create({
      collection: aiComposerUICollectionSlug,
      data: {
        composerSession: body.composerSessionId,
        files: [],
        plan: body.plan,
        status: 'generating',
        title: titleFromPlan(body.plan, body.sessionTitle),
      },
      overrideAccess: true,
    });
    composerUiId = String(created.id);
    return composerUiId;
  };

  const updateComposerUIDoc = async (data: ComposerUIUpdate) => {
    const id = await ensureComposerUIDoc();
    await payload.update({
      id,
      collection: aiComposerUICollectionSlug,
      data,
      overrideAccess: true,
    });
  };

  const writeFileTool = createUIGenerationTools(async (file) => {
    writtenFiles.set(file.path, file);
    generationEvents.push(`write_file:${file.path}:${file.content.length}`);
    const id = await ensureComposerUIDoc();
    await updateComposerUIDoc({
      files: Array.from(writtenFiles.values()),
      generationLog: generationEvents.join('\n'),
      status: 'generating',
    });
    console.log(`[ui-generate-v2] write_file: ${file.path} (${file.content.length} chars)`);
    return { composerUiId: id, previewPath: `/preview/ai-composer-ui/${id}` };
  });

  const referenceFetchTools = createReferenceTools({
    payload,
    pluginOptions,
    references: body.references ?? [],
  });
  const collectionTools = createCollectionTools({ payload, pluginOptions });
  const tools = { ...writeFileTool, ...referenceFetchTools, ...collectionTools };

  await ensureComposerUIDoc();

  console.log('[ui-generate-v2] POST', {
    composerUiId,
    provider,
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
      generationEvents.push(
        `step:${finishReason}:text=${text?.length ?? 0}:tools=${toolCalls?.map((tc) => tc.toolName).join(',') ?? ''}`
      );
    },
    onError: async ({ error }) => {
      generationEvents.push(`error:${error instanceof Error ? error.message : String(error)}`);
      await updateComposerUIDoc({
        files: Array.from(writtenFiles.values()),
        generationLog: generationEvents.join('\n'),
        status: 'error',
      });
    },
    onFinish: async ({ finishReason, usage }) => {
      generationEvents.push(
        `done:${finishReason}:input=${usage?.inputTokens ?? 0}:output=${usage?.outputTokens ?? 0}`
      );
      await updateComposerUIDoc({
        files: Array.from(writtenFiles.values()),
        generationLog: generationEvents.join('\n'),
        status: 'complete',
      });
      console.log('[ui-generate-v2] done', {
        composerUiId,
        filesWritten: Array.from(writtenFiles.keys()),
        finishReason,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
