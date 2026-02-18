# Phase 37+ : Futur (Marketplace, Auth, Cloud)

**Statut** : Planification long-terme
**Prerequis** : Phase 36 COMPLETE (premiere version distribuee, feedback beta)
**Objectif** : Evoluer de produit solo vers plateforme communautaire.

---

## Phases futures (ordre indicatif)

### Phase 37 : Catalogue communautaire

- Les utilisateurs publient leurs blocks/workflows
- Catalogue centralise (`maestro catalog --remote`)
- Systeme de rating/reviews base sur le fitness mesure
- Installation en une commande : `maestro install <block-id>`

### Phase 38 : Auth et subscriptions

- Connexion GitHub/Google
- Tiers gratuit : blocs locaux, catalogue en lecture seule
- Tiers payant : publication au catalogue, evaluateur cloud, modeles Maestro heberges
- Gestion des API keys dans le CLI

### Phase 39 : Evaluateur cloud

- Service Maestro cloud qui evalue les blocs avec Claude/GPT-4
- Evaluateur de Niveau 3 (le plus precis)
- Permet aux utilisateurs sans gros GPU d'avoir des evaluations de qualite
- Modele freemium : X evaluations gratuites/mois, ensuite payant

### Phase 40 : Agent Creator

- Un agent qui cree d'autres agents (meta-programmation)
- L'utilisateur decrit un workflow en langage naturel
- L'agent orchestre la foundry : cree les blocs, les entraine, mesure le fitness, publie
- Le sommet de la pyramide Maestro : le systeme se construit lui-meme

### Phase 41+ : Multi-domaine

- Workflows pour la traduction, documentation, musique, design
- Templates specialises par domaine
- Communaute de createurs de workflows

---

## Note

Ces phases sont des directions, pas des plans detailles. Leur contenu sera
defini quand les phases precedentes seront terminees et que le feedback
des beta testeurs aura ete integre.

La priorite est toujours : **profondeur avant largeur.**
