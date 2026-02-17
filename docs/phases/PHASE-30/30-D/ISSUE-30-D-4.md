# Issue 30-D-4 : Publier tous les blocs

**Statut** : A faire
**Estimation** : 30 minutes
**Prerequis** : 30-D-2 et 30-D-3 (fitness >= 0.85 sur tous les blocs)

---

## Description

Publier chaque sous-bloc et le composite avec version 1.0.0.

---

## Tache

```bash
cd maestro-cli

# Sous-blocs
node index.js block publish project-preparer --version 1.0.0
node index.js block publish task-planner --version 1.0.0
node index.js block publish implement-single-step --version 1.0.0
node index.js block publish test-executor --version 1.0.0
node index.js block publish code-reviewer --version 1.0.0
node index.js block publish git-committer --version 1.0.0

# Composite
node index.js block publish autonomous-dev --version 1.0.0
```

---

## Instructions de test

```bash
# Verifier que tous les blocs sont listes
node index.js list-blocks

# Verifier les versions
node index.js list-blocks | grep "1.0.0"
# Attendu : 7 blocs en version 1.0.0
```

---

## Critere de completion

- [ ] 7 blocs publies (6 sous-blocs + 1 composite)
- [ ] Tous en version 1.0.0
- [ ] `list-blocks` les montre tous
- [ ] Aucune erreur lors de la publication

---

## Note

Si la commande `block publish` n'existe pas encore dans le CLI, il faudra :
1. Verifier si elle est implementee (`grep -r "publish" maestro-cli/`)
2. Si non, l'implementer comme commande generique (change la version dans le .block.json)
3. Si oui, l'utiliser
