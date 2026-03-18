# 63-C : Migration slash commands (6 pages → widgets)

**Statut** : A FAIRE
**Effort** : 1-1.5 jours
**Prerequis** : 63-B COMPLETE (widgets inline fonctionnels)

---

## Objectif

Connecter les slash commands aux widgets, supprimer le systeme de pages, faire de l'ecran Agent l'ecran unique. Toutes les fonctionnalites doivent etre accessibles via slash commands.

---

## Nouveaux slash commands

Ajouter dans le handler de slash commands (TaskInputBar / SessionManager) :

| Command | Widget | Args |
|---------|--------|------|
| `/status` | StatusWidget | — |
| `/spaces` | SessionsWidget | tab=sessions (default) |
| `/spaces repos` | SessionsWidget | tab=repos |
| `/spaces workspaces` | SessionsWidget | tab=workspaces |
| `/foundry` | FoundryWidget | — |
| `/catalog` | CatalogWidget | filter=all (default) |
| `/catalog agents` | CatalogWidget | filter=agents |
| `/catalog tools` | CatalogWidget | filter=tools |
| `/catalog workflows` | CatalogWidget | filter=workflows |
| `/models` | ModelsWidget | — |
| `/session <id>` | SessionMonitorWidget | sessionId=id |
| `/block <id>` | BlockDetailWidget | blockId=id |
| `/model <id>` | ModelDetailWidget | modelId=id |
| `/workspace <id>` | WorkspaceDetailWidget | workspaceId=id |
| `/repo <id>` | RepoDetailWidget | repoId=id |
| `/permissions <id>` | PermissionsWidget | sessionId=id |

Chaque slash command :
1. Parse les arguments
2. Cree un `ChatWidget` avec le type et les props
3. Ajoute le widget au ConversationLog via `addWidget()`
4. Le widget s'affiche inline et recoit le focus

---

## Suppressions

### NavBar
- Supprimer `NavBar.ts` du rendu de App.ts
- Le composant reste dans `@maestro/tui` pour compatibilite (d'autres apps pourraient l'utiliser), mais n'est plus rendu dans maestro-code

### Page routing
- Supprimer le switch sur `currentPage` dans App.ts
- Supprimer les states `page`, `setPage`
- Supprimer le `DetailView` routing (les detail views deviennent des widgets)

### Hotkeys de navigation
- Supprimer les handlers pour h/a/s/f/c/m dans App.ts
- Supprimer Ctrl+← → (page cycling)

### Quick actions panels
- Supprimer le panel "Quick Actions" dans HomeScreen et AgentScreen (plus de [S] Spaces, [F] Foundry, etc.)

---

## Modifications

### App.ts — simplification majeure

Avant : switch sur 6 pages + detail views + overlays
Apres : un seul ecran (Agent) + overlays

```typescript
// Avant (simplifie)
if (detailView) renderDetailView(detailView);
else switch(currentPage) {
  case 'home': renderHome();
  case 'agent': renderAgent();
  case 'spaces': renderSpaces();
  // ...
}

// Apres
renderAgent(); // Toujours l'ecran agent
// Les overlays (help, quit confirm, provider setup) restent au-dessus
```

### AgentScreen.ts — devient l'ecran principal

- Supprime le panel "Quick Actions" a droite
- Le ConversationLog prend toute la largeur
- Le header reste (agent status, repo, session, model)

### StatusBar — mis a jour

- Ajoute le session count badge (deplace depuis NavBar)
- Met a jour les raccourcis contextuels :
  - Par defaut : `/help commands  ? help  q quit`
  - Quand un widget est ouvert : `[Esc] close  [j/k] nav  /help commands`

### HelpOverlay — contenu mis a jour

- Supprime la section "Page Navigation" (h/a/s/f/c/m)
- Ajoute la section "Slash Commands" avec tous les nouveaux commands
- Ajoute la section "Widget Shortcuts" (j/k, Enter, Space, Tab, z, etc.)

### Slash command handler — enrichi

Le handler existant dans SessionManager (ou TaskInputBar) doit :
1. Parser la commande et les args
2. Si c'est un widget command → creer le widget et l'injecter
3. Si c'est un action command (/new, /clear, /stop, etc.) → executer l'action
4. Si c'est non reconnu → afficher "Unknown command. Type /help for available commands."

---

## Gestion de la navigation dans les widgets

Quand un widget interactif ouvre un detail (Enter sur session → session monitor) :
1. Le widget actuel est ferme (ou reste comme historique dans le chat)
2. Un nouveau widget detail est injecte dans le chat
3. Le nouveau widget recoit le focus

C'est comme un flow de conversation : l'utilisateur voit l'historique de sa navigation dans le chat.

---

## Tests

### Tests de slash commands
1. `/status` injecte StatusWidget dans le chat
2. `/spaces` injecte SessionsWidget avec tab=sessions
3. `/spaces repos` injecte SessionsWidget avec tab=repos
4. `/catalog agents` injecte CatalogWidget avec filter=agents
5. `/models` injecte ModelsWidget
6. `/session abc123` injecte SessionMonitorWidget avec sessionId
7. `/block agent-creator` injecte BlockDetailWidget avec blockId
8. `/permissions abc123` injecte PermissionsWidget avec sessionId
9. Commande inconnue `/xyz` → message d'erreur

### Tests de suppression
10. Hotkeys h/a/s/f/c/m ne font plus rien
11. NavBar n'est plus rendue
12. DetailView routing supprime

### Tests d'integration
13. `/spaces` → j/k navigate → Enter sur session → `/session <id>` automatique
14. `/catalog` → T sur un block → test result s'affiche inline
15. `/models` → P → playground s'ouvre

---

## Verification

- [ ] 16 slash commands fonctionnent (voir table ci-dessus)
- [ ] NavBar supprimee du rendu
- [ ] Page routing supprime (1 seul ecran)
- [ ] Hotkeys h/a/s/f/c/m supprimes
- [ ] StatusBar mis a jour (session count, nouveaux shortcuts)
- [ ] HelpOverlay mis a jour (slash commands, widget shortcuts)
- [ ] Navigation widget → widget fonctionne (Enter → nouveau widget)
- [ ] `npx tsc --noEmit` : 0 erreurs
- [ ] real-demo-check.cjs passe
- [ ] test:visual passe

### Checklist de non-regression (ref `inventaire-features.md`)

- [ ] Features 1.5-1.14 (StatusBar, TaskInputBar, overlays) fonctionnent
- [ ] Features 2.1-2.6 (system health, sessions) via /status
- [ ] Features 3.1-3.11 (conversation, agent status) dans l'ecran principal
- [ ] Features 4.1-4.13 (sessions, workspaces, repos, filter, delete) via /spaces
- [ ] Features 5.1-5.4 (my blocks) via /foundry
- [ ] Features 6.1-6.6 (catalog, filter, test, expand) via /catalog
- [ ] Features 7.1-7.6 (models, metrics, playground) via /models
- [ ] Features 8.1-8.18 (session monitor, block/model/workspace/repo detail) via /session, /block, etc.
- [ ] Features 9.1-9.11 (slash commands existants) inchanges
