# Phase 68 : Chat integre (debut V2)

**But** : La page Agent passe de panneau de controle (V1) a chat integre (V2).
La conversation est geree par le backend Maestro (ConversationManager).

## Sous-phases

| Sous-phase | Objectif |
|------------|----------|
| 68-A | ConversationService V2 implementation (API backend) |
| 68-B | Page Agent : chat Streamlit connecte a l'API conversation |
| 68-C | maestro-assistant : block agent natif (block.json + system-prompt.md) |

## Mapper switch

| Avant (V1) | Apres | Service |
|------------|-------|---------|
| Container Claude Code persistant | Block agent Maestro | AgentService |
| `docker attach` pour converser | Chat dans le dashboard | ConversationService |
| Memoire via .claude/ | ConversationManager backend | ConversationService |

## Gate

L'utilisateur peut converser avec maestro-assistant directement dans le dashboard, sans terminal.
