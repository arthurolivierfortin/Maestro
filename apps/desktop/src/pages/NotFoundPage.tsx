/**
 * 404 Not Found Page
 */

import { Link } from 'react-router-dom';
import { Button } from '@components/common/Button';

export function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem' }}>
      <h1 style={{ fontSize: '6rem', margin: 0 }}>404</h1>
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
      <Link to="/">
        <Button variant="primary">Go Home</Button>
      </Link>
    </div>
  );
}

export default NotFoundPage;
