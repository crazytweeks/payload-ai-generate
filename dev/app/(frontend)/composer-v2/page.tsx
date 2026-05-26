import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { ComposerV2Client } from './ComposerV2Client';

export const dynamic = 'force-dynamic';

export default async function ComposerV2Page() {
  const payload = await getPayload({ config: configPromise });

  const presetsResult = await payload.find({
    collection: 'ai-presets',
    depth: 0,
    limit: 100,
    overrideAccess: true,
  });

  const presets = presetsResult.docs.map((preset) => ({
    id: String(preset.id),
    title: typeof preset.title === 'string' ? preset.title : String(preset.id),
  }));

  const referenceCollections = Object.keys(
    ((payload.config.custom?.aiPluginOptions as Record<string, unknown>)
      ?.referenceCollections as Record<string, boolean>) ?? {}
  );

  return <ComposerV2Client presets={presets} referenceCollections={referenceCollections} />;
}
