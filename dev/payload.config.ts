import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import path from 'path';
import { buildConfig } from 'payload';
import { aiGenerate } from 'payload-ai-generate';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { AiHtmlBlock } from '@plugin/blocks/ai-html-block/config';
import { AiComposerUiBlock } from '@plugin/blocks/ai-composer-ui-block/config';
import { testEmailAdapter } from './helpers/testEmailAdapter';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname;
}

const enableDevTestCollections = process.env.PAYLOAD_AI_GENERATE_TEST_COLLECTIONS === 'true';

const buildConfigWithMemoryDB = buildConfig({
  admin: {
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    {
      slug: 'posts',
      admin: {
        useAsTitle: 'title',
        livePreview: {
          url: ({ data, req }) => {
            const host = req.headers.get('host') || 'localhost:4000';
            const proto = req.headers.get('x-forwarded-proto') || 'http';
            return `${proto}://${host}/posts/${data?.slug}`;
          },
        },
        preview: (data) => {
          const params = new URLSearchParams({
            path: `/posts/${data?.slug}`,
            previewSecret: process.env.PREVIEW_SECRET || '',
          });
          return `/next/preview?${params.toString()}`;
        },
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'slug',
          type: 'text',
          required: true,
          unique: true,
          admin: {
            position: 'sidebar',
          },
        },
        {
          type: 'blocks',
          name: 'content',
          blocks: [AiHtmlBlock, AiComposerUiBlock],
        },
      ],
      versions: {
        drafts: {
          autosave: {
            interval: 100,
          },
        },
        maxPerDoc: 50,
      },
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
      devTestCollections: enableDevTestCollections,
      referenceCollections: enableDevTestCollections
        ? {
            users: true,
            posts: true,
            'test-announcements': true,
            'test-messages': true,
            'test-products': true,
          }
        : undefined,
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
