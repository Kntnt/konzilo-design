import schema from '../../schema/design-file.schema.json' with { type: 'json' };

// Validates the deliberately small JSON Schema vocabulary used by this schema.
// This is not a general-purpose JSON Schema implementation.
function validate(value, rule, path) {
  if (rule.$ref) return validate(value, schema.$defs[rule.$ref.split('/').at(-1)], path);
  const fail = (message) => { throw new TypeError(`${path}: ${message}`); };
  if (rule.const !== undefined && value !== rule.const) fail(`expected ${JSON.stringify(rule.const)}`);
  if (rule.enum && !rule.enum.includes(value)) fail('unsupported value');
  const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (rule.type && !(Array.isArray(rule.type) ? rule.type : [rule.type]).some((t) => t === type || (t === 'integer' && Number.isInteger(value)))) fail(`expected ${rule.type}`);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('expected a finite number');
    if (value < (rule.minimum ?? -Infinity) || value > (rule.maximum ?? Infinity)) fail('out of range');
  }
  if (typeof value === 'string') {
    if (value.length < (rule.minLength ?? 0)) fail('empty value');
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) fail('invalid format');
  }
  if (type === 'object') {
    for (const key of rule.required ?? []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const [key, v] of Object.entries(value)) {
      if (Object.hasOwn(rule.properties ?? {}, key)) validate(v, rule.properties[key], `${path}.${key}`);
      else if (rule.additionalProperties === false) fail(`unknown property ${key}`);
      else if (typeof rule.additionalProperties === 'object') validate(v, rule.additionalProperties, `${path}.${key}`);
    }
    for (const [key, required] of Object.entries(rule.dependentRequired ?? {})) {
      if (Object.hasOwn(value, key)) for (const other of required) if (!Object.hasOwn(value, other)) fail(`${key} requires ${other}`);
    }
  }
}

export function validateInputs(inputs) {
  validate(inputs, schema.$defs.inputs, 'inputs');
  return inputs;
}

export function validateDesignFile(file) {
  validate(file, schema, 'design-file');
  return file;
}
