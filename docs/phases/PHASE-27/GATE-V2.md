# Gate V2 — Critères de passage vers V3

> Chaque critère doit être PASS avec une preuve vérifiable.
> On ne commence V3 tant que tous les critères ne sont pas PASS.

---

## Critères Template & Infrastructure UI

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G1 | **Widget registry fonctionnel** | Ajouter un widget custom par config JSON → visible dans le monitor | ⬜ |
| G2 | **Page registry fonctionnel** | Ajouter une page par config JSON → accessible dans le TUI | ⬜ |
| G3 | **Shared component library** | Mêmes composants (badges, tables, cards) dans TUI et Frontend | ⬜ |
| G4 | **Data binding unifié** | Widget lit données via binding (API, SignalR, variable) sans code custom | ⬜ |

## Critères Monitors vivants

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G5 | **Monitor Maestro temps réel** | Session invoke → changement visible dans le monitor < 500ms (SignalR push) | ⬜ |
| G6 | **Monitor LLM-Provider** | `maestro monitor --llm` → GPU usage, modèle actif, inférences en cours, métriques | ⬜ |
| G7 | **Status bar persistante** | En bas de chaque écran : backend health, LLM actif, session en cours, VRAM usage | ⬜ |
| G8 | **Auto-reconnection** | Couper le backend 5s → monitor affiche "Reconnecting..." → backend revient → données fraîches | ⬜ |
| G9 | **Refresh manuel** | Touche 'r' dans le monitor → refresh immédiat (pas attendre le polling) | ⬜ |

## Critères Frontend

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G10 | **Design system cohérent** | Couleurs, typographie, spacing identiques dans toutes les pages | ⬜ |
| G11 | **Dashboard fonctionnel** | Page d'accueil : quick actions, sessions en cours, health, métriques — tout cliquable | ⬜ |
| G12 | **Session detail page** | Page session : progression visuelle, logs, artifacts, métriques — données réelles | ⬜ |
| G13 | **Loading states** | Chaque page a un spinner/skeleton pendant le chargement | ⬜ |
| G14 | **Error states** | Chaque page a un message d'erreur contextuel avec action suggérée | ⬜ |
| G15 | **Empty states** | Chaque liste vide a un message guide ("Pas de sessions. Créez-en une →") | ⬜ |
| G16 | **Responsive 1280x720** | App utilisable à 1280x720 sans scroll horizontal ni éléments tronqués | ⬜ |

## Critères de qualité

| # | Critère | Preuve requise | Statut |
|---|---------|----------------|--------|
| G17 | **Breadcrumbs fonctionnels** | Navigation dans le monitor et le frontend avec fil d'Ariane | ⬜ |
| G18 | **Animations subtiles** | Transitions de page, apparitions, feedback visuel — pas de flash | ⬜ |
| G19 | **Monitor tous composants audités** | Variables, Filesystem, Widgets, CommandLog, tous les DetailViews — TOUS vérifiés | ⬜ |

---

## Résumé

| Section | Critères | PASS | FAIL | Restant |
|---------|----------|------|------|---------|
| Template & UI | G1-G4 | 0 | 0 | 4 |
| Monitors vivants | G5-G9 | 0 | 0 | 5 |
| Frontend | G10-G16 | 0 | 0 | 7 |
| Qualité | G17-G19 | 0 | 0 | 3 |
| **Total** | **19** | **0** | **0** | **19** |
