# Phase 52 : Catalogue communautaire + Auth

**Statut** : Planifie
**Prerequis** : Phase 51 COMPLETE (Agent Creator, fitness engine integre)
**Objectif** : Les utilisateurs peuvent publier et importer des blocks, agents et workflows. Un systeme d'auth permet l'identification et les subscriptions.

---

## Contexte

### Pourquoi apres l'Agent Creator ?

L'Agent Creator (Phase 51) permet a des utilisateurs de creer des agents personnalises. Le catalogue communautaire est le lieu ou ces agents sont partages, decouverts, et reutilises. Sans le creator, le catalogue serait vide car peu d'utilisateurs ecrivent du block JSON a la main.

### Ce qui existe deja

| Composant | Statut |
|-----------|--------|
| Block discovery (`FileSystemBlockDiscoveryService`) | Stable — scan local de `content/system/blocks/` et user blocks |
| Block metadata (tier, tags, category, capabilities) | Phase 49 |
| Fitness engine + scores | Phase 50 |
| Publish flow (workspace → foundry → test → publish) | Phase 31 (CLI) |
| Page Catalog dans maestro-code | Phase 42 (lecture seule, liste de blocks) |

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 52-A | Auth + comptes utilisateurs | 3-5 jours |
| 52-B | Catalogue backend (publish/import API) | 3-5 jours |
| 52-C | TUI integration catalogue | 2-3 jours |

---

## 52-A : Auth + comptes utilisateurs

### Taches

1. **Systeme d'auth** :
   - Auth locale (username/password hash) pour le debut
   - OAuth (GitHub) comme stretch goal
   - JWT tokens pour les sessions API

2. **Comptes** :
   - Profil utilisateur (nom, email, blocks publies)
   - Tiers : Free (catalogue en lecture), Creator (publier), Pro (fitness cloud)
   - Stockage dans SQLite ou fichiers JSON (pas de DB externe pour V1)

3. **CLI** :
   ```bash
   maestro login
   maestro logout
   maestro whoami
   ```

4. **TUI** :
   - Ecran de login dans le setup flow (optionnel — on peut utiliser Maestro sans compte)
   - Indicateur de connexion dans la status bar

---

## 52-B : Catalogue backend

### Taches

1. **API de publication** :
   ```
   POST /api/catalogue/publish     ← publie un block + metadata + fitness score
   GET  /api/catalogue/search      ← recherche par tags, capabilities, tier
   GET  /api/catalogue/block/:id   ← detail d'un block publie
   POST /api/catalogue/import/:id  ← importe un block dans le workspace local
   ```

2. **Metadata enrichie** :
   - Fitness score du publisher
   - Capabilities testees (de Phase 49)
   - Hardware requirements
   - Compatibilite modeles (quels modeles ont ete testes avec ce block)
   - Reviews et ratings (futur)

3. **Stockage** :
   - Phase 1 : fichiers sur le filesystem (JSON + block files)
   - Phase 2 : service distant (API REST, cloud storage)
   - Le catalogue est un block store comme les autres — meme interface que `FileSystemBlockDiscoveryService`

4. **Filtrage hardware-aware** :
   - L'utilisateur cherche "code reviewer agent"
   - Le catalogue filtre par : modeles compatibles avec son hardware (de Phase 49)
   - Affiche : "Compatible with your GPU (RTX 4070, 12GB VRAM)" ou "Requires cloud provider"

---

## 52-C : TUI integration

### Taches

1. **Enrichir la page Catalog** :
   - Onglets : Local | Community
   - Recherche par texte, tags, capabilities
   - Filtrage par "compatible avec mon hardware"
   - Preview d'un block (description, fitness, capabilities, requirements)
   - [I] Import — telecharge et ajoute au workspace

2. **Publication depuis le TUI** :
   - `/publish <block-id>` — publie sur le catalogue
   - Affiche le fitness score et demande confirmation
   - Le block doit avoir un fitness >= 0.7 pour etre publie

---

## Definition of Done

- [ ] Auth fonctionnel (login/logout/JWT)
- [ ] API catalogue : publish, search, import
- [ ] Page Catalog enrichie (local + community, recherche, filtrage hardware)
- [ ] Publication depuis CLI et TUI
- [ ] Import depuis le catalogue
- [ ] Filtrage hardware-aware dans la recherche
- [ ] 3+ blocks publies dans le catalogue par le developpeur principal (exemples)

### NOT in scope
- Paiement / subscriptions reelles (Phase future)
- Hosting cloud du catalogue (Phase future — filesystem d'abord)
- Reviews et ratings (Phase future)
- Marketplace (Phase future)
- Self-improvement loop (Phase 53)
