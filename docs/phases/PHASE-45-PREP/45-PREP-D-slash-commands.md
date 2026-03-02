# 45-PREP-D : Slash Commands Essentiels

**Effort** : 0.5 jour
**Prerequis** : 45-PREP-C COMPLETE

---

## Lecture obligatoire

| Fichier | Pourquoi |
|---------|----------|
| `packages/maestro-code/App.ts` (lignes 412-482) | Les slash commands EXISTANTS — comprendre le `slashCommands` Record, le dispatch, et chaque commande implementee |
| `packages/maestro-code/components/HelpOverlay.ts` | Le help overlay declenche par `?` — voir ce qu'il affiche deja |
| `packages/maestro-code/services/SessionManager.ts` (methodes `invokeEntryPoint`, `getSessionId`) | Comprendre comment les commands `/new` et `/clear` interagissent avec le backend |

---

## Etat actuel

Les slash commands sont DEJA implementes dans App.ts (lignes 412-482) :

| Commande | Implementee | Fonctionne |
|----------|-------------|------------|
| `/help` | Oui (ligne 417) | Affiche la liste des commandes dans le log |
| `/new` | Oui (ligne 433) | Invoque entry point `new-conversation` |
| `/clear` | Oui (ligne 445) | Invoque entry point `clear-conversation` |
| `/stop` | Oui (ligne 416) | Appelle `handleCancel()` |
| `/quit` | Oui (ligne 414) | Appelle `handleQuit()` |
| `/q` | Oui (ligne 415) | Alias de `/quit` |
| `/purge` | Oui (ligne 457) | Supprime les sessions idle via API |
| `/status` | **Non** | A ajouter |

---

## Ce que cette sous-phase fait

### 1. Verifier le fonctionnement avec le backend

Tester chaque commande avec un backend actif (pas juste en demo mode) :
- `/help` → affiche bien les commandes
- `/new` → invoque `new-conversation` et le backend repond sans erreur
- `/clear` → invoque `clear-conversation` et le backend repond sans erreur
- `/stop` → annule une tache en cours (tester en lançant une tache puis `/stop` pendant l'execution)
- `/purge` → supprime les sessions idle et affiche le compte

Si un bug est trouve, le corriger sur place.

### 2. Ajouter `/status`

Ajouter une commande `/status` dans le Record `slashCommands` qui affiche :
- **Session ID** : les 8 premiers caracteres (ou "No active session" si pas de session)
- **Template** : le template utilise (ex: `maestro-assistant`)
- **Statut** : le statut de la session backend (idle, active, completed)
- **Conversation** : l'ID de la conversation active (ou "None")
- **Repo path** : le chemin du projet lie

Implementation : utiliser `sessionManager.getSessionId()` puis `apiClient.getSession(id)` pour recuperer les details.

### 3. Enrichir `/help`

Le `/help` actuel (lignes 417-431) est deja assez complet. Verifier qu'il inclut :
- Toutes les commandes (y compris `/status` apres ajout)
- Les raccourcis clavier (`/` pour focus, `Escape` pour navigation, `?` pour help overlay, `Ctrl+C`)
- Les raccourcis de page (`h` Home, `a` Agent, `s` Spaces, `f` Foundry, `c` Catalog, `m` Models)

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | Modifier : ajouter `/status` dans le Record `slashCommands` (apres ligne 482), enrichir `/help` si des raccourcis manquent |

---

## Verification

```bash
# Commande 1 : Tests maestro-code
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : Tous les tests passent (69+)

# Commande 2 : Verification manuelle (avec backend)
# Lancer maestro code : cd C:\Meastro\packages\maestro-cli && node index.js code
# Taper /help → verifier que TOUTES les commandes sont listees (incluant /status)
# Taper /status → verifier que l'etat de la session s'affiche
# Envoyer un message, attendre la reponse, puis taper /new → "New conversation started"
# Taper /status a nouveau → verifier que la conversation a change
# Resultat attendu : Chaque commande fait ce qu'elle annonce
```

---

## Anti-patterns

- Ne PAS ajouter des commandes non-essentielles (`/theme`, `/config`, `/debug`, `/export`, `/history`) — garder le scope minimal pour V1. Les documenter dans `next-phase-items.md` si pertinentes.
- Ne PAS changer le mecanisme de dispatch des slash commands (le Record `slashCommands`) — juste ajouter des entrees
- Ne PAS creer un systeme de plugins pour les commandes — YAGNI
- Ne PAS passer du temps a rendre `/help` jolie — le contenu est plus important que le formatage

---

## Checkpoint

```markdown
## 45-PREP-D : Slash Commands
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Commandes verifiees avec backend** : /help, /new, /clear, /stop, /quit, /purge — oui / non (lesquelles ont des bugs ?)
**/status ajoute** : oui / non (copier l'output)
**/help enrichi** : oui / non (raccourcis de page listes ?)
**Tests** : [nombre] passants, 0 casses
```
