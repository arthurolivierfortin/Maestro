# Feature : Documentation attachee aux entites Maestro

**Statut** : Planifie
**Priorite** : Haute
**Contexte** : Maestro vise a devenir l'encyclopedie centrale pour la construction d'agents autonomes. Les utilisateurs doivent pouvoir documenter leur recherche, leurs decisions et leurs resultats, et ce savoir doit voyager avec les entites publiees.

## Probleme

Aujourd'hui la documentation est deconnectee des entites :

- Un block a `metadata.description` (une ligne) — insuffisant
- Le savoir genere en foundry session (modeles testes, fitness, iterations) disparait quand la session finit
- Les connaissances ("SmolLM2 echoue sur JSON, Qwen2.5-Coder reussit a 87%") vivent dans la tete de l'utilisateur ou dans des repos externes
- Quand quelqu'un importe un block publie, il ne sait pas *pourquoi* il a ete concu ainsi
- La seule facon de documenter est de creer un repo pour workspaces/sessions et d'y ecrire la doc manuellement

## Proposition

### 1. Documentation block-level (companion files)

Chaque block peut avoir des fichiers markdown compagnons references dans `metadata.docs` :

```jsonc
// mon-agent.block.json
{
  "metadata": {
    "description": "Agent de code review specialise Python",
    "version": "1.2.0",
    "docs": {
      "readme": "docs/README.md",
      "research": "docs/RESEARCH.md",
      "changelog": "docs/CHANGELOG.md",
      "fitness": "docs/FITNESS.md"
    }
  }
}
```

Structure sur disque :

```
content/system/blocks/
  mon-agent.block.json
  mon-agent/
    system-prompt.md              # existe deja
    docs/
      README.md                   # Usage, exemples, limitations
      RESEARCH.md                 # Journal de recherche
      CHANGELOG.md                # Historique des versions
      FITNESS.md                  # Donnees de performance par modele
```

Les chemins dans `metadata.docs` sont relatifs au dossier du block.

### 2. Research trail automatique (foundry sessions)

Quand un block est **publie** depuis une foundry session, le systeme extrait automatiquement un resume de recherche a partir des donnees de session (fitness scores, modeles testes, iterations).

Exemple de `RESEARCH.md` auto-genere :

```markdown
## Research Summary
Generated from foundry session "Cantante - Code Review Agent"

### Models Tested
| Model | Fitness | Notes |
|-------|---------|-------|
| SmolLM2-1.7B | 0.23 | Cannot follow JSON format |
| Qwen2.5-Coder-7B | 0.87 | Best fit, fast |
| Claude Sonnet | 0.94 | Excellent but expensive |

### Iterations
- v1: Basic prompt -> 0.45 fitness (missed edge cases)
- v2: Added few-shot examples -> 0.72
- v3: Structured output format -> 0.87 (published)

### Key Findings
- Few-shot examples critical for small models
- JSON mode unreliable below 7B parameters
```

Ce fichier est auto-genere mais editable par l'utilisateur apres generation.

### 3. Session-level documentation

Deux mecanismes :

**a) Variable `_docs`** pour les notes en cours de session :

```jsonc
{
  "_docs": {
    "objective": "Explorer l'efficacite des agents de code review sur des projets Python",
    "notes": [
      { "time": "2026-02-20T14:30", "text": "Le modele local ne gere pas les imports relatifs" },
      { "time": "2026-02-20T15:00", "text": "Ajout d'un pre-traitement pour resoudre les imports" }
    ],
    "conclusions": "..."
  }
}
```

**b) Companion files** pour la documentation finale de session :

```
.maestro/sessions/<id>/
  session.json
  docs/
    README.md
    DECISIONS.md
```

### 4. Documentation globale (index/wiki)

Un index global qui agregue et lie toute la documentation :

```
.maestro/
  docs/
    index.md                      # Table des matieres auto-generee
    guides/                       # Guides ecrits par l'utilisateur
      how-to-code-review.md
      model-selection-guide.md
    topics/                       # Pages thematiques
      json-format-agents.md
      python-tools.md
```

L'index est **auto-genere** a partir des `metadata.tags` des blocks publies. L'utilisateur peut aussi ecrire des guides qui referent des blocks via un schema de liens :

```markdown
Ce guide utilise :
- [`code-review-agent@1.2.0`](maestro://blocks/code-review-agent) — Fitness: 0.87
- [`python-linter@2.0.0`](maestro://blocks/python-linter) — Fitness: 0.92

Voir la [recherche](maestro://blocks/code-review-agent/docs/RESEARCH.md)
```

Le schema `maestro://` permet de lier des entites Maestro de facon stable (independant du chemin sur disque).

### 5. Commandes CLI

```bash
# Documentation d'un block
maestro docs show <block-id>                # Affiche le README
maestro docs show <block-id> --research     # Affiche le RESEARCH.md
maestro docs edit <block-id>                # Ouvre l'editeur
maestro docs add <block-id> note "..."      # Ajoute une note de recherche

# Documentation d'une session
maestro session docs <id>                   # Affiche la doc de session
maestro session docs <id> --add-note "..."  # Ajoute une note

# Documentation globale
maestro docs index                          # Genere/affiche l'index global
maestro docs search "json format"           # Recherche full-text dans toute la doc
```

## Changements requis dans l'infrastructure

| Composant | Changement |
|-----------|-----------|
| `BlockDefinition` (Domain) | Ajouter `Metadata.Docs` — `Dictionary<string, string>` de chemins relatifs |
| `BlockDto` (Application) | Mapper `Metadata.Docs` dans `FromDomain` |
| `FileSystemBlockDiscoveryService` | Scanner les `docs/` companions lors de la decouverte |
| Publishing system | Inclure `docs/` dans le package publie |
| Foundry session (publish flow) | Generer `RESEARCH.md` automatiquement a partir des donnees de fitness |
| CLI | Commandes `docs show/edit/search/index/add` |
| API | Endpoint `GET /api/blocks/{id}/docs/{name}` pour servir les fichiers doc |
| Session repository | Support des companion files `docs/` par session |

## Ce qui ne change PAS

- Le principe "everything is a block" : la documentation n'est **pas** un block. C'est du **contenu attache** a un block, comme `system-prompt.md` l'est deja
- L'infrastructure reste generique : les commandes CLI sont `docs show <entity-id>`, pas `docs show-agent` ou `docs show-workflow`
- Le publishing reste le meme mecanisme, enrichi avec les fichiers doc

## Criteres de validation

- [ ] Un block publie contient ses fichiers `docs/` dans le package
- [ ] Un block importe contient les docs de son auteur
- [ ] `maestro docs show <block-id>` affiche le README du block
- [ ] `maestro docs search "terme"` trouve des resultats dans la doc de tous les blocks
- [ ] La publication depuis une foundry session genere automatiquement un `RESEARCH.md`
- [ ] `maestro docs index` genere un index navigable de toute la doc
- [ ] Les liens `maestro://` sont resolus correctement dans la doc
- [ ] La doc d'une session est preservee et consultable apres la fin de la session

## Vision a long terme

Ce systeme fait de Maestro une **encyclopedie vivante** :

1. Chaque block publie raconte son histoire (modeles testes, fitness, iterations)
2. Le savoir est capture automatiquement via les foundry sessions
3. Le savoir est consultable et cherchable
4. Le savoir voyage avec les blocks partages/importes
5. Les utilisateurs construisent sur le travail des autres : importer un block = recevoir tout le contexte de recherche
6. La documentation est un citoyen de premiere classe, pas un afterthought
