import configPromise from '@payload-config';
import type { UIMessage } from 'ai';
import { getPayload } from 'payload';
import type { AIReferenceDataSource } from '../../../../../src/ai-types';
import { aiComposerCollectionSlug } from '../../../../../src/collections/constants';
import type { ComposerPlan } from '../../../../../src/composer/types';
import type { AiComposer } from '../../../../payload-types';

export const dynamic = 'force-dynamic';

type ComposerSessionRequest = {
  composerSessionId?: string;
  firstPrompt: string;
  messages: UIMessage[];
  plan: ComposerPlan;
  presetId?: string;
  references?: AIReferenceDataSource[];
  title?: string;
};

type ComposerReference = NonNullable<AiComposer['referenceCollections']>[number];

const titleFromPrompt = (prompt: string, fallback?: string) => {
  if (fallback?.trim()) return fallback.trim().slice(0, 120);
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 120) : `Composer session ${new Date().toISOString()}`;
};

const normalizeReferences = (references: AIReferenceDataSource[] = []): ComposerReference[] =>
  references
    .filter(
      (reference): reference is AIReferenceDataSource & { collection: string } =>
        typeof reference.collection === 'string' && reference.collection.length > 0
    )
    .map((reference) => ({
      collection: reference.collection as ComposerReference['collection'],
      dataLoading: reference.dataLoading === 'client' ? 'client' : 'server',
      filtersJSON: reference.filtersJSON,
      id: typeof reference.id === 'string' ? reference.id : undefined,
      isBeingUsed: reference.isBeingUsed ?? true,
      limit: reference.limit,
    }));

export async function POST(req: Request) {
  const payload = await getPayload({ config: configPromise });
  const body = (await req.json()) as ComposerSessionRequest;

  if (!body.firstPrompt?.trim()) {
    return Response.json({ error: 'firstPrompt is required' }, { status: 400 });
  }

  if (!body.plan) {
    return Response.json({ error: 'plan is required' }, { status: 400 });
  }

  const data = {
    firstPrompt: body.firstPrompt,
    messages: body.messages,
    plan: body.plan,
    preset: body.presetId || undefined,
    referenceCollections: normalizeReferences(body.references),
    title: titleFromPrompt(body.firstPrompt, body.title),
  };

  if (body.composerSessionId) {
    const updated = await payload.update({
      id: body.composerSessionId,
      collection: aiComposerCollectionSlug,
      data,
      overrideAccess: true,
    });

    return Response.json({ id: String(updated.id) });
  }

  const created = await payload.create({
    collection: aiComposerCollectionSlug,
    data,
    overrideAccess: true,
  });

  return Response.json({ id: String(created.id) });
}
