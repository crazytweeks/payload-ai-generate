import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { aiGenerate } from '@flash-lightning/ai-generate';
import path from 'path';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { DangerousCustomRenderBlock } from '../src/blocks/dangerous-custom-render/config';
import { testEmailAdapter } from './helpers/testEmailAdapter';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname;
}

const buildConfigWithMemoryDB = buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    {
      slug: 'posts',
      fields: [
        {
          type: 'blocks',
          name: 'content',
          blocks: [DangerousCustomRenderBlock],
        },
      ],
    },
    {
      slug: 'media',
      fields: [],
      upload: {
        staticDir: path.resolve(dirname, 'media'),
      },
    },
    // buildAIPromptCollection(),
  ],

  db: mongooseAdapter({
    ensureIndexes: true,
    url: process.env.DATABASE_URL || '',
    connectOptions: {
      dbName: process.env.DATABASE_NAME || 'ai-plugin-dev',
      appName: process.env.DATABASE_APP_NAME || 'ai-plugin-flash-lightning',
    },
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
  // onInit: async (payload) => {
  //   await seed(payload);
  // },
  plugins: [
    aiGenerate({
      previewPagePath: '/preview/ai-prompts',
      referenceMediaCollectionSlug: 'media',
      tooling: {
        enabled: true,
      },
      contextRoots: [path.resolve(dirname), path.resolve(dirname, '../src')],
      contextAllowlist: [path.resolve(dirname), path.resolve(dirname, '../src')],
      contextFileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'],
      contextMaxFileBytes: 24_000,
      contextMaxToolCallsPerRequest: 6,
    }),
  ],
  secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
});

export default buildConfigWithMemoryDB;
