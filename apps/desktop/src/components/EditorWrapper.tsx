/**
 * Editor Wrapper Component
 *
 * Wraps the appropriate editor for a given block type.
 */

import { getEditorForBlockType } from './BlockEditors';
import type { Block } from '../types/block.types';

interface EditorWrapperProps {
  block: Block;
}

export function EditorWrapper({ block }: EditorWrapperProps) {
  const EditorComponent = getEditorForBlockType(block.blockType);

  if (!EditorComponent) {
    return <div>No editor available for block type: {block.blockType}</div>;
  }

  return <EditorComponent block={block} />;
}
