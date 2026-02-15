/**
 * Models Page
 *
 * Page for viewing and managing AI models.
 */

import { ModelsPanel } from '../components/ModelsPanel';
import './ModelsPage.scss';

export default function ModelsPage() {
  return (
    <div className="models-page page-enter">
      <ModelsPanel />
    </div>
  );
}
