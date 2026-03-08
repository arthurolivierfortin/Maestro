# Phase 56-F : Corrections Dogfooding

**Statut** : MOSTLY DONE (F1,F3,F4,F5,F6,F7 done — F2 needs E2E verification)
**Effort estime** : 1-1.5 jours
**Prerequis** : Phase 56-T COMPLETE
**Source** : `dogfooding/reports/dogfood-2026-03-06-17-31-03.md`

---

## Objectif

Corriger les 7 problemes identifies lors du dogfooding E2E du 2026-03-06. Score dogfooding actuel : 3/5. Cible : >= 4/5.

---

## Corrections a apporter

### F1 — CRITICAL : Catalog row wrapping (CatalogScreen.ts)

**Probleme** : Avec 156 blocks reels, ~33% des lignes debordent la largeur du terminal. Les badges type, noms, IDs, tags et descriptions ne sont pas tronques. Resultat : colonnes decalees, badges coupes ("[agen" + "]" sur la ligne suivante), indicateur de selection invisible.

**Fichier** : `packages/maestro-code/components/CatalogScreen.ts`

**Actions** :
1. Determiner la largeur du terminal (`process.stdout.columns` ou prop width)
2. Definir des largeurs max par colonne :
   - Type badge : 12 chars max (toujours complet)
   - Nom : 30 chars max, tronquer avec "..."
   - Fitness : 6 chars fixe
   - Tags : 25 chars max, tronquer
   - Description : le reste, tronquer
3. Tronquer chaque champ avec une fonction utilitaire `truncate(text, maxLen)`
4. S'assurer que chaque block = exactement 1 ligne (pas de wrapping)
5. Dans le detail expande aussi : tronquer les champs longs

**Verification** :
```bash
# Lancer en mode real — aucune ligne ne doit wrapper
cd packages/maestro-code && node tests/real-demo-check.cjs
```

---

### F2 — CRITICAL : Conversation persistence (Backend)

**Probleme** : Le 2e message recoit la meme reponse que le 1er. Le workflow affiche "Load History ✓" mais l'historique n'influence visiblement pas la reponse du LLM.

**Investigation** :
1. Lire `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — comment `CreateOrGetConversation` gere la persistence
2. Lire le block `conversation-read` — verifie-t-il que les messages precedents sont charges ?
3. Lire le block `conversation-append` — sauvegarde-t-il correctement ?
4. Verifier le log backend lors du 2e message — est-ce que le prompt envoye au LLM contient l'historique ?

**Hypotheses** :
- `conversation-read` retourne une conversation vide (mauvais ID de conversation ?)
- Le `sessionId:blockId` deterministe cree une nouvelle conversation a chaque invocation
- L'historique est charge mais pas injecte dans le prompt system/messages

**Actions** :
1. Identifier la cause exacte via les logs backend
2. Corriger le bug — l'historique DOIT etre envoye au LLM
3. Verifier en E2E : 2 messages successifs, le 2e doit etre contextuel

---

### F3 — CRITICAL : Recherche dans le Catalog (CatalogScreen.ts)

**Probleme** : 156 blocks, scroll un par un. Pas de recherche texte.

**Fichier** : `packages/maestro-code/components/CatalogScreen.ts`

**Actions** :
1. Ajouter un mode recherche active par `/` (comme vim)
2. Quand `/` est presse dans le Catalog :
   - Afficher une barre de recherche en haut
   - Filtrer les blocks en temps reel par nom, ID, tags ou description (case-insensitive)
   - `Enter` pour confirmer la selection, `Escape` pour annuler
3. Alternative plus simple : type-ahead filtering — taper des lettres filtre directement la liste
4. Ajouter hint `[/] Search` dans la barre de raccourcis

**Verification** :
- Lancer en mode real, taper `/maestro` → ne doit montrer que les blocks contenant "maestro"

---

### F4 — MAJOR : Agent repond en francais (Block config)

**Probleme** : L'agent repond en francais meme si l'utilisateur ecrit en anglais.

**Fichiers** :
- `content/system/blocks/agents/maestro-assistant/maestro-assistant.block.json` — system prompt
- `content/system/blocks/agents/maestro-assistant-compact/maestro-assistant-compact.block.json`

**Actions** :
1. Lire les system prompts des deux assistants
2. Ajouter une instruction : "Always respond in the same language the user uses. If the user writes in English, respond in English. If French, respond in French."
3. Supprimer toute instruction de langue forcee si presente

---

### F5 — MAJOR : Models page noms dupliques (ModelsScreen.ts)

**Probleme** : "Claude haiku" x4, "Claude sonnet" x3, "Claude opus" x3 sans version ni ID pour les distinguer.

**Fichier** : `packages/maestro-code/components/ModelsScreen.ts` (ou equivalent)

**Actions** :
1. Lire le composant ModelsScreen
2. Afficher le model ID (ex: `claude-haiku-4-5`) en plus du display name
3. Ou : deduplicer par display name et ajouter un suffixe de version
4. Format suggere : `Claude Haiku (claude-haiku-4-5)` ou `Claude Haiku 4.5`

---

### F6 — MAJOR : Tree branch chars dans le fitness breakdown (CatalogScreen.ts)

**Probleme** : Les metriques aggregees (Performance, Composability, Cost Factor) utilisent les memes tree chars que les features, creant une hierarchie trompeuse.

**Fichier** : `packages/maestro-code/components/CatalogScreen.ts` — `ContractTestResultView`

**Actions** :
1. Separer visuellement les features et les metriques
2. Options :
   - Ligne vide entre features et metriques
   - Header "Breakdown:" avant les metriques
   - Indentation differente pour les metriques
3. Les metriques ne sont PAS des features — ne pas utiliser le meme style de tree

---

### F7 — MAJOR : Texte concatene dans le detail expande (CatalogScreen.ts)

**Probleme** : "version: 1.0.0tioatomic: no as the full assistant." — les champs se concatenent sans separateur.

**Fichier** : `packages/maestro-code/components/CatalogScreen.ts` — section detail expandee

**Actions** :
1. Trouver le code qui rend les details du block expande
2. S'assurer que chaque champ (version, atomic, description) est sur sa propre ligne
3. Utiliser des `\n` ou des elements `Text` separes, pas une concatenation string

---

## Anti-patterns

- Ne PAS ajouter de features non listees ici — c'est une phase de corrections
- Ne PAS refactorer le CatalogScreen au-dela de ce qui est necessaire pour les fixes
- Ne PAS toucher aux tests existants sauf si les corrections les cassent
- Ne PAS ajouter de nouveaux endpoints API — les corrections sont cote TUI/blocks sauf F2

---

## Verification globale

```bash
# TypeScript
cd packages/maestro-code && npx tsc --noEmit
cd packages/maestro-code && npx vitest run
cd packages/maestro-code && node tests/real-demo-check.cjs

# Backend (si F2 modifie le backend)
cd apps/backend && dotnet build
cd apps/backend && dotnet test
```

---

## Checkpoint

```markdown
## 56-F : Corrections Dogfooding
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD

### Corrections
- [ ] F1 : Catalog row wrapping corrige — 0 lignes wrappent en mode real
- [ ] F2 : Conversation persistence — 2e message contextuel
- [ ] F3 : Recherche Catalog — `/` filtre les blocks
- [ ] F4 : Agent langue — repond dans la langue de l'utilisateur
- [ ] F5 : Models deduplication — IDs visibles
- [ ] F6 : Tree chars — features et metriques separes visuellement
- [ ] F7 : Texte concatene — chaque champ sur sa ligne

### Tests
- [ ] `npx tsc --noEmit` : 0 errors
- [ ] `npx vitest run` : tous passent
- [ ] `real-demo-check.cjs` : 4/4 PASS
- [ ] Dogfooding re-test : score >= 4/5

### Score dogfooding
- Avant : 3/5
- Apres : __/5
```
