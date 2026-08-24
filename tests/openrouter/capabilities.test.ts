import { describe, expect, it } from 'vitest';
import {
  deriveCapabilities,
  describeCapabilities,
  type ModelCapabilities,
  modelSupports,
} from '../../src/openrouter';

const caps = (overrides: Partial<ModelCapabilities> = {}): ModelCapabilities => ({
  inputText: true,
  inputImage: false,
  inputFile: false,
  inputAudio: false,
  inputVideo: false,
  outputText: true,
  outputImage: false,
  outputAudio: false,
  structuredOutputs: false,
  reasoning: false,
  toolCalling: false,
  ...overrides,
});

describe('deriveCapabilities', () => {
  it('maps the OpenRouter catalogue shape onto capability flags', () => {
    // Shape taken from a real /api/v1/models response.
    expect(
      deriveCapabilities({
        id: 'google/gemini-3.7-flash',
        architecture: {
          input_modalities: ['text', 'image', 'video', 'file', 'audio'],
          output_modalities: ['text'],
        },
        supported_parameters: ['structured_outputs', 'reasoning', 'tools'],
      })
    ).toEqual({
      inputText: true,
      inputImage: true,
      inputFile: true,
      inputAudio: true,
      inputVideo: true,
      outputText: true,
      outputImage: false,
      outputAudio: false,
      structuredOutputs: true,
      reasoning: true,
      toolCalling: true,
    });
  });

  it('recognises include_reasoning as thinking support', () => {
    expect(
      deriveCapabilities({ id: 'x', supported_parameters: ['include_reasoning'] }).reasoning
    ).toBe(true);
  });

  it('distinguishes an image-generating model from a vision model', () => {
    // Vision = image IN. Image generation = image OUT. Conflating them sends
    // a picture to a model that can only draw one.
    const vision = deriveCapabilities({
      id: 'vision',
      architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
    });
    const generator = deriveCapabilities({
      id: 'generator',
      architecture: { input_modalities: ['text'], output_modalities: ['image'] },
    });

    expect(vision.inputImage).toBe(true);
    expect(vision.outputImage).toBe(false);
    expect(generator.inputImage).toBe(false);
    expect(generator.outputImage).toBe(true);
  });

  it('defaults every flag to false for a bare payload', () => {
    expect(Object.values(deriveCapabilities({ id: 'x' })).every((v) => v === false)).toBe(true);
  });
});

describe('modelSupports', () => {
  const legalExtraction = { inputFile: true, structuredOutputs: true, outputText: true };

  it('accepts a model meeting every requirement', () => {
    expect(modelSupports(caps({ inputFile: true, structuredOutputs: true }), legalExtraction)).toBe(
      true
    );
  });

  it('rejects a model that cannot read a document', () => {
    expect(modelSupports(caps({ structuredOutputs: true }), legalExtraction)).toBe(false);
  });

  it('rejects a model that cannot hold to a schema', () => {
    expect(modelSupports(caps({ inputFile: true }), legalExtraction)).toBe(false);
  });

  it('ignores capabilities a task does not ask for', () => {
    expect(modelSupports(caps(), { inputText: true, outputText: true })).toBe(true);
  });

  it('treats an explicitly false requirement as "do not care"', () => {
    expect(modelSupports(caps({ reasoning: false }), { inputText: true, reasoning: false })).toBe(
      true
    );
  });
});

describe('describeCapabilities', () => {
  it('summarises input, output and extras', () => {
    expect(
      describeCapabilities(
        caps({ inputImage: true, inputFile: true, structuredOutputs: true, reasoning: true })
      )
    ).toBe('text+image+file in · text out · structured · thinking');
  });

  it('handles a model with no declared modalities', () => {
    const bare = Object.fromEntries(
      Object.keys(caps()).map((key) => [key, false])
    ) as ModelCapabilities;
    expect(describeCapabilities(bare)).toBe('none in · none out');
  });
});
