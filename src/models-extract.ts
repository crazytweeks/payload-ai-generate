import { readLatestDeclarationFile, writeModelsArtifacts } from './collections/shared';

type ModelMap = {
  google: string[];
  openai: string[];
};

/**
 * Extracts model literal unions from the installed AI SDK declaration files.
 */
async function extractModels(): Promise<ModelMap> {
  const googleSource = await readLatestDeclarationFile('@ai-sdk+google@', '@ai-sdk/google');
  const openaiSource = await readLatestDeclarationFile('@ai-sdk+openai@', '@ai-sdk/openai');

  /**
   * Reads a `type Foo = 'a' | 'b' | ...` declaration and returns the literal members.
   * Tries each name in `typeNames` in order; returns the first successful match.
   */
  const extractUnionLiterals = (source: string, ...typeNames: string[]): string[] => {
    for (const typeName of typeNames) {
      const typePattern = new RegExp(String.raw`type\s+${typeName}\s*=\s*([^;]+);`, 's');
      const typeMatch = source.match(typePattern);
      if (typeMatch) {
        const literals = typeMatch[1].match(/'([^']+)'/g) ?? [];
        return [...new Set(literals.map((literal) => literal.slice(1, -1)))];
      }
    }
    throw new Error(`Could not find any of [${typeNames.join(', ')}] in declaration file.`);
  };

  return {
    // Prefer the most-specific type; fall back to broader aliases across SDK versions
    google: extractUnionLiterals(
      googleSource,
      'GoogleGenerativeAIModelId',
      'GoogleLanguageModelId',
      'GoogleModelId',
    ),
    openai: extractUnionLiterals(
      openaiSource,
      'OpenAIResponsesModelId',
      'OpenAIChatModelId',
      'OpenAIModelId',
    ),
  };
}

/**
 * Generates both runtime and typed model artifacts for the package.
 */
async function main() {
  const models = await extractModels();
  await writeModelsArtifacts(models);
  console.log('Wrote models artifacts');
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
