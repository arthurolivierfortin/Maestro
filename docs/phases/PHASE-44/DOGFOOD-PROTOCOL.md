# Protocole de Dogfooding — maestro-code

## Contexte

Les fixes UX (Phase 44-E) sont appliqués : StatusBar, flexShrink, overflow, NavBar.
L'outil d'inspection visuelle (`_inspect.ts`, `_dogfood-live.ts`) fonctionne.

Le premier test live a révélé que malgré les fixes, **l'expérience utilisateur est cassée** :
- L'agent ne montre jamais sa réponse
- Les étapes restent en `…` (jamais `✓`)
- Un simple "Salut" lance 2 minutes de workflow dev
- L'état passe de `working` à `idle` sans jamais montrer `completed`

Ce protocole structure une séance de dogfooding systématique :
corrections → vérifications → observations → re-corrections.

---

## Pré-vol

Avant de tester, vérifier :

```
1. Backend port 5000    → curl http://localhost:5000/api/health
2. LLM-Provider 5010    → curl http://localhost:5010/api/v1/health/
3. Tests passent        → npx vitest run tests/ (70/70)
4. Real-demo-check      → node tests/real-demo-check.cjs (4/4)
```

---

## Bugs connus à corriger AVANT la séance

### Bug A : Steps `…` ne passent jamais en `✓`

**Cause** : `SessionManager.startPolling` utilisait un `Set` pour tracker les noeuds reportés. Un noeud reporté avec status `running` (→ `…`) n'est jamais re-reporté quand il passe à `done` (→ `✓`).

**Aussi** : Le backend retourne `status: "done"`, mais le code ne mapait que `"completed"` → `✓`.

**Fix** : Remplacer le `Set<string>` par un `Map<string, string>` qui track le status. Re-reporter quand le status change. Mapper `"done"` et `"completed"` vers `✓`.

**Fichier** : `packages/maestro-code/services/SessionManager.ts` (lignes 112-156)
**Statut** : Fix déjà écrit, à vérifier.

### Bug B : `agentState` saute `completed`

**Cause** : `App.ts` ligne 401-403 — quand `setBusy(false)` est appelé, l'état va directement à `'idle'`. Le composant `AgentStatus` ne montre jamais `✓ completed`.

**Fix** : Mettre `agentState` à `'completed'` quand la tâche finit, puis revenir à `'idle'` après un délai (3s) ou quand l'utilisateur soumet une nouvelle tâche.

**Fichier** : `packages/maestro-code/App.ts` (lignes 398-414)

### Bug C : Réponse agent non visible

**Cause potentielle** : `SessionManager.startPolling` essaie de lire `lastNode.output.summary` et `_conversationState_*`. Mais le backend retourne peut-être l'output dans un format différent (vérifié par le test live : les variables `_blockOutputs` contiennent les résultats, pas `output` sur les noeuds du tree).

**Investigation** : Vérifier via l'API ce que contient `_blockOutputs` et `_conversationState_*` pour la session réelle. Adapter l'extraction.

**Fichier** : `packages/maestro-code/services/SessionManager.ts` (lignes 160-200)

---

## Scénarios de test

### Scénario 1 : Inspection visuelle (mode démo, pas de backend)

**Commande** : `npx tsx tests/_inspect.ts 120 40` puis `npx tsx tests/_inspect.ts 90 30`

**Vérifier sur CHAQUE page (6 pages : Agent, Home, Spaces, Foundry, Catalog, Models)** :

- [ ] NavBar visible avec "MAESTRO" et tous les onglets complets
- [ ] Onglets lisibles (pas tronqués) — surtout à 90 cols
- [ ] Panel(s) de contenu visibles avec titres corrects
- [ ] Pas de texte qui dépasse les bordures `│`
- [ ] StatusBar en bas avec "connected" et shortcuts
- [ ] TaskInputBar présente avec "Press / to type..."
- [ ] Bordures alignées (pas de glitch dans les `┌┐└┘`)

**Notes à prendre** : Pour chaque page, noter si le contenu est complet et lisible.

---

### Scénario 2 : Connexion réelle (mode réel, pas de tâche)

**Commande** : Lancer en mode réel sans soumettre de tâche.

**Vérifier** :
- [ ] StatusBar affiche "connected" (pas "connecting")
- [ ] Page Home montre les sessions réelles du backend
- [ ] Page Foundry montre les blocs réels
- [ ] Page Catalog montre les blocs avec fitness
- [ ] Page Models montre les modèles disponibles
- [ ] Page Spaces montre les repos/workspaces/sessions

**Notes** : Comparer les données affichées avec ce que retourne l'API (`curl http://localhost:5000/api/sessions`, etc.)

---

### Scénario 3 : Tâche de dev simple

**Tâche** : `"Crée un fichier src/utils/formatTime.ts qui exporte une fonction formatTime(seconds: number): string qui retourne le format mm:ss"`

**Commande** : `npx tsx tests/_dogfood-live.ts "Crée un fichier src/utils/formatTime.ts qui exporte une fonction formatTime(seconds: number): string qui retourne le format mm:ss"`

**Vérifier étape par étape** :

1. **Soumission** :
   - [ ] Le message `> Crée un fichier...` apparaît dans CONVERSATION
   - [ ] "Creating session..." s'affiche avec timestamp
   - [ ] Session ID (8 chars) s'affiche
   - [ ] "Importing template..." → "Session started" → "Invoking: dev"
   - [ ] AGENT STATUS passe de `○ idle` à `● working`

2. **Exécution** :
   - [ ] Les steps apparaissent un par un (`… Plan`, `… Validate Plan`, etc.)
   - [ ] Les steps passent de `…` à `✓` quand complétés (Bug A)
   - [ ] La StatusBar reste "connected"
   - [ ] La NavBar reste stable (pas de compression)

3. **Complétion** :
   - [ ] "Task completed" apparaît en vert
   - [ ] La réponse de l'agent s'affiche (Bug C — ce qu'il a fait, résumé)
   - [ ] AGENT STATUS passe à `✓ completed` (Bug B)
   - [ ] Le fichier `C:\Cantante\src\utils\formatTime.ts` existe réellement

4. **Vérification fichier** :
   - [ ] Le fichier contient une fonction `formatTime`
   - [ ] Le code est correct (TypeScript valide)

**Notes** : Temps total d'exécution. Qualité de la réponse. Problèmes observés.

---

### Scénario 4 : Navigation pendant l'exécution

**Pendant que l'agent travaille** (scénario 3 en cours) ou juste après :

- [ ] Presser `H` → Home : la session en cours/terminée apparaît dans ACTIVE SESSIONS
- [ ] La session a le bon nom ("Cantante - Crée un fichier...")
- [ ] Le status est correct (running/completed)
- [ ] Presser `S` → Spaces : la session apparaît dans la liste Sessions
- [ ] Presser `A` → Agent : le ConversationLog est intact (historique complet)
- [ ] Pas de crash ou de contenu vide après navigation

**Notes** : Est-ce que la navigation interrompt le polling ? L'historique est-il préservé ?

---

### Scénario 5 : Message conversationnel (edge case)

**Tâche** : `"Salut, comment vas-tu?"`

Ce n'est PAS une tâche de dev. Le template `project-autonomous` va quand même lancer le workflow complet. C'est un problème de design connu.

**Vérifier** :
- [ ] La session est créée (même si c'est inadapté)
- [ ] L'agent essaie de travailler (il va probablement analyser le repo et ne rien faire)
- [ ] Quand il termine, une réponse est visible
- [ ] Le système ne crash pas

**Notes** : Combien de temps ça prend ? Quelle est la réponse ? Est-ce que c'est un bon comportement ?
**Amélioration future** : Le template devrait détecter les messages non-dev et répondre directement.

---

### Scénario 6 : Deuxième tâche consécutive

Après la complétion du scénario 3 :

**Tâche** : `"Ajoute un test pour formatTime dans src/utils/formatTime.test.ts"`

**Vérifier** :
- [ ] Le ConversationLog garde l'historique de la première tâche
- [ ] La nouvelle tâche crée une nouvelle session
- [ ] Les steps s'affichent correctement pour la 2e tâche
- [ ] AGENT STATUS repasse de `idle` → `working` → `completed`

---

## Protocole d'observation

**Après chaque scénario, noter :**

```
SCÉNARIO X : [nom]
═══════════════════
Résultat : PASS / PARTIAL / FAIL
Temps : Xs

Ce qui marche :
- ...

Ce qui ne marche pas :
- [BUG-XX] description — gravité (critique/majeur/mineur)

Ce qui pourrait être amélioré :
- ...

Frame capturé : oui/non
```

---

## Critères d'évaluation UX

Au-delà de "ça marche", évaluer :

| Critère | Question | Score (1-5) |
|---------|----------|-------------|
| **Feedback** | L'utilisateur sait-il ce qui se passe à chaque instant ? | |
| **Clarté** | Les messages sont-ils compréhensibles ? | |
| **Progression** | Voit-on clairement l'avancement (idle → working → done) ? | |
| **Réponse** | La réponse de l'agent est-elle visible et utile ? | |
| **Stabilité** | Le layout reste-t-il stable pendant toute la session ? | |
| **Navigation** | Peut-on naviguer sans perdre le contexte ? | |
| **Erreurs** | Les erreurs sont-elles claires et actionnables ? | |

---

## Ordre d'exécution

```
1. Corriger Bug A, B, C (avant de tester)
2. Vérifier tests (vitest + real-demo-check)
3. Scénario 1 : Inspection visuelle démo
4. Scénario 2 : Connexion réelle
5. Scénario 3 : Tâche de dev simple ← test principal
6. Scénario 4 : Navigation pendant exécution
7. Scénario 5 : Message conversationnel (edge case)
8. Scénario 6 : Deuxième tâche consécutive
9. Bilan : noter tous les bugs et améliorations
10. Corriger les bugs critiques trouvés
11. Re-tester les scénarios qui ont échoué
```

---

## Fichiers clés

| Fichier | Rôle | Ce qu'on vérifie |
|---------|------|------------------|
| `App.ts` | Routing, état agent, submit | Bug B (agentState), connexion |
| `services/SessionManager.ts` | Polling, steps, réponse | Bug A (icons), Bug C (output) |
| `components/AgentScreen.ts` | Affichage état + conversation | Layout, status display |
| `components/ConversationLog.ts` | Log scrollable | Lisibilité, auto-scroll |
| `components/NavBar.ts` (wrapper) | Navigation | Badge, page active |
| `tui/NavBar.ts` | Shared NavBar | flexShrink, overflow |
| `tui/StatusBar.ts` | Shared StatusBar | flexShrink, connexion |
| `tests/_inspect.ts` | Capture frames démo | Outil d'inspection |
| `tests/_dogfood-live.ts` | Test live avec backend | Outil de test réel |
