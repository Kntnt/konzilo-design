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
  if (type === 'array' && rule.items) value.forEach((item, index) => validate(item, rule.items, `${path}[${index}]`));
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

// The shape of a design file, as this version reads it. It is raised only when that shape breaks, and the schema holds
// the number. `project.version` is a client's review version and `resolved.generator-version` the generator that made
// the values: neither says how to read the file.
export const DESIGN_FORMAT = schema.properties.format.const;

// Refuses a file of any other format, in words that say what to do. A file with no number is one from before there were
// numbers, and writing it once gives it one; a higher number is a file this version cannot know the shape of.
export function checkFormat(file) {
  const format = file?.format;
  if (format === DESIGN_FORMAT) return file;
  if (format === undefined) throw new Error(`This design file has no format number, and this version of the design system reads format ${DESIGN_FORMAT}. Run "konzilo-design resolve <file>", or make a change to it in the design tool, which writes the number.`);
  if (Number.isInteger(format) && format > DESIGN_FORMAT) throw new Error(`This design file is format ${format}, and this version of the design system reads format ${DESIGN_FORMAT}. Upgrade @kntnt/konzilo-design to a version that reads format ${format}.`);
  throw new Error(`This design file says its format is ${JSON.stringify(format)}, and this version of the design system reads format ${DESIGN_FORMAT}. Set "format" to ${DESIGN_FORMAT}, or make the file again in the design tool.`);
}

// For whatever writes a file or reads only its inputs: a file with no number gets this version's, as a missing input
// gets its default, and any other is refused. The format stands first in the file.
export const withFormat = (file) => ({ format: DESIGN_FORMAT, ...(file.format === undefined ? file : checkFormat(file)) });

export function validateInputs(inputs) {
  validate(inputs, schema.$defs.inputs, 'inputs');
  return inputs;
}

export function validateDesignFile(file) {
  checkFormat(file);
  validate(file, schema, 'design-file');
  return file;
}
