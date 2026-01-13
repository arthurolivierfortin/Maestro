/**
 * Node Context Menu Component
 *
 * Dropdown menu for node actions (Edit, Duplicate, Delete, Drill Into)
 */

import { useEffect, useRef } from 'react';
import { Edit, Copy, Trash2, ArrowRight } from 'lucide-react';
import type { Block } from '../../types/block.types';
import './NodeContextMenu.scss';

export interface NodeContextMenuProps {
  block: Block;
  position?: { x: number; y: number };
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDrillInto?: () => void;
  onClose: () => void;
}

export function NodeContextMenu({
  block,
  position,
  onEdit,
  onDuplicate,
  onDelete,
  onDrillInto,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const canDrillInto = !block.isAtomic && block.children && block.children.length > 0;

  return (
    <div
      ref={menuRef}
      className="node-context-menu"
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <button
        className="node-context-menu__item"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <Edit size={16} />
        <span>Edit</span>
        <span className="node-context-menu__shortcut">Enter</span>
      </button>

      <button
        className="node-context-menu__item"
        onClick={() => {
          onDuplicate();
          onClose();
        }}
      >
        <Copy size={16} />
        <span>Duplicate</span>
        <span className="node-context-menu__shortcut">Ctrl+D</span>
      </button>

      {canDrillInto && onDrillInto && (
        <button
          className="node-context-menu__item"
          onClick={() => {
            onDrillInto();
            onClose();
          }}
        >
          <ArrowRight size={16} />
          <span>Drill Into</span>
          <span className="node-context-menu__shortcut">Dbl-Click</span>
        </button>
      )}

      <div className="node-context-menu__separator" />

      <button
        className="node-context-menu__item node-context-menu__item--danger"
        onClick={() => {
          if (confirm(`Delete "${block.name}"?`)) {
            onDelete();
            onClose();
          }
        }}
      >
        <Trash2 size={16} />
        <span>Delete</span>
        <span className="node-context-menu__shortcut">Del</span>
      </button>
    </div>
  );
}
