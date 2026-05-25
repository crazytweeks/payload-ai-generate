import type { FC } from 'react';

const PreviewLayout: FC<LayoutProps<'/preview'>> = ({ children }) => {
  return (
    <html lang="en">
      <head>
        <title>Preview Layout</title>
      </head>
      <body>{children}</body>
    </html>
  );
};

export default PreviewLayout;
