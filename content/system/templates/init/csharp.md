# Project Conventions

## Stack
- **Runtime**: .NET
- **Language**: C#

## File Structure
<!-- Describe your project's directory layout -->

## Code Style
- Use file-scoped namespaces
- Use `var` when type is obvious from the right side
- Prefer async/await for I/O operations
- Follow Microsoft naming conventions (PascalCase for public, _camelCase for private fields)

## Testing
- Test framework: <!-- xUnit / NUnit / MSTest -->
- Run tests: `dotnet test`
- Test location: `*.Tests/` projects

## Build & Run
- Build: `dotnet build`
- Run: `dotnet run --project <project>`
- Publish: `dotnet publish -c Release`

## Git Conventions
- Branch naming: `feature/`, `fix/`, `chore/`
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`)

## Notes
<!-- Add project-specific conventions, rules, or context for AI agents -->
