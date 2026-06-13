export default function RootNotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>404 - Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="/posts" style={{ color: '#7c3aed', textDecoration: 'underline' }}>
        Go back to Posts
      </a>
    </div>
  );
}
