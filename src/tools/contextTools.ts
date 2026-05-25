import { type ToolSet, tool } from 'ai';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import type { AIPluginOptions } from '../ai-types';

const defaultExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'];
const deniedPathSegments = new Set([
  '.git',
  '.next',
  '.turbo',
  'coverage',
  'dist',
  'build',
  'node_modules',
]);

type ResolvedToolingConfig = {
  allowlist: string[];
  enabled: boolean;
  extensions: Set<string>;
  maxFileBytes: number;
  maxToolCallsPerRequest: number;
  roots: string[];
};

const toAbsolutePath = (value: string) =>
  path.isAbsolute(value) ? path.resolve(value) : path.resolve(process.cwd(), value);

const resolveToolingConfig = (options: AIPluginOptions): ResolvedToolingConfig => {
  const roots = (options.contextRoots ?? []).map(toAbsolutePath);
  const allowlist = (options.contextAllowlist ?? roots).map(toAbsolutePath);
  const enabled = (options.tooling?.enabled ?? true) && roots.length > 0 && allowlist.length > 0;

  return {
    allowlist,
    enabled,
    extensions: new Set(
      (options.contextFileExtensions?.length
        ? options.contextFileExtensions
        : defaultExtensions
      ).map((extension) => extension.toLowerCase())
    ),
    maxFileBytes: options.contextMaxFileBytes ?? 32_000,
    maxToolCallsPerRequest: options.contextMaxToolCallsPerRequest ?? 6,
    roots,
  };
};

const isDeniedPath = (value: string) =>
  value
    .split(path.sep)
    .filter(Boolean)
    .some((segment) => deniedPathSegments.has(segment));

const isPathAllowed = (absolutePath: string, allowlist: string[]) =>
  allowlist.some((root) => absolutePath === root || absolutePath.startsWith(`${root}${path.sep}`));

const resolveCandidatePath = async (inputPath: string, roots: string[]) => {
  if (path.isAbsolute(inputPath)) {
    return path.resolve(inputPath);
  }

  for (const root of roots) {
    const candidate = path.resolve(root, inputPath);

    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Continue until a matching existing path is found.
    }
  }

  return path.resolve(roots[0] ?? process.cwd(), inputPath);
};

const assertToolAccess = async (
  inputPath: string,
  config: ResolvedToolingConfig,
  kind: 'file' | 'folder'
) => {
  if (!config.enabled) {
    throw new Error('Project context tools are disabled for this AI plugin instance.');
  }

  const resolvedPath = await resolveCandidatePath(inputPath, config.roots);

  if (isDeniedPath(resolvedPath)) {
    throw new Error('Requested path is outside the allowed project context.');
  }

  if (!isPathAllowed(resolvedPath, config.allowlist)) {
    throw new Error('Requested path is not allowlisted for AI context tools.');
  }

  const stats = await fs.stat(resolvedPath);

  if (kind === 'file' && !stats.isFile()) {
    throw new Error('Requested path is not a file.');
  }

  if (kind === 'folder' && !stats.isDirectory()) {
    throw new Error('Requested path is not a folder.');
  }

  return {
    resolvedPath,
    stats,
  };
};

const summarizeJSON = (value: unknown) => JSON.stringify(value, null, 2);

/**
 * Creates allowlisted local context tools for the AI generation flow.
 */
export const createContextTools = (options: AIPluginOptions): ToolSet => {
  const config = resolveToolingConfig(options);

  if (!config.enabled) {
    return {};
  }

  let toolCalls = 0;
  const countToolCall = () => {
    toolCalls += 1;

    if (toolCalls > config.maxToolCallsPerRequest) {
      throw new Error('Tool call limit exceeded for this generation request.');
    }
  };

  return {
    read_file: tool({
      description:
        'Read an allowlisted project text file when generation needs exact implementation or schema details.',
      inputSchema: z.object({
        path: z
          .string()
          .describe('Relative or absolute file path within the configured context roots.'),
      }),
      execute: async ({ path: inputPath }) => {
        countToolCall();

        const { resolvedPath, stats } = await assertToolAccess(inputPath, config, 'file');
        const extension = path.extname(resolvedPath).toLowerCase();

        if (!config.extensions.has(extension)) {
          throw new Error(`Files with extension "${extension}" are not allowed.`);
        }

        const handle = await fs.open(resolvedPath, 'r');

        try {
          const byteLength = Math.min(stats.size, config.maxFileBytes);
          const buffer = Buffer.alloc(byteLength);
          await handle.read(buffer, 0, byteLength, 0);

          return {
            bytesRead: byteLength,
            content: buffer.toString('utf8'),
            path: resolvedPath,
            totalBytes: stats.size,
            truncated: stats.size > config.maxFileBytes,
          };
        } finally {
          await handle.close();
        }
      },
    }),
    read_folder: tool({
      description:
        'List an allowlisted project folder to inspect collection files, blocks, or design system structure before generating code.',
      inputSchema: z.object({
        path: z
          .string()
          .describe('Relative or absolute folder path within the configured context roots.'),
        recursive: z
          .boolean()
          .optional()
          .describe('When true, include one nested level of folder contents.'),
      }),
      execute: async ({ path: inputPath, recursive }) => {
        countToolCall();

        const { resolvedPath } = await assertToolAccess(inputPath, config, 'folder');
        const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

        const output = await Promise.all(
          entries
            .filter((entry) => !deniedPathSegments.has(entry.name))
            .map(async (entry) => {
              const entryPath = path.join(resolvedPath, entry.name);

              if (
                recursive &&
                entry.isDirectory() &&
                isPathAllowed(entryPath, config.allowlist) &&
                !isDeniedPath(entryPath)
              ) {
                const nestedEntries = await fs.readdir(entryPath, { withFileTypes: true });

                return {
                  children: nestedEntries
                    .filter((nestedEntry) => !deniedPathSegments.has(nestedEntry.name))
                    .map((nestedEntry) => ({
                      name: nestedEntry.name,
                      path: path.join(entryPath, nestedEntry.name),
                      type: nestedEntry.isDirectory() ? 'directory' : 'file',
                    })),
                  name: entry.name,
                  path: entryPath,
                  type: 'directory',
                };
              }

              return {
                name: entry.name,
                path: entryPath,
                type: entry.isDirectory() ? 'directory' : 'file',
              };
            })
        );

        return {
          entries: output,
          path: resolvedPath,
          summary: summarizeJSON({
            entryCount: output.length,
            recursive: Boolean(recursive),
          }),
        };
      },
    }),
  };
};
