/**
 * Path resolver for widgets — resolves `$.variables.xxx` paths from session data.
 */

/**
 * Resolves a path string against a session object.
 *
 * Supports:
 * - `$.variables.key` → session.variables[key]
 * - `$.path.to.value` → deep property access
 * - Numbers are returned as-is
 * - Non-path strings are returned as-is (or as number if parseable)
 */
export const resolvePath = (session: Record<string, unknown>, pathStr: unknown): unknown => {
  if (typeof pathStr === 'number') return pathStr;
  if (typeof pathStr !== 'string') return pathStr;
  if (pathStr.startsWith('$.variables.')) {
    const vars = session.variables as Record<string, unknown> | undefined;
    return vars?.[pathStr.replace('$.variables.', '')];
  }
  if (pathStr.startsWith('$.')) {
    const parts = pathStr.substring(2).split('.');
    let current: unknown = session;
    for (const part of parts) {
      if (current == null) return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
  const num = Number(pathStr);
  return isNaN(num) ? pathStr : num;
};
