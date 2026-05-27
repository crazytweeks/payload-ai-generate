import type { CollectionSlug, Payload } from 'payload';
import type { TestProduct } from '../../../dev/payload-types';
import { testProductsCollectionSlug } from '../testProducts';

const testProductsSeedData: Omit<TestProduct, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    sku: 'AI-BLOCK-STARTER',
    name: 'AI Block Starter',
    summary: 'A starter package for testing generated page sections with product data.',
    category: 'software',
    price: 49,
    isPublished: true,
  },
  {
    sku: 'PROMPT-REVIEW',
    name: 'Prompt Review Session',
    summary: 'A service-style reference record for testing mixed collection data.',
    category: 'service',
    price: 199,
    isPublished: true,
  },
  {
    sku: 'LANDING-TEMPLATE',
    name: 'Landing Page Template',
    summary: 'A template record that can be filtered independently from messages.',
    category: 'template',
    price: 29,
    isPublished: false,
  },
];

export const seedTestProductsCollection = async (payload: Payload) => {
  const collection = testProductsCollectionSlug as CollectionSlug;

  for (const product of testProductsSeedData) {
    const existing = await payload.find({
      collection,
      depth: 0,
      limit: 1,
      where: {
        sku: {
          equals: product.sku,
        },
      },
    });

    if (existing.docs[0]?.id) {
      await payload.update({
        id: existing.docs[0].id,
        collection,
        data: product,
      });
      continue;
    }

    await payload.create({
      collection,
      data: {
        ...product,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      draft: false,
    });
  }
};
