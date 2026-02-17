# Issue 33-B-1 : Agent Creator — agent qui cree des agents

**Statut** : A faire — plan detaille a creer apres Phase 32
**Estimation** : 2-3 sessions
**Prerequis** : Phase 32 complete, experience concrete de creation manuelle d'agents

---

## Description

L'Agent Creator est un meta-agent qui prend une description de tache et cree un nouvel agent composite, en suivant le meme processus que la Phase 30 a utilise manuellement.

---

## Concept

```bash
maestro create-agent --description "An agent that translates documentation between languages"
```

L'Agent Creator :
1. **Analyse la tache** : identifier les sous-taches, les competences requises
2. **Decompose en blocs** : chaque sous-tache = un bloc (agent ou inference)
3. **Cree les system prompts** : pour chaque bloc, ecrire un system prompt specifique
4. **Assemble le workflow** : creer le .block.json composite avec config.nodes
5. **Teste** : executer le workflow sur des scenarios de test
6. **Itere** : ajuster les prompts en fonction des resultats
7. **Publie** : quand le fitness est suffisant

### Ce que l'Agent Creator connait

- La philosophie Maestro (specialisation, composition, blocs)
- Le format .block.json
- Les types de noeuds (regular, for-each, conditional, phase)
- Les tools disponibles (file-read, file-write, shell-execute, etc.)
- Les patterns de bons system prompts (exemples des blocs existants)

### Ce que l'Agent Creator produit

1. Les fichiers .block.json pour chaque sous-bloc
2. Les system-prompt.md pour chaque sous-bloc
3. Le .block.json du workflow composite
4. Des scenarios de test
5. Un rapport de fitness

---

## Architecture

```
agent-creator (workflow composite)
│
├── analyze-request (inference, Opus)
│   → Comprend la tache, identifie les sous-taches
│
├── design-architecture (inference, Opus)
│   → Decide la structure du workflow, les blocs necessaires
│
├── for-each bloc a creer :
│   ├── generate-block (agent, Sonnet)
│   │   → Cree le .block.json et le system-prompt.md
│   │
│   └── test-block (agent, Sonnet)
│       → Teste le bloc individuellement
│
├── assemble-workflow (agent, Sonnet)
│   → Cree le .block.json du composite
│
├── test-workflow (agent, Sonnet)
│   → Teste le composite sur des scenarios
│
└── publish (agent, Haiku)
    → Publie si fitness >= seuil
```

---

## Critere de completion

- [ ] L'Agent Creator cree un agent fonctionnel a partir d'une description
- [ ] L'agent cree passe les tests de fitness (>= 0.75)
- [ ] Le processus est entierement automatique (pas d'intervention manuelle)
- [ ] Le workflow cree suit la philosophie Maestro (specialisation, composition)
- [ ] L'Agent Creator est lui-meme un workflow Maestro (mange sa propre nourriture)

---

## Risques

- **Risque majeur** : Le meta-agent produit des agents de mauvaise qualite
- **Mitigation** : Les scenarios de test et le fitness seuil empechent la publication d'agents mediocres
- **Risque** : La recursion (agent qui cree des agents) est instable
- **Mitigation** : Limiter la profondeur de recursion, monitorer les couts
