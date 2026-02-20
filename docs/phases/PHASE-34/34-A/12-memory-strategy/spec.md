# 12. Strategie de Memoire Persistante

## Vue d'ensemble

La memoire persistante permet a l'agent Maestro v4 d'accumuler des connaissances au fil des sessions : conventions du projet, patterns decouverts, erreurs corrigees, preferences utilisateur. Contrairement a Claude Code (fichier CLAUDE.md statique), la memoire de Maestro est **dynamique et structuree**.

---

## Structure de la memoire

```
<project-root>/
└── .maestro/
    └── memory/
        ├── index.md          — Fichier principal : resume, liens, derniere MAJ
        ├── conventions.md    — Conventions detectees (naming, imports, patterns)
        ├── architecture.md   — Architecture decouverte (structure, patterns, decisions)
        ├── learnings.md      — Lecons apprises (erreurs, corrections, insights)
        ├── preferences.md    — Preferences utilisateur (style, workflow, outils)
        └── history.md        — Historique des sessions (date, tache, resultat)
```

---

## Types de memoire

Alignes avec les 4 types formalises dans la litterature (Mem0, MemoryOS) :

| Type | Fichier | Contenu | Exemple |
|------|---------|---------|---------|
| **Working** | (en memoire de session) | Contexte de la tache en cours | Plan courant, step actif, resultats intermediaires |
| **Semantic** | `conventions.md`, `architecture.md` | Faits et patterns du projet | "Ce projet utilise Tailwind avec dark mode" |
| **Episodic** | `history.md`, `learnings.md` | Historique et lecons | "Session du 2026-02-19 : ajout module users, 12 steps, score 0.85" |
| **Procedural** | `preferences.md` | Comment faire les choses | "L'utilisateur prefere les commits atomiques" |

---

## Flux de la memoire dans le workflow v4

### En debut de session

```
1. memory-read(file="index.md") → resume global
2. memory-read(file="conventions.md") → conventions connues
3. Injecter dans le contexte du project-analyzer pour enrichir son analyse
4. Si des conventions sont connues, le project-analyzer les confirme/met a jour
```

### Pendant la session

```
1. Le project-analyzer detecte de nouvelles conventions → memory-write si different de ce qui est en memoire
2. Le task-architect fait des design decisions → potentiellement sauvegarder pour reference future
3. Les developers suivent les conventions en memoire (injectees dans leur contexte)
4. Les reviewers verifient la coherence avec les conventions en memoire
```

### En fin de session

```
1. Le summary-reporter genere des "learnings" (patterns decouverts)
2. Si learnings non-vides :
   a. memory-write(file="learnings.md", content=learnings, mode="append")
   b. memory-write(file="history.md", content=sessionSummary, mode="append")
3. Si le project-analyzer a detecte de nouvelles conventions :
   a. memory-write(file="conventions.md", content=updatedConventions, mode="write")
```

---

## Format des fichiers de memoire

### index.md

```markdown
# Project Memory — {project-name}

Last updated: 2026-02-19
Sessions completed: 3
Overall fitness: 0.85

## Quick Reference
- Stack: React 18 + TypeScript + Tailwind + Vite
- Test framework: Vitest + React Testing Library
- CSS: Tailwind with custom theme
- State: Zustand

## Topic Files
- [conventions.md](conventions.md) — Coding conventions
- [architecture.md](architecture.md) — Project architecture
- [learnings.md](learnings.md) — Lessons learned
- [preferences.md](preferences.md) — User preferences
- [history.md](history.md) — Session history
```

### conventions.md

```markdown
# Project Conventions

## Naming
- Files: kebab-case (user-service.ts)
- Components: PascalCase (UserCard.tsx)
- Functions: camelCase (getUserById)
- Constants: UPPER_SNAKE_CASE (API_BASE_URL)

## Imports
- Absolute imports with @/ alias
- Named exports preferred
- Group: external → internal → types → styles

## Code Style
- 2 spaces indentation
- Single quotes
- No semicolons
- Arrow functions preferred
- Explicit return types on exported functions

## React Patterns
- Functional components with hooks
- Custom hooks for all data fetching (useQuery wrapping)
- Error boundaries at route level
- Suspense for lazy loading

## Testing
- Colocated tests: src/components/__tests__/
- describe/it pattern
- React Testing Library: query by role, then text
- Mock external services, not internal modules
```

### learnings.md

```markdown
# Lessons Learned

## 2026-02-19 — User Management Module
- React Query pattern uses custom hooks wrapping useQuery (not raw useQuery in components)
- The project has a custom Button component that accepts variant prop
- API error shape is always { error: string, code: number }
- Tailwind config has custom colors: primary, secondary, accent

## 2026-02-18 — File Tree Component
- The project uses react-dnd for drag and drop
- Tree nodes are recursive, same component renders children
- Performance: useMemo on tree traversal for large trees
```

### preferences.md

```markdown
# User Preferences

## Workflow
- Prefers detailed commit messages with bullet points
- Wants confirmation before rewind operations
- Prefers tabs over spaces (override detected convention)

## Style
- Likes subtle hover animations (scale 1.02, shadow-lg)
- Prefers rounded corners (rounded-lg over rounded-md)
- Dark mode should use slate colors, not gray

## Communication
- Prefers French for summaries
- Wants progress updates every 3 steps
```

---

## Regles de mise a jour de la memoire

### Quand ecrire

| Declencheur | Action | Fichier |
|-------------|--------|---------|
| Fin de session reussie | Append learnings | learnings.md |
| Fin de session reussie | Append session summary | history.md |
| project-analyzer detecte nouvelles conventions | Overwrite | conventions.md |
| Utilisateur exprime une preference via interaction-handler | Append | preferences.md |
| Architecture du projet change significativement | Overwrite | architecture.md |

### Quand NE PAS ecrire

- Session echouee (pas de learnings fiables)
- Learnings generiques ("JavaScript is a language")
- Information deja presente dans la memoire
- Information specifique a la session (pas transferable)

### Conflit avec les conventions existantes

Si le project-analyzer detecte des conventions differentes de celles en memoire :
1. **Ne pas ecraser automatiquement** — les conventions en memoire ont ete validees
2. **Signaler via l'interaction-handler** : "Les conventions detectees different de la memoire. Lesquelles utiliser?"
3. **L'utilisateur decide** → mettre a jour la memoire avec sa decision

---

## Integration avec le state-manager

La memoire persistante (.maestro/memory/) et le state-manager (session variables) sont **deux systemes complementaires** :

| Aspect | State Manager | Memoire persistante |
|--------|---------------|---------------------|
| **Portee** | Session courante uniquement | Toutes les sessions du projet |
| **Duree de vie** | Expire avec la session | Persiste indefiniment |
| **Contenu** | Etat d'execution (plan, resultats, status) | Connaissances (conventions, learnings) |
| **Acces** | Via API session variables | Via file-read/file-write |
| **Concurrence** | Mutex (state-manager) | Pas de concurrence (ecriture sequentielle) |

### Pas de duplication

- Les conventions vont dans la **memoire** (persistent)
- Le plan courant va dans le **state** (ephemere)
- Les resultats intermediaires vont dans le **state** (ephemere)
- Les learnings vont dans la **memoire** (persistent)
