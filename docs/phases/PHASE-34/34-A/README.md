# Phase 34-A : Design Spec — AGENT-V4-SPEC.md

**Statut** : A faire
**Prerequis** : AGENT-REQUEST.md lu et valide
**Objectif** : Produire le document de conception detaille complet de l'Agent Maestro v4, du bloc parent (workflow orchestrateur) jusqu'au bloc atomique le plus petit.

---

## Lecture obligatoire [OBLIGATOIRE]

| Fichier | Pourquoi le lire |
|---------|-----------------|
| `docs/phases/PHASE-34/AGENT-REQUEST.md` | Le document d'analyse et de recherche — contient les instructions precises pour ce que le spec doit contenir (section 8) |
| `docs/phases/PHASE-34/request.md` | La requete originale du createur — comprendre l'intention |
| `CLAUDE.md` | Regles architecturales (tout est un bloc, generique vs specifique, agent = inference block) |
| `docs/system/philosophy/MAESTRO-PHILOSOPHY-V2.md` | Formule fitness, architecture hybride, principes de design |
| `docs/system/architecture/DESIGN-CONTROL-FLOW-BLOCKS.md` | Blocks while, for-each, decision, parallel — ce qui est deja supporte |
| `docs/phases/PHASE-28/PLAN-PHASE-28A.md` | Design complet de l'interaction-handler — classify-intent, state-manager, pause/resume/rewind |
| `docs/phases/PHASE-28/PLAN-PHASE-28B.md` | Widget protocol — types de widgets, communication TUI |
| `apps/backend/src/Maestro.Infrastructure/Sessions/EntryPointExecutor.cs` | Comment while, for-each, conditions sont executes — comprendre les capacites existantes |
| `content/system/blocks/agents/` | Blocs agents existants — comprendre le format, les system prompts, les conventions |
| `content/system/blocks/workflows/autonomous-development/` | Le workflow v3.1 existant — point de depart |
| `content/system/blocks/tools/` | Blocs tool existants — comprendre le format |
| `content/system/templates/sessions/project-autonomous.session.json` | Le template session existant — comprendre les variables, entry points, monitor descriptor |

---

## Ce que cette sous-phase fait [OBLIGATOIRE]

### Etape 1 : Lire TOUS les documents de reference
- Lire chaque fichier ci-dessus INTEGRALEMENT
- Ne PAS sauter, meme si ca semble familier
- Noter les patterns, formats, et conventions decouverts

### Etape 2 : Recherche web complementaire
- Rechercher l'etat de l'art des agents de dev autonomes (fevrier 2026)
- Chercher les best practices pour : verification visuelle par LLM, interaction multi-agent, Playwright automation
- Documenter les sources

### Etape 3 : Concevoir l'interaction-handler (COMPOSANT LE PLUS CRITIQUE)
En se basant sur `PLAN-PHASE-28A.md` et `AGENT-REQUEST.md` section 5.4 :
- Definir la structure complete du bloc (agent composite, `isAtomic: false`)
- Detailler ses 4 noeuds internes : classify-intent, decide-action, execute-action, send-response
- Definir le state-manager tool avec toutes ses operations (get, set, transition, pause, resume, rewind, inject)
- Definir le widget protocol (types de widgets, format de communication)
- Expliquer comment il se connecte au workflow principal en parallele

### Etape 4 : Concevoir chaque bloc specialiste
Pour CHAQUE bloc de l'architecture v4 (voir `AGENT-REQUEST.md` section 5.2), produire :
- **ID** : identifiant unique (kebab-case)
- **Type** : agent | inference | tool | workflow
- **Version** : semver
- **System prompt complet** : pas un placeholder, le texte reel du prompt
- **Modele recommande Tier 1** : Opus ou Sonnet, avec justification
- **Inputs/Outputs** : format JSON avec types
- **Outils disponibles** : quels blocks tool il peut invoquer via CLI
- **Criteres fitness** : comment P, S, W sont mesures concretement pour ce bloc
- **Anti-patterns** : ce que ce bloc ne doit PAS faire (minimum 3)

### Etape 5 : Concevoir le workflow orchestrateur
- L'ordre d'execution exact (sequence de noeuds)
- Les conditions de branchement (`decision` blocks)
- La boucle d'iteration (`while` block — condition, maxIterations)
- Le for-each pour les steps d'implementation
- Le checkpointing a chaque noeud
- Le JSON conceptuel complet du workflow (`config.nodes`)

### Etape 6 : Documenter les blocks tool a creer
Pour chaque nouveau tool block :
- `playwright-screenshot` : prend un screenshot d'une URL, retourne une image
- `playwright-accessibility` : lit l'arbre d'accessibilite d'une page
- `web-search` : recherche web, retourne les resultats pertinents
- `compilation-check` : build le projet (npm/dotnet/cargo), reporte les erreurs
- `memory-read` / `memory-write` : lire/ecrire dans `.maestro/memory/`
- Chaque tool doit etre un block generique, invocable par n'importe quel agent via CLI

### Etape 7 : Documenter les criteres fitness
Appliquer la formule Philosophy V2 (`P x S x W / (C_norm x C_compute x C_hw)^lambda`) a chaque bloc :
- Comment P est mesure (quels tests, quels criteres)
- Comment S est mesure (quelle specialisation)
- Comment W est mesure (quel format de sortie, quel taux d'hallucination)
- Seuils acceptables par bloc

### Etape 8 : Documenter les dependances techniques
- Ce qui existe deja dans Maestro (lister concretement)
- Ce qui doit etre ajoute/modifie dans le backend (EntryPointExecutor, etc.)
- Ce qui doit etre ajoute/modifie dans le CLI
- Ce qui doit etre ajoute/modifie dans `maestro code`
- Prerequis externes (Playwright, etc.)

### Etape 9 : Plan de tests
- Comment tester que l'agent v4 > Claude Code brut
- Cas de test specifiques (au moins 5 projets/taches de complexite variee)
- Criteres objectifs de comparaison

---

## Fichiers a modifier/creer [OBLIGATOIRE]

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-34/34-A/AGENT-V4-SPEC.md` | CREE — Index + 14 fichiers dans spec/ |
| `docs/phases/PHASE-34/34-A/checkpoint.md` | CREE — Checkpoint de progression |

**AUCUN fichier de code ne doit etre modifie dans cette sous-phase.** C'est un travail de DESIGN uniquement.

---

## Verification [OBLIGATOIRE]

```bash
# Verification 1 : Le fichier AGENT-V4-SPEC.md existe
powershell.exe -Command "Test-Path C:\Meastro\docs\phases\PHASE-34\AGENT-V4-SPEC.md"
# Resultat attendu : True

# Verification 2 : Le document couvre les 9 sections requises
# Verifier manuellement que AGENT-V4-SPEC.md contient :
# 1. Vue d'ensemble de l'architecture (incluant interaction-handler + state-manager)
# 2. L'interaction-handler (chapitre complet)
# 3. Chaque specialiste (un chapitre complet par bloc)
# 4. Les blocks tool a creer (Playwright, web-search, etc.)
# 5. Le workflow complet (JSON conceptuel avec while, for-each, decision)
# 6. Les criteres de fitness par bloc (formule V2 appliquee)
# 7. La strategie de memoire persistante
# 8. Les dependances techniques (existe vs a ajouter)
# 9. Plan de tests pour valider agent v4 > Claude Code

# Verification 3 : Chaque bloc specialiste a un system prompt complet (pas de placeholder)
# grep pour "TODO" ou "placeholder" ou "a completer" dans AGENT-V4-SPEC.md
powershell.exe -Command "Select-String -Path C:\Meastro\docs\phases\PHASE-34\AGENT-V4-SPEC.md -Pattern 'TODO|placeholder|a completer|TBD' -CaseSensitive:$false"
# Resultat attendu : Aucun match

# Verification 4 : Le JSON conceptuel du workflow est syntaxiquement coherent
# Verifier manuellement que les noeuds referencent des blockRef existants ou planifies
```

---

## Anti-patterns [OBLIGATOIRE]

- Ne PAS ecrire de code (C#, TypeScript, JSON de blocs) — cette phase produit uniquement le document de conception
- Ne PAS faire un agent "correct" — le seuil est "exceptionnellement meilleur que Claude Code brut". Si le design est mediocre, il vaut mieux le refaire
- Ne PAS oublier l'interaction-handler — c'est LA feature differenciante. Il doit avoir un chapitre complet, pas une section de 5 lignes
- Ne PAS utiliser d'outils lies a un provider specifique (plugins Claude Code, fonctions MCP provider-specific) — seulement des outils open-source/generiques (Playwright, Docker, etc.)
- Ne PAS mettre des placeholders dans les system prompts — chaque bloc doit avoir son prompt REEL et COMPLET
- Ne PAS supposer que des outils sont installes — documenter chaque prerequis
- Ne PAS copier-coller les prompts v3.1 sans les ameliorer — c'est une v4, pas un patch
- Ne PAS oublier la verification visuelle — l'agent DOIT pouvoir "voir" le UI qu'il cree

---

## Checkpoint [OBLIGATOIRE]

```markdown
## 34-A : Design Spec — AGENT-V4-SPEC.md
**Statut** : DONE / EN_COURS / BLOQUE
**Date** : YYYY-MM-DD
**Fichier produit** : docs/phases/PHASE-34/AGENT-V4-SPEC.md
**Nombre de blocs concus** : X / Y attendus
**Sections completees** : [liste des 9 sections, cochez celles completees]
**System prompts ecrits** : X / Y blocs avec prompt complet
**Recherche web** : [sources consultees]
**Verification** : [copier le resultat des commandes de verification]
**Problemes** : [si BLOQUE, decrire le probleme exact]
```
