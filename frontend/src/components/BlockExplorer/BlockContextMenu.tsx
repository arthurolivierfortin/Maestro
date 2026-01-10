/**
 * Block Context Menu Component
 *
 * Right-click context menu for block operations.
 */

import { useEffect, useRef } from 'react';
import { Copy, Trash2, Edit2 } from 'lucide-react';
import type { Block } from '../../types/block.types';
import './BlockContextMenu.scss';

interface BlockContextMenuProps {
  block: Block;
  position: { x: number; y: number };
  onClose: () => void;
  onRename: (block: Block) => void;
  onDuplicate: (block: Block) => void;
  onDelete: (block: Block) => void;
}

export function BlockContextMenu({
  block,
  position,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="block-context-menu"
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
      role="menu"
    >
      <button
        className="block-context-menu__item"
        onClick={() => handleAction(() => onRename(block))}
        role="menuitem"
      >
        <Edit2 size={14} />
        <span>Rename</span>
      </button>

      <button
        className="block-context-menu__item"
        onClick={() => handleAction(() => onDuplicate(block))}
        role="menuitem"
      >
        <Copy size={14} />
        <span>Duplicate</span>
      </button>

      <div className="block-context-menu__separator" role="separator" />

      <button
        className="block-context-menu__item block-context-menu__item--danger"
        onClick={() => handleAction(() => onDelete(block))}
        role="menuitem"
      >
        <Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>
  );
}
