import { buildComposerUISrcDoc, type ComposerUIFile } from './render';

type Props = {
  files: ComposerUIFile[];
  title?: string;
};

export function ComposerUIPreviewFrame({ files, title = 'Generated composer UI preview' }: Props) {
  const srcDoc = buildComposerUISrcDoc(files);

  return (
    <iframe
      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
      srcDoc={srcDoc}
      style={{ border: 0, height: '100%', minHeight: '100vh', width: '100%' }}
      title={title}
    />
  );
}
