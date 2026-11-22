import ts from 'typescript';
import { readLatestDeclarationFile, writeModelsArtifacts } from './collections/shared';

type ModelMap = { google: string[]; openai: string[] };

/** Extract a provider's language-model IDs from its SDK declaration catalog. */
export function extractCatalogModels(source: string, catalogName: string, categoryProperty: string, category: string): string[] {
  const file = ts.createSourceFile('sdk.d.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = file.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => ts.isIdentifier(item.name) && item.name.text === catalogName);
  if (!declaration?.type || !ts.isTypeLiteralNode(declaration.type)) {
    throw new Error(`Could not find model catalog ${catalogName} in SDK declarations.`);
  }
  const models: string[] = [];
  for (const entry of declaration.type.members) {
    if (!ts.isPropertySignature(entry) || !entry.name || !ts.isStringLiteral(entry.name) ||
        !entry.type || !ts.isTypeLiteralNode(entry.type)) continue;
    const property = entry.type.members.find(
      (member) => ts.isPropertySignature(member) && member.name &&
        ts.isIdentifier(member.name) && member.name.text === categoryProperty,
    );
    if (!property || !ts.isPropertySignature(property) || !property.type) continue;
    const tuple = ts.isTypeOperatorNode(property.type) ? property.type.type : property.type;
    if (ts.isTupleTypeNode(tuple) && tuple.elements.some(
      (element) => ts.isLiteralTypeNode(element) && ts.isStringLiteral(element.literal) &&
        element.literal.text === category,
    )) models.push(entry.name.text);
  }
  return [...new Set(models)];
}

async function extractModels(): Promise<ModelMap> {
  const googleSource = await readLatestDeclarationFile('@ai-sdk+google@', '@ai-sdk/google');
  const openaiSource = await readLatestDeclarationFile('@ai-sdk+openai@', '@ai-sdk/openai');
  const models = {
    google: extractCatalogModels(googleSource, 'modelDefinitions', 'types', 'language'),
    openai: extractCatalogModels(openaiSource, 'openaiModelDefinitions', 'endpoints', 'responses'),
  };
  validateModels(models);
  return models;
}

export function validateModels(models: ModelMap): void {
  for (const [provider, ids] of Object.entries(models)) {
    if (ids.length < 10) {
      throw new Error(`Extracted only ${ids.length} ${provider} models; expected at least 10. SDK declaration format may have changed.`);
    }
  }
}

async function main() {
  const models = await extractModels();
  await writeModelsArtifacts(models);
  console.log(`Wrote models artifacts (Google: ${models.google.length}, OpenAI: ${models.openai.length})`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
