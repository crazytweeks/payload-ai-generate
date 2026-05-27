import configPromise from '@payload-config';
import { draftMode } from 'next/headers';
import Link from 'next/link';
import { getPayload } from 'payload';
import { cache } from 'react';
import {
  resolveAiHtmlPromptDoc,
} from '@plugin/blocks/ai-html-block/Component';
import { AiHtmlBlockComponentClient } from '@plugin/blocks/ai-html-block/ClientComponent';
import type { AiHtmlBlockProps } from '@plugin/blocks/ai-html-block/types';
import {
  resolveAiComposerUiDoc,
} from '@plugin/blocks/ai-composer-ui-block/Component';
import { AiComposerUiBlockComponentClient } from '@plugin/blocks/ai-composer-ui-block/ClientComponent';
import type { AiComposerUiBlockProps } from '@plugin/blocks/ai-composer-ui-block/types';
import { LivePreviewListener } from '../../../../components/LivePreviewListener';

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
        <p>
          Post not found: <code>{slug}</code>
        </p>
        <Link href="/posts">← Back to posts</Link>
      </div>
    );
  }

  const payload = await getPayload({ config: configPromise });

  return (
    <article>
      {draft && <LivePreviewListener />}

      <Link href="/posts" style={{ color: '#666', fontSize: '0.9rem' }}>
        ← All posts
      </Link>
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
                <AiHtmlBlockWithDebugData
                  key={block.id ?? block.blockType}
                  code={block.code}
                  payload={payload}
                />
              );
            }
            if (block.blockType === 'ai-composer-ui-block') {
              return (
                <AiComposerUiBlockWithDebugData
                  key={block.id ?? block.blockType}
                  composerUI={block.composerUI as any}
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

const AiHtmlBlockWithDebugData = async ({ code, payload }: AiHtmlBlockProps) => {
  const promptDoc = await resolveAiHtmlPromptDoc({ code, payload });

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <AiHtmlBlockComponentClient code={promptDoc} />
      <details open>
        <summary>AI prompt data</summary>
        <pre
          style={{
            background: '#111827',
            color: '#e5e7eb',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            overflowX: 'auto',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {JSON.stringify(promptDoc, null, 2)}
        </pre>
      </details>
    </section>
  );
};

const AiComposerUiBlockWithDebugData = async ({ composerUI, payload }: AiComposerUiBlockProps) => {
  const uiDoc = await resolveAiComposerUiDoc({ composerUI, payload });

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <AiComposerUiBlockComponentClient composerUI={uiDoc} />
      <details open>
        <summary>AI Composer UI data</summary>
        <pre
          style={{
            background: '#111827',
            color: '#e5e7eb',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            overflowX: 'auto',
            padding: '1rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {JSON.stringify(uiDoc, null, 2)}
        </pre>
      </details>
    </section>
  );
};

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
