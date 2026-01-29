# Guide d'Utilisation: Autonomous Programmer

## Vue d'Ensemble

L'agent `autonomous-programmer` est un agent de programmation totalement autonome capable de:
- Explorer et comprendre un projet
- Planifier des modifications
- Implémenter du code
- Valider avec des tests
- Corriger ses erreurs automatiquement

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTONOMOUS PROGRAMMER                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ ANALYSE  │ → │  PLAN    │ → │  IMPL    │ → │ VALIDATE │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│       │                             │               │           │
│       ▼                             ▼               ▼           │
│  directory-list              file-write        test-runner      │
│  file-read                   llm-generate      git-diff         │
│  code-search                 code-extractor                     │
│  git-status                                                     │
│                                                                  │
│                         ┌──────────┐                            │
│                         │ ITERATE  │ ← Si tests échouent        │
│                         └──────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Tools Utilisés

| Tool | Rôle | Phase |
|------|------|-------|
| `directory-list` | Explorer la structure du projet | Analyse |
| `file-read` | Lire les fichiers existants | Analyse, Impl |
| `code-search` | Chercher du code spécifique | Analyse |
| `git-status` | État git actuel | Analyse |
| `git-diff` | Voir les modifications | Validation |
| `git-log` | Historique des commits | Analyse |
| `llm-generate` | Générer du code | Implémentation |
| `code-extractor` | Extraire code propre | Implémentation |
| `file-write` | Écrire les modifications | Implémentation |
| `test-runner` | Exécuter les tests | Validation |
| `shell-execute` | Commandes diverses | Toutes |

---

## Utilisation via CLI

### 1. Vérifier que l'agent est chargé

```bash
# Lister les agents disponibles
maestro agents

# Vérifier les détails de l'agent
maestro agents info autonomous-programmer

# Voir les tools de l'agent
maestro agents tools autonomous-programmer
```

### 2. Exécution Basique

```bash
# Tâche simple
maestro execute autonomous-programmer \
  --input task="Ajouter une fonction qui calcule la somme de deux nombres" \
  --input projectPath="C:/mon-projet"

# Avec contexte
maestro execute autonomous-programmer \
  --input task="Corriger le bug dans la fonction de login" \
  --input projectPath="C:/mon-projet" \
  --input context="Le bug fait que les utilisateurs ne peuvent pas se connecter avec un email contenant un '+'"
```

### 3. Exécution Avancée

```bash
# Avec tests obligatoires
maestro execute autonomous-programmer \
  --input task="Implémenter la pagination pour l'API /users" \
  --input projectPath="C:/mon-projet" \
  --input testAfterChange=true \
  --input maxIterations=5

# Avec commit automatique
maestro execute autonomous-programmer \
  --input task="Refactorer le module d'authentification" \
  --input projectPath="C:/mon-projet" \
  --input commitChanges=true

# Cibler des fichiers spécifiques
maestro execute autonomous-programmer \
  --input task="Optimiser les requêtes SQL" \
  --input projectPath="C:/mon-projet" \
  --input targetFiles='["src/repositories/userRepository.ts", "src/repositories/orderRepository.ts"]'
```

### 4. Utiliser le Workflow Complet

```bash
# Workflow avec validation complète
maestro execute autonomous-development \
  --input task="Ajouter la fonctionnalité de recherche" \
  --input projectPath="C:/mon-projet" \
  --input runTests=true \
  --input createCommit=true \
  --input maxRetries=3
```

---

## Entraînement de l'Agent

### 1. Créer une Configuration d'Entraînement

```bash
maestro training create \
  --name "autonomous-programmer-quality" \
  --workflow autonomous-programmer \
  --iterations 50 \
  --parallel 2 \
  --goal quality \
  --delay 2000 \
  --description "Optimisation de la qualité du code généré"
```

### 2. Préparer un Projet Sandbox

```bash
# Créer un projet de test
mkdir C:/sandbox-training
cd C:/sandbox-training

# Initialiser un projet TypeScript simple
npm init -y
npm install typescript @types/node --save-dev
npx tsc --init

# Créer une structure basique
mkdir src
echo "export function hello(): string { return 'Hello'; }" > src/index.ts

# Initialiser git
git init
git add .
git commit -m "Initial commit"

# Enregistrer comme projet Maestro
maestro projects create --name "sandbox-training" --path "C:/sandbox-training"
```

### 3. Lancer l'Entraînement

```bash
# Démarrer avec des tâches variées
maestro training start autonomous-programmer-quality \
  --inputs '{"task": "Ajouter une fonction de multiplication", "projectPath": "C:/sandbox-training"}'

# Suivre la progression
maestro training runs --config autonomous-programmer-quality

# Détails d'un run
maestro training run <run-id>
```

### 4. Analyser les Résultats

```bash
# Métriques de l'agent
maestro agents metrics autonomous-programmer

# Leaderboard
maestro foundry leaderboard --limit 10

# Résumé global
maestro metrics summary --from 2026-01-01
```

---

## Exemples de Tâches

### Tâches Simples (pour débuter)

```bash
# Ajouter une fonction
maestro execute autonomous-programmer \
  --input task="Créer une fonction formatDate(date) qui retourne une date au format DD/MM/YYYY" \
  --input projectPath="C:/projet"

# Corriger un typo
maestro execute autonomous-programmer \
  --input task="Corriger le typo 'recieve' → 'receive' dans tout le projet" \
  --input projectPath="C:/projet"

# Ajouter des commentaires
maestro execute autonomous-programmer \
  --input task="Ajouter des commentaires JSDoc à toutes les fonctions exportées dans src/utils/" \
  --input projectPath="C:/projet"
```

### Tâches Intermédiaires

```bash
# Ajouter une fonctionnalité
maestro execute autonomous-programmer \
  --input task="Ajouter la validation email dans le formulaire d'inscription" \
  --input projectPath="C:/projet" \
  --input context="Utiliser une regex standard, afficher un message d'erreur clair"

# Refactorer
maestro execute autonomous-programmer \
  --input task="Extraire la logique de calcul de prix dans un service dédié PricingService" \
  --input projectPath="C:/projet"

# Ajouter des tests
maestro execute autonomous-programmer \
  --input task="Ajouter des tests unitaires pour le module userService" \
  --input projectPath="C:/projet" \
  --input context="Utiliser Vitest, couvrir les cas nominaux et d'erreur"
```

### Tâches Complexes

```bash
# Nouvelle feature complète
maestro execute autonomous-programmer \
  --input task="Implémenter un système de notifications avec: 1) Un NotificationService 2) Un composant NotificationList 3) Les tests associés" \
  --input projectPath="C:/projet" \
  --input testAfterChange=true \
  --input maxIterations=5

# Migration
maestro execute autonomous-programmer \
  --input task="Migrer tous les callbacks vers async/await dans le dossier src/services/" \
  --input projectPath="C:/projet"

# Optimisation
maestro execute autonomous-programmer \
  --input task="Optimiser les performances du composant DataTable: virtualisation, mémoization, lazy loading" \
  --input projectPath="C:/projet" \
  --input context="La table peut avoir 10000+ lignes"
```

---

## Bonnes Pratiques

### 1. Formulation des Tâches

**BON** ✅
```
"Ajouter une fonction validateEmail(email: string): boolean qui retourne true si l'email est valide"
```

**MAUVAIS** ❌
```
"Fais un truc pour les emails"
```

### 2. Fournir du Contexte

**BON** ✅
```bash
--input context="Le projet utilise TypeScript strict, ESLint avec les règles Airbnb, et Vitest pour les tests"
```

**MAUVAIS** ❌
```bash
# Pas de contexte = l'agent doit tout deviner
```

### 3. Cibler les Fichiers si Connu

**BON** ✅
```bash
--input targetFiles='["src/services/authService.ts"]'
```

**MAUVAIS** ❌
```bash
# L'agent va explorer tout le projet (plus lent mais OK)
```

### 4. Activer les Tests

```bash
# Toujours recommandé pour des tâches non-triviales
--input testAfterChange=true
```

---

## Résolution de Problèmes

### L'agent ne trouve pas les fichiers

```bash
# Vérifier que le chemin est correct
maestro run directory-list --input path="C:/mon-projet" --input recursive=true

# Vérifier les permissions
ls -la C:/mon-projet
```

### Les tests échouent en boucle

```bash
# Augmenter les itérations
--input maxIterations=10

# Fournir plus de contexte sur l'erreur
--input context="L'erreur actuelle est: TypeError: Cannot read property 'x' of undefined"
```

### L'agent génère du code incorrect

```bash
# Être plus précis dans la tâche
--input task="Créer une fonction PURE (sans effets de bord) qui..."

# Spécifier les contraintes
--input context="Ne pas utiliser de dépendances externes. Utiliser uniquement TypeScript natif."
```

### Performance lente

```bash
# Réduire la profondeur d'exploration
# (modifier le tool directory-list si nécessaire)

# Cibler des fichiers spécifiques
--input targetFiles='["src/specific/file.ts"]'
```

---

## Métriques et Suivi

### Consulter les Métriques

```bash
# Métriques globales de l'agent
maestro agents metrics autonomous-programmer

# Résultats attendus:
# - Total Runs: X
# - Completion Rate: X%
# - Avg Execution Time: X ms
# - Avg Steps Per Run: X
# - Overall Score: X/100
```

### Interpréter les Scores

| Score | Signification | Action |
|-------|---------------|--------|
| 90-100 | Excellent | Maintenir |
| 70-89 | Bon | Petites optimisations |
| 50-69 | Acceptable | Améliorer les prompts |
| < 50 | Insuffisant | Revoir l'architecture |

### Comparer les Versions

```bash
# Après modifications de l'agent
maestro agents metrics autonomous-programmer > metrics-after.json

# Comparer
diff metrics-before.json metrics-after.json
```

---

## Intégration CI/CD

### Script d'Automatisation

```bash
#!/bin/bash
# autonomous-dev-task.sh

TASK="$1"
PROJECT="$2"

# Exécuter la tâche
RESULT=$(maestro execute autonomous-programmer \
  --input task="$TASK" \
  --input projectPath="$PROJECT" \
  --input testAfterChange=true)

# Vérifier le succès
if echo "$RESULT" | grep -q '"success": true'; then
  echo "✅ Tâche complétée avec succès"
  exit 0
else
  echo "❌ Échec de la tâche"
  echo "$RESULT"
  exit 1
fi
```

### Utilisation

```bash
./autonomous-dev-task.sh "Ajouter la validation des inputs" "/path/to/project"
```

---

## Conclusion

L'agent `autonomous-programmer` est conçu pour être:
- **Autonome**: Capable de travailler sans supervision
- **Méthodique**: Suit un processus structuré
- **Auto-correctif**: Peut corriger ses erreurs
- **Mesurable**: Toutes les actions sont trackées

Pour des résultats optimaux:
1. Formulez des tâches claires et spécifiques
2. Fournissez du contexte pertinent
3. Activez les tests pour validation
4. Entraînez régulièrement avec des itérations
5. Analysez les métriques pour optimiser
