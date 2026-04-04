import { helpCommand } from './commands/help/index.js';

export function getCommands() {
  return [helpCommand];
}

export function resolveCommand(commands, name) {
  return commands.find((command) => command.name === name || command.aliases.includes(name));
}
