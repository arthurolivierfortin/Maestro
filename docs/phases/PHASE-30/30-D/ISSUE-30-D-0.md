# Issue 30-D-0 : Verifier/adapter le template foundry pour les agents

**Statut** : A faire
**Estimation** : 1-2 heures
**Bloquant** : **OUI — bloque 30-D-2 et 30-D-3**
**Prerequis** : 30-C-5 (composite stable)

---

## Description

Le template `foundry-default` a ete concu et valide pour les blocs inference simples (gen-commit). Les agents (project-preparer, task-planner, implement-single-step, test-executor, git-committer) sont des blocs plus complexes qui interagissent avec le filesystem via des tools.

**Probleme** : Rien ne garantit que le template foundry-default fonctionne pour les agents. L'analyse V3 (section 5.3) identifiait ce gap.

**Ce qui pourrait ne pas fonctionner** :
- Les phases creation/optimisation sont concues pour des blocs qui produisent du texte/JSON. Un agent qui cree des fichiers a un output different.
- Les criteres de fitness (`hasRequiredFields`, `qualityCriteria`) sont bases sur la validation JSON de la sortie. Un agent a des criteres differents (fichier cree ? type check passe ?).
- Le flow d'entrainement (generer → evaluer → optimiser le prompt) suppose un bloc sans effets de bord. Un agent modifie le filesystem.

---

## Tache detaillee

### 1. Tester le template foundry-default avec un agent simple

```bash
cd maestro-cli

# Creer une session foundry pour git-committer (l'agent le plus simple)
node index.js session create --type foundry --name "Foundry git-committer test" --start

# Importer le template
node index.js session import-template <id> foundry-default

# Lancer le monitor
powershell.exe -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd C:\Meastro\maestro-cli; node index.js monitor <id>'"

# Invoquer l'entree start
node index.js session invoke <id> start
```

### 2. Observer ce qui se passe

| Attendu | Si ca ne fonctionne pas |
|---------|------------------------|
| Phase creation : l'agent s'execute | Le template essaie de "generer" un output, pas d'executer un agent |
| Phase evaluation : fitness mesure | Les criteres de fitness sont inadaptes (JSON fields vs fichier cree) |
| Phase optimisation : prompt ameliore | L'optimiseur ne sait pas comment ameliorer un system-prompt d'agent |

### 3. Si le template fonctionne : documenter pourquoi

Ecrire dans `docs/phases/PHASE-30/FOUNDRY-AGENTS-VALIDATION.md` pourquoi ca marche et les limites.

### 4. Si le template NE fonctionne PAS : adapter

**Option A — Generaliser foundry-default** (recommandee) :
- Rendre les `qualityCriteria` et `evaluationCriteria` configurables via les variables de session
- La session de foundry recoit les criteres specifiques au bloc via `_workflowConfig`
- Le template reste le meme pour tous les types de blocs

**Option B — Creer foundry-agent** :
- Un template specialise pour les agents avec des phases adaptees :
  1. **Configuration** : system prompt + model
  2. **Scenario testing** : executer l'agent sur N scenarios predetermines dans un sandbox
  3. **Evaluation** : mesurer la qualite (fitness composite : output correct + fichiers crees + pas d'erreurs)
  4. **Optimisation** : ajuster le system prompt
  5. **Publication** : publier quand fitness >= seuil

**Decision** : Tester Option A d'abord. Creer Option B seulement si A est insuffisante.

---

## Criteres de fitness par type de bloc

Les criteres de 30-D-2 doivent etre traduits en `evaluationCriteria` JSON concrets :

| Bloc | Type | Criteres de fitness |
|------|------|-------------------|
| project-preparer | agent | JSON valide, stack detecte correctement, docs crees, pas d'erreur |
| task-planner | agent | JSON array valide, steps ordonnees, dependances correctes, domaines separes |
| implement-single-step | agent | Fichier cree/modifie, code compile (type check), suit les conventions |
| test-executor | agent | Framework detecte, tests executes, resultats parses correctement |
| code-reviewer | inference | JSON valide, score coherent, issues actionnables |
| git-committer | agent | Commit cree, message conventionnel, stage selectif (pas git add .) |

---

## Critere de completion

- [ ] Le template foundry-default est teste avec au moins un agent (git-committer)
- [ ] Le resultat est documente : fonctionne / ne fonctionne pas / partiellement
- [ ] Si adaptation necessaire : les modifications sont implementees
- [ ] Les criteres de fitness pour chaque type de bloc sont definis en format JSON
- [ ] `dotnet build` compile sans erreur (si modification backend)

---

## Risques

- **Risque** : Le template foundry utilise des phases qui ne sont pas compatibles avec les agents
- **Mitigation** : Tester avec l'agent le plus simple d'abord (git-committer), puis generaliser
- **Risque** : L'adaptation du template est un gros chantier qui retarde 30-D
- **Mitigation** : Si l'adaptation prend > 2h, simplifier : mesurer le fitness manuellement (via les tests 30-C/30-E) et reporter la foundry automatisee a une phase ulterieure
