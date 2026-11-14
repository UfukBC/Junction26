/* Request validation. Every endpoint rejects missing, mistyped or oversized fields with a 400
 * and a structured JSON error, so the model only ever sees aggregates that fit the caps.
 */

export class BadRequest extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequest";
    this.code = "bad_request";
  }
}

export function object(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequest(`${name} must be an object`);
  return value;
}

export function string(value, name, { max, optional = false, pattern = null } = {}) {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw new BadRequest(`${name} is required`);
  }
  if (typeof value !== "string") throw new BadRequest(`${name} must be a string`);
  const clean = value.trim();
  if (!clean) throw new BadRequest(`${name} must not be empty`);
  if (max && clean.length > max) throw new BadRequest(`${name} must be at most ${max} characters`);
  if (pattern && !pattern.test(clean)) throw new BadRequest(`${name} has an invalid format`);
  return clean;
}

export function number(value, name, { min = -1e9, max = 1e9, optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return null;
    throw new BadRequest(`${name} is required`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) throw new BadRequest(`${name} must be a finite number`);
  if (value < min || value > max) throw new BadRequest(`${name} must be between ${min} and ${max}`);
  return value;
}

export function list(value, name, { max, optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return [];
    throw new BadRequest(`${name} is required`);
  }
  if (!Array.isArray(value)) throw new BadRequest(`${name} must be an array`);
  if (value.length > max) throw new BadRequest(`${name} must have at most ${max} items`);
  return value;
}

export function oneOf(value, name, allowed, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new BadRequest(`${name} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

export const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
