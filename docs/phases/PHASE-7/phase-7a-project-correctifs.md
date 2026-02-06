# Phase 7A: Correctifs - Bloc Path & Convention Fixes

**Phase**: 7A
**Priority**: Critical
**Duration**: 1-2 days
**Team**: Backend
**Dependencies**: None
**Blocks**: Phase 7B, 7C, 7D, 7E
**Status**: Not Started

---

## Overview

Fix foundational issues with block storage paths and file naming conventions before introducing the Project model. This ensures a stable base for project isolation.

## Current Problems

### Problem 1: Global Blocks Path Bug
```csharp
// In Program.cs:
var blocksGlobalPath = Path.Combine(AppContext.BaseDirectory, "blocks");
```

**Issue**: `AppContext.BaseDirectory` resolves to `Maestro.Api/bin/Debug/net9.0/` during development, causing global blocks to be created in the wrong location.

**Expected**: Global blocks should be in `{repo_root}/blocks/`

### Problem 2: Inconsistent File Naming
- `FileSystemBlockDiscoveryService` searches for `block.json`
- `FileSystemBlockRepository` now uses `name.type.block.json` pattern
- This mismatch causes discovery to miss new blocks and repository to miss old ones

### Problem 3: Hardcoded `.maestro` Paths
Multiple places reference `.maestro` folder without proper configuration:
- `FileSystemBlockDiscoveryService.cs` line 96: `Path.Combine(basePath, ".maestro")`
- Tests use hardcoded paths
- No centralized path configuration

---

## Tasks

### 7A.1 Fix Global Blocks Path Resolution
- [x] Create `MaestroPathConfiguration` class in `Maestro.Infrastructure/Configuration/`
- [x] Add `GlobalBlocksPath`, `UserBlocksPath`, `ProjectBlocksPath` properties
- [x] Use configuration-based resolution instead of `AppContext.BaseDirectory`
- [x] Update `Program.cs` to use the new configuration class
- [x] Add `MAESTRO_GLOBAL_BLOCKS_PATH` environment variable support

### 7A.2 Unify Block File Naming Convention
- [x] Update `FileSystemBlockDiscoveryService.ScanAll()` to use glob pattern `*.block.json`
- [x] Update `OnFileChanged()` to detect `*.block.json` instead of `block.json`
- [x] Update `LoadBlockFromFolder()` to handle both conventions (migration support)
- [ ] Create migration utility to rename old `block.json` files to new convention
- [ ] Update `BlockFileNameHelper` to support parsing existing filenames

### 7A.3 Centralize Path Constants
- [x] Create `MaestroConstants` static class with path patterns
- [x] Define `BLOCKS_FOLDER = ".maestro/blocks"` constant
- [x] Define `CONFIG_FILE = "project.json"` constant  
- [x] Define `BLOCK_FILE_PATTERN = "*.block.json"` constant
- [ ] Update all hardcoded paths to use constants

### 7A.4 Add Path Validation and Error Handling
- [x] Add path existence validation on startup
- [x] Create directories if they don't exist (with proper permissions)
- [x] Log warnings for inaccessible paths
- [ ] Add health check endpoint for path status

### 7A.5 Update Tests
- [ ] Update `FileSystemBlockDiscoveryService` tests for new glob pattern
- [ ] Add tests for path configuration
- [ ] Add tests for backward compatibility with old naming
- [ ] Verify test fixtures use correct file naming

---

## Acceptance Criteria

1. [ ] Global blocks are created in `{repo_root}/blocks/`, not in API output folder
2. [ ] Both `block.json` (legacy) and `name.type.block.json` (new) files are discovered
3. [ ] New blocks are saved with `name.type.block.json` convention
4. [ ] Path configuration is centralized and testable
5. [ ] All existing tests pass
6. [ ] Environment variable override works for all paths

---

## Files to Create

- `backend/src/Maestro.Infrastructure/Configuration/MaestroPathConfiguration.cs`
- `backend/src/Maestro.Infrastructure/Configuration/MaestroConstants.cs`

## Files to Modify

- `backend/src/Maestro.Api/Program.cs`
- `backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockDiscoveryService.cs`
- `backend/src/Maestro.Infrastructure/BlockStore/FileSystemBlockRepository.cs`
- `backend/src/Maestro.Infrastructure/Utilities/BlockFileNameHelper.cs`

---

## Technical Notes

### Path Resolution Priority
1. Environment variable (e.g., `MAESTRO_GLOBAL_BLOCKS_PATH`)
2. Configuration file (`maestro.config.json`)
3. Default convention (`./blocks` for global, `~/.maestro/blocks` for user)

### Backward Compatibility
Must support discovering both:
- Legacy: `blocks/my-block/block.json`
- New: `blocks/my-block.tool.block.json`

The repository will always WRITE in new format, but discovery must READ both.

---

## Related Issues

- Phase 6A: Unified Block Source (predecessor)
- Phase 7B: Project Model (successor - depends on this)
