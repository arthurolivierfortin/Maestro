# Phase 63 — Checklist de validation E2E complete

Chaque test doit etre valide sur le vrai TUI via MCP (tui_spawn, tui_press, tui_type, tui_check, tui_frame).
Marquer PASS/FAIL avec notes. Si FAIL, documenter l'issue et corriger.

---

## 1. Demarrage et ecran principal

- [ ] 1.1 Demarrage → ecran chat (pas Home, pas NavBar)
- [ ] 1.2 AGENT STATUS header visible (status, repo, session)
- [ ] 1.3 Welcome message : "Type a message or /help for commands"
- [ ] 1.4 Input prompt `>` toujours actif (pas besoin de `/`)
- [ ] 1.5 StatusBar visible : connection, latency, time, daily cost, session count
- [ ] 1.6 StatusBar shortcuts par defaut : `/help commands  ? help  q quit`

## 2. Saisie de texte

- [ ] 2.1 Taper du texte directement → apparait dans l'input
- [ ] 2.2 Enter soumet le texte a l'agent
- [ ] 2.3 L'agent repond (demo mode : tache simulee)
- [ ] 2.4 Reponse de l'agent visible dans la conversation
- [ ] 2.5 Timestamps complets (HH:MM:SS, 8 chars)
- [ ] 2.6 Steps consecutifs sans lignes vides excessives
- [ ] 2.7 Contenu agent multi-ligne wrape correctement

## 3. Slash command autocomplete

- [ ] 3.1 Taper `/` → autocomplete apparait au-dessus de l'input
- [ ] 3.2 Taper `/st` → filtre a `/status`, `/stop`
- [ ] 3.3 Descriptions visibles a cote de chaque suggestion
- [ ] 3.4 Enter sur suggestion unique soumet directement
- [ ] 3.5 Esc ferme l'autocomplete

## 4. /status → StatusWidget

- [ ] 4.1 `/status` + Enter → widget s'affiche inline
- [ ] 4.2 Health : Backend + LLM status visibles
- [ ] 4.3 Sessions listees avec status, ID
- [ ] 4.4 j/k navigate la liste (→ bouge)
- [ ] 4.5 Enter ouvre SessionMonitorWidget pour la session selectionnee
- [ ] 4.6 Esc collapse le widget en `[System Status] (collapsed)`
- [ ] 4.7 StatusBar change : `Esc close  j/k nav  /help commands`
- [ ] 4.8 Apres Esc, StatusBar revient aux raccourcis par defaut

## 5. /spaces → SessionsWidget

- [ ] 5.1 `/spaces` + Enter → widget s'affiche
- [ ] 5.2 Session list avec status, cost, duration, child badge [+N]
- [ ] 5.3 Header : count + filter `[r]`
- [ ] 5.4 j/k navigate
- [ ] 5.5 Space expand la session selectionnee (full ID, children, fitness, workflow)
- [ ] 5.6 Space a nouveau collapse
- [ ] 5.7 r toggle le filtre running/all
- [ ] 5.8 d sur une session → confirmation "Delete? y/n"
- [ ] 5.9 n annule la suppression
- [ ] 5.10 Enter ouvre SessionMonitorWidget
- [ ] 5.11 Esc collapse
- [ ] 5.12 Shortcut hints visibles en bas

## 6. /catalog → CatalogWidget

- [ ] 6.1 `/catalog` + Enter → widget s'affiche
- [ ] 6.2 Filter tabs visibles : [1] All [2] Workflows [3] Agents [4] Tools
- [ ] 6.3 Block list avec type badge, name, ID, fitness bar, %
- [ ] 6.4 Pas de texte corrompu (pas de `%%`, pas de `84% 9%`)
- [ ] 6.5 j/k navigate
- [ ] 6.6 1/2/3/4 filtre par type
- [ ] 6.7 Space expand (description, version, capabilities, contract)
- [ ] 6.8 Space collapse
- [ ] 6.9 T lance un contract test (affiche "Testing..." puis resultat)
- [ ] 6.10 Enter ouvre BlockDetailWidget
- [ ] 6.11 Esc collapse
- [ ] 6.12 Scroll indicator visible quand > maxItems

## 7. /foundry → FoundryWidget

- [ ] 7.1 `/foundry` + Enter → widget s'affiche
- [ ] 7.2 Block count par type
- [ ] 7.3 j/k navigate
- [ ] 7.4 Space expand (description, version, atomic)
- [ ] 7.5 Enter ouvre BlockDetailWidget
- [ ] 7.6 Esc collapse

## 8. /models → ModelsWidget

- [ ] 8.1 `/models` + Enter → widget s'affiche
- [ ] 8.2 Health status + metrics (requests, tokens, latency, errors)
- [ ] 8.3 Model list avec provider badge + active indicator
- [ ] 8.4 j/k navigate
- [ ] 8.5 Enter ouvre ModelDetailWidget
- [ ] 8.6 P lance playground (si implemente)
- [ ] 8.7 Esc collapse

## 9. /session \<id\> → SessionMonitorWidget

- [ ] 9.1 `/session sess-001` + Enter → widget s'affiche
- [ ] 9.2 Session name + status + duration + cost
- [ ] 9.3 Active workflow ou "idle"
- [ ] 9.4 RECENT ACTIVITY avec derniers log entries
- [ ] 9.5 PermissionsPanel visible
- [ ] 9.6 Esc collapse

## 10. /block \<id\> → BlockDetailWidget

- [ ] 10.1 `/block code-analyzer` + Enter → widget s'affiche
- [ ] 10.2 Type badge + name + version + atomic
- [ ] 10.3 Description complete (pas tronquee)
- [ ] 10.4 Fitness bar + score
- [ ] 10.5 Capabilities
- [ ] 10.6 Tools requis (si agent)
- [ ] 10.7 Esc collapse

## 11. /model \<id\> → ModelDetailWidget

- [ ] 11.1 `/model claude-sonnet-4-6` + Enter → widget s'affiche
- [ ] 11.2 Status + provider + availability
- [ ] 11.3 Metrics (requests, tokens, latency, errors)
- [ ] 11.4 Esc collapse

## 12. /workspace \<id\> → WorkspaceDetailWidget

- [ ] 12.1 `/workspace ws-001` + Enter → widget s'affiche
- [ ] 12.2 Workspace name + ID
- [ ] 12.3 Session list
- [ ] 12.4 PermissionsPanel (ceiling)
- [ ] 12.5 j/k navigate sessions
- [ ] 12.6 Enter ouvre SessionMonitorWidget
- [ ] 12.7 Esc collapse

## 13. /repo \<id\> → RepoDetailWidget

- [ ] 13.1 `/repo cantante` + Enter → widget s'affiche
- [ ] 13.2 Repo name + path + status
- [ ] 13.3 Session list
- [ ] 13.4 j/k navigate
- [ ] 13.5 Esc collapse

## 14. /permissions \<id\> → PermissionsWidget

- [ ] 14.1 `/permissions sess-001` + Enter → widget s'affiche
- [ ] 14.2 Diff visuel : o blanc, . gris, X rouge
- [ ] 14.3 Parent name visible
- [ ] 14.4 CLI hint visible ("Pour modifier: maestro session restrict...")
- [ ] 14.5 Esc collapse

## 15. Slash commands existants

- [ ] 15.1 `/help` affiche l'aide (ou injecte un widget aide)
- [ ] 15.2 `/new` cree une nouvelle conversation
- [ ] 15.3 `/clear` vide la conversation
- [ ] 15.4 `/stop` cancel la tache en cours
- [ ] 15.5 `/costs` affiche les couts
- [ ] 15.6 `/create-agent` lance le block-forge
- [ ] 15.7 `/playground` lance le playground
- [ ] 15.8 `/quit` affiche la confirmation

## 16. Focus management

- [ ] 16.1 Quand un widget est ouvert, taper du texte va dans l'input (pas le widget)
- [ ] 16.2 j/k dans un widget ne scrolle pas le chat
- [ ] 16.3 Esc sur un widget le ferme mais l'input reste actif
- [ ] 16.4 Ouvrir widget A puis widget B : seul B a le focus
- [ ] 16.5 Widget collapse → focus revient a l'input

## 17. Historique et scroll

- [ ] 17.1 Widgets collapses restent dans l'historique du chat
- [ ] 17.2 Plusieurs widgets collapses visibles
- [ ] 17.3 Chat scroll fonctionne quand beaucoup de contenu

## 18. Rendu global

- [ ] 18.1 Pas de texte corrompu nulle part
- [ ] 18.2 Colonnes alignees dans tous les widgets
- [ ] 18.3 Pas de lignes vides excessives
- [ ] 18.4 Timestamps toujours 8 chars (HH:MM:SS)
- [ ] 18.5 Texte agent multi-ligne wrape correctement

## 19. Mode --classic (rollback)

- [ ] 19.1 Lancer avec --classic → NavBar visible
- [ ] 19.2 Hotkeys h/a/s/f/c/m fonctionnent
- [ ] 19.3 Page Agent avec panel ACTIONS
- [ ] 19.4 Page Spaces avec 3 tabs
- [ ] 19.5 Detail views fonctionnent (Enter sur session → SessionMonitor)

## 20. Widget injection agent

- [ ] 20.1 Reponse agent avec `[widget:models]` → ModelsWidget injecte dans le chat
- [ ] 20.2 Widget injecte est interactif

---

## Compteur

| Categorie | Tests |
|-----------|-------|
| Demarrage | 6 |
| Saisie | 7 |
| Autocomplete | 5 |
| /status | 8 |
| /spaces | 12 |
| /catalog | 12 |
| /foundry | 6 |
| /models | 7 |
| /session | 6 |
| /block | 7 |
| /model | 4 |
| /workspace | 7 |
| /repo | 5 |
| /permissions | 5 |
| Slash existants | 8 |
| Focus | 5 |
| Historique | 3 |
| Rendu | 5 |
| Classic | 5 |
| Widget injection | 2 |
| **Total** | **130** |
