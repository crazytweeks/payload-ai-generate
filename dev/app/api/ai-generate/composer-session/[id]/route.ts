import configPromise from '@payload-config';
import { getPayload } from 'payload';
import { aiComposerCollectionSlug } from '@plugin/collections';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await getPayload({ config: configPromise });

  const doc = await payload.findByID({
    id,
    collection: aiComposerCollectionSlug,
    depth: 0,
    overrideAccess: true,
  });

  return Response.json({ session: doc });
}
