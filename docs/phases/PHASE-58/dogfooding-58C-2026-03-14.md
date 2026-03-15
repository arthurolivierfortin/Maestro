# Phase 58-C Dogfooding — Observations et Resultats

**Date** : 2026-03-14
**Agent** : Claude Opus 4.6
**Session** : dogfooding `/create-agent` TUI slash command
**Score** : 3/5 (2.8 moyenne)

---

## Resultat principal

Le bloqueur 404 est **resolu**. Le pipeline `/create-agent` fonctionne de bout en bout :
- Creation de session
- Import du template block-forge
- Demarrage de session
- Invocation du workflow
- Execution du test-designer agent (LLM calls, tool usage)

## Bug critique corrige : TUI freeze (undici)

**Cause** : `globalThis.fetch` (undici, le client HTTP natif de Node.js 18+) bloque l'event loop d'Ink pour les requetes POST/PUT quand appele depuis un callback `setTimeout`.

**Fix** : Remplacement par `node:http` (client HTTP classique) dans le handler `/create-agent`. Template import inline avec `node:http` aussi (l'ancien `importSessionTemplate` utilisait le SDK qui passe par undici).

**Fix secondaire** : `MaestroApiClient.getApiUrl()` est `async` mais l'interface declare `string` — ajout du `await`.

**Fichier modifie** : `packages/maestro-code/App.ts`

---

## Agents crees

### 1. Test-generator (session 5431999c)
- **Status** : Workflow complete (~13 min)
- **Cout** : $0.003, 211 tokens completion
- **Resultat** : Test-designer a genere 9 tests / 3 features pour le contrat `test-generator`
- **Fitness** : Non extractable (bug d'affichage — voir ci-dessous)
- **Published** : "No (below threshold)"

### 2. Code-reviewer (session 34ee0541)
- **Status** : Poll timeout a 15 min (workflow possiblement encore en cours)
- **Resultat** : Inconnu — timeout silencieux

---

## Bugs identifies (14 notes de dogfooding)

### Critiques

| # | Bug | Severite | Page |
|---|-----|----------|------|
| 1 | **Affichage resultat casse** : Block/Fitness/Published contiennent le texte brut du LLM au lieu de valeurs structurees (blockId, score fitness) | Major | Agent |
| 2 | **Aucune visibilite progression workflow** : 13-15 min d'operation avec seulement "Still running... (Xmin)" — pas de step courant, pas de cout, pas de logs | Major | Agent |
| 3 | **Timeout polling silencieux** : Apres 15 min le polling s'arrete sans message. L'utilisateur pense que ca tourne encore | Major | Agent |

### Importants

| # | Bug | Severite | Page |
|---|-----|----------|------|
| 4 | Session status deconnecte : Spaces affiche "idle" pour sessions avec `_activeWorkflow` actif | Major | Spaces |
| 5 | Models page : 0 modeles malgre LLM provider fonctionnel | Major | Models |
| 6 | Chevauchement de texte : les reponses longues du LLM causent des lignes superposees | Major | Agent |

### Mineurs

| # | Bug | Severite | Page |
|---|-----|----------|------|
| 7 | AGENT STATUS header disparait apres navigation | Minor | Agent |
| 8 | 180 sessions sans moyen de filtrer/archiver | Minor | Spaces |
| 9 | 2e `/create-agent` : lignes de progression melangees avec le 1er resultat | Minor | Agent |

---

## Points positifs

- `/create-agent` ne freeze plus (fix `node:http`)
- Les 4 etapes passent correctement et rapidement (~2s pour create+import+start+invoke)
- Lancement de plusieurs workflows simultanes sans crash
- Catalog affiche 159 blocs proprement avec filtres par type
- Navigation entre pages fluide pendant les workflows longs
- Indicateur de connexion et latence fonctionnent tout au long

---

## Comparaison : CLI manuelle vs `/create-agent`

| Critere | CLI manuelle | `/create-agent` |
|---------|-------------|-----------------|
| **Setup** | 5 commandes (create, import, start, invoke, monitor) | 1 commande |
| **Monitoring** | Monitor complet (phases, logs, metriques) | "Still running..." seulement |
| **Resultat** | Variables lisibles via CLI | Texte brut du LLM (casse) |
| **Verdict** | Plus verbeux mais meilleure visibilite | Plus rapide mais aveugle |

---

## Recommandations (prochaine phase)

1. **Corriger `set-result`** dans le workflow block-forge pour extraire blockId/fitness/published structures
2. **Afficher le step courant** dans le polling (lire `_activeBlock` de la session)
3. **Message de timeout** quand le poll expire (avec lien vers la session dans Spaces)
4. **Ouvrir le Monitor** pour les sessions block-forge au lieu de poller depuis la page Agent
5. **Type mismatch `getApiUrl()`** : aligner l'interface `IApiClient` (sync) avec l'implementation (async)

---

## Verification technique

- `npx tsc --noEmit` : 0 erreurs
- `npx vitest run` : 155/156 pass (1 pre-existant ModelsScreen)
- TUI reactif pendant toute la session (~30 min)
- Backend services stables (port 5000 + 5010)
