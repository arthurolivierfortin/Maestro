/**
 * Session Template List Component
 *
 * Displays and manages session templates.
 */

import React, { useState, useMemo } from 'react';
import { useSessionTemplateStore } from '../../store/sessionTemplateStore';
import { useSessionStore } from '../../store/sessionStore';
import type { SessionTemplate, SessionCategory, EnvironmentMode } from '../../types/session.types';
import './SessionTemplateList.scss';

interface SessionTemplateListProps {
  templates: SessionTemplate[];
  categories: SessionCategory[];
  searchQuery: string;
}

interface CreateTemplateFormData {
  name: string;
  description: string;
  categoryId: string;
  mode: EnvironmentMode;
  sandboxImageId: string;
  tags: string;
}

export const SessionTemplateList: React.FC<SessionTemplateListProps> = ({
  templates,
  categories,
  searchQuery,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateTemplateFormData>({
    name: '',
    description: '',
    categoryId: '',
    mode: 'sandbox',
    sandboxImageId: 'sandbox-git',
    tags: '',
  });

  const createTemplate = useSessionTemplateStore((s) => s.createTemplate);
  const deleteTemplate = useSessionTemplateStore((s) => s.deleteTemplate);
  const isLoading = useSessionTemplateStore((s) => s.isLoading);

  const createSessionFromTemplate = useSessionStore((s) => s.createSessionFromTemplate);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [templates, searchQuery]);

  const builtInTemplates = filteredTemplates.filter((t) => t.source === 'built-in');
  const userTemplates = filteredTemplates.filter((t) => t.source === 'user-defined');

  const getCategoryName = (categoryId?: string) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || categoryId;
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      categoryId: '',
      mode: 'sandbox',
      sandboxImageId: 'sandbox-git',
      tags: '',
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTemplate({
        id: formData.name.toLowerCase().replace(/\s+/g, '-'),
        name: formData.name,
        description: formData.description || undefined,
        categoryId: formData.categoryId || undefined,
        mode: formData.mode,
        sandboxImageId: formData.sandboxImageId,
        tags: formData.tags ? formData.tags.split(',').map((t) => t.trim()) : undefined,
      });
      setShowCreateModal(false);
    } catch {
      // Error handled by store
    }
  };

  const handleDelete = async (template: SessionTemplate) => {
    if (template.source === 'built-in') {
      alert('Built-in templates cannot be deleted.');
      return;
    }
    if (confirm(`Delete template "${template.name}"?`)) {
      await deleteTemplate(template.id);
    }
  };

  const handleUseTemplate = async (template: SessionTemplate) => {
    try {
      await createSessionFromTemplate(template.id, { name: `Session from ${template.name}` });
    } catch {
      // Error handled by store
    }
  };

  const renderTemplateCard = (template: SessionTemplate) => (
    <div
      key={template.id}
      className={`template-card ${template.source === 'built-in' ? 'template-card--builtin' : ''}`}
    >
      <div className="template-card__header">
        <h3 className="template-card__name">{template.name}</h3>
        <span className={`badge badge--${template.source}`}>{template.source}</span>
      </div>

      <p className="template-card__description">{template.description || 'No description'}</p>

      <div className="template-card__meta">
        <span className="template-card__category">{getCategoryName(template.categoryId)}</span>
        <span className="template-card__mode">{template.mode}</span>
        <span className="template-card__image">{template.sandboxImageId}</span>
      </div>

      {template.tags && template.tags.length > 0 && (
        <div className="template-card__tags">
          {template.tags.map((tag) => (
            <span key={tag} className="template-card__tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="template-card__actions">
        <button
          className="btn-primary btn-sm"
          onClick={() => handleUseTemplate(template)}
        >
          Use Template
        </button>
        {template.source === 'user-defined' && (
          <button
            className="btn-ghost btn-sm"
            onClick={() => handleDelete(template)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="session-template-list">
      {/* Toolbar */}
      <div className="session-template-list__toolbar">
        <p className="session-template-list__description">
          Templates provide pre-configured session settings for quick creation.
        </p>
        <button className="btn-primary" onClick={openCreateModal}>
          + New Template
        </button>
      </div>

      {/* Built-in templates */}
      {builtInTemplates.length > 0 && (
        <div className="session-template-list__section">
          <h3 className="session-template-list__section-title">Built-in Templates</h3>
          <div className="session-template-list__grid">
            {builtInTemplates.map(renderTemplateCard)}
          </div>
        </div>
      )}

      {/* User templates */}
      <div className="session-template-list__section">
        <h3 className="session-template-list__section-title">Your Templates</h3>
        {userTemplates.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📋</div>
            <h2>No Custom Templates</h2>
            <p>Create your own templates for frequently used session configurations.</p>
            <button className="btn-primary" onClick={openCreateModal}>
              Create Template
            </button>
          </div>
        ) : (
          <div className="session-template-list__grid">
            {userTemplates.map(renderTemplateCard)}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Template</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="template-name">Name *</label>
                  <input
                    id="template-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Template"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="template-description">Description</label>
                  <textarea
                    id="template-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What is this template for?"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="template-category">Default Category</label>
                  <select
                    id="template-category"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
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
                      className={`mode-btn ${formData.mode === 'sandbox' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, mode: 'sandbox' })}
                    >
                      Sandbox
                    </button>
                    <button
                      type="button"
                      className={`mode-btn ${formData.mode === 'repo' ? 'active' : ''}`}
                      onClick={() => setFormData({ ...formData, mode: 'repo' })}
                    >
                      Repo
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="template-image">Sandbox Image</label>
                  <select
                    id="template-image"
                    value={formData.sandboxImageId}
                    onChange={(e) => setFormData({ ...formData, sandboxImageId: e.target.value })}
                  >
                    <option value="sandbox-empty">sandbox-empty (minimal)</option>
                    <option value="sandbox-git">sandbox-git (git, bash)</option>
                    <option value="sandbox-nodejs">sandbox-nodejs (node, npm)</option>
                    <option value="sandbox-python">sandbox-python (python, pip)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="template-tags">Tags (comma-separated)</label>
                  <input
                    id="template-tags"
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="development, testing, python"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Creating...' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
