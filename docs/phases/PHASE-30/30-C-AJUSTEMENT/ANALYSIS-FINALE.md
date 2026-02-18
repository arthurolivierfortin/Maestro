# Analyse Finale : Autonomous Development — Diagnostic, Root Causes, Architecture

**Date**: 2026-02-17
**Phase**: 30-C-AJUSTEMENT
**Contexte**: Suite aux tests 30-C (simple, modere, complexe) du workflow `autonomous-development`

---

## 1. Ce qui a ete teste

### Test simple (30-C-2) — "Add a greet function"
- **Resultat**: SUCCESS
- **Fichiers crees**: 1 (hello.ts modifie)
- **Tool calls reels**: 5+ (confirme par diagnostic)
- **Git commit**: Cree correctement

### Test modere (30-C-3) — "Fix TypeScript compilation errors"
- **Resultat**: SUCCESS
- **Fichiers modifies**: 2 (utils.ts, main.ts)
- **Tool calls reels**: 12+ (confirme par diagnostic)
- **Verification**: `tsc --noEmit` clean apres fix

### Test complexe (30-C-4) — "Create FileTree component"
- **Resultat**: ECHEC — hallucination totale
- **Fichiers crees sur disque**: 0
- **Tool calls reels**: 0-1 (confirme par `[DIAG-AGENT]` logging)
- **Ce que l'agent pretend**: 10 fichiers crees, 9 tests passes
- **Realite**: Repo intact, aucun changement

---

## 2. Root Causes Identifies

### Root Cause 1 : L'agent "done" sans verification

`AgentBlockExecutor.cs` ligne 182-189 — le loop accepte `{"tool":"done"}` sans verifier qu'un seul tool call ait ete execute. Claude, face a une tache complexe de 10 steps, produit directement un resume fabrique.

**Preuve**: Le diagnostic `[DIAG-AGENT]` montre 43 tool calls avant le test complexe, 44 apres. Une seule execution pendant tout le Implement step.

### Root Cause 2 : Le loop casse au premier non-JSON

`AgentBlockExecutor.cs` ligne 227 — `if (!toolCalled || iteration >= maxIterations) break;`

Si Claude ajoute du texte reflexif avant son JSON, `ExtractJson` echoue, `toolCalled` reste false, le loop se termine. Pas de retry, pas de nudge.

### Root Cause 3 : Scope trop large pour l'implement agent

L'implement agent recoit 1 a 25 steps en bloc. Pour les taches simples (1-3 steps), le scope est gerable et Claude utilise les tools. Pour les taches complexes (10+ steps), Claude "voit" la solution complete et prend le raccourci de fabriquer un resume sans executer.

**Ce n'est pas un defaut du modele** — c'est un defaut de design. Claude est trop bon pour ce scope. Reduire le scope a 1 step force l'utilisation des tools.

### Root Cause 4 : Pollution du format de sortie

`EntryPointExecutor.cs` lignes 1084-1091 — l'output est formate comme `"result: <value>"`. Ce prefixe:
- Casse le parsing JSON en aval
- Force les agents a parser du texte au lieu de recevoir du JSON propre
- Rend les donnees inter-agents fragiles

### Root Cause 5 : Aucune validation entre agents

Chaque agent fait confiance a l'output du precedent. Si le plan est mal forme, l'implement agent recoit des donnees corrompues et hallucine. Si l'implement hallucine, le test agent test du vide. Si le test hallucine, le review valide du vent.

Chaine de confiance sans aucune verification = propagation d'erreurs silencieuse.

---

## 3. Architecture Actuelle vs Philosophie Maestro

### Ou l'architecture est BONNE

| Aspect | Status |
|--------|--------|
| `for-each` node type generique | Existe, fonctionne, resume-capable |
| `while` node type avec conditions | Existe, fonctionne |
| `conditional` node type | Existe, fonctionne |
| `phase` node type | Existe, fonctionne |
| blockRef dispatch generique | Fonctionne — resout le block, trouve l'executor |
| Template resolution `{{variable}}` | Fonctionne partout |
| Execution tree dans le monitor | Fonctionne, supporte le nesting |
| ValidatorBlockExecutor | Existe (basique: required fields + regex) |
| Tool blocks avec scripts | Fonctionnent (Node.js, PowerShell, bash, python) |

### Ou l'architecture VIOLE la philosophie

| Violation | Explication |
|-----------|-------------|
| **Implement agent fait l'iteration** | L'iteration devrait etre dans le workflow JSON (for-each), pas dans le prompt de l'agent |
| **Pas de validation entre agents** | Les contrats inter-agents sont implicites et non verifies |
| **Output formate avec prefixe** | Infrastructure ajoute du bruit aux donnees (`result: `) |
| **Pas de `set-variable` node type** | Impossible de stocker un output proprement dans une variable de session sans passer par un fichier |
| **ExecuteNodeAsync() avec `nodeId.Contains()`** | Legacy pattern-matching par nom — devrait etre entierement blockRef |

### Ce qui manque (petit, bien cible)

1. **Fix output format** (~10 lignes C#) — Enlever le prefixe `result:` pour les single-output blocks
2. **Fix agent loop** (~50 lignes C#) — Done guard + JSON retry + exception retry
3. **`set-variable` node type** (~40 lignes C#) — Stocke une valeur dans une variable de session
4. **`_currentItemJson` dans for-each** (~5 lignes C#) — Expose l'item courant comme template variable
5. **`json-validator` tool block** (JS script) — Voir section 4
6. **`step-validator` tool block** (JS script) — Verifie que les fichiers existent sur disque

Total infrastructure: ~105 lignes de C#. Le reste est content (blocks JSON + scripts).

---

## 4. Le Block `json-validator` : Piece Centrale du Design

### Le probleme qu'il resout

Actuellement, les agents communiquent par du **texte brut**. Le task-planner produit un JSON dans un `{"tool":"done","args":{"summary":"[...]"}}`, l'executor l'extrait comme string, l'EntryPointExecutor ajoute `"result: "` devant, et l'implement agent recoit :

```
## Plan
result: [{"id":1,"action":"create","target":"src/types/FileNode.ts","description":"Create FileNode type",...},{"id":2,...}]
```

Ce texte est :
- Non valide (le prefixe `result: ` casse le JSON)
- Non verifie (si le plan est mal forme, personne ne le detecte)
- Non structure (c'est du texte, pas une liste d'objets)
- Non visible dans le monitor (juste un blob de texte dans l'output d'un node)

Le `json-validator` transforme ce texte en **donnees structurees validees**.

### Comment il s'integre dans le flow

```
task-planner (agent)
    ↓ output: texte brut contenant du JSON (possiblement avec prefixe, markdown, etc.)
json-validator (tool block)
    ↓ 1. Strip le prefixe "result: " si present
    ↓ 2. Extrait le JSON des code blocks markdown si present
    ↓ 3. Parse le JSON
    ↓ 4. Verifie les champs requis (id, action, target, description pour plan-steps)
    ↓ 5. Output: JSON propre et valide, ou erreurs specifiques
    ↓
set-variable (node type)
    ↓ Stocke le JSON valide dans _planSteps
    ↓
for-each step in _planSteps
    ↓ Itere sur chaque step avec _currentItemJson
```

### Pourquoi c'est un tool block et pas du C#

Le `json-validator` est un **tool block** avec un script Node.js, pas un nouveau type de block en C# :

1. **Les schemas de validation sont du contenu** — "un plan a des champs id, action, target" est specifique au workflow de dev, pas a l'infrastructure Maestro. Un autre workflow (traduction, documentation) aurait des schemas differents.

2. **L'ajout de nouveaux schemas = editer un fichier JS** — Pas recompiler le backend. Un utilisateur peut ajouter `"my-custom-schema"` dans `validate.js` sans toucher au C#.

3. **Le `ToolBlockExecutor` sait deja executer des scripts** — Le `toolType: "script"` avec `runtime: "node"` est une capacite existante. Zero infrastructure a ajouter.

4. **C'est testable en isolation** — `node index.js run json-validator --input-json '{"data":"...","schema":"plan-steps"}'` fonctionne sans session, sans workflow, sans monitor.

### Schemas prevus

| Schema | Champs requis | Utilise entre |
|--------|--------------|---------------|
| `project-context` | `project` ou `stack` (objet) | prepare → plan |
| `plan-steps` | Array de `{id, action, target, description}` | plan → for-each |
| `step-result` | Objet (flexible) | implement-step → validate-step |
| `test-results` | Objet (flexible) | test → review |

Chaque schema est une fonction dans `validate.js`. Ajouter un schema = ajouter une fonction. Pattern simple, extensible, zero couplage.

### Relation avec `set-variable` et `for-each`

C'est ici que les trois pieces s'emboitent :

```json
{
  "id": "validate-plan",
  "name": "Validate Plan",
  "blockRef": "json-validator",
  "inputs": {
    "data": "{{previousOutput}}",
    "schema": "plan-steps"
  }
}
```

Le json-validator output: `[{"id":1,...},{"id":2,...}]` (JSON propre, pas de prefixe).

```json
{
  "id": "store-plan",
  "type": "set-variable",
  "variable": "_planSteps",
  "value": "{{previousOutput}}"
}
```

Le set-variable parse le JSON et le stocke comme `List<object>` dans la session.

```json
{
  "id": "implement-steps",
  "type": "for-each",
  "source": "_planSteps",
  "itemId": "id",
  "nodes": [...]
}
```

Le for-each lit `_planSteps`, itere, expose `_currentItemJson` a chaque step.

**C'est le pipeline complet** : texte brut → JSON valide → variable de session → iteration structuree. Chaque etape est un block ou node type generique. Zero logique specifique dans l'infrastructure.

### Ce que ca change pour l'anti-hallucination

Sans json-validator :
- L'agent hallucine → l'implement recoit un plan fabrique → execute du vent → tout "reussit"

Avec json-validator :
- L'agent hallucine → le JSON est mal forme → json-validator detecte les erreurs → le workflow peut reagir (retry, abort, log)
- L'agent produit un plan correct → json-validator le confirme → on est certain que `_planSteps` contient des donnees valides
- Chaque step est ensuite verifie par `step-validator` sur disque → double protection

---

## 5. Protocole de Tool Use : Decision Finale

### Pourquoi PAS le tool use natif

Lors de l'analyse, le protocole natif de Claude (structured `tool_use` blocks) a ete considere. Decision: **non**.

| Argument | Reponse |
|----------|---------|
| "C'est plus fiable" | Vrai, mais les 3 bugs du loop expliquent 95% des echecs |
| "C'est le standard" | Standard Anthropic, pas standard universel. OpenAI, local models = differents formats |
| "Claude Code l'utilise" | Claude Code est single-provider. Maestro est multi-provider |

**Decision**: Garder le text-based tool use. Fixer le loop. La fiabilite vient de la mecanique du loop, pas du protocole. Un loop robuste avec text-based est meilleur qu'un loop fragile avec natif.

Voir: `docs/phases/PHASE-30/30-C/ANALYSIS-AGENT-HALLUCINATION-AND-TOOL-PROTOCOL.md`

### Pourquoi PAS l'option (b) — for-each qui lit directement `_nodeResult_xxx`

Ca fonctionne techniquement mais c'est implicite. Le flux de donnees est cache — il faut savoir que `_nodeResult_validate-plan` contient le bon format. Pas de separation claire entre "output d'un block" et "input d'un for-each".

### Pourquoi l'option (c) — `set-variable` node type

C'est explicite, generique, reutilisable:

```json
{
  "id": "store-plan",
  "type": "set-variable",
  "variable": "_planSteps",
  "value": "{{_nodeResult_validate-plan}}"
}
```

- Le flux de donnees est visible dans le workflow JSON
- Le nom de la variable est choisi par le workflow, pas par convention
- C'est reutilisable pour n'importe quel scenario (stocker test results, review score, etc.)
- C'est 15 lignes de C# dans le dispatcher — infrastructure pure, zero contenu

---

## 6. Test de la Philosophie : "Est-ce Facile d'Ajouter un Block?"

Le test ultime de l'architecture Maestro : **ajouter un block doit etre trivial**.

### Avant les corrections

Pour ajouter `json-validator`:
1. Creer le `.block.json` — OK
2. Creer le script `validate.js` — OK
3. Le workflow peut l'appeler via `blockRef` — OK
4. Mais l'output arrive avec `result: ` — BUG, il faut parser
5. Mais on ne peut pas stocker le resultat dans une variable — MANQUE `set-variable`
6. Mais le for-each ne recoit pas l'item courant — MANQUE `_currentItemJson`

**Verdict**: Ajouter un block est possible mais les donnees entre blocks sont cassees.

### Apres les corrections

1. Creer le `.block.json` — OK
2. Creer le script — OK
3. Le workflow l'appelle via `blockRef` — OK
4. L'output est propre (pas de prefixe) — FIX
5. On stocke le resultat via `set-variable` — FIX
6. Le for-each expose `_currentItemJson` — FIX

**Verdict**: Ajouter un block est trivial. Le pipeline de donnees fonctionne proprement.

---

## 7. Ou Repartir Apres les Ajustements

Apres implementation du plan 30-C-AJUSTEMENT:

1. **Re-tester le test complexe** (FileTree component) avec le workflow v3
2. **Verifier dans le monitor** que chaque step apparait individuellement
3. **Verifier sur disque** que chaque fichier existe apres chaque step
4. **Si ca fonctionne** → documenter comme 30-C-5 (test complexe v3)
5. **Puis continuer** vers Phase 30-D (ce qui etait prevu) ou Phase 31

Le workflow v3 valide = Maestro peut faire du vrai developpement autonome sur des projets reels.
