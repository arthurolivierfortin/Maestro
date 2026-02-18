// Generic JSON validator — schema comes from inputs, not hardcoded.
//
// Inputs (via environment variables set by ToolBlockExecutor):
//   MAESTRO_INPUT_DATA   — raw data to validate (may have prefixes, markdown wrapping)
//   MAESTRO_INPUT_SCHEMA — JSON string defining the validation schema
//
// Schema format:
//   { "type": "array"|"object",
//     "requiredFields": ["field1", "field2"],
//     "fieldTypes": { "field1": "string", "field2": "number" },
//     "items": { "requiredFields": [...], "fieldTypes": {...} },   // for arrays
//     "allowedValues": { "field": ["val1", "val2"] }               // enum constraints
//   }
//
// Output:
//   Valid   → the parsed JSON data directly (pass-through)
//   Invalid → { isValid: false, errors: [...], parsed: null }

const raw = process.env.MAESTRO_INPUT_DATA || '';
const schemaInput = process.env.MAESTRO_INPUT_SCHEMA || '';

// --- Step 1: Clean the raw input ---
let cleaned = raw.trim();

// Strip common output prefixes added by EntryPointExecutor
for (const prefix of ['result: ', 'content: ', 'response: ', 'output: ', 'summary: ']) {
  if (cleaned.startsWith(prefix)) {
    cleaned = cleaned.slice(prefix.length).trim();
    break;
  }
}

// Extract from markdown code blocks (agents sometimes wrap JSON in ```)
const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
if (mdMatch) cleaned = mdMatch[1].trim();

// --- Step 2: Parse JSON data ---
let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  console.log(JSON.stringify({
    isValid: false,
    errors: [`JSON parse error: ${e.message}. Input starts with: "${cleaned.substring(0, 100)}..."`],
    parsed: null
  }));
  process.exit(0);
}

// --- Step 3: Parse schema ---
let schema;
try {
  schema = typeof schemaInput === 'string' && schemaInput.trim().startsWith('{')
    ? JSON.parse(schemaInput)
    : null;
} catch (e) {
  console.log(JSON.stringify({
    isValid: false,
    errors: [`Schema parse error: ${e.message}`],
    parsed: null
  }));
  process.exit(0);
}

// If no schema provided, just validate that it's parseable JSON and pass through
if (!schema) {
  console.log(JSON.stringify(parsed));
  process.exit(0);
}

// --- Step 4: Validate against schema ---
const errors = [];

function validateObject(data, spec, prefix) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    errors.push(`${prefix}Expected a JSON object, got ${Array.isArray(data) ? 'array' : typeof data}`);
    return;
  }

  if (spec.requiredFields) {
    for (const field of spec.requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        errors.push(`${prefix}Missing required field '${field}'`);
      }
    }
  }

  if (spec.fieldTypes) {
    for (const [field, expectedType] of Object.entries(spec.fieldTypes)) {
      if (data[field] !== undefined && data[field] !== null) {
        const actual = Array.isArray(data[field]) ? 'array' : typeof data[field];
        if (actual !== expectedType) {
          errors.push(`${prefix}Field '${field}' should be ${expectedType}, got ${actual}`);
        }
      }
    }
  }

  if (spec.allowedValues) {
    for (const [field, allowed] of Object.entries(spec.allowedValues)) {
      if (data[field] !== undefined && !allowed.includes(data[field])) {
        errors.push(`${prefix}Field '${field}' has invalid value '${data[field]}' — must be one of: ${allowed.join(', ')}`);
      }
    }
  }
}

if (schema.type === 'array') {
  if (!Array.isArray(parsed)) {
    errors.push(`Expected a JSON array, got ${typeof parsed}`);
  } else if (parsed.length === 0 && schema.minItems !== 0) {
    errors.push('Array is empty — expected at least one item');
  } else if (schema.items) {
    parsed.forEach((item, i) => {
      validateObject(item, schema.items, `Item ${i + 1}: `);
    });
  }
} else if (schema.type === 'object') {
  validateObject(parsed, schema, '');
} else {
  // No type constraint, just pass through
}

// --- Step 5: Output ---
if (errors.length === 0) {
  console.log(JSON.stringify(parsed));
} else {
  console.log(JSON.stringify({ isValid: false, errors, parsed: null }));
}
