function renderChildren(children) {
  if (!children || children.length === 0) {
    return '  <none>';
  }

  return children
    .map((child) => `  ${child.name}\n    ${child.description}`)
    .join('\n');
}

export function renderGeneralHelp(tree) {
  return [
    `${tree.name} - ${tree.description}`,
    '',
    'Usage:',
    `  ${tree.usage}`,
    `  ${tree.name} --help`,
    '',
    'Commands:',
    renderChildren(tree.children),
    ''
  ].join('\n');
}

export function renderNodeHelp(programName, node) {
  return [
    `${programName} ${node.name}`,
    '',
    node.description,
    '',
    'Usage:',
    `  ${node.usage}`,
    '',
    'Subcommands:',
    renderChildren(node.children),
    ''
  ].join('\n');
}

export function renderUnknownCommandError({ tree, argv }) {
  const attempted = argv.join(' ');

  return [
    `Unknown command: ${attempted}`,
    `Run \`${tree.name} --help\` to see available commands.`,
    '',
    renderGeneralHelp(tree)
  ].join('\n');
}
