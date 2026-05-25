'use client';

import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { getPreviewServerURL } from './getPreviewServerURL';

type Props = {
  serverURL?: string;
};

export const LivePreviewListener: React.FC<Props> = ({ serverURL }) => {
  const router = useRouter();

  return (
    <PayloadLivePreview
      refresh={router.refresh}
      serverURL={serverURL?.trim() || getPreviewServerURL()}
    />
  );
};
