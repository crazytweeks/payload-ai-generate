'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'sans-serif',
          background: '#0f0f11',
          color: '#e2e2e8',
        }}
      >
        <h2>Something went wrong!</h2>
        <p style={{ color: '#ef4444' }}>{error?.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#7c3aed',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
