import type { CollectionSlug, Payload } from 'payload';
import { testAnnouncementsCollectionSlug } from '../testAnnouncements';

const testAnnouncementsSeedData = [
  {
    key: 'spring-release',
    headline: 'Spring Release Window',
    summary: 'A published announcement for testing date and audience filters.',
    audience: 'customers',
    startsAt: '2026-03-01T09:00:00.000Z',
    isPublished: true,
  },
  {
    key: 'internal-maintenance',
    headline: 'Internal Maintenance Notice',
    summary: 'An internal-only announcement that should be easy to filter out.',
    audience: 'internal',
    startsAt: '2026-04-15T18:00:00.000Z',
    isPublished: false,
  },
  {
    key: 'general-update',
    headline: 'General Platform Update',
    summary: 'A broad announcement for testing multiple server-side references.',
    audience: 'all',
    startsAt: '2026-05-01T12:00:00.000Z',
    isPublished: true,
  },
] as const;

export const seedTestAnnouncementsCollection = async (payload: Payload) => {
  const collection = testAnnouncementsCollectionSlug as CollectionSlug;

  for (const announcement of testAnnouncementsSeedData) {
    const existing = await payload.find({
      collection,
      depth: 0,
      limit: 1,
      where: {
        key: {
          equals: announcement.key,
        },
      },
    });

    if (existing.docs[0]?.id) {
      await payload.update({
        id: existing.docs[0].id,
        collection,
        data: announcement,
      });
      continue;
    }

    await payload.create({
      collection,
      data: announcement,
    });
  }
};
