# Issue 30-B-5 : Verifier code-reviewer (inference, Opus)

**Statut** : A faire
**Estimation** : 30 minutes
**Bloquant** : Non
**Prerequis** : Aucun (bloc inference, ne depend pas des tools)

---

## Description

Le bloc `code-reviewer` est un bloc **inference** (single LLM call, pas un agent). Il recoit les changements, les resultats de test, les conventions, et la tache, et produit une review structuree avec un score.

Il est deja teste et fonctionnel. Seule modification : changer le modele vers Opus pour la review holiste.

---

## Tache detaillee

### 1. Changer le modele

Fichier : `content/system/blocks/inference/code-reviewer/*.block.json`

Modification : `"model": "claude-opus"` (etait `claude-sonnet`)

### 2. Verifier le format de sortie

Le systemPrompt existant doit produire :

```json
{
  "score": 0.85,
  "approved": true,
  "axes": {
    "completeness": 0.9,
    "codeQuality": 0.85,
    "tests": 0.8,
    "architecture": 0.9,
    "security": 0.8
  },
  "issues": [
    {
      "severity": "warning|error|info",
      "file": "...",
      "description": "...",
      "suggestion": "..."
    }
  ],
  "summary": "..."
}
```

### 3. Verifier la logique de score

- score >= 0.8 → `"approved": true` → le pipeline commit
- score < 0.8 → `"approved": false` → le pipeline entre dans la boucle fix

---

## Instructions de test

### Test 1 : Review d'un bon code

```bash
cd maestro-cli
node index.js run code-reviewer \
  --input changes="Created src/hello.ts with greet function, added tests in src/hello.test.ts" \
  --input testResults='{"passed":5,"failed":0}' \
  --input task="Create a hello module" \
  --input conventions="camelCase, TypeScript strict"
```

**Verifications** :
- [ ] Score >= 0.8
- [ ] `approved: true`
- [ ] Summary positif
- [ ] Issues mineures (warnings) ou aucune

### Test 2 : Review d'un code mediocre

```bash
node index.js run code-reviewer \
  --input changes="Created src/hello.js (not TypeScript), no tests, uses var instead of const" \
  --input testResults='{"passed":0,"failed":0,"note":"No tests found"}' \
  --input task="Create a hello module with tests" \
  --input conventions="TypeScript strict, tests obligatoires"
```

**Verifications** :
- [ ] Score < 0.8
- [ ] `approved: false`
- [ ] Issues identifient : pas de TypeScript, pas de tests, `var` au lieu de `const`
- [ ] Summary critique

### Test 3 : Le score est coherent

Le score ne doit pas etre "gentil". Un code sans tests quand les tests sont demandes = score bas.

---

## Critere de completion

- [ ] Le modele est `claude-opus` dans le .block.json
- [ ] La sortie JSON contient les champs requis (score, approved, axes, issues, summary)
- [ ] Code correct → score >= 0.8, approved: true
- [ ] Code mediocre → score < 0.8, approved: false
- [ ] Les issues sont actionnables (fichier, description, suggestion)
- [ ] Le score est honnete (pas de complaisance)

---

## Risques

- **Risque** : Opus est plus indulgent que Sonnet (scores plus hauts)
- **Mitigation** : Tester avec un code volontairement mediocre et verifier que le score est bas
- **Risque faible** : Le bloc est deja fonctionnel, peu de changements
