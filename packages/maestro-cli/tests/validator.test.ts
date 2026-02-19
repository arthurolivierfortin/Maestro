// @ts-nocheck
const path = require('path');
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const validate = require(path.join(repoRoot, 'blocks', 'validators', 'commit-format', 'custom-rules.js'));

function run() {
  const validInput = {
    type: 'feat',
    scope: 'commit-generator',
    subject: 'add commit description workflow',
    body: 'Adds a workflow that generates commit messages.'
  };

  const res1 = validate(validInput);
  if (!res1.valid) {
    console.error('Expected valid input to be valid', res1.errors);
    process.exit(2);
  }

  const invalidInput = { type: 'unknown', subject: '' };
  const res2 = validate(invalidInput);
  if (res2.valid) {
    console.error('Expected invalid input to be invalid');
    process.exit(3);
  }

  console.log('validator.test.ts: OK');
}

if (require.main === module) run();
