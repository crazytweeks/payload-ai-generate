import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { ComposerClient } from './ComposerClient';

export const dynamic = 'force-dynamic';

export default async function ComposerPage() {
  const payload = await getPayload({ config: configPromise });

  const presetsResult = await payload.find({
    collection: 'ai-presets',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  });

  const presets = presetsResult.docs.map((p) => ({
    id: String(p.id),
    title: typeof p.title === 'string' ? p.title : String(p.id),
  }));

  const referenceCollections = Object.keys(
    ((payload.config.custom?.aiPluginOptions as Record<string, unknown>)
      ?.referenceCollections as Record<string, boolean>) ?? {}
  );

  return <ComposerClient presets={presets} referenceCollections={referenceCollections} />;
}
