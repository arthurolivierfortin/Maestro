# Maestro Pipeline Test Plan Template

> **IMPORTANT - Lecture Préalable Requise**
>
> Avant d'exécuter ce test plan, le testeur DOIT lire et comprendre :
>
> 1. **[MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md)** - La vision et l'idéologie du système
>    - Spécialisation vs LLM monolithique
>    - Hiérarchie des blocks (Tool → Agent → Workflow)
>    - Le cycle d'entraînement et d'amélioration
>
> 2. **[AGENT-TOOL-CREATION-GUIDE.md](../guides/AGENT-TOOL-CREATION-GUIDE.md)** - Guide pratique
>    - Comment créer des tools atomiques
>    - Comment créer des agents spécialisés
>    - Comment composer des workflows
>
> **Rappel de la Vision** : Maestro vise à remplacer l'utilisation d'un seul gros LLM coûteux
> par un réseau orchestré de blocks spécialisés utilisant des petits LLMs économiques.
> L'ensemble des petites tâches spécialisées accomplit autant (voire plus) qu'un gros LLM,
> à une fraction du coût.

---

## Information de Session

**Date du test :** _______________
**Testeur (Authority) :** _______________
**Repository de test :** _______________
**Version Maestro :** _______________

**URLs des services :**
- Backend : http://localhost:5000
- LLM-Provider : http://localhost:8000
- Frontend : http://localhost:5173

---

## Checklist Pré-Test

- [ ] Services démarrés via `powershell.exe -File C:\Meastro\scripts\dev-start.ps1`
- [ ] Backend service accessible
- [ ] LLM-Provider service accessible
- [ ] Repository de test existe et accessible
- [ ] CLI disponible dans `C:\Meastro\tools\maestro-cli\index.js`

---

# PHASE 1 : Vérification des Services

---

## Test 1.1 : Santé des Services

**Objectif :** Vérifier que tous les services Maestro sont opérationnels.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js health
```

**Résultat attendu :**
Tous les services affichent un statut "healthy"

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 1.2 : Statut du LLM

**Objectif :** Vérifier que le LLM-Provider est accessible et a des modèles chargés.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js llm
```

**Résultat attendu :**
Statut du LLM-Provider avec liste des modèles disponibles

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 1.3 : Vérifier le Modèle Actif pour Tool Calling

> **IMPORTANT** : Avant de tester des agents, vérifiez que le modèle configuré dans les blocks
> supporte le "tool calling" (appels d'outils). Tous les modèles ne supportent pas cette capacité!
>
> **Architecture** : Le modèle est spécifié dans la configuration de chaque block (agent/inference).
> Le LLM-Provider charge automatiquement le modèle lors de l'exécution.
>
> **Modèles recommandés pour les agents avec tools** :
> - `HuggingFaceTB/SmolLM2-1.7B-Instruct` (léger, supporte tool-use)
> - `NousResearch/Hermes-3-Llama-3.1-8B` (excellent tool calling)
> - `meetkai/functionary-small-v3.2` (spécialisé function calling)
>
> **Note** : `deepseek-coder-1.3b-instruct` est bon pour le code mais **ne supporte PAS**
> le function calling natif. Pour les agents avec tools, utilisez un autre modèle.

**Objectif :** Vérifier quel modèle est actuellement chargé et s'il convient aux tests.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js llm
```

**Résultat obtenu :**
```

```

**Modèle actif :** _______________
**Supporte tool-use ?:** [ ] Oui  [ ] Non  [ ] Inconnu

**Action requise (si le modèle ne supporte pas tool-use) :**
Modifier la config des agents de test pour utiliser un modèle compatible, par exemple :
```json
{
  "config": {
    "model": "HuggingFaceTB/SmolLM2-1.7B-Instruct"
  }
}
```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 2 : Gestion des Blocks

---

## Test 2.1 : Lister tous les Blocks

**Objectif :** Vérifier que le système peut lister tous les blocks disponibles.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js blocks
```

**Résultat attendu :**
Liste des blocks avec IDs, noms et types

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 2.2 : Détails d'un Block

**Objectif :** Vérifier qu'on peut récupérer les détails d'un block.

**Block ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js info {BLOCK_ID}
```

**Résultat attendu :**
Détails du block avec config, inputs, outputs

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 2.3 : Exécuter un Block Simple

**Objectif :** Vérifier que l'exécution de block fonctionne.

**Block ID utilisé :** _______________ (ex: `directory-list`)

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js run {BLOCK_ID} --input path="{PROJECT_PATH}"
```

**Résultat attendu :**
Résultat d'exécution du block avec outputs

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 3 : Sélection/Vérification d'Agent

> **Référence** : Consulter [AGENT-TOOL-CREATION-GUIDE.md](../guides/AGENT-TOOL-CREATION-GUIDE.md)
> pour comprendre la structure des agents et comment en créer de nouveaux.
>
> **Note sur la philosophie** : Un agent est un block composite qui combine un LLM spécialisé
> avec des tools atomiques. Le but est d'avoir des agents focalisés sur des tâches précises
> plutôt qu'un agent généraliste. Voir [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md).

---

## Test 3.1 : Lister les Agents Disponibles

**Objectif :** Identifier les agents existants dans le système pour comprendre les spécialisations disponibles.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js agents
```

**Résultat attendu :**
Liste des agents avec leurs catégories et métriques

**Résultat obtenu :**
```

```

**Agent sélectionné pour les tests :** _______________
**Raison de la sélection (basée sur la spécialisation) :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 3.2 : Vérifier les Détails de l'Agent

**Objectif :** Confirmer la configuration de l'agent (tools, modèle, capabilities).

**Agent ID utilisé :** _______________ (ex: `simple-task-executor`)

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js info {AGENT_ID}
```

**Résultat attendu :**
Détails complets incluant:
- Type: agent
- Tools associés
- Capabilities

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 4 : Exécution d'Agent

> **Contexte Philosophique** : L'exécution d'un agent teste sa capacité à accomplir une tâche
> en utilisant ses tools. Un agent bien spécialisé devrait accomplir des tâches dans son domaine
> avec un petit LLM de manière aussi efficace qu'un gros LLM généraliste.
>
> **Observation importante** : Noter le nombre de tokens utilisés, le temps d'exécution, et la qualité.
> Ces métriques serviront de baseline pour l'entraînement (Phase 6-7).

---

## Test 4.1 : Exécuter Agent (Tâche Simple)

**Objectif :** Exécuter l'agent avec une tâche simple.

**Agent ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js run {AGENT_ID} --input task="List the files in the current directory" --input workingDir="{PROJECT_PATH}"
```

**Résultat attendu :**
Exécution de l'agent avec appels d'outils et résultat final

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 4.2 : Exécuter Agent (Lecture de Fichier)

**Objectif :** Vérifier que l'agent peut lire des fichiers.

**Agent ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js run {AGENT_ID} --input task="Read the README.md file and summarize it" --input workingDir="{PROJECT_PATH}"
```

**Résultat attendu :**
L'agent lit le fichier et fournit un résumé

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 5 : API de Test de Blocks

---

## Test 5.1 : Démarrer un Test Run

**Objectif :** Démarrer un test run pour un block.

**Block ID utilisé :** _______________ (ex: directory-list, simple-task-executor)

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js test start {BLOCK_ID}
```

**Résultat attendu :**
Test run créé avec ID et statut

**Résultat obtenu :**
```

```

**Test Run ID créé :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 5.2 : Voir les Détails du Test Run

**Objectif :** Récupérer les détails d'un test run.

**Test Run ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js test info {TEST_RUN_ID}
```

**Résultat attendu :**
Détails du test avec itérations et scores

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 5.3 : Lister tous les Test Runs

**Objectif :** Récupérer l'historique de tous les tests.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js test runs
```

**Résultat attendu :**
Liste des exécutions de test avec résultats

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 6 : Configuration d'Entraînement

> **Le Cœur de Maestro** : Le système d'entraînement est ce qui permet la vision de
> spécialisation. En exécutant un agent de multiples fois avec variations, en évaluant
> les résultats, et en itérant, on transforme un agent générique en expert spécialisé.
>
> **Cycle d'amélioration** :
> 1. LLM puissant (comme Claude) évalue et fournit du feedback
> 2. L'agent s'améliore itération après itération
> 3. Éventuellement, des agents spécialisés feront ce travail d'évaluation
>
> Voir [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md) - Section "Le Cycle d'Entraînement"

---

## Test 6.1 : Créer Configuration d'Entraînement

**Objectif :** Configurer l'entraînement pour l'agent.

**Agent ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training configs create --name "Config Test Agent" --description "Configuration pour validation pipeline" --workflow {AGENT_ID} --iterations 3 --goal quality
```

**Résultat attendu :**
Configuration créée avec ID affiché

**Résultat obtenu :**
```

```

**Config ID créé :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 6.2 : Lister Configurations d'Entraînement

**Objectif :** Vérifier que la configuration est listée.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training configs
```

**Résultat attendu :**
Liste contenant la nouvelle configuration

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 7 : Exécution d'Entraînement

---

## Test 7.1 : Démarrer un Run d'Entraînement

**Objectif :** Exécuter un run d'entraînement.

**Config ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training start {CONFIG_ID} --name "Test Run 1"
```

**Résultat attendu :**
Run démarré avec ID affiché

**Résultat obtenu :**
```

```

**Run ID créé :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 7.2 : Surveiller le Run d'Entraînement

**Objectif :** Vérifier la progression du run.

**Run ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training runs {RUN_ID}
```

**Résultat attendu :**
Statut du run avec détails des itérations

**Résultat obtenu :**
```

```

**Statut du Run :** _______________
**Itérations complétées :** _____ / _____

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

**Note :** Le run s'exécute de façon asynchrone. Répéter cette commande toutes les 5 secondes jusqu'à ce que le statut soit "Completed" ou "Failed".

---

## Test 7.3 : Vérifier les Itérations d'Entraînement

**Objectif :** Confirmer que les itérations se sont exécutées avec succès.

**Run ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training runs {RUN_ID}
```

**Résultat attendu :**
Run avec tableau d'itérations rempli, statut "Completed"

**Résultat obtenu :**
```

```

**Résumé des itérations :**
- Itération 1 : [ ] Succès  [ ] Échec
- Itération 2 : [ ] Succès  [ ] Échec
- Itération 3 : [ ] Succès  [ ] Échec

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 8 : Vérification des Métriques

---

## Test 8.1 : Lister les Métriques d'Exécution

**Objectif :** Vérifier que les métriques sont collectées.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js metrics
```

**Résultat attendu :**
Liste des métriques d'exécution

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 8.2 : Métriques Agrégées

**Objectif :** Récupérer les métriques agrégées pour le workflow.

**Agent ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js metrics aggregate --workflow {AGENT_ID}
```

**Résultat attendu :**
Métriques agrégées (total exécutions, coût moyen, etc.)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 8.3 : Métriques du Run d'Entraînement

**Objectif :** Récupérer les métriques spécifiques au run d'entraînement.

**Run ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js metrics training-run {RUN_ID}
```

**Résultat attendu :**
Métriques pour toutes les itérations du run

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 9 : Sessions de Projet

> **Architecture Recommandée pour les Tests en Contexte**
>
> Les sessions de projet permettent d'exécuter des agents/blocks dans un **contexte projet persistant**.
> C'est la méthode recommandée pour :
>
> - Tester des agents sur un projet réel (ex: Cantante)
> - Exécuter des séquences de commandes avec état partagé
> - Simuler une utilisation réelle par un développeur
>
> **Flux recommandé** :
> ```
> 1. Créer session pour un projet (Phase 9.1)
> 2. Démarrer la session (Phase 9.2)
> 3. Exécuter agents/blocks dans la session (Phase 9.3)
>    → Les agents ont accès au contexte projet
>    → Les résultats persistent entre les appels
> 4. Arrêter la session (Phase 9.4)
> ```
>
> **Note** : Pour des tests isolés de blocks (Phase 2-4), les sessions ne sont pas nécessaires.
> Pour des tests réalistes avec contexte projet (ex: Foundry), utilisez les sessions.

---

## Test 9.1 : Créer une Session de Projet

**Objectif :** Créer une session interactive de projet.

**Project ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js session create --project {PROJECT_ID} --name "Session Test" --authority human --access full
```

**Résultat attendu :**
Session créée avec ID affiché

**Résultat obtenu :**
```

```

**Session ID créé :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 9.2 : Démarrer la Session

**Objectif :** Démarrer la session de projet.

**Session ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js session start {SESSION_ID}
```

**Résultat attendu :**
Statut de session changé à "Running"

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 9.3 : Exécuter une Commande dans la Session

**Objectif :** Exécuter une commande dans la session.

**Session ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js session exec {SESSION_ID} "status"
```

**Résultat attendu :**
Résultat d'exécution de la commande

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 9.4 : Arrêter la Session

**Objectif :** Arrêter proprement la session.

**Session ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js session stop {SESSION_ID}
```

**Résultat attendu :**
Statut de session changé à "Stopped"

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# PHASE 10 : Nettoyage (Optionnel)

---

## Test 10.1 : Supprimer le Run d'Entraînement

**Run ID à supprimer :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training runs delete {RUN_ID}
```

**Résultat attendu :**
Run supprimé avec succès

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 10.2 : Supprimer la Configuration d'Entraînement

**Config ID à supprimer :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js training configs delete {CONFIG_ID}
```

**Résultat attendu :**
Configuration supprimée avec succès

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 10.3 : Supprimer le Block Agent

**Agent ID à supprimer :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js agents delete {AGENT_ID}
```

**Résultat attendu :**
Agent supprimé avec succès

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 11 : Vérification des Blocks Composites

> **Concept Clé : Interface vs Implémentation**
>
> Le type d'un block (tool, agent, workflow) définit son **interface**, pas son contenu.
> Un tool peut contenir des agents. Un agent peut contenir des workflows.
> Tout block est une **boîte noire**.
>
> ```
> Tool "smart-commit"          ← Interface simple (input → output)
>    └── Workflow interne
>           ├── Agent analyzer
>           ├── Agent writer
>           └── Validator
>                              ← Implémentation complexe cachée
> ```
>
> Cette phase vérifie que le système expose correctement cette composition,
> permettant de comprendre les architectures de blocks sans imposer de hiérarchie rigide.
>
> **Important** : Un block "atomique" signifie qu'il n'expose pas d'enfants dans sa config,
> pas qu'il est simple. Un tool atomique pourrait appeler une API qui elle-même orchestre
> 100 services - c'est toujours atomique du point de vue de Maestro.
>
> Voir [MAESTRO-PHILOSOPHY.md](../MAESTRO-PHILOSOPHY.md) - "Interface vs Implémentation"

---

## Test 11.1 : Identifier un Block Composite

**Objectif :** Vérifier qu'il existe des blocks non-atomiques (composites) dans le système.

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js blocks
```

**Résultat attendu :**
Liste contenant des blocks de type `workflow`, `agent`, ou `task` (blocks composites)

**Résultat obtenu :**
```

```

**Block Composite ID identifié :** _______________
**Type :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 11.2 : Lister les Enfants d'un Block Composite

**Objectif :** Vérifier qu'un block composite contient bien plusieurs blocks enfants.

**Block ID utilisé :** _______________

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js children {BLOCK_ID}
```

**Résultat attendu :**
Liste hiérarchique des blocks enfants avec types et compteurs

**Résultat obtenu :**
```

```

**Total Children :** _______________
**Atomic Count :** _______________
**Composite Count :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 11.3 : Vérifier la Hiérarchie Récursive

**Objectif :** Confirmer que la commande affiche les enfants jusqu'au niveau atomique.

**Block ID utilisé :** _______________ (un workflow contenant des agents ou tasks)

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js children {BLOCK_ID}
```

**Résultat attendu :**
- Arborescence complète affichée
- Tous les niveaux jusqu'aux blocks atomiques visibles
- Chaque block a son type affiché

**Résultat obtenu :**
```

```

**Structure observée :**
- Niveau 1 (composite) : _______________
  - Niveau 2 : _______________
    - Niveau 3 (atomique) : _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

## Test 11.4 : Vérifier un Block Atomique n'a pas d'Enfants

**Objectif :** Confirmer qu'un block atomique (tool, prompt, etc.) ne retourne pas d'enfants.

**Block ID utilisé :** _______________ (un block de type `tool` ou `prompt`)

**Commande exécutée :**
```
node C:\Meastro\tools\maestro-cli\index.js children {BLOCK_ID}
```

**Résultat attendu :**
Message indiquant que le block est atomique (pas d'enfants)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**Problèmes/Notes :**
```

```

---

# RÉSUMÉ DES TESTS

| Phase | Description | Succès | Échecs |
|-------|-------------|--------|--------|
| 1 | Vérification Services + LLM | /3 | |
| 2 | Gestion Blocks | /3 | |
| 3 | Sélection Agent | /2 | |
| 4 | Exécution Agent | /2 | |
| 5 | API Tests Blocks | /3 | |
| 6 | Config Entraînement | /2 | |
| 7 | Exécution Entraînement | /3 | |
| 8 | Métriques | /3 | |
| 9 | Sessions Projet | /4 | |
| 10 | Nettoyage | /3 | |
| 11 | Blocks Composites | /4 | |
| **TOTAL** | | **/32** | |

---

# PROBLÈMES RENCONTRÉS

| # | Phase | Test | Description du Problème | Sévérité | Résolution |
|---|-------|------|------------------------|----------|------------|
| 1 | | | | [ ] Critique [ ] Majeur [ ] Mineur | |
| 2 | | | | [ ] Critique [ ] Majeur [ ] Mineur | |
| 3 | | | | [ ] Critique [ ] Majeur [ ] Mineur | |
| 4 | | | | [ ] Critique [ ] Majeur [ ] Mineur | |
| 5 | | | | [ ] Critique [ ] Majeur [ ] Mineur | |

---

# RECOMMANDATIONS

_Espace pour les recommandations du testeur basées sur les résultats_

```

```

---

# ARBRE DES BLOCKS CRÉÉS/UTILISÉS

> **IMPORTANT** : À la fin de chaque test run, le testeur DOIT documenter l'arbre des blocks
> créés ou utilisés pendant les tests. Cela permet de visualiser les connexions et la hiérarchie.

**Commande pour générer l'arbre :**
```bash
node C:\Meastro\tools\maestro-cli\index.js children {WORKFLOW_ID}
```

**Arbre des blocks :**
```
[Coller ici la sortie de la commande children ou dessiner manuellement l'arbre]

Exemple de format :
┌─────────────────────────────────────────┐
│ Workflow: autonomous-development        │
├─────────────────────────────────────────┤
│ ├── Tool: git-status                    │
│ ├── Tool: directory-list                │
│ ├── Agent: simple-task-executor         │
│ │   ├── (uses) Tool: file-read          │
│ │   ├── (uses) Tool: file-write         │
│ │   └── (uses) Tool: shell-execute      │
│ ├── Tool: git-diff                      │
│ └── Decision: validate-result           │
└─────────────────────────────────────────┘
```

**Blocks créés pendant ce test :**
| Block ID | Type | Parent | Description |
|----------|------|--------|-------------|
| | | | |
| | | | |

**Connexions entre blocks :**
| Source Block | Port | Target Block | Port |
|--------------|------|--------------|------|
| | | | |
| | | | |

---

# APPROBATION

**Testeur :**
Nom : _______________
Date : _______________
Signature : _______________

**Réviseur :**
Nom : _______________
Date : _______________
Signature : _______________
