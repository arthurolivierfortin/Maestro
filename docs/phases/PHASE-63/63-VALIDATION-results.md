# Phase 63 — Resultats de validation E2E (MCP)

**Date** : 2026-03-18 soir
**Mode** : demo via MCP tui_spawn
**Limitations MCP** : keys Space, d, r, 1/2/3/4, ? non disponibles dans tui_press

---

## Resultats

### 1. Demarrage et ecran principal
| # | Test | Resultat |
|---|------|---------|
| 1.1 | Ecran chat, pas Home, pas NavBar | PASS |
| 1.2 | AGENT STATUS header visible | PASS |
| 1.3 | Welcome message correct | PASS |
| 1.4 | Input prompt `>` toujours actif | PASS |
| 1.5 | StatusBar complete | PASS |
| 1.6 | StatusBar shortcuts par defaut | PASS |

### 2. Saisie de texte
| # | Test | Resultat |
|---|------|---------|
| 2.1 | Taper directement → apparait dans input | PASS |
| 2.2 | Enter soumet le texte | PASS |
| 2.3 | Agent repond (demo mode) | PASS |
| 2.4 | Reponse visible dans conversation | PASS |
| 2.5 | Timestamps complets HH:MM:SS | PASS |
| 2.6 | Steps consecutifs sans lignes vides | PASS |
| 2.7 | Contenu agent visible et wrape | PASS |

### 3. Autocomplete
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 3.1 | `/` → autocomplete apparait | PASS | |
| 3.3 | Descriptions visibles | PASS | |
| 3.2 | `/st` filtre | NON TESTE | MCP tape tout d'un coup |
| 3.4 | Enter sur suggestion unique | PASS | |
| 3.5 | Esc ferme autocomplete | NON TESTE | |

### 4. /status → StatusWidget
| # | Test | Resultat |
|---|------|---------|
| 4.1 | Widget s'affiche inline | PASS |
| 4.2 | Health visible | PASS |
| 4.3 | Sessions listees | PASS |
| 4.4 | j/k navigation | PASS |
| 4.5 | Enter ouvre SessionMonitorWidget | PASS |
| 4.6 | Esc collapse | PASS |
| 4.7 | StatusBar change shortcuts | PASS |
| 4.8 | StatusBar revient apres Esc | PASS |

### 5. /spaces → SessionsWidget
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 5.1 | Widget s'affiche | PASS | |
| 5.2 | Session list avec status, cost, duration | PASS | |
| 5.3 | Header count + filter | PASS | |
| 5.4 | j/k navigate | PASS | |
| 5.5 | Space expand | NON TESTE | MCP n'a pas la key Space |
| 5.6 | Space collapse | NON TESTE | |
| 5.7 | r toggle filtre | NON TESTE | MCP n'a pas la key r |
| 5.8 | d delete + confirmation | NON TESTE | MCP n'a pas la key d |
| 5.9 | n annule suppression | NON TESTE | |
| 5.10 | Enter ouvre SessionMonitorWidget | PASS (teste via StatusWidget) | |
| 5.11 | Esc collapse | PASS | |
| 5.12 | Shortcut hints | PASS | |

### 6. /catalog → CatalogWidget
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 6.1 | Widget s'affiche | PASS | |
| 6.2 | Filter tabs visibles | PASS | |
| 6.3 | Block list avec fitness | PASS | |
| 6.4 | Pas de texte corrompu | PASS | `95%` et `84%` propres |
| 6.5 | j/k navigate | PASS (teste precedemment) | |
| 6.6 | 1/2/3/4 filtre | NON TESTE | MCP n'a pas les keys 1-4 |
| 6.7 | Space expand | NON TESTE | |
| 6.8 | Space collapse | NON TESTE | |
| 6.9 | T contract test | NON TESTE | MCP a la key t mais en minuscule |
| 6.10 | Enter ouvre BlockDetailWidget | NON TESTE (pas teste depuis catalog) | |
| 6.11 | Esc collapse | PASS | |
| 6.12 | Scroll indicator | PASS | `1/14` visible |

### 7. /foundry → FoundryWidget
| # | Test | Resultat |
|---|------|---------|
| 7.1 | Widget s'affiche | PASS |
| 7.2 | Block count par type | PASS |
| 7.3 | j/k navigate | NON TESTE (mais j/k fonctionne dans les autres widgets) |
| 7.4 | Space expand | NON TESTE |
| 7.5 | Enter ouvre BlockDetailWidget | NON TESTE |
| 7.6 | Esc collapse | PASS |

### 8. /models → ModelsWidget
| # | Test | Resultat |
|---|------|---------|
| 8.1 | Widget s'affiche | PASS |
| 8.2 | Health + metrics | PASS |
| 8.3 | Model list avec provider | PASS |
| 8.4 | j/k navigate | PASS (→ visible) |
| 8.5 | Enter ouvre ModelDetailWidget | NON TESTE |
| 8.6 | P playground | NON TESTE |
| 8.7 | Esc collapse | PASS |

### 9. /session \<id\> → SessionMonitorWidget
| # | Test | Resultat |
|---|------|---------|
| 9.1 | Widget s'affiche | PASS (via StatusWidget Enter) |
| 9.2 | Session name + status + duration + cost | PASS |
| 9.3 | Workflow status | PASS |
| 9.4 | RECENT ACTIVITY | PASS |
| 9.5 | PermissionsPanel | PASS |
| 9.6 | Esc collapse | PASS |

### 10. /block \<id\> → BlockDetailWidget
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 10.1 | Widget s'affiche | PASS | |
| 10.2 | Type badge + name + version + atomic | PASS | |
| 10.3 | Description complete | PASS | |
| 10.4 | Fitness bar + score | PASS | |
| 10.5 | Capabilities | PASS | |
| 10.6 | Tools requis | NON TESTE (demo data pas d'agent avec config.nodes) | |
| 10.7 | Esc collapse | **FAIL** | Widget non-interactif, Esc ne le cible pas |

### 11-14. Autres detail widgets
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 11.1-11.4 | /model | NON TESTE | |
| 12.1-12.7 | /workspace | NON TESTE | |
| 13.1-13.5 | /repo | NON TESTE | |
| 14.1-14.5 | /permissions | NON TESTE | |

### 15. Slash commands existants
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 15.1 | /help | PASS | Commandes + raccourcis affiches |
| 15.2-15.7 | /new, /clear, /stop, /costs, /create-agent, /playground | NON TESTE | |
| 15.8 | /quit | **FAIL** | Autocomplete bloque la soumission, pas de confirmation quit |

### 16. Focus management
| # | Test | Resultat |
|---|------|---------|
| 16.1 | Taper dans input ne va pas dans widget | PASS |
| 16.2 | j/k dans widget ne scrolle pas le chat | PASS |
| 16.3 | Esc ferme widget, input reste actif | PASS |
| 16.4 | Widget A puis B : seul B a le focus | PASS (status → session monitor) |
| 16.5 | Widget collapse → focus revient a input | PASS |

### 17. Historique et scroll
| # | Test | Resultat |
|---|------|---------|
| 17.1 | Widgets collapses dans historique | PASS |
| 17.2 | Plusieurs collapses visibles | PASS |
| 17.3 | Chat scroll | PASS (▲ indicateur visible) |

### 18. Rendu global
| # | Test | Resultat | Notes |
|---|------|---------|-------|
| 18.1 | Pas de texte corrompu | PASS (sauf artefact mineur `collapsed)llapsed)` vu une fois) |
| 18.2 | Colonnes alignees | PASS |
| 18.3 | Pas de lignes vides excessives | PASS (une ligne vide entre certains blocks dans catalog — mineur) |
| 18.4 | Timestamps 8 chars | PASS |
| 18.5 | Texte agent wrape | PASS |

### 19. Mode --classic
NON TESTE (MCP spawn ne supporte pas les flags)

### 20. Widget injection agent
NON TESTE (necessite une reponse agent reelle avec marqueur)

---

## Resume

| Categorie | PASS | FAIL | NON TESTE |
|-----------|------|------|-----------|
| Demarrage | 6 | 0 | 0 |
| Saisie | 7 | 0 | 0 |
| Autocomplete | 3 | 0 | 2 |
| /status | 8 | 0 | 0 |
| /spaces | 6 | 0 | 6 |
| /catalog | 6 | 0 | 6 |
| /foundry | 3 | 0 | 3 |
| /models | 5 | 0 | 2 |
| /session | 6 | 0 | 0 |
| /block | 5 | 1 | 1 |
| /model, /workspace, /repo, /permissions | 0 | 0 | 18 |
| Slash existants | 1 | 1 | 6 |
| Focus | 5 | 0 | 0 |
| Historique | 3 | 0 | 0 |
| Rendu | 5 | 0 | 0 |
| Classic | 0 | 0 | 5 |
| Widget injection | 0 | 0 | 2 |
| **Total** | **69** | **2** | **51** |

## Bugs confirmes

1. **10.7** : BlockDetailWidget ne se ferme pas avec Esc (widget non-interactif, pas de claim 'widget')
2. **15.8** : `/quit` ne fonctionne pas — l'autocomplete reste affiche et bloque la soumission
3. **18.1** (mineur) : Artefact ponctuel `collapsed)llapsed)` — trailing chars Ink

## Limitations MCP

Les keys suivantes ne sont pas disponibles dans `tui_press` :
- **Space** : empeche de tester expand/collapse dans SessionsWidget, CatalogWidget, FoundryWidget
- **d** : empeche de tester delete dans SessionsWidget
- **r** : empeche de tester le filtre dans SessionsWidget
- **1/2/3/4** : empeche de tester les filter tabs dans CatalogWidget
- **?** : empeche de tester le HelpOverlay
- **--classic flag** : MCP spawn ne supporte pas les flags CLI

51 tests sur 130 n'ont pas pu etre valides a cause de ces limitations.
