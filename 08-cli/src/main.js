import { getCommandTree, resolveCommandNode } from './tree.js';
import {
  renderGeneralHelp,
  renderNodeHelp,
  renderUnknownCommandError
} from './utils/renderHelp.js';
import { printSchema, renderSchemaTargetNotFound } from './commands/schema.js';
import { runUserCommand } from './commands/user.js';

export async function runCli(argv, io = defaultIo) {
  const tree = getCommandTree();
  const programName = tree.name;

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    io.write(renderGeneralHelp(tree));
    return 0;
  }

  const path = [];
  let commandNode = null;

  for (const token of argv) {
    if (token.startsWith('-')) {
      break;
    }

    const nextPath = [...path, token];
    const candidate = resolveCommandNode(tree, nextPath);

    if (!candidate) {
      break;
    }

    path.push(token);
    commandNode = candidate;
  }

  const remainingArgs = argv.slice(path.length);

  if (path.length === 0) {
    io.write(renderUnknownCommandError({ tree, argv }));
    return 1;
  }

  if (remainingArgs.includes('--help') || remainingArgs.includes('-h')) {
    io.write(renderNodeHelp(programName, commandNode));
    return 0;
  }

  const normalizedPath = path.join(' ');

  if (normalizedPath === 'schema') {
    if (remainingArgs.length === 0) {
      io.write(printSchema(tree));
      return 0;
    }

    const targetNode = resolveCommandNode(tree, remainingArgs);

    if (!targetNode) {
      io.write(renderSchemaTargetNotFound(remainingArgs));
      return 1;
    }

    io.write(printSchema(targetNode));
    return 0;
  }

  if (normalizedPath === 'user') {
    io.write(runUserCommand());
    return 0;
  }

  io.write(renderNodeHelp(programName, commandNode));
  return 0;
}

const defaultIo = {
  write(message) {
    process.stdout.write(message);
  }
};
