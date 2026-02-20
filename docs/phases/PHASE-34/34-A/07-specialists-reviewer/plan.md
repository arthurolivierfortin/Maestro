# Plan G — Specialists REVIEWER : code-reviewer, security-reviewer, architecture-reviewer

**Objectif** : Creer les 3 blocs specialistes de la phase REVIEWER du workflow v4.
**Prerequis** : Lire ce fichier integralement. Lire `docs/phases/PHASE-34/34-A/07-specialists-reviewer/spec.md`.
**Impact** : Creation de fichiers JSON + Markdown dans `content/system/blocks/`. Aucune modification de code C# ou TypeScript.

---

## LECTURE OBLIGATOIRE (avant toute action)

1. **Ce plan** (`plan.md`) : Lis ce fichier integralement avant de commencer
2. **Le spec** (`spec.md` dans le meme dossier) : Contient les system prompts complets et les details de conception. Tu DOIS le lire pour copier les prompts.
3. **CLAUDE.md** (racine du projet `C:\Meastro\CLAUDE.md`) : Regles architecturales obligatoires

> **Ne commence AUCUNE action avant d'avoir lu ces 3 documents.**

---

## Contexte — Format attendu des blocs

### Format reel du codebase (PAS le format du spec)

Le spec v4 utilise des noms de champs qui different du codebase reel. **Le codebase fait foi.**

Les 3 blocs de cette phase sont TOUS des **inference blocks** sur **Opus 4.6**. Ce sont des blocs a appel unique (single LLM call) — pas de boucle agentic, pas de tool calls. Ils recoivent du contexte et produisent un jugement structure.

#### Inference block format (reference : `code-reviewer.inference.block.json`)

Pour les prompts LONGS (ce qui est le cas des 3 reviewers), utiliser `systemPromptFile` :

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
    "temperature": 0.2,
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
- Les 3 reviewers utilisent `systemPromptFile: "system-prompt.md"` (prompts longs, 50+ lignes chacun)
- Tous sur `claude-opus-4-6` — le review de code/securite/architecture necessite un raisonnement profond
- `temperature: 0.2` — scoring deterministe, pas creatif
- `isAtomic: true` — toujours vrai pour les inference blocks
- PAS de `metadata.designation` pour les inference blocks (ce champ est pour les agents)

### Differences cles spec vs codebase

| Spec dit | Codebase reel | Action |
|----------|---------------|--------|
| `inputs` en objet `{ champ: { type, description } }` | `inputs` en tableau `[{ id, type, required, description }]` | Convertir en tableau |
| `model: "Opus 4.6"` | `model: "claude-opus-4-6"` | Utiliser le model ID reel |
| `config.systemPrompt` inline | `config.systemPromptFile: "system-prompt.md"` | Fichier externe pour les prompts longs |

### Note sur le code-reviewer existant (v2)

Un `code-reviewer.inference.block.json` v2 existe deja dans `content/system/blocks/inference/code-reviewer/`. La v4 le REMPLACE — pas de legacy support. Ecraser le fichier existant avec la nouvelle version.

---

## Bloc 1 : code-reviewer (inference block)

### Fichiers a creer/remplacer

| Fichier | Action | Contenu |
|---------|--------|---------|
| `content/system/blocks/inference/code-reviewer/code-reviewer.inference.block.json` | **REMPLACER** (v2 existe) | Definition du bloc v4 |
| `content/system/blocks/inference/code-reviewer/system-prompt.md` | **CREER** | System prompt complet v4 |

### Block definition JSON

```json
{
  "id": "code-reviewer",
  "name": "Code Reviewer v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Reviews implemented code for quality, completeness, and adherence to best practices. Evaluates on 7 weighted axes (completeness, code quality, error handling, tests, conventions, architecture, security). Single LLM call with deep reasoning.",
  "inputs": [
    { "id": "implementedSteps", "type": "string", "required": true, "description": "JSON array of implemented steps with files modified" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON object with conventions, architecture patterns" },
    { "id": "testResults", "type": "string", "required": false, "description": "JSON object with test results from the VERIFIER phase" },
    { "id": "iteration", "type": "string", "required": false, "description": "Current iteration number (0 = first pass). If > 0, previous issues must be verified as resolved." }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { score, approved, axes, issues, summary }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["review", "quality", "code", "evaluation", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/07-specialists-reviewer.md` section 7.1 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, never be lenient, score honestly, every issue has file/line/description/suggestion, approved only if score >= 0.8, check previous issues if iteration > 0)
- 7 Evaluation Axes avec poids : Completeness (20%), Code Quality (20%), Error Handling (15%), Tests (15%), Conventions (10%), Architecture (10%), Security (10%)
- Scoring Rules par axe
- Anti-Leniency Rules (hard caps : no error handling -> max 0.6, no tests -> max 0.5, security vuln -> max 0.4, TODO/placeholder -> max 0.7)
- Iteration penalty (reduce score by 0.1 per unfixed issue from previous pass)
- Output format JSON

### Differences vs code-reviewer v2

| Aspect | code-reviewer v2 | code-reviewer v4 |
|--------|-------------------|-------------------|
| Axes | 5 axes (completeness, codeQuality, tests, architecture, security) | 7 axes (ajout errorHandling, conventions) |
| Weights | completeness 30%, codeQuality 25%, tests 20%, architecture 15%, security 10% | completeness 20%, codeQuality 20%, errorHandling 15%, tests 15%, conventions 10%, architecture 10%, security 10% |
| Anti-leniency | Basic caps | Caps detailles + iteration penalty |
| Iteration support | Non | Oui (verifie que les issues precedentes sont resolues) |
| Prompt | Inline dans config.systemPrompt | Fichier externe system-prompt.md |
| Output axes | `axes.completeness: 0.9` (nombre seul) | `axes.completeness: { score: 0.9, weight: 0.20, notes: "..." }` (objet avec details) |
| Version | 2.0.0 | 4.0.0 |
| Model | `claude-opus` (ancien ID) | `claude-opus-4-6` (nouveau ID) |

### Points d'attention

1. **REMPLACER le fichier v2** — ne pas creer un second fichier. CLAUDE.md : "No legacy support. When a system is replaced, remove the old code entirely."
2. **Score = moyenne ponderee calculable** — le prompt exige que `score` soit exactement egal a la moyenne ponderee des axes. Anti-pattern : un score final qui ne correspond pas au calcul.
3. **`approved = (score >= 0.8)`** — pas de marge, pas de discretion. Si le score est 0.79, `approved: false`.
4. **Iteration tracking** — si `iteration > 0`, le reviewer doit verifier que les issues du pass precedent sont resolues. Issues non resolues = `severity: "error"`.

### Scoring formula verification

```
score = (completeness.score * 0.20)
      + (codeQuality.score * 0.20)
      + (errorHandling.score * 0.15)
      + (tests.score * 0.15)
      + (conventions.score * 0.10)
      + (architecture.score * 0.10)
      + (security.score * 0.10)

approved = (score >= 0.8)
```

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'code-reviewer'"
# Resultat attendu : code-reviewer  inference  4.0.0 (PAS 2.0.0)

# Test avec du code simule
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run code-reviewer --input implementedSteps='[{\"id\":\"1\",\"file\":\"src/utils.ts\",\"action\":\"create\",\"content\":\"export function add(a,b){return a+b}\"}]' --input projectContext='{\"conventions\":{\"naming\":\"camelCase\"}}' --input testResults='{\"passed\":3,\"failed\":0}' --input iteration='0'"
# Resultat attendu : JSON avec score, approved, axes (7 axes), issues, summary
# Verifier que score = weighted average des axes
```

---

## Bloc 2 : security-reviewer (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/security-reviewer/security-reviewer.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/security-reviewer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "security-reviewer",
  "name": "Security Reviewer v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Audits code for security vulnerabilities focusing on OWASP Top 10 (2021). Identifies actual vulnerabilities with severity levels, provides concrete fixes, and assesses whether code is safe to deploy. Single LLM call with deep security reasoning.",
  "inputs": [
    { "id": "implementedCode", "type": "string", "required": true, "description": "JSON array of implemented files with path and content" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON object with stack, framework information" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { pass, score, vulnerabilities, warnings, recommendations }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["security", "owasp", "audit", "vulnerabilities", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/07-specialists-reviewer.md` section 7.2 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, pass=false if critical or high severity, never false positives, every vuln references OWASP, focus on NEW code only)
- OWASP Top 10 (2021) complete : A01 (Broken Access Control), A02 (Crypto Failures), A03 (Injection), A04 (Insecure Design), A05 (Security Misconfiguration), A06 (Vulnerable Components), A07 (Auth Failures), A08 (Data Integrity), A09 (Logging Failures), A10 (SSRF)
- Severity Levels : critical, high, medium, low
- Scoring scale
- Output format JSON

### Points d'attention

1. **`pass: false` est un VETO** — dans le flux combine, meme si le score global est >= 0.8, si `security-reviewer.pass == false`, le code n'est PAS approuve. C'est une regle veto du spec.
2. **Pas de faux positifs** — le prompt insiste : "only report vulnerabilities you can trace to specific code". Signaler une SQL injection dans du code qui utilise un ORM avec parametres est un anti-pattern.
3. **Focus sur le code NOUVEAU** — ne pas auditer tout le projet. Seulement les fichiers dans `implementedCode`.
4. **Chaque vulnerabilite a un champ `impact`** en plus des champs standards — cela aide le developpeur a comprendre la gravite.

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'security-reviewer'"
# Resultat attendu : security-reviewer  inference  4.0.0

# Test avec du code simule (code propre)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run security-reviewer --input implementedCode='[{\"file\":\"src/service.ts\",\"content\":\"export async function getUser(id: string) { return await db.users.findOne({ id }) }\"}]' --input projectContext='{\"stack\":\"node\",\"framework\":\"express\"}'"
# Resultat attendu : JSON avec pass=true, score >= 0.9, vulnerabilities=[], warnings possibles

# Test avec du code vulnerable (XSS)
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run security-reviewer --input implementedCode='[{\"file\":\"src/render.ts\",\"content\":\"export function render(userInput: string) { document.innerHTML = userInput }\"}]' --input projectContext='{\"stack\":\"browser\",\"framework\":\"vanilla\"}'"
# Resultat attendu : JSON avec pass=false, score < 0.7, vulnerability XSS detectee
```

---

## Bloc 3 : architecture-reviewer (inference block)

### Fichiers a creer

| Fichier | Contenu |
|---------|---------|
| `content/system/blocks/inference/architecture-reviewer/architecture-reviewer.inference.block.json` | Definition du bloc |
| `content/system/blocks/inference/architecture-reviewer/system-prompt.md` | System prompt complet |

### Block definition JSON

```json
{
  "id": "architecture-reviewer",
  "name": "Architecture Reviewer v4",
  "blockType": "inference",
  "version": "4.0.0",
  "isAtomic": true,
  "description": "Evaluates whether implemented code is architecturally coherent with the project's existing patterns and the design decisions from the task-architect. Assesses separation of concerns, dependency direction, consistency, and design adherence. Single LLM call.",
  "inputs": [
    { "id": "implementedCode", "type": "string", "required": true, "description": "JSON array of implemented files with path and content" },
    { "id": "projectContext", "type": "string", "required": true, "description": "JSON object with architecture patterns, existing code structure" },
    { "id": "architecture", "type": "string", "required": false, "description": "JSON object from task-architect output (design decisions)" }
  ],
  "outputs": [
    { "id": "response", "type": "string", "description": "JSON object: { score, coherent, assessments, issues }" }
  ],
  "config": {
    "systemPromptFile": "system-prompt.md",
    "model": "claude-opus-4-6",
    "temperature": 0.2,
    "maxTokens": 4000
  },
  "metadata": {
    "category": "development",
    "tags": ["architecture", "review", "coherence", "patterns", "v4"],
    "tier": 1
  }
}
```

### System prompt

Copier le system prompt complet de `spec/07-specialists-reviewer.md` section 7.3 dans `system-prompt.md`.

Le prompt couvre :
- CRITICAL RULES (entire response is JSON, coherent=false if any assessment < 0.6, evaluate against PROJECT's architecture not ideal, every issue has suggestion)
- 4 Evaluation Aspects avec poids egaux (25% chacun) : Separation of Concerns, Dependency Direction, Consistency, Design Decision Adherence
- Scoring per aspect
- Output format JSON

### Points d'attention

1. **`coherent: false` est un VETO** — dans le flux combine, meme si le score global est >= 0.8, si `architecture-reviewer.coherent == false`, le code n'est PAS approuve.
2. **Evaluer contre le PROJET, pas l'ideal** — si le projet n'utilise pas de dependency injection, ne pas le penaliser. Le critere est la COHERENCE avec les patterns existants, pas avec l'architecture ideale.
3. **`architecture` input est optionnel** — si le task-architect n'a pas ete execute (ou n'a pas produit de design decisions), le reviewer evalue uniquement la coherence avec les patterns existants dans `projectContext`.
4. **4 aspects a poids egaux (25% chacun)** — plus simple que code-reviewer. Le score global est la moyenne des 4 scores.

### Scoring formula verification

```
score = (separationOfConcerns.score + dependencyDirection.score + consistency.score + designDecisions.score) / 4

coherent = all aspects >= 0.6
```

### Verification individuelle

```bash
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js list-blocks | Select-String 'architecture-reviewer'"
# Resultat attendu : architecture-reviewer  inference  4.0.0

# Test avec du code simule
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run architecture-reviewer --input implementedCode='[{\"file\":\"src/services/userService.ts\",\"content\":\"import { db } from '../db'; export async function getUser(id) { return db.users.find(id) }\"},{\"file\":\"src/components/UserCard.tsx\",\"content\":\"import { getUser } from '../services/userService'; export function UserCard({id}) { const user = getUser(id); return <div>{user.name}</div> }\"}]' --input projectContext='{\"architecture\":{\"pattern\":\"mvc\",\"layers\":[\"components\",\"services\",\"db\"]}}'"
# Resultat attendu : JSON avec score, coherent, assessments (4 aspects), issues
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
   Si le bloc n'apparait pas → verifier le format JSON, le nom de fichier, le chemin. Corriger avant de continuer.
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

Les 3 reviewers sont **independants** les uns des autres. Ils peuvent etre crees dans n'importe quel ordre. Ils s'executent en parallele dans le flux de la phase REVIEWER.

1. **code-reviewer** — remplacer le v2 existant par la v4
2. **security-reviewer** — nouveau bloc
3. **architecture-reviewer** — nouveau bloc

### Workflow de test chaine (phase REVIEWER complete)

```bash
cd C:\Meastro\packages\maestro-cli

# Preparer des inputs communs
# implementedCode = JSON array de fichiers avec contenu
# projectContext = JSON object avec stack/conventions

# 1. Code review
node index.js run code-reviewer \
  --input implementedSteps='[{"id":"1","file":"src/service.ts","action":"create","content":"export function add(a,b){return a+b}"}]' \
  --input projectContext='{"conventions":{"naming":"camelCase"},"architecture":{"pattern":"mvc"}}' \
  --input testResults='{"passed":5,"failed":0}' \
  --input iteration='0'
# Capturer score -> S_code

# 2. Security review
node index.js run security-reviewer \
  --input implementedCode='[{"file":"src/service.ts","content":"export function add(a,b){return a+b}"}]' \
  --input projectContext='{"stack":"node","framework":"express"}'
# Capturer score -> S_sec, pass -> P_sec

# 3. Architecture review
node index.js run architecture-reviewer \
  --input implementedCode='[{"file":"src/service.ts","content":"export function add(a,b){return a+b}"}]' \
  --input projectContext='{"architecture":{"pattern":"mvc","layers":["services","routes"]}}'
# Capturer score -> S_arch, coherent -> C_arch

# 4. Calcul combine (a faire manuellement pour verifier)
# combined = (S_code * 0.50) + (S_sec * 0.30) + (S_arch * 0.20)
# approved = combined >= 0.8 AND P_sec == true AND C_arch == true
```

### Formule du score combine (reference du spec)

```
Score combine = (codeReview.score * 0.50) + (securityReview.score * 0.30) + (archReview.score * 0.20)

approved = score >= 0.8 AND securityReview.pass == true AND archReview.coherent == true
```

**Regles de veto** (meme si score >= 0.8) :
- `security-reviewer.pass == false` (vulnerabilite critical/high) -> **NOT approved**
- `architecture-reviewer.coherent == false` (un aspect < 0.6) -> **NOT approved**

---

## Criteres de qualite (QualityScore)

Chaque bloc est evalue sur P (Performance) et W (Composabilite) :

| Bloc | P mesure | P seuil | W mesure | W seuil |
|------|----------|---------|----------|---------|
| code-reviewer | Correlation entre le score donne et la qualite reelle (evaluee par humain) | >= 0.85 | JSON valide, chaque issue a les champs requis, score calibre | >= 0.95 |
| security-reviewer | Detection des vrais vulnerabilites (recall) sans faux positifs (precision) | >= 0.85 | JSON valide, chaque vuln a owasp + fix | >= 0.95 |
| architecture-reviewer | Correlation avec l'evaluation architecturale humaine | >= 0.80 | JSON valide, assessments coherents, suggestions concretes | >= 0.95 |

### Test de P : 3 scenarios minimum par bloc

#### code-reviewer

1. **Code propre** : Fichier bien ecrit avec tests, bonne gestion d'erreurs, conventions respectees. Score attendu >= 0.85.
2. **Code mediocre** : Fichier sans error handling, sans tests, avec TODOs. Score attendu 0.5-0.65. Verifier que les anti-leniency rules s'appliquent.
3. **Iteration 1** : Memes fichiers que scenario 2 mais avec `iteration=1` et les issues du premier pass. Verifier que les issues non resolues sont detectees et penalisees.

#### security-reviewer

1. **Code propre** : ORM avec parametres, inputs valides, pas de secrets. Score attendu >= 0.90, pass=true.
2. **Code vulnerable** : `document.innerHTML = userInput` (XSS), `exec(userCommand)` (injection). Score attendu < 0.5, pass=false.
3. **Code ambigu** : URL construction avec user input mais avec `encodeURIComponent`. Verifier que c'est un warning (low), pas une vulnerability (high). Test de precision des faux positifs.

#### architecture-reviewer

1. **Code coherent** : Services importent les types, components importent les services, pas de circular deps. Score attendu >= 0.85, coherent=true.
2. **Code incoherent** : Component qui importe directement la DB, service qui importe un component. Score attendu 0.5-0.65, coherent=false.
3. **Design decisions** : Fournir un `architecture` input du task-architect et verifier que le reviewer detecte les deviations par rapport aux decisions.

### Test de W : verification automatisee

```bash
# Verifier que la sortie est du JSON valide pour chaque bloc
node index.js run code-reviewer --input ... 2>/dev/null | python -m json.tool
node index.js run security-reviewer --input ... 2>/dev/null | python -m json.tool
node index.js run architecture-reviewer --input ... 2>/dev/null | python -m json.tool
# Si la commande echoue -> W = 0 pour cette execution

# Verifier que le score du code-reviewer = weighted average
# Extraire score et axes, recalculer, comparer
```

### Test de calibration du code-reviewer

Le code-reviewer est le plus critique des 3 — son score a le plus gros poids (50%) dans le combine. Il faut verifier la calibration :

```
Test calibration:
1. Code excellent (no issues) -> score attendu 0.90-0.95
2. Code bon (minor issues) -> score attendu 0.80-0.85
3. Code moyen (some issues) -> score attendu 0.65-0.75
4. Code mauvais (many issues) -> score attendu 0.45-0.55
5. Code terrible (no error handling, no tests, TODOs, XSS) -> score attendu < 0.40
```

Si les scores ne suivent pas cette distribution, le prompt a un biais de leniency et doit etre ajuste.

---

## Erreurs courantes a eviter

1. **Mettre `config.systemPrompt` inline** — les 3 prompts de cette phase sont LONGS (100+ lignes). Utiliser `config.systemPromptFile: "system-prompt.md"` avec un fichier externe.
2. **Utiliser le mauvais model** — les 3 reviewers sont sur `claude-opus-4-6`. C'est intentionnel : le review necessite un raisonnement profond, la detection de subtilites, la calibration de scores. Sonnet n'est pas suffisant.
3. **Oublier que ce sont des inference blocks** — PAS des agents. Pas de boucle, pas de tool calls. Un seul appel LLM -> un JSON en sortie.
4. **Mettre `designation: "autonomous"`** — c'est un champ pour les agents. Les inference blocks n'ont pas de designation.
5. **Ne pas remplacer le code-reviewer v2** — le v2 doit etre ECRASE par le v4. Pas de coexistence. CLAUDE.md : "No legacy support."
6. **Score non calculable** — le code-reviewer v4 a 7 axes avec des poids. Le score DOIT etre exactement egal a la moyenne ponderee. Si le LLM invente un score qui ne correspond pas, c'est un echec de W.
7. **Oublier les veto rules** — `pass=false` (security) et `coherent=false` (architecture) sont des VETOS independants du score. Le prompt DOIT etre clair la-dessus.
8. **Inputs en objet au lieu de tableau** — spec dit `{ implementedSteps: { type: "array" } }`, codebase dit `[{ id: "implementedSteps", type: "string", required: true }]`. Toujours convertir.
9. **Mettre `maxIterations` sur les inference blocks** — les inference blocks n'ont PAS de `maxIterations` (c'est un concept agent). Ils ont `temperature` et `maxTokens`.
10. **Placer les blocs dans `agents/`** — les inference blocks vont dans `content/system/blocks/inference/<block-id>/`, PAS dans `agents/`.

---

## NOTES D'IRRITATION (OBLIGATOIRE)

Pendant l'execution de ce plan, documente **TOUTE** friction rencontree dans :
**`docs/phases/PHASE-34/irritations.md`**

Exemples : commandes CLI defaillantes, erreurs de decouverte, format JSON rejete, divergences spec/codebase, bugs backend/CLI, doc manquante, temps excessifs.

Format par entree :
```
### [Plan G — REVIEWER] — YYYY-MM-DD
- **Irritation** : Description
- **Contexte** : Ce que je faisais
- **Contournement** : Solution ou "bloque"
- **Suggestion** : Amelioration
```

---

## Checkpoint

```markdown
## Plan G : Specialists REVIEWER
**Statut** : EN_COURS / DONE / BLOQUE
**Date** : YYYY-MM-DD
**Blocs crees** : X / 3
  - code-reviewer : REMPLACE v2->v4 / TESTE / PUBLIE / VALIDE
  - security-reviewer : CREE / TESTE / PUBLIE / VALIDE
  - architecture-reviewer : CREE / TESTE / PUBLIE / VALIDE
**P score** :
  - code-reviewer : _/0.85
  - security-reviewer : _/0.85
  - architecture-reviewer : _/0.80
**W score** :
  - code-reviewer : _/0.95
  - security-reviewer : _/0.95
  - architecture-reviewer : _/0.95
**Calibration** :
  - code-reviewer calibration (5 scenarios) : PASS / FAIL
  - security-reviewer false positive rate : _
  - architecture-reviewer vs project patterns : PASS / FAIL
**Score combine formula verified** : OUI / NON
**Veto rules tested** : OUI / NON
**Problemes** : [si BLOQUE]
```
