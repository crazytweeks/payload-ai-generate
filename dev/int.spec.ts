import config from '@payload-config';
import type { Payload } from 'payload';
import { createPayloadRequest, getPayload } from 'payload';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { customEndpointHandler } from '@plugin/endpoints/customEndpointHandler';

let payload: Payload;

afterAll(async () => {
  if (typeof (payload as Payload & { destroy?: () => Promise<void> }).destroy === 'function') {
    await (payload as Payload & { destroy: () => Promise<void> }).destroy();
  }
});

beforeAll(async () => {
  payload = await getPayload({ config });
});

describe('Plugin integration tests', () => {
  test('should reject empty AI generation requests', async () => {
    const request = new Request('http://localhost:3000/api/ai-generate/stream', {
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    const payloadRequest = await createPayloadRequest({ config, request });
    const response = await customEndpointHandler(payloadRequest);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toMatchObject({
      error: 'AI instructions are required.',
    });
  });

  test('plugin creates the prompt collection', async () => {
    const prompt = (await payload.create({
      collection: 'ai-prompts' as never,
      data: {
        html: '<section>Example</section>',
        instructions: 'Create a simple hero section',
        title: 'AI prompt',
      } as never,
    })) as { title: string };
    expect(prompt.title).toBe('AI prompt');
  });

  test('plugin creates the preset collection', async () => {
    expect((payload.collections as Record<string, unknown>)['ai-prompts']).toBeDefined();
    expect((payload.collections as Record<string, unknown>)['ai-presets']).toBeDefined();

    const preset = (await payload.create({
      collection: 'ai-presets' as never,
      data: {
        provider: 'google',
        systemPrompt: 'Be concise',
        title: 'Default preset',
      } as never,
    })) as { title: string };

    expect(preset.title).toBe('Default preset');
  });
});
