const path = require('path');

// Inputs via environment variables (set by ToolBlockExecutor for script-based tools)
const raw = process.env.MAESTRO_INPUT_DATA || '';
const schemaName = process.env.MAESTRO_INPUT_SCHEMA || '';

// --- Step 1: Clean the raw input ---
let cleaned = raw.trim();

// Strip common output prefixes added by EntryPointExecutor (fallback for pre-fix code)
for (const prefix of ['result: ', 'content: ', 'response: ', 'output: ', 'summary: ']) {
  if (cleaned.startsWith(prefix)) {
    cleaned = cleaned.slice(prefix.length).trim();
    break; // Only strip the first match
  }
}

// Extract from markdown code blocks (agents sometimes wrap JSON in ```)
const mdMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
if (mdMatch) cleaned = mdMatch[1].trim();

// --- Step 2: Parse JSON ---
let parsed;
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  // Return specific parse error — this is what gets fed back to the agent on retry
  console.log(JSON.stringify({
    isValid: false,
    errors: [`JSON parse error: ${e.message}. Input starts with: "${cleaned.substring(0, 100)}..."`],
    parsed: null
  }));
  process.exit(0);
}

// --- Step 3: Validate against schema ---
const errors = [];

const schemas = {
  'plan-steps': (data) => {
    if (!Array.isArray(data)) return [`Expected a JSON array of steps, got ${typeof data}`];
    if (data.length === 0) return ['Plan is empty — no steps defined'];
    const errs = [];
    data.forEach((step, i) => {
      const prefix = `Step ${i + 1}`;
      if (step.id === undefined) errs.push(`${prefix}: missing 'id' (required: unique step number)`);
      if (!step.action) errs.push(`${prefix}: missing 'action' (required: create|modify|delete|add-dependency|run-command)`);
      if (!step.target) errs.push(`${prefix}: missing 'target' (required: relative file path from repo root)`);
      if (!step.description) errs.push(`${prefix}: missing 'description' (required: what to do)`);
      if (step.action && !['create', 'modify', 'delete', 'add-dependency', 'run-command'].includes(step.action)) {
        errs.push(`${prefix}: invalid action '${step.action}' — must be one of: create, modify, delete, add-dependency, run-command`);
      }
      if (step.target && path.isAbsolute(step.target)) {
        errs.push(`${prefix}: target '${step.target}' is an absolute path — must be relative to repo root`);
      }
    });
    return errs;
  },

  'project-context': (data) => {
    if (typeof data !== 'object' || Array.isArray(data)) return ['Expected a JSON object'];
    const errs = [];
    if (!data.project && !data.stack && !data.name) {
      errs.push("Missing project info — expected at least 'project', 'stack', or 'name' field");
    }
    return errs;
  },

  'step-result': (data) => {
    if (typeof data !== 'object' || Array.isArray(data)) return ['Expected a JSON object with step results'];
    return [];
  },

  'test-results': (data) => {
    if (typeof data !== 'object' || Array.isArray(data)) return ['Expected a JSON object with test results'];
    return [];
  }
};

const validator = schemas[schemaName];
if (!validator) {
  errors.push(`Unknown schema '${schemaName}'. Available: ${Object.keys(schemas).join(', ')}`);
} else {
  errors.push(...validator(parsed));
}

// --- Step 4: Output ---
// When valid: output the parsed data directly (clean pass-through for downstream consumers)
// When invalid: output the error envelope (for logging/retry)
if (errors.length === 0) {
  console.log(JSON.stringify(parsed));
} else {
  console.log(JSON.stringify({ isValid: false, errors, parsed: null }));
}
