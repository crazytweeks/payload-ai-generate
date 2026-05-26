import type { UIMessage } from 'ai';
import type { ComposerPlan } from './types';

const extractPlan = (text: string): ComposerPlan | null => {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim()) as ComposerPlan;
    } catch {}
  }
  const bare = text.match(/\{[\s\S]*"design"[\s\S]*"approach"[\s\S]*\}/);
  if (bare?.[0]) {
    try {
      return JSON.parse(bare[0]) as ComposerPlan;
    } catch {}
  }
  return null;
};

export const extractPlanFromMessage = (msg: UIMessage): ComposerPlan | null => {
  const textContent = msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
  const fromText = extractPlan(textContent);
  if (fromText) return fromText;

  const reasoningContent = msg.parts
    .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
    .map((p) => p.text)
    .join('');
  return extractPlan(reasoningContent);
};
