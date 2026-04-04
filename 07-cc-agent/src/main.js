import { getCommands, resolveCommand } from './commands.js';
import { renderGeneralHelp, renderUnknownCommandError } from './utils/renderHelp.js';

export async function runCli(argv, io = defaultIo) {
  const commands = getCommands();
  const programName = 'zlx-cc';

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    io.write(renderGeneralHelp({ programName, commands }));
    return 0;
  }

  const [commandName, ...commandArgs] = argv;
  const command = resolveCommand(commands, commandName);

  if (!command) {
    io.write(renderUnknownCommandError({ programName, commandName, commands }));
    return 1;
  }

  const result = await command.execute({
    argv: commandArgs,
    commands,
    io,
    programName
  });

  return Number.isInteger(result) ? result : 0;
}

const defaultIo = {
  write(message) {
    process.stdout.write(message);
  }
};
