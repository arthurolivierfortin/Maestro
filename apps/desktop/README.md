# Frontend Development Setup

## Prerequisites

- Node.js 18+ and npm 9+
- Git

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/arthurolivierfortin/Meastro.git
   cd Meastro/frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` with your backend API URL.

4. **Start development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173)

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors automatically
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:ui` - Run tests with Vitest UI
- `npm run test:coverage` - Run tests with coverage report

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── common/          # Reusable UI components
│   │   ├── Execution/       # Execution-related components
│   │   ├── Monitoring/      # Monitoring components
│   │   └── WorkflowEditor/  # Workflow editor components
│   ├── layouts/             # Layout components
│   │   └── RootLayout.tsx   # Main app layout
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx
│   │   ├── WorkflowsPage.tsx
│   │   ├── WorkflowEditorPage.tsx
│   │   ├── ExecutionMonitorPage.tsx
│   │   ├── HistoryPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/            # API services
│   │   ├── api.ts           # Axios API client
│   │   ├── workflowService.ts  # Workflow CRUD operations
│   │   └── signalRService.ts   # Real-time monitoring
│   ├── store/               # Zustand state management
│   │   ├── workflowStore.ts
│   │   └── executionStore.ts
│   ├── types/               # TypeScript type definitions
│   │   ├── workflow.types.ts
│   │   ├── node.types.ts
│   │   ├── agent.types.ts
│   │   ├── execution.types.ts
│   │   └── index.ts
│   ├── hooks/               # Custom React hooks
│   ├── utils/               # Utility functions
│   │   └── LazyPage.tsx
│   ├── styles/              # Global styles
│   │   ├── globals.css      # Global styles and resets
│   │   └── tokens.css       # Design tokens
│   ├── router.tsx           # React Router configuration
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── .env.example             # Environment variables template
├── .env.local               # Local environment variables (gitignored)
├── .gitignore
├── .prettierrc              # Prettier configuration
├── eslint.config.js         # ESLint configuration
├── index.html               # HTML template
├── package.json
├── tsconfig.json            # TypeScript configuration
├── tsconfig.node.json       # TypeScript config for Node files
├── vite.config.ts           # Vite configuration
└── vitest.config.ts         # Vitest configuration
```

## Architecture Guidelines

### Component Structure

Follow atomic design principles:
- **Atoms**: Button, Input, LoadingSpinner (in `components/common/`)
- **Molecules**: Form groups, Cards
- **Organisms**: Navigation, WorkflowEditor, ExecutionMonitor
- **Templates**: Layouts
- **Pages**: Full page components

### State Management

Use Zustand for global state:
```typescript
import { useWorkflowStore } from '@store';

function MyComponent() {
  const { workflows, loadWorkflows } = useWorkflowStore();
  
  useEffect(() => {
    loadWorkflows();
  }, []);
  
  return <div>{/* ... */}</div>;
}
```

### API Calls

Always use services, never call APIs directly from components:
```typescript
import { workflowService } from '@services';

// In a component or store
const workflow = await workflowService.getById(id);
```

### TypeScript

- Always use strict types, never `any`
- Use `unknown` for truly unknown types
- Define interfaces for all props
- Use type aliases for unions

### Styling

- Use SCSS modules or global styles
- Follow BEM naming convention for classes
- Use design tokens from `tokens.css`
- Support light/dark themes

## Path Aliases

The following path aliases are configured:
- `@/` → `src/`
- `@components/` → `src/components/`
- `@services/` → `src/services/`
- `@types/` → `src/types/`
- `@hooks/` → `src/hooks/`
- `@store/` → `src/store/`
- `@utils/` → `src/utils/`
- `@styles/` → `src/styles/`

Usage:
```typescript
import { Button } from '@components/common';
import { workflowService } from '@services';
import type { Workflow } from '@types';
```

## Code Quality

### Linting

ESLint is configured with:
- TypeScript support
- React hooks rules
- Prettier integration

Run linting:
```bash
npm run lint
npm run lint:fix
```

### Formatting

Prettier is configured for consistent code style:
```bash
npm run format
```

### Type Checking

TypeScript strict mode is enabled:
```bash
npm run type-check
```

## Testing

### Writing Tests

Create tests next to components:
```
Button.tsx
Button.test.tsx
Button.scss
```

Example test:
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### Running Tests

```bash
npm test              # Watch mode
npm run test:run      # Run once
npm run test:ui       # Interactive UI
npm run test:coverage # With coverage
```

## Environment Variables

Create `.env.local` for local development:

```env
VITE_API_BASE_URL=https://localhost:5001
VITE_SIGNALR_HUB_URL=https://localhost:5001/hubs/execution
VITE_ENV=development
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

## Building for Production

```bash
npm run build
```

Output will be in `dist/` directory.

Preview production build:
```bash
npm run preview
```

## Troubleshooting

### Port Already in Use

Change port in `vite.config.ts`:
```typescript
server: {
  port: 5174
}
```

### Module Not Found

Check path aliases in:
- `tsconfig.json`
- `vite.config.ts`
- `vitest.config.ts`

### Type Errors

Run type checking:
```bash
npm run type-check
```

## Contributing

1. Follow the coding conventions in `.github/instructions/code-conventions.instructions.md`
2. Write tests for new components
3. Run linting and formatting before committing
4. Follow Git workflow from `.github/instructions/git-workflow.instructions.md`

## Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [React Router Documentation](https://reactrouter.com/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Vitest Documentation](https://vitest.dev/)
- [Frontend Guide](../docs/frontend-guide.md)
