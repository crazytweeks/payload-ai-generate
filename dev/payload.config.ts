import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { buildConfig } from 'payload';
import { aiGenerate } from 'payload-ai-generate';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { AiHtmlBlock } from '../src/blocks/ai-html-block/config';
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
          blocks: [AiHtmlBlock],
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
  ],

  db: mongooseAdapter({
    ensureIndexes: true,
    url: process.env.DATABASE_URL || '',
    connectOptions: {
      dbName: process.env.DATABASE_NAME || 'ai-plugin-dev',
      appName: process.env.DATABASE_APP_NAME || 'ai-plugin-dev',
    },
  }),
  editor: lexicalEditor(),
  email: testEmailAdapter,
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
