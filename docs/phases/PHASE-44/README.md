# Phase 44 — The TUI Sentinel: Agent d'Auto-Validation et Auto-Amelioration

## Vision

Un agent Maestro qui **voit** l'interface, **comprend** chaque composant de l'atome au global, **teste** systematiquement, **corrige** les problemes, et **s'ameliore** avec chaque iteration. C'est le premier agent qui fait quelque chose de concret dans Maestro, et il le fait sur Maestro lui-meme.

C'est aussi le test ultime de l'architecture Maestro: sessions, blocks, entry points, monitor, fitness — tout est utilise pour de vrai, pas en demo.

---

## Pourquoi Cet Agent Est Critique

### Le probleme fondamental

Un agent (Claude, ou n'importe quel LLM) ne peut pas voir un TUI. Il ecrit du code, lance des tests, et les tests passent. Mais le scroll ne fonctionne pas parce que deux hooks clavier se battent pour la meme touche. Le contenu deborde du panel. La navigation saute des pages. **L'agent ne le sait pas.**

Vitest teste la logique, pas le rendu. `ink-testing-library` retourne du texte, pas un layout. `real-demo-check.cjs` verifie la resolution de modules, pas le comportement visuel.

### Ce que l'agent change

1. **Il voit** — via `node-pty` + `@xterm/headless`, il capture ce que le terminal affiche reellement
2. **Il comprend** — il construit un arbre de composants avec leurs etats, props, invariants
3. **Il teste** — du composant le plus atomique (un `Text` dans un `Panel`) jusqu'a l'app complete
4. **Il corrige** — il propose des patches, les applique, re-teste
5. **Il apprend** — les invariants qui trouvent des bugs sont priorises, le fitness monte

### Les trois premieres

1. **Premiere utilisation reelle de Maestro** — session, blocks, entry points, monitor — tout fonctionne ensemble
2. **Premier self-improvement** — Maestro Code se teste et s'ameliore lui-meme
3. **Premiere version deployable** — apres cette phase, on peut distribuer un Maestro Code qui maintient sa propre qualite

---

## Architecture de l'Agent

### Vue globale

```
tui-sentinel (workflow block)
├── Phase 1: DISCOVERY        → Decouvre tous les composants
├── Phase 2: ANALYSIS         → Construit l'arbre + invariants
├── Phase 3: USER DIALOGUE    → Pose des questions au user
├── Phase 4: ATOMIC TESTING   → Teste composant par composant (bottom-up)
├── Phase 5: INTEGRATION      → Teste les compositions + interactions
├── Phase 6: VISUAL CAPTURE   → Capture et valide les frames reelles
├── Phase 7: FIX & ITERATE    → Corrige, re-teste, mesure fitness
└── Phase 8: REPORT           → Genere le rapport final
```

### Type de block

```json
{
  "id": "tui-sentinel",
  "name": "TUI Sentinel",
  "blockType": "workflow",
  "version": "1.0.0",
  "isAtomic": false,
  "description": "Autonomous TUI validation and self-improvement agent",
  "config": {
    "nodes": [
      { "id": "discover",   "blockRef": "tui-discover" },
      { "id": "analyze",    "blockRef": "tui-analyze" },
      { "id": "dialogue",   "blockRef": "tui-dialogue" },
      { "id": "test-atomic","blockRef": "tui-test-atomic" },
      { "id": "test-integ", "blockRef": "tui-test-integration" },
      { "id": "capture",    "blockRef": "tui-visual-capture" },
      { "id": "fix",        "blockRef": "tui-fix-iterate" },
      { "id": "report",     "blockRef": "tui-report" }
    ]
  }
}
```

---

## Phase 1: DISCOVERY — Decouvrir l'Interface

### Ce que l'agent fait

1. **Analyse statique** — Parse tous les `*.ts` dans `components/`, extrait:
   - Nom du composant
   - Props (types, required/optional)
   - Imports (de quels autres composants il depend)
   - Hooks utilises (`useInput`, `useKeyboard`, `useState`, etc.)
   - Export: est-ce un composant public ou interne?

2. **Analyse de l'arbre d'imports** — Construit le graphe de dependances:
   ```
   App.ts
   ├── AgentScreen (imports: Panel, NavBar, ConversationLog)
   │   ├── Panel (from @maestro/tui)
   │   ├── NavBar (imports: theme)
   │   └── ConversationLog (imports: SessionManager types)
   ├── HomeScreen (imports: Panel, NavBar, useApiData)
   │   ├── SystemStatus
   │   ├── ActiveSessions > ActiveSessionCard
   │   └── QuickActions
   ├── TaskInputBar (imports: useInput from ink)
   └── StatusBar (from @maestro/tui)
   ```

3. **Analyse runtime** — Lance l'app en mode `--inspect` (Phase 43), capture le component tree:
   ```json
   {
     "root": "FullscreenBox",
     "children": [
       {
         "component": "AgentScreen",
         "props": { "lines": "LogLine[]", "agentState": "idle", "sessionId": null },
         "children": [
           { "component": "NavBar", "props": { "currentPage": "agent" } },
           { "component": "Panel", "props": { "title": "AGENT STATUS", "height": 3 } },
           { "component": "Panel", "props": { "title": "CONVERSATION", "anchor": "bottom" },
             "children": [{ "component": "ConversationLog" }] },
           { "component": "Panel", "props": { "title": "ACTIONS", "width": 25 } }
         ]
       },
       { "component": "TaskInputBar", "props": { "disabled": false } },
       { "component": "StatusBar" }
     ]
   }
   ```

4. **Decouverte des etats** — Pour chaque composant, identifie les etats possibles:
   - Panel: focused/unfocused, scrollable/not, overflow/fit
   - AgentScreen: idle/working/completed/error, with/without session
   - TaskInputBar: enabled/disabled, empty/text, focused/unfocused
   - NavBar: chaque page active (home/agent/spaces/foundry/catalog/models)

### Output

```json
{
  "components": [
    {
      "name": "Panel",
      "source": "packages/tui/components/Panel.ts",
      "atomic": true,
      "props": {
        "title": { "type": "string", "required": false },
        "focused": { "type": "boolean", "required": false, "default": false },
        "anchor": { "type": "'top' | 'bottom'", "required": false, "default": "top" },
        "scrollOffset": { "type": "number", "required": false, "default": 0 },
        "showScroll": { "type": "boolean", "required": false },
        "canScrollUp": { "type": "boolean", "required": false },
        "canScrollDown": { "type": "boolean", "required": false }
      },
      "hooks": ["none (stateless)"],
      "states": [
        { "name": "default", "props": { "title": "TEST" } },
        { "name": "focused", "props": { "title": "TEST", "focused": true } },
        { "name": "bottom-anchor", "props": { "title": "TEST", "anchor": "bottom" } },
        { "name": "scrolling", "props": { "title": "TEST", "scrollOffset": 5, "showScroll": true } }
      ],
      "children": ["any"],
      "usedBy": ["AgentScreen", "HomeScreen", "SessionMonitor", "..."]
    }
  ],
  "tree": { /* hierarchie complete */ },
  "hookConflicts": [
    {
      "components": ["TaskInputBar", "AgentScreen"],
      "hooks": ["useInput", "useKeyboard"],
      "conflictingKeys": ["j", "k", "g", "q", "h", "s", "c", "m"],
      "severity": "CRITICAL"
    }
  ]
}
```

### Block

```json
{
  "id": "tui-discover",
  "blockType": "agent",
  "isAtomic": true,
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 20,
    "systemPromptFile": "system-prompt.md"
  }
}
```

Tools disponibles (via `IToolDispatcher`, permissions verifiees): `file-read`, `directory-list`, `shell-execute` (pour `grep`, `node --inspect`).

---

## Phase 2: ANALYSIS — Construire l'Arbre des Invariants

### Ce que l'agent fait

A partir du discovery output, l'agent construit un **arbre de composants** avec des **invariants** pour chaque noeud.

### Invariants = Des regles machine-verifiables

Un invariant est une regle qui doit TOUJOURS etre vraie:

**Invariants atomiques (composant seul)**:
```typescript
// Panel invariants
"Panel.title visible": (frame, props) =>
  !props.title || stripAnsi(frame).includes(props.title)

"Panel.border intact": (frame) =>
  frame.includes('┌') && frame.includes('┐') && frame.includes('└') && frame.includes('┘')

"Panel.focused → double border": (frame, props) =>
  !props.focused || frame.includes('╔')

"Panel.content inside borders": (frame) => {
  const lines = frame.split('\n');
  // Content lines must be between first and last border lines
  return contentIsWithinBorders(lines);
}

"Panel.no overflow": (frame, props) => {
  const contentWidth = measureContentWidth(frame);
  return contentWidth <= props.width - 2; // -2 for borders
}
```

**Invariants metamorphiques (relations entre etats)**:
```typescript
// Resize invariant: changing terminal size doesn't crash or corrupt
"Panel.resize safe": (frame80x24, frame120x40) =>
  frame80x24 !== null && frame120x40 !== null

// Monotonicity: adding a line increases content count
"ConversationLog.monotonic": (frameBefore, frameAfter, lineAdded) =>
  countContentLines(frameAfter) >= countContentLines(frameBefore)

// Idempotency: re-rendering same state produces same output
"Panel.idempotent": (frame1, frame2, sameProps) =>
  sameProps ? frame1 === frame2 : true
```

**Invariants de composition (parent-enfant)**:
```typescript
// AgentScreen invariants
"AgentScreen.all panels visible": (frame) =>
  frame.includes('AGENT STATUS') && frame.includes('CONVERSATION') && frame.includes('ACTIONS')

"AgentScreen.conversation fills space": (frame) => {
  const convPanel = extractPanel(frame, 'CONVERSATION');
  const actionsPanel = extractPanel(frame, 'ACTIONS');
  return convPanel.width > actionsPanel.width;
}
```

**Invariants d'interaction (clavier)**:
```typescript
// Keyboard isolation: pressing 'k' in page mode scrolls, doesn't type
"AgentScreen.k scrolls when unfocused input": (frameBefore, frameAfter) => {
  const inputBefore = extractInput(frameBefore);
  const inputAfter = extractInput(frameAfter);
  return inputBefore === inputAfter; // Input didn't change
}

// Navigation: pressing 'h' goes to home page
"AgentScreen.h navigates to home": (frameAfter) =>
  frameAfter.includes('SYSTEM STATUS') && frameAfter.includes('ACTIVE SESSIONS')
```

### Arbre hierarchique

```
Interface TUI (maestro-code)
├── Design System (@maestro/tui)
│   ├── Panel [5 invariants]
│   ├── NavBar [3 invariants]
│   ├── StatusBar [2 invariants]
│   ├── WorkflowTree [4 invariants]
│   ├── ExecutionLog [3 invariants]
│   └── ... (14 autres composants atomiques)
│
├── Composants maestro-code
│   ├── TaskInputBar [7 invariants]
│   ├── ConversationLog [4 invariants]
│   ├── AgentPanel [3 invariants]
│   ├── AgentStatus [2 invariants]
│   └── AgentActions [1 invariant]
│
├── Ecrans (pages)
│   ├── AgentScreen [6 invariants, 4 interaction tests]
│   ├── HomeScreen [5 invariants, 3 interaction tests]
│   ├── SpacesScreen [4 invariants, 2 interaction tests]
│   ├── FoundryScreen [4 invariants, 2 interaction tests]
│   ├── CatalogScreen [4 invariants, 2 interaction tests]
│   └── ModelsScreen [4 invariants, 2 interaction tests]
│
├── Vues detail
│   ├── SessionMonitor [8 invariants, 6 interaction tests]
│   ├── BlockDetail [3 invariants]
│   ├── WorkspaceDetail [3 invariants]
│   ├── RepoDetail [3 invariants]
│   └── ModelDetail [3 invariants]
│
└── App globale
    ├── Navigation inter-pages [6 invariants]
    ├── Navigation detail ↔ page [4 invariants]
    ├── TaskInputBar + page keyboard isolation [3 invariants]
    ├── Demo mode [2 invariants]
    └── Session lifecycle [4 invariants]
```

### Output

Un fichier `invariant-tree.json` qui sert de specification executable pour toute la suite.

---

## Phase 3: USER DIALOGUE — Poser des Questions

### Ce que l'agent fait

Avant de tester, l'agent pose des questions a l'utilisateur via le **widget system** de Maestro (confirmations, option-select). C'est la premiere vraie utilisation du systeme de widgets interactifs.

### Questions type

1. **Intention globale**: "L'application maestro-code est un moniteur de sessions avec un panel agent interactif. Est-ce correct? Y a-t-il d'autres objectifs?"

2. **Priorites**: "Quels composants sont les plus critiques pour vous?
   - [ ] Le scroll dans la conversation
   - [ ] La navigation entre pages
   - [ ] L'affichage du workflow tree
   - [ ] L'input de taches"

3. **Comportement attendu**: "Quand l'utilisateur appuie sur 'k' dans la page Agent:
   a) Le texte 'k' s'ecrit dans l'input
   b) La conversation scroll vers le haut
   c) Ca depend si l'input est focus ou non"

4. **Tolerance visuelle**: "Quel niveau de precision visuelle attendez-vous?
   a) Fonctionnel (pas de crash, contenu correct)
   b) Propre (pas de debordement, borders intactes)
   c) Pixel-perfect (alignement exact, spacing coherent)"

5. **Scope**: "Voulez-vous que je teste aussi les composants @maestro/tui partages, ou seulement les composants maestro-code?"

### Comment ca fonctionne dans Maestro

L'agent emet un widget via `_interactiveWidgets`:
```json
{
  "type": "option-select",
  "content": "Quand l'utilisateur appuie sur 'k' dans la page Agent:",
  "params": {
    "prompt": "Comportement attendu du scroll",
    "options": [
      { "id": "always-type", "label": "Le texte 'k' s'ecrit dans l'input" },
      { "id": "always-scroll", "label": "La conversation scroll vers le haut" },
      { "id": "focus-dependent", "label": "Depend si l'input est focus ou non" }
    ]
  }
}
```

Maestro Code affiche le widget dans le TaskInputBar, l'utilisateur repond, la reponse revient a l'agent. **C'est exactement le use case prevu par le systeme de widgets** — jamais teste en vrai jusqu'a maintenant.

### Output

Un fichier `user-intent.json` qui enrichit les invariants avec les attentes reelles de l'utilisateur. Les invariants sont marques avec une priorite (critique/important/nice-to-have).

---

## Phase 4: ATOMIC TESTING — Bottom-Up, Composant par Composant

### Strategie

L'agent commence par le composant le **plus atomique** (celui qui n'a aucune dependance TUI) et remonte vers le haut.

**Ordre de test**:
```
1. Text (primitif Ink — pas a tester)
2. Box (primitif Ink — pas a tester)
3. Panel (premier composant @maestro/tui)
4. NavBar (utilise Panel)
5. StatusBar (utilise Panel + theme)
6. ConversationLog (utilise Box + Text)
7. TaskInputBar (utilise Box + Text + useInput)
8. AgentStatus (utilise Box + Text + theme)
9. AgentActions (utilise Box + Text + theme)
10. AgentScreen (compose: NavBar + Panel + ConversationLog + AgentStatus + AgentActions)
11. HomeScreen (compose: NavBar + Panel + SystemStatus + ActiveSessions + QuickActions)
12. ... (autres ecrans)
13. App (compose: tout)
```

### Pour chaque composant

1. **Rendre dans tous les etats** definis dans l'invariant-tree
2. **Verifier chaque invariant** avec `ink-testing-library` + `lastFrame()`
3. **Capturer un golden frame** pour chaque etat
4. **Property-based testing** avec `fast-check`: generer des props aleatoires, verifier que ca ne crash pas
5. **Mesurer**: pass/fail, temps, couverture

### Exemple: Tester Panel

```typescript
describe('Panel [tui-sentinel]', () => {
  // Invariant: title visible
  for (const state of PanelContract.states) {
    it(`shows title in state "${state.name}"`, () => {
      const { lastFrame } = render(h(Panel, state.props, h(Text, null, 'child')));
      if (state.props.title) {
        expect(stripAnsi(lastFrame())).toContain(state.props.title);
      }
    });
  }

  // Invariant: border intact
  it('has complete borders', () => {
    const { lastFrame } = render(h(Panel, { title: 'TEST', width: 30, height: 5 },
      h(Text, null, 'content')));
    const frame = lastFrame();
    expect(frame).toContain('┌');
    expect(frame).toContain('┐');
    expect(frame).toContain('└');
    expect(frame).toContain('┘');
  });

  // Invariant: focused → double border
  it('uses double border when focused', () => {
    const { lastFrame } = render(h(Panel, { title: 'TEST', focused: true, width: 30 },
      h(Text, null, 'content')));
    expect(lastFrame()).toContain('╔');
  });

  // Property: never crashes with random props
  it('survives random props (fast-check)', () => {
    fc.assert(fc.property(
      fc.record({
        title: fc.option(fc.string({ maxLength: 50 })),
        focused: fc.boolean(),
        width: fc.integer({ min: 5, max: 200 }),
        height: fc.integer({ min: 3, max: 100 }),
      }),
      (props) => {
        const { lastFrame } = render(h(Panel, props, h(Text, null, 'x')));
        return lastFrame() !== null;
      }
    ));
  });
});
```

### Agent block

```json
{
  "id": "tui-test-atomic",
  "blockType": "agent",
  "isAtomic": true,
  "config": {
    "model": "claude-sonnet-4-6",
    "maxIterations": 30,
    "wallClockTimeoutSeconds": 900
  }
}
```

Tools (via `IToolDispatcher`): `file-read`, `file-write` (pour generer les tests), `shell-execute` (pour `npx vitest run`).
Chaque appel est verifie contre les permissions de la session (allowedPaths, blockedPaths).

---

## Phase 5: INTEGRATION TESTING — Compositions et Interactions

### Difference avec Phase 4

Phase 4 teste chaque composant **isole**. Phase 5 teste les **compositions**: quand Panel contient ConversationLog, quand AgentScreen compose NavBar + Panel + ConversationLog + TaskInputBar.

### Tests de composition

```typescript
describe('AgentScreen composition [tui-sentinel]', () => {
  // Tous les panels sont visibles
  it('renders all panels', () => {
    const { lastFrame } = render(h(AgentScreen, {
      apiClient: null, onNavigate: () => {}, onQuit: () => {},
      lines: [{ text: 'Hello' }], agentState: 'idle', sessionId: null, busy: false,
    }));
    const frame = stripAnsi(lastFrame());
    expect(frame).toContain('AGENT STATUS');
    expect(frame).toContain('CONVERSATION');
    expect(frame).toContain('ACTIONS');
  });

  // Le contenu de ConversationLog est DANS le panel CONVERSATION
  it('conversation content is inside CONVERSATION panel', () => {
    const lines = [{ text: 'Test line 1' }, { text: 'Test line 2' }];
    const { lastFrame } = render(h(AgentScreen, {
      apiClient: null, onNavigate: () => {}, onQuit: () => {},
      lines, agentState: 'working', sessionId: 'abc', busy: true,
    }));
    const frame = stripAnsi(lastFrame());
    // Content should be between CONVERSATION borders
    expect(frame).toContain('Test line 1');
    expect(frame).toContain('Test line 2');
  });
});
```

### Tests d'interaction clavier

C'est ici qu'on attrape le bug de scroll:

```typescript
describe('Keyboard isolation [tui-sentinel]', () => {
  it('pressing k in AgentScreen does NOT type in TaskInputBar', async () => {
    // Render the FULL App (not just AgentScreen)
    const { lastFrame, stdin } = render(h(App, {
      apiClient: null, sessionManager: null, demoMode: true,
    }));
    await delay(500);

    // Press 'k'
    stdin.write('k');
    await delay(100);

    const frame = stripAnsi(lastFrame());
    // TaskInputBar should NOT contain 'k'
    // (This is the EXACT bug we had — k was being typed into the input)
    const inputLine = frame.split('\n').find(l => l.includes('>'));
    expect(inputLine).not.toContain(' k');
  });

  it('navigation hotkeys work from Agent page', async () => {
    const { lastFrame, stdin } = render(h(App, {
      apiClient: null, sessionManager: null, demoMode: true,
    }));
    await delay(500);

    // Press 'h' to go to Home
    stdin.write('h');
    await delay(200);

    const frame = stripAnsi(lastFrame());
    expect(frame).toContain('SYSTEM STATUS');
  });
});
```

### Tests metamorphiques

```typescript
describe('Metamorphic relations [tui-sentinel]', () => {
  // Resize: content doesn't corrupt
  it('terminal resize preserves content', () => {
    // Render at 80x24
    const { lastFrame: frame1 } = render(h(App, { ... }));
    // Render at 120x40
    const { lastFrame: frame2 } = render(h(App, { ... }));
    // Both should contain the same key elements
    expect(stripAnsi(frame1())).toContain('AGENT STATUS');
    expect(stripAnsi(frame2())).toContain('AGENT STATUS');
  });

  // Adding a line increases visible content (when at bottom)
  it('new line appears in conversation', async () => {
    // ... render, capture frame, add line, capture frame, compare
  });
});
```

---

## Phase 6: VISUAL CAPTURE — Voir Pour de Vrai

### Ce que l'agent fait

Lance le TUI dans un **vrai PTY** via `node-pty`, capture les frames avec `@xterm/headless`, et valide ce que l'utilisateur voit reellement.

C'est la phase qui comble le gap entre "vitest passe" et "ca marche pour de vrai".

### Pipeline

```
node-pty (spawn TUI process)
    ↓ raw ANSI output
@xterm/headless (Terminal emulator, interprets escape codes)
    ↓ positioned text buffer [row][col]
Frame extractor (text lines)
    ↓
Validation rules (overflow, borders, content placement)
    ↓
Pass/Fail + captured frame for evidence
```

### Ce qu'on valide

1. **Layout correct**: les panels sont a la bonne position (ACTIONS a droite, CONVERSATION a gauche)
2. **Pas de debordement**: aucun texte ne sort de son panel
3. **Borders intactes**: les caracteres de bordure forment des rectangles complets
4. **Scroll fonctionne**: apres keystroke de scroll, le contenu visible change
5. **Navigation fonctionne**: apres keystroke de page, le contenu change correctement
6. **Input fonctionne**: taper du texte apparait dans TaskInputBar

### Keystroke sequences a tester

```typescript
const SCENARIOS = [
  {
    name: 'initial-render',
    keys: [],
    expect: ['AGENT STATUS', 'CONVERSATION', 'ACTIONS'],
    waitMs: 3000,
  },
  {
    name: 'navigate-to-home',
    keys: [{ key: 'h', waitMs: 1000 }],
    expect: ['SYSTEM STATUS', 'ACTIVE SESSIONS', 'QUICK ACTIONS'],
  },
  {
    name: 'navigate-back-to-agent',
    keys: [{ key: 'h', waitMs: 500 }, { key: 'a', waitMs: 500 }],
    expect: ['AGENT STATUS', 'CONVERSATION'],
  },
  {
    name: 'scroll-conversation',
    keys: [
      /* wait for demo to populate */ { key: '', waitMs: 5000 },
      { key: '\x1b[1;5A', waitMs: 500 }, // Ctrl+Up
      { key: '\x1b[1;5A', waitMs: 500 }, // Ctrl+Up again
    ],
    expectChange: 'conversation-content',
  },
  {
    name: 'type-in-input',
    keys: [
      { key: 't', waitMs: 100 },
      { key: 'e', waitMs: 100 },
      { key: 's', waitMs: 100 },
      { key: 't', waitMs: 100 },
    ],
    expect: ['test'], // Should appear in TaskInputBar
  },
];
```

---

## Phase 7: FIX & ITERATE — Le Cycle d'Amelioration

### Pattern: SWE-Agent Loop

Inspire de SWE-Agent (NeurIPS 2024) et LIVE-SWE-AGENT:

```
Observe → Diagnose → Fix → Test → Evaluate
    ↑                                    |
    +-------- (if fitness < threshold) --+
```

### Pour chaque bug trouve

1. **Diagnostiquer**: L'agent lit le code source du composant problematique
2. **Proposer un fix**: Genere un patch
3. **Appliquer**: Via `file-edit` tool
4. **Re-tester**: Relance les tests atomiques + integration + visual capture
5. **Evaluer**: Le fitness a-t-il monte?
6. **Accepter ou rollback**: Si le fitness a monte, garder. Sinon, rollback.

### Fitness Score

Inspire d'AlphaEvolve (multi-objectif):

| Metrique | Poids | Mesure |
|----------|-------|--------|
| Test pass rate | 0.30 | tests passes / tests total |
| Invariant coverage | 0.20 | invariants verifies / invariants definis |
| Visual conformity | 0.20 | frames conformes / frames capturees |
| Keyboard isolation | 0.15 | interactions isolees / interactions testees |
| Component coverage | 0.15 | composants testes / composants decouverts |

**Seuil de publication**: fitness >= 0.85

### Limite: L'agent ne fait PAS de refactoring

L'agent corrige des bugs specifiques. Il ne restructure pas l'architecture. Si un probleme necessite un refactoring majeur (ex: ajout de FocusContext), l'agent le signale dans son rapport avec une recommandation, mais ne l'implemente pas.

---

## Phase 8: REPORT — Le Rapport Final

### Format

```json
{
  "timestamp": "2026-02-26T15:30:00Z",
  "fitness": {
    "overall": 0.78,
    "testPassRate": 0.92,
    "invariantCoverage": 0.65,
    "visualConformity": 0.70,
    "keyboardIsolation": 0.60,
    "componentCoverage": 0.95
  },
  "summary": {
    "componentsDiscovered": 34,
    "componentsTested": 32,
    "invariantsDefined": 87,
    "invariantsVerified": 74,
    "invariantsFailed": 13,
    "framesCaptures": 12,
    "framesConformes": 8,
    "bugsFound": 5,
    "bugsFixed": 3,
    "bugsRequiringRefactor": 2
  },
  "criticalIssues": [
    {
      "id": "keyboard-conflict-001",
      "component": "AgentScreen + TaskInputBar",
      "description": "j/k keys are captured by TaskInputBar, preventing scroll",
      "severity": "CRITICAL",
      "fix": "requires FocusContext refactor (Phase 43-A)",
      "autoFixable": false
    },
    {
      "id": "overflow-001",
      "component": "ConversationLog in AgentScreen",
      "description": "Long lines overflow Panel boundary",
      "severity": "HIGH",
      "fix": "Add text truncation in ConversationLog",
      "autoFixable": true,
      "patch": "..."
    }
  ],
  "recommendations": [
    "Implement FocusContext (Phase 43-A) before any further keyboard work",
    "Add text truncation to all Panel children",
    "Fix ConversationLog to NOT slice lines — let Panel handle scroll"
  ]
}
```

### Affichage dans le Monitor

Le rapport est stocke dans les variables de session:
- `_phases` montre la progression des 8 phases
- `_executionTree` montre chaque composant teste
- `_executionLog` montre les resultats en temps reel
- Un widget custom `test-results` montre le fitness score + les bugs trouves

---

## Le Self-Improvement Loop

### Comment ca fonctionne

```
Etape 1: L'utilisateur telecharge Maestro Code v1
         (avec tui-sentinel integre)

Etape 2: L'utilisateur lance:
         $ maestro code
         > /qa                    ← Alias pour tui-sentinel

Etape 3: Maestro Code cree une session:
         Session: "Maestro Code - Self QA"
         Template: tui-sentinel
         Target: packages/maestro-code/

Etape 4: tui-sentinel s'execute:
         - Decouvre ses propres composants
         - Construit l'arbre d'invariants
         - Pose des questions a l'utilisateur
         - Teste du bas vers le haut
         - Capture des frames de sa propre interface
         - Trouve des bugs
         - Corrige ce qu'il peut
         - Genere un rapport

Etape 5: L'utilisateur voit le rapport dans le monitor:
         "Fitness: 0.78 — 5 bugs trouves, 3 corriges"
         "2 bugs necessitent un refactoring — voir recommendations"

Etape 6: L'utilisateur approuve les corrections
         Les fichiers sont modifies dans packages/maestro-code/

Etape 7: L'utilisateur relance /qa
         "Fitness: 0.88 — 2 bugs restants (refactoring needed)"

Etape 8: L'utilisateur fait le refactoring recommande

Etape 9: Relance /qa → "Fitness: 0.95"

Etape 10: Nouvelle version publiee → Maestro Code v1.1
```

### Ce que ca prouve

1. **Les sessions fonctionnent** — creation, template, start, invoke, polling, widgets
2. **Les agents fonctionnent** — tool dispatch via `IToolDispatcher`, permissions, context management, step-complete
3. **Le monitor fonctionne** — affiche le progres en temps reel
4. **Le fitness tracking fonctionne** — mesure multi-objectif
5. **Le self-improvement fonctionne** — l'outil s'ameliore lui-meme
6. **Les widgets interactifs fonctionnent** — l'agent pose des questions, l'utilisateur repond

---

## Isolation et Securite

> **Document detaille: `ISOLATION-ANALYSIS.md`**

### Le probleme bootstrap

L'agent ne peut pas tourner depuis le meme code qu'il modifie. Si il casse App.ts, le monitor crash.

### La violation architecturale actuelle

Le `AgentBlockExecutor` contient un "direct block dispatch" (`ExecuteViaBlockDispatchAsync()`,
ligne 781) qui contourne le CLI et ses verifications de permissions. C'est une triple violation:

1. **CLI-First** — les tool calls ne passent pas par l'infrastructure CLI
2. **L'agent est une boite noire** — le routing de tools est hardcode dans l'executor C#
3. **Non-extensible** — seul l'agent peut faire des tool calls (pas inference, pas d'autres types)

Le chemin securise (`maestro_cli` via `CliExecutor`) est labelle "legacy" et interdit
dans les system prompts modernes. Resultat: le chemin que les agents utilisent n'a
AUCUNE verification de permissions.

### La solution: IToolDispatcher + Git Worktree

```
Maestro Code (source, branch main)    ← L'agent TOURNE ici
    ↓ cree session tui-sentinel
    ↓ SandboxManager.createWorktree()

Git Worktree (branch sentinel-qa-001) ← L'agent TRAVAILLE ici
    ← Chaque tool call → IToolDispatcher (infrastructure)
    ← IToolDispatcher verifie permissions AVANT execution
    ← allowedPaths/blockedPaths/allowedTools respectes
    ← Le code source original est INTACT
```

`IToolDispatcher` est une **interface typee** (JSON natif, pas du texte) qui:
- Recoit le tool call (toolId + args dictionnaire)
- Verifie `ContextPermissions` de la session (comme `CliExecutor` le fait)
- Verifie `allowedPaths`/`blockedPaths` pour les operations fichier
- Resout le block via `IBlockDiscoveryService`
- Execute via `BlockExecutorRegistry`
- Retourne un resultat type

N'importe quel block type (agent, inference, futur) peut utiliser `IToolDispatcher`.
Le `maestro_cli` legacy et le direct dispatch sont tous les deux supprimes.
Un seul chemin, dans l'infrastructure, avec permissions.

### Permissions du template

```json
{
  "permissions": {
    "allowedPaths": ["packages/maestro-code/", "packages/tui/"],
    "blockedPaths": [".git/", "node_modules/", "apps/", "llm-provider/"],
    "allowedTools": ["file-read", "file-edit", "file-write", "shell-execute", "directory-list", "step-complete"],
    "canCreateBlocks": false,
    "canCreateSessions": false
  },
  "sandbox": {
    "type": "git-worktree",
    "branch": "sentinel-qa-{{timestamp}}",
    "autoCreate": true
  },
  "authority": { "type": "human" }
}
```

### Quand l'agent termine

1. Rapport dans les variables de session (visible dans le monitor)
2. Human review: `git diff main..sentinel-qa-001`
3. Approve → `git merge` | Reject → `git worktree remove`

### Chemin vers version distribuee

Quand Phase 40 (distribution) sera terminee:
- L'agent tourne depuis `npm install -g @maestro/cli` (version stable)
- Le code teste est dans un repo separe
- Separation complete: runtime ≠ code teste
- Le template de session et `IToolDispatcher` restent identiques

---

## Plan d'Implementation

### Pre-requis

**Phase 43-PRE: IToolDispatcher + Permission Enforcement** (~3 jours, backend C#)

Ce refactoring corrige la dette architecturale identifiee dans CLAUDE.md et securise l'agent:

- [ ] Creer `IToolDispatcher` interface dans `Maestro.Application/Interfaces/`
  - Interface typee: `DispatchAsync(ToolCall, ExecutionContext, CancellationToken) → ToolResult`
  - N'importe quel block type (agent, inference, futur) peut l'utiliser
- [ ] Implementer `ToolDispatcher` dans `Maestro.Infrastructure/ToolDispatch/`
  - Normalise le tool ID (reprend `NormalizeToolId()` de l'executor)
  - Verifie `ContextPermissions`: `HasTool()`, `allowedPaths`, `blockedPaths`
  - Resout le block et execute (comme le dispatch actuel, mais avec permissions)
- [ ] Migrer `AgentBlockExecutor.ExecuteToolCall()` → `_toolDispatcher.DispatchAsync()`
  - Supprimer `ExecuteViaBlockDispatchAsync()` (code migre dans ToolDispatcher)
  - Supprimer `ExecuteViaCliAsync()` (plus de chemin legacy)
  - Supprimer `NormalizeToolId()` et `GetCliExecutor()` de l'executor
- [ ] Supprimer `maestro_cli` des system prompts (un seul chemin, plus de legacy)
- [ ] SandboxManager integration: creer automatiquement le worktree quand `sandbox.type: "git-worktree"`

**Phase 43: TUI Infrastructure** (~1 semaine)
- [ ] Focus management system (FocusContext)
- [ ] Frame capture pipeline (node-pty + @xterm/headless)
- [ ] Component diagnostic interface (--inspect mode)
- [ ] Fix immediat du scroll (Ctrl+Up/Down)

### Phase 44-A: Block Infrastructure

1. Creer le directory `content/system/blocks/agents/tui-sentinel/`
2. Ecrire le workflow block (`tui-sentinel.workflow.block.json`)
3. Ecrire les 8 agent blocks (discover, analyze, dialogue, test-atomic, test-integration, visual-capture, fix-iterate, report)
4. Ecrire les system prompts pour chaque agent
5. Creer le session template (`tui-sentinel.session.json`)
6. Verifier la decouverte des blocks: `node index.js list-blocks`

### Phase 44-B: Discovery + Analysis Agents

1. Implementer `tui-discover` system prompt
2. Implementer `tui-analyze` system prompt
3. Tester dans une session reelle sur maestro-code
4. Verifier que l'arbre de composants est correct
5. Verifier que les invariants sont pertinents
6. Iterer sur les prompts jusqu'a qualite satisfaisante

### Phase 44-C: Dialogue + Atomic Testing

1. Implementer `tui-dialogue` avec le systeme de widgets
2. Implementer `tui-test-atomic` — generation et execution de tests
3. Tester sur les composants @maestro/tui d'abord (plus simples)
4. Puis sur les composants maestro-code
5. Mesurer: combien d'invariants sont verifies correctement?

### Phase 44-D: Integration + Visual Capture

1. Implementer `tui-test-integration` — tests de composition
2. Implementer `tui-visual-capture` — frame capture + validation
3. Creer les golden files de reference
4. Tester les scenarios de navigation
5. Tester les scenarios de scroll
6. Verifier que les bugs connus (scroll, overflow) sont detectes

### Phase 44-E: Fix + Report + Self-Improvement Loop

1. Implementer `tui-fix-iterate` — diagnostic, patch, re-test
2. Implementer `tui-report` — generation du rapport final
3. Creer l'alias `/qa` dans maestro-code
4. Tester le loop complet: discovery → analysis → test → fix → re-test
5. Mesurer le fitness avant et apres les corrections
6. Documenter le workflow utilisateur

### Phase 44-F: Foundry Training + Publication

1. Creer un workspace pour tui-sentinel
2. Creer une foundry session pour chaque agent block
3. Mesurer le fitness de chaque agent individuellement
4. Iterer sur les system prompts
5. Tester avec au moins 2 modeles differents (claude-sonnet, claude-opus)
6. Publier quand fitness >= 0.85

---

## Risques et Mitigations

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Agent genere des tests qui passent toujours | Fitness inflate | Invariants definis par l'analysis, pas par le test agent |
| Frame capture instable sur Windows | Visual tests flaky | Tolerance configurable, retry, normalize timestamps |
| Widgets interactifs jamais testes en vrai | Dialogue agent bloque | Tester les widgets manuellement d'abord (Phase 43) |
| Agent modifie du code et casse l'app | Regression | Toujours re-tester apres chaque fix, rollback si fitness baisse |
| Discovery manque des composants | Couverture incomplete | Croiser analyse statique + runtime |
| LLM hallucine des invariants | Faux positifs/negatifs | User review des invariants avant test |

---

## Criteres de Succes

- [ ] L'agent decouvre tous les 34 composants de maestro-code
- [ ] L'arbre d'invariants couvre au moins 80% des composants
- [ ] Les tests atomiques passent pour tous les composants @maestro/tui
- [ ] Le bug de scroll est detecte automatiquement par l'agent
- [ ] Le bug d'overflow est detecte automatiquement par l'agent
- [ ] Au moins une correction est appliquee et ameliore le fitness
- [ ] Le rapport est affiche dans le monitor pendant l'execution
- [ ] Le loop complet (discovery → report) s'execute en < 15 minutes
- [ ] L'utilisateur peut lancer `/qa` et voir le resultat
- [ ] Le fitness global atteint >= 0.85 apres les corrections

---

## Conclusion

Cette phase est le moment ou Maestro passe du "framework theorique" a l'"outil qui fait quelque chose". Le TUI Sentinel est le premier agent qui utilise TOUTE l'infrastructure — sessions, blocks, entry points, widgets interactifs, monitor, fitness — pour accomplir une tache reelle et mesurable.

Et cette tache, c'est de s'assurer que lui-meme fonctionne correctement. C'est le bootstrap ultime.
