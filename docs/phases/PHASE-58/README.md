# Phase 58 : Production des variantes pre-testees

**Statut** : Planifie
**Prerequis** : Phase 57 COMPLETE (/adapt fonctionnel avec Agent Creator + contracts)
**Objectif** : Utiliser `/adapt` nous-memes pour creer ~30 maestro-assistants couvrant les profils hardware courants. Chaque variante implemente le contract `maestro-assistant` avec des capabilities verifiees. Configurer les providers cloud opensource.
**Duree estimee** : 6-10 jours

---

## Contexte

### Pourquoi ~30 variantes

L'objectif est que n'importe quel utilisateur recoit un assistant fonctionnel en < 30 secondes au setup. Le contract `maestro-assistant` definit les features, les capabilities determinent lesquelles sont actives :

| Tier | Modeles | Capabilities attendues | Features actives |
|------|---------|----------------------|-----------------|
| cpu-only | TinyLlama, Phi-2 | conversation | 1/5 |
| light | Phi-3 Mini, StableLM | conversation, tool-calling | 2/5 |
| standard | Mistral 7B, DeepSeek 6.7B | conversation, orchestration, tool-calling | 3/5 |
| heavy | CodeLlama 13B, Llama-3 8B | conversation, orchestration, tool-calling, long-context | 4/5 |
| cloud-free | Mistral API, Together.ai | conversation, orchestration, tool-calling, structured-output | 4-5/5 |
| cloud-paid | Claude, GPT-4 | ALL | 5/5 |
| hybrid | Local + cloud fallback | Varie selon le split | 3-5/5 |

L'utilisateur voit clairement : "Cet assistant a 3/5 features actives. Si vous voulez les 5, choisissez la version cloud."

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 56-A | Configuration providers cloud opensource | 2-3 jours |
| 56-B | Execution de /adapt par profil hardware | 3-5 jours |
| 56-C | Validation, tri, integration dans content/system/ | 1-2 jours |

---

## 56-A : Configuration providers cloud opensource

### Taches

1. **Ajouter des providers dans LLM-Provider .NET** :
   - Mistral API (free tier ou bas cout)
   - Together.ai (modeles open-source heberges)
   - Groq (inference rapide)
   - Chaque provider = nouveau projet dans `LLMProvider.Providers/`

2. **Verifier chaque provider** : health check, completion, tool-calling

---

## 56-B : Execution de /adapt

### Taches

1. **Pour chaque tier** :
   - `maestro adapt maestro-assistant-workflow --target-model <model> --target-tier <tier>`
   - Le workflow Agent Creator regenere les prompts pour le modele cible
   - Les capabilities sont verifiees (pas juste declarees)

2. **Documenter chaque variante** :
   - Contract, capabilities verifiees, fitness, features actives/inactives
   - Forces/faiblesses, temps de reponse

3. **Iterer si fitness < 0.6** — relancer, essayer modele alternatif

---

## 56-C : Validation et integration

### Taches

1. **Garder les variantes avec fitness > 0.6**
2. **Copier dans `content/system/blocks/`** — livrees avec l'app
3. **Mettre a jour demo data**
4. **Creer l'index** : `content/system/contracts/maestro-assistant-variants.json`
   - Pour chaque variante : capabilities verifiees, features actives, hardware profile, fitness

### Gate

- [ ] Au moins 15 variantes avec fitness > 0.6
- [ ] Toutes declarent `contract: "maestro-assistant"` avec capabilities verifiees
- [ ] Couverture : au moins 1 variante par tier
- [ ] Les features actives/inactives sont correctes pour chaque variante

---

## Definition of Done

> **OBLIGATOIRE** : Lire `docs/system/TESTING-PROTOCOL.md` et executer TOUTES les couches de test applicables (voir la matrice) avant de declarer DONE. Copier la checklist de fin de phase dans `checkpoint.md`.

- [ ] 3+ providers cloud opensource configures
- [ ] 15+ variantes avec fitness > 0.6 et contract `maestro-assistant`
- [ ] Capabilities verifiees (pas juste declarees)
- [ ] Features actives/inactives coherentes avec les capabilities
- [ ] Variantes integrees dans `content/system/blocks/`
- [ ] Index cree
- [ ] Documentation des variantes

### NOT in scope
- UI de choix au setup (Phase 59)
- Catalogue communautaire (Phase 60)
