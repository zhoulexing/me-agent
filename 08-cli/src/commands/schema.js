export function printSchema(node) {
  return `${JSON.stringify(node, null, 2)}\n`;
}

export function renderSchemaTargetNotFound(pathSegments) {
  return [
    `Schema target not found: ${pathSegments.join(' ')}`,
    'Use `zlx-cli schema` to inspect the full command tree.',
    ''
  ].join('\n');
}
