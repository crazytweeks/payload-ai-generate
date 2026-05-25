'use client';
import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react';
import { useRouter } from 'next/navigation';
import type React from 'react';

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

export const LivePreviewListener: React.FC = () => {
  const router = useRouter();
  return <PayloadLivePreview refresh={router.refresh} serverURL={serverURL} />;
};
