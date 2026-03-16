/**
 * ProviderSetupScreen — In-TUI provider configuration.
 *
 * Shown when no LLM providers are configured (`hasProviders === false`).
 * Guides the user through selecting and configuring providers.
 *
 * Flow:
 *   1. Select providers (number keys to toggle, Enter to confirm)
 *   2. Configure each selected provider (sequential text inputs)
 *   3. Save config and call onComplete()
 *
 * Also used as an overlay from ModelsScreen for reconfiguration.
 */

import { createElement as h, useState, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { execSync } from 'node:child_process';
import {
  detectHardware,
  getRecommendedModels,
  saveCapabilities,
  type HardwareCapabilities,
  type RecommendedModel,
} from '../services/hardware-detect.ts';

// ── Types ────────────────────────────────────────────────────

interface ProviderEntry {
  key: string;
  id: string;
  label: string;
  desc: string;
}

interface ProviderSetupScreenProps {
  onComplete: (providers: Record<string, any>) => void;
  onSkip?: () => void;
  existingProviders?: Record<string, any> | null;
}

// ── Provider list (mirrors provider-detect.ts PROVIDERS) ─────

const PROVIDERS: ProviderEntry[] = [
  { key: '1', id: 'claudeCode',     label: 'Claude Code (CLI)',                 desc: 'Uses the Claude CLI on your machine' },
  { key: '2', id: 'anthropic',      label: 'Anthropic API (direct)',            desc: 'Direct API calls to Claude models' },
  { key: '3', id: 'azure',          label: 'Azure OpenAI',                      desc: 'Azure-hosted OpenAI models' },
  { key: '4', id: 'azureInference', label: 'Azure AI Inference / GitHub Models', desc: 'Azure AI or GitHub Models' },
  { key: '5', id: 'local',          label: 'Local (Python FastAPI)',             desc: 'Local GPU inference server' },
  { key: '6', id: 'githubModels',   label: 'GitHub Models (free tier)',          desc: 'Free models via GitHub personal access token' },
];

// ── Field definitions per provider ───────────────────────────

interface FieldDef {
  key: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  required?: boolean;
}

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  claudeCode: [], // Auto-detected, no fields needed
  anthropic: [
    { key: 'apiKey', label: 'Anthropic API Key', placeholder: 'sk-ant-api03-...', required: true },
  ],
  azure: [
    { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://my-resource.openai.azure.com', required: true },
    { key: 'apiKey', label: 'API Key', placeholder: 'your-api-key', required: true },
    { key: 'deployment', label: 'Deployment name', placeholder: 'gpt-4o', required: true },
  ],
  azureInference: [
    { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://models.inference.ai.azure.com', required: true },
    { key: 'apiKey', label: 'API Key (or GitHub PAT)', placeholder: 'your-api-key', required: true },
    { key: 'model', label: 'Model name', placeholder: 'gpt-4o', defaultValue: 'gpt-4o' },
  ],
  local: [
    { key: 'url', label: 'Server URL', placeholder: 'http://localhost:8000', defaultValue: 'http://localhost:8000' },
  ],
  githubModels: [
    { key: 'token', label: 'GitHub Personal Access Token', placeholder: 'ghp_...', required: true },
  ],
};

// ── Phase 1: Provider Selection ──────────────────────────────

const ProviderSelector = ({ selected, onToggle, onConfirm }: {
  selected: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
}) => {
  useInput((input, key) => {
    if (key.return && selected.size > 0) {
      onConfirm();
      return;
    }
    // Number keys toggle providers
    const provider = PROVIDERS.find(p => p.key === input);
    if (provider) {
      onToggle(provider.id);
    }
  });

  return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', padding: 1, width: 64 },
      h(Text, { color: 'cyan', bold: true }, '  Provider Setup'),
      h(Box, { height: 1 }),
      h(Text, null, '  Which LLM providers do you want to use?'),
      h(Text, { color: 'gray', dimColor: true }, '  Press number keys to toggle, Enter to confirm.'),
      h(Box, { height: 1 }),
      ...PROVIDERS.map(p => {
        const isSelected = selected.has(p.id);
        const checkbox = isSelected ? '[x]' : '[ ]';
        const checkColor = isSelected ? 'green' : 'gray';
        return h(Box, { key: p.id, flexDirection: 'column', paddingLeft: 2 },
          h(Box, { flexDirection: 'row' },
            h(Text, { color: checkColor, bold: isSelected }, `  ${checkbox} `),
            h(Text, { color: 'cyan', bold: true }, `[${p.key}] `),
            h(Text, { color: isSelected ? 'white' : 'gray' }, p.label),
          ),
          h(Text, { color: 'gray', dimColor: true }, `        ${p.desc}`),
        );
      }),
      h(Box, { height: 1 }),
      selected.size > 0
        ? h(Text, { color: 'green' }, `  Selected: ${Array.from(selected).map(id => PROVIDERS.find(p => p.id === id)?.label).join(', ')}`)
        : h(Text, { color: 'gray', dimColor: true }, '  No providers selected.'),
      h(Box, { height: 1 }),
      selected.size > 0
        ? h(Text, { color: 'cyan' }, '  Press Enter to continue.')
        : null,
    ),
  );
};

// ── Phase 2: Field Input ─────────────────────────────────────

const FieldInput = ({ provider, fields, onDone }: {
  provider: ProviderEntry;
  fields: FieldDef[];
  onDone: (config: Record<string, string>) => void;
}) => {
  const [fieldIndex, setFieldIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [currentValue, setCurrentValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const valueRef = useRef('');
  const cursorRef = useRef(0);

  const field = fields[fieldIndex];

  useInput((input, key) => {
    let v = valueRef.current;
    let c = cursorRef.current;

    if (key.return) {
      const finalValue = v.trim() || field.defaultValue || '';
      if (field.required && !finalValue) return; // Don't proceed if required and empty

      const newValues = { ...values, [field.key]: finalValue };
      setValues(newValues);

      if (fieldIndex < fields.length - 1) {
        // Move to next field
        setFieldIndex(fieldIndex + 1);
        v = '';
        c = 0;
      } else {
        // All fields done
        onDone(newValues);
        return;
      }
    } else if (key.backspace || key.delete) {
      if (c > 0) {
        v = v.slice(0, c - 1) + v.slice(c);
        c = c - 1;
      }
    } else if (key.leftArrow) {
      c = Math.max(0, c - 1);
    } else if (key.rightArrow) {
      c = Math.min(v.length, c + 1);
    } else if (input === 'a' && key.ctrl) {
      c = 0;
    } else if (input === 'e' && key.ctrl) {
      c = v.length;
    } else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
      v = v.slice(0, c) + input + v.slice(c);
      c = c + input.length;
    }

    valueRef.current = v;
    cursorRef.current = c;
    setCurrentValue(v);
    setCursor(c);
  });

  return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', padding: 1, width: 64 },
      h(Text, { color: 'cyan', bold: true }, `  ${provider.label} Configuration`),
      h(Box, { height: 1 }),
      // Show completed fields
      ...Object.entries(values).map(([key, val]) =>
        h(Box, { key, flexDirection: 'row', paddingLeft: 2 },
          h(Text, { color: 'green' }, '  [done] '),
          h(Text, { color: 'gray' }, `${fields.find(f => f.key === key)?.label}: `),
          h(Text, { color: 'white' }, val.length > 30 ? val.substring(0, 30) + '...' : val),
        )
      ),
      // Current field
      h(Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
        h(Text, { color: 'white', bold: true }, `  ${field.label}:`),
        field.defaultValue
          ? h(Text, { color: 'gray', dimColor: true }, `    Default: ${field.defaultValue}`)
          : null,
        h(Box, { flexDirection: 'row', marginTop: 1 },
          h(Text, { color: 'cyan', bold: true }, '  > '),
          h(Text, null, currentValue || h(Text, { color: 'gray', dimColor: true }, field.placeholder)),
        ),
      ),
      h(Box, { height: 1 }),
      h(Text, { color: 'gray', dimColor: true }, `  Field ${fieldIndex + 1} of ${fields.length}. Press Enter to confirm.`),
    ),
  );
};

// ── Phase 2b: Claude Code Auto-Detection ─────────────────────

const ClaudeCodeSetup = ({ onDone }: { onDone: (config: { cliPath: string } | null) => void }) => {
  const [cliPath, setCliPath] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(true);
  const [manualInput, setManualInput] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const manualRef = useRef('');
  const cursorRef = useRef(0);

  // Auto-detect on mount
  const detected = useRef(false);
  if (!detected.current) {
    detected.current = true;
    try {
      const cmd = process.platform === 'win32' ? 'where claude' : 'which claude';
      const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
      const found = result.split('\n')[0].trim();
      setCliPath(found);
    } catch {
      setCliPath(null);
    }
    setDetecting(false);
  }

  useInput((input, key) => {
    if (manualInput) {
      let v = manualRef.current;
      let c = cursorRef.current;

      if (key.return) {
        const finalValue = v.trim();
        if (finalValue) {
          onDone({ cliPath: finalValue });
        }
        return;
      } else if (key.escape) {
        setManualInput(false);
        return;
      } else if (key.backspace || key.delete) {
        if (c > 0) { v = v.slice(0, c - 1) + v.slice(c); c--; }
      } else if (key.leftArrow) { c = Math.max(0, c - 1); }
      else if (key.rightArrow) { c = Math.min(v.length, c + 1); }
      else if (input && !key.ctrl && !key.meta && !key.tab && !key.escape) {
        v = v.slice(0, c) + input + v.slice(c); c += input.length;
      }

      manualRef.current = v;
      cursorRef.current = c;
      setManualValue(v);
      return;
    }

    // Non-manual mode
    if (key.return && cliPath) {
      onDone({ cliPath });
    } else if (input === 'm' || input === 'M') {
      setManualInput(true);
    } else if (input === 's' || input === 'S') {
      onDone(null); // Skip
    }
  });

  if (detecting) {
    return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
      h(Text, { color: 'cyan' }, '  Detecting Claude CLI...'),
    );
  }

  return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', padding: 1, width: 64 },
      h(Text, { color: 'cyan', bold: true }, '  Claude Code Setup'),
      h(Box, { height: 1 }),
      cliPath
        ? h(Box, { flexDirection: 'column', paddingLeft: 2 },
            h(Text, { color: 'green' }, `  Found Claude CLI at:`),
            h(Text, { color: 'white', bold: true }, `  ${cliPath}`),
            h(Box, { height: 1 }),
            h(Text, null, '  Make sure you are logged in:'),
            h(Text, { color: 'cyan' }, '  Run "claude login" in another terminal if needed.'),
            h(Box, { height: 1 }),
            h(Text, { color: 'green' }, '  [Enter] Use this path'),
            h(Text, { color: 'gray' }, '  [M] Enter path manually'),
          )
        : h(Box, { flexDirection: 'column', paddingLeft: 2 },
            h(Text, { color: 'yellow' }, '  Claude CLI not found in PATH.'),
            h(Box, { height: 1 }),
            h(Text, null, '  Install from:'),
            h(Text, { color: 'cyan' }, '  https://docs.anthropic.com/en/docs/claude-code/overview'),
            h(Box, { height: 1 }),
            h(Text, { color: 'gray' }, '  [M] Enter path manually'),
            h(Text, { color: 'gray' }, '  [S] Skip Claude Code'),
          ),
      manualInput
        ? h(Box, { flexDirection: 'column', paddingLeft: 2, marginTop: 1 },
            h(Text, { color: 'white', bold: true }, '  Path to claude CLI:'),
            h(Box, { flexDirection: 'row' },
              h(Text, { color: 'cyan', bold: true }, '  > '),
              h(Text, null, manualValue || h(Text, { color: 'gray', dimColor: true }, '/path/to/claude')),
            ),
          )
        : null,
    ),
  );
};

// ── Phase 2c: Local Provider Setup (hardware-aware) ──────────

const LocalSetup = ({ onDone }: { onDone: (config: Record<string, any>) => void }) => {
  const [step, setStep] = useState<'detect' | 'review'>('detect');
  const [hw, setHw] = useState<HardwareCapabilities | null>(null);
  const [models, setModels] = useState<RecommendedModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(0);
  const [url, setUrl] = useState('http://localhost:8000');

  // Auto-detect on mount
  const detected = useRef(false);
  if (!detected.current) {
    detected.current = true;
    const caps = detectHardware();
    setHw(caps);
    saveCapabilities(caps);
    const recommended = getRecommendedModels(caps);
    setModels(recommended);
    setStep('review');
  }

  useInput((input, key) => {
    if (step !== 'review') return;

    if (key.upArrow || input === 'k') {
      setSelectedModel(i => Math.max(0, i - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedModel(i => Math.min(models.length - 1, i + 1));
    } else if (key.return) {
      const chosen = models[selectedModel];
      onDone({
        url,
        recommendedModel: chosen?.modelId ?? null,
        capabilities: hw,
      });
    }
  });

  if (step === 'detect' || !hw) {
    return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
      h(Text, { color: 'cyan' }, '  Detecting hardware...'),
    );
  }

  const vramGb = hw.vramMb > 0 ? `${(hw.vramMb / 1024).toFixed(1)} GB` : 'None';
  const ramGb = `${(hw.ramMb / 1024).toFixed(1)} GB`;

  return h(Box, { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, padding: 2 },
    h(Box, { flexDirection: 'column', borderStyle: 'single', borderColor: 'cyan', padding: 1, width: 68 },
      h(Text, { color: 'cyan', bold: true }, '  Local Provider Setup'),
      h(Box, { height: 1 }),

      // Hardware summary
      h(Box, { flexDirection: 'column', paddingLeft: 2 },
        h(Text, { bold: true }, '  Hardware Detected:'),
        h(Box, { flexDirection: 'row' },
          h(Text, { color: 'gray' }, '    GPU:    '),
          hw.cudaAvailable
            ? h(Text, { color: 'green' }, hw.gpuName ?? 'CUDA GPU')
            : h(Text, { color: 'yellow' }, 'No GPU (CPU only)'),
        ),
        hw.cudaAvailable
          ? h(Box, { flexDirection: 'row' },
              h(Text, { color: 'gray' }, '    VRAM:   '),
              h(Text, { color: 'white' }, vramGb),
            )
          : null,
        h(Box, { flexDirection: 'row' },
          h(Text, { color: 'gray' }, '    RAM:    '),
          h(Text, { color: 'white' }, ramGb),
        ),
        h(Box, { flexDirection: 'row' },
          h(Text, { color: 'gray' }, '    CPU:    '),
          h(Text, { color: 'white' }, `${hw.cpuCores} cores`),
        ),
      ),

      h(Box, { height: 1 }),

      // Model recommendations
      h(Box, { flexDirection: 'column', paddingLeft: 2 },
        h(Text, { bold: true }, '  Recommended Models:'),
        !hw.cudaAvailable
          ? h(Text, { color: 'yellow', dimColor: true }, '    No GPU detected. CPU inference will be very slow.')
          : null,
        h(Box, { height: 1 }),
        ...models.map((m, i) => {
          const sel = i === selectedModel;
          const arrow = sel ? '>' : ' ';
          const nameColor = sel ? 'cyan' : 'white';
          return h(Box, { key: m.modelId, flexDirection: 'column', paddingLeft: 2 },
            h(Box, { flexDirection: 'row' },
              h(Text, { color: sel ? 'cyan' : 'gray' }, `  ${arrow} `),
              h(Text, { color: nameColor, bold: sel }, m.name),
              h(Text, { color: 'gray' }, `  ${m.sizeLabel}`),
              m.slow ? h(Text, { color: 'red' }, '  SLOW') : null,
            ),
            h(Text, { color: 'gray', dimColor: true }, `      ${m.description}`),
          );
        }),
      ),

      h(Box, { height: 1 }),
      h(Box, { flexDirection: 'row', paddingLeft: 2 },
        h(Text, { color: 'gray' }, '    Server URL: '),
        h(Text, { color: 'white' }, url),
      ),
      h(Box, { height: 1 }),
      h(Text, { color: 'cyan', dimColor: true }, '    Use j/k to select model, Enter to confirm.'),
    ),
  );
};

// ── Main ProviderSetupScreen ─────────────────────────────────

type Phase = 'select' | 'configure' | 'done';

const ProviderSetupScreen = ({ onComplete, onSkip, existingProviders }: ProviderSetupScreenProps) => {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedProviders, setSelectedProviders] = useState<Set<string>>(() => {
    // Pre-select existing providers if reconfiguring
    if (existingProviders) return new Set(Object.keys(existingProviders));
    return new Set<string>();
  });
  const [configQueue, setConfigQueue] = useState<string[]>([]);
  const [configIndex, setConfigIndex] = useState(0);
  const [providerConfigs, setProviderConfigs] = useState<Record<string, any>>({});

  const handleToggle = useCallback((id: string) => {
    setSelectedProviders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectionConfirm = useCallback(() => {
    const queue = Array.from(selectedProviders);
    setConfigQueue(queue);
    setConfigIndex(0);
    setPhase('configure');
  }, [selectedProviders]);

  const handleProviderConfigured = useCallback((providerId: string, config: Record<string, any> | null) => {
    if (config) {
      setProviderConfigs(prev => ({ ...prev, [providerId]: config }));
    }

    const nextIndex = configIndex + 1;
    if (nextIndex >= configQueue.length) {
      // All providers configured — save and complete
      const allConfigs = { ...providerConfigs };
      if (config) allConfigs[configQueue[configIndex]] = config;

      if (Object.keys(allConfigs).length > 0) {
        onComplete(allConfigs);
      } else if (onSkip) {
        onSkip();
      }
    } else {
      setConfigIndex(nextIndex);
    }
  }, [configIndex, configQueue, providerConfigs, onComplete, onSkip]);

  // Phase 1: Provider selection
  if (phase === 'select') {
    return h(ProviderSelector, {
      selected: selectedProviders,
      onToggle: handleToggle,
      onConfirm: handleSelectionConfirm,
    });
  }

  // Phase 2: Configure each selected provider
  if (phase === 'configure' && configIndex < configQueue.length) {
    const providerId = configQueue[configIndex];
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (!provider) return null;

    // Claude Code has special auto-detection flow
    if (providerId === 'claudeCode') {
      return h(ClaudeCodeSetup, {
        onDone: (config) => handleProviderConfigured(providerId, config),
      });
    }

    // Local provider has hardware-aware setup
    if (providerId === 'local') {
      return h(LocalSetup, {
        onDone: (config) => handleProviderConfigured(providerId, config),
      });
    }

    // Other providers use field-based input
    const fields = PROVIDER_FIELDS[providerId];
    if (!fields || fields.length === 0) {
      // No fields — skip
      handleProviderConfigured(providerId, {});
      return null;
    }

    return h(FieldInput, {
      provider,
      fields,
      onDone: (config) => handleProviderConfigured(providerId, config),
    });
  }

  return null;
};

export { ProviderSetupScreen, PROVIDERS as SETUP_PROVIDERS };
