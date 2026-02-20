# Phase 34-B : Infrastructure — Tool Blocks + State Manager + Checkpointing

**Statut** : A faire
**Prerequis** : Phase 34-A COMPLETE (AGENT-V4-SPEC.md valide)
**Objectif** : Construire les fondations techniques necessaires aux agents specialistes : tool blocks (Playwright, web-search, compilation-check), state manager, et checkpointing dans le workflow engine.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/AGENT-V4-SPEC.md` | Le design spec complet — contient les definitions exactes des tool blocks et du state manager |
| `docs/phases/PHASE-34/AGENT-REQUEST.md` | Section 7 (dependances techniques) — ce qui existe vs ce qu'il faut ajouter |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Le workflow engine actuel — comprendre ou ajouter le checkpointing |
| `content/system/blocks/tools/` | Les tool blocks existants — respecter le format et les conventions |
| `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md` | Comprendre le block `parallel` (necessaire pour l'interaction-handler en 34-D) |
| `docs/phases/PHASE-28/PLAN-PHASE-28A.md` | Design du state manager — operations, format d'etat |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Creer les tool blocks Playwright
- `playwright-screenshot` : prend un screenshot d'une URL donnee, retourne le chemin de l'image
- `playwright-accessibility` : lit l'arbre d'accessibilite d'une page, retourne le JSON
- `playwright-interact` : effectue des actions DOM (click, type, navigate)
- Chaque bloc est un `*.block.json` + script d'execution
- Prerequis : Playwright doit etre installe (`npx playwright install`)

### Etape 2 : Creer les tool blocks utilitaires
- `web-search` : effectue une recherche web, retourne les resultats formetes
- `compilation-check` : detecte le build system (npm/dotnet/cargo/make), execute le build, retourne les erreurs
- `memory-read` : lit un fichier dans `.maestro/memory/`
- `memory-write` : ecrit/met a jour un fichier dans `.maestro/memory/`

### Etape 3 : Creer le state-manager tool block
- Block de type `tool` qui persiste l'etat du workflow
- Operations : `get(path)`, `set(path, value)`, `transition(phase)`, `pause()`, `resume()`, `rewind(toPhase)`, `inject(path, value)`
- Stockage : fichier JSON dans le repertoire de session
- Doit etre invocable par n'importe quel agent via CLI

### Etape 4 : Ajouter le checkpointing dans EntryPointExecutor
- Sauvegarder l'etat complet a chaque noeud execute
- Permettre la reprise apres un pause/crash
- Integrer avec le state manager pour la coordination workflow/interaction-handler

### Etape 5 : Tester chaque outil individuellement
- Executer chaque tool block via `node index.js run <tool-id> --input ...`
- Verifier les outputs
- Documenter les prerequis d'installation

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `content/system/blocks/tools/playwright-screenshot/playwright-screenshot.block.json` | CREER — Tool block screenshot |
| `content/system/blocks/tools/playwright-screenshot/screenshot.ts` | CREER — Script d'execution |
| `content/system/blocks/tools/playwright-accessibility/playwright-accessibility.block.json` | CREER — Tool block accessibilite |
| `content/system/blocks/tools/playwright-interact/playwright-interact.block.json` | CREER — Tool block interaction DOM |
| `content/system/blocks/tools/web-search/web-search.block.json` | CREER — Tool block recherche web |
| `content/system/blocks/tools/compilation-check/compilation-check.block.json` | CREER — Tool block build |
| `content/system/blocks/tools/memory-read/memory-read.block.json` | CREER — Tool block lecture memoire |
| `content/system/blocks/tools/memory-write/memory-write.block.json` | CREER — Tool block ecriture memoire |
| `content/system/blocks/tools/state-manager/state-manager.block.json` | CREER — Tool block state manager |
| `content/system/blocks/tools/state-manager/state-manager.ts` | CREER — Script d'execution du state manager |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | MODIFIER — Ajouter le checkpointing |
| `docs/phases/PHASE-34/checkpoint.md` | MODIFIER — Mettre a jour le checkpoint |

---

## Verification [OBLIGATOIRE]

```bash
# Verification 1 : Tous les tool blocks existent
powershell.exe -Command "Get-ChildItem -Path C:\Meastro\content\system\blocks\tools\ -Filter *.block.json -Recurse | Select-Object Name"
# Resultat attendu : les 9 tool blocks listes ci-dessus

# Verification 2 : Playwright screenshot fonctionne
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run playwright-screenshot --input url=https://example.com"
# Resultat attendu : chemin vers un fichier PNG

# Verification 3 : State manager CRUD fonctionne
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run state-manager --input operation=set --input path=test.value --input value=42"
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run state-manager --input operation=get --input path=test.value"
# Resultat attendu : 42

# Verification 4 : Compilation check detecte les erreurs
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js run compilation-check --input projectPath=C:\Meastro\apps\backend"
# Resultat attendu : JSON avec buildSuccess=true ou erreurs listees

# Verification 5 : Le backend compile toujours
powershell.exe -Command "cd C:\Meastro\apps\backend; dotnet build"
# Resultat attendu : Build succeeded
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS hardcoder des chemins ou des configurations specifiques a un projet dans les tool blocks — ils doivent etre generiques
- Ne PAS creer de tool blocks qui dependent d'un provider LLM specifique — Playwright, shell, filesystem sont des outils generiques
- Ne PAS modifier la logique existante de `EntryPointExecutor` pour while/for-each/conditional — ajouter le checkpointing SANS casser l'existant
- Ne PAS oublier de tester chaque tool block individuellement AVANT de passer a 34-C
- Ne PAS mettre la logique du state manager dans le backend C# — c'est un tool block (script), pas de l'infrastructure

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-B : Infrastructure
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Tool blocks crees** : X / 9
**Tests individuels** :
  - playwright-screenshot : PASS / FAIL
  - playwright-accessibility : PASS / FAIL
  - playwright-interact : PASS / FAIL
  - web-search : PASS / FAIL
  - compilation-check : PASS / FAIL
  - memory-read : PASS / FAIL
  - memory-write : PASS / FAIL
  - state-manager : PASS / FAIL
**Checkpointing EntryPointExecutor** : DONE / BLOQUE
**Backend build** : Build succeeded / FAIL
**Verification** : [copier le resultat des commandes]
**Problemes** : [si BLOQUE]
```
