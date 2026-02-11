/**
 * JsonInputParser - Transforms JSON command input into minimist-compatible argv objects.
 *
 * Allows agents to send structured JSON commands:
 *   {"command": "session.create", "params": {"type": "foundry", "name": "Test"}}
 *
 * Which gets transformed into:
 *   { _: ['session', 'create'], type: 'foundry', name: 'Test', json: true }
 */

interface ParsedArgv {
  _: (string | undefined)[];
  json: boolean;
  [key: string]: unknown;
}

interface JsonCommandInput {
  command: string;
  params?: Record<string, unknown>;
}

/**
 * Mapping of commands that use positional arguments (argv._[N]) instead of flags.
 * Key: dot-notation command. Value: object mapping param names to positional indices.
 */
const POSITIONAL_MAPPINGS: Record<string, Record<string, number>> = {
  'session.info':              { id: 2 },
  'session.start':             { id: 2 },
  'session.stop':              { id: 2 },
  'session.pause':             { id: 2 },
  'session.resume':            { id: 2 },
  'session.delete':            { id: 2 },
  'session.exec':              { id: 2, command: 3 },
  'session.events':            { id: 2 },
  'session.invoke':            { id: 2, entryPoint: 3 },
  'session.import':            { id: 2 },
  'session.vars':              { id: 2, action: 3, key: 4, value: 5 },
  'session.vars.list':         { id: 2 },
  'session.vars.get':          { id: 2, key: 4 },
  'session.vars.set':          { id: 2, key: 4, value: 5 },
  'session.vars.remove':       { id: 2, key: 4 },
  'session.entry-points':      { id: 2 },
  'session.widgets':           { id: 2 },
  'session.take-control':      { id: 2 },
  'monitor':                   { id: 1 },
  'info':                      { id: 1 },
  'children':                  { id: 1 },
  'search':                    { query: 1 },
  'execute':                   { workflow: 1 },
  'run':                       { blockId: 1 },
  'validate':                  { workflow: 1 },
  'block.info':                { id: 2 },
  'block.publish':             { id: 2 },
  'block.approve':             { id: 2 },
  'block.reject':              { id: 2 },
  'workspace.info':            { id: 2 },
  'workspace.create':          { name: 2 },
  'workspace.delete':          { id: 2 },
  'workspace.add-session':     { wsId: 2, sessionId: 3 },
  'workspace.add-project':     { wsId: 2, projectId: 3 },
  'workspace.permissions':     { id: 2 },
  'workspace.promote':         { wsId: 2 },
  'projects.info':             { id: 2 },
  'projects.delete':           { id: 2 },
  'projects.blocks':           { id: 2 },
  'projects.status':           { id: 2 },
  'projects.start':            { id: 2 },
  'projects.stop':             { id: 2 },
  'projects.restart':          { id: 2 },
  'projects.logs':             { id: 2 },
};

class JsonInputParser {
  /**
   * Parse a JSON command string into an argv-compatible object.
   */
  static parse(jsonString: string): ParsedArgv {
    let input: unknown;
    try {
      input = JSON.parse(jsonString);
    } catch (e: unknown) {
      throw new Error(`Invalid JSON input: ${(e as Error).message}`);
    }

    if (!input || typeof input !== 'object') {
      throw new Error('JSON input must be an object');
    }

    const inputObj = input as JsonCommandInput;

    if (!inputObj.command || typeof inputObj.command !== 'string') {
      throw new Error('Missing required field: "command"');
    }

    const command = inputObj.command.trim();
    const params = inputObj.params || {};

    // Split "session.create" → ['session', 'create']
    const parts = command.split('.');

    // Build positional args array
    const positionals: (string | undefined)[] = [...parts];

    // Check for positional mappings
    const mapping = POSITIONAL_MAPPINGS[command];
    if (mapping) {
      for (const [paramName, index] of Object.entries(mapping)) {
        if (params[paramName] !== undefined) {
          while (positionals.length <= index) {
            positionals.push(undefined);
          }
          positionals[index] = String(params[paramName]);
        }
      }
    }

    // Build argv object: positionals go to _, rest go as flags
    const argv: ParsedArgv = { _: positionals, json: true };

    // Map params to flags (skip those already mapped positionally)
    const positionalParamNames = mapping ? new Set(Object.keys(mapping)) : new Set<string>();
    for (const [key, value] of Object.entries(params)) {
      if (positionalParamNames.has(key)) continue;

      // Convert camelCase to kebab-case for CLI flags
      const flagKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      argv[flagKey] = value;
    }

    return argv;
  }

  /**
   * Read JSON from stdin (for large payloads piped in).
   */
  static async parseFromStdin(): Promise<ParsedArgv> {
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk: string) => { data += chunk; });
      process.stdin.on('end', () => {
        try {
          resolve(JsonInputParser.parse(data.trim()));
        } catch (e) {
          reject(e);
        }
      });
      process.stdin.on('error', reject);

      // Timeout after 5s if nothing comes through
      setTimeout(() => {
        if (!data) {
          reject(new Error('Stdin timeout: no input received within 5 seconds'));
        }
      }, 5000);
    });
  }
}

module.exports = { JsonInputParser };
export { JsonInputParser };
