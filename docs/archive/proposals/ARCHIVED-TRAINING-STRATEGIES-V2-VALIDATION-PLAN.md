# Plan de Validation: Training Strategies V2

> **OBJECTIF PRINCIPAL**
>
> Valider que toute l'infrastructure de training (workspaces, sessions, experiments, strategies)
> est fonctionnelle AVANT d'utiliser des modèles LLM payants. Ce plan utilise exclusivement
> des modèles gratuits/mock pour tester les fonctionnalités.

---

## Information de Session

**Date du test :** _______________
**Testeur (Authority) :** _______________
**Version Maestro :** _______________
**Branche Git :** _______________

**URLs des services :**
- Backend : http://localhost:5000
- LLM-Provider : http://localhost:8000
- Frontend : http://localhost:5173

---

## Documents de Référence

| Document | Chemin | Importance |
|----------|--------|------------|
| Philosophie V2 | `docs/MAESTRO-PHILOSOPHY-V2.md` | Principes fondamentaux |
| Plan Training Strategies | `docs/proposals/PLAN-TRAINING-STRATEGIES-V2.md` | Spécifications |
| Architecture Fitness | `docs/architecture/ANALYSIS-FITNESS-TRAINING-ARCHITECTURE.md` | Formule fitness |

---

## Checklist Pré-Test

### Environnement
- [ ] Services démarrés via `powershell.exe -File C:\Meastro\scripts\dev-start.ps1`
- [ ] Backend accessible (http://localhost:5000)
- [ ] LLM-Provider accessible (http://localhost:8000)
- [ ] Frontend accessible (http://localhost:5173)
- [ ] CLI disponible (`C:\Meastro\tools\maestro-cli\index.js`)

### Modèle Mock/Gratuit Configuré
- [ ] Ollama installé et fonctionnel
- [ ] Modèle gratuit disponible (ex: `smollm2:135m`, `tinyllama`, ou mock)
- [ ] Aucun modèle payant configuré pour les tests

---

# PHASE 1 : Vérification des Services de Base

## Test 1.1 : Santé des Services

**Objectif :** Confirmer que tous les services Maestro sont opérationnels.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js health
```

**Résultat attendu :**
- Backend: ✓ Healthy
- LLM-Provider: ✓ Healthy (ou mock mode)
- Frontend: Accessible

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 1.2 : Vérifier le Mode Mock LLM

**Objectif :** S'assurer qu'on utilise un modèle gratuit/mock pour les tests.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js llm
```

**Résultat attendu :**
Liste des modèles incluant un modèle gratuit (Ollama) ou indication de mode mock.

**Modèle actif :** _______________
**Coût par token :** $0.00 (doit être gratuit)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

**ATTENTION :** Si un modèle payant est configuré, ARRÊTER les tests et configurer un modèle gratuit.

---

# PHASE 2 : Infrastructure Workspaces

> Les workspaces sont des conteneurs génériques pour organiser le travail.
> Ils sont essentiels pour les expériences de training.

## Test 2.1 : Accéder à la Page Workspaces (UI)

**Objectif :** Vérifier que la page Workspaces est accessible.

**Action :**
1. Ouvrir http://localhost:5173/workspaces dans un navigateur

**Résultat attendu :**
- Page "Workspaces" affichée
- Filtres visibles (All, Active, Paused, Archived)
- Barre de recherche visible

**Capture d'écran :** [ ] Jointe

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 2.2 : Créer un Workspace de Recherche

**Objectif :** Créer le workspace qui servira à tester les stratégies de training.

**Action :**
1. Cliquer sur "New Workspace"
2. Remplir:
   - Nom: `research-training-strategies`
   - Description: `Workspace pour valider l'infrastructure de training avant utilisation de modèles payants`
3. Confirmer la création

**Résultat attendu :**
- Workspace créé avec succès
- Apparaît dans la liste
- Statut: Active

**Workspace ID créé :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 2.3 : API - Lister les Workspaces

**Objectif :** Vérifier l'API workspaces.

**Commande :**
```bash
curl http://localhost:5000/api/workspaces
```

**Résultat attendu :**
JSON contenant le workspace `research-training-strategies`

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 2.4 : Accéder au Détail du Workspace

**Objectif :** Vérifier la page de détail workspace.

**Action :**
1. Cliquer sur le workspace `research-training-strategies`
2. Vérifier les onglets: Overview, Blocks, Sessions, Logs

**Résultat attendu :**
- Page de détail affichée
- Tous les onglets fonctionnels
- Sidebar de navigation visible

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 3 : Infrastructure Sessions

> Les sessions sont les unités d'exécution des workflows dans les workspaces.

## Test 3.1 : Accéder à la Page Sessions (UI)

**Objectif :** Vérifier que la page Sessions est accessible.

**Action :**
1. Ouvrir http://localhost:5173/sessions

**Résultat attendu :**
- Page "Sessions" affichée
- Filtres par statut (All, Running, Pending, Completed, Failed)
- Filtre par workspace disponible

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 3.2 : API - Lister les Sessions

**Objectif :** Vérifier l'API sessions.

**Commande :**
```bash
curl http://localhost:5000/api/sessions
```

**Résultat attendu :**
JSON (peut être vide si aucune session)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 3.3 : Filtrer Sessions par Workspace

**Objectif :** Vérifier le filtrage par workspace.

**Commande :**
```bash
curl "http://localhost:5000/api/sessions?workspaceId={WORKSPACE_ID}"
```

**Workspace ID utilisé :** _______________

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 4 : System Blocks pour Training

> Les system blocks sont les composants de base pour les stratégies de training.
> Ils doivent exister et être découvrables.

## Test 4.1 : Vérifier les Blocks Helpers

**Objectif :** Confirmer que les blocks helpers de training existent.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js blocks | grep -i "system:"
```

**Blocks attendus :**
- [ ] `system:iteration-runner`
- [ ] `system:reward-calculator`
- [ ] `system:early-stopper`
- [ ] `system:metrics-aggregator`
- [ ] `system:fitness-evaluator`

**Résultat obtenu :**
```

```

**Blocks manquants :** _______________

**Statut :** [ ] SUCCES  [ ] PARTIEL  [ ] ECHEC

---

## Test 4.2 : Vérifier les Strategy Blocks

**Objectif :** Confirmer que les stratégies de training sont enregistrées.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js blocks | grep -i "strategy"
```

**Strategies attendues :**
- [ ] `system:strategy-sft` (Supervised Fine-Tuning)
- [ ] `system:strategy-rl-fitness` (Reinforcement Learning)
- [ ] `system:strategy-preference` (RLAIF/DPO)
- [ ] `system:strategy-execution` (Execution-Based)
- [ ] `system:strategy-evolutionary` (Evolutionary)
- [ ] `system:strategy-distillation` (Knowledge Distillation)
- [ ] `system:strategy-curriculum` (Curriculum Learning)
- [ ] `system:strategy-self-play` (Self-Play)
- [ ] `system:strategy-neuro-symbolic` (Neuro-Symbolic)
- [ ] `system:strategy-moe` (Mixture of Experts)

**Résultat obtenu :**
```

```

**Strategies manquantes :** _______________

**Statut :** [ ] SUCCES  [ ] PARTIEL  [ ] ECHEC

---

## Test 4.3 : Vérifier l'Experiment Manager

**Objectif :** Confirmer que l'agent experiment-manager existe.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js info system:experiment-manager
```

**Résultat attendu :**
- Type: agent
- Capabilities listées
- Actions disponibles (create, start, stop, compare, etc.)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 4.4 : Détails d'une Strategy Block

**Objectif :** Vérifier les metadata d'une stratégie.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js info system:strategy-rl-fitness
```

**Résultat attendu :**
- method: ReinforcementLearning
- category: reinforcement
- suitableFor: [reasoning, code, agentic]
- strengths et weaknesses listés
- estimatedResources défini

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 5 : API Experiments

> L'API Experiments gère le cycle de vie des expériences de training.

## Test 5.1 : Lister les Stratégies via API

**Objectif :** Vérifier l'endpoint strategies.

**Commande :**
```bash
curl http://localhost:5000/api/experiments/strategies
```

**Résultat attendu :**
JSON avec liste des stratégies, leurs métadonnées (method, category, suitableFor)

**Nombre de stratégies retournées :** _______________

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 5.2 : Filtrer Stratégies par Catégorie

**Objectif :** Vérifier le filtrage par catégorie.

**Commande :**
```bash
curl "http://localhost:5000/api/experiments/strategies?category=reinforcement"
```

**Résultat attendu :**
Uniquement les stratégies de catégorie "reinforcement"

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 5.3 : Créer une Expérience

**Objectif :** Créer une expérience de test dans le workspace de recherche.

**Commande :**
```bash
curl -X POST http://localhost:5000/api/experiments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test SFT Strategy",
    "workspaceId": "{WORKSPACE_ID}",
    "agentId": "simple-task-executor",
    "strategyId": "system:strategy-sft",
    "config": {
      "maxIterations": 3,
      "learningRate": 0.001
    }
  }'
```

**Workspace ID utilisé :** _______________

**Résultat attendu :**
- Status: 201 Created
- Experiment ID retourné
- Status: "Created"

**Experiment ID créé :** _______________

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 5.4 : Lister les Expériences

**Objectif :** Vérifier que l'expérience apparaît dans la liste.

**Commande :**
```bash
curl http://localhost:5000/api/experiments
```

**Résultat attendu :**
Liste contenant l'expérience créée

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 5.5 : Récupérer une Expérience par ID

**Objectif :** Vérifier l'endpoint de détail.

**Experiment ID utilisé :** _______________

**Commande :**
```bash
curl http://localhost:5000/api/experiments/{EXPERIMENT_ID}
```

**Résultat attendu :**
Détails complets de l'expérience

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 5.6 : Filtrer Expériences par Workspace

**Objectif :** Vérifier le filtrage par workspace.

**Commande :**
```bash
curl "http://localhost:5000/api/experiments?workspaceId={WORKSPACE_ID}"
```

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 6 : CLI Experiments

> Le CLI est le point d'entrée principal pour les opérations d'expérimentation.

## Test 6.1 : CLI - Lister les Stratégies

**Objectif :** Vérifier la commande strategies du CLI.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment strategies
```

**Résultat attendu :**
Liste formatée des stratégies avec méthode et catégorie

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 6.2 : CLI - Recommander une Stratégie

**Objectif :** Vérifier les recommandations basées sur le type de tâche.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment recommend --agent simple-task-executor --task code
```

**Résultat attendu :**
Liste de stratégies recommandées pour les tâches de code

**Résultat obtenu :**
```

```

**Stratégies recommandées :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 6.3 : CLI - Créer une Expérience

**Objectif :** Créer une expérience via CLI.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment create \
  --name "CLI Test RL Fitness" \
  --workspace {WORKSPACE_ID} \
  --agent simple-task-executor \
  --strategy system:strategy-rl-fitness \
  --config '{"maxIterations": 5}'
```

**Workspace ID utilisé :** _______________

**Résultat attendu :**
- Expérience créée avec succès
- ID affiché
- Status: Created

**Experiment ID créé :** _______________

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 6.4 : CLI - Lister les Expériences

**Objectif :** Lister les expériences via CLI.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment list --workspace {WORKSPACE_ID}
```

**Résultat attendu :**
Liste des expériences du workspace avec statuts

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 6.5 : CLI - Output JSON

**Objectif :** Vérifier le format JSON pour intégration.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment list --json
```

**Résultat attendu :**
JSON valide (parseable)

**JSON valide :** [ ] Oui  [ ] Non

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 7 : Infrastructure Fitness

> Le fitness est la métrique centrale de Maestro pour évaluer les agents.

## Test 7.1 : API Fitness Config

**Objectif :** Vérifier l'endpoint de configuration fitness.

**Commande :**
```bash
curl http://localhost:5000/api/fitness/config
```

**Résultat attendu :**
Configuration fitness avec lambda, weights, thresholds

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 7.2 : API Model Profiles

**Objectif :** Vérifier les profils de modèles.

**Commande :**
```bash
curl http://localhost:5000/api/fitness/profiles
```

**Résultat attendu :**
Liste des profils de modèles avec caractéristiques (params, FLOPs, VRAM, etc.)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 7.3 : CLI Fitness Config

**Objectif :** Vérifier la commande fitness du CLI.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js fitness config
```

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 7.4 : CLI Fitness Leaderboard

**Objectif :** Vérifier le leaderboard fitness.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js fitness leaderboard
```

**Résultat attendu :**
Classement des modèles par fitness (peut être vide si pas d'exécutions)

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 8 : Test de Démarrage d'Expérience (Mode Mock)

> Cette phase teste le démarrage réel d'une expérience avec un modèle gratuit/mock.
> **ATTENTION:** Confirmer que le LLM configuré est gratuit avant de continuer.

## Test 8.1 : Confirmer Modèle Gratuit

**Objectif :** Double-vérification avant exécution.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js llm
```

**Modèle actif :** _______________
**Coût confirmé $0.00 :** [ ] Oui  [ ] Non

**SI LE COÛT N'EST PAS $0.00, NE PAS CONTINUER CETTE PHASE**

---

## Test 8.2 : Démarrer une Expérience

**Objectif :** Tester le démarrage d'une expérience.

**Experiment ID utilisé :** _______________ (de Phase 5.3 ou 6.3)

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment start {EXPERIMENT_ID}
```

**Résultat attendu :**
- Status change à "Running"
- Pas d'erreur

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 8.3 : Vérifier le Statut de l'Expérience

**Objectif :** Surveiller la progression.

**Commande (répéter plusieurs fois) :**
```bash
curl http://localhost:5000/api/experiments/{EXPERIMENT_ID}
```

**Observations :**
- Statut initial : _______________
- Après 10s : _______________
- Après 30s : _______________
- Statut final : _______________

**Itérations complétées :** _____ / _____

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 8.4 : Arrêter l'Expérience

**Objectif :** Tester l'arrêt propre.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment stop {EXPERIMENT_ID}
```

**Résultat attendu :**
- Status change à "Paused"
- Pas de perte de données

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 9 : Comparaison d'Expériences

> La comparaison permet de déterminer la meilleure stratégie.

## Test 9.1 : Créer Plusieurs Expériences

**Objectif :** Préparer des expériences pour comparaison.

**Action :** Créer au moins 2 expériences avec des stratégies différentes.

**Expérience 1 :**
- ID : _______________
- Stratégie : _______________

**Expérience 2 :**
- ID : _______________
- Stratégie : _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 9.2 : Comparer via API

**Objectif :** Tester l'endpoint de comparaison.

**Commande :**
```bash
curl -X POST http://localhost:5000/api/experiments/compare \
  -H "Content-Type: application/json" \
  -d '{"experimentIds": ["{EXP_ID_1}", "{EXP_ID_2}"]}'
```

**Résultat attendu :**
- Rankings pour chaque expérience
- Best experiment ID identifié
- Recommended strategy ID

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 9.3 : Comparer via CLI

**Objectif :** Tester la comparaison via CLI.

**Commande :**
```bash
node C:\Meastro\tools\maestro-cli\index.js experiment compare {EXP_ID_1} {EXP_ID_2}
```

**Résultat obtenu :**
```

```

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 10 : Frontend - Page Training

## Test 10.1 : Accéder à la Page Training

**Action :**
1. Ouvrir http://localhost:5173/training

**Résultat attendu :**
- Page affichée
- Liste des training runs visible

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 10.2 : Accéder à la Page Metrics

**Action :**
1. Ouvrir http://localhost:5173/metrics

**Résultat attendu :**
- Page affichée
- Métriques visibles (même si vides)

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 10.3 : Navigation TopBar

**Objectif :** Vérifier que les liens de navigation fonctionnent.

**Action :**
1. Vérifier présence du lien "Workspaces" dans la TopBar
2. Vérifier présence du lien "Sessions" dans la TopBar
3. Cliquer sur chaque lien

**Liens présents :**
- [ ] Workspaces
- [ ] Sessions

**Statut :** [ ] SUCCES  [ ] ECHEC

---

# PHASE 11 : Nettoyage et Préparation Production

## Test 11.1 : Supprimer les Expériences de Test

**Objectif :** Nettoyer les données de test.

**Commande (pour chaque expérience) :**
```bash
curl -X DELETE http://localhost:5000/api/experiments/{EXPERIMENT_ID}
```

**Expériences supprimées :** _______________

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 11.2 : Vérifier la Suppression

**Commande :**
```bash
curl http://localhost:5000/api/experiments
```

**Résultat attendu :**
Liste vide ou sans les expériences supprimées

**Statut :** [ ] SUCCES  [ ] ECHEC

---

## Test 11.3 : Conserver le Workspace de Recherche

**Décision :**
- [ ] Garder `research-training-strategies` pour futurs tests
- [ ] Supprimer le workspace

**Note :** Il est recommandé de garder ce workspace pour les tests futurs.

---

# PHASE 12 : Checklist Prêt pour Production

> Cette checklist confirme que l'infrastructure est prête pour des modèles payants.

## 12.1 : Vérification Finale

| Composant | Statut | Notes |
|-----------|--------|-------|
| Services (Backend, Frontend) | [ ] OK [ ] KO | |
| API Workspaces | [ ] OK [ ] KO | |
| API Sessions | [ ] OK [ ] KO | |
| API Experiments | [ ] OK [ ] KO | |
| API Fitness | [ ] OK [ ] KO | |
| CLI Experiment commands | [ ] OK [ ] KO | |
| System Blocks (strategies) | [ ] OK [ ] KO | |
| UI Pages (Workspaces, Sessions) | [ ] OK [ ] KO | |
| TopBar Navigation | [ ] OK [ ] KO | |

---

## 12.2 : Problèmes Bloquants Identifiés

| # | Composant | Description | Sévérité | Résolution Requise |
|---|-----------|-------------|----------|-------------------|
| 1 | | | [ ] Bloquant [ ] Majeur [ ] Mineur | |
| 2 | | | [ ] Bloquant [ ] Majeur [ ] Mineur | |
| 3 | | | [ ] Bloquant [ ] Majeur [ ] Mineur | |

---

## 12.3 : Autorisation de Passer en Production

**Tous les tests critiques passent :** [ ] Oui  [ ] Non

**Aucun problème bloquant :** [ ] Oui  [ ] Non

**AUTORISATION DE CONFIGURER DES MODÈLES PAYANTS :**

[ ] **APPROUVÉ** - L'infrastructure est validée, vous pouvez procéder avec des modèles payants.

[ ] **REFUSÉ** - Des problèmes doivent être résolus avant d'utiliser des modèles payants.

---

# RÉSUMÉ DES TESTS

| Phase | Description | Succès | Échecs | Total |
|-------|-------------|--------|--------|-------|
| 1 | Services de Base | /2 | | 2 |
| 2 | Infrastructure Workspaces | /4 | | 4 |
| 3 | Infrastructure Sessions | /3 | | 3 |
| 4 | System Blocks Training | /4 | | 4 |
| 5 | API Experiments | /6 | | 6 |
| 6 | CLI Experiments | /5 | | 5 |
| 7 | Infrastructure Fitness | /4 | | 4 |
| 8 | Démarrage Expérience (Mock) | /4 | | 4 |
| 9 | Comparaison Expériences | /3 | | 3 |
| 10 | Frontend Pages | /3 | | 3 |
| 11 | Nettoyage | /3 | | 3 |
| **TOTAL** | | **/41** | | 41 |

---

# RECOMMANDATIONS

_Espace pour les recommandations du testeur basées sur les résultats_

```

```

---

# PROCHAINES ÉTAPES (Post-Validation)

Une fois ce plan validé avec succès :

1. **Configurer Ollama avec modèles de production**
   ```bash
   ollama pull llama3:8b
   ollama pull mistral:7b
   ```

2. **Créer le workspace de recherche officiel**
   - Nom : `maestro-model-research`
   - Description : `Recherche et validation des modèles LLM pour Maestro`

3. **Planifier les expériences initiales**
   - Comparer 2-3 stratégies sur un agent simple
   - Évaluer le rapport coût/performance

4. **Établir les seuils de fitness acceptables**
   - Baseline avec modèle gratuit
   - Objectif avec modèle payant

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

**Approbation Production :**
Nom : _______________
Date : _______________
Signature : _______________
