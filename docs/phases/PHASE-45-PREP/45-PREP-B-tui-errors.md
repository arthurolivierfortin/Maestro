# 45-PREP-B : TUI — Scroll Fix + Error Display

**Effort** : 0.5 jour
**Prerequis** : 45-PREP-A COMPLETE

---

## Lecture obligatoire

| Fichier | Pourquoi |
|---------|----------|
| `packages/maestro-code/components/ConversationLog.ts` | Le composant de scroll actuel — comprendre `scrollOffset`, `maxVisible`, le slicing de `lines` |
| `packages/maestro-code/components/AgentScreen.ts` | Comment ConversationLog est integre dans l'ecran Agent — comprendre les props passees, la hauteur calculee |
| `packages/maestro-code/services/SessionManager.ts` (lignes 177-334) | Le polling de l'execution tree — comprendre `reportNode()`, comment les statuts sont rapportes, et comment les erreurs sont (ou ne sont pas) extraites |
| `packages/maestro-code/App.ts` (lignes 242-301) | Le state management — `lines`, `agentState`, `addLine`, et la logique `setBusy` |

---

## Ce que cette sous-phase fait

### 1. Verifier le scroll dans ConversationLog

Le code actuel (ConversationLog.ts lignes 20-28) calcule :
- `maxVisible = height - 2`
- `endIndex = lines.length - scrollOffset`
- `visible = lines.slice(startIndex, endIndex)`

**Action** : Tester avec 100+ lignes que le scroll Up/Down fonctionne sans couper de contenu. Si le scroll est deja fonctionnel, le documenter dans le checkpoint et passer au point 2. Ne pas fixer ce qui n'est pas casse.

Verifier aussi que le `scrollOffset` est bien remis a 0 quand de nouvelles lignes arrivent (auto-scroll to bottom).

### 2. Afficher les erreurs de nodes dans ConversationLog

Dans `SessionManager.ts` startPolling (lignes 194-333), quand un node a `status === 'error'` :

**Etat actuel** : `reportNode()` (lignes 180-192) affiche l'icone `✗` en rouge avec le nom du node, mais ne montre PAS le message d'erreur (le output/error du node).

**Ce qu'il faut ajouter** :
- Apres `reportNode()`, si `status === 'error'`, extraire le message d'erreur du node :
  - `node.output` (peut etre un string d'erreur ou un objet `{error: "..."}`)
  - `node.error` (champ explicite)
  - `node.errorMessage`
- Afficher l'erreur via `addLine({ text: '  Error: <message>', color: 'red' })`
- L'erreur doit apparaitre JUSTE APRES la ligne `✗ node-name`, pas a la fin

### 3. Verifier le passage en etat 'error'

Dans `App.ts`, la logique de completion (SessionManager.ts lignes 224-329) met `setBusy(false)` mais ne met PAS `setAgentState('error')` quand `hasErrors` est true.

**Ce qu'il faut ajouter** : Dans `App.ts` handleSubmit callback de `setBusy`, ou dans SessionManager, s'assurer que quand `hasErrors === true`, le state de l'agent passe bien a `'error'` et non a `'completed'`. Cela permet au StatusBar d'afficher un indicateur visuel d'erreur.

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/services/SessionManager.ts` | Modifier : dans `reportNode()` ou juste apres, extraire et afficher le message d'erreur des nodes en erreur |
| `packages/maestro-code/App.ts` | Modifier : dans le callback de `submitTask`, passer `agentState` a `'error'` quand `hasErrors` est true (au lieu de `'completed'`) |
| `packages/maestro-code/components/ConversationLog.ts` | Modifier SI necessaire : ajuster le calcul de scroll si le contenu est tronque. Si le scroll est correct, ne PAS toucher ce fichier. |

---

## Verification

```bash
# Commande 1 : Tests maestro-code
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : Tous les tests passent (69+)

# Commande 2 : Test visuel
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npm run test:visual" 2>/dev/null || echo "Visual tests optionnels"
# Resultat attendu : Tests visuels passent ou pas configures

# Commande 3 : Verification manuelle avec demo mode
powershell.exe -Command "cd C:\Meastro\packages\maestro-cli; node index.js code --demo --no-bell"
# Resultat attendu : Le TUI s'ouvre, les lignes de la demo scrollent normalement, pas de troncage
# Quitter avec Ctrl+C
```

---

## Anti-patterns

- Ne PAS refactorer ConversationLog pour ajouter des features (markdown rendering, syntax highlighting) — seulement verifier le scroll et ajouter l'affichage d'erreurs
- Ne PAS modifier le systeme de navigation ou la structure de pages — hors scope
- Ne PAS creer de nouveaux composants — utiliser les lignes (`addLine`) existantes pour afficher les erreurs
- Ne PAS ajouter de logique de retry automatique sur erreur — l'agent gere la recuperation, pas le TUI

---

## Checkpoint

```markdown
## 45-PREP-B : TUI Scroll + Errors
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Scroll verifie** : oui — fonctionne avec [N] lignes / non — fix applique (decrire)
**Erreurs visibles** : oui / non (copier un exemple de ce qui s'affiche quand un node echoue)
**Agent state 'error'** : oui / non (le StatusBar affiche-t-il 'error' quand un node echoue ?)
**Tests** : [nombre] passants, 0 casses
```
