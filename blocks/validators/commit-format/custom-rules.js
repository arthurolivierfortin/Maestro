module.exports = function validate(input) {
  const errors = [];
  const typeList = ["feat","fix","refactor","docs","test","chore"];
  if (!typeList.includes(input.type)) errors.push(`Invalid type: ${input.type}`);
  if (!input.subject || input.subject.length === 0) errors.push('Subject is required');
  if (input.subject && input.subject.length > 72) errors.push('Subject exceeds 72 characters');
  const conventionalRegex = /^(feat|fix|refactor|docs|test|chore)(\([a-z0-9\-]+\))?: [a-z0-9].*$/;
  if (!conventionalRegex.test(`${input.type}${input.scope ? `(${input.scope})` : ''}: ${input.subject}`)) {
    errors.push('Subject does not follow conventional commit pattern');
  }
  return { valid: errors.length === 0, errors };
}
