# Dogfood Session — maestro-code (2026-02-26)

## Bugs corrigés

### Bug A : Steps `…` ne passent jamais en `✓` — VÉRIFIÉ OK

**Statut** : Le fix était déjà en place dans `SessionManager.ts`.

- Ligne 112 : `Map<string, string>` (pas Set) — track le status par noeud
- Ligne 118 : Mappe `"done"` ET `"completed"` → `✓`
- Ligne 124 : Skip seulement si `prevStatus === status` (re-reporte sur changement)
- Ligne 161 : `allDone` check inclut `"done"` et `"completed"`

**Aucune modification nécessaire.**

---

### Bug B : `agentState` saute `completed` — CORRIGÉ

**Fichier** : `App.ts`

**Modifications** :

1. **Ajout `completedTimerRef`** (ligne ~248) :
   ```ts
   const completedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   ```

2. **Dans `handleSubmit` → `submitTask` callback** (lignes 409-421) :
   - Avant : `setAgentState('idle')` directement quand `setBusy(false)`
   - Après : `setAgentState('completed')` → timer 3s → `setAgentState('idle')`
   - Le timer est annulé si l'utilisateur soumet une nouvelle tâche avant les 3s

3. **Bell transition** (ligne ~297) :
   - Avant : bell sur `working → idle`
   - Après : bell sur `working → completed` OU `working → idle`

4. **Cleanup** (lignes 280-282) : Le timer est nettoyé au démontage

---

### Bug C : Réponse agent non visible — CORRIGÉ

**Fichier** : `services/SessionManager.ts` (lignes 166-244)

**Cause** : Le code essayait `lastNode.output.summary` mais le backend stocke `output` comme une string directe (pas un objet). De plus, il ne cherchait que dans 2 sources.

**Nouvelle logique d'extraction (5 sources, par priorité)** :

1. **`_executionTree` node output** : Le backend stocke `output` comme string tronquée (max 500 chars). On gère les deux cas : string directe et objet avec `.summary/.result/.response`.

2. **`_blockOutputs`** : Variable session contenant tous les outputs par nodeId. Structure `{type, output, timestamp}`. On prend le dernier.

3. **`_nodeResult_{id}`** : Variables session avec l'output complet par noeud. On prend la dernière.

4. **`_conversationState_*`** : Historique de conversation agent. On prend le dernier message assistant.

5. **`_llmActivity`** : Dernière entrée LLM avec `response/responsePreview/fullResponse`.

**Aussi** : L'output est cappé à 20 lignes avec `...` si plus long.

---

### Bug D : AGENT STATUS panel vide — CORRIGÉ

**Fichier** : `components/AgentScreen.ts`

**Cause** : `Panel` avec `height: 3` ne laisse qu'1 ligne de contenu (3 - 2 bordures). Le titre "AGENT STATUS" prend cette ligne, le composant `AgentStatus` est caché par `overflow: hidden`.

**Fix** : `height: 3` → `height: 5` (2 bordures + titre + contenu + padding).

**Résultat** :
- Pendant exécution : `● Agent: working   Session: de372b75     ● Processing...`
- Après complétion : `✓ Agent: completed   Session: de372b75`
- Au repos : `○ Agent: idle   Session: de372b75`

---

### Fix E : Dogfood script timeout et regex

**Fichier** : `tests/_dogfood-live.ts`

- Timeout : 120s → 180s (tâches réelles prennent ~130s)
- Regex : `/Task completed|completed|Error:|error/i` → `/Task completed|Error:/i` (évite faux positifs sur "completed" dans les steps)

---

## Fichiers modifiés

| Fichier | Modifications | Bug |
|---------|--------------|-----|
| `App.ts` | completedTimerRef, transition completed→idle, bell, cleanup | B |
| `services/SessionManager.ts` | 5 sources d'extraction output, cap 20 lignes | C |
| `components/AgentScreen.ts` | height 3→5 pour AGENT STATUS panel | D |
| `tests/_dogfood-live.ts` | timeout 120→180s, regex plus stricte | E |

---

## Résultats de la séance

### Tests automatiques
- **vitest** : 70/70 pass (golden files updated)
- **real-demo-check** : 4/4 pass

### Scénario 1 : Inspection visuelle (démo)
- **120x40** : PASS — toutes les 6 pages parfaites
- **90x30** : PASS — layout adapté, badge NavBar tronqué (mineur, accepté)
- AGENT STATUS visible avec contenu (après fix D)
- Steps `✓` visibles dans CONVERSATION (Bug A vérifié)
- Réponse agent visible "Agent: Changes look correct." (Bug C vérifié en démo)

### Scénario 3 : Tâche de dev réelle (formatTime)
- **Session** : `de372b75` — template importé, 7 phases
- **Steps** : `… → ✓` transitions correctes (Prepare, Cache Context, Plan, Validate Plan, Plan Format Gate, Store Plan, Implement Step, Validate Step, Test, Review)
- **Fichier créé** : `C:\Cantante\src\utils\formatTime.ts` — code TypeScript correct
- **Backend** : 6/7 phases done (commit pending = pas de git setup)
- **Durée** : ~130s (tâche complète avec 7 phases)
- **Note** : Dogfood script timeout atteint avant "Task completed" visible, mais tâche réussie côté backend

### Problèmes trouvés et statut

| # | Bug | Gravité | Statut |
|---|-----|---------|--------|
| A | Steps `…` → `✓` | critique | Vérifié OK (déjà fixé) |
| B | agentState saute `completed` | majeur | CORRIGÉ |
| C | Réponse agent non visible | majeur | CORRIGÉ |
| D | AGENT STATUS panel vide | majeur | CORRIGÉ |
| E | Dogfood timeout/regex | mineur | CORRIGÉ |
| — | CLI output leak dans PTY | mineur | Non corrigé (cosmétique) |

### Critères UX (estimation basée sur démo + test réel)

| Critère | Score | Notes |
|---------|-------|-------|
| Feedback | 4/5 | Steps visibles, timestamps, session ID affiché |
| Clarté | 4/5 | Messages clairs, icônes distinctives |
| Progression | 4/5 | idle→working→completed visible (après fix B/D) |
| Réponse | 3/5 | Extraction multi-source (fix C), mais non testé end-to-end |
| Stabilité | 5/5 | Layout stable pendant 130s d'exécution |
| Navigation | N/T | Non testé (scénario 4 non exécuté) |
| Erreurs | N/T | Pas d'erreurs rencontrées pour tester |

---

## Variables backend pertinentes (référence)

| Variable | Format | Contenu |
|----------|--------|---------|
| `_executionTree` | `[{id, name, status, output?, children}]` | Arbre d'exécution (output tronqué 500 chars) |
| `_blockOutputs` | `{nodeId: {type, output, timestamp}}` | Outputs par noeud avec metadata |
| `_nodeResult_{id}` | `string` | Output complet par noeud |
| `_conversationState_{id}` | `{conversationId, iteration, messageCount, ...}` | État conversation agent (toutes les 5 itérations) |
| `_llmActivity` | `[{time, nodeId, model, promptPreview, responsePreview, fullResponse, ...}]` | 20 derniers appels LLM |
| `_executionLog` | `[{time, level, msg}]` | 200 derniers événements |
| `_phases` | `[{id, name, status, description?, result?}]` | Phases du workflow |
