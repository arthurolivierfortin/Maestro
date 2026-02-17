# Issue 31-B-1 : Tests utilisateur sur Cantante

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 31-A complete

---

## Description

Tester `maestro code` comme un vrai utilisateur le ferait : ouvrir un terminal dans Cantante, lancer `maestro code`, donner des taches, observer les resultats.

---

## Scenarios de test

### Scenario 1 : Premiere utilisation (onboarding)

```bash
cd C:\Cantante
maestro code
```

- [ ] Le projet est detecte automatiquement
- [ ] Les docs `.maestro/` sont creees
- [ ] Le prompt est clair et accueillant
- [ ] Le temps d'initialisation est acceptable (< 30s)

### Scenario 2 : Tache simple

```bash
> Add a "version" field displaying the app version in the settings page
```

- [ ] L'agent comprend la tache
- [ ] Le plan est raisonnable
- [ ] L'implementation est correcte
- [ ] Les widgets montrent la progression
- [ ] Le commit est propre

### Scenario 3 : Tache avec question

```bash
> Improve the performance of the audio playback module
```

- [ ] L'agent identifie que la tache est vague
- [ ] Des questions ou hypotheses sont formulees
- [ ] Le plan est adapte (profiling avant optimisation)

### Scenario 4 : Interruption

```bash
> Refactor the entire state management
# Pendant l'execution :
> pause
# Attendre
> resume
```

- [ ] L'execution se met en pause proprement
- [ ] La reprise fonctionne sans perte de donnees

### Scenario 5 : Session reprise

```bash
# Quitter maestro code
# Relancer avec la meme session
maestro code --session <id>
```

- [ ] La session est chargee avec tout l'historique
- [ ] Le prompt est pret pour une nouvelle tache

---

## Journal de test

Documenter chaque scenario dans `content/user/experiments/phase-31-user-tests.md`.

---

## Critere de completion

- [ ] 5 scenarios testes
- [ ] >= 4/5 fonctionnent correctement
- [ ] Les problemes identifies sont documentes
- [ ] L'experience utilisateur est fluide (pas de crashes, pas de confusion)
