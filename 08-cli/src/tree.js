const commandTree = {
  name: 'zlx-cli',
  description: 'CLI playground for validating command tree design.',
  usage: 'zlx-cli <command>',
  args: [],
  options: [],
  children: [
    {
      name: 'user',
      description: 'Run the user command.',
      usage: 'zlx-cli user',
      args: [
        {
          name: 'id',
          type: 'string',
          required: false,
          description: 'User identifier used for lookup or validation.'
        }
      ],
      options: [
        {
          name: '--json',
          type: 'boolean',
          required: false,
          description: 'Render the user result as JSON.'
        }
      ],
      children: []
    },
    {
      name: 'schema',
      description: 'Print the command tree or a command node as JSON.',
      usage: 'zlx-cli schema [command-path]',
      args: [
        {
          name: 'commandPath',
          type: 'string[]',
          required: false,
          description: 'Optional command path, for example: user'
        }
      ],
      options: [],
      children: []
    }
  ]
};

export function getCommandTree() {
  return commandTree;
}

export function resolveCommandNode(root, path) {
  let current = root;

  for (const segment of path) {
    current = current.children.find((child) => child.name === segment);

    if (!current) {
      return null;
    }
  }

  return current;
}
