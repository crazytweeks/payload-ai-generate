'use client';

import { useMemo } from 'react';
import { buildComposerUISrcDoc } from '../../composer-ui';
import type { AiComposerUiBlockProps } from './types';

export function AiComposerUiBlockComponentClient({ composerUI, id }: AiComposerUiBlockProps) {
  const uiDoc = typeof composerUI === 'object' && composerUI !== null ? composerUI : null;
  const files = uiDoc?.files || [];

  const srcdoc = useMemo(() => {
    if (!files.length) {
      return '';
    }
    return buildComposerUISrcDoc(files);
  }, [files]);

  if (!files.length) {
    return <div className="cms-ai-composer-ui-block-empty">No files generated for this UI yet</div>;
  }

  return (
    <iframe
      className={`cms-ai-composer-ui-block w-full${id ? ` cms-ai-composer-ui-block--${id}` : ''}`}
      key={id}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      style={{ border: 'none', minHeight: '100px', width: '100%' }}
      title="AI generated composer UI content"
    />
  );
}

export default AiComposerUiBlockComponentClient;
