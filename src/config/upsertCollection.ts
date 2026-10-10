import type { CollectionConfig } from 'payload';

const validateCollections = (
  collections: Array<CollectionConfig | undefined> | undefined
): CollectionConfig[] =>
  (collections ?? []).map((config, index) => {
    if (config === undefined) {
      throw new Error(
        `aiGenerate: config.collections[${index}] is undefined; a collection import probably resolved to undefined (circular import?)`
      );
    }

    return config;
  });

export const upsertCollection = (
  collections: Array<CollectionConfig | undefined> | undefined,
  collection: CollectionConfig
): CollectionConfig[] => {
  const existingCollections = validateCollections(collections);
  const existingIndex = existingCollections.findIndex(({ slug }) => slug === collection.slug);

  if (existingIndex === -1) {
    return [...existingCollections, collection];
  }

  const nextCollections = [...existingCollections];
  nextCollections[existingIndex] = collection;
  return nextCollections;
};
