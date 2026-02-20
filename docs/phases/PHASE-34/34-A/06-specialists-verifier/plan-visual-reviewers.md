# Plan F2 — Specialists VERIFIER (Visual Reviewers) : ui-reviewer, accessibility-checker

**Objectif** : Creer les 2 inference blocks de review visuelle et accessibilite de la phase VERIFIER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/06-specialists-verifier/spec.md`.
**Impact** : Creation de fichiers JSON + Markdown dans `content/system/blocks/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan-visual-reviewers.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient les system prompts complets et les details de conception. Tu DOIS le lire pour copier les prompts.
3. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 3 documents.**

---

## Contexte — Format attendu des blocs

### Format reel du codebase (PAS le format du spec)

Le spec v4 utilise des noms de champs qui different du codebase reel. **Le codebase fait foi.**

#### Agent block format (reference : `implement-single-step.agent.block.json`)

```
content/system/blocks/agents/<block-id>/
├── <block-id>.agent.block.json    <- Definition du bloc
└── system-prompt.md               <- System prompt externe
```

```json
{
  "id": "<block-id>",
  "name": "<Display Name>",
  "blockType": "agent",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "...",
  "inputs": [
    { "id": "inputName", "type": "string", "required": true, "description": "..." }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "..." }
  ],
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 8,
    "wallClockTimeoutSeconds": 600,
    "systemPromptFile": "system-prompt.md"
  },
  "metadata": {
    "category": "development",
    "designation": "autonomous",
    "tags": ["..."],
    "tier": 1
  }
}
```

#### Inference block format (reference : `code-reviewer.inference.block.json`)

Pour les inference blocks avec des prompts LONGS (plus de 500 caracteres), utiliser `systemPromptFile` avec un fichier externe :

> **DEPENDANCE** : Les inference blocks de ce plan utilisent `system-prompt.md` (fichier externe) pour leurs system prompts. Cela necessite l'Etape 5 du Plan A (13-infrastructure) qui ajoute le support `system-prompt.md` a `InferenceBlockExecutor`. Si Plan A n'est pas encore execute, les inference blocks doivent temporairement utiliser `config.systemPrompt` inline en attendant.

```
content/system/blocks/inference/<block-id>/
├── <block-id>.inference.block.json
└── system-prompt.md
```

```json
{
  "id": "<block-id>",
  "name": "<Display Name>",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "...",
  "inputs": [
    { "id": "inputName", "type": "string", "required": true, "description": "..." }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "..." }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.3,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["..."],
    "tier": 1
  }
}
```

**Points critiques** :
- `inputs` est un tableau d'objets `{id, type, required, description}` — PAS un objet avec des champs
- Agent blocks : `config.systemPromptFile` pointe vers un fichier markdown relatif au dossier du bloc
- Inference blocks avec prompts longs : utiliser egalement `systemPromptFile` au lieu de `systemPrompt` inline
- `config.model` utilise les model IDs reels : `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- `metadata.designation` = `"autonomous"` pour les agents — les inference blocks n'ont PAS de `designation`
- `isAtomic: true` pour TOUS les agents et inference blocks

### Differences cles spec vs codebase

| Spec dit | Codebase reel | Action |
|----------|---------------|--------|
| `inputs` en objet `{ champ: { type, description } }` | `inputs` en tableau `[{ id, type, required, description }]` | Convertir en tableau |
| `model: "Sonnet 4.6"` | `model: "claude-sonnet-4-6"` | Utiliser le model ID reel |
| `model: "Opus 4.6"` | `model: "claude-opus-4-6"` | Utiliser le model ID reel |
| `tools: [...]` dans la config | Pas de `tools` dans la config — les tools sont decrits dans le prompt | Ne pas ajouter `tools` |
| `config.systemPrompt` inline (tres long) | `config.systemPromptFile: "system-prompt.md"` | Utiliser un fichier externe pour les prompts longs |

---

## Bloc 1 : ui-reviewer (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/ui-reviewer/ui-reviewer.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/ui-reviewer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "ui-reviewer",
  "name": "UI Reviewer v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Reviews visual quality of implemented UI by analyzing screenshots and accessibility trees. Evaluates layout, alignment, spacing, color, animations, responsiveness, and accessibility. Uses vision model for screenshot analysis.",
  "inputs": [
    { "id": "screenshots", "type": "string", "required": true, "description": "JSON array of screenshot file paths captured by e2e-tester" },
    { "id": "accessibilityTree", "type": "string", "required": true, "description": "Accessibility tree of the page from playwright-accessibility" },
    { "id": "designContext", "type": "string", "required": false, "description": "JSON object with architecture.visualComponents (expected animations, components)" },
    { "id": "projectContext", "type": "string", "required": false, "description": "JSON object with CSS framework, design system info" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { score, issues, positives, accessibilityIssues }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.3,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["review", "ui", "visual", "accessibility", "vision", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 6.4 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, accessibility tree first, strict but fair, every issue needs a suggestion, never ignore accessibility issues)
- Evaluation Axes avec poids : Layout & Alignment (25%), Visual Design (25%), Interactions & Animations (20%), Consistency (15%), Accessibility (15%)
- Scoring scale (0.9-1.0 = exceptional, 0.8-0.89 = good, etc.)
- Accessibility Tree Analysis checklist
- Screenshot Analysis guidance
- Output format JSON

### Points d'attention

1. **Opus 4.6 OBLIGATOIRE** — ce bloc necessite la capacite de vision (analyse de screenshots) et le jugement esthetique. Sonnet n'est pas suffisant.
2. **C'est un inference block, PAS un agent** — une seule invocation LLM, pas de boucle agentic, pas de tool calls.
3. **L'accessibilite est une dimension primaire** — severity "error" par defaut pour les violations a11y. Le prompt est tres clair la-dessus.
4. **Chaque issue DOIT avoir une suggestion concrete** — "fix the alignment" n'est pas acceptable, "add items-center to the flex container" l'est.
5. **Vision model** — le modele Opus supporte l'analyse d'images. Les screenshots seront passes en tant qu'inputs au modele. L'infrastructure d'execution doit supporter le passage d'images (verifier que `LLMBlockExecutorBase` gere les inputs image).

### Note sur la capacite VISION

Le ui-reviewer est le seul bloc qui necessite un modele avec capacite vision. Si l'infrastructure d'execution ne supporte pas encore le passage d'images en input au LLM, ce bloc ne pourra pas fonctionner pleinement. Dans ce cas :
- Le bloc peut quand meme analyser l'accessibility tree (texte pur)
- L'analyse des screenshots sera degradee (le modele recevra les chemins mais pas les images)
- **Ceci est une limitation connue** a documenter, pas un bloquant pour la creation du bloc

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'ui-reviewer'"
# Resultat attendu : ui-reviewer  inference  4.0.0

# Test avec donnees simulees (sans screenshots reels)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run ui-reviewer --input screenshots='[\"screenshot-1.png\"]' --input accessibilityTree='<tree><button name=\"Submit\"/></tree>'"
# Resultat attendu : JSON avec score, issues, positives, accessibilityIssues
```

---

## Bloc 2 : accessibility-checker (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/accessibility-checker/accessibility-checker.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/accessibility-checker/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "accessibility-checker",
  "name": "Accessibility Checker v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Audits web pages for WCAG 2.1 AA compliance by analyzing the accessibility tree and optionally HTML source. Identifies violations, suggests fixes, and scores overall accessibility.",
  "inputs": [
    { "id": "accessibilityTree", "type": "string", "required": true, "description": "Complete accessibility tree of the page" },
    { "id": "htmlSource", "type": "string", "required": false, "description": "HTML source code of the page (optional, for deeper analysis)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { score, level, violations, passes, incomplete }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-sonnet-4-6",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["accessibility", "wcag", "a11y", "audit", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec.md` section 6.5 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, every violation references WCAG criterion, every violation includes fix, based on WCAG AA, mark "incomplete" if unsure)
- WCAG 2.1 AA Checks complet : Perceivable (1.1.1, 1.3.1, 1.4.1, 1.4.3, 1.4.4), Operable (2.1.1, 2.4.1-2.4.6), Understandable (3.1.1, 3.2.1, 3.3.1, 3.3.2), Robust (4.1.1, 4.1.2)
- Scoring scale
- Output format JSON

### Points d'attention

1. **Sonnet 4.6 suffit** — l'analyse d'accessibilite est structurelle (arbre + HTML), pas visuelle. Pas besoin d'Opus.
2. **`temperature: 0.2`** — scoring deterministe, pas creatif.
3. **Chaque violation DOIT avoir** : `wcag` (numero de critere), `severity`, `element`, `description`, `fix`.
4. **La categorie "incomplete"** est importante — si le checker ne peut pas determiner la conformite (ex: contraste de couleurs depuis l'arbre seul), il doit le dire honnetement, pas deviner.

### Differences entre ui-reviewer et accessibility-checker

| Aspect | ui-reviewer | accessibility-checker |
|--------|-------------|----------------------|
| Modele | Opus 4.6 (vision) | Sonnet 4.6 (texte) |
| Scope | Visual quality + accessibilite | Accessibilite WCAG uniquement |
| Inputs | Screenshots + accessibility tree | Accessibility tree + HTML source |
| Profondeur a11y | Surface (15% du score) | Complete (WCAG 2.1 AA full audit) |

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'accessibility-checker'"
# Resultat attendu : accessibility-checker  inference  4.0.0

# Test avec un arbre d'accessibilite simule
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run accessibility-checker --input accessibilityTree='<tree><heading level=1>Page Title</heading><img src=\"avatar.png\"/><button>Submit</button></tree>'"
# Resultat attendu : JSON avec score, level, violations (img sans alt), passes, incomplete
```

---

## Pipeline de creation et publication (OBLIGATOIRE)

Chaque bloc DOIT passer par ce pipeline complet. **Creer les fichiers ne suffit PAS** — le bloc doit etre teste et publie via le CLI.

### Pre-requis
Verifier que le backend est accessible :
```bash
curl -s http://localhost:5000/api/health
```
Si le backend n'est pas actif, le documenter dans `docs/phases/PHASE-34/irritations.md`. Les tests d'execution seront impossibles mais la creation des fichiers et la validation JSON restent possibles.

### Pour chaque bloc :
1. **Creer les fichiers** dans le dossier approprie (`content/system/blocks/<type>/<block-id>/`)
2. **Verifier la decouverte** par le backend :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String '<block-id>'"
   ```
   Si le bloc n'apparait pas -> verifier le format JSON, le nom de fichier, le chemin. Corriger avant de continuer.
3. **Tester l'execution** avec **minimum 2 scenarios** distincts :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run <block-id> --input key=value"
   ```
   Verifier que la sortie est du JSON valide (pour les blocs qui produisent du JSON).
4. **Iterer si la qualite est insuffisante** : modifier le prompt, ajuster la config, changer de modele. **Minimum 2 tentatives, maximum 5.**
5. **Publier le bloc** une fois les tests satisfaisants :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js block publish <block-id>"
   ```
6. **Verifier la publication** :
   ```bash
   powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js approvals list"
   ```
   Le bloc doit apparaitre dans la liste des approbations en attente.
7. **Documenter le score P/W** dans le checkpoint (voir section Criteres de qualite).
8. **Si bloque apres 5 iterations** : documenter dans `docs/phases/PHASE-34/irritations.md`, noter la raison du blocage, et passer au bloc suivant.

> **RAPPEL** : Un bloc cree mais non publie via `block publish` n'est PAS considere comme termine. Le statut DONE requiert la publication.

---

## Ordre d'execution

1. **accessibility-checker** — independant (analyse de texte, aucune dependance)
2. **ui-reviewer** — depend de e2e-tester (screenshots) et accessibility-checker (accessibility tree) pour un test reel, mais peut etre teste avec des donnees simulees

Les deux blocs sont des inference blocks independants. L'ordre est une recommandation : commencer par accessibility-checker (Sonnet, plus simple) permet de valider le pipeline avant d'attaquer ui-reviewer (Opus, plus complexe avec vision).

### Workflow de test

```bash
cd C:\Meastro\packages\maestro-cli

# 1. Tester accessibility-checker avec un arbre simule
node index.js run accessibility-checker \
  --input accessibilityTree='<tree><heading level=1>Title</heading><img/><button>OK</button></tree>'
# Verifier que l'img sans alt est detectee

# 2. Tester ui-reviewer avec des donnees simulees
node index.js run ui-reviewer \
  --input screenshots='["test-screenshot.png"]' \
  --input accessibilityTree='<tree><heading level=1>Title</heading></tree>' \
  --input designContext='{"hasUI":true}' \
  --input projectContext='{"cssFramework":"tailwind"}'
```

---

## Criteres de qualite (QualityScore)

Chaque bloc est evalue sur P (Performance) et W (Composabilite) :

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| ui-reviewer | Correlation avec l'evaluation humaine sur 20 UI reviews | >= 0.80 | JSON valide, chaque issue a une suggestion concrete | >= 0.95 |
| accessibility-checker | Detection des violations WCAG reelles (compare a axe-core) | >= 0.85 | JSON valide, chaque violation a wcag + fix | >= 0.95 |

### Test de P : 3 scenarios minimum par bloc

#### ui-reviewer

1. **Simple** : Screenshot d'une page propre + accessibility tree complet — score attendu >= 0.85
2. **Modere** : Screenshot avec problemes d'alignement + arbre avec images sans alt — score attendu 0.6-0.75
3. **Complexe** : Multiple screenshots (avant/apres interaction) + arbre avec violations multiples

#### accessibility-checker

1. **Simple** : Arbre propre (headings ordonnes, labels, alt text) — score attendu >= 0.90
2. **Modere** : Arbre avec 2-3 violations (img sans alt, heading skip h1->h3) — score attendu 0.7-0.8
3. **Complexe** : Arbre avec violations multiples + HTML source — verifier la profondeur de l'audit

### Test de W : verification automatisee

```bash
# Verifier que la sortie est du JSON valide pour chaque bloc
node index.js run accessibility-checker --input ... 2>/dev/null | python -m json.tool
node index.js run ui-reviewer --input ... 2>/dev/null | python -m json.tool
# Si la commande echoue -> W = 0 pour cette execution
```

---

## Erreurs courantes a eviter

1. **Mettre `config.systemPrompt` inline pour les inference blocks** — les prompts de cette phase sont LONGS (60+ lignes). Utiliser `config.systemPromptFile: "system-prompt.md"` avec un fichier externe. Ne PAS mettre tout le texte inline dans le JSON.
2. **Utiliser des model IDs incorrects** — c'est `claude-sonnet-4-6` (pas `sonnet`), `claude-opus-4-6` (pas `opus`).
3. **Oublier le champ `inputs` au format tableau** — c'est `[{id, type, required, description}]`, pas un objet.
4. **Mettre `isAtomic: false`** — les agents ET les inference blocks sont atomiques (`true`). Seuls les workflows sont `false`.
5. **Ne pas tester** — creer le fichier JSON ne suffit pas. Verifier que le backend decouvre le bloc ET que l'execution produit un resultat valide.
6. **Confondre agent et inference** — ui-reviewer et accessibility-checker sont des INFERENCE blocks (un seul appel LLM, pas de tools). NE PAS ajouter `maxIterations` ou `wallClockTimeoutSeconds` a leur config.
7. **Mettre `designation: "autonomous"` sur les inference blocks** — ce champ est pour les agents. Les inference blocks n'ont PAS de `designation` dans leur metadata (ou l'omettre).
8. **Oublier que ui-reviewer necessite Opus** — c'est le seul inference block de cette phase sur Opus (accessibility-checker est sur Sonnet). La raison est la capacite vision pour analyser les screenshots.
9. **Placer les inference blocks dans `agents/`** — les inference blocks vont dans `content/system/blocks/inference/<block-id>/`, PAS dans `agents/`.
10. **Copier le prompt du spec sans verifier** — verifier que le format de sortie JSON dans le prompt correspond a la structure decrite dans les outputs du bloc.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan F2 — VERIFIER Visual Reviewers] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan F2 : Specialists VERIFIER — Visual Reviewers
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 2
  - ui-reviewer : CREE / TESTE / PUBLIE / VALIDE
  - accessibility-checker : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - ui-reviewer : _/0.80
  - accessibility-checker : _/0.85
**W score** :
  - ui-reviewer : _/0.95
  - accessibility-checker : _/0.95
**Dependances bloquantes** :
  - ui-reviewer vision: verifier que l'infrastructure gere les inputs image
**Problemes** : [si BLOQUE]
```
