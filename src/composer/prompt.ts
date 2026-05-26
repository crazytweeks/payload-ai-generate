import type { AIReferenceDataSource } from '../ai-types';
import type { ComposerMessage } from './types';

export const buildComposerSystemPrompt = (): string =>
  [
    'You are an expert UI/UX architect and frontend engineer.',
    '',
    'Your role is to ANALYSE the user request and all available data, then produce a detailed UI generation PLAN.',
    'Do NOT write code yet. Think through:',
    '1. What data is available (from reference collections and tool calls)',
    '2. What the user actually needs',
    '3. The best design approach — layout, visual hierarchy, interaction patterns',
    '4. How to map available data to UI components',
    '5. Which Tailwind patterns, components, and structures to use and why',
    '',
    'Before producing the plan, use the `fetch_reference_docs` tool for each active reference source. Reason step by step.',
    '',
    'When your analysis is complete, output a JSON block with EXACTLY this structure:',
    '```json',
    '{',
    '  "design": "Visual design approach, colour scheme, layout structure",',
    '  "approach": "Technical approach — component architecture, rendering strategy",',
    '  "dataMapping": "How available data maps to UI elements",',
    '  "components": ["Component1: description", "Component2: description"],',
    '  "notes": "Any caveats, open questions, or decisions needing user input"',
    '}',
    '```',
    '',
    'The JSON block must be the last thing in your response.',
  ].join('\n');

export const buildComposerUserPrompt = ({
  firstPrompt,
  messages = [],
  references = [],
}: {
  firstPrompt: string;
  messages?: ComposerMessage[];
  references?: AIReferenceDataSource[];
}): string => {
  const parts: string[] = [`TASK: ${firstPrompt}`];

  const activeRefs = references.filter(
    (r) => r.isBeingUsed && r.dataLoading !== 'client' && r.collection
  );
  if (activeRefs.length > 0) {
    parts.push(
      `\nAvailable reference data sources:\n${JSON.stringify(activeRefs, null, 2)}`,
      'Call fetch_reference_docs for each source listed above before planning.'
    );
  }

  if (messages.length > 0) {
    parts.push('\nConversation so far:');
    for (const m of messages) {
      parts.push(`[${m.role}] ${m.content}`);
    }
    parts.push('\nUpdate the plan based on the latest message above.');
  }

  return parts.join('\n');
};
