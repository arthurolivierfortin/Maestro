# Phase Template

**Usage** : Copier ce template pour creer le README.md d'une nouvelle phase.
**Regle** : Tout plan de phase DOIT suivre ce format. Les sections marquees `[OBLIGATOIRE]` ne peuvent pas etre omises.

---

```markdown
# Phase XX : [Titre court]

**Statut** : A faire | EN COURS | COMPLETE
**Prerequis** : Phase YY COMPLETE (verifier checkpoint.md de la phase YY)
**Objectif** : [UNE phrase. Pas de vision, pas de philosophie.]

---

## Regles pour l'agent executant [OBLIGATOIRE]

1. **Lire `docs/system/AGENT-PROTOCOL.md`** avant de commencer
2. **Lire les fichiers obligatoires** avant chaque sous-phase
3. **Ecrire dans `PHASE-XX/checkpoint.md`** apres chaque sous-phase
4. [Contraintes specifiques a la phase : pas de modif backend, pas de nouveau fichier, etc.]

---

## Sous-phases [OBLIGATOIRE]

| Phase | Titre | Effort |
|-------|-------|--------|
| XX-A | [Titre] | [Estimation] |
| XX-B | [Titre] | [Estimation] |
| XX-C | [Titre] | [Estimation] |
| XX-T | Tests | [Estimation] |

> **Regle 1** : Chaque sous-phase DOIT avoir son propre document `PHASE-XX-A.md`, `PHASE-XX-B.md`, etc. dans le dossier de la phase.
> Le README.md contient la vue d'ensemble. Les sous-phase docs contiennent le detail complet (lecture obligatoire, actions, verification, anti-patterns, checkpoint).
>
> **Regle 2 — Sous-phase de tests OBLIGATOIRE** : Toute phase qui ajoute des fonctionnalites DOIT inclure une sous-phase dediee aux tests (generalement la derniere, nommee `XX-T`).
> Cette sous-phase couvre **chaque couche applicable** du Testing Protocol (`docs/system/TESTING-PROTOCOL.md`) :
>
> | Couche | Quand obligatoire |
> |--------|-------------------|
> | C1 — Type Check | Toujours |
> | C2 — Tests unitaires | Toujours (1 test minimum par feature ajoutee) |
> | C3 — Visual Gate (PTY) | Si TUI modifie |
> | C4 — Real Demo Check | Si TUI modifie |
> | C5 — Tests d'integration | Si backend/API/SDK modifie |
> | C6 — E2E Dogfooding | En fin de phase (sous-agent separe) |
>
> La sous-phase de tests DOIT lister : quelles couches s'appliquent, quels tests creer, quels scenarios couvrir.
> **Ne PAS planifier de features sans planifier leurs tests.** Une phase sans sous-phase de tests est invalide.

---

## XX-A : [Titre] [OBLIGATOIRE — repeter pour chaque sous-phase]

> Ce qui suit est le contenu du fichier `PHASE-XX-A.md` (un fichier par sous-phase).

### Lecture obligatoire [OBLIGATOIRE]
- `chemin/vers/fichier1.ts` — [pourquoi le lire : "comprendre le pattern de commandes"]
- `chemin/vers/fichier2.md` — [pourquoi le lire]

### Ce que cette sous-phase fait [OBLIGATOIRE]
1. [Action concrete avec chemin de fichier]
2. [Action concrete avec chemin de fichier]
3. [Action concrete avec chemin de fichier]

### Fichiers a modifier/creer [OBLIGATOIRE]
| Fichier | Action |
|---------|--------|
| `chemin/exact/fichier.ts` | [Ajouter/Modifier/Creer — avec description precise] |

### Verification [OBLIGATOIRE]
```bash
# Commande 1 : [description de ce qu'on verifie]
[commande exacte]
# Resultat attendu : [description]

# Commande 2 : [description]
[commande exacte]
# Resultat attendu : [description]
```

### Anti-patterns [OBLIGATOIRE]
- Ne PAS [action interdite] — [pourquoi]
- Ne PAS [action interdite] — [pourquoi]

### Checkpoint [OBLIGATOIRE]
```markdown
## XX-A : [Titre]
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**[Metrique 1]** : [format attendu]
**[Metrique 2]** : [format attendu]
**Verification** : [quel output copier]
```

> **Si cette sous-phase est un dogfooding gate**, utiliser le format de checkpoint etendu ci-dessous a la place.

### Checkpoint etendu — Dogfooding Gate [si applicable]

Utiliser ce format pour toute sous-phase de dogfooding ou gate de validation.
Tous les champs sont OBLIGATOIRES. Un champ vide = sous-phase invalide.

```markdown
## XX-F : Dogfooding Gate
**Statut** : DONE / BLOQUE / INVALIDE
**Date** : YYYY-MM-DD
**Heure debut** : HH:MM
**Heure fin** : HH:MM
**Duree reelle** : X min  ← calculee, pas estimee. < 120 min = gate invalide, recommencer.

**Pre-flight Level 1** : PASS / FAIL / NON VERIFIE
  ← FAIL ou NON VERIFIE = resultats invalides. Ne pas continuer.
  ← Outil utilise : [nom exact du PTY driver, ex: TuiDriver via tests/tui-driver.ts]

**Methode d'interaction** : TuiDriver PTY / curl / API directe / autre
  ← Toute methode autre que PTY = resultats invalides. curl ≠ dogfooding.

**Frames captures** : OUI ([N] frames) / NON
  ← NON = scores invalides. Chaque dimension notee doit avoir un frame capture.

**Contexte du sous-agent** : Isole (n'a pas lu les sous-phases de build) / Contamine (a lu A-E)
  ← Contamine = scores biaises, noter explicitement.

**Score moyen** : X.X / 5
**Dimension la plus haute** : [nom] = [score]
**Dimension la plus basse** : [nom] = [score]
**Comparaison vs alternative** : [agent plus rapide / equivalent / plus lent + details]
**Bugs trouves** : [nombre] — [liste courte]
**Decision** : GATE PASSEE / AMELIORATIONS MINEURES / BLOQUE
**Notes completes** : [chemin vers dogfood-notes.md]
```

---

## Gestion de la memoire [OBLIGATOIRE]

### Checkpoint global
Fichier `docs/phases/PHASE-XX/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "[description concise de ce qui a change]"
- Retirer : "[entries devenues obsoletes]"
```

---

## Checklist de validation du plan

Avant de publier un plan, verifier :

- [ ] Chaque sous-phase a son propre fichier `PHASE-XX-A.md` (pas tout dans le README)
- [ ] Une sous-phase de tests (XX-T) existe et couvre chaque couche applicable du Testing Protocol
- [ ] La sous-phase de tests liste les tests a creer et les scenarios a couvrir
- [ ] Chaque sous-phase a "Lecture obligatoire" avec des chemins reels (pas de placeholders)
- [ ] Chaque sous-phase a "Fichiers a modifier" avec des chemins exacts
- [ ] Chaque sous-phase a "Verification" avec des commandes executables
- [ ] Chaque sous-phase a "Anti-patterns" (minimum 2)
- [ ] Chaque sous-phase a un format de "Checkpoint"
- [ ] Les sous-phases sont independantes (pas de "voir XX-A" dans XX-B sans checkpoint)
- [ ] Aucune phrase vague ("ameliorer", "optimiser", "nettoyer") sans detail concret
- [ ] Le plan reference AGENT-PROTOCOL.md dans les regles
- [ ] La section "Gestion de la memoire" existe
- [ ] Si la phase inclut un dogfooding gate : sous-agent separe prevu (voir Regle 2e de AGENT-PROTOCOL.md), methode PTY nommee explicitement dans le sub-phase doc, checkpoint etendu utilise

## Niveaux de detail requis

| Phase future (>2 phases d'ici) | Phase proche (1-2 phases d'ici) | Phase active |
|---|---|---|
| Vision + sous-phases + effort | + Fichiers cibles + verification | + Lecture obligatoire + Anti-patterns + Checkpoint |
| Ex: Phase 35-37 | Ex: Phase 33-34 | Ex: Phase 31-32 |

Les phases lointaines n'ont PAS besoin du detail complet — il sera ajoute quand elles deviennent proches. Ecrire du detail trop tot = detail obsolete quand on y arrive.
