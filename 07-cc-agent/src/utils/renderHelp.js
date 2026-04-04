function formatCommandLine(command) {
  const aliasText = command.aliases.length > 0 ? ` (${command.aliases.join(', ')})` : '';
  return `  ${command.name}${aliasText}\n    ${command.description}`;
}

export function renderGeneralHelp({ programName, commands }) {
  const commandLines = commands.map(formatCommandLine).join('\n');

  return [
    `${programName} - study-oriented CLI scaffold`,
    '',
    'Usage:',
    `  ${programName} [command]`,
    `  ${programName} --help`,
    '',
    'Commands:',
    commandLines,
    '',
    'Current milestone:',
    '  Minimal command registry and help output.',
    ''
  ].join('\n');
}

export function renderCommandHelp({ programName, command }) {
  return [
    `${programName} ${command.name}`,
    '',
    command.description,
    '',
    'Usage:',
    `  ${command.usage}`,
    ''
  ].join('\n');
}

export function renderUnknownCommandError({ programName, commandName, commands }) {
  return [
    `Unknown command: ${commandName}`,
    `Run \`${programName} --help\` to see available commands.`,
    '',
    renderGeneralHelp({ programName, commands })
  ].join('\n');
}
