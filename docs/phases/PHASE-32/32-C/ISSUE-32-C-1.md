# Issue 32-C-1 : Selection automatique de tier dans maestro code

**Statut** : A faire
**Estimation** : 2-3 heures
**Prerequis** : 32-B-2 (maestro check), 31-A-2 (selection d'agent)

---

## Description

Integrer la logique de `maestro check` dans `maestro code` pour selectionner automatiquement le meilleur tier disponible au lancement.

---

## Tache

### 1. Au lancement de `maestro code`

```
$ maestro code

  Detecting available models...
  ✓ Claude Opus — available
  ✓ Claude Sonnet — available
  ✓ Claude Haiku — available
  ✓ Qwen2.5-Coder (local) — available

  Selected: autonomous-dev Tier 1 (fitness 0.92)
  [Press Enter to accept, or type a tier number to override]
  > _
```

### 2. Override manuel

L'utilisateur peut forcer un tier :

```bash
maestro code --tier 3          # Forcer le Tier 3
maestro code --local           # Forcer le meilleur tier local
maestro code --cheap           # Forcer le tier le moins cher
```

### 3. Persistance de la preference

Si l'utilisateur a un `.maestro/config.json` avec une preference de tier :

```json
{
  "defaultTier": "auto",       // auto | 1 | 2 | 3 | 4 | 5 | local | cheap
  "preferLocal": false
}
```

---

## Instructions de test

### Test 1 : Selection automatique

```bash
maestro code
# Doit detecter les modeles et selectionner le meilleur tier
```

- [ ] Les modeles sont listes
- [ ] Le meilleur tier est selectionne
- [ ] Le fitness est affiche

### Test 2 : Override

```bash
maestro code --tier 3
```

- [ ] Le Tier 3 est utilise meme si Tier 1 est disponible

### Test 3 : Modeles indisponibles

```bash
# Simuler : LLM-Provider ne retourne que Qwen
maestro code
```

- [ ] Le meilleur tier compatible est selectionne (probablement Tier 5)
- [ ] Un avertissement est affiche si le fitness est < 0.70

---

## Critere de completion

- [ ] Detection automatique des modeles au lancement
- [ ] Selection du meilleur tier compatible
- [ ] Override via `--tier`, `--local`, `--cheap`
- [ ] Preference persistante dans `.maestro/config.json`
- [ ] Avertissement si le tier selectionne a un fitness faible
- [ ] L'agent utilise effectivement les modeles du tier selectionne
