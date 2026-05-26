import { type ToolSet, tool } from 'ai';
import { z } from 'zod';

export type GeneratedFile = {
  content: string;
  isEntryPoint: boolean;
  language: 'css' | 'html' | 'javascript' | 'json' | 'tsx' | 'typescript';
  path: string;
};

export type WriteFileCallbackResult =
  | Record<string, unknown>
  | undefined
  | Promise<Record<string, unknown> | undefined>;

/**
 * Creates the write_file tool used during UI generation.
 * Each call streams one file to the client via the callback.
 */
export const createUIGenerationTools = (
  onFile: (file: GeneratedFile) => WriteFileCallbackResult
): ToolSet => ({
  write_file: tool({
    description: [
      'Write a single source file for the UI being generated.',
      'Call this once per file — index.html first, then styles.css, then script.js, then any additional files.',
      'Do NOT batch all files into one call. Write each file separately so the user can see progress.',
    ].join(' '),
    inputSchema: z.object({
      path: z
        .string()
        .describe('Relative file path, e.g. "index.html", "styles.css", "script.js", "data.json".'),
      language: z
        .enum(['html', 'css', 'javascript', 'json', 'typescript', 'tsx'])
        .describe('Language / file type.'),
      content: z.string().describe('Full file content.'),
      isEntryPoint: z
        .boolean()
        .default(false)
        .describe('Set true for the main HTML entry point (index.html).'),
    }),
    execute: async ({ path, language, content, isEntryPoint }) => {
      const callbackResult = await onFile({ path, language, content, isEntryPoint });
      return { ok: true, path, ...(callbackResult ?? {}) };
    },
  }),
});
