import type {
  AIConversationMessage,
  AIGenerationArtifact,
  AIReferenceDataSource,
} from '../ai-types';

const buildMessagesContext = (messages: AIConversationMessage[]) => {
  if (messages.length === 0) {
    return '';
  }

  return messages.map((message) => `[${message.role}] ${message.content}`).join('\n\n');
};

const buildArtifactContext = (artifact?: AIGenerationArtifact) => {
  if (!artifact) {
    return '';
  }

  return [
    artifact.html?.trim() ? `Current HTML:\n${artifact.html}` : '',
    artifact.css?.trim() ? `Current CSS:\n${artifact.css}` : '',
    artifact.js?.trim() ? `Current JS:\n${artifact.js}` : '',
    artifact.variablesJSON?.trim() ? `Current Variables JSON:\n${artifact.variablesJSON}` : '',
    artifact.dataJSON?.trim() ? `Current Data JSON:\n${artifact.dataJSON}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildReferenceContext = (references: AIReferenceDataSource[]) => {
  const serverReferences = references.filter(
    (reference) =>
      reference.isBeingUsed === true &&
      reference.dataLoading !== 'client' &&
      typeof reference.referenceCollection === 'string' &&
      reference.referenceCollection.length > 0
  );

  if (serverReferences.length === 0) {
    return '';
  }

  return [
    'Reference data sources are available for this task.',
    'Before generating HTML, call the `fetch_reference_docs` tool for each active server-side reference source and use the returned documents to shape the component content.',
    'Active reference sources:',
    JSON.stringify(
      serverReferences.map((reference) => ({
        collection: reference.referenceCollection,
        filtersJSON: reference.filtersJSON ?? null,
        limit: reference.limit ?? 10,
      })),
      null,
      2
    ),
  ].join('\n');
};

/**
 * Builds the system prompt used for block generation.
 *
 * @param baseSystemPrompt - Optional preset-defined system prompt prepended ahead of package rules.
 * @returns Final system prompt string.
 *
 * @example
 * ```ts
 * const system = buildBlockGenerationSystemPrompt('Prefer the project design system.');
 * ```
 */
export const buildBlockGenerationSystemPrompt = (baseSystemPrompt?: string) => {
  const systemLines = [
    'You are an expert frontend engineer working inside a Payload CMS plugin.',
    'Your task is to generate or edit content for the `ai-html-block` used by the host application.',
    'Before generating, inspect available project context when useful using the provided tools. Prefer project-consistent structure, naming, spacing, and styling over generic UI output.',
    'Requirements:',
    '- Return only the generated artifact fields `{ "html", "css", "js", "variables", "data" }`.',
    '- Do not include Payload wrapper fields such as `blockType`; the plugin adds those after validation.',
    '- Return content that matches the exact block schema requested by the system.',
    '- `html` is required and must be semantic.',
    '- `css` and `js` are optional and should be minimal.',
    '- `variables` must be an array of objects using only `{ "key": string, "value": string }`.',
    '- `data` should only be used when structured runtime data is necessary.',
    '- For follow-up edits, modify the current artifact instead of rewriting everything unless the request explicitly asks for a rewrite.',
    '- Do not emit markdown fences or explanatory prose in the final structured result.',
    '- Do not use external scripts, remote assets, browser storage, auth state, or unsafe runtime behaviors unless explicitly requested.',
    '- If project conventions are unclear, inspect relevant files instead of guessing.',
  ];

  return [baseSystemPrompt?.trim(), ...systemLines].filter(Boolean).join('\n\n');
};

/**
 * Builds the primary user prompt sent to the model.
 *
 * @param params.currentArtifact - Current generated artifact state used for follow-up edits.
 * @param params.existingMessages - Persisted conversation history from the prompt document.
 * @param params.followup - Follow-up instruction for an existing artifact.
 * @param params.instructions - Initial generation instruction.
 * @param params.mode - Request mode that determines whether this is a new generation or edit.
 * @param params.title - Optional document title included for additional context.
 * @returns Final user prompt string.
 *
 * @example
 * ```ts
 * const prompt = buildAiHtmlPrompt({
 *   instructions: 'Build a three-column pricing section.',
 *   mode: 'generate',
 *   title: 'Pricing block',
 * });
 * ```
 */
export const buildAiHtmlPrompt = ({
  currentArtifact,
  existingMessages = [],
  followup,
  instructions,
  mode = 'generate',
  title,
  references = [],
}: {
  currentArtifact?: AIGenerationArtifact;
  existingMessages?: AIConversationMessage[];
  followup?: string;
  instructions?: string;
  mode?: 'followup' | 'generate' | 'retry-fix';
  title?: string;
  references?: AIReferenceDataSource[];
}) => {
  const trimmedInstructions = instructions?.trim();
  const trimmedFollowup = followup?.trim();
  const trimmedTitle = title?.trim();

  if (mode === 'generate' && !trimmedInstructions) {
    throw new Error('AI instructions are required.');
  }

  if (mode !== 'generate' && !trimmedFollowup) {
    throw new Error('Follow-up instructions are required.');
  }

  return [
    'Generate a Payload block for slug `ai-html-block`.',
    'The response must match the structured block schema exactly.',
    trimmedTitle ? `Document title: ${trimmedTitle}` : 'Document title: Untitled',
    trimmedInstructions ? `Primary instructions:\n${trimmedInstructions}` : '',
    existingMessages.length > 0
      ? `Conversation history:\n${buildMessagesContext(existingMessages)}`
      : '',
    buildArtifactContext(currentArtifact),
    buildReferenceContext(references),
    mode === 'generate'
      ? `Current task:\n${trimmedInstructions}`
      : `Follow-up change request:\n${trimmedFollowup}`,
  ]
    .filter(Boolean)
    .join('\n\n');
};

/**
 * Builds the repair prompt sent after a failed validation or post-check.
 *
 * @param params.currentArtifact - Current artifact state that should be minimally repaired.
 * @param params.errorMessage - Validation or runtime error that must be fixed.
 * @param params.existingMessages - Conversation history for additional context.
 * @param params.lastGeneratedJSON - Raw generated JSON from the failed attempt.
 * @param params.title - Optional document title.
 * @returns Repair prompt string.
 *
 * @example
 * ```ts
 * const repairPrompt = buildRepairPrompt({
 *   currentArtifact,
 *   errorMessage: 'variables must use { key, value }',
 *   lastGeneratedJSON,
 * });
 * ```
 */
export const buildRepairPrompt = ({
  currentArtifact,
  errorMessage,
  existingMessages = [],
  lastGeneratedJSON,
  title,
}: {
  currentArtifact?: AIGenerationArtifact;
  errorMessage: string;
  existingMessages?: AIConversationMessage[];
  lastGeneratedJSON: string;
  title?: string;
}) =>
  [
    'Repair the previously generated `ai-html-block`.',
    'Do not rewrite unrelated parts.',
    'Return the full corrected generated artifact using only `{ "html", "css", "js", "variables", "data" }`.',
    'Do not include Payload wrapper fields such as `blockType`; the plugin adds those after validation.',
    title?.trim() ? `Document title: ${title.trim()}` : 'Document title: Untitled',
    existingMessages.length > 0
      ? `Conversation history:\n${buildMessagesContext(existingMessages)}`
      : '',
    buildArtifactContext(currentArtifact),
    `Validation or post-check error:\n${errorMessage}`,
    `Previously generated block JSON:\n${lastGeneratedJSON}`,
  ]
    .filter(Boolean)
    .join('\n\n');
