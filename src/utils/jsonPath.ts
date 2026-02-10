/**
 * Simple dot/bracket-notation JSON path resolver.
 * Supports: "data.customers", "results[0].name", "items[*].id"
 */
export function resolveJsonPath(obj: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/\[\*\]/g, ".*")
    .split(".");

  let current: unknown = obj;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (current === null || current === undefined) return undefined;

    if (segment === "*" && Array.isArray(current)) {
      const remaining = segments.slice(i + 1).join(".");
      if (remaining) {
        return current.map((item) => resolveJsonPath(item, remaining));
      }
      return current;
    }

    if (Array.isArray(current)) {
      const index = parseInt(segment, 10);
      if (isNaN(index)) return undefined;
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Flatten a nested object into dot-notation keys.
 * { a: { b: 1, c: { d: 2 } } } -> { "a.b": 1, "a.c.d": 2 }
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, fullKey)
      );
    } else {
      result[fullKey] = value;
    }
  }

  return result;
}
