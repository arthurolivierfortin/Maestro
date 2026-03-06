# Phase 60 : Catalogue communautaire + Auth

**Statut** : Planifie
**Prerequis** : Phase 59 COMPLETE (choix par contract au setup, Catalog organise)
**Objectif** : Les utilisateurs peuvent publier et importer des blocks. Le catalogue est organise par **contract** : on cherche "un code-reviewer" et on voit toutes les implementations disponibles avec leurs capabilities et compatibilite hardware. Systeme d'auth pour identification.
**Duree estimee** : 8-13 jours

---

## Contexte

### Le catalogue enrichi par les contracts

Le catalogue n'est plus une liste plate de blocks. C'est un **marche organise par contracts** :

```
Catalogue communautaire
│
├── maestro-assistant (contract)
│   ├── maestro-assistant-claude (5/5 features, cloud, fitness 0.95) [official]
│   ├── maestro-assistant-mistral7b (3/5 features, local, fitness 0.82) [official]
│   ├── maestro-assistant-phi3-community (2/5 features, light, fitness 0.68) [community]
│   └── ...
│
├── code-reviewer (contract)
│   ├── code-reviewer-claude (cloud, fitness 0.90) [official]
│   ├── code-reviewer-deepseek (local, fitness 0.75) [community]
│   └── ...
│
├── agent-creator (contract)
│   └── agent-creator-opus (cloud, fitness 0.88) [official]
│
└── doc-writer (contract)
    ├── doc-writer-claude (cloud) [official]
    └── doc-writer-llama (local) [community]
```

L'utilisateur cherche par role (contract), filtre par hardware, compare les capabilities.

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 58-A | Auth + comptes utilisateurs | 3-5 jours |
| 58-B | Catalogue backend (publish/search/import par contract) | 3-5 jours |
| 58-C | TUI integration (local + community, par contract) | 2-3 jours |

---

## 58-A : Auth + comptes utilisateurs

### Taches

1. **Auth** : locale d'abord (bcrypt), OAuth GitHub en stretch goal, JWT + refresh tokens
2. **Comptes** : profil, blocks publies, tiers (Free/Creator/Pro), SQLite
3. **CLI** : `maestro login`, `maestro logout`, `maestro whoami`
4. **TUI** : login optionnel dans setup, indicateur dans NavBar, `/login` `/logout`

---

## 58-B : Catalogue backend

### Taches

1. **API** :
   ```
   POST /api/catalog/publish         — publie un block + contract + capabilities + fitness
   GET  /api/catalog/search          — recherche par contract, capabilities, tier, hardware
   GET  /api/catalog/contracts       — liste les contracts disponibles
   GET  /api/catalog/contracts/:id   — implementations d'un contract
   GET  /api/catalog/blocks/:id      — detail d'un block
   POST /api/catalog/import/:id      — importe dans l'espace utilisateur
   ```

2. **Recherche par contract** :
   - "Je cherche un code-reviewer compatible avec mon GPU 8GB"
   - Filtre par : contract, capabilities, hardware, fitness minimum
   - Trie par : fitness, popularite, date

3. **Publication** :
   - Block + contract declaration + capabilities verifiees + fitness
   - Si le contract n'existe pas dans le catalogue → le creer
   - Validation : fitness >= 0.7, capabilities verifiees

4. **Stockage** : filesystem local V1, API distante future

---

## 58-C : TUI integration

### Taches

1. **Catalog enrichi** :
   - Onglets : Local | Community | All
   - Vue par contract (groupes) ou vue plate (liste)
   - Recherche, filtrage hardware, filtrage par capabilities
   - `[I]` Import, `[P]` Publish

2. **Slash commands** : `/publish`, `/import`, `/search`

3. **Import intelligent** :
   - Importer un block → il s'ajoute aux implementations du contract
   - L'utilisateur peut le choisir comme actif pour ce contract

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] Auth fonctionnel
- [ ] API catalogue avec recherche par contract + capabilities + hardware
- [ ] Catalogue organise par contracts
- [ ] Publication avec contract + capabilities verifiees
- [ ] Import + activation pour un contract
- [ ] 5+ blocks publies par nous
- [ ] Tous les tests passent
- [ ] E2E dogfooding score >= 3.5/5

### NOT in scope
- Hosting cloud, paiements, reviews/ratings, marketplace (futur)
