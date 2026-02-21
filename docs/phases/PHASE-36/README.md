# Phase 36 : Contexte, Memoire et Documentation

**Statut** : A faire
**Prerequis** : Phase 35 COMPLETE (dogfooding stabilise, agent > 75% succes)
**Objectif** : Formaliser la conversation, le contexte et la memoire comme des blocs first-class, et implementer la documentation attachee aux entites Maestro.

---

## Probleme

Aujourd'hui, la gestion du contexte viole la philosophie Maestro "Everything is a block" :

- La **conversation** est geree par `IConversationManager` (extrait en 34-E-PRE) mais n'est pas encore un bloc composable
- Le **contexte** est assemble par `IContextAssembler` mais pas configurable comme un bloc
- La **memoire** n'existe pas — aucun mecanisme de connaissances persistantes entre executions
- La **documentation** n'est pas attachee aux blocs — le savoir genere en foundry (modeles testes, fitness, iterations) disparait

L'optimisation du contexte est une des cles de performance de Maestro : un petit LLM avec le bon contexte bat un gros LLM avec un contexte pollue. Sans blocs formels, cette optimisation est impossible a observer, configurer, et ameliorer.

---

## Architecture cible

```
Memory Block(s)     ──┐
  (connaissances       │
   persistantes)       │
                       ├──→  Context Block  ──→  Inference Block
Conversation Block  ──┘     (assembleur          (appel LLM)
  (historique de             final)
   messages)

Documentation ──→ attachee aux blocs, sessions, index global
```

### 4 axes de cette phase

| Axe | Type | Responsabilite |
|-----|------|---------------|
| Conversation Block | Stateful | Stocker, organiser, persister les messages d'une execution |
| Context Block | Stateless | Assembler et optimiser le contexte final pour le LLM |
| Memory Block | Stateful | Stocker des connaissances durables entre sessions |
| Documentation attachee | Content | Documenter les blocs, sessions et recherche |

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 36-A | Conversation Block — formalisation depuis IConversationManager | 3-5 jours |
| 36-B | Context Block — formalisation depuis IContextAssembler | 2-3 jours |
| 36-C | Memory Block — connaissances persistantes | 5-8 jours |
| 36-D | Documentation attachee — companion files, RESEARCH.md auto, index global | 5-8 jours |
| 36-E | TUI Context Panel — observabilite en temps reel | 3-5 jours |

---

## 36-A : Conversation Block

### Lecture obligatoire
- `apps/backend/src/Maestro.Application/Interfaces/IConversationManager.cs` — interface existante
- `apps/backend/src/Maestro.Infrastructure/Context/InMemoryConversationManager.cs` — implementation actuelle
- `apps/backend/src/Maestro.Domain/Entities/Conversation.cs` — entite existante
- `apps/backend/src/Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` — consommateur

### Ce que cette sous-phase fait

1. Transformer `IConversationManager` en bloc formel (type `conversation`)
2. Le conversation block gere les sections (system, history), token counts, truncation
3. L'etat de la conversation est expose comme session variable `_conversation_{id}`
4. Creer le `ConversationBlockExecutor` dans `BlockExecutors/`
5. Refactorer `AgentBlockExecutor` pour utiliser le bloc au lieu du service directement

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `content/system/blocks/infrastructure/conversation.block.json` | Creer — definition du bloc conversation |
| `Maestro.Infrastructure/BlockExecutors/ConversationBlockExecutor.cs` | Creer — executor |
| `Maestro.Infrastructure/BlockExecutors/AgentBlockExecutor.cs` | Modifier — utiliser le bloc |
| `Maestro.Api/Program.cs` | Modifier — enregistrer le nouveau executor |

### Anti-patterns
- Ne PAS persister les conversations sur disque dans cette sous-phase — en memoire suffit
- Ne PAS ajouter de logique de truncation dans la conversation — c'est le role du context block

### Checkpoint
```markdown
## 36-A : Conversation Block
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Bloc cree** : conversation.block.json
**Tests** : [nombre]
**AgentBlockExecutor refactore** : OUI/NON
```

---

## 36-B : Context Block

### Lecture obligatoire
- `apps/backend/src/Maestro.Application/Interfaces/IContextAssembler.cs` — interface existante
- `apps/backend/src/Maestro.Infrastructure/Context/ContextAssembler.cs` — implementation actuelle

### Ce que cette sous-phase fait

1. Transformer `IContextAssembler` en bloc formel (type `context`)
2. Le context block prend en entree : messages de conversation + config
3. Il produit en sortie : messages optimises prets pour le LLM
4. L'interface accepte des sources multiples (conversation + memory dans 36-C)
5. Refactorer `AgentBlockExecutor` : utiliser le context block au lieu de `contextAssembler.AssembleAsync()`

### Anti-patterns
- Ne PAS supprimer IContextAssembler — le context block l'utilise en interne
- Ne PAS hardcoder les sources (conversation only) — l'interface doit supporter N sources

### Checkpoint
```markdown
## 36-B : Context Block
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Bloc cree** : context.block.json
**Sources supportees** : [liste]
```

---

## 36-C : Memory Block

### Ce que cette sous-phase fait

1. Creer l'entite `MemoryStore` — connaissances persistantes organisees par categorie
2. Creer `IMemoryManager` — CRUD sur les memories
3. Creer `MemoryBlockExecutor` (type `memory`)
4. Les memories sont persistees sur disque (comme les blocks)
5. Integrer les memories dans le context block (source additionnelle)
6. Les agents peuvent ecrire dans leurs memories (apprentissage)

### Structure d'une memory

```json
{
  "id": "agent-implement-step-memory",
  "category": "coding-patterns",
  "entries": [
    {
      "key": "typescript-imports",
      "content": "Always use named imports, never default imports",
      "confidence": 0.95,
      "source": "foundry-session-abc123",
      "lastUsed": "2026-02-20T10:00:00Z"
    }
  ]
}
```

### Anti-patterns
- Ne PAS implementer de RAG/embeddings dans cette sous-phase — recherche par categorie/cle suffit
- Ne PAS coupler les memories a un agent specifique — elles sont des blocs reutilisables

### Checkpoint
```markdown
## 36-C : Memory Block
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Persistence** : disque / en memoire
**Integration context block** : OUI/NON
**Agents peuvent ecrire** : OUI/NON
```

---

## 36-D : Documentation attachee

### Lecture obligatoire
- `docs/TODOS/FEATURE-attached-docs.md` — specification complete de la feature

### Ce que cette sous-phase fait

1. Ajouter `metadata.docs` (dictionnaire de chemins relatifs) a `BlockDefinition`
2. Supporter les companion files (`docs/README.md`, `RESEARCH.md`, `CHANGELOG.md`, `FITNESS.md`) par bloc
3. Scanner les `docs/` companions dans `FileSystemBlockDiscoveryService`
4. Inclure `docs/` dans le package quand un bloc est publie
5. Auto-generer `RESEARCH.md` depuis les donnees de foundry session (fitness scores, modeles testes)
6. Ajouter la variable `_docs` pour les sessions
7. Creer l'index global `.maestro/docs/` avec generation automatique depuis les tags
8. CLI : `maestro docs show/edit/search/index/add`

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `Maestro.Domain/Entities/BlockDefinition.cs` | Modifier — ajouter `Metadata.Docs` |
| `Maestro.Application/DTOs/BlockDto.cs` | Modifier — mapper `Metadata.Docs` |
| `Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs` | Modifier — scanner companion docs |
| `Maestro.Api/Controllers/BlocksController.cs` | Modifier — endpoint `GET /api/blocks/{id}/docs/{name}` |
| `packages/maestro-cli/cli.ts` | Modifier — commandes `docs show/edit/search/index` |

### Anti-patterns
- Ne PAS creer un type de bloc "doc" — la documentation est du contenu attache, pas un bloc
- Ne PAS hardcoder les noms de fichiers docs — `metadata.docs` est un dictionnaire libre
- Ne PAS forcer la documentation — elle est optionnelle pour chaque bloc

### Checkpoint
```markdown
## 36-D : Documentation attachee
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**metadata.docs dans BlockDefinition** : OUI/NON
**Companion files scannes** : OUI/NON
**RESEARCH.md auto-genere** : OUI/NON
**CLI docs show/search** : OUI/NON
**Index global** : OUI/NON
```

---

## 36-E : TUI Context Panel

### Ce que cette sous-phase fait

1. Widget `context-panel` dans le monitor
2. Affiche en temps reel : sections de la conversation, token counts, strategie, truncation
3. Affiche les memories actives pour l'agent en cours
4. Utilise les session variables `_conversation_{id}` et `_contextState`

### Anti-patterns
- Ne PAS ajouter de logique metier dans le TUI — lecture seule des session variables
- Ne PAS creer un nouveau endpoint API — utiliser les variables de session existantes

### Checkpoint
```markdown
## 36-E : TUI Context Panel
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Widget cree** : OUI/NON
**Conversation affichee** : OUI/NON
**Memories affichees** : OUI/NON
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-36/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 36 : Conversation, Context, Memory sont des blocs first-class. Documentation attachee aux blocs."
- Ajouter : "TUI context-panel widget disponible"
- Retirer : "Context = IContextProcessor interne a AgentBlockExecutor"

---

## Criteres de completion

- [ ] La conversation est un bloc observable (pas une List<ChatMessage> locale)
- [ ] Le context block assemble depuis conversation + memories
- [ ] Les memories sont persistees et reutilisables entre sessions
- [ ] Les blocs publies contiennent leurs companion docs
- [ ] `maestro docs show <block-id>` affiche le README du bloc
- [ ] `maestro docs search` trouve des resultats dans toute la doc
- [ ] La publication depuis foundry genere automatiquement un RESEARCH.md
- [ ] Le TUI panel montre le contexte en temps reel
