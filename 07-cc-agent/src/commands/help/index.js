import { renderCommandHelp, renderGeneralHelp } from '../../utils/renderHelp.js';

export const helpCommand = {
  name: 'help',
  description: 'Show general help or help for a specific command.',
  usage: 'zlx-cc help [command]',
  aliases: ['-h', '--help'],
  async execute({ argv, commands, io, programName }) {
    const target = argv[0];

    if (!target) {
      io.write(renderGeneralHelp({ programName, commands }));
      return 0;
    }

    const command = commands.find(
      (item) => item.name === target || item.aliases.includes(target)
    );

    if (!command) {
      io.write(`Unknown command: ${target}\n`);
      io.write(`Run \`${programName} --help\` to see available commands.\n`);
      return 1;
    }

    io.write(renderCommandHelp({ programName, command }));
    return 0;
  }
};
