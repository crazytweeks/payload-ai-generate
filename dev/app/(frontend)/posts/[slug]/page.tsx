import configPromise from '@payload-config';
import { draftMode } from 'next/headers';
import Link from 'next/link';
import { getPayload } from 'payload';
import { cache } from 'react';
import { LivePreviewListener } from '../../../../components/LivePreviewListener';
import { AiHtmlBlockComponent } from '../../../../src/blocks/ai-html-block/Component';

type Args = {
  params: Promise<{ slug: string }>;
};

export default async function PostPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise;
  const { isEnabled: draft } = await draftMode();

  const post = await queryPost({ slug, draft });

  if (!post) {
    return (
      <div>
        <p>Post not found: <code>{slug}</code></p>
        <Link href="/posts">← Back to posts</Link>
      </div>
    );
  }

  const payload = await getPayload({ config: configPromise });

  return (
    <article>
      {draft && <LivePreviewListener />}

      <Link href="/posts" style={{ color: '#666', fontSize: '0.9rem' }}>← All posts</Link>
      <h1 style={{ marginTop: '0.5rem' }}>{post.title}</h1>
      <p style={{ color: '#888', fontSize: '0.85rem' }}>
        {post.slug} · updated {new Date(post.updatedAt).toLocaleDateString()}
        {draft && <span style={{ marginLeft: '0.5rem', color: '#f59e0b' }}>[draft]</span>}
      </p>

      <div style={{ marginTop: '2rem' }}>
        {post.content && post.content.length > 0 ? (
          post.content.map((block) => {
            if (block.blockType === 'ai-html-block') {
              return (
                <AiHtmlBlockComponent
                  key={block.id ?? block.blockType}
                  code={block.code}
                  payload={payload}
                />
              );
            }
            return null;
          })
        ) : (
          <p style={{ color: '#aaa' }}>No content blocks yet.</p>
        )}
      </div>
    </article>
  );
}

const queryPost = cache(async ({ slug, draft }: { slug: string; draft: boolean }) => {
  const payload = await getPayload({ config: configPromise });

  const result = await payload.find({
    collection: 'posts',
    draft,
    limit: 1,
    overrideAccess: draft,
    pagination: false,
    where: { slug: { equals: slug } },
  });

  return result.docs?.[0] ?? null;
});
