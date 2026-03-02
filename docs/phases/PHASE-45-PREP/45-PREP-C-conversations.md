# 45-PREP-C : Conversations Persistantes

**Effort** : 1 jour
**Prerequis** : 45-PREP-B COMPLETE

---

## Lecture obligatoire

| Fichier | Pourquoi |
|---------|----------|
| `packages/maestro-code/services/SessionManager.ts` | Cycle de vie de la session — comprendre `ensureSession()`, `.maestro/session.json`, `submitTask()`, et le pattern de reuse |
| `content/system/blocks/workflows/maestro-assistant-workflow.block.json` | Le flow backend — comprendre les 5 nodes : ensure-conversation → save-user → load-history → execute → save-response |
| `content/system/templates/sessions/maestro-assistant.session.json` | Les variables de session — `_activeConversation`, `_conversations`, les entry points (`new-conversation`, `clear-conversation`) |
| `packages/maestro-code/App.ts` (lignes 433-456) | Les slash commands `/new` et `/clear` — comprendre comment ils invoquent les entry points backend |

---

## Contexte : deux niveaux de persistance

La persistance de conversation dans maestro-code fonctionne a DEUX niveaux :

### Niveau backend (DEJA EN PLACE)
Le workflow `maestro-assistant-workflow` gere la persistance automatiquement :
1. `ensure-conversation` — cree une conversation si `_activeConversation` est null
2. `save-user-message` — ajoute le message utilisateur via le block `conversation`
3. `load-history` — charge l'historique et le passe a l'agent
4. `execute-agent` — l'agent recoit `conversationHistory` comme input
5. `save-assistant-response` — sauvegarde la reponse de l'agent

Les variables `_activeConversation` (ID) et les messages persistent dans les session variables backend.

### Niveau TUI (PARTIELLEMENT EN PLACE)
`SessionManager.ensureSession()` persiste le `sessionId` dans `.maestro/session.json` et le reutilise au prochain lancement. Quand l'utilisateur reouvre maestro-code, la meme session backend est reutilisee.

### Ce qui MANQUE
Quand le TUI reutilise une session existante, il affiche seulement "Reusing session: abc12345" mais pas l'historique de conversation. L'utilisateur voit un ecran vide alors que la conversation precedente existe dans le backend.

---

## Ce que cette sous-phase fait

### 1. Recharger l'historique de conversation au demarrage du TUI

Ajouter une methode `loadConversationHistory()` dans `SessionManager` qui :
- Recupere la variable `_conversationState_system:maestro-assistant` depuis le backend (contient `{messages: [{role, content}, ...]}`)
- OU recupere via le block `conversation` avec l'operation `get-messages` (si la variable de conversation state n'est pas disponible)
- Retourne un tableau de `LogLine[]` formate :
  - Messages `role: "user"` → `{ text: '> message', color: 'green', bold: true }`
  - Messages `role: "assistant"` → `{ text: 'Agent:', color: 'cyan', bold: true }` suivi du contenu
- Limite aux **50 derniers messages** pour eviter de surcharger le TUI

### 2. Afficher l'historique au demarrage

Dans `App.ts` ou dans `SessionManager.ensureSession()` :
- Apres la reutilisation d'une session existante (quand on trouve `.maestro/session.json` valide)
- Appeler `loadConversationHistory()` et alimenter les `lines` initiales
- Afficher un separateur : `{ text: '--- Conversation precedente ---', color: 'gray', dim: true }`
- Puis les messages de l'historique
- Puis la ligne habituelle `{ text: 'Type a task and press Enter.', color: 'gray', dim: true }`

### 3. Verifier `/new` et `/clear`

- **`/new`** : Invoque l'entry point `new-conversation` → doit creer une NOUVELLE conversation (pas une nouvelle session). L'ancienne conversation reste dans le backend. Le log visuel est efface avec un message "New conversation started."
- **`/clear`** : Invoque l'entry point `clear-conversation` → efface le log visuel ET reinitialise la conversation backend (supprime les messages ou cree une nouvelle conversation vide)
- Verifier que les messages envoyes APRES `/new` vont bien dans la nouvelle conversation, pas l'ancienne

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/services/SessionManager.ts` | Modifier : ajouter methode `loadConversationHistory(): Promise<LogLine[]>` qui recupere l'historique depuis le backend via `getSession()` et extrait les messages de `_conversationState_*` |
| `packages/maestro-code/App.ts` | Modifier : apres le "Reusing session" dans le flow de demarrage, appeler `loadConversationHistory` et injecter les lignes dans `setLines` |

---

## Verification

```bash
# Commande 1 : Tests maestro-code
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : Tous les tests passent (69+)

# Commande 2 : Verification manuelle — scenario complet (necessite backend + LLM)
# 1. Lancer maestro code : cd C:\Meastro\packages\maestro-cli && node index.js code
# 2. Envoyer un message ("Salut, c'est quoi Maestro ?")
# 3. Attendre la reponse de l'agent
# 4. Quitter (Ctrl+C ou /quit)
# 5. Relancer maestro code
# 6. Verifier que le message precedent et la reponse apparaissent dans le log
# Resultat attendu : "--- Conversation precedente ---" suivi de l'historique

# Commande 3 : Verifier que .maestro/session.json existe et est valide
cat .maestro/session.json
# Resultat attendu : {"sessionId":"<UUID>","createdAt":"...","template":"maestro-assistant"}

# Commande 4 : Verifier la variable backend (remplacer <SESSION-ID> par l'ID reel)
curl -s http://localhost:5000/api/sessions/<SESSION-ID>/variables/_activeConversation
# Resultat attendu : Un ID de conversation (string), pas null

# Commande 5 : Tester /new
# Dans maestro code, taper /new
# Envoyer un message
# Verifier que c'est une nouvelle conversation (l'historique precedent n'est plus dans le contexte de l'agent)
```

---

## Anti-patterns

- Ne PAS creer un systeme de stockage local (fichiers JSON locaux) pour les conversations — le backend a deja la persistance via les session variables. Une seule source de verite.
- Ne PAS refactorer SessionManager au-dela de l'ajout de `loadConversationHistory()` — le refactoring est hors scope
- Ne PAS charger l'historique complet si la conversation a 1000+ messages — limiter aux 50 derniers
- Ne PAS bloquer le demarrage du TUI si le chargement de l'historique echoue — c'est non-fatal, afficher un warning et continuer avec un log vide

---

## Checkpoint

```markdown
## 45-PREP-C : Conversations Persistantes
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Persistance fonctionne** : oui / non (decrire le test : fermer → rouvrir → voir historique)
**Historique affiche** : [nombre] de messages charges au demarrage
**/new fonctionne** : oui / non (nouvelle conversation creee cote backend ?)
**/clear fonctionne** : oui / non (log vide + backend reinitialise ?)
**Tests** : [nombre] passants, 0 casses
```
