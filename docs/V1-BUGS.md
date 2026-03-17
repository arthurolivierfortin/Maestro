# Bugs a corriger avant V1

**Derniere mise a jour** : 2026-03-17

Ce document recense les bugs connus qui doivent etre corriges avant la V1 deployable (Phase 67). Chaque bug a une severite, une description, et la phase dans laquelle il devrait etre corrige.

---

## Critiques (bloquent l'utilisation)

| # | Bug | Description | Cause | Phase cible |
|---|-----|-------------|-------|-------------|
| 1 | **Couts parent = $0 avec sessions enfants** | Quand un workflow utilise des agents isoles (sessions enfants), les couts s'accumulent dans l'enfant mais le parent affiche $0.00. L'utilisateur ne voit pas le cout total du workflow. | `BlockRefHandler` accumule les couts sur la session qui execute le block (l'enfant), pas le parent. Fix partiel dans `ToolDispatcherBlockExecutor.cs:143-149`. | 61 |
| 2 | **Blank lines dans SpacesScreen** | Des lignes vides parasites apparaissent entre certaines sessions dans la page Spaces. Pre-existant. | Probablement lie au rendu Ink — mix de composants row et column dans un Box column. | 66 (polish) |

## Majeurs (degradent l'experience)

| # | Bug | Description | Cause | Phase cible |
|---|-----|-------------|-------|-------------|
| 3 | **Doublons modeles dans ModelsScreen** | Claude sonnet/haiku/opus apparaissent en doublons car le provider Claude Code CLI et Anthropic API listent les memes modeles avec des IDs differents. | Le `ClaudeCodeLLMProvider` liste des modeles meme quand un provider Anthropic direct est aussi configure. La deduplication par modelId ne fonctionne pas car les IDs different (ex: `claude-sonnet-4-6` vs `claude-sonnet`). | 62 |
| 4 | **Cout reel vs theorique non distingue** | Le status bar affiche `$0.46 today` pour des modeles gratuits (GitHub Models free tier). L'utilisateur pense depenser de l'argent alors que c'est gratuit. | Le systeme ne distingue pas cout reel (facture) et cout theorique (prix du marche). | 66 |
| 5 | **Model Detail panels vides** | Les panels HEALTH, USAGE, PERFORMANCE dans la vue detail d'un modele sont vides. | Les donnees ne sont pas connectees aux metriques du LLM-Provider. | 62 |
| 6 | **System prompt agent-creator trop gros** | 994 lignes (~30K tokens) causent des appels LLM lents (2-3 min par appel avec Claude Sonnet). | Le system prompt contient des exemples exhaustifs, des guidelines detaillees. Pourrait etre condense. | 62 |

## Mineurs (cosmetic / polish)

| # | Bug | Description | Cause | Phase cible |
|---|-----|-------------|-------|-------------|
| 7 | ~~**`maxIterations: 50` dans agent while loop**~~ | ~~Le `maxIterations` dans la boucle while de l'agent utilise la valeur du template (50) au lieu de la config du block (12).~~ | ~~Le template dans config.nodes reference `{{maxIterations}}` mais la resolution de variable prend le defaut du template.~~ | ~~61~~ Fix code dans MultiNodeBlockExecutor.cs:229-244, verification en 61-A |
| 8 | **ModelsScreen test pre-existant echoue** | `ModelsScreen.test.ts > preserves MODEL STATUS panel` echoue car le mock attend `claude-sonnet` qui n'est pas dans les donnees demo. | Mock data obsolete. | 66 |
| 9 | **smoke-capture test flaky** | Echoue en batch, passe en isolation. Conflit PTY entre tests paralleles. | Infrastructure de test PTY Windows. | 66 |
| 10 | **`dev-start.ps1` ne ferme pas toujours les anciennes fenetres** | Les fenetres "Maestro-Dev" ne sont pas toujours fermees quand le titre ne match pas exactement. | `MainWindowTitle` matching est fragile sur Windows. | 66 |

---

## Process

Pour ajouter un bug : ajouter une ligne dans la section appropriee avec #, description, cause, et phase cible.
Pour corriger un bug : marquer la ligne avec ~~strikethrough~~ et noter la date + phase de correction.
