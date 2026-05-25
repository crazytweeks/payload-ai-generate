import { z } from 'zod';

const generatedVariableSchema = z
  .object({
    defaultValue: z.string().optional(),
    key: z.string().optional(),
    label: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    value: z.string().optional(),
  })
  .strict();

/**
 * Structured output contract for `ai-html-block` generation.
 *
 * This schema is intentionally permissive for `variables` so providers can
 * return common alternate shapes such as `{ name, defaultValue }`, which are
 * normalized later.
 *
 * @example
 * ```ts
 * const parsed = generatedAiHtmlSchema.parse({
 *   html: '<section>Hello</section>',
 *   variables: [{ name: 'heading', defaultValue: 'Hello' }],
 * });
 * ```
 */
export const generatedAiHtmlSchema = z
  .object({
    html: z.string(),
    css: z.string().optional(),
    js: z.string().optional(),
    variables: z.array(generatedVariableSchema).optional(),
    data: z.unknown().optional(),
  })
  .strict();
