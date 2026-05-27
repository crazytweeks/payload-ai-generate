import configPromise from '@payload-config';
import Link from 'next/link';
import { getPayload } from 'payload';

export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const payload = await getPayload({ config: configPromise });

  const posts = await payload.find({
    collection: 'posts',
    depth: 0,
    limit: 50,
    overrideAccess: true,
    draft: true,
    select: {
      title: true,
      slug: true,
      updatedAt: true,
      _status: true,
    },
  });

  return (
    <div style={{ padding: '2rem', maxWidth: '720px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Posts</h1>
      <p style={{ color: '#52525b', fontSize: '13px', marginBottom: '1.5rem' }}>
        {posts.totalDocs} post{posts.totalDocs !== 1 ? 's' : ''}
      </p>

      {posts.docs.length === 0 ? (
        <p style={{ color: '#71717a' }}>
          No posts yet.{' '}
          <a href="/admin" style={{ color: '#7c3aed' }}>
            Create one in the admin
          </a>
          .
        </p>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
          }}
        >
          {posts.docs.map((post) => (
            <li
              key={post.id}
              style={{
                background: '#18181b',
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '8px',
              }}
            >
              <Link
                href={`/posts/${post.slug}`}
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: '#e2e2e8',
                }}
              >
                {post.title || '(Untitled)'}
              </Link>
              <p style={{ color: '#52525b', fontSize: '12px', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                /{post.slug} · {new Date(post.updatedAt).toLocaleDateString()}
                {(post as any)._status === 'draft' && (
                  <span style={{ color: '#f59e0b', fontSize: '11px', fontWeight: 600, background: '#422006', padding: '1px 6px', borderRadius: '4px' }}>draft</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
