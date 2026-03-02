# Phase 45 : Premiere version distribuable

**Statut** : A faire
**Prerequis** : Phase 45-PREP COMPLETE (score dogfooding >= 3.5/5)
**Objectif** : `npm install -g @maestro/cli && maestro init && maestro code` fonctionne sur une machine neuve.

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `docs/phases/PHASE-45/checkpoint.md`** apres chaque sous-phase
4. **Ne PAS changer le backend C# sauf si un bug bloque l'installation** — le backend est stable apres 45-PREP
5. **Ne PAS ajouter de features** — cette phase est 100% packaging + documentation + testing externe

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| 45-0 | Fixes usabilite : context assembly delay, concurrent invocations, response corruption | 0.5 jour |
| 45-A | Packaging npm + commande globale + sidecar auto-start | 3-4 jours |
| 45-B | `maestro init` + onboarding premier lancement (provider config) | 2-3 jours |
| 45-C | Documentation : README, Getting Started, 3 exemples concrets | 2-3 jours |
| 45-D | Beta testing (3-5 testeurs, feedback structure) | 3-5 jours |

---

## 45-A : Packaging npm + commande globale + sidecar auto-start

### Ce que cette sous-phase fait

1. Configurer le package `@maestro/cli` pour publication sur npm (`package.json`, `bin`, `files`, `prepublish`)
2. S'assurer que `npx @maestro/cli code` et `maestro code` (apres `npm install -g`) fonctionnent
3. Le sidecar (`@maestro/sidecar`) doit demarrer automatiquement le backend + LLM-Provider si pas deja running
4. Gerer le cas "premiere installation" : pas de backend, pas de LLM-Provider — le sidecar les telecharge/demarre

### Fichiers cibles
| Fichier | Action |
|---------|--------|
| `packages/maestro-cli/package.json` | Modifier : configurer bin, files, prepublish, dependencies |
| `packages/maestro-sidecar/index.ts` | Modifier : auto-start backend + LLM-Provider, health check loop |
| `packages/maestro-cli/cli.ts` | Modifier : integrer sidecar auto-start avant les commandes |

### Verification
```bash
# Build le package localement
cd /mnt/c/Meastro/packages/maestro-cli && npm pack
# Resultat : fichier .tgz cree

# Installer globalement depuis le .tgz
npm install -g maestro-cli-*.tgz
# Resultat : commande 'maestro' disponible

# Tester la commande
maestro health
maestro code --help
# Resultat : pas d'erreur, help s'affiche
```

---

## 45-B : `maestro init` + Onboarding premier lancement

### Ce que cette sous-phase fait

1. `maestro init` cree `.maestro/` dans le repertoire courant avec la config minimale
2. Au premier lancement de `maestro code`, si aucun LLM provider n'est configure, guider l'utilisateur :
   - "Quel provider LLM voulez-vous utiliser ? (Azure, Anthropic, Ollama, Local GPU)"
   - Configurer les API keys dans `.maestro/config.json`
3. Verifier que le flow `init → code → premiere conversation` est fluide

### Fichiers cibles
| Fichier | Action |
|---------|--------|
| `packages/maestro-cli/cli.ts` | Modifier : enrichir la commande `init` existante |
| `packages/maestro-cli/onboarding.ts` | Creer : wizard interactif de configuration provider |
| `packages/maestro-code/App.ts` | Modifier : detecter l'absence de config et rediriger vers onboarding |

### Verification
```bash
# Dans un repertoire vierge
mkdir /tmp/test-project && cd /tmp/test-project
maestro init
# Resultat : .maestro/ cree avec config de base

maestro code
# Resultat : guide de configuration si pas de provider, puis conversation normale
```

---

## 45-C : Documentation — README, Getting Started, 3 exemples

### Ce que cette sous-phase fait

1. Ecrire un README.md de projet clair (pas le README technique actuel — un README UTILISATEUR)
2. Ecrire un Getting Started guide (5 minutes pour la premiere conversation)
3. 3 exemples concrets :
   - Exemple 1 : Utiliser maestro-code pour creer un workspace et lancer une session de dev
   - Exemple 2 : Utiliser maestro-code pour entrainer un block dans une foundry session
   - Exemple 3 : Utiliser maestro-code pour monitorer et comparer des sessions

### Fichiers cibles
| Fichier | Action |
|---------|--------|
| `README.md` | Reecrire : README utilisateur (pas technique) |
| `docs/getting-started.md` | Creer : guide 5 minutes |
| `docs/examples/workspace-setup.md` | Creer : exemple 1 |
| `docs/examples/foundry-training.md` | Creer : exemple 2 |
| `docs/examples/session-monitoring.md` | Creer : exemple 3 |

### Verification
```bash
# Relire chaque doc et verifier que les commandes fonctionnent reellement
# Suivre le Getting Started de zero sur une machine propre
# Resultat : chaque etape fonctionne sans blocage
```

---

## 45-D : Beta testing (3-5 testeurs)

### Ce que cette sous-phase fait

1. Recruter 3-5 testeurs (developpeurs familiers avec CLI tools)
2. Leur donner le Getting Started et les 3 exemples
3. Collecter du feedback structure (formulaire : install OK?, premiere conversation OK?, utilite perçue?)
4. Fixer les bugs bloquants trouves (max 2 jours)

### Fichiers cibles
| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-45/beta-feedback.md` | Creer : feedback compile des testeurs |
| `docs/phases/PHASE-45/beta-fixes.md` | Creer : liste des fixes appliques |

### Verification
```bash
# Gate : 3 testeurs externes installent et utilisent maestro-code avec succes
# Resultat : feedback compile, bugs critiques fixes, aucun testeur bloque a l'installation
```

---

## Definition of Done

```
[ ] `npm install -g @maestro/cli && maestro code` fonctionne
[ ] Sidecar demarre le backend automatiquement
[ ] `maestro init` cree la config dans un nouveau projet
[ ] Onboarding provider fonctionne au premier lancement
[ ] README utilisateur, Getting Started, 3 exemples publies
[ ] 3 testeurs externes ont installe et utilise avec succes
[ ] Tag v0.3.0-beta sur main
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-45/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 45 DONE — npm packaging, sidecar auto-start, onboarding, documentation, beta testing"
- Mettre a jour : "Active phase: 45 DONE. Next: Phase 46 (Cantante v1)"
