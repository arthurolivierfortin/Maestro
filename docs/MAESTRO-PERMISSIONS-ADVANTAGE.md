# Maestro : Avantage de la gestion des permissions des agents

## Problème avec l'infrastructure traditionnelle

Dans une infrastructure classique (ex. : repo Money), pour restreindre les permissions d'un agent IA, on doit recourir à des **conteneurs isolés**. Chaque agent tourne dans son propre conteneur avec des accès contrôlés au niveau de l'infrastructure. Cela entraîne :

- **Complexité de déploiement** : Plusieurs conteneurs à orchestrer, chacun avec ses propres configurations réseau, volumes, et secrets.
- **Gestion de clés API multiples** : Pour restreindre un agent sur GitHub par exemple, il faut créer une clé API permettant uniquement la création d'issues et une autre clé en lecture seule pour le repo. Chaque niveau de permission nécessite sa propre clé.
- **MCP Servers intermédiaires** : Les agents doivent passer par un MCP Server qui agit comme proxy de contrainte. Par exemple, pour limiter un agent aux issues GitHub, il faut configurer un MCP Server dédié qui filtre les appels autorisés. Cela ajoute une couche d'infrastructure supplémentaire à maintenir.

### Exemple concret (infra traditionnelle)

Pour qu'un agent puisse uniquement créer des issues GitHub :

1. Créer une clé GitHub avec le scope `issues: write`
2. Créer une autre clé avec le scope `repo: read` (lecture seule)
3. Configurer un MCP Server qui expose uniquement les endpoints d'issues
4. Déployer le MCP Server dans un conteneur dédié
5. Configurer l'agent pour passer par ce MCP Server
6. Gérer le cycle de vie du conteneur, ses logs, sa sécurité

## L'approche Maestro

Dans Maestro, la gestion des permissions se fait **au niveau du backend, dans un seul conteneur**. Le backend agit comme orchestrateur central et contrôle directement quels outils (tools) sont disponibles pour chaque agent.

### Comment ça fonctionne

- Chaque agent se voit attribuer une liste explicite de **tools** dans sa définition de bloc.
- Le backend n'expose à l'agent que les tools qui lui sont assignés.
- Pas besoin de conteneurs multiples, de clés API séparées, ni de MCP Servers intermédiaires.

### Exemple concret (Maestro)

Pour qu'un agent puisse uniquement créer des issues GitHub :

1. Assigner le tool `create_issue` à l'agent dans sa configuration de bloc
2. C'est tout.

L'agent n'a accès à rien d'autre que ce qui lui est explicitement donné.

## Comparaison

| Aspect | Infrastructure traditionnelle | Maestro |
|--------|-------------------------------|---------|
| Isolation des permissions | Conteneurs séparés par agent | Backend centralisé, un seul conteneur |
| Gestion des clés API | Multiple clés avec scopes différents | Pas nécessaire, le backend contrôle l'accès |
| MCP Server intermédiaire | Requis pour filtrer les appels | Non requis, filtrage natif |
| Complexité de configuration | Élevée (infra + secrets + réseau) | Faible (liste de tools dans le bloc) |
| Overhead opérationnel | Élevé (N conteneurs à maintenir) | Minimal (un seul backend) |
| Granularité du contrôle | Au niveau du conteneur/clé API | Au niveau du tool individuel |

## Conclusion

Maestro simplifie radicalement la gestion des permissions des agents en déplaçant le contrôle d'accès de l'infrastructure (conteneurs, clés, proxies) vers la couche applicative (assignation de tools). Cela réduit la complexité, les coûts d'infrastructure, et les risques de mauvaise configuration.
