# 45-PREP-F : Dogfooding Profond

**Effort** : 0.5 jour
**Prerequis** : 45-PREP-E COMPLETE

---

## Lecture obligatoire

| Fichier | Pourquoi |
|---------|----------|
| `docs/guides/ai-agents/dogfooding-methodology.md` (Section 8 — lignes 1200-1412) | Protocole OBLIGATOIRE — structure de session, taches, scoring, comparaison CLI, anti-patterns. LIRE EN ENTIER. |
| `docs/phases/PHASE-45-PREP/checkpoint.md` | Relire les resultats des sous-phases precedentes — les bugs connus, les limites identifiees |
| `docs/phases/PHASE-45/STRATEGIC-ANALYSIS.md` | Rappel des decisions strategiques et du contexte |

---

## Garde-fous anti-regression (LIRE AVANT TOUT)

Ces regles existent a cause des erreurs repetees documentees dans `STRATEGIC-ANALYSIS.md` section 1.3.

**Regle 1 : NE PAS MODIFIER LE CODE PENDANT LE DOGFOODING.**
Le dogfooding est une session d'OBSERVATION et de NOTATION. Si un bug est trouve, le noter dans `dogfood-notes.md`. Ne PAS ouvrir un editeur. Ne PAS corriger le prompt. Ne PAS ajouter un slash command manquant. ZERO modification de code. Tout va dans `next-phase-items.md`. Le dogfooding est TERMINE quand les notes sont ecrites et le scoring est fait — pas quand tous les bugs sont fixes.

**Regle 2 : NE PAS TOUCHER AU SYSTEM PROMPT.**
Le prompt dans `system-prompt.md` a ete reecrit en 45-PREP-E pour etre un ORCHESTRATEUR CONVERSATIONNEL (pas un codeur). Il retire volontairement `file-write`, `file-edit`, et `run-block`. C'est intentionnel. Si l'agent refuse de coder, c'est le comportement ATTENDU. Ne PAS rajouter ces outils.

**Regle 3 : ACCEPTER UN SCORE < 3.5.**
Si le score moyen est < 3.5 : noter les dimensions faibles, documenter les problemes, et passer a Phase 45. Les corrections iront dans une iteration post-distribution. NE PAS boucler en refactoring pour atteindre 3.5. Un score de 3.0 avec une bonne liste de corrections est PLUS UTILE qu'un score de 3.8 obtenu apres 2 jours de refactoring.

**Regle 4 : AUCUNE MODIFICATION DE L'UX OU DE LA NAVIGATION.**
Les pages restent (Home, Agent, Spaces, Foundry, Catalog, Models). Les slash commands restent (/help, /new, /clear, /stop, /status, /quit). Si le dogfooding revele qu'une page est inutile ou qu'un raccourci manque — NOTER et continuer.

---

## Rappel : ce qu'on mesure

On ne mesure PAS si l'agent peut coder. On mesure :

1. **Peut-on avoir une conversation naturelle avec lui ?** (pas robotique, repond a tout)
2. **Confirme-t-il avant d'agir ?** (jamais d'execution silencieuse)
3. **Connait-il Maestro ?** (commandes CLI, templates, concepts)
4. **Enchaine-t-il les operations dans le bon ordre ?** (workspace → session → template → start → invoke)
5. **Est-ce plus rapide/agreable que le CLI manuel ?** (la question cle)

---

## Ce que cette sous-phase fait

### Pre-flight (10 min)

**Etape 0 : Demarrer les services**
```bash
powershell.exe -File C:\Meastro\dev-scripts\dev-start.ps1
# Attend que Backend (port 5000) et LLM Provider (port 5010) soient prets
```

**Etape 1 : Verifier les services**
```bash
# Backend tourne
curl -s http://localhost:5000/api/health
# Resultat : reponse OK

# LLM Provider tourne
curl -s http://localhost:5010/api/v1/health/
# Resultat : reponse OK
```

**Etape 2 : Tester l'agent**
```bash
cd C:\Meastro\packages\maestro-cli && node index.js code
# Envoyer "Salut"
# Resultat attendu : reponse naturelle et chaleureuse en < 15 secondes
# L'agent doit se presenter comme orchestrateur, pas comme codeur
```

Si un de ces checks echoue, fixer le probleme avant de continuer. Le dogfooding ne vaut rien si l'infra est instable.

**IMPORTANT : Le repo cible pour le dogfooding est Cantante a `C:\Cantante`.**

### Session de dogfooding (2h minimum)

Suivre EXACTEMENT la structure de Section 8.2 :

```
├── Tache 1 (30-45 min) — Workspace setup
│   ├── Demander a l'agent : "Set up un workspace pour Cantante et cree une session de dev pour ajouter un dark mode"
│   ├── Observer :
│   │   ├── L'agent confirme-t-il son plan avant d'executer ?
│   │   ├── Execute-t-il les commandes dans le bon ordre ?
│   │   ├── Le workspace est-il cree ? La session est-elle demarree ?
│   │   └── Rapporte-t-il le resultat clairement ?
│   ├── Noter : temps, erreurs, etapes inutiles
│   └── Comparer : combien de temps ca prend manuellement via CLI ?
│
├── Tache 2 (30-45 min) — Exploration et connaissances
│   ├── Demander : "Quels blocks sont disponibles pour du code generation ?"
│   ├── Demander : "Explique la difference entre une foundry session et une project session"
│   ├── Demander : "Quel template je devrais utiliser pour entrainer un agent de commit messages ?"
│   ├── Observer : qualite des explications, precision des reponses
│   └── Noter : a-t-il lu des fichiers pour se renseigner ? Ou a-t-il repondu de memoire (prompt) ?
│
├── Tache 3 (20-30 min) — Erreur et recuperation
│   ├── Demander : "Lance une session foundry pour le block 'block-inexistant'"
│   ├── Observer : l'agent detecte-t-il l'erreur ? Lit-il les logs ? Propose-t-il une alternative ?
│   ├── OU : arreter le LLM Provider pendant une tache et observer la recuperation
│   └── Noter : qualite du diagnostic, de l'explication, de la solution proposee
│
└── Assessment (15 min)
    ├── Remplir les scores (voir ci-dessous)
    ├── Ecrire le verdict honnete
    └── Lister les top 3 ameliorations
```

### Comparaison directe vs CLI manuel

Pour la Tache 1, faire AUSSI la meme operation manuellement :

```bash
# Manuellement via CLI :
cd C:\Meastro\packages\maestro-cli
node index.js workspace create --name "Cantante" --repo "C:\Cantante"
node index.js session create --name "Cantante - Dark Mode" --repo "C:\Cantante" --template project-autonomous --start
node index.js workspace add-session <workspace-id> <session-id>
node index.js session invoke <session-id> dev --input task="Add dark mode support" repoPath="C:\Cantante"
```

Chronometrer et noter :
- Temps agent vs temps CLI manuel
- Nombre d'erreurs agent vs CLI
- Connaissance Maestro requise (l'agent guide, le CLI exige de connaitre les commandes)
- Experience subjective (agreable vs penible)

### Scoring (10 dimensions)

Utiliser les dimensions EXACTES de Section 8.2 Step 3 :

| Dimension | Question | Score 1-5 |
|-----------|----------|-----------|
| **Conversation** | Puis-je avoir une conversation naturelle ? Repond-il aux questions generales ? | |
| **Confirmation** | Explique-t-il son plan et attend-il mon OK avant d'executer ? (JAMAIS d'execution silencieuse) | |
| **Understanding** | Comprend-il ce que je demande du premier coup ? | |
| **Maestro knowledge** | Connait-il les bonnes commandes CLI, templates, et workflows ? | |
| **Operation sequencing** | Enchaine-t-il les operations dans le bon ordre ? (workspace → session → template → start → invoke) | |
| **Completeness** | Termine-t-il le setup complet, ou laisse-t-il des choses a moitie configurees ? | |
| **Error handling** | Quand quelque chose echoue, diagnostique-t-il et recupere-t-il ? | |
| **Speed** | Est-ce plus rapide que le CLI manuel ? | |
| **Communication** | Explique-t-il ce qu'il fait clairement ? Rapporte-t-il les resultats ? | |
| **Daily use** | Est-ce que j'utiliserais ca tous les jours pour gerer mes workflows Maestro ? | |

**Guide de scoring** :
- 1 = Casse / inutile
- 2 = Fonctionne mais frustrant, je n'utiliserais pas
- 3 = Acceptable, mais le CLI manuel est aussi bien
- 4 = Bon, meilleur que le CLI pour certaines choses
- 5 = Excellent, meilleur que le CLI, je veux l'utiliser

**Seuil V1** : Moyenne >= 3.5. Aucune dimension < 2.

---

## Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `docs/phases/PHASE-45-PREP/dogfood-notes.md` | Creer : notes structurees du dogfooding selon le template de Section 8.3 |
| `content/system/blocks/system/maestro-assistant/system-prompt.md` | Modifier SI bugs trouves : ajustements post-dogfooding (uniquement si < 30 min de travail, sinon `next-phase-items.md`) |

---

## Verification

```bash
# Commande 1 : Les notes existent et sont substantielles
wc -l docs/phases/PHASE-45-PREP/dogfood-notes.md
# Resultat attendu : > 80 lignes (notes detaillees, pas superficielles)

# Commande 2 : Le score moyen est calcule
grep -i "average\|moyenne\|AVERAGE" docs/phases/PHASE-45-PREP/dogfood-notes.md
# Resultat attendu : Score visible, >= 3.5

# Commande 3 : La comparaison CLI existe
grep -i "manual\|CLI\|manuel" docs/phases/PHASE-45-PREP/dogfood-notes.md
# Resultat attendu : Section de comparaison present avec temps et verdict

# Commande 4 : Les tests passent toujours (rien casse par d'eventuels ajustements)
powershell.exe -Command "cd C:\Meastro\packages\maestro-code; npx vitest run tests/"
# Resultat attendu : Tous les tests passent (69+)
```

---

## Anti-patterns

- Ne PAS tester des taches de CODING — l'agent est un orchestrateur, pas un codeur. Tester "write a function" est hors-sujet et invalide le dogfooding.
- Ne PAS faire un dogfooding de 15 minutes et declarer "ca marche" — minimum 2h, 3 taches d'orchestration.
- Ne PAS inventer des scores — chaque dimension doit avoir une observation ecrite qui justifie le score. "Understanding: 4/5" sans explication est invalide.
- Ne PAS ignorer les bugs trouves — les documenter dans `dogfood-notes.md`. Les fixer immediatement si < 30 minutes, sinon les mettre dans `next-phase-items.md`.
- Ne PAS comparer avec Claude Code — comparer avec les commandes CLI Maestro manuelles. C'est le comparateur correct (meme operations, outils differents).
- Ne PAS declarer "100% success" — rapporter les echecs, les frustrations, les cas ou le CLI manuel est meilleur.
- Ne PAS faire le dogfooding en demo mode — utiliser le backend reel avec le LLM reel.

---

## Decision apres le dogfooding

| Score moyen | Decision |
|-------------|----------|
| >= 3.5, aucune dimension < 2 | **GATE PASSEE** — commit tag v0.2.0-alpha, Phase 45 peut commencer |
| 3.0 - 3.4 | **AMELIORATIONS MINEURES** — corriger le prompt, re-tester (max 1 jour) |
| < 3.0 | **BLOQUE** — creer Phase 45-PREP-B pour fixes agent, documenter les problemes |

---

## Checkpoint

```markdown
## 45-PREP-F : Dogfooding
**Statut** : DONE / BLOQUE
**Date** : YYYY-MM-DD
**Duree totale** : [heures:minutes]
**Taches completees** : [nombre] / 3 minimum
**Score moyen** : [X.X] / 5
**Dimension la plus haute** : [nom] = [score]
**Dimension la plus basse** : [nom] = [score]
**Comparaison vs CLI** : agent plus rapide / equivalent / plus lent (details dans dogfood-notes.md)
**Bugs trouves** : [nombre] — [liste courte]
**Bugs fixes** : [nombre]
**Decision** : GATE PASSEE / AMELIORATIONS MINEURES / BLOQUE
**Notes** : docs/phases/PHASE-45-PREP/dogfood-notes.md
```
