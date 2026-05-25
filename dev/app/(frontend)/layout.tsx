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
    <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <Suspense fallback={<div>Loading…</div>}>{children}</Suspense>
    </body>
  </html>
);

export default Layout;
