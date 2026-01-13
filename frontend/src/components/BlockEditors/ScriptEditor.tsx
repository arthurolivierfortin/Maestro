import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BaseBlockEditor } from './BaseBlockEditor';
import type { Block, ScriptBlockConfig } from '../../types/block.types';
import { useBlockStore } from '../../store/blockStore';
import { useNavigationStore } from '../../store/navigationStore';
import './ScriptEditor.scss';

interface ScriptEditorProps {
  block: Block<ScriptBlockConfig>;
}

export function ScriptEditor({ block }: ScriptEditorProps) {
  const { updateBlock } = useBlockStore();
  const navigate = useNavigate();
  const [config, setConfig] = useState<ScriptBlockConfig>(block.config);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const popOne = useNavigationStore((s) => s.popOne);
  const canGoUp = useNavigationStore((s) => s.canGoUp);

  useEffect(() => {
    setHasUnsavedChanges(JSON.stringify(config) !== JSON.stringify(block.config));
  }, [config, block.config]);

  const handleSave = useCallback(() => {
    updateBlock(block.id, { config, inputs: block.inputs, outputs: block.outputs });
  }, [block.id, config, updateBlock, block.inputs, block.outputs]);

  const handleCancelFull = () => {
    setConfig(block.config);
    setHasUnsavedChanges(false);
    if (canGoUp()) {
      popOne();
      return;
    }
    navigate('/foundry');
  };

  return (
    <BaseBlockEditor block={block} onSave={handleSave} onCancel={handleCancelFull} hasUnsavedChanges={hasUnsavedChanges}>
      <div className="script-editor">
        <div className="script-editor__field">
          <label className="script-editor__label">Language</label>
          <select
            className="script-editor__select"
            value={config.language}
            onChange={(e) => setConfig({ ...config, language: e.target.value })}
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="bash">Bash</option>
            <option value="powershell">PowerShell</option>
            <option value="ruby">Ruby</option>
            <option value="go">Go</option>
          </select>
        </div>

        <div className="script-editor__field">
          <label className="script-editor__label">Code</label>
          <textarea
            className="script-editor__textarea"
            value={config.code}
            onChange={(e) => setConfig({ ...config, code: e.target.value })}
            rows={16}
          />
        </div>

        <div className="script-editor__field script-editor__meta">
          <label>
            <input
              type="checkbox"
              checked={!!config.runInSandbox}
              onChange={(e) => setConfig({ ...config, runInSandbox: e.target.checked })}
            />
            Run in sandbox
          </label>

          <label>
            Timeout (s)
            <input
              type="number"
              value={config.timeoutSeconds ?? 30}
              onChange={(e) => setConfig({ ...config, timeoutSeconds: parseInt(e.target.value) || 30 })}
              min={1}
              className="script-editor__timeout"
            />
          </label>
        </div>
      </div>
    </BaseBlockEditor>
  );
}
