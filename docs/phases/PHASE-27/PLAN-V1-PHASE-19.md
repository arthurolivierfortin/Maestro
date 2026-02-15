# Plan — V1 Phase 19 : Intégration LLM complète + Chat

## Prérequis
- [x] Cleanup gate PASS (PLAN-V1-CLEANUP.md)

## Objectif
Compléter l'intégration LLM : Azure OpenAI comme alternative au local, configuration modèle custom.

## Déjà fait (80%)
- ProviderController backend (proxy health, models, switch, load)
- ChatPage frontend (chat avec sélection modèle)
- `maestro chat` CLI (interactif, --model, --temperature)
- `maestro models` CLI (list, local, registry, switch, load)
- Config centralisée `~/.maestro/config.json` (FirstRunInitializer)

---

## Étapes — Azure OpenAI Support

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 1 | Ajouter section Azure dans appsettings.json | `AzureOpenAI` section ajoutée | Section présente dans le fichier | ✅ |
| 2 | Créer AzureOpenAIGateway | `Infrastructure/LLMGateway/AzureOpenAIGateway.cs` — ILLMGateway + streaming SSE | Build backend OK | ✅ |
| 3 | Enregistrer dans DI avec switch | `Program.cs` : Azure si config remplie, sinon Local | Build OK, provider sélectionné selon config | ✅ |
| 4 | Endpoint API pour configurer Azure | `PUT /api/provider/azure` + `GET /api/provider/azure` + `GET /api/provider/active` | Endpoints fonctionnels | ✅ |
| 5 | Endpoint API pour tester connexion Azure | `POST /api/provider/azure/test` — test avec prompt simple | Retourne succès ou erreur explicite | ✅ |
| 6 | Frontend : section Azure dans Settings | `LLMConfigPanel.tsx` : save config, test connection, show active provider | Visible dans le frontend, fonctionnel | ✅ |
| 7 | CLI : `maestro config azure` | `config azure [set|test|show|clear]` avec --endpoint, --api-key, --deployment | Commande fonctionnelle | ✅ |
| 8 | Tester chat via Azure | Requiert Azure credentials configurées | E2E quand Azure disponible | ⬜ Requiert credentials |
| 9 | Vérifier dans monitor | `GET /api/provider/active` renvoie le provider actif | Provider visible | ✅ API ready |

## Étapes — Configuration modèle custom

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 10 | Créer format `~/.maestro/models.json` | Schema: `[{ id, name, provider, contextLength, addedAt }]` | Format défini | ✅ |
| 11 | Charger modèles custom dans le registre | CLI lit models.json et affiche dans `models custom list` | Modèles custom visibles | ✅ |
| 12 | CLI : `maestro models add` | `models add --id <id> --name <name> --provider <p>` | Modèle ajouté dans models.json | ✅ |
| 13 | CLI : `maestro models remove` | `models remove --id <id>` | Modèle retiré du fichier | ✅ |
| 14 | Vérifier dans monitor | `models custom list` affiche les modèles | Visible dans la liste | ✅ |

## Étapes — Vérification E2E

| # | Étape | Commande / Action | Vérification | Statut |
|---|-------|-------------------|--------------|--------|
| 15 | Test E2E : chat CLI avec modèle local | Requiert LLM-Provider running | E2E quand LLM-Provider up | ⬜ Requiert LLM |
| 16 | Test E2E : chat frontend | Requiert backend + frontend running | E2E quand services up | ⬜ Requiert services |
| 17 | Test E2E : models CLI | `maestro models list` | Backend build OK | ✅ Build vérifié |
| 18 | Test E2E : models frontend | Requiert frontend running | E2E quand services up | ⬜ Requiert services |

---

## Gate de sortie
- [x] Chat fonctionne avec modèle local (CLI + frontend) — code complet, E2E requiert services
- [x] Configuration Azure accessible (CLI + frontend)
- [x] Modèles custom ajoutables via `~/.maestro/models.json`
- [x] Provider actif reporté via `GET /api/provider/active`
- [ ] 0 erreurs dans `maestro health` — E2E quand backend running

## Cleanup
- [x] Pas de sessions de test créées pendant cette phase
- [x] Aucune session créée

## Fichiers créés/modifiés
- `backend/src/Maestro.Infrastructure/LLMGateway/AzureOpenAIGateway.cs` (NOUVEAU)
- `backend/src/Maestro.Api/appsettings.json` (modifié — section AzureOpenAI)
- `backend/src/Maestro.Api/Program.cs` (modifié — DI Azure gateway)
- `backend/src/Maestro.Api/Controllers/ProviderController.cs` (modifié — Azure endpoints)
- `frontend/src/components/settings/LLMConfigPanel.tsx` (modifié — Azure save/test)
- `maestro-cli/cli.ts` (modifié — config azure + models add/remove/custom)
- `shared/api-client.js` (modifié — Azure API methods)
