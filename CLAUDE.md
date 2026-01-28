# Claude Code Guidelines for Maestro

This document establishes development practices and testing requirements for the Maestro project.

## Testing Requirements

### Before Making Changes

1. **Run tests before starting work**
   - Frontend: `cd frontend && npm test -- --run`
   - Backend: `cd backend && dotnet test`

2. **Understand test baseline**
   - Note the number of passing/failing tests
   - Do not introduce new test failures
   - Known pre-existing failures (ReactFlow mock issues in canvas tests) are acceptable

### After Making Changes

1. **Run tests after every significant change**
   - All tests that passed before must still pass
   - New features should include tests where practical

2. **Verify the frontend build**
   - `cd frontend && npm run build`

3. **Verify the backend build**
   - `cd backend && dotnet build`
   - If processes lock DLLs: `taskkill /F /IM Maestro.Api.exe`

## Architecture Guidelines

### Frontend (React + TypeScript)

- **Block types are defined in** `frontend/src/registry/blockTypeDefinitions.ts`
- **Block type registry** at `frontend/src/registry/BlockTypeRegistry.ts` defines containment rules
- **Block type interface** at `frontend/src/types/block.types.ts` defines the `Block` interface
- **isAtomic property** determines if a block can contain children:
  - Atomic blocks (`isAtomic: true`): `prompt`, `instruction`, `tool`, `decision`, `validator`, `trigger`, `inference`, `script`
  - Composite blocks (`isAtomic: false`): `workflow`, `agent`, `task`

### Backend (C# .NET)

- **BlockDto** at `backend/src/Maestro.Application/DTOs/BlockDto.cs` must include all properties from `BlockDefinition`
- **BlockDefinition** at `backend/src/Maestro.Domain/Entities/BlockDefinition.cs` is the domain entity
- **isAtomic property** MUST be included in API responses - missing this causes UI bugs

### API Contract

When adding properties to domain entities:
1. Add the property to the domain entity
2. Add the property to the DTO
3. Update `FromDomain` method to map the property
4. Update file loaders to read the property from JSON

## Common Pitfalls

### All blocks showing as "composite"
**Cause**: `isAtomic` property missing from `BlockDto`
**Fix**: Ensure `BlockDto.FromDomain` includes `IsAtomic = block.IsAtomic`

### Tests expecting wrong type count
**Cause**: New block types added without updating tests
**Fix**: Check `blockTypeDefinitions.ts` for current count and update test expectations

### Test mocks not matching import paths
**Cause**: `vi.mock()` path doesn't match the import path
**Example**: Import is `../store/blockStore` but mock is `../../store/blockStore`
**Fix**: Mock path must exactly match the relative import path

### Backend build fails with "file is locked"
**Cause**: Maestro.Api process is running
**Fix**: `taskkill /F /IM Maestro.Api.exe` before building

## Test Coverage Areas

### Critical Areas (must be tested)

1. **BlockTypeRegistry**
   - Type containment rules (`canContain`)
   - Block creation (`getDefaultBlock`)
   - Config validation (`validateConfig`)

2. **Block Store**
   - Add/remove/update blocks
   - Parent-child relationships
   - History (undo/redo)

3. **Navigation**
   - Route synchronization
   - Block selection
   - Breadcrumb generation

### Known Test Infrastructure Issues

The following tests have pre-existing mock issues and may fail:
- `BlockCanvas.test.tsx` - ReactFlowProvider mock
- `BlockEditPage.test.tsx` - ReactFlowProvider mock
- `AtomicBlockEditorPage.test.tsx` - Store mock issues
- `Breadcrumb.test.tsx` - Store mock issues

These should be fixed but are not blocking.

## Commit Guidelines

1. Run all tests before committing
2. Note any intentional test changes in commit message
3. Do not commit if new tests are failing (unless they're pre-existing failures)
