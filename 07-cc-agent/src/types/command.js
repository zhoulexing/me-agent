/**
 * @typedef {object} Command
 * @property {string} name
 * @property {string} description
 * @property {string} usage
 * @property {string[]} aliases
 * @property {(context: {
 *   argv: string[],
 *   commands: Command[],
 *   io: { write(message: string): void },
 *   programName: string
 * }) => Promise<number> | number} execute
 */

export {};
