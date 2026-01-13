/**
 * Workflow Editor Page
 *
 * Visual workflow editor using block canvas.
 */

import { useParams } from 'react-router-dom';
import { useNavigation } from '../hooks/useNavigation';
import { BlockCanvas } from '../components/BlockCanvas';
import './WorkflowEditorPage.scss';

export function WorkflowEditorPage() {
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

export default WorkflowEditorPage;
