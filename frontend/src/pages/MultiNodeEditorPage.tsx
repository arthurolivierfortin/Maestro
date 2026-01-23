/**
 * Multi Node Edit Page (formerly WorkflowEditorPage)
 *
 * Visual editor for multi-node workflows (renamed from WorkflowEditorPage).
 */

import { useParams } from 'react-router-dom';
import { useNavigation } from '../hooks/useNavigation';
import { BlockCanvas } from '../components/BlockCanvas';
import './MultiNodeEditorPage.scss';

export function MultiNodeEditPage() {
  const { id: workflowId } = useParams<{ id: string }>();
  const { navigateToBlock } = useNavigation();

  // Current parent ID is the workflow ID from the URL
  const currentParentId = workflowId || null;

  const handleDrillDown = (blockId: string) => {
    navigateToBlock(blockId);
  };

  return (
    <div className="workflow-editor-page">
      <BlockCanvas parentId={currentParentId} onDrillDown={handleDrillDown} />
    </div>
  );
}

export default MultiNodeEditPage;
