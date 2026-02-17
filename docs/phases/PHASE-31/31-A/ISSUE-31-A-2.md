# Issue 31-A-2 : Selection d'agent et interaction

**Statut** : A faire
**Estimation** : 2-3 heures
**Bloquant** : Non
**Prerequis** : 31-A-1 (commande maestro code fonctionne)

---

## Description

Ajouter la selection d'agent au lancement et l'interaction en temps reel pendant l'execution.

---

## Tache detaillee

### 1. Selection d'agent au lancement

Au demarrage, si plusieurs agents sont disponibles :

```
? Select an agent:
  > autonomous-dev (Tier 1 — Claude Opus/Sonnet)
    [futurs tiers ici]
```

En Phase 31, seul le Tier 1 existe. La selection est triviale mais le mecanisme est en place pour les futurs tiers (Phase 32).

**Implementation** :
- Lister les blocs de type `agent` avec `metadata.designation: "autonomous"`
- Si un seul : le selectionner automatiquement
- Si plusieurs : afficher le choix

### 2. Interaction pendant l'execution

Pendant que l'agent travaille, l'utilisateur peut taper a tout moment :
- **`pause`** — met en pause l'execution (attend la fin du noeud courant)
- **`resume`** — reprend l'execution
- **`status`** — affiche l'etat courant (noeud en cours, progression)
- **`abort`** — annule l'execution en cours
- **Texte libre** — envoye au bloc `interaction-handler` (Phase 31+)

### 3. Interaction-handler (base)

Le bloc `interaction-handler` (deja dans `content/system/blocks/agents/`) recoit les messages de l'utilisateur pendant l'execution et peut :
- Repondre a des questions
- Rediriger l'agent
- Fournir des informations supplementaires

En Phase 31, l'interaction est basique : les messages sont loggues et affiches dans le moniteur. La logique avancee (pause, redirect) viendra plus tard.

---

## Instructions de test

### Test 1 : Selection d'agent

```bash
cd C:\Cantante
node C:\Meastro\maestro-cli\index.js code
# Si un seul agent : selection automatique
# Si plusieurs : menu de selection
```

- [ ] L'agent est selectionne correctement
- [ ] Le nom et le tier sont affiches

### Test 2 : Commandes pendant l'execution

```bash
# Pendant que l'agent travaille :
> status
# Affiche le noeud courant

> pause
# L'execution se met en pause apres le noeud courant

> resume
# L'execution reprend
```

- [ ] `status` affiche l'etat correct
- [ ] `pause` stoppe l'execution proprement
- [ ] `resume` reprend l'execution

### Test 3 : Message libre

```bash
# Pendant que l'agent travaille :
> Use vitest instead of jest for the tests
```

- [ ] Le message est recu et loggue
- [ ] Le message apparait dans le moniteur

---

## Critere de completion

- [ ] Selection d'agent fonctionnelle (auto si un seul, menu si plusieurs)
- [ ] `status`, `pause`, `resume`, `abort` fonctionnent pendant l'execution
- [ ] Les messages libres sont recus et affiches
- [ ] Pas de crash quand l'utilisateur tape pendant l'execution

---

## Risques

- **Risque** : Le stdin est consomme par le prompt et pas disponible pendant l'execution
- **Mitigation** : Utiliser le mode raw de Ink pour capturer les inputs pendant l'execution
- **Risque** : L'interaction est trop basique pour etre utile
- **Mitigation** : Acceptable en Phase 31. L'interaction avancee viendra en Phase 33+
