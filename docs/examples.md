# Maestro — Examples

Three concrete task walkthroughs showing how Maestro works in practice.

---

## Example 1: Add ESLint and Prettier to a Node.js project

**Scenario**: You have a Node.js project without linting. You want ESLint + Prettier with a standard config.

### Launch

```bash
maestro code --repo /path/to/my-node-project
```

### Conversation

```
You:    Set up ESLint and Prettier with the Airbnb config.
        Add lint and format scripts to package.json.

Agent:  I'll set up ESLint and Prettier for your project. Here's the plan:

        1. Install dependencies: eslint, prettier, eslint-config-airbnb-base,
           eslint-plugin-import, eslint-config-prettier
        2. Create .eslintrc.json extending airbnb-base + prettier
        3. Create .prettierrc with standard settings (semi, singleQuote, 80 cols)
        4. Add scripts to package.json: "lint", "lint:fix", "format"
        5. Run lint to verify the setup works

        Sound good?

You:    yes

Agent:  [Working...]
        ✓ shell-execute: npm install --save-dev eslint prettier ...
        ✓ file-write: .eslintrc.json
        ✓ file-write: .prettierrc
        ✓ file-edit: package.json (added scripts)
        ✓ shell-execute: npm run lint

        Done! ESLint + Prettier configured with Airbnb rules.
        - .eslintrc.json: extends airbnb-base + prettier
        - .prettierrc: semi, singleQuote, printWidth 80
        - package.json: added lint, lint:fix, format scripts
        - Lint ran successfully with 3 warnings (unused imports in src/utils.js)
```

### What happened

The agent:
1. Read your package.json to understand the project
2. Proposed a plan and waited for confirmation
3. Installed npm packages via shell
4. Created config files
5. Modified package.json (added scripts only, didn't touch existing content)
6. Ran the linter to verify everything works
7. Reported the result including any warnings found

---

## Example 2: Fix TypeScript compilation errors

**Scenario**: You upgraded TypeScript and now have 12 compilation errors across multiple files.

### Launch

```bash
maestro code --repo /path/to/my-ts-project
```

### Conversation

```
You:    Fix all TypeScript compilation errors. Run tsc --noEmit first
        to see them, then fix each one.

Agent:  I'll fix the TypeScript errors. Let me start by running the
        compiler to see what we're dealing with.

        Plan:
        1. Run tsc --noEmit to get the full error list
        2. Fix each error, grouping by file
        3. Re-run tsc --noEmit to verify zero errors

        Proceeding?

You:    go

Agent:  [Working...]
        ✓ shell-execute: npx tsc --noEmit
          Found 12 errors in 5 files:
          - src/api/routes.ts(14,3): Type 'string' not assignable to 'number'
          - src/api/routes.ts(28,7): Property 'status' missing
          - src/models/User.ts(5,1): ... (10 more)

        ✓ file-edit: src/api/routes.ts — fixed type annotation (line 14)
        ✓ file-edit: src/api/routes.ts — added missing status property (line 28)
        ✓ file-edit: src/models/User.ts — updated interface to match new TS strict rules
        ✓ file-edit: src/services/AuthService.ts — added null checks
        ✓ file-edit: src/utils/helpers.ts — fixed generic constraint
        ✓ file-edit: src/index.ts — updated import type syntax
        ✓ shell-execute: npx tsc --noEmit (exit code 0)

        Done! Fixed all 12 TypeScript errors across 5 files:
        - routes.ts: 2 type annotation fixes
        - User.ts: 4 interface updates for strict mode
        - AuthService.ts: 3 null safety additions
        - helpers.ts: 2 generic constraint fixes
        - index.ts: 1 import type fix
        Compilation passes with zero errors.
```

### What happened

The agent:
1. Ran the TypeScript compiler to get the exact error list
2. Fixed each error systematically, file by file
3. Re-ran the compiler to verify zero errors remain
4. Reported a summary of all changes made

---

## Example 3: Generate API documentation

**Scenario**: You have an Express API with 15 endpoints but no documentation.

### Launch

```bash
maestro code --repo /path/to/my-api
```

### Conversation

```
You:    Generate API documentation in docs/API.md.
        Cover all endpoints in src/routes/ with method, path,
        description, request body, and response format.

Agent:  I'll generate API documentation for your Express routes.
        Let me first scan the route files to understand the API.

        Plan:
        1. Read all files in src/routes/
        2. Extract endpoint definitions (method, path, middleware, handler)
        3. Analyze request/response types from the handler code
        4. Generate docs/API.md in a clean format
        5. Commit the documentation

        Ready to start?

You:    yes

Agent:  [Working...]
        ✓ directory-list: src/routes/ (6 files found)
        ✓ file-read: src/routes/auth.ts (3 endpoints)
        ✓ file-read: src/routes/users.ts (5 endpoints)
        ✓ file-read: src/routes/posts.ts (4 endpoints)
        ✓ file-read: src/routes/comments.ts (3 endpoints)
        ✓ file-read: src/models/ (type definitions)
        ✓ file-write: docs/API.md (285 lines)

        Done! Created docs/API.md with documentation for 15 endpoints:

        Auth (3): POST /auth/login, POST /auth/register, POST /auth/refresh
        Users (5): GET /users, GET /users/:id, PUT /users/:id, DELETE /users/:id, GET /users/:id/posts
        Posts (4): GET /posts, POST /posts, PUT /posts/:id, DELETE /posts/:id
        Comments (3): GET /posts/:id/comments, POST /posts/:id/comments, DELETE /comments/:id

        Each endpoint includes: method, path, description, auth requirements,
        request body schema, response format with example.
```

### What happened

The agent:
1. Listed the route files to understand the API structure
2. Read each route file to extract endpoint definitions
3. Read the model definitions to understand request/response types
4. Generated comprehensive documentation in Markdown
5. Organized by resource (auth, users, posts, comments)

---

## Tips

- **Be specific**: "Add unit tests for UserService.createUser()" works better than "add tests"
- **Give context**: "Fix the bug where login fails with special characters in the password" is better than "fix login"
- **Confirm or adjust**: When the agent proposes a plan, you can say "yes" or modify: "Yes but skip step 3" or "Use Jest instead of Vitest"
- **Use /stop if stuck**: If the agent is taking too long or going in the wrong direction, type `/stop` and restate your task
- **Check the result**: After the agent finishes, review the changes in your git diff before pushing
