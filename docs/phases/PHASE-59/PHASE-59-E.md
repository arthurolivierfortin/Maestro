# 59-E : SpacesScreen refonte — Enfants dans le detail view, pas dans la liste

---

## Contexte

L'approche tree (├─/└─ dans la liste principale) a cree des problemes de rendu insolubles :
- Blank lines quand le parent scroll off
- Alignement casse entre parents et enfants
- Navigation j/k incoherente (certains items invisibles)
- Chevauchement de lignes dans Ink

La nouvelle approche : **les enfants ne sont PAS dans la liste principale**. Ils apparaissent dans le detail view quand le parent est selectionne et expand.

---

## Lecture obligatoire

- `packages/maestro-code/components/SpacesScreen.ts` — implementation actuelle (a remplacer)
- `packages/maestro-code/tests/SpacesScreen.test.ts` — tests existants (a adapter)
- `apps/backend/src/Maestro.Api/Controllers/SessionsController.cs` — API sessions

---

## Ce que cette sous-phase fait

### 1. Retirer les enfants de la liste principale

Dans `buildSessionDisplayList` :
- Filtrer les sessions avec `parentSessionId` — elles ne sont PAS dans la liste
- La liste ne contient que les sessions top-level (parents + sessions sans enfants)
- Le compteur affiche le nombre de sessions top-level, pas le total

Resultat : la liste est plate, simple, sans tree connectors. Tous les problemes de rendu disparaissent.

### 2. Montrer les enfants dans le detail view

Quand un parent est selectionne et expand (Enter), le detail view montre :
```
→ ▼ ○ Block Forge - visual test      69ff99a4  idle    $0.04  0ms
     id: 69ff99a4-...
     children:
       ○ agent-creator    6507d503  idle  $0.00  -
       ○ test-designer    79a1153a  idle  $0.04  45s
     fitness: ░░░░░░░░░░░░ 0%
     entry: default, create, analyze

  ○ Normal session                    45fffd0a  created  $0.00  -
  ○ Block Forge - code-reviewer       683fc3a7  idle     $0.43  0ms
```

Les enfants sont une simple liste dans le detail, pas des items navigables. Pour voir les details d'un enfant, l'utilisateur appuie Enter sur l'enfant → navigue vers cette session (elle devient le contexte principal et on voit ses propres enfants si elle en a).

### 3. Navigation dans les enfants du detail

Quand le detail d'un parent est expand et qu'il a des enfants :
- Les enfants sont affiches comme une sous-liste statique (pas de j/k pour naviguer entre eux)
- Enter sur le parent ouvre le detail view (toggle expand)
- Un raccourci (ex: Enter a nouveau ou un numero) permet de naviguer vers un enfant specifique

Alternative plus simple pour V1 : les enfants dans le detail sont juste informatifs (nom, ID, cout, duree). Pour voir les details d'un enfant, l'utilisateur va dans la barre d'input et tape le session ID. Ou on ajoute un lien navigable plus tard.

### 4. Indicateur parent dans la liste

Les sessions qui ont des enfants montrent un badge `(2)` ou `+2` a cote du nom pour indiquer qu'il y a des enfants :
```
  ○ Block Forge - visual test [+2]    69ff99a4  idle    $0.04  0ms
```

### 5. Retirer le fitness de la liste des sessions

Le `fit: 0%` dans la ligne de session n'a pas de sens — le fitness mesure la qualite d'un block contre un contract, pas la qualite d'une session. Il s'affiche sur TOUTES les sessions meme celles qui n'ont rien a voir avec la creation de blocks.

- Retirer `fit: X%` de `SessionRow`
- Si la session a une variable `fitness` ou `currentFitness`, l'afficher dans le **detail view** (expand) seulement
- La ligne de session devient : `statut  $cout  duree`
- Plus de colonne `fit:` ni de barre de progression dans la liste

Resultat :
```
  ○ Block Forge - visual test [+2]  69ff99a4  idle    $0.04  4m 30s
  ○ Normal session                  45fffd0a  created  $0.00  -
```

### 6. API endpoint enfants

Verifier que `GET /api/sessions?parentId={id}` fonctionne (deja implemente en 59-D). Le TUI l'utilise pour charger les enfants uniquement quand le parent est expand.

Alternativement, puisque `listSessions()` retourne deja toutes les sessions avec `parentSessionId`, on peut filtrer cote client sans appel API supplementaire.

### 6. Supprimer le code tree

- Supprimer `DisplayItem` interface (plus besoin de `isChild`, `treePrefix`, etc.)
- Supprimer `buildSessionDisplayList` (revenir a un simple filtre `sessions.filter(s => !s.parentSessionId)`)
- Supprimer les props tree de `SessionRow` (`isChild`, `treePrefix`, `parentId`, `parentName`)
- Simplifier `SessionRow` : un seul mode de rendu, pas de branchement parent/enfant

### 7. Profondeur N via navigation

Si un enfant a ses propres enfants (profondeur > 2) :
- L'utilisateur voit le parent avec ses enfants directs dans le detail
- Pour explorer un enfant, il navigue vers cette session (Enter sur le nom dans le detail, ou via search)
- Cette session enfant devient le contexte et montre SES enfants dans SON detail
- Comme un explorateur de fichiers : on entre dans un dossier pour voir son contenu

---

## Fichiers a modifier

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/components/SpacesScreen.ts` | Refactorer : supprimer tree, enfants dans detail view, badge [+N] |
| `packages/maestro-code/tests/SpacesScreen.test.ts` | Adapter : tests pour le nouveau modele (filtrage enfants, detail view) |

---

## Verification

```bash
# Type check
cd C:\Meastro\packages\maestro-code && npx tsc --noEmit
# 0 erreurs

# Tests
cd C:\Meastro\packages\maestro-code && npx vitest run tests/SpacesScreen.test.ts
# Tous passent

# Tests complets
cd C:\Meastro\packages\maestro-code && npx vitest run
# Pas de regression

# Verification visuelle OBLIGATOIRE via MCP tui-dogfood :
# 1. Spawn real mode
# 2. Naviguer vers Spaces
# 3. Verifier : liste plate, pas de tree connectors, pas de blank lines
# 4. Selectionner un parent → Enter → detail montre les enfants
# 5. Navigation j/k fluide sans items invisibles
# 6. Verifier sur 5+ sessions differentes (parents, enfants, sessions normales)
```

---

## Anti-patterns

- Ne PAS remettre les enfants dans la liste principale — c'est exactement ce qui causait les bugs
- Ne PAS utiliser de tree connectors (├─/└─) dans la liste — ils sont la source des problemes d'alignement
- Ne PAS rendre les enfants navigables par j/k dans le detail — ils sont informatifs seulement
- Ne PAS charger les enfants pour CHAQUE session a chaque render — filtrer depuis la liste existante

---

## Checkpoint

```markdown
## 59-E : SpacesScreen refonte
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Liste plate** : pas de tree connectors, seulement sessions top-level
**Detail enfants** : enfants visibles dans le detail view du parent
**Badge [+N]** : visible pour les parents
**Navigation j/k** : fluide, pas d'items invisibles
**Blank lines** : aucune
**Type check** : 0 erreurs
**Tests** : tous passent
**Verification visuelle** : validee via MCP (5+ sessions testees)
```
