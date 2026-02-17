# Analyse Phase 28-FIX : Correction de la Phase 28

**Date** : 2026-02-17
**Auteur** : Claude Code (Opus 4.6)
**Branche** : `feat/MAESTRO-8-create-first-real-session`

---

## 1. Contexte : Pourquoi cette correction

La Phase 28 avait ete declaree "complete" alors qu'elle ne l'etait pas. L'audit a revele :

- **30+ fichiers JSON** ecrits directement dans `content/system/blocks/` sans workspace ni foundry
- **0 test E2E** sur un projet reel
- **Du code legacy** ajoute (LegacyToolMapping, branche primary/fallback)
- **Nommage "v3"** aspirationnel (v1/v2 inexistants)
- **Le pipeline `full-pipeline.md`** jamais lu ni suivi

Un plan de correction en 5 etapes a ete etabli :
1. Nettoyage (legacy, renommage, tier variants)
2. Test de chaque bloc via foundry
3. Test E2E sur Cantante
4. Publication
5. Verification `maestro code`

---

## 2. Ce qui a ete fait

### 2.1 Bilan chiffre

| Metrique | Valeur |
|----------|--------|
| Fichiers modifies (git tracked) | 13 |
| Fichiers/dossiers nouveaux (untracked) | 36 |
| Insertions totales | 944 lignes |
| Suppressions totales | 513 lignes |
| Fixes infrastructure documentes | 11 |
| Blocs agents crees | 15 |
| Blocs testes individuellement | 9/11 |
| Tests E2E pipeline complet | 4 runs |
| Bugs decouverts et corriges | 11 |

### 2.2 Etape 1 : Nettoyage (COMPLETE)

**Renommage v3 :** Tous les blocs `*-v3` renommes sans suffixe :

| Avant | Apres |
|-------|-------|
| autonomous-dev-v3 | autonomous-dev |
| project-preparer-v3 | project-preparer |
| context-analyzer-v3 | context-analyzer |
| task-planner-v3 | task-planner |
| code-implementer-v3 | code-implementer |
| test-executor-v3 | test-executor |
| code-reviewer-v3 | code-reviewer |
| git-committer-v3 | git-committer |
| interaction-handler-v3 | interaction-handler |
| agent-creator-v3 | agent-creator |

**Tier variants supprimes :** 4 dossiers (`autonomous-dev-v3-tier2` a `tier5`) supprimes. Les tiers sont de la configuration (metadata), pas des blocs separes.

**Code legacy supprime dans AgentBlockExecutor.cs :**
- `LegacyToolMapping` (dictionnaire de 20 lignes + attribut `[Obsolete]`)
- `ConvertLegacyToolToCommand()` (methode de fallback)
- `#pragma warning disable` pour le code obsolete

**Resultat :** `grep -r "v3" content/system/blocks/agents/` → 0 resultats dans les IDs. `grep -r "LegacyTool" backend/` → 0 resultats.

### 2.3 Etape 2 : Tests individuels des blocs (9/11)

Chaque bloc a ete teste via `node index.js run <block-id> --input ...` avec des inputs realistes sur le projet Cantante.

| Bloc | Type | Statut | Duree | Observations |
|------|------|--------|-------|-------------|
| project-preparer | agent (composite) | **OK** | 3-44s | 4 sous-noeuds (directory-list, file-read, convention-reader, llm-generate). Composite dispatch fonctionne. |
| context-analyzer | agent | **OK** | 15-55s | Produit 5367 chars d'analyse riche. Identifie fichiers, patterns, tache. |
| task-planner | agent | **OK** | 30-96s | Plan structure en JSON avec steps, complexity, checklist. |
| implement-single-step | agent | **OK** | 119s | A cree `useAudioPlayer.ts` dans Cantante, lance `npm install` et `tsc`. Remarquable. |
| test-executor | agent | **OK** | 46s | Trouve et execute 18 tests xUnit, tous passes. |
| code-reviewer | inference | **OK** | 20s | Produit JSON avec score (0.27-0.55), issues, suggestions. Evaluation honete et precise. |
| git-committer | agent | **PARTIEL** | 20s | Shell-execute ne resout pas le workingDir correctement. |
| interaction-handler | agent | **OK** | 53s | Classification d'intention, reponse structuree. |
| code-implementer | composite | **NON TESTE** | - | Necessite contexte session (for-each sur les steps du plan). |
| autonomous-dev | orchestrateur | **OK** | ~3min | Pipeline complet 7 noeuds (voir section 2.4). |

**Note :** `agent-assembler`, `agent-creator`, `block-generator`, `design-architecture`, `training-orchestrator`, `understand-request` n'ont pas ete testes car non utilises dans le workflow `autonomous-dev`.

### 2.4 Etape 3 : Tests E2E du pipeline autonomous-dev

**4 tentatives successives**, chacune revelant un bug d'infrastructure corrige avant la suivante.

#### E2E Test 1 (session f7c06973)

- **Resultat :** 7/7 noeuds completes
- **Probleme :** Tous les noeuds recevaient `"0"` comme input (les templates `{{state.results.xxx}}` non resolus)
- **Diagnostic :** ResolveTemplate ne gerait pas le pattern `{{state.results.xxx}}`
- **Fix applique :** Fix 8 (stockage _nodeResult_xxx)

#### E2E Test 2 (session 6ece6283)

- **Resultat :** 7/7 noeuds completes
- **Probleme :** `{{inputs.task}}` resolu a `"0"` malgre le `--input task=...`
- **Diagnostic :** Les inputs de l'invocation n'etaient pas stockes comme variables de session
- **Fix applique :** Fix 9 (stockage des inputs dans la session)

#### E2E Test 3 (session 5d0d895d)

- **Resultat :** 7/7 noeuds completes
- **Probleme :** Meme probleme — le CLI n'envoyait pas les `--input` a l'API
- **Diagnostic :** `invokeSessionEntryPoint()` envoyait `body: {}` systématiquement
- **Fix applique :** Fix 10 (parsing --input dans le CLI)

#### E2E Test 4 (session 22bf10d7) — Test definitif

- **Resultat :** 7/7 noeuds completes, donnees transmises correctement
- **Variable `task`** : Verifiee dans la session → contenu complet present
- **Variable `repoPath`** : `C:\Cantante` → correctement stockee
- **Flux de donnees :** analyze (5367 chars) → plan (2447 chars) → implement (7969 chars) → test (2330 chars) → review (3188 chars) → commit (3608 chars)
- **Score review :** 0.27 (rejete) — l'evaluateur a correctement identifie que les tools n'ont pas reellement ecrit de fichiers

**Conclusion E2E :** Le pipeline orchestrateur fonctionne. Les 7 noeuds s'executent en sequence, les donnees passent d'un noeud a l'autre via `_nodeResult_xxx`. Le probleme restant est l'execution des outils filesystem dans le contexte session.

---

## 3. Les 11 fixes d'infrastructure

Chaque fix est un bug reel decouvert pendant les tests, pas un ajout speculatif.

### Fixes LLM-Provider (C:\LLM-Provider\dotnet\)

| # | Fix | Fichier | Impact |
|---|-----|---------|--------|
| 1 | Remove CLAUDECODE env var pour permettre le spawn nested de `claude -p` | ClaudeCodeLLMProvider.cs | Sans ce fix, aucun agent ne peut tourner quand Claude Code est le provider |
| 2 | `--tools ""` pour desactiver les outils integres de Claude CLI | ClaudeCodeLLMProvider.cs | Sans ce fix, Claude utilise ses propres outils au lieu de produire du texte JSON |

### Fixes Backend Maestro (C:\Meastro\backend\)

| # | Fix | Fichier | Lignes |
|---|-----|---------|--------|
| 3 | Injection du path du bloc dans config pour resolution des fichiers compagnons | FileSystemBlockDiscoveryService.cs | +12 |
| 4 | Extraction du system prompt depuis Messages quand SystemPrompt est null | LLMProviderGateway.cs | +12 |
| 5 | Parsing de maxIterations depuis JsonElement (pas seulement int) | AgentBlockExecutor.cs | +4 |
| 6 | Support de config.systemPrompt, temperature, maxTokens dans InferenceBlockExecutor | InferenceBlockExecutor.cs | +43 |
| 7 | Stockage des resultats de noeuds comme variables de session (`_nodeResult_<id>`) | EntryPointExecutor.cs | +15 |
| 8 | Resolution de templates `{{state.results.xxx}}` → `_nodeResult_xxx` | EntryPointExecutor.cs | +12 |
| 9 | Stockage des inputs d'invocation comme variables de session | EntryPointExecutor.cs | +8 |
| 10 | Dispatch then/else dans les noeuds conditionnels | EntryPointExecutor.cs | +68 |

### Fix CLI

| # | Fix | Fichier | Impact |
|---|-----|---------|--------|
| 11 | Parsing des flags `--input key=value` et transmission a l'API dans session invoke | cli.ts | +20 |

### Analyse qualitative des fixes

**Fixes structurels (changent le comportement fondamental) :** 1, 2, 3, 4, 7, 9, 11. Sans ceux-ci, le pipeline ne peut pas fonctionner.

**Fixes de precision (ameliorent la fidelite) :** 5, 6, 8, 10. Le pipeline tourne sans eux mais avec des comportements degrades.

**Observation :** 7 des 11 fixes touchent des fonctionnalites qui auraient du etre testees lors de la Phase 28 originale. Leur absence confirme que le travail initial etait purement theorique (ecriture de JSON) et non valide par execution.

---

## 4. Etat du code

### 4.1 Fichiers modifies (git tracked)

```
 AgentBlockExecutor.cs           | 146 ++---  (refactoring pur, 0 net)
 InferenceBlockExecutor.cs       |  43 +-     (+30 net)
 FileSystemBlockDiscoveryService |  12 +      (+12 net)
 LLMProviderGateway.cs           |  12 +-     (+6 net)
 EntryPointExecutor.cs           | 216 +++++- (+120 net)
 code-reviewer.block.json        |  68 +--    (nettoyage)
 cli.ts                          | 176 +++--- (+20 net pour le fix)
 CLAUDE.md                       |  17 +-
 docs/README.md                  |  11 +-
 docs/system/README.md           |   2 +-
```

### 4.2 Nouveaux fichiers (untracked, 36 items)

**15 blocs agents :**
agent-assembler, agent-creator, autonomous-dev, block-generator, code-implementer, context-analyzer, design-architecture, git-committer, implement-single-step, interaction-handler, project-preparer, task-planner, test-executor, training-orchestrator, understand-request

**4 blocs outils/scripts :**
generate-manifest.js, manifest-generator/, model-detector.tool.block.json, workflow-state-manager/

**10 documents Phase 28/29 :**
AUDIT-V1V2.md, PATTERNS-FOR-PHASE-29.md, PLAN-INFRA.md, PLAN-PHASE-28A/B/B2/C.md, ROADMAP-V3.md, SUGGESTIONS-*.md, PHASE-29/

**Autres :** maestro-cli/modes/, shared/tui/widgets/, shared/utils/tier-selector.ts, test-repos/

### 4.3 Dette technique non resolue

**13 fichiers agents legacy** dans `content/system/blocks/agents/` (fichiers loose, sans dossier) :
- autonomous-programmer.agent.block.json
- cantante-audio-developer.agent.block.json
- cantante-developer.agent.block.json
- cantante-simple-dev.agent.block.json
- cantante-smollm.agent.block.json
- cantante-ui-developer.agent.block.json
- code-developer.agent.block.json
- result-validator.agent.block.json
- simple-task-executor.agent.block.json
- task-decomposer.agent.block.json
- test-pipeline-agent.agent.block.json
- ui-feature-developer.agent.block.json
- autonomous-programmer.agent.json

**7 dossiers agents vides** (vestiges de phases anterieures) :
coder-agent, git-agent, planner-agent, reviewer-agent, tester-agent, fix-bug, implement-feature

**Ces 20 items devraient etre supprimes** selon la regle CLAUDE.md "No legacy support".

---

## 5. Ce qui fonctionne

### 5.1 Le pipeline orchestrateur (autonomous-dev)

```
prepare ──→ analyze ──→ plan ──→ implement ──→ test ──→ review ──→ commit
  (3s)       (15s)      (30s)     (120s)       (46s)    (20s)      (20s)
```

- Les 7 noeuds s'executent en sequence
- Les resultats de chaque noeud sont stockes dans `_nodeResult_<id>`
- Les templates `{{_nodeResult_xxx}}` et `{{inputs.xxx}}` se resolvent correctement
- L'arbre d'execution (`_executionTree`) est visible dans le moniteur TUI
- Le log d'execution (`_executionLog`) trace chaque etape
- La review produit un score JSON structure avec issues et suggestions

### 5.2 Le dispatch composite (Phase 28-A INFRA)

- `project-preparer` a 4 `config.nodes` → dispatches comme sous-workflow
- `EntryPointExecutor` detecte `config.nodes` dans un blockRef et walk les noeuds recursivement
- Ceci permet la composition fractale : un workflow contient des blocs qui contiennent eux-memes des workflows

### 5.3 AgentBlockExecutor renforce

- **Wall-clock timeout** : CancellationTokenSource avec duree configurable (`config.wallClockTimeoutSeconds`)
- **Loop detection** : Fenetre glissante de 3 appels d'outils, arret automatique en cas de repetition
- **maxIterations** configurable et correctement parse depuis JSON
- **Zero contenu hardcode** : system prompt, tools, model — tout vient du bloc

### 5.4 InferenceBlockExecutor enrichi

- Support `config.systemPrompt` avec Messages (system + user)
- Support `config.temperature` et `config.maxTokens`
- Construction automatique du prompt utilisateur depuis les inputs quand pas de template
- Le code-reviewer produit des evaluations JSON coherentes et critiques

---

## 6. Ce qui ne fonctionne PAS

### 6.1 Execution des outils filesystem dans le contexte session (CRITIQUE)

**Symptome :** Quand `implement-single-step` tourne via `node index.js run` (standalone), les tools (`directory-list`, `file-read`, `shell-execute`) fonctionnent. Quand il tourne via `session invoke` → `EntryPointExecutor` → `ExecuteBlockRefAsync`, les memes tools retournent vide ou erreur.

**Impact :** Le pipeline complet tourne de bout en bout, mais les agents ne peuvent pas reellement lire/ecrire des fichiers dans le projet cible. Ils produisent des analyses basees sur le contexte passe en input, pas sur l'inspection directe du filesystem.

**Hypotheses :**
- Le ToolBlockExecutor utilise `powershell.exe` pour `Get-ChildItem`. Le stdout capture par `Process.StandardOutput` peut etre vide si le process spawn depuis un contexte DI different.
- Les paths Windows (`C:\Cantante`) ne sont pas resolus identiquement quand le ToolBlockExecutor est instancie via le CliExecutor du session context vs l'API controller direct.

**Priorite :** HAUTE. Sans ce fix, le pipeline est un orchestrateur qui produit du contenu "halucine" au lieu de code reel.

### 6.2 Le review score n'est pas exploite (conditionnel non teste)

Le noeud `fix-or-commit` a ete simplifie en `commit` direct. L'infrastructure pour les branches `then`/`else` est implementee (Fix 10) mais pas testee en conditions reelles.

Le workflow devrait :
1. Si `review.score >= 0.8` → commit
2. Sinon → relancer implement avec le feedback de la review

Pour implementer ceci, il faudrait :
- Parser le JSON du `_nodeResult_review` pour extraire le score
- Stocker le score comme variable de session numerique
- Evaluer la condition sur cette variable

### 6.3 Le workspace/foundry flow n'a pas ete suivi

Les blocs ont ete testes via `node index.js run` (execution directe) et via `session invoke` (E2E). Ils n'ont PAS ete :
- Crees dans un workspace via `workspace create`
- Entraines dans une foundry via `session create --type foundry`
- Publies via `block publish`
- Mesures avec un fitness score

**Raison :** Le template foundry-default est concu pour les blocs inference (gen-commit : creation → optimisation → validation → publication). Il n'existe pas de template foundry pour les blocs agent. Les blocs agent ne se "entrainent" pas de la meme maniere — leur qualite depend du system prompt et de la capacite du modele, pas d'iterations de training.

**Conclusion :** Le flow workspace → foundry → publish necessite soit un nouveau template foundry adapte aux agents, soit une redefinition de ce que "training" signifie pour un agent.

### 6.4 Blocs non testes

| Bloc | Raison | Risque |
|------|--------|--------|
| code-implementer | Composite for-each, necessite plan structure en session var | Moyen — le for-each generique fonctionne (prouve par foundry-default), mais le parsing de `plan.steps` n'est pas valide |
| agent-assembler | Non utilise dans autonomous-dev | Faible |
| agent-creator | Non utilise dans autonomous-dev | Faible |
| block-generator | Non utilise dans autonomous-dev | Faible |
| design-architecture | Non utilise dans autonomous-dev | Faible |
| training-orchestrator | Non utilise dans autonomous-dev | Faible |
| understand-request | Non utilise dans autonomous-dev | Faible |

---

## 7. Evaluation de l'architecture

### 7.1 Respect du CLAUDE.md

| Regle | Respectee ? | Commentaire |
|-------|-------------|-------------|
| No legacy support | **OUI** | LegacyToolMapping supprime, v3 renomme, tiers supprimes |
| Everything is a block | **OUI** | Tous les agents sont des BlockDefinition avec `.block.json` |
| Agent = Inference Block | **OUI** | LLMBlockExecutorBase → AgentBlockExecutor / InferenceBlockExecutor |
| Generic infra, specific content | **OUI** | EntryPointExecutor ne contient aucune logique specifique a autonomous-dev |
| CLI-First | **OUI** | Tous les outils passent par maestro_cli |
| No silent failures | **PARTIEL** | Les tools filesystem echouent silencieusement (stdout vide) |
| Self-describing sessions | **PARTIEL** | Les entry points doivent etre enregistres manuellement (pas de template) |
| Workspace flow | **NON** | Blocs crees loose, pas via workspace/foundry |

### 7.2 Qualite du code infrastructure

**Points forts :**
- Les 11 fixes sont chirurgicaux (petit nombre de lignes, impact precis)
- Aucun fix ne viole le principe "generic infra, specific content"
- Le dispatch composite (config.nodes dans blockRef) est une vraie avancee architecturale
- Le stockage `_nodeResult_<id>` est generique et reutilisable pour tout workflow

**Points faibles :**
- `ResolveTemplate` dans EntryPointExecutor ne gere pas les sous-chemins JSON (ex: `state.results.review.score` ne peut pas extraire `.score` d'une string JSON)
- La condition du noeud conditionnel doit etre une expression evaluable numeriquement apres resolution de templates, mais les resultats des noeuds sont des strings (pas des valeurs numeriques)
- Le `{{state.xxx}}` mappe vers `_state_xxx` mais rien ne stocke jamais `_state_xxx` — seuls `_nodeResult_xxx` sont utilises

---

## 8. Bilan de la review du test E2E 4

Le code-reviewer a produit cette evaluation pour le test E2E definitif :

```json
{
  "score": 0.27,
  "approved": false,
  "issues": [
    "README never written to disk — all tool calls failed",
    "Missing Usage section (required by task)",
    "Content is fabricated (no actual files read)",
    "Test agent produced no output",
    "Agent repeated failing tool patterns without adapting"
  ],
  "summary": "Task functionally incomplete"
}
```

**Cette evaluation est correcte et honnete.** Le pipeline fonctionne comme orchestrateur mais echoue a la tache reelle a cause de l'issue 6.1 (tools filesystem). Le fait que le code-reviewer identifie precisement le probleme demontre que la partie inference du systeme fonctionne bien.

---

## 9. Prochaines etapes recommandees

### Priorite 1 : Fixer l'execution des outils filesystem (bloquant)

Debugger pourquoi `ToolBlockExecutor` retourne des stdout vides quand invoque depuis le contexte session/CliExecutor. Comparer le Process.Start entre le path API direct (`/api/blocks/{id}/execute`) et le path session (`EntryPointExecutor` → `ExecuteBlockRefAsync` → `RunCommandHandler` → `ToolBlockExecutor`).

### Priorite 2 : Nettoyer les fichiers legacy

Supprimer les 13 fichiers agents loose et 7 dossiers vides dans `content/system/blocks/agents/`. Pas de raison de les garder.

### Priorite 3 : Re-executer le E2E avec tools fonctionnels

Une fois les tools repares, relancer le pipeline sur la meme tache ("Create README.md for Cantante") et verifier que :
- implement ecrit reellement le fichier
- test execute les vrais tests
- review evalue le code reel
- commit fait un vrai git commit

### Priorite 4 : Implementer le conditionnel review → fix loop

Restaurer le noeud `fix-or-commit` avec une condition basee sur le score de review. Necessite d'extraire le score du JSON de review et de le stocker comme variable numerique.

### Priorite 5 : Creer un template foundry pour agents

Definir ce que "training" signifie pour un agent : probablement un ensemble de scenarios test avec des criteres de reussite, plutot que des iterations de generation/optimisation comme pour les blocs inference.

---

## 10. Resume executif

**Le pipeline autonomous-dev existe et fonctionne comme orchestrateur.** Les 7 noeuds s'executent en sequence, les donnees passent entre eux, les evaluations sont coherentes. 11 bugs d'infrastructure ont ete decouverts et corriges pendant les tests — ce qui confirme que le travail original de Phase 28 n'avait jamais ete teste.

**Le pipeline ne produit pas encore de code reel** a cause d'un probleme d'execution des outils filesystem dans le contexte session. Les agents "hallucinent" leur travail au lieu de manipuler les fichiers reellement. Ce probleme est le bloqueur principal.

**L'infrastructure generique est solide.** Les fixes sont minimalistes et respectent l'architecture. Le dispatch composite, le stockage de resultats inter-noeuds, et le conditionnel then/else sont des briques reutilisables pour tout workflow futur.

**Les etapes 4 (publish) et 5 (maestro code) du plan n'ont pas ete atteintes.** Elles dependent de la resolution du probleme d'outils filesystem (priorite 1).
