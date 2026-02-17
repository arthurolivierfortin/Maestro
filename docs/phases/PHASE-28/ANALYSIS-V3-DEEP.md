# Analyse profonde V3 : Vision, realite, erreurs, suggestions

**Date** : 2026-02-17
**Auteur** : Claude Code (Opus 4.6)
**Documents sources** :
- `PHASE-19/ROADMAP-V1-TO-V4.md` — Vision originale
- `PHASE-26/request.md` — Requete utilisateur V3
- `PHASE-28/review.md` — Correction de trajectoire
- `PHASE-28/ROADMAP-V3.md` — Plan V3 corrige
- `PHASE-28/ANALYSIS-PHASE-28-FIX.md` — Analyse du correctif

---

## 1. Ce qui etait VRAIMENT voulu

### 1.1 Vision originale (ROADMAP-V1-TO-V4)

La V3 etait definie comme **"Valeur utilisateur"** :

> "Un nouvel utilisateur a de la valeur des le jour 1. Des workflows prets a l'emploi, des ajustements de fonctionnalites, et une experience guidee."

Concretement :
- 6 workflows out-of-the-box (Code Review, README, Tests, Refactor, Docs, Commit Message v2)
- Chaque workflow = **template JSON + block JSON uniquement**, zero changement C#
- Quick actions, onboarding, sample repos
- Phase 28 = stabilisation (test chaque workflow, qualite des outputs, docs)

**Ce que ca impliquait :** des blocs simples, un par tache, testes sur differents repos et modeles. Pas d'agent autonome. Pas de tiers. Pas de `maestro code`.

### 1.2 Requete utilisateur (request.md)

L'utilisateur a **redifini la V3** :

> "Le but est d'a la fin avoir un agent aussi capable que opus 4.5 meme plus. En commencant par les blocs atomiques en grossissant jusqu'a avoir un agent autonome."

Points cles :
1. **Bottom-up** : commencer par des tools (commit, PR, etc.), monter progressivement vers un agent
2. **L'assistant est le coach** : il configure les sessions, cree les blocs, supervise l'entrainement
3. **Test sur Cantante** : le projet reel, mais seulement via le CLI Maestro — jamais de code direct
4. **L'agent doit etre generique** : pas specifique a Cantante, utilisable sur n'importe quel projet
5. **Separation des responsabilites** : specialiser les taches, avoir des validations
6. **Workspaces et sessions obligatoires** : suivre le flow Maestro

### 1.3 Correction de trajectoire (review.md)

L'utilisateur a corrige la direction apres un premier plan errone :

> "Le but est de creer des workflows completement autonomes a la hauteur et meilleur que Claude Code."

Points critiques ajoutes :
1. **Tiers d'optimisation** : partir du workflow ideal (Claude partout) → optimiser vers des modeles locaux
2. **`maestro code`** : mode interactif TUI, comme Claude Code mais avec des widgets
3. **L'utilisateur arrive avec ses providers** → le systeme propose le meilleur workflow possible
4. **Philosophie Maestro respectee** : specialisation > generalite, infrastructure generique, contenu specifique
5. **Agent Creator** : automatiser la creation d'agents (plus tard)

### 1.4 Plan final (ROADMAP-V3.md)

Le plan structure final :
- **28-INFRA** : BlockRef dispatch, timeout, loop detection, model-detector
- **28-A** : Agent "ideal" (Claude partout), 7 sous-blocs, test sur Cantante
- **28-B** : `maestro code` + widgets + `maestro check`
- **28-B2** : Agent Creator (agent qui cree des agents)
- **28-C** : Tiers 1→5 + manifeste de publication
- **29-A/B** : `maestro adapt` + `maestro optimize`

**Gate critique de 28-A** : 9 tests Cantante passes. State manager + rewind + interjections fonctionnent.

---

## 2. Ce qui a ete fait

### 2.1 Chronologie reelle

| Quand | Quoi | Resultat |
|-------|------|----------|
| Phase 28 originale | Ecriture de 30+ fichiers JSON directement dans content/system/blocks/ | 0 test, 0 fitness, 0 workspace. Declare "complet". |
| Phase 28-FIX, etape 1 | Nettoyage : supprimer legacy, renommer v3→sans suffixe, supprimer tiers | Fait correctement |
| Phase 28-FIX, etape 2 | Test individuel de chaque bloc | 9/11 testes via `run` (hors session) |
| Phase 28-FIX, etape 3 | E2E pipeline autonomous-dev | 4 tentatives, 11 bugs infrastructure corriges |
| Phase 28-FIX, etapes 4-5 | Publish + maestro code | Jamais atteintes |

### 2.2 Ce qui FONCTIONNE (reellement, verifie)

**Infrastructure C# (les 11 fixes) :**
- BlockRef dispatch composite (workflow peut contenir des blocs avec config.nodes)
- Wall-clock timeout + loop detection sur AgentBlockExecutor
- InferenceBlockExecutor enrichi (systemPrompt, temperature, maxTokens)
- Stockage inter-noeuds via `_nodeResult_<id>`
- Resolution de templates `{{inputs.xxx}}` et `{{_nodeResult_xxx}}`
- Conditional then/else dispatch
- CLI `--input key=value` parsing

**Pipeline orchestrateur :**
- 7 noeuds s'executent en sequence
- Les donnees passent correctement d'un noeud a l'autre
- Le code-reviewer produit des evaluations honnetes et structurees

### 2.3 Ce qui ne fonctionne PAS

1. **Tools filesystem vides en contexte session** — les agents ne peuvent pas lire/ecrire des fichiers reels quand invoques via `session invoke`. Bloqueur critique.
2. **Aucun workflow foundry/workspace utilise** — tous les blocs sont "loose"
3. **Aucun fitness mesure** — pas de score objectif sur aucun bloc
4. **Aucun publish** — aucun bloc n'est publie
5. **`maestro code` non teste** — le mode interactif n'a jamais ete lance
6. **0/9 tests Cantante passes** (gate 28-A non atteinte)
7. **0 tier d'optimisation** (gate 28-C non atteinte)
8. **Pas de manifeste** sur aucun workflow

---

## 3. Nos erreurs

### 3.1 Erreur fondamentale : confondre ecriture de JSON et developpement de blocs

La Phase 28 originale a ecrit 30+ fichiers `.block.json` et les a declares "termines". C'est comme ecrire un `README.md` qui decrit un logiciel et dire que le logiciel est pret.

**Un bloc est TERMINE quand** : il a ete cree dans un workspace, entraine dans une foundry, mesure avec un fitness, et publie. Pas avant.

### 3.2 Erreur structurelle : ne pas suivre le pipeline Maestro

Le pipeline `workspace → foundry → publish → project` existe pour une raison : il force la tracabilite et la mesure. En sautant ce pipeline, on a perdu :
- La tracabilite (quel workspace, quelle session, quels resultats)
- La mesure (quel fitness, quel modele, quelle qualite)
- La reproductibilite (un autre developpeur ne peut pas reprendre le travail)

### 3.3 Erreur conceptuelle : traiter les agents differemment des blocs inference

Le template foundry-default a ete concu pour les blocs inference (gen-commit). Quand est venu le moment de tester les agents, on a dit "il n'y a pas de template pour les agents" et on a saute l'etape.

**Mais la philosophie Maestro dit : un agent EST un bloc inference.** Les agents sont des boites noires. L'interface est identique : prompt → reponse. Si le template foundry fonctionne pour les blocs inference, il devrait fonctionner pour les agents. Un agent qui recoit un prompt et produit une reponse peut etre evalue exactement comme un bloc inference.

Le fait qu'on ait eu besoin d'un "template different pour les agents" est un signal que notre comprehension de la philosophie etait incorrecte. On traitait les agents comme des entites speciales alors qu'ils sont des blocs comme les autres.

### 3.4 Erreur de test : tester avec de vraies modifications de fichiers

Les tests E2E (4 tentatives) ont tente de faire ecrire de vrais fichiers par les agents dans le projet Cantante. Quand les tools filesystem ne fonctionnaient pas, on a declare le test "echoue a cause d'un bug d'infrastructure".

**La bonne approche :**
- **Tests unitaires** : mocker les blocs. L'agent ne sait pas qu'il n'execute pas un vrai bloc. On valide que l'orchestration, le passage de donnees, et la logique conditionnelle fonctionnent.
- **Tests d'integration** : sandboxes avec des images (containers Docker). Environnement isole, execution reelle, pas de risque pour le projet.

On n'a fait ni l'un ni l'autre. On a teste "en vrai" sur un vrai projet, ce qui est la pire approche : risque sur le projet + difficulte de debug + pas reproductible.

### 3.5 Erreur de scope : vouloir tout faire d'un coup

Le plan Phase 28-FIX avait 5 etapes. On en a atteint 3 (nettoyage, tests individuels, E2E). Les etapes 4 (publish) et 5 (maestro code) n'ont jamais ete touchees. On a passe tout le temps a corriger des bugs d'infrastructure qui auraient du etre detectes bien plus tot.

### 3.6 Erreur de nommage : versions aspirationnelles

Nommer tout "v3" quand v1 et v2 n'existent pas est trompeur. Ca donne l'impression de maturite alors qu'il n'y en a pas. Corrige lors du nettoyage, mais l'erreur a ete commise.

### 3.7 Erreur de priorite : infrastructure avant contenu

On a passe la majorite du temps sur des fixes d'infrastructure (11 bugs) au lieu de creer de la valeur utilisateur. Les fixes etaient necessaires, mais ils auraient du etre decouverts et corriges PENDANT le developpement normal, pas comme un chantier de correction.

---

## 4. Analyse : ou en sommes-nous par rapport au plan ?

### 4.1 Grille de completion

| Phase | Statut | Completion | Bloqueur |
|-------|--------|------------|----------|
| 28-INFRA | **Partiel** | 70% | BlockRef dispatch ✅, timeout ✅, loop detection ✅, model-detector ✅, E2E Claude ✅. Mais tools filesystem KO. |
| 28-A | **Non commence** | 10% | Les 7 sous-blocs existent comme JSON mais n'ont jamais passe la gate (0/9 tests Cantante). Pas de State Manager reel, pas de rewind, pas d'interjections. |
| 28-B | **Non commence** | 5% | Les fichiers widgets existent dans shared/tui/widgets/ mais n'ont jamais ete lances. `maestro code` jamais execute. |
| 28-B2 | **Non commence** | 0% | Agent Creator = concept seulement |
| 28-C | **Non commence** | 0% | Zero tier, zero manifeste |
| 29-A | **Non commence** | 0% | `maestro adapt` n'existe pas |
| 29-B | **Non commence** | 0% | `maestro optimize` n'existe pas |

### 4.2 Ce qui est reel vs ce qui est du scaffolding

**Reel (code compile, execute, verifie) :**
- 11 fixes infrastructure dans le backend C# et le CLI
- Le pipeline orchestrateur 7 noeuds s'execute de bout en bout
- Le dispatch composite fonctionne (blocs avec config.nodes)
- L'InferenceBlockExecutor supporte systemPrompt/temperature/maxTokens
- Le code-reviewer produit des evaluations JSON structurees

**Scaffolding (fichiers ecrits, jamais valides par execution) :**
- 15 fichiers .block.json pour les agents
- 13 fichiers widgets dans shared/tui/widgets/
- CodeApp.ts + modes/code/index.ts
- `maestro check` et `maestro tiers` dans le CLI
- 6 blocs pour l'Agent Creator (understand-request, design-architecture, etc.)
- generate-manifest.js, model-detector, workflow-state-manager

---

## 5. Suggestions concretes

### 5.1 Philosophie : respecter "Agent = Inference Block"

**Probleme** : On traite les agents comme des entites differentes qui ont besoin de templates differents, de tests differents, de workflows de creation differents.

**Solution** : Un agent est une boite noire. Il recoit un prompt, il produit une reponse. La qualite de la reponse est mesurable comme pour n'importe quel bloc inference. Le template foundry-default devrait fonctionner pour les agents.

**Concretement :**
- Le template foundry-default a des phases : creation → optimisation → validation → publication
- Pour un agent, "creation" = ecrire le system prompt. "Optimisation" = ameliorer le system prompt. "Validation" = verifier la qualite sur des cas de test. "Publication" = publier.
- Le seul ajustement possible : les criteres d'evaluation. Un bloc inference gen-commit est evalue sur la qualite du message de commit. Un agent est evalue sur la qualite de sa reponse a un scenario de test.

**Action** : Revoir le template foundry-default. S'il est trop specifique a un type de bloc, le generaliser. Si un template plus specialise est necessaire pour les agents, le creer comme extension du template existant, pas comme remplacement.

### 5.2 Testing : mocker les blocs, pas les fichiers

**Probleme** : On a tente de tester les agents en les faisant modifier de vrais fichiers. Quand ca n'a pas marche, on a bloque.

**Solution en deux niveaux :**

#### Tests unitaires : mock les blocs

L'orchestrateur (`autonomous-dev`) execute 7 blocs en sequence. Pour tester l'orchestration :
- Chaque sous-bloc est remplace par un mock qui retourne une reponse predeterminee
- On verifie que les donnees passent correctement entre les noeuds
- On verifie que les conditions fonctionnent (review score < 0.8 → fix → re-review)
- L'agent ne sait pas qu'il n'execute pas un vrai bloc

**Comment implementer :** Le systeme de blocs utilise `IBlockDiscoveryService` pour trouver les blocs. Un mock service retourne des blocs qui produisent des reponses fixes. L'`EntryPointExecutor` n'a pas besoin de savoir la difference — c'est le principe de la boite noire.

Concretement, on pourrait ajouter un mode `--mock` ou une config `mockResponses` dans la session qui fait que chaque blockRef retourne une reponse pre-enregistree au lieu d'invoquer le vrai executeur. Cela ne necessite pas de changement dans l'executeur — juste un intercepteur dans le dispatch.

#### Tests d'integration : sandboxes

Pour tester que les agents modifient reellement des fichiers :
- Creer un environnement isole (dossier temporaire, copie du repo)
- L'agent travaille dans ce sandbox
- Apres execution, verifier l'etat du sandbox (fichiers crees, contenu correct)
- Comparer avec un resultat attendu

**Comment implementer :** Le `RepositoryPath` de la session pointe vers le sandbox au lieu du vrai repo. Pas besoin de Docker dans un premier temps — un simple dossier temporaire suffit. Apres execution, un validateur compare l'etat du sandbox avec des assertions.

### 5.3 Template foundry : generaliser pour tous les types de blocs

**Etat actuel** : Le template `foundry-default` est concu pour `gen-commit` — un bloc inference simple.

**Probleme** : Le template a 4 phases (creation, optimisation, validation, publication) avec des criteres specifiques a l'inference : `hasRequiredFields`, `qualityCriteria` bases sur le JSON de sortie. Un agent qui produit une action complexe (modifier des fichiers, executer des commandes) ne peut pas etre evalue de la meme maniere.

**Suggestion** : Deux approches possibles :

**Option A — Generaliser foundry-default** :
- Remplacer les criteres specifiques par des criteres configurables via les variables de session
- `_workflowConfig.creation.evaluationCriteria` : defini par l'utilisateur lors du setup, pas dans le template
- Le template reste le meme pour tous les types de blocs, seules les variables changent

**Option B — Template "foundry-agent"** :
- Un template specialise pour les agents avec des phases adaptees :
  1. **Configuration** : system prompt + model + parametres
  2. **Scenario testing** : executer l'agent sur N scenarios pre-definis (dans le sandbox)
  3. **Evaluation** : mesurer la qualite sur chaque scenario (fitness composite)
  4. **Optimisation** : ajuster le system prompt en fonction des resultats
  5. **Publication** : publier quand le fitness seuil est atteint

**Recommandation** : Option A d'abord. Si ca ne suffit pas, creer un template specialise. L'important est de ne pas creer de la dette de templates inutile. La philosophie Maestro dit "genericite" — commencer par le generique.

### 5.4 Reprendre la V3 avec la bonne approche

L'erreur de la Phase 28 etait de commencer par le haut (ecrire le JSON de l'agent composite) au lieu de commencer par le bas (creer des blocs atomiques qui fonctionnent).

**Approche recommandee :**

#### Etape 1 : Faire fonctionner UN seul bloc simple via le pipeline complet

Choisir le bloc le plus simple (par exemple `git-committer` : lire un diff, produire un message de commit). Le faire passer par le pipeline COMPLET :

1. `workspace create`
2. `session create --type foundry`
3. Importer le template foundry
4. Lancer l'entrainement
5. Mesurer le fitness
6. Iterer jusqu'a satisfaction
7. Publier

Si ce pipeline ne fonctionne pas pour un agent (git-committer est un agent), corriger le template ou l'infrastructure. Ne pas avancer tant que ce chemin n'est pas fonctionnel.

#### Etape 2 : Bottom-up, un bloc a la fois

Une fois le pipeline valide sur un bloc simple, l'utiliser pour chaque sous-bloc de autonomous-dev, dans l'ordre de dependance :
1. project-preparer (le plus simple — lit le repo, resume)
2. context-analyzer (analyse, produit du contexte)
3. task-planner (planification)
4. implement-single-step (execution — le plus complexe)
5. test-executor
6. code-reviewer (inference, pas agent)
7. git-committer

Chaque bloc est teste, mesure, et publie AVANT de passer au suivant.

#### Etape 3 : Composer l'orchestrateur

Une fois tous les sous-blocs publies avec un fitness connu, assembler `autonomous-dev` comme workflow composite. Le tester avec des mocks d'abord (verifier l'orchestration), puis en integration (verifier le resultat reel).

#### Etape 4 : Optimiser en tiers

Avec le Tier 1 (Claude partout) fonctionnel et mesure :
1. Identifier les blocs ou un modele plus petit suffit (ex: git-committer avec Qwen2.5)
2. Re-entrainer ce bloc avec le modele plus petit
3. Mesurer le fitness du bloc re-entraine
4. Si le fitness est acceptable, creer une variante de config (pas un nouveau bloc)
5. Assembler le Tier 2 (mix Claude + local)
6. Tester le Tier 2 complet, mesurer
7. Iterer vers les tiers 3, 4, 5

#### Etape 5 : `maestro code`

SEULEMENT une fois que le Tier 1 fonctionne, construire le mode interactif TUI. Le mode `maestro code` est un frontend pour l'agent — pas un pre-requis.

### 5.5 Le mock system : ce qu'il faudrait creer

Pour les tests unitaires de workflows composites, il faudrait :

1. **Mock Block Registry** : un service qui retourne des reponses predefinies pour chaque blockRef
2. **Scenario files** : des fichiers JSON avec les reponses attendues pour chaque bloc dans un scenario de test
3. **Assertions** : apres execution du workflow avec les mocks, verifier que :
   - Tous les noeuds ont ete visites dans le bon ordre
   - Les bonnes donnees ont ete passees entre les noeuds
   - Les conditions ont ete evaluees correctement
   - Le resultat final est conforme

**Implementation minimale :**
- Un flag `--mock` sur `session invoke` qui active un mode ou `ExecuteBlockRefAsync` retourne les valeurs depuis un fichier `_mockResponses` en variable de session
- Le fichier `_mockResponses` mappe `nodeId → response`
- Zero changement dans les executeurs — le mock se fait AU NIVEAU DU DISPATCH, pas dans chaque executeur

C'est exactement le principe "boite noire" : l'orchestrateur ne sait pas si le bloc execute est reel ou mock. Il recoit une reponse et continue.

### 5.6 Le sandbox system : ce qu'il faudrait creer

Pour les tests d'integration :

1. **Sandbox factory** : copie un repo (ou cree un repo minimal) dans un dossier temporaire
2. **Session binding** : la session est liee au sandbox, pas au vrai repo
3. **Post-execution assertions** : un validateur verifie l'etat du sandbox apres execution
4. **Cleanup** : le sandbox est supprime apres le test

**Implementation minimale :**
- `maestro test create-sandbox --source <repo> --name <name>` : copie le repo dans `content/user/sandboxes/<name>/`
- La session est creee avec `--repo <sandbox-path>` au lieu du vrai repo
- Apres execution, `maestro test verify-sandbox <name> --expect <assertions-file>` compare l'etat

---

## 6. Resume : ce qu'il faut faire maintenant

### Priorite absolue : valider le pipeline foundry pour un agent

Prendre `git-committer`. Le passer par `workspace → foundry → train → measure → publish`. Si le template foundry-default ne fonctionne pas pour un agent, le corriger. Si les tools filesystem ne marchent pas dans le contexte session, les debugger et les corriger.

**Tout le reste attend.** Aucun progres reel n'est possible tant que le pipeline de base ne fonctionne pas pour un agent simple.

### Ensuite : bottom-up, un bloc a la fois

Chaque bloc passe par le pipeline. Mesure. Publie. Puis on compose.

### En parallele : implementer le mock system

Pour les tests du workflow composite, on n'a pas besoin d'attendre que tous les blocs soient prets. Un mock system permet de valider l'orchestration independamment des blocs.

### Ne PAS faire maintenant

- Ne pas toucher a `maestro code` — c'est un frontend, pas un pre-requis
- Ne pas toucher aux tiers — on n'a meme pas le Tier 1
- Ne pas toucher a l'Agent Creator — il faut d'abord savoir creer un agent manuellement
- Ne pas ecrire plus de fichiers .block.json — les 15 existants sont deja en avance sur l'execution

---

## 7. Lecons apprises

1. **Ecrire des fichiers JSON n'est pas developper.** Un bloc n'existe que quand il a ete teste et mesure.
2. **Suivre le pipeline.** Le pipeline existe pour une raison. Le contourner cree de la dette invisible.
3. **Agents = blocs.** Pas de traitement special. Meme interface, meme template, meme evaluation.
4. **Tester sans execution reelle.** Les mocks pour les tests unitaires, les sandboxes pour l'integration. Jamais de tests destructifs sur un vrai projet.
5. **Bottom-up, pas top-down.** Un agent composite ne peut pas etre teste si ses composants ne fonctionnent pas individuellement.
6. **Un bug d'infrastructure decouvre pendant un test = un test utile.** Les 11 bugs corriges sont la vraie valeur de cette session de correction.
7. **Declarer "complet" sans verifier = la pire erreur.** Mieux vaut dire "50% fait, voici ce qui manque" que "100% fait" alors que c'est faux.
