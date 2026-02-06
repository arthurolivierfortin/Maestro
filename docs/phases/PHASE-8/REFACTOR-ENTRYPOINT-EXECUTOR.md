# Refactor: EntryPointExecutor — De Hardcodé à Template-Driven

**Date**: 6 février 2026
**Status**: Implémenté

---

## 1. Problème

`EntryPointExecutor.cs` contenait de la logique spécifique à une session hardcodée
directement dans le code d'infrastructure. Cela violait le principe fondamental de Phase 8 :

> **L'infrastructure est générique. Le contenu est spécifique à la session.**

### Ce qui était hardcodé

| Élément | Emplacement | Impact |
|---------|-------------|--------|
| 4 phases ("Creation", "Optimization", "Validation", "Publish") | `InitializePhases()` | Impossible de changer sans modifier le C# |
| Layout descriptor (left 40%, right 60%, bottom 30%) | `InitializeMonitorDescriptor()` | Un seul layout possible |
| 6 composants TUI fixés | `InitializeMonitorDescriptor()` | Non configurable |
| 4 nœuds de workflow hardcodés | `ExecuteImprovementLoopAsync()` | Ignore les blocks JSON |
| Routing par `workflowId.Contains("...")` | `ExecuteWorkflowAsync()` | 2 workflows max, code requis pour chaque nouveau |
| Commandes git (`git diff --stat`, `git log`) | Step 1 | Spécifique à cette session |
| Prompt LLM | Step 2 | Spécifique à cette session |
| Chemin de sortie (`gen-commit-tool.json`) | Step 3 | Spécifique à cette session |
| Algorithme de fitness (heuristique) | `EvaluateFitness()` | Ne marche que pour gen-commit |
| Contenu fallback | `GenerateFallbackCommitTool()` | Spécifique à gen-commit |

### Test de l'architecture

> **Peut-on créer un nouveau type de session avec UNIQUEMENT des changements JSON ?**

**Avant** : Non. Chaque nouveau workflow nécessitait un nouveau `if/else` en C# et une
méthode d'exécution hardcodée.

**Après** : Oui. Un nouveau template JSON + un nouveau workflow block JSON suffisent.

---

## 2. Solution : Template-Driven

### Principe

Les données spécifiques à la session vivent dans le **template JSON**, pas dans le code C# :

```
Template JSON                    EntryPointExecutor (C#)
─────────────                    ──────────────────────
_phases = [...]            →     Lit _phases depuis session.Variables
_monitorDescriptor = {...} →     Lit _monitorDescriptor depuis session.Variables
_workflowConfig = {...}    →     Lit LLM prompts, output path, eval criteria
                                 depuis session.Variables
Workflow block JSON        →     Lit config.nodes pour construire l'arbre d'exécution
```

### Flux d'exécution

1. CLI importe le template → variables, entry points, widgets envoyés au backend
2. Utilisateur invoque un entry point → `POST /api/sessions/{id}/invoke/start`
3. `EntryPointExecutor` charge le workflow block depuis `IBlockRepository`
4. Lit `_phases`, `_monitorDescriptor`, `_workflowConfig` depuis les variables de session
5. Construit l'arbre d'exécution dynamiquement depuis `config.nodes` du block
6. Exécute les nœuds séquentiellement, met à jour les variables pour le TUI

### Ce qui a bougé

| Avant (hardcodé en C#) | Après (dans le template JSON) |
|------------------------|-------------------------------|
| `InitializePhases()` créait 4 phases | `_phases` dans variables du template |
| `InitializeMonitorDescriptor()` créait le layout | `_monitorDescriptor` dans variables du template |
| Prompt LLM dans le code | `_workflowConfig.*.llm.systemPrompt` |
| Chemin de sortie dans le code | `_workflowConfig.*.output.filename` |
| Critères d'évaluation dans le code | `_workflowConfig.*.evaluation.criteria` |
| Contenu fallback dans le code | `_workflowConfig.*.fallback` |
| Arbre d'exécution hardcodé | Construit depuis workflow block `config.nodes` |
| Routing par string matching | Dispatch générique basé sur le nodeId |

---

## 3. Structure du `_workflowConfig`

Nouvelle variable de session qui porte la configuration par workflow :

```json
{
  "agent-improvement-loop": {
    "phaseId": "creation",
    "llm": {
      "systemPrompt": "...",
      "userPromptTemplate": "... {{context}} ...",
      "maxTokens": 1024,
      "temperature": 0.7
    },
    "output": {
      "filename": "gen-commit-tool.json"
    },
    "evaluation": {
      "criteria": ["hasJsonStructure", "hasRequiredFields", "minLength"]
    },
    "fallback": { ... }
  }
}
```

Chaque workflow peut avoir sa propre configuration. Un workflow "code-reviewer" aurait
des prompts, critères et fichiers de sortie complètement différents.

---

## 4. Limites actuelles et prochaines étapes

### Ce qui est encore pragmatique

Le dispatch dans `ExecuteNodeAsync` utilise du pattern-matching sur les nodeId
(`nodeId.Contains("evaluate")`, etc.). C'est un compromis pragmatique — beaucoup mieux
que le routing par workflow ID, mais pas encore pleinement générique.

### Prochaine étape : WorkflowExecutor session-aware

L'infrastructure complète existe déjà (`WorkflowExecutor`, `BlockExecutorRegistry`,
`IBlockExecutor`) mais n'est pas connectée aux sessions. La prochaine étape serait de :

1. Faire le pont entre `ExecutionContext` et session variables
2. Utiliser `BlockExecutorRegistry` pour dispatcher chaque nœud
3. Supprimer le pattern-matching par nodeId dans `ExecuteNodeAsync`

Cela rendrait l'exécution 100% générique — chaque nœud serait exécuté par son
`IBlockExecutor` correspondant, sans aucune connaissance du contenu spécifique.
