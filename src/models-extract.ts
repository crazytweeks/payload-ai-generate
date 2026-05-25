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
   */
  const extractUnionLiterals = (source: string, typeName: string): string[] => {
    const typePattern = new RegExp(String.raw`type\s+${typeName}\s*=\s*([^;]+);`, 's');
    const typeMatch = source.match(typePattern);

    if (!typeMatch) {
      throw new Error(`Could not find ${typeName} in declaration file.`);
    }

    const literals = typeMatch[1].match(/'([^']+)'/g) ?? [];
    return [...new Set(literals.map((literal) => literal.slice(1, -1)))];
  };

  return {
    google: extractUnionLiterals(googleSource, 'GoogleGenerativeAIModelId'),
    openai: extractUnionLiterals(openaiSource, 'OpenAIResponsesModelId'),
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
