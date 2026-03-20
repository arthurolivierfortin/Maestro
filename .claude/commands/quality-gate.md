# Maestro TUI — Quality Gate

Verification rapide de la qualite du TUI maestro-code. Ce gate lance le TUI, verifie que les fonctionnalites critiques fonctionnent, et rapporte un verdict PASS/FAIL.

## Mode d'emploi

Deux modes disponibles :
- **Demo** (defaut) : `tui_spawn` avec `mode: "demo"` — pas besoin du backend
- **Real** : `tui_spawn` avec `mode: "real"` — necessite backend sur port 5000

## Execution

### 1. Lancement

```
tui_spawn(mode: "demo")
```

Attendre que le TUI se stabilise :

```
tui_stable(timeout_ms: 15000)
```

### 2. Verifications structurelles

Capturer la frame initiale et verifier que le TUI a demarre :

```
tui_frame()
```

**CHECK 1 — Le TUI demarre** : La frame doit contenir du texte visible (pas un ecran vide).

```
tui_check(text: "maestro")
```

### 3. Verifications de navigation

Pour chaque page, appuyer sur la touche et verifier qu'elle repond :

| Touche | Page attendue | Texte a verifier |
|--------|--------------|-----------------|
| `h` | Home | Verifier qu'un contenu quelconque s'affiche |
| `a` | Agent | Verifier la zone de chat |
| `s` | Spaces | Verifier que les sessions/workspaces s'affichent |
| `c` | Catalog | Verifier que les blocks s'affichent |
| `m` | Models | Verifier que l'etat des modeles s'affiche |

Pour chaque page :
```
tui_press(key: "<touche>")
tui_frame()
```

**CHECK 2 — Navigation fonctionne** : Chaque page doit afficher du contenu different. Si toutes les pages sont identiques ou vides, c'est un echec critique.

### 4. Verifications d'interaction

Sur la page Agent (`a`) :

```
tui_press(key: "/")
tui_type(text: "hello")
tui_frame()
```

**CHECK 3 — L'input fonctionne** : Le texte tape doit etre visible dans la zone d'input.

```
tui_press(key: "escape")
```

Sur la page Catalog (`c`) :

```
tui_press(key: "j")
tui_frame()
```

**CHECK 4 — Le scroll fonctionne** : La liste doit avoir bouge.

### 5. Verification de l'overlay d'aide

```
tui_press(key: "?")
tui_frame()
```

**CHECK 5 — L'aide s'affiche** : Un overlay doit apparaitre avec les raccourcis clavier.

```
tui_press(key: "escape")
```

### 6. Nettoyage

```
tui_kill()
```

### 7. Verdict

Compiler les resultats :

```
QUALITY GATE REPORT
===================
CHECK 1 — TUI demarre          : PASS/FAIL
CHECK 2 — Navigation fonctionne : PASS/FAIL (X/5 pages OK)
CHECK 3 — Input fonctionne      : PASS/FAIL
CHECK 4 — Scroll fonctionne     : PASS/FAIL
CHECK 5 — Aide s'affiche        : PASS/FAIL

VERDICT : PASS (5/5) | FAIL (X/5)
```

**Seuil minimum** : 4/5 checks doivent passer pour un verdict PASS global.
**Si CHECK 1 echoue** : Verdict FAIL immediat, les autres checks ne sont pas pertinents.

## Utilisation typique

- Apres chaque modification de composant TUI, lancer ce gate pour verifier qu'il n'y a pas de regression
- Integrer dans la boucle `/improve` comme validation finale
- Correspond a la Couche 6 (E2E) du Testing Protocol pour les changements TUI rapides
