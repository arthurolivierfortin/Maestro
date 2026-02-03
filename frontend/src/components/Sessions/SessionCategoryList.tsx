/**
 * Session Category List Component
 *
 * Displays and manages session categories.
 */

import React, { useState, useMemo } from 'react';
import { useSessionCategoryStore } from '../../store/sessionCategoryStore';
import type { SessionCategory } from '../../types/session.types';
import './SessionCategoryList.scss';

interface SessionCategoryListProps {
  categories: SessionCategory[];
  searchQuery: string;
}

interface EditCategoryFormData {
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const SessionCategoryList: React.FC<SessionCategoryListProps> = ({
  categories,
  searchQuery,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SessionCategory | null>(null);
  const [formData, setFormData] = useState<EditCategoryFormData>({
    name: '',
    description: '',
    icon: 'folder',
    color: '#6B7280',
  });

  const createCategory = useSessionCategoryStore((s) => s.createCategory);
  const updateCategory = useSessionCategoryStore((s) => s.updateCategory);
  const deleteCategory = useSessionCategoryStore((s) => s.deleteCategory);
  const isLoading = useSessionCategoryStore((s) => s.isLoading);

  // Filter categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
    );
  }, [categories, searchQuery]);

  const builtInCategories = filteredCategories.filter((c) => c.source === 'built-in');
  const userCategories = filteredCategories.filter((c) => c.source === 'user-defined');

  const openCreateModal = () => {
    setFormData({ name: '', description: '', icon: 'folder', color: '#6B7280' });
    setEditingCategory(null);
    setShowCreateModal(true);
  };

  const openEditModal = (category: SessionCategory) => {
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || 'folder',
      color: category.color || '#6B7280',
    });
    setEditingCategory(category);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
      } else {
        // Generate id from name
        const id = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        await createCategory({ ...formData, id });
      }
      setShowCreateModal(false);
    } catch {
      // Error handled by store
    }
  };

  const handleDelete = async (category: SessionCategory) => {
    if (category.isSystem) {
      alert('System categories cannot be deleted.');
      return;
    }
    if (category.source === 'built-in') {
      alert('Built-in categories cannot be deleted.');
      return;
    }
    if (confirm(`Delete category "${category.name}"? Sessions in this category will become uncategorized.`)) {
      await deleteCategory(category.id);
    }
  };

  const iconOptions = [
    'folder', 'settings', 'code', 'terminal', 'flask', 'hammer', 'rocket',
    'database', 'cloud', 'shield', 'book', 'star', 'flag', 'tag',
  ];

  const colorOptions = [
    '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316',
  ];

  const renderCategoryCard = (category: SessionCategory) => (
    <div
      key={category.id}
      className={`category-card ${category.source === 'built-in' ? 'category-card--builtin' : ''}`}
    >
      <div className="category-card__icon" style={{ backgroundColor: category.color || '#6B7280' }}>
        {category.icon || 'folder'}
      </div>
      <div className="category-card__content">
        <div className="category-card__header">
          <h3 className="category-card__name">{category.name}</h3>
          <div className="category-card__badges">
            {category.isSystem && <span className="badge badge--system">System</span>}
            <span className={`badge badge--${category.source}`}>{category.source}</span>
          </div>
        </div>
        <p className="category-card__description">{category.description || 'No description'}</p>
      </div>
      <div className="category-card__actions">
        {category.source === 'user-defined' && (
          <>
            <button
              className="category-card__action"
              onClick={() => openEditModal(category)}
              title="Edit category"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10z" />
              </svg>
            </button>
            {!category.isSystem && (
              <button
                className="category-card__action category-card__action--delete"
                onClick={() => handleDelete(category)}
                title="Delete category"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                  <path d="M5.5 1a.5.5 0 0 0-.5.5v1h-3a.5.5 0 0 0 0 1h.5l.5 10.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L13.5 3.5h.5a.5.5 0 0 0 0-1h-3v-1a.5.5 0 0 0-.5-.5h-5z" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="session-category-list">
      {/* Toolbar */}
      <div className="session-category-list__toolbar">
        <p className="session-category-list__description">
          Categories help organize your sessions. Built-in categories cannot be modified or deleted.
        </p>
        <button className="btn-primary" onClick={openCreateModal}>
          + New Category
        </button>
      </div>

      {/* Built-in categories */}
      {builtInCategories.length > 0 && (
        <div className="session-category-list__section">
          <h3 className="session-category-list__section-title">Built-in Categories</h3>
          <div className="session-category-list__grid">
            {builtInCategories.map(renderCategoryCard)}
          </div>
        </div>
      )}

      {/* User categories */}
      <div className="session-category-list__section">
        <h3 className="session-category-list__section-title">Your Categories</h3>
        {userCategories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📁</div>
            <h2>No Custom Categories</h2>
            <p>Create your own categories to organize sessions your way.</p>
            <button className="btn-primary" onClick={openCreateModal}>
              Create Category
            </button>
          </div>
        ) : (
          <div className="session-category-list__grid">
            {userCategories.map(renderCategoryCard)}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCategory ? 'Edit Category' : 'Create Category'}</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="category-name">Name *</label>
                  <input
                    id="category-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Category"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="category-description">Description</label>
                  <textarea
                    id="category-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What is this category for?"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Icon</label>
                  <div className="icon-picker">
                    {iconOptions.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        className={`icon-picker__item ${formData.icon === icon ? 'selected' : ''}`}
                        onClick={() => setFormData({ ...formData, icon })}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker">
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-picker__item ${formData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
