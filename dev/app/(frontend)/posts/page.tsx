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
    overrideAccess: false,
    select: {
      title: true,
      slug: true,
      updatedAt: true,
    },
  });

  return (
    <div>
      <h1>Posts</h1>
      <p style={{ color: '#666' }}>{posts.totalDocs} post{posts.totalDocs !== 1 ? 's' : ''}</p>

      {posts.docs.length === 0 ? (
        <p>No posts yet. <a href="/admin">Create one in the admin</a>.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {posts.docs.map((post) => (
            <li key={post.id} style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
              <Link href={`/posts/${post.slug}`} style={{ fontSize: '1.2rem', textDecoration: 'none' }}>
                {post.title || '(Untitled)'}
              </Link>
              <p style={{ color: '#888', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
                {post.slug} · {new Date(post.updatedAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
