/**
 * Small argument-coercion and error helpers shared by the tool handlers.
 * Every tool returns the same `{ success: false, error, code }` envelope on
 * failure so callers get a consistent shape.
 */
import type { ToolError } from '../types.js';

export class ToolInputError extends Error {
  constructor(
    message: string,
    public code = 'INVALID_ARGUMENT',
  ) {
    super(message);
  }
}

/** Turn any thrown value into the standard error envelope. */
export function fail(err: unknown): ToolError {
  const anyErr = err as { message?: string; code?: string };
  const message = anyErr?.message ? String(anyErr.message) : String(err);
  const code = typeof anyErr?.code === 'string' ? anyErr.code : 'ERROR';
  return { success: false, error: message, code };
}

export function asString(
  value: unknown,
  name: string,
  opts: { required?: boolean } = {},
): string {
  if (value == null) {
    if (opts.required) throw new ToolInputError(`"${name}" is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    throw new ToolInputError(`"${name}" must be a string.`);
  }
  if (opts.required && !value.trim()) {
    throw new ToolInputError(`"${name}" must not be empty.`);
  }
  return value;
}

export function asStringArray(value: unknown, name: string): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new ToolInputError(`"${name}" must be an array of strings.`);
  }
  return value.map((v, i) => {
    if (typeof v !== 'string') {
      throw new ToolInputError(`"${name}[${i}]" must be a string.`);
    }
    return v;
  });
}

export function asBool(value: unknown, name: string): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'boolean') {
    throw new ToolInputError(`"${name}" must be a boolean.`);
  }
  return value;
}

export function asNumber(value: unknown, name: string): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ToolInputError(`"${name}" must be a number.`);
  }
  return value;
}
