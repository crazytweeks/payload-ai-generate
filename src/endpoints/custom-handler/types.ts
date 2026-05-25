import type { PayloadHandler } from 'payload';
import type { AIConversationMessage, AIGenerationArtifact } from '../../ai-types';

/**
 * Request body accepted by the AI block-generation endpoint.
 *
 * @example
 * ```ts
 * const body: GenerateRequestBody = {
 *   instructions: 'Build a pricing section with three plans.',
 *   mode: 'generate',
 *   presetId: '661f5c2d4b2a9f0a12345678',
 *   stream: true,
 *   title: 'Pricing page block',
 * };
 * ```
 */
export type GenerateRequestBody = {
  /**
   * Optional upload references selected in the `ai-prompts` document.
   * These can be raw relationship IDs or shallow relationship objects.
   */
  attachments?: Array<number | string | Record<string, unknown>>;
  /**
   * Latest generated artifact values currently shown in the admin form.
   * These are used to support follow-up edits and repair attempts.
   */
  currentArtifact?: AIGenerationArtifact;
  /**
   * Follow-up instruction for editing an existing generated result.
   */
  followup?: string;
  /**
   * Primary seed instruction used during the first generation.
   */
  instructions?: string;
  /**
   * Persisted conversation messages from the `ai-prompts` document.
   */
  messages?: AIConversationMessage[];
  /**
   * Generation mode that determines how the prompt is interpreted.
   */
  mode?: 'followup' | 'generate' | 'retry-fix';
  /**
   * Optional AI preset document ID that defines provider, model, and system prompt.
   */
  presetId?: number | string;
  /**
   * When `false`, the endpoint waits for the final payload and returns JSON instead of NDJSON.
   */
  stream?: boolean;
  /**
   * Optional document title forwarded into prompt construction.
   */
  title?: string;
};

/**
 * Relationship value stored for preset model references.
 *
 * @example
 * ```ts
 * const modelRef: AIModelReference = {
 *   id: '661f5c2d4b2a9f0a12345678',
 *   modelId: 'gpt-4o-mini',
 * };
 * ```
 */
export type AIModelReference =
  | number
  | string
  | {
      id?: number | string;
      modelId?: string | null;
    }
  | null
  | undefined;

/**
 * Relationship value accepted for uploaded prompt references.
 *
 * @example
 * ```ts
 * const attachmentRef: AttachmentReference = {
 *   id: '661f5c2d4b2a9f0a12345678',
 *   filename: 'wireframe.webp',
 *   mimeType: 'image/webp',
 *   url: '/api/media/file/wireframe.webp',
 * };
 * ```
 */
export type AttachmentReference =
  | number
  | string
  | {
      id?: number | string;
      alt?: string | null;
      filename?: string | null;
      mimeType?: string | null;
      url?: string | null;
    }
  | null
  | undefined;

/**
 * Normalized attachment descriptor used internally after resolving upload docs.
 *
 * @example
 * ```ts
 * const attachment: ResolvedAttachment = {
 *   filename: 'wireframe.webp',
 *   mimeType: 'image/webp',
 *   url: 'http://localhost:3000/api/media/file/wireframe.webp',
 * };
 * ```
 */
export type ResolvedAttachment = {
  alt?: string;
  filename?: string;
  id?: number | string;
  mimeType?: string;
  url: string;
};

/**
 * Context object passed to helper functions that need the current Payload request.
 */
export type HandlerRequestContext = {
  payload: Parameters<PayloadHandler>[0]['payload'];
  req: Parameters<PayloadHandler>[0];
};
