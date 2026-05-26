import { Suspense } from 'react';

type Args = {
  children: React.ReactNode;
};

const Layout = ({ children }: Args) => (
  <html lang="en">
    <head>
      <title>Dev App</title>
      <meta name="description" content="payload-ai-generate dev app" />
    </head>
    <body
      style={{
        fontFamily: 'system-ui, sans-serif',
        margin: '0',
        background: '#0f0f11',
        color: '#e2e2e8',
        minHeight: '100vh',
      }}
    >
      <nav
        style={{
          padding: '10px 1.5rem',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          gap: '1.25rem',
          fontSize: '13px',
          background: '#18181b',
        }}
      >
        <a href="/admin" style={{ color: '#71717a', textDecoration: 'none' }}>
          Admin
        </a>
        <a href="/posts" style={{ color: '#a1a1aa', textDecoration: 'none' }}>
          Posts
        </a>
        <a href="/composer" style={{ color: '#a1a1aa', textDecoration: 'none', fontWeight: 600 }}>
          Composer
        </a>
      </nav>
      <Suspense fallback={<div style={{ padding: '2rem', color: '#52525b' }}>Loading…</div>}>
        {children}
      </Suspense>
    </body>
  </html>
);

export default Layout;
