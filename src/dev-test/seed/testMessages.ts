import type { CollectionSlug, Payload } from 'payload';
import type { TestMessage } from '../../../dev/payload-types';
import { testMessagesCollectionSlug } from '../testMessages';

const testMessagesSeedData: Omit<TestMessage, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    key: 'welcome',
    title: 'Welcome Message',
    body: 'Welcome to the AI generated preview. This message is seeded for reference data testing.',
    category: 'general',
    author: 'Demo Admin',
    priority: 1,
    isPublished: true,
  },
  {
    key: 'product-launch',
    title: 'Product Launch Note',
    body: 'The new content block can use reference collection data while rendering dynamic pages.',
    category: 'product',
    author: 'Product Team',
    priority: 2,
    isPublished: true,
  },
  {
    key: 'support-followup',
    title: 'Support Follow-up',
    body: 'A support message with a different category helps test filters against seeded data.',
    category: 'support',
    author: 'Support Team',
    priority: 3,
    isPublished: false,
  },
] as const;

export const seedTestMessagesCollection = async (payload: Payload) => {
  const collection = testMessagesCollectionSlug as CollectionSlug;

  for (const message of testMessagesSeedData) {
    const existing = await payload.find({
      collection,
      depth: 0,
      limit: 1,
      where: {
        key: {
          equals: message.key,
        },
      },
    });

    if (existing.docs[0]?.id) {
      await payload.update({
        id: existing.docs[0].id,
        collection,
        data: message,
      });
      continue;
    }

    await payload.create({
      collection,
      data: {
        ...message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      draft: false,
    });
  }
};
