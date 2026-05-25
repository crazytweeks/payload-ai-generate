import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Payload } from 'payload';
import { type GoogleModelId, models, type OpenAIModelId } from '../models';

import { aiModelsOptionsCollectionSlug } from './constants';

export type AIProvider = keyof typeof models;
type AiModelId = GoogleModelId | OpenAIModelId;

export type AIModelDoc = {
  id: number | string;
  provider: AIProvider;
  modelId: AiModelId;
  name?: string | null;
  isDefault?: boolean | null;
  isDeprecated?: boolean | null;
  isEnabled?: boolean | null;
  isRemoved?: boolean | null;
};

/**
 * Provider options reused by admin select fields.
 */
export const providerOptions = Object.keys(models).map((provider) => ({
  label: provider.charAt(0).toUpperCase() + provider.slice(1),
  value: provider,
}));

const defaultModels: Record<AIProvider, AiModelId> = {
  google: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, '..', '..');
const repoRoot = join(packageRoot, '..', '..');
const modelsOutputPath = join(packageRoot, 'src', 'models.json');
const modelsTypesOutputPath = join(packageRoot, 'src', 'models.ts');

/**
 * Flattens the generated model map into provider/model entries for collection sync.
 */
export const getModelEntries = () =>
  Object.entries(models).flatMap(([provider, providerModels]) =>
    providerModels.map((modelId) => ({
      id: `${provider}:${modelId}`,
      modelId,
      provider: provider as AIProvider,
    }))
  );

/**
 * Ensures each provider has a fallback default model when one is not already set.
 */
export const ensureFallbackDefaultForProvider = async (payload: Payload, provider: AIProvider) => {
  const existingDefault = await payload.find({
    collection: aiModelsOptionsCollectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        {
          provider: {
            equals: provider,
          },
        },
        {
          isDefault: {
            equals: true,
          },
        },
        {
          isEnabled: {
            equals: true,
          },
        },
        {
          isRemoved: {
            not_equals: true,
          },
        },
      ],
    },
  });

  if (existingDefault.docs.length > 0) {
    return;
  }

  const preferredModel = defaultModels[provider];
  const replacement = await payload.find({
    collection: aiModelsOptionsCollectionSlug,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      and: [
        {
          provider: {
            equals: provider,
          },
        },
        {
          isEnabled: {
            equals: true,
          },
        },
        {
          isRemoved: {
            not_equals: true,
          },
        },
        preferredModel
          ? {
              modelId: {
                equals: preferredModel,
              },
            }
          : {},
      ],
    },
  });

  const fallbackDoc =
    replacement.docs[0] ??
    (
      await payload.find({
        collection: aiModelsOptionsCollectionSlug,
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: {
          and: [
            {
              provider: {
                equals: provider,
              },
            },
            {
              isEnabled: {
                equals: true,
              },
            },
            {
              isRemoved: {
                not_equals: true,
              },
            },
          ],
        },
      })
    ).docs[0];

  if (!fallbackDoc) {
    return;
  }

  await payload.update({
    collection: aiModelsOptionsCollectionSlug,
    id: fallbackDoc.id,
    data: {
      isDefault: true,
    },
    overrideAccess: true,
  });
};

/**
 * Clears the default flag from sibling models when a new default is selected.
 */
export const ensureSingleDefaultPerProvider = async (payload: Payload, doc: AIModelDoc) => {
  if (!doc.isDefault) {
    return;
  }

  await payload.update({
    collection: aiModelsOptionsCollectionSlug,
    data: {
      isDefault: false,
    },
    overrideAccess: true,
    where: {
      and: [
        {
          provider: {
            equals: doc.provider,
          },
        },
        {
          id: {
            not_equals: doc.id,
          },
        },
        {
          isDefault: {
            equals: true,
          },
        },
      ],
    },
  });
};

/**
 * Reserved helper for future artifact sync expansion.
 */
export const syncModelsArtifacts = async () => {
  // no-op placeholder for future helper reuse
  return;
};

/**
 * Renders the generated `models.ts` module with literal tuple types.
 */
export const renderTypeModule = (modelsMap: { google: string[]; openai: string[] }): string => {
  const renderArray = (values: string[]) => values.map((value) => `    '${value}',`).join('\n');

  return `export const models = {
  google: [
${renderArray(modelsMap.google)}
  ],
  openai: [
${renderArray(modelsMap.openai)}
  ],
} as const;

export type GoogleModelId = (typeof models.google)[number];
export type OpenAIModelId = (typeof models.openai)[number];
`;
};

/**
 * Reads the latest installed package declaration file.
 */
export const readLatestDeclarationFile = async (
  cachePrefix: string,
  packageName: string
): Promise<string> => {
  const packageDirs = await getPackageDeclarationSearchDirs(cachePrefix, packageName);

  for (const pkgDir of packageDirs) {
    // Attempt to read package.json and use its `types` / `typings` entry if present
    try {
      const pkgJsonPath = join(pkgDir, 'package.json');
      const pkgJsonRaw = await readFile(pkgJsonPath, 'utf8');
      const pkg = JSON.parse(pkgJsonRaw) as Record<string, unknown>;

      const typeField = (pkg.types || pkg.typings) as string | undefined;
      if (typeField) {
        const candidate = join(pkgDir, typeField);
        try {
          return await readFile(candidate, 'utf8');
        } catch {
          // fall through to fallback search
        }
      }
    } catch {
      // ignore and fallback to common paths
    }

    const candidates = [
      join(pkgDir, 'dist', 'index.d.ts'),
      join(pkgDir, 'dist', 'index.d.mts'),
      join(pkgDir, 'dist', 'index.d.tsx'),
      join(pkgDir, 'dist', 'types.d.ts'),
      join(pkgDir, 'index.d.ts'),
      join(pkgDir, 'types', 'index.d.ts'),
    ];

    for (const p of candidates) {
      try {
        return await readFile(p, 'utf8');
      } catch {
        // try next
      }
    }

    // As a last resort, try to find any .d.ts files under dist/ or root
    const searchDirs = [join(pkgDir, 'dist'), pkgDir];
    for (const d of searchDirs) {
      try {
        const entries = await readdir(d);
        for (const entry of entries) {
          if (entry.endsWith('.d.ts')) {
            const p = join(d, entry);
            try {
              return await readFile(p, 'utf8');
            } catch {
              // ignore and continue
            }
          }
        }
      } catch {
        // ignore and continue
      }
    }
  }

  throw new Error(
    `Could not find declaration file for package ${packageName}. Ensure the package ships TypeScript declarations or add a local override.`
  );
};

const getPackageDeclarationSearchDirs = async (cachePrefix: string, packageName: string) => {
  const packageDirs = [
    join(repoRoot, 'node_modules', packageName),
    join(packageRoot, 'node_modules', packageName),
  ];

  try {
    const packageJsonUrl = await import.meta.resolve(`${packageName}/package.json`);
    packageDirs.unshift(dirname(fileURLToPath(packageJsonUrl)));
  } catch {
    // Resolution can fail in stripped Docker layers; explicit paths still cover common layouts.
  }

  try {
    const bunInstallCache = join(process.env.HOME ?? '/root', '.bun', 'install', 'cache');
    const cacheEntries = await readdir(bunInstallCache);
    for (const entry of cacheEntries) {
      if (entry.startsWith(cachePrefix)) {
        packageDirs.push(join(bunInstallCache, entry));
      }
    }
  } catch {
    // The cache is optional and may not exist outside Docker/Bun installs.
  }

  return [...new Set(packageDirs)];
};

/**
 * Writes the runtime JSON and typed TypeScript model artifacts used by the package.
 */
export const writeModelsArtifacts = async (modelsMap: { google: string[]; openai: string[] }) => {
  await writeFile(modelsOutputPath, `${JSON.stringify(modelsMap, null, 2)}\n`, 'utf8');
  await writeFile(modelsTypesOutputPath, renderTypeModule(modelsMap), 'utf8');
};
