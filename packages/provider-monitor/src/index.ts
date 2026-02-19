import { main } from './cli.js';

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
