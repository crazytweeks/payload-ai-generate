/**
 * OpenRouter model catalogue.
 *
 * Unlike `google` and `openai`, whose model lists are generated into
 * `src/models.ts` as a static artifact, OpenRouter publishes a live catalogue
 * at a public endpoint (no API key) that includes machine-readable
 * capabilities:
 *
 *   architecture.input_modalities   text / image / file / audio / video
 *   architecture.output_modalities  text / image / audio
 *   supported_parameters            structured_outputs, reasoning, tools, …
 *   pricing, context_length
 *
 * Storing those capabilities is what lets a consumer pick a model that can
 * actually perform a task rather than discovering at runtime that, say, a
 * text-only model cannot read a scanned PDF or hold to a JSON schema.
 */

export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

export type ModelCapabilities = {
  inputText: boolean;
  inputImage: boolean;
  /** Native document (PDF) input. */
  inputFile: boolean;
  inputAudio: boolean;
  inputVideo: boolean;
  outputText: boolean;
  outputImage: boolean;
  outputAudio: boolean;
  /** Schema-constrained output (JSON schema / structured outputs). */
  structuredOutputs: boolean;
  /** Exposes a reasoning / thinking budget. */
  reasoning: boolean;
  toolCalling: boolean;
};

export type OpenRouterModel = {
  modelId: string;
  name: string;
  description: string;
  contextLength: number | null;
  /** USD per token, as reported by OpenRouter. */
  promptPrice: number | null;
  completionPrice: number | null;
  /** Raw modality string, e.g. "text+image+file->text". */
  modality: string | null;
  capabilities: ModelCapabilities;
};

type RawModel = {
  id?: string;
  name?: string;
  description?: string;
  context_length?: number | null;
  architecture?: {
    modality?: string | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
  } | null;
  pricing?: Record<string, string> | null;
  supported_parameters?: string[] | null;
};

const toPrice = (value: string | undefined): number | null => {
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const deriveCapabilities = (raw: RawModel): ModelCapabilities => {
  const input = new Set(raw.architecture?.input_modalities ?? []);
  const output = new Set(raw.architecture?.output_modalities ?? []);
  const params = new Set(raw.supported_parameters ?? []);

  return {
    inputText: input.has('text'),
    inputImage: input.has('image'),
    inputFile: input.has('file'),
    inputAudio: input.has('audio'),
    inputVideo: input.has('video'),
    outputText: output.has('text'),
    outputImage: output.has('image'),
    outputAudio: output.has('audio'),
    structuredOutputs: params.has('structured_outputs'),
    reasoning: params.has('reasoning') || params.has('include_reasoning'),
    toolCalling: params.has('tools'),
  };
};

const normalizeModel = (raw: RawModel): OpenRouterModel | null => {
  if (!raw.id) return null;

  return {
    modelId: raw.id,
    name: raw.name ?? raw.id,
    description: raw.description ?? '',
    contextLength: typeof raw.context_length === 'number' ? raw.context_length : null,
    promptPrice: toPrice(raw.pricing?.prompt),
    completionPrice: toPrice(raw.pricing?.completion),
    modality: raw.architecture?.modality ?? null,
    capabilities: deriveCapabilities(raw),
  };
};

/**
 * Fetches the live catalogue. No API key required.
 *
 * Throws on network or shape failure. Callers at startup MUST treat that as
 * non-fatal — a stale model list is never a reason for an app not to boot.
 */
export const fetchOpenRouterModels = async (options?: {
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<OpenRouterModel[]> => {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Honour an externally supplied signal as well as our own timeout.
  options?.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenRouter model list returned ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as { data?: RawModel[] };
    if (!Array.isArray(body.data)) {
      throw new Error('OpenRouter model list did not contain a data array.');
    }

    return body.data
      .map(normalizeModel)
      .filter((model): model is OpenRouterModel => model !== null);
  } finally {
    clearTimeout(timer);
  }
};

/** Human-readable summary for the admin list column. */
export const describeCapabilities = (capabilities: ModelCapabilities): string => {
  const input = [
    capabilities.inputText && 'text',
    capabilities.inputImage && 'image',
    capabilities.inputFile && 'file',
    capabilities.inputAudio && 'audio',
    capabilities.inputVideo && 'video',
  ].filter(Boolean);

  const output = [
    capabilities.outputText && 'text',
    capabilities.outputImage && 'image',
    capabilities.outputAudio && 'audio',
  ].filter(Boolean);

  const extras = [
    capabilities.structuredOutputs && 'structured',
    capabilities.reasoning && 'thinking',
    capabilities.toolCalling && 'tools',
  ].filter(Boolean);

  return [`${input.join('+') || 'none'} in`, `${output.join('+') || 'none'} out`, ...extras].join(
    ' · '
  );
};

/** What a task needs from a model. Any omitted capability is not required. */
export type CapabilityRequirement = Partial<ModelCapabilities>;

export const modelSupports = (
  capabilities: ModelCapabilities,
  requirement: CapabilityRequirement
): boolean =>
  Object.entries(requirement).every(([capability, required]) => {
    if (!required) return true;
    return capabilities[capability as keyof ModelCapabilities] === true;
  });
