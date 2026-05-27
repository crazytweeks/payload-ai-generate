import configPromise from '@payload-config';
import { notFound } from 'next/navigation';
import { getPayload } from 'payload';
import { ComposerUIPreviewFrame } from '@plugin/composer-ui';

export const dynamic = 'force-dynamic';

type Args = {
  params: Promise<{ id: string }>;
};

export default async function ComposerUIPreviewPage({ params }: Args) {
  const { id } = await params;
  const payload = await getPayload({ config: configPromise });

  const doc = await payload
    .findByID({
      id,
      collection: 'ai-composer-ui',
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null);

  if (!doc) {
    notFound();
  }

  return <ComposerUIPreviewFrame files={doc.files ?? []} title={doc.title ?? 'Composer UI'} />;
}
