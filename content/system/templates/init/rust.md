# Project Conventions

## Stack
- **Runtime**: Native
- **Language**: Rust

## File Structure
<!-- Describe your project's directory layout -->

## Code Style
- Follow Rust API Guidelines
- Use `clippy` for linting
- Prefer `Result<T, E>` over panics

## Testing
- Run tests: `cargo test`
- Test location: inline `#[cfg(test)]` modules and `tests/`

## Build & Run
- Build: `cargo build`
- Run: `cargo run`
- Release: `cargo build --release`
- Lint: `cargo clippy`
- Format: `cargo fmt`

## Git Conventions
- Branch naming: `feature/`, `fix/`, `chore/`
- Commit style: conventional commits (`feat:`, `fix:`, `chore:`)

## Notes
<!-- Add project-specific conventions, rules, or context for AI agents -->
