# Comparaison Maestro v4 vs Claude CLI — Phase 34-E

**Date** : 2026-02-20
**Auteur** : Claude Code (analyse automatisee)
**Contexte** : 5 taches identiques executees par Claude CLI natif sur les repos `-claude`. Maestro v4 teste sur le repo `crud` (3 runs E2E + tests isoles).

---

## Resume executif

| Critere | Maestro v4 | Claude CLI |
|---------|-----------|------------|
| **Taches completees** | 0 / 1 tentee | 5 / 5 |
| **Fichiers crees** | 0 (seul package.json modifie) | 57 fichiers sur 5 repos |
| **Code fonctionnel** | Non | 3 sur 5 repos fonctionnels |
| **Cout total** | ~$30+ (3 runs E2E) | ~$2-5 estime (5 taches) |
| **Temps total** | ~2h (3 runs + debug) | ~10-15 min (5 taches) |
| **Planning** | Excellent (10 steps detailles) | Implicite (pas visible) |
| **Qualite du plan** | 9/10 | N/A |
| **Qualite de l'execution** | 1/10 | 7/10 (moyenne) |

**Verdict** : Claude CLI est largement superieur en execution. Maestro v4 a un planning excellent mais son execution est non-fonctionnelle en l'etat actuel.

---

## Evaluation par repo

### 1. CRUD — Gestion utilisateurs

| Dimension | Maestro v4 (sur `crud`) | Claude CLI (sur `crud-claude`) |
|-----------|------------------------|-------------------------------|
| **Tache** | "Build auth system for CRUD app" | "Add user management module with CRUD operations" |
| **Fichiers crees** | 0 fichiers TS | 7 fichiers (types, api, 3 composants, App, server) |
| **Lignes ajoutees** | +150 (package-lock seulement) | +411 |
| **Fonctionnel** | Non | Oui |
| **Score** | 1/10 | 8.5/10 |

**Analyse Maestro** :
- Plan genere : 10 steps detailles couvrant types, deps, config, utils (password, token), repository, service, middleware, controller, route mounting
- Execution : Item 1 (auth.types.ts) a echoue — agent ne peut pas ecrire de fichiers via le systeme de tools. Item 2 (npm install) a partiellement fonctionne. Items 3-10 SKIPPED (checkpoint bug).
- Le plan etait plus ambitieux que la tache Claude CLI (auth complet vs CRUD simple) — mais 0% livre.

**Analyse Claude CLI** :
- CRUD complet fonctionnel : Create, Read, Update, Delete
- Architecture propre : types, api client, 3 composants specialises
- Backend Express avec in-memory store
- Aucun bug bloquant
- Manque : pas de tests, in-memory seulement

---

### 2. Auth — Authentification JWT

| Dimension | Maestro v4 | Claude CLI (sur `auth-claude`) |
|-----------|-----------|-------------------------------|
| **Tache** | Non teste | "Implement JWT auth flow" |
| **Fichiers crees** | — | 10 fichiers |
| **Lignes ajoutees** | — | +1085 |
| **Fonctionnel** | — | Partiellement |
| **Score** | — | 7/10 |

**Analyse Claude CLI** :
- Flow auth complet : login, register, protected routes, dashboard
- Context/Provider pattern pour state management
- **Bugs** :
  - Types dupliques : `src/types.ts` ET `src/types/auth.ts`
  - Deux clients API redondants : `src/api.ts` ET `src/api/auth.ts`
  - Dead code et imports inutilises
  - Session restore potentiellement cassee
- Bon travail UI : formulaires avec validation, routing

---

### 3. Dashboard — Visualisation de donnees

| Dimension | Maestro v4 | Claude CLI (sur `dashboard-claude`) |
|-----------|-----------|--------------------------------------|
| **Tache** | Non teste | "Implement data visualization dashboard" |
| **Fichiers crees** | — | 11 fichiers |
| **Lignes ajoutees** | — | +840 |
| **Fonctionnel** | — | **NON** |
| **Score** | — | 6/10 |

**Analyse Claude CLI** :
- Architecture bien pensee : KPI cards, charts (sales, categories), orders table, period filter
- Design system coherent avec Tailwind
- **Bug critique** : Mismatch API endpoints
  - Frontend appelle `/api/dashboard/stats`, `/api/dashboard/sales`, `/api/dashboard/categories`
  - Backend expose `/api/stats`, `/api/orders`, `/api/categories` (pas de prefix `/dashboard/`)
  - **Toutes les requetes frontend retournent 404**
  - Le dashboard est completement casse malgre un code de qualite
- Fix necessaire : 1 ligne dans le serveur (`app.use('/api/dashboard', router)`) ou changer les URLs frontend

---

### 4. Explorer — Explorateur de fichiers

| Dimension | Maestro v4 | Claude CLI (sur `explorer-claude`) |
|-----------|-----------|-------------------------------------|
| **Tache** | Non teste | "Implement file explorer" |
| **Fichiers crees** | — | 12 fichiers |
| **Lignes ajoutees** | — | +1379 |
| **Fonctionnel** | — | **NON** |
| **Score** | — | 4/10 |

**Analyse Claude CLI** :
- Composants riches : FileTree, TreeNode, Breadcrumb, ContextMenu, FilePreview, FileIcon
- Hook complet `useFileTree` avec state management et keyboard navigation
- Utilitaires fichiers (216 lignes)
- **Probleme majeur** : `App.tsx` N'A PAS ETE MODIFIE
  - Reste le placeholder Vite par defaut ("Vite + React")
  - Les 12 composants existent mais ne sont JAMAIS montes dans l'app
  - L'application affiche la page Vite par defaut — aucune fonctionnalite visible
  - Estimation : ~40% complete (composants ok, integration manquante)
- Types dupliques : `src/types.ts` ET `src/types/FileTree.ts`

---

### 5. Notifications — Systeme de notifications

| Dimension | Maestro v4 | Claude CLI (sur `notifications-claude`) |
|-----------|-----------|------------------------------------------|
| **Tache** | Non teste | "Implement notification system" |
| **Fichiers crees** | — | 17 fichiers |
| **Lignes ajoutees** | — | +1436 |
| **Fonctionnel** | — | Partiellement |
| **Score** | — | 8/10 |

**Analyse Claude CLI** :
- Systeme complet : bell avec badge, panel, toasts avec animations, preferences
- Architecture excellente : Context/Provider, 3 hooks specialises, 6 composants
- CSS custom pour animations (toast slide-in/out)
- WebSocket simulation dans le context
- **Bug mineur** : Inconsistance API paths (singulier vs pluriel dans quelques routes)
- **Plus gros livrable** : 17 fichiers, +1436 lignes — le plus ambitieux des 5

---

## Analyse transversale

### Forces de Claude CLI

1. **Execution fiable** : 5/5 taches demarrees, 5/5 avec du code produit
2. **Vitesse** : Chaque tache completee en quelques minutes
3. **Volume** : 57 fichiers crees, +5151 lignes au total
4. **Architecture** : Patterns React modernes (hooks, context, composants, TypeScript)
5. **Autonomie** : Aucune intervention humaine necessaire

### Faiblesses de Claude CLI

1. **Coherence** : Types et API dupliques dans 4/5 repos (pattern recurrent)
2. **Integration** : 2/5 repos non fonctionnels (mismatch API, App.tsx non modifie)
3. **Verification** : Aucune verification que le code fonctionne — pas de `npm run build`, pas de test
4. **Qualite variable** : De 4/10 (explorer) a 8.5/10 (crud) — imprevisible

### Forces de Maestro v4

1. **Planning** : Plan de 10 steps extremement detaille et bien structure
2. **Validation** : JSON validator verifie le plan avant execution
3. **Observabilite** : Phases, execution tree, logs — tout est visible dans le monitor
4. **Architecture** : Decomposition en blocs specialises (planner, validator, implementer, reviewer, committer)

### Faiblesses de Maestro v4

1. **Execution cassee** : 0 fichiers crees — le file-write ne fonctionne pas de maniere fiable
2. **Cout prohibitif** : ~$30+ pour 0 resultat vs ~$2-5 pour 5 features
3. **Lenteur** : ~2h pour 0 resultat vs ~15 min pour 5 features
4. **Agent tool calling** : L'agent ne sait pas appeler `done`, essaie des blocs inexistants
5. **Fragilite** : 21 fixes necessaires pour arriver au stade "plan OK, execution echoue"

---

## Scores finaux

| Repo | Claude CLI Score | Fonctionnel ? | Maestro v4 Score | Fonctionnel ? |
|------|-----------------|---------------|-----------------|---------------|
| crud | 8.5/10 | Oui | 1/10 | Non |
| auth | 7/10 | Partiellement | — | Non teste |
| dashboard | 6/10 | **Non** (API mismatch) | — | Non teste |
| explorer | 4/10 | **Non** (App.tsx placeholder) | — | Non teste |
| notifications | 8/10 | Partiellement | — | Non teste |
| **Moyenne** | **6.7/10** | **3/5 fonctionnels** | **1/10** | **0/1 fonctionnel** |

---

## Cout-efficacite

| Metrique | Maestro v4 | Claude CLI |
|----------|-----------|------------|
| Cout total estime | ~$30+ | ~$2-5 |
| Fichiers produits | 0 | 57 |
| Cout par fichier | Infini | ~$0.04-0.09 |
| Lignes produites | 0 (hors package-lock) | 5151 |
| Cout par ligne | Infini | ~$0.001 |
| Taux de reussite | 0% (0/1) | 60% (3/5 fonctionnels) |

---

## Diagnostic : Pourquoi Maestro echoue

### 1. File writing via tool system (BLOQUANT)
Le systeme de tools Maestro (maestro_cli → CliParser → RunCommandHandler → file-write block) ne gere pas correctement le contenu multi-lignes avec caracteres speciaux. L'agent essaie `--input content="..."` qui se casse sur les espaces, puis `--input-json` qui se tronque. Claude CLI natif n'a pas ce probleme car il ecrit directement via le filesystem.

### 2. Agent ne sait pas appeler `done`
Les agents essaient des blocs inexistants (step-complete, output, log-result) au lieu d'utiliser le format `{"tool":"done","args":{...}}`. Le system prompt est clair mais l'agent ne le suit pas de maniere fiable.

### 3. Overhead structurel
Le workflow v4 passe par : plan → validate → for-each(implement → validate → test → review → commit). Chaque etape est un appel LLM separe via le LLM-Provider. Claude CLI fait tout en un seul appel.

### 4. Abstraction = fragilite
Chaque couche d'abstraction (workflow → block → executor → CLI → LLM-Provider → Claude CLI) est un point de defaillance. 21 bugs ont ete trouves et corriges dans cette chaine. Claude CLI n'a qu'une seule couche.

---

## Recommandations

### Court terme (pour que Maestro fonctionne)
1. **Fixer le file-write** : L'agent DOIT pouvoir ecrire des fichiers. Options :
   - Utiliser Claude Code CLI directement pour l'ecriture (pas via maestro_cli)
   - Fixer le parsing `--input-json` pour les payloads longs
   - Ajouter un mode base64 pour le contenu
2. **Fixer le `done` calling** : Simplifier le format ou ajouter un fallback
3. **Re-tester E2E** : Run 4 avec les 21 fixes + file-write corrige

### Moyen terme (pour que Maestro soit competitif)
1. **Reduire les couches** : L'implement-step devrait ecrire directement, pas via maestro_cli
2. **Paralleliser** : Steps independants en parallele (Maestro peut, Claude CLI ne peut pas)
3. **Memory/contexte** : Maestro peut partager du contexte entre steps (avantage architectural)
4. **Review integree** : Le code-reviewer Maestro produit un excellent feedback structure

### Long terme (avantage Maestro)
1. **Multi-modele** : Utiliser opus pour le plan, sonnet pour l'implementation, haiku pour la validation
2. **Iteration** : Review → fix → re-test boucle automatique (impossible avec Claude CLI natif)
3. **Qualite garantie** : Validation par step + review globale = moins de bugs que "tout d'un coup"
4. **Observabilite** : Chaque step trace, mesure, audite — invisible avec Claude CLI

---

## Conclusion

**Aujourd'hui, Claude CLI gagne largement.** Il produit du code fonctionnel en minutes pour quelques dollars. Maestro v4 ne peut pas encore ecrire un seul fichier malgre un planning excellent.

**Mais Maestro a les bons genes.** Son architecture (blocks specialises, decomposition, validation, review) est theoriquement superieure. Le probleme n'est pas conceptuel — c'est un probleme d'execution (file-write, tool calling, parsing). Une fois ces bugs corriges, les avantages architecturaux (multi-modele, iteration, observabilite, parallelisme) pourront se materialiser.

**L'ironie** : Claude CLI fait des erreurs que Maestro est concu pour eviter (types dupliques, API mismatch, App.tsx oublie). Le code-reviewer de Maestro aurait detecte ces problemes. Mais Maestro ne peut pas encore arriver jusqu'a l'etape de review parce qu'il ne peut pas ecrire de fichiers.

**Prochaine etape critique** : Fixer le file-write. Tant que l'agent ne peut pas ecrire de fichiers, aucune comparaison n'est possible.
