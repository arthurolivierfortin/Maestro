# Phase 61 — Rapport de nuit (2026-03-16)

**Agent** : Claude Opus 4.6
**Periode** : ~19h00 - 01h30

---

## Ce qui a ete fait

### 1. Diagnostic du probleme fondamental

Le block-forge echoue systematiquement avec gpt-4o via GitHub Models pour **deux raisons** :

**Probleme A : Context overflow (413 RequestEntityTooLarge)**
- Le `ConversationReadBlockExecutor` lisait TOUS les messages de la conversation sans truncation
- Apres quelques iterations (file-read retourne des fichiers volumineux), le contexte depassait la limite
- **Fix applique** : modifie `ConversationReadBlockExecutor` pour respecter `keepLastN` en input
- Modifie les agents pour passer `keepLastN: 8` dans le `read-conversation` node
- Reduit `maxTokens: 4096` et `keepLastN: 8` dans les configs des deux agents

**Probleme B : GitHub Models rate limiting**
- Le free tier de GitHub Models rate-limite apres ~10-15 appels LLM en sequence rapide
- L'agent fait 12+ iterations, chaque iteration = 1 appel LLM + tool dispatch
- Apres ~10 iterations, les appels retournent `429 Too Many Requests`
- Le retry (3 tentatives) n'aide pas car le rate limit est de plusieurs minutes
- **Pas de fix possible sans changer de provider**

### 2. Changements de code

| Fichier | Changement |
|---------|------------|
| `ConversationReadBlockExecutor.cs` | Support `keepLastN` input : truncate conversation en gardant system + N derniers messages |
| `agent-creator.agent.block.json` | `keepLastN: 8`, `maxTokens: 4096`, `context.keepLastN: 8` |
| `test-designer.agent.block.json` | Idem |

### 3. Resultats des tests

| Tentative | Modele | Resultat | Cause |
|-----------|--------|----------|-------|
| Test 1 (Phase 58-C) | Claude Code CLI | Timeout 15+ min | 30-60s par appel |
| Test 2 | Llama 405B (GitHub) | Pas de step-complete | Modele pas assez capable |
| Test 3 | gpt-4o (GitHub) | 50 iter sans fin | 413 context overflow |
| Test 4 (post-fix keepLastN) | gpt-4o (GitHub) | 18 iter puis rate limit | 429 rate limiting |

---

## Decisions requises (pour demain)

### Le bloqueur : quel provider pour block-forge ?

GitHub Models free tier ne suffit pas. Options :

| Option | Avantage | Inconvenient | Cout |
|--------|----------|-------------|------|
| **A. Anthropic API** | Excellent (Claude Sonnet), pas de rate limit agressif | Necessite cle API, ~$0.50/workflow | $3/$15 per MTok |
| **B. Azure AI pay-as-you-go** | Pas de rate limit, modeles varies | Necessite subscription Azure | Variable |
| **C. GitHub Models pay-as-you-go** | Meme API que free, plus de rate limit | Plus cher que free | ~$2.50/$10 per MTok (gpt-4o) |
| **D. Modele local** | Gratuit, pas de rate limit | Lent (~5-10s/call), qualite variable | $0 |
| **E. Reduire les iterations** | Pas de changement de provider | L'agent ne peut rien accomplir en 3-5 iterations | $0 |

**Ma recommandation** : Option A (Anthropic API). C'est le meme modele que Claude Code CLI mais 10x plus rapide (API directe vs CLI wrapper). Le cout est ~$0.50 par workflow block-forge. Le provider est deja implemente (Phase 59-PRE-D).

Pour configurer : ajouter `PROVIDERS__ANTHROPIC__APIKEY=sk-ant-xxx` dans `.env`.

### Sous-phases restantes

| Phase | Status | Bloqueur |
|-------|--------|----------|
| 61-A | **Partiellement fait** | Fix keepLastN OK, mais aucun workflow complete E2E |
| 61-B | **Non commence** | Depende de 61-A |
| 61-C | **Non commence** | Depende de 61-B |
| 61-T | **Non commence** | Depende de tout |

---

## Etat technique

- `dotnet build` : 0 erreurs
- `npx tsc --noEmit` : 0 erreurs
- Tests TUI : 189/191 (2 pre-existants)
- Tests backend : tous passent
- Phase 59 (isolation) : complete et fonctionnelle
- Phase 60 (playground) : complete et fonctionnelle
- Les services fonctionnent correctement

---

## Suggestion pour demain

1. **Configurer Anthropic API** (ajouter la cle dans `.env`)
2. **Changer les agents pour `claude-sonnet-4-6`** au lieu de `gpt-4o`
3. **Relancer block-forge** — devrait terminer en ~3-5 min sans rate limit
4. **Valider les outputs structures** (blockId, fitness)
5. Si ca marche → creer les 2 agents → benchmark → Phase 61 complete
