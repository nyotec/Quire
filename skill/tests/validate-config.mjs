/**
 * Validate example-config.json against config-schema.json.
 *
 * A compact, dependency-free validator covering the JSON-Schema subset the
 * skill config uses: type, enum, required, properties, items,
 * additionalProperties. Keeps the example and the schema honest.
 *
 * Run:  node tests/validate-config.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(join(here, '..', 'config-schema.json'), 'utf-8'));
const example = JSON.parse(readFileSync(join(here, '..', 'example-config.json'), 'utf-8'));

const errors = [];

function typeOk(value, type) {
  if (Array.isArray(type)) return type.some((t) => typeOk(value, t));
  switch (type) {
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'number':
      return typeof value === 'number';
    default:
      return true;
  }
}

function validate(value, sch, path) {
  if (sch.enum) {
    if (!sch.enum.includes(value)) {
      errors.push(`${path}: ${JSON.stringify(value)} not in enum ${JSON.stringify(sch.enum)}`);
    }
  }
  if (sch.type && !typeOk(value, sch.type)) {
    errors.push(`${path}: expected type ${JSON.stringify(sch.type)}, got ${typeof value}`);
    return;
  }
  if ((sch.type === 'object' || sch.properties) && typeOk(value, 'object')) {
    for (const req of sch.required || []) {
      if (!(req in value)) errors.push(`${path}: missing required "${req}"`);
    }
    for (const [k, v] of Object.entries(value)) {
      const propSchema = sch.properties?.[k];
      if (!propSchema) {
        if (sch.additionalProperties === false) {
          errors.push(`${path}.${k}: not allowed (additionalProperties: false)`);
        }
        continue;
      }
      validate(v, propSchema, `${path}.${k}`);
    }
  }
  if (sch.type === 'array' && Array.isArray(value) && sch.items) {
    value.forEach((item, i) => validate(item, sch.items, `${path}[${i}]`));
  }
}

validate(example, schema, 'config');

if (errors.length) {
  console.error('Config validation FAILED:');
  for (const e of errors) console.error('  ✗', e);
  process.exit(1);
}
assert.equal(example.onboarded, true);
assert.ok(['topics', 'files', 'flat'].includes(example.organizationModel));
assert.ok(['always', 'ambiguous', 'silent'].includes(example.confirmation));
console.log('  ✓ example-config.json validates against config-schema.json');
console.log('\nSkill config check passed.');
