/**
 * Sandbox Image List Component
 *
 * Displays and manages sandbox Docker images.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { sandboxImageService } from '../../services/sandboxImageService';
import type { SandboxImage } from '../../types/session.types';
import './SandboxImageList.scss';

interface SandboxImageListProps {
  searchQuery: string;
}

interface RegisterImageFormData {
  id: string;
  dockerImage: string;
  name: string;
  description: string;
  tools: string;
}

export const SandboxImageList: React.FC<SandboxImageListProps> = ({ searchQuery }) => {
  const [images, setImages] = useState<SandboxImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [formData, setFormData] = useState<RegisterImageFormData>({
    id: '',
    dockerImage: '',
    name: '',
    description: '',
    tools: '',
  });

  // Load images on mount
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await sandboxImageService.getAll();
      setImages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sandbox images');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter images
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return images;
    const query = searchQuery.toLowerCase();
    return images.filter(
      (img) =>
        img.id.toLowerCase().includes(query) ||
        img.name.toLowerCase().includes(query) ||
        img.dockerImage.toLowerCase().includes(query) ||
        img.tools?.some((tool) => tool.toLowerCase().includes(query))
    );
  }, [images, searchQuery]);

  const builtInImages = filteredImages.filter((img) => img.source === 'built-in');
  const userImages = filteredImages.filter((img) => img.source === 'user-defined');

  const openRegisterModal = () => {
    setFormData({
      id: '',
      dockerImage: '',
      name: '',
      description: '',
      tools: '',
    });
    setShowRegisterModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sandboxImageService.register({
        id: formData.id,
        dockerImage: formData.dockerImage,
        name: formData.name,
        description: formData.description || undefined,
        tools: formData.tools ? formData.tools.split(',').map((t) => t.trim()) : undefined,
      });
      setShowRegisterModal(false);
      loadImages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register image');
    }
  };

  const handleDelete = async (image: SandboxImage) => {
    if (image.source === 'built-in') {
      alert('Built-in images cannot be deleted.');
      return;
    }
    if (confirm(`Delete image "${image.name}"?`)) {
      try {
        await sandboxImageService.delete(image.id);
        loadImages();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete image');
      }
    }
  };

  const handleVerify = async (image: SandboxImage) => {
    try {
      const result = await sandboxImageService.verify(image.id);
      if (result.success) {
        alert(`Image "${image.dockerImage}" is available and ready to use.`);
      } else {
        alert(`Image "${image.dockerImage}" is not available: ${result.errorMessage || 'Please pull the image first.'}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify image');
    }
  };

  const renderImageCard = (image: SandboxImage) => (
    <div
      key={image.id}
      className={`sandbox-image-card ${image.source === 'built-in' ? 'sandbox-image-card--builtin' : ''}`}
    >
      <div className="sandbox-image-card__header">
        <h3 className="sandbox-image-card__name">{image.name}</h3>
        <span className={`badge badge--${image.source}`}>{image.source}</span>
      </div>

      <div className="sandbox-image-card__id">
        <code>{image.id}</code>
      </div>

      <div className="sandbox-image-card__docker">
        <span className="label">Docker Image:</span>
        <code>{image.dockerImage}</code>
      </div>

      <p className="sandbox-image-card__description">{image.description || 'No description'}</p>

      {image.tools && image.tools.length > 0 && (
        <div className="sandbox-image-card__tools">
          <span className="label">Tools:</span>
          <div className="sandbox-image-card__tool-list">
            {image.tools.map((tool) => (
              <span key={tool} className="sandbox-image-card__tool">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="sandbox-image-card__actions">
        <button className="btn-ghost btn-sm" onClick={() => handleVerify(image)}>
          Verify
        </button>
        {image.source === 'user-defined' && (
          <button
            className="btn-ghost btn-sm btn-danger"
            onClick={() => handleDelete(image)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );

  if (isLoading && images.length === 0) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading sandbox images...</p>
      </div>
    );
  }

  return (
    <div className="sandbox-image-list">
      {/* Toolbar */}
      <div className="sandbox-image-list__toolbar">
        <p className="sandbox-image-list__description">
          Sandbox images are Docker images used to create isolated session environments.
          Build your images externally and register them here.
        </p>
        <button className="btn-primary" onClick={openRegisterModal}>
          + Register Image
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Built-in images */}
      {builtInImages.length > 0 && (
        <div className="sandbox-image-list__section">
          <h3 className="sandbox-image-list__section-title">Built-in Images</h3>
          <div className="sandbox-image-list__grid">
            {builtInImages.map(renderImageCard)}
          </div>
        </div>
      )}

      {/* User images */}
      <div className="sandbox-image-list__section">
        <h3 className="sandbox-image-list__section-title">Your Images</h3>
        {userImages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🐳</div>
            <h2>No Custom Images</h2>
            <p>Register your own Docker images for specialized environments.</p>
            <button className="btn-primary" onClick={openRegisterModal}>
              Register Image
            </button>
          </div>
        ) : (
          <div className="sandbox-image-list__grid">
            {userImages.map(renderImageCard)}
          </div>
        )}
      </div>

      {/* Register modal */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Register Sandbox Image</h2>
              <button className="modal-close" onClick={() => setShowRegisterModal(false)}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="image-id">Image ID *</label>
                  <input
                    id="image-id"
                    type="text"
                    required
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                    placeholder="my-custom-image"
                    pattern="[a-z0-9-]+"
                  />
                  <p className="form-group__help">
                    Lowercase letters, numbers, and hyphens only
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="docker-image">Docker Image *</label>
                  <input
                    id="docker-image"
                    type="text"
                    required
                    value={formData.dockerImage}
                    onChange={(e) => setFormData({ ...formData, dockerImage: e.target.value })}
                    placeholder="myregistry/myimage:latest"
                  />
                  <p className="form-group__help">
                    The full Docker image name including registry and tag
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="image-name">Display Name *</label>
                  <input
                    id="image-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="My Custom Image"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="image-description">Description</label>
                  <textarea
                    id="image-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What tools and capabilities does this image provide?"
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="image-tools">Available Tools (comma-separated)</label>
                  <input
                    id="image-tools"
                    type="text"
                    value={formData.tools}
                    onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
                    placeholder="git, node, npm, yarn"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Registering...' : 'Register Image'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
