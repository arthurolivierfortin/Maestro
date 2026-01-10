/**
 * Workflow Editor Page
 *
 * Visual workflow editor using block canvas.
 */

import { useNavigationStore } from '../store/navigationStore';
import { BlockCanvas } from '../components/BlockCanvas';
import './WorkflowEditorPage.scss';

export function WorkflowEditorPage() {
  const { currentPath, navigateInto } = useNavigationStore();

  // Get current parent ID (last item in path, or null for root)
  const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1] : null;

  const handleDrillDown = (blockId: string) => {
    navigateInto(blockId);
  };

  return (
    <div className="workflow-editor-page">
      <BlockCanvas parentId={currentParentId} onDrillDown={handleDrillDown} />
    </div>
  );
}

export default WorkflowEditorPage;
