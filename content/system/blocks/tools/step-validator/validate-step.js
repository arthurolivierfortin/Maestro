const fs = require('fs');
const path = require('path');

const stepJson = process.env.MAESTRO_INPUT_STEP || '{}';
const workingDir = process.env.MAESTRO_INPUT_WORKINGDIR || '';
const agentResult = process.env.MAESTRO_INPUT_RESULT || '';

let step;
try { step = JSON.parse(stepJson); } catch { step = {}; }

const errors = [];
const target = step.target ? path.resolve(workingDir, step.target) : null;

if (!target) {
  errors.push('No target path in step definition');
} else if (!step.action) {
  errors.push('No action in step definition');
} else {
  switch (step.action) {
    case 'create':
      if (!fs.existsSync(target)) {
        errors.push(`HALLUCINATION DETECTED: File '${step.target}' should have been CREATED but does NOT exist on disk`);
      } else {
        const stat = fs.statSync(target);
        if (stat.size === 0) {
          errors.push(`File '${step.target}' exists but is EMPTY (0 bytes) — likely not properly written`);
        }
      }
      break;
    case 'modify':
      if (!fs.existsSync(target)) {
        errors.push(`HALLUCINATION DETECTED: File '${step.target}' should have been MODIFIED but does NOT exist on disk`);
      }
      break;
    case 'delete':
      if (fs.existsSync(target)) {
        errors.push(`File '${step.target}' should have been DELETED but still exists on disk`);
      }
      break;
    case 'add-dependency':
    case 'run-command':
      // Can't easily verify on filesystem — pass
      break;
    default:
      errors.push(`Unknown action '${step.action}' — expected: create, modify, delete, add-dependency, run-command`);
  }
}

const result = {
  isValid: errors.length === 0,
  errors,
  target: step.target || null,
  action: step.action || null,
  fileSize: target && fs.existsSync(target) ? fs.statSync(target).size : null
};

console.log(JSON.stringify(result));
