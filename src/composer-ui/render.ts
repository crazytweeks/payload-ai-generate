export type ComposerUIFile = {
  content?: string | null;
  isEntryPoint?: boolean | null;
  language?: string | null;
  path?: string | null;
};

const normalizePath = (path?: string | null) => path?.replace(/^\.\//, '').trim() ?? '';

const escapeScriptContent = (value: string) => value.replaceAll('</script', '<\\/script');

const findEntryFile = (files: ComposerUIFile[]) =>
  files.find((file) => file.isEntryPoint) ??
  files.find((file) => normalizePath(file.path).toLowerCase() === 'index.html') ??
  files.find((file) => file.language === 'html') ??
  files[0];

const collectByLanguage = (files: ComposerUIFile[], language: string) =>
  files
    .filter((file) => file.language === language && file.content?.trim())
    .map((file) => file.content?.trim() ?? '')
    .join('\n\n');

const stripLocalAssetTags = (html: string) =>
  html
    .replace(/<link\b[^>]*href=["']\.?\/?(?:styles|style|index)\.css["'][^>]*>\s*/gi, '')
    .replace(/<script\b[^>]*src=["']\.?\/?(?:script|index|main)\.js["'][^>]*><\/script>\s*/gi, '');

export const buildComposerUISrcDoc = (files: ComposerUIFile[]) => {
  const entryFile = findEntryFile(files);
  const entryHtml = stripLocalAssetTags(
    entryFile?.content?.trim() ||
      '<!doctype html><html><head><meta charset="utf-8" /></head><body></body></html>'
  );
  const css = collectByLanguage(files, 'css');
  const js = collectByLanguage(files, 'javascript');
  const safeScript = escapeScriptContent(js);
  const cssTag = css ? `<style>\n${css}\n</style>` : '';
  const scriptTag = safeScript
    ? `<script>\ntry {\n${safeScript}\n} catch (error) { console.error(error); }\n</script>`
    : '';

  const withBase = entryHtml.includes('<head')
    ? entryHtml.replace(/<head([^>]*)>/i, '<head$1><base target="_blank" />')
    : `<base target="_blank" />${entryHtml}`;
  const withCss = withBase.includes('</head>')
    ? withBase.replace('</head>', `${cssTag}</head>`)
    : `${cssTag}${withBase}`;

  return withCss.includes('</body>')
    ? withCss.replace('</body>', `${scriptTag}</body>`)
    : `${withCss}${scriptTag}`;
};
