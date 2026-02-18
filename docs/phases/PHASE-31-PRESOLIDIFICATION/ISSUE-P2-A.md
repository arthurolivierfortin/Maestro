# Issue P2-A : Make json-validator Generic

**Priorite** : P2 (architecture violation)
**Estimation** : 3-4 heures
**Bloque** : Rien
**Bloque par** : Rien

---

## Probleme

Le bloc `json-validator` est entierement hardcode. Le script `validate.js` contient 4 schemas specifiques au workflow `autonomous-development` :

**Fichier** : `content/system/blocks/tools/json-validator/validate.js:37-94`

| Schema ID | Contenu | Generique ? |
|-----------|---------|-------------|
| `plan-steps` | Verifie un tableau avec `id`, `action`, `target`, `description` | Non — specifique au planner |
| `project-context` | Verifie `project`, `stack`, `name` | Non — specifique au project-preparer |
| `step-result` | Verifie que l'input est un objet | Trivial mais OK |
| `test-results` | Verifie que l'input est un objet | Trivial mais OK |

**Violation** : "Generic infrastructure, specific content." Un utilisateur qui cree un workflow de traduction devrait pouvoir utiliser `json-validator` sans le forker.

---

## Solution

Transformer `json-validator` en validateur generique qui recoit le schema en input.

### Nouvelle interface du bloc

```json
{
  "id": "json-validator",
  "type": "tool",
  "metadata": {
    "name": "JSON Validator",
    "description": "Validates JSON data against a provided schema definition"
  },
  "config": {
    "inputs": {
      "data": { "type": "string", "required": true, "description": "JSON string to validate" },
      "schema": { "type": "object", "required": true, "description": "Schema definition" }
    },
    "outputs": {
      "valid": { "type": "boolean" },
      "errors": { "type": "array" },
      "data": { "type": "object" }
    }
  }
}
```

### Format du schema (input)

Pas besoin d'implementer JSON Schema complet. Un format simple suffit :

```json
{
  "type": "array",
  "items": {
    "requiredFields": ["id", "action", "target", "description"],
    "fieldTypes": {
      "id": "string",
      "action": "string",
      "target": "string",
      "description": "string"
    }
  }
}
```

Ou pour un objet :

```json
{
  "type": "object",
  "requiredFields": ["project", "stack", "name"],
  "fieldTypes": {
    "project": "string",
    "stack": "string",
    "name": "string"
  }
}
```

### Migration des schemas existants

Les 4 schemas hardcodes migrent vers les inputs des nodes du workflow :

**Avant** (dans validate.js) :
```javascript
case 'plan-steps':
  // hardcoded validation
```

**Apres** (dans autonomous-development.workflow.block.json) :
```json
{
  "id": "validate-plan",
  "blockId": "json-validator",
  "inputs": {
    "data": "{{previousOutput}}",
    "schema": {
      "type": "array",
      "items": {
        "requiredFields": ["id", "action", "target", "description"],
        "fieldTypes": {
          "id": "string",
          "action": "string",
          "target": "string",
          "description": "string"
        }
      }
    }
  }
}
```

### Nouveau validate.js (pseudo-code)

```javascript
const data = JSON.parse(inputs.data);
const schema = inputs.schema;
const errors = [];

function validateValue(value, expectedType) {
  if (expectedType === 'string') return typeof value === 'string';
  if (expectedType === 'number') return typeof value === 'number';
  if (expectedType === 'boolean') return typeof value === 'boolean';
  if (expectedType === 'object') return typeof value === 'object' && !Array.isArray(value);
  if (expectedType === 'array') return Array.isArray(value);
  return true;
}

function validateObject(obj, schema) {
  if (schema.requiredFields) {
    for (const field of schema.requiredFields) {
      if (!(field in obj)) errors.push(`Missing required field: ${field}`);
    }
  }
  if (schema.fieldTypes) {
    for (const [field, type] of Object.entries(schema.fieldTypes)) {
      if (field in obj && !validateValue(obj[field], type)) {
        errors.push(`Field ${field}: expected ${type}, got ${typeof obj[field]}`);
      }
    }
  }
}

// Top-level type check
if (schema.type === 'array') {
  if (!Array.isArray(data)) { errors.push('Expected array'); }
  else if (schema.items) { data.forEach((item, i) => validateObject(item, schema.items)); }
} else if (schema.type === 'object') {
  validateObject(data, schema);
}

output({ valid: errors.length === 0, errors, data });
```

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `content/system/blocks/tools/json-validator/validate.js` | Recrire entierement — logique generique |
| `content/system/blocks/tools/json-validator/json-validator.tool.block.json` | Mettre a jour inputs/outputs |
| `content/system/blocks/workflows/autonomous-development.workflow.block.json` | Ajouter `schema` dans les inputs des nodes validate-plan et validate-step |

---

## Criteres de completion

- [ ] `validate.js` ne contient aucun nom de schema hardcode (pas de `plan-steps`, `project-context`, etc.)
- [ ] Le schema est passe en input au bloc
- [ ] Les 4 schemas existants sont migres dans les inputs du workflow `autonomous-development`
- [ ] Un test avec un schema arbitraire (ex: `{"type":"object","requiredFields":["foo","bar"]}`) fonctionne
- [ ] Le workflow `autonomous-development` fonctionne toujours apres la migration (non-regression)
