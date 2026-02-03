/**
 * Create Session Dialog
 *
 * Dialog for creating a new session with template or custom configuration.
 */

import React, { useState, useEffect } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { useSessionTemplateStore } from '../../store/sessionTemplateStore';
import type { SessionCategory, EnvironmentMode } from '../../types/session.types';
import './CreateSessionDialog.scss';

interface CreateSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: SessionCategory[];
}

type CreationMode = 'template' | 'custom';

export const CreateSessionDialog: React.FC<CreateSessionDialogProps> = ({
  isOpen,
  onClose,
  categories,
}) => {
  const [creationMode, setCreationMode] = useState<CreationMode>('template');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Custom mode state
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [mode, setMode] = useState<EnvironmentMode>('sandbox');
  const [sandboxImageId, setSandboxImageId] = useState('sandbox-git');
  const [hostPath, setHostPath] = useState('');
  const [containerPath, setContainerPath] = useState('/workspace');

  const templates = useSessionTemplateStore((s) => s.templates);
  const loadTemplates = useSessionTemplateStore((s) => s.loadTemplates);
  const createSession = useSessionStore((s) => s.createSession);
  const createSessionFromTemplate = useSessionStore((s) => s.createSessionFromTemplate);
  const isLoading = useSessionStore((s) => s.isLoading);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      // Reset form
      setCreationMode('template');
      setSelectedTemplateId('');
      setName('');
      setCategoryId('');
      setMode('sandbox');
      setSandboxImageId('sandbox-git');
      setHostPath('');
      setContainerPath('/workspace');
    }
  }, [isOpen, loadTemplates]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (creationMode === 'template' && selectedTemplateId) {
        await createSessionFromTemplate(selectedTemplateId, { name: name || `Session from template` });
      } else {
        await createSession({
          name,
          categoryId: categoryId || undefined,
          mode,
          sandboxImageId,
          repoBind: mode === 'repo' ? { hostPath, containerPath, readOnly: false } : undefined,
        });
      }
      onClose();
    } catch {
      // Error handled by store
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Session</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Creation mode toggle */}
            <div className="creation-mode-toggle">
              <button
                type="button"
                className={`creation-mode-btn ${creationMode === 'template' ? 'active' : ''}`}
                onClick={() => setCreationMode('template')}
              >
                From Template
              </button>
              <button
                type="button"
                className={`creation-mode-btn ${creationMode === 'custom' ? 'active' : ''}`}
                onClick={() => setCreationMode('custom')}
              >
                Custom
              </button>
            </div>

            {creationMode === 'template' ? (
              <>
                {/* Template selection */}
                <div className="form-group">
                  <label>Select Template</label>
                  <div className="template-grid">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className={`template-card ${selectedTemplateId === template.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        <div className="template-card__header">
                          <span className="template-card__name">{template.name}</span>
                          <span className={`template-card__source ${template.source}`}>
                            {template.source}
                          </span>
                        </div>
                        <p className="template-card__description">{template.description}</p>
                        <div className="template-card__meta">
                          <span>{template.mode}</span>
                          <span>{template.sandboxImageId}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional name override */}
                {selectedTemplate && (
                  <div className="form-group">
                    <label htmlFor="session-name">Session Name (optional)</label>
                    <input
                      id="session-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={`Leave empty to use template default`}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Custom configuration */}
                <div className="form-group">
                  <label htmlFor="session-name">Session Name *</label>
                  <input
                    id="session-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Session"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category</label>
                  <select
                    id="category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Environment Mode</label>
                  <div className="mode-toggle">
                    <button
                      type="button"
                      className={`mode-btn ${mode === 'sandbox' ? 'active' : ''}`}
                      onClick={() => setMode('sandbox')}
                    >
                      <strong>Sandbox</strong>
                      <span>Ephemeral, isolated environment</span>
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${mode === 'repo' ? 'active' : ''}`}
                      onClick={() => setMode('repo')}
                    >
                      <strong>Repo</strong>
                      <span>Bind mount to local directory</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="sandbox-image">Sandbox Image</label>
                  <select
                    id="sandbox-image"
                    value={sandboxImageId}
                    onChange={(e) => setSandboxImageId(e.target.value)}
                  >
                    <option value="sandbox-empty">sandbox-empty (minimal)</option>
                    <option value="sandbox-git">sandbox-git (git, bash)</option>
                    <option value="sandbox-nodejs">sandbox-nodejs (node, npm)</option>
                    <option value="sandbox-python">sandbox-python (python, pip)</option>
                  </select>
                </div>

                {mode === 'repo' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="host-path">Host Path *</label>
                      <input
                        id="host-path"
                        type="text"
                        required
                        value={hostPath}
                        onChange={(e) => setHostPath(e.target.value)}
                        placeholder="C:\Projects\my-repo"
                      />
                      <p className="form-group__help">
                        Local directory to mount into the container
                      </p>
                    </div>

                    <div className="form-group">
                      <label htmlFor="container-path">Container Path</label>
                      <input
                        id="container-path"
                        type="text"
                        value={containerPath}
                        onChange={(e) => setContainerPath(e.target.value)}
                        placeholder="/workspace"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isLoading || (creationMode === 'template' && !selectedTemplateId) || (creationMode === 'custom' && !name)}
            >
              {isLoading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
