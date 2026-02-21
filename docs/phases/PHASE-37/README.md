# Phase 37 : Maestro Runtime & SDK

**Statut** : A faire
**Prerequis** : Phase 36 COMPLETE (context/memory/docs formalises)
**Objectif** : Permettre aux applications tierces d'embarquer et d'utiliser Maestro comme runtime, et ajouter le mode vocal a maestro code.

---

## Vision

Maestro passe de "outil de developpement" a "plateforme runtime". Les applications peuvent :
1. **Etre construites AVEC Maestro** (maestro code, dogfooding — existe depuis Phase 35)
2. **Tourner SUR Maestro** (l'app utilise des blocks/agents Maestro dans son fonctionnement)

C'est le differenciateur de Maestro : les memes blocks (STT, TTS, agents) sont utilisables dans le CLI ET embarquables dans des apps tierces.

### Architecture a deux niveaux

```
Niveau 1 : Maestro comme OUTIL DE DEVELOPPEMENT (existe)
  maestro code → dev-orchestrator → [file-read, file-write, file-edit, shell-execute]

Niveau 2 : Maestro comme RUNTIME APPLICATIF (cette phase)
  App Electron → @maestro/client → Backend API → Block executors → LLM-Provider
```

---

## Sous-phases

| Phase | Titre | Effort |
|-------|-------|--------|
| 37-A | SDK client npm (@maestro/client) | 1 semaine |
| 37-B | Mode sidecar (@maestro/sidecar) | 1 semaine |
| 37-C | Blocks audio (STT + TTS) | 3-5 jours |
| 37-D | Mode vocal dans maestro code (toggle a chaud) | 3-5 jours |
| 37-E | Agent Jarvis (template generique) | 3-5 jours |

---

## 37-A : SDK client npm (@maestro/client)

### Ce que cette sous-phase fait

1. Extraire `MaestroApiClient` (de `packages/maestro-cli/api-client.js`) en package npm publiable
2. Ajouter des helpers haut niveau : `executeBlock()`, `createSession()`, `streamExecution()`
3. Types TypeScript complets
4. Documentation API inline (JSDoc)

### Structure du package

```
packages/maestro-client/
  src/
    index.ts              — exports publics
    client.ts             — MaestroClient class (refactored from api-client.js)
    types.ts              — BlockResult, SessionState, ExecutionStatus, etc.
    streaming.ts          — SSE/SignalR streaming helpers
  package.json            — @maestro/client
  tsconfig.json
  README.md
```

### API publique

```typescript
import { MaestroClient } from '@maestro/client';

const maestro = new MaestroClient({ baseUrl: 'http://localhost:5000' });

// Executer un block
const result = await maestro.executeBlock('code-reviewer', {
  input: { code: '...', language: 'typescript' }
});

// Creer et gerer une session
const session = await maestro.createSession({
  type: 'project',
  name: 'Mon App - Feature X',
  repo: '/path/to/repo'
});
await session.invoke('dev', { task: 'Add login page' });

// Streamer l'execution
for await (const event of session.stream()) {
  console.log(event.type, event.data);
}

// Health check
const health = await maestro.health();
```

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-client/` | Creer — nouveau package npm |
| `packages/maestro-cli/api-client.js` | Modifier — importer depuis @maestro/client |

### Anti-patterns
- Ne PAS reimplementer l'API client — extraire et refactorer l'existant
- Ne PAS ajouter de logique metier dans le SDK — c'est un client HTTP pur
- Ne PAS creer d'abstraction au-dessus du backend — le SDK expose l'API telle quelle

### Checkpoint
```markdown
## 37-A : SDK client
**Statut** : DONE / BLOQUE
**Package** : @maestro/client
**Methodes publiques** : [liste]
**Types exportes** : [nombre]
**Tests** : [nombre]
**api-client.js migre** : OUI/NON
```

---

## 37-B : Mode sidecar (@maestro/sidecar)

### Ce que cette sous-phase fait

1. Creer un module npm qui lance le backend Maestro + LLM-Provider comme process enfants
2. Auto-detection de ports libres
3. Health check automatique au demarrage
4. Shutdown propre (SIGTERM → graceful shutdown des process enfants)
5. Compatible Electron (spawn dans le main process)

### Usage

```typescript
import { MaestroSidecar } from '@maestro/sidecar';

const sidecar = new MaestroSidecar({
  backendPath: '/path/to/Maestro.Api',     // ou auto-detect
  llmProviderPath: '/path/to/LLMProvider', // ou auto-detect
  dataDir: '~/.maestro'
});

await sidecar.start();
// sidecar.backendUrl === 'http://localhost:5000'
// sidecar.llmProviderUrl === 'http://localhost:5010'

const client = new MaestroClient({ baseUrl: sidecar.backendUrl });
// ... utiliser normalement

await sidecar.stop(); // cleanup propre
```

### Structure

```
packages/maestro-sidecar/
  src/
    index.ts              — exports
    sidecar.ts            — MaestroSidecar class
    process-manager.ts    — spawn, healthcheck, shutdown
    port-finder.ts        — trouver des ports libres
  package.json            — @maestro/sidecar
```

### Anti-patterns
- Ne PAS hardcoder les chemins vers les binaires — detection automatique ou config
- Ne PAS bloquer le process principal — spawn asynchrone avec health check polling
- Ne PAS ignorer les erreurs de demarrage — propager clairement

### Checkpoint
```markdown
## 37-B : Sidecar
**Statut** : DONE / BLOQUE
**Package** : @maestro/sidecar
**Backend demarre** : OUI/NON
**LLM-Provider demarre** : OUI/NON
**Shutdown propre** : OUI/NON
**Compatible Electron** : OUI/NON
```

---

## 37-C : Blocks audio (STT + TTS)

### Ce que cette sous-phase fait

1. Creer `speech-to-text.tool.block.json` — wrapper generique STT
2. Creer `text-to-speech.tool.block.json` — wrapper generique TTS
3. Handler dans `ToolBlockExecutor` pour les deux
4. Support Web Speech API (navigateur) et Whisper/piper-tts (local) via config

### Blocks

```json
// speech-to-text.tool.block.json
{
  "id": "speech-to-text",
  "type": "tool",
  "metadata": { "designation": "tool", "description": "Transcrit audio en texte" },
  "config": {
    "handler": "speech-to-text",
    "inputs": { "audio": "string (base64 ou path)", "language": "string (default: auto)" },
    "outputs": { "text": "string", "confidence": "number" },
    "provider": "web-speech-api"  // ou "whisper-local"
  }
}
```

```json
// text-to-speech.tool.block.json
{
  "id": "text-to-speech",
  "type": "tool",
  "metadata": { "designation": "tool", "description": "Synthetise texte en audio" },
  "config": {
    "handler": "text-to-speech",
    "inputs": { "text": "string", "language": "string", "voice": "string?" },
    "outputs": { "audio": "string (base64)", "duration": "number" },
    "provider": "web-speech-api"  // ou "piper-tts"
  }
}
```

### Reference existante
- `C:\Cantante\src\renderer\accessibility\useSpeechSynthesis.ts` — prototype TTS Web Speech API deja fonctionnel

### Anti-patterns
- Ne PAS coupler les blocks a un provider specifique — le provider est configurable
- Ne PAS implementer Whisper/piper dans cette sous-phase — Web Speech API suffit pour V1
- Ne PAS ajouter de logique de streaming audio complexe — input/output simple

### Checkpoint
```markdown
## 37-C : Blocks audio
**Statut** : DONE / BLOQUE
**speech-to-text.block.json** : cree / teste
**text-to-speech.block.json** : cree / teste
**Provider V1** : Web Speech API
**Tests isoles** : [nombre]
```

---

## 37-D : Mode vocal dans maestro code

### Lecture obligatoire
- `packages/maestro-code/App.ts` — TUI interactive actuelle (InputPrompt, OutputPanel)
- `packages/maestro-code/headless.ts` — mode headless

### Ce que cette sous-phase fait

Le mode vocal est un **parametre activable a chaud** dans `maestro code`, pas un flag de lancement.

1. Ajouter un toggle vocal dans le TUI (raccourci clavier, ex: Ctrl+V)
2. Quand active : le microphone capture → STT → le texte s'ecrit dans le champ input
3. L'utilisateur voit la transcription, peut corriger, puis envoie (Enter)
4. Optionnellement : la reponse de l'agent est lue par TTS
5. L'agent ne change pas — il recoit du texte comme d'habitude

```
maestro code (TUI interactive)
  ┌─────────────────────────────────────────────┐
  │  Output Panel                               │
  │  ...                                        │
  ├─────────────────────────────────────────────┤
  │  > [texte transcrit ici]        🎤 ON/OFF   │
  └─────────────────────────────────────────────┘

  Ctrl+V : toggle voice mode
  Voice ON  → microphone → STT → texte dans l'input
  Voice OFF → retour au clavier
```

### Pourquoi un toggle et pas un flag --voice

- L'utilisateur ne devrait pas devoir quitter maestro code pour activer/desactiver
- Le vocal est un peripherique d'entree alternatif, pas un mode different
- Permet de mixer : dicter la tache, taper une correction, puis envoyer

### Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| `packages/maestro-code/App.ts` | Modifier — ajouter toggle vocal, STT integration |
| `packages/maestro-code/voice.ts` | Creer — module STT/TTS (utilise les blocks audio) |

### Anti-patterns
- Ne PAS creer un nouveau mode (`maestro voice`) — c'est un toggle dans maestro code
- Ne PAS modifier le pipeline agent — le vocal est un peripherique d'entree, pas un nouveau flux
- Ne PAS rendre le vocal obligatoire — toujours desactivable

### Checkpoint
```markdown
## 37-D : Mode vocal
**Statut** : DONE / BLOQUE
**Toggle fonctionne** : OUI/NON
**STT → input** : OUI/NON
**TTS reponse** : OUI/NON
**Raccourci** : [quel raccourci]
```

---

## 37-E : Agent Jarvis (template generique)

### Ce que cette sous-phase fait

1. Creer `jarvis.agent.block.json` — agent router d'intentions generique
2. Le Jarvis recoit du texte (vocal ou tape), classifie l'intention, dispatch vers le bon agent/block
3. Creer un session template `vocal-assistant` pour les apps qui veulent un mode vocal
4. Premier test : brancher Jarvis sur maestro code comme alternative au dev-orchestrator

### System prompt du Jarvis

```markdown
# Jarvis — Assistant vocal intelligent

Tu es un assistant vocal. Tu recois des commandes en langage naturel et tu les dispatches
vers le bon outil.

## Outils disponibles
- dev-orchestrator : pour les taches de developpement (coder, modifier, creer des fichiers)
- file-read : pour lire un fichier
- shell-execute : pour executer une commande
- step-complete : pour terminer quand la tache est accomplie

## Regles
- Reponds TOUJOURS en une phrase courte (sera lu par TTS)
- Si la commande est ambigue, demande une clarification
- Si la commande est une tache de dev, dispatch vers dev-orchestrator
```

### Anti-patterns
- Ne PAS hardcoder les intents dans le code C# — tout dans le system prompt
- Ne PAS specialiser le Jarvis pour Cantante — il est generique. La specialisation viendra en Phase 41
- Ne PAS implementer de NLU complexe — le LLM est le classifieur d'intentions

### Checkpoint
```markdown
## 37-E : Jarvis
**Statut** : DONE / BLOQUE
**Block cree** : jarvis.agent.block.json
**Template cree** : vocal-assistant
**Test dispatch** : [nombre d'intents testes]
```

---

## Gestion de la memoire

### Checkpoint global
Fichier `docs/phases/PHASE-37/checkpoint.md` — format defini dans AGENT-PROTOCOL.md.

### Mise a jour MEMORY.md apres completion
- Ajouter : "Phase 37 : @maestro/client SDK, @maestro/sidecar, blocks STT/TTS, mode vocal toggle dans maestro code, agent Jarvis generique"
- Ajouter : "packages/maestro-client/ et packages/maestro-sidecar/ dans le monorepo"
- Ajouter : "Voice mode = toggle (Ctrl+V) dans maestro code, pas un flag"

---

## Criteres de completion

- [ ] `@maestro/client` publiable avec executeBlock(), createSession(), stream()
- [ ] `@maestro/sidecar` lance backend + LLM-Provider proprement
- [ ] speech-to-text et text-to-speech blocks fonctionnels (Web Speech API)
- [ ] maestro code supporte le toggle vocal (Ctrl+V) — dicte → texte dans l'input
- [ ] Agent Jarvis dispatch vers dev-orchestrator via commande vocale
- [ ] Une app Electron peut embarquer Maestro via sidecar + client SDK
