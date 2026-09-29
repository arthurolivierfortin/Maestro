# Reprise de Maestro : le moteur d'abord

Date : 2026-09-29. Auteur : le pilote du cockpit, à la demande d'Arthur, à partir de son courriel et de la table des matières du workshop IA (septembre 2026) et d'un inventaire complet du dépôt. **À lire en premier quand le projet reprend.** Ce document ne remplace ni la philosophie (`docs/system/philosophy/`) ni les ADR : il dit ce qu'on garde, ce qu'on gèle, ce qu'on construit, dans quel ordre, et pourquoi.

## 1. La décision

Maestro n'est plus une application avec un moteur dedans. **Maestro est le moteur.** Son but : on lui donne le contrat d'un workflow ou d'un agent, les entrées, les sorties attendues, les actions permises, les critères d'acceptation et un budget, et il construit l'intérieur, le teste contre le contrat et l'optimise en boucle jusqu'au meilleur rapport qualité sur coût. Il en sort le workflow gagnant, versionné, et ses métriques.

Conséquences, dans l'ordre d'Arthur :

1. Tout ce qui est interface, comptes, espaces de travail, sessions, conversation, approbations, tableaux de bord est **gelé**. Pas supprimé : gelé. Aucune issue n'y avance tant que le moteur n'est pas solide.
2. Le moteur doit être **utilisable comme un outil par Claude** sur les projets d'Arthur : depuis une session Claude Code, on lance Maestro sur un contrat de Marcel ou de NATHAN, et il rend les métriques et le meilleur workflow.
3. Quand le moteur est solide et testé, on refait les **agents de base** (créateur de contrat, concepteur de tests, forge de blocs) sur lui, puis un agent de build optimisé par Maestro, et ainsi de suite.
4. En parallèle, pour débloquer Marcel, le package d'agents copié de NATHAN (`agent-core`) termine son harnais. Les deux se rejoignent plus tard par un format commun, pas par une fusion de code (§6).
5. Si le dépôt actuel pèse trop, on repart plus petit à partir des modules déjà testés (§7).

## 2. Le problème que le moteur résout

Le workshop le pose en une phrase : aux niveaux 2 et 3 d'autonomie, **le goulot n'est plus la puissance du modèle, c'est le coût et la fiabilité**. On ne peut pas mettre le plus gros modèle partout. Dès qu'on optimise, on descend de modèle, et l'hallucination ressort. La réponse n'est pas un meilleur prompt : c'est un cadre où l'entrée et la sortie sont fixées par des portes qu'on a écrites, et où l'intérieur peut changer, de modèle, d'outil, de découpage, sans qu'on refasse le workflow. Un workflow livré aujourd'hui doit survivre au prochain modèle et au prochain outil.

Optimiser un workflow, dans ce cadre, veut dire précisément : le même résultat avec moins de tokens ; moins de pouvoir laissé au modèle, donc plus de déterminisme, plus de testabilité, plus de sûreté ; une deuxième couche de contrôle qui ne dépend pas du premier modèle. Les deux protocoles d'Arthur (sécurité, probabilité d'hallucination, niveau d'optimisation) en font des matrices à valeurs. **Ce sont ces matrices qui deviennent les critères d'acceptation du moteur** : ce que l'équipe apprend au workshop, la machine l'applique à chaque agent.

Ce travail se fait aujourd'hui à la main, en six semaines par agent chez Kersia. Le moteur le fait en jours, et l'agent en sort optimisé au maximum, ce qu'un humain en six semaines ne fait pas. La seule chose qui reste à écrire à la main, ce sont les entrées et les sorties.

## 3. Ce que Maestro a déjà, mesuré sur le dépôt

Le dépôt compte 495 commits, environ 61 500 lignes de C# et 510 tests xUnit, presque tous sur le moteur. Le principe fondateur tient : **tout est un bloc** (`*.block.json`), agent, workflow, outil et inférence compris ; un agent est un workflow multi-nœuds (ADR-BLOCKS-ARE-THE-UNIVERSAL-UNIT, ADR-AGENT-AS-WORKFLOW).

Fonctionnel et testé, à garder tel quel :

| Brique | Où | État |
|---|---|---|
| Découverte, validation par schéma et dépendances des blocs | `Maestro.Infrastructure/BlockStore/` | fonctionnel, testé |
| Exécuteurs : multi-nœuds, agent, inférence, outils, MCP, fichiers, shell, contrats | `Maestro.Infrastructure/BlockExecutors/` (43 fichiers) | fonctionnel, bien testé |
| Moteur de graphe : nœuds, conditions, variables, boucles | `Maestro.Infrastructure/Sessions/NodeExecutionEngine.cs` et `NodeHandlers/` | fonctionnel |
| Contrats : features pondérées, capacités, tests, huit types de vérification, `minimumFitness` | `docs/system/architecture/contracts.md`, `content/system/contracts/` (11), `Testing/ContractTestRunner.cs` | fonctionnel |
| Permissions : autoriser, refuser, exiger approbation ; règles de fichiers ; enfant ⊆ parent | `Maestro.Domain/ValueObjects/BlockPermission.cs`, `FileAccessChecker` | fonctionnel, 82 tests |
| Coûts : suivi, tarifs par modèle, plafonds durs, reprise | `Pricing/CostTrackingService.cs`, `ModelPricingService`, `CostLimits` | fonctionnel, testé |
| Fitness : P×S×W divisé par les coûts normalisés à la puissance λ | `Maestro.Domain/ValueObjects/FitnessScore.cs`, `Fitness/FitnessService.cs` | fonctionnel, peu testé |
| Bac à sable par worktree git | `Sandbox/GitWorktreeSandboxManager.cs`, `maestro-cli/sandbox-manager.ts` | fonctionnel |
| Passerelle de modèles : Anthropic, Azure, Azure Inference, Claude Code, GitHub Models, local | `llm-provider/`, `LLMGateway/LLMProviderGateway.cs` | fonctionnel ; routage par priorité manquant |
| Premières stratégies d'optimisation : descente de modèle, réglage de température, mode récursif | `packages/maestro-cli/adapt-optimize.ts` (944 lignes) | fonctionnel mais rudimentaire |

Partiel ou vide, à réécrire plutôt qu'à garder :

- **La boucle de recherche** : `Research/ResearchTeamService.cs` n'est qu'une suite de TODO et une fitness simulée (`0.88`) ; `Orchestration/OrchestratorService.cs` (promotion, retour arrière) est un stub avec des constantes. C'est exactement la pièce que la reprise construit.
- **La fitness d'`adapt-optimize` est binaire** (réussi ou non par point de contrôle) : elle ne mesure ni un score par feature, ni un taux sur N exécutions, ni la variance. `docs/TODOS/FEATURE-fitness-engine-evaluator.md` le reconnaît.
- **La génération de workflows** (`block-forge`, `contract-definer`, `test-designer`, `agent-creator`) : `contract-definer` passe ses 12 tests, mais à 2,57 $ l'exécution et une fitness de 0,135 ; la chaîne complète est reportée à la phase 72.
- **L'entraînement** (`Training/TrainingService.cs`, évaluateurs heuristique, LLM, composite) : structure présente, jeux de données absents.
- Bugs connus (`docs/V1-BUGS.md`) : le coût d'un parent reste à zéro quand il a des sessions enfants ; pas de routage par priorité.

Ballast, à geler ou à sortir du chemin :

- `apps/desktop` (mort depuis février), `packages/maestro-code`, `tui`, `maestro-monitor`, `provider-monitor` (maintenance depuis mars), `apps/code` (l'effort de mai, phases 66) ;
- les entités et contrôleurs Workspace, ProjectSession, FoundrySession, ContainerSession, Conversation, PendingBlockApproval ;
- `mock/`, les journaux à la racine (`backend.log`, 4 Mo), `test-repos/` (à garder comme fixtures, pas comme code), `.maestro/sessions` versionnées, environ 90 dossiers de phases sous `docs/phases/` ;
- 216 fichiers qui codent en dur l'ancien chemin `C:\Meastro` ;
- aucune intégration continue ; `.github/` ne contient que des instructions Copilot.

Ce que le dépôt ne contient pas, malgré le courriel : le mot « auto-research » n'apparaît nulle part. L'équivalent est l'« Équipe de recherche » de `MAESTRO-PHILOSOPHY-V2.md` §5 : évaluer, améliorer, entraîner, documenter, publier, et « le nouvel entraîneur remplace l'ancien s'il a une meilleure fitness ». La vision est là ; le code de la boucle, non.

## 4. Le moteur cible, défini précisément

### 4.1 Le contrat, ce que l'humain écrit

Un contrat est un fichier versionné, relu en PR comme du code. Il porte :

- **Entrées** : schéma JSON des données que reçoit le workflow.
- **Sorties** : schéma JSON de ce qu'il doit rendre.
- **Actions permises** : la liste fermée des outils que l'intérieur a le droit d'appeler, avec leurs permissions (lecture, écriture, approbation requise), héritées vers tout sous-agent. Ce qui n'est pas listé est refusé par construction : c'est la frontière du niveau 2.
- **Critères d'acceptation** : une suite de tests, chacun avec son entrée, ses vérifications déterministes (les huit types existants : non vide, contient, JSON valide, appel d'outil attendu, expression régulière…) et, quand le texte compte, un juge par modèle avec une grille ancrée ; des features pondérées avec un score minimal par feature ; un **taux** minimal sur N exécutions, parce qu'un modèle non déterministe se juge en fréquence.
- **Budget** : coût maximal par exécution, latence maximale, coût maximal de la recherche elle-même.
- **Niveaux visés** des matrices des protocoles : sécurité, probabilité d'hallucination, optimisation. Le moteur ne publie pas un candidat qui ne les atteint pas.

Le format actuel (`*.contract.json` : features, tests, checks, `minimumFitness`, plus `*.test-suite.json`) couvre déjà les critères. Il manque les **actions permises**, le **budget** et les **niveaux**. Les permissions existent dans le domaine (`BlockPermission`) mais vivent à côté du contrat ; la reprise les met dedans.

### 4.2 L'espace de recherche, ce que le moteur a le droit de changer

Tout ce qui est à l'intérieur de la frontière :

- le modèle de chaque nœud (le premier levier de coût) et sa température ;
- le prompt système et le format de réponse ;
- le **découpage** : un seul appel de modèle contre plusieurs étapes dont certaines déterministes ; c'est le levier qui rend un workflow plus sûr, pas seulement moins cher ;
- la stratégie de contexte (fenêtre glissante, résumé, couches) ;
- les outils exposés parmi ceux permis, et l'ajout d'un validateur indépendant en sortie (la deuxième couche de contrôle du workshop) ;
- les reprises et le budget d'itérations.

Le moteur ne touche jamais au contrat. S'il ne trouve aucun candidat qui le satisfait dans le budget, il le dit, avec la meilleure approche trouvée et ce qui a manqué.

### 4.3 La boucle

1. **Amorcer** : un candidat de départ, donné ou généré (un bloc existant, ou le plus simple : un nœud d'inférence avec le prompt du contrat).
2. **Exécuter** : chaque candidat tourne dans un bac à sable, contre la suite de tests, **N fois** ; les actions passent par les exécuteurs d'outils, jamais en direct.
3. **Mesurer** : par exécution, réussite par test et par feature, tokens en entrée et en sortie, coût réel au tarif du jour, durée, itérations, appels d'outils hors liste (zéro attendu), détections d'hallucination par les vérifications et le juge. Tout est écrit dans un journal de runs, jamais édité.
4. **Noter** : la fitness existante, qualité pondérée divisée par le coût normalisé, mais avec la qualité mesurée en **taux sur N** et par feature, plus les contraintes dures (budget, niveaux, permissions) qui éliminent avant de noter.
5. **Sélectionner et muter** : garder les meilleurs, produire des variantes le long des axes du §4.2, par stratégies nommées et versionnées (les deux existantes, descente de modèle et température, puis découpage, prompt, validateur, contexte).
6. **Arrêter** : budget de recherche épuisé, plateau, ou objectif atteint avec marge.
7. **Publier** : le bloc gagnant, versionné, avec son rapport (matrice candidats × modèles, taux, coût médian et p90, traces des échecs) et sa **preuve de contrat**, rejouable.

Invariants : le contrat est figé pendant la recherche ; les vérifications déterministes passent avant tout juge par modèle ; aucune exécution hors bac à sable ; le plafond de coût est dur et partagé entre les candidats ; toute exécution laisse une ligne dans le journal ; la fitness n'est jamais simulée.

### 4.4 Les sorties

- Le **bloc gagnant**, dans le format de bloc existant, avec sa version et le contrat qu'il satisfait.
- Le **rapport**, JSON et CSV : une ligne par candidat et par modèle, avec taille d'échantillon, taux, coût, durée, et le niveau atteint sur chaque matrice.
- La **preuve** : les traces des N exécutions de référence, pour rejouer une régression le jour où le modèle change.
- Une **recommandation** en une ligne : « publiable au niveau X », ou « aucun candidat sous le budget, meilleure piste : … ».

## 5. Le moteur comme outil de Claude

Le premier consommateur n'est pas une interface, c'est une session Claude Code du cockpit. La forme : une commande, `maestro research <contrat> --budget <montant> --runs <N>`, qui lit un contrat, tourne, et écrit le bloc gagnant et le rapport dans le dépôt du projet cible. Dans la boucle dev-kit, le researcher la lance quand une issue déclare un contrat ; le juge lit le rapport comme une preuve ; l'estimateur lit le coût. Le lancement d'une recherche qui dépense de l'argent réel est le geste d'Arthur tant que le plafond n'est pas prouvé : la boucle prépare la commande, Arthur la lance, la boucle lit le résultat.

Premier cas réel tout trouvé : **la mesure du Chef guidé de Marcel** (Marcel #737). Son harnais rejoue huit profils, trois fois, avec un plafond de 2,00 $ et des seuils (zéro ingrédient non résolu, budget respecté, allergies respectées, coût p90, durée p90). C'est un contrat au sens du §4.1, écrit à la main dans un script. Quand le moteur atteint le jalon E4 (§8), ce script devient un contrat Maestro et le rapport sort du moteur. Deuxième cas : les recettes de la semaine (Marcel #748), dont le contrôle de qualité (recette retirée si ingrédient non résolu ou sans rabais, cinq sur sept exigées) est déjà une suite de vérifications déterministes.

## 6. Le lien avec `agent-core`

`agent-core` (copie du package d'agents de NATHAN, 2026-09-29) fournit en TypeScript ce que Maestro fournit en C# : un agent défini par prompt et outils, une boucle à budget, des outils substituables, et un **harnais** conçu pour rejouer des scénarios contre des outils simulés, modèle par modèle (`defineScenario`, `runScenario`, bientôt `runMatrix`, métriques, rapport). C'est la moitié « exécuter et mesurer » du §4.3, pour des agents TypeScript, sans la moitié « muter et sélectionner ».

On ne fusionne pas les codes. On fusionne les **formats** :

- le rapport d'`agent-core` (`toJSON`) adopte le schéma de run de Maestro (`docs/schemas/run.schema.json` : entrées, sorties, étapes, décisions, scores, artefacts, modèle) ;
- un scénario d'`agent-core` est exprimable comme un test de contrat Maestro (entrée, vérifications sur les appels d'outils et l'état final) ;
- le moteur Maestro peut alors traiter un agent TypeScript comme un candidat exécutable par un **exécuteur externe** : il appelle le harnais d'`agent-core` en ligne de commande, lit le rapport au format commun, et applique sa boucle de sélection dessus.

C'est ce qui permet à Marcel d'avancer maintenant sur `agent-core` sans attendre le moteur, et au moteur d'optimiser plus tard l'agent de Marcel sans réécrire ni l'un ni l'autre. Le jour où Arthur voudra une seule base de code, le choix se fera sur des faits : le langage des consommateurs (Marcel, Maestro, Manager sont TypeScript ; Money-Core Python), et la taille réelle du cœur (§7).

## 7. Repartir plus petit ?

Recommandation : **oui, mais par extraction, dans le même dépôt.** Le cœur du moteur tient, d'après l'inventaire, dans cinq à huit mille lignes de C# déjà écrites et testées : `BlockStore`, `BlockExecutors`, `NodeExecutionEngine`, `Testing/ContractTestRunner`, `Pricing`, `Fitness`, le bac à sable, plus les stratégies d'`adapt-optimize.ts` à porter. On crée une solution `Maestro.Engine.sln` qui ne référence que ces projets et une interface en ligne de commande, sans API web, sans SignalR, sans sessions ni espaces de travail. Les applications d'interface restent dans le dépôt, gelées, avec leur histoire ; on ne casse rien et on ne perd rien.

Pourquoi pas un nouveau dépôt : l'histoire, les ADR et les 510 tests sont l'actif ; les recopier sans historique ferait perdre la raison de chaque décision, et c'est exactement ce que la reprise veut éviter. Pourquoi pas tout garder : le poids de l'interface, de la conversation et des sessions dicte aujourd'hui la structure du domaine, et chaque changement du moteur doit traverser des couches que personne n'utilisera avant longtemps.

Deux dépendances à trancher au jalon E0 : la passerelle `llm-provider` (double .NET et Python, figée depuis mars) est-elle gardée comme seul accès aux modèles, ou le moteur appelle-t-il les fournisseurs directement, avec un adaptateur par vendeur comme `agent-core` ? Et le bac à sable : worktree git (existant) suffit pour des workflows de code ; pour les agents sur outils simulés, le bac à sable est le simulateur lui-même.

## 8. Les jalons du moteur

Chaque issue de Maestro vise l'un d'eux. Les jalons d'interface sont regroupés sous « Gelé ».

| Jalon | État atteint | Preuve |
|---|---|---|
| **E0 · Cadre** | la décision écrite (ce document), le ballast gelé, `Maestro.Engine.sln` qui compile et passe les tests des modules gardés, une ligne de commande vide, aucun code d'interface dans la solution | `dotnet test Maestro.Engine.sln` vert ; issues d'interface sous « Gelé » |
| **E1 · Contrat exécutable** | un contrat au format du §4.1 (avec actions, budget, niveaux) exécute un bloc existant contre sa suite de tests et rend un rapport de run au schéma commun, sans optimisation | un contrat du dépôt (`contract-definer`) rejoué, rapport JSON avec taux, coût et durée |
| **E2 · Matrice** | N exécutions par candidat, plusieurs modèles, dans le bac à sable ; fitness par feature et par taux, plus les contraintes dures ; rapport CSV | matrice 2 modèles × 5 runs sur un cas jouet de `test-repos`, coût plafonné et respecté |
| **E3 · Optimisation** | générateur de variantes (modèle, température, prompt, découpage, validateur), sélection, arrêt sur budget ou plateau, publication du bloc gagnant versionné avec preuve | sur le même cas, le moteur trouve un candidat moins cher à qualité égale et le prouve par le rapport |
| **E4 · Outil de Claude** | `maestro research` lancé depuis une session Claude Code sur un contrat d'un autre projet ; premier cas Marcel (mesure du Chef guidé, puis recettes de la semaine) ; rapport lu par le juge dev-kit | une issue Marcel fermée avec un rapport Maestro comme preuve |
| **E5 · Agents de base** | `contract-definer`, `test-designer`, `block-forge` reconstruits sur le moteur et optimisés par lui, puis un agent de build | un contrat écrit par un agent, validé par Arthur, optimisé par le moteur |

Après E5 : les agents de base servent les projets (Marcel, NATHAN, Maestro lui-même), et l'interface peut être dégelée si un besoin humain le justifie, sur le moteur et non à côté.

## 9. Ce qu'on gèle, explicitement

- `apps/code`, `apps/desktop`, `packages/maestro-code`, `packages/tui`, `packages/maestro-monitor`, `packages/provider-monitor`, `mock/`.
- Les entités et contrôleurs de session, d'espace de travail, de conversation et d'approbation.
- L'intégration GitHub App (`GH_APP_*`).
- Les issues d'interface ouvertes : #44, #47, #48, #49, #50, #51, #52, #66, #68, #70, #76, regroupées sous le jalon « Gelé · Interface et produit » ; #44 et #47 sont obsolètes (Streamlit retiré) et #76 semble livrée par la PR #77, à fermer après vérification.

## 10. Questions à Arthur, avec recommandation

1. **Passerelle de modèles** : garder `llm-provider` comme seul accès (recommandé pour E0 à E2, c'est ce qui tourne), et décider à E3 si le moteur appelle les fournisseurs directement.
2. **Langage du cœur** : rester en C# pour le moteur (recommandé : c'est là que sont les tests), avec l'exécuteur externe du §6 pour les agents TypeScript.
3. **Le juge par modèle** pour les critères textuels : autorisé dès E2, mais toujours après les vérifications déterministes et jamais seul.
4. **Qui lance une recherche payante** : Arthur, tant que le plafond dur n'a pas été prouvé sur trois recherches ; ensuite la boucle, sous plafond déclaré dans le contrat.
5. **Les deux protocoles Kersia** (matrices de sécurité, d'hallucination, d'optimisation) : les réécrire dans nos mots comme convention dev-kit, pour que le contrat Maestro y fasse référence sans dépendre d'un document privé.

## 11. Ce que ce document ne décide pas

Le découpage détaillé des issues E0 à E3 (spec-writer, quand la session Maestro reprendra) ; le format exact du contrat étendu (une ADR, à écrire à E1) ; la place de BRAIN comme fournisseur de mémoire (prévu en 65-G, non implémenté, hors moteur).
