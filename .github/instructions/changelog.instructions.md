---
description: "Instructions for CHANGELOG.md modifications across all packages"
applyTo: "**/CHANGELOG.md"
---

# CHANGELOG Modification Guidelines

## Parameters Available for Prompts

- **updateVersions**: When specified as true, increment versions according to versioning strategy

## Update Behavior

### When updateVersions = false (default)
- **Add changes to the LATEST VERSION section** (not [Unreleased])
- Find the most recent version entry (e.g., [1.2.0] - 2024-07-15)
- Add new changes to the appropriate subsections (Added, Changed, Fixed, etc.) of that version
- Do not create new version entries
- Do not increment version numbers

### When updateVersions = true
- **Create new version entry** with incremented version number
- Move changes from [Unreleased] to the new version section (if any)
- Follow version synchronization rules across package groups
- Update all related packages to maintain version consistency

## Versioning Strategy

Follow semantic versioning: `Major.Minor.Patch`

- **Major (X.0.0):** Breaking changes
- **Minor (0.X.0):** New features, no breaking changes  
- **Patch (0.0.X):** Bug fixes and hot fixes

## Version Synchronization Rules

**When `updateVersions` parameter is true:**

1. **AppCore packages:** All AppCore.X packages must maintain the same version
2. **AzureClients packages:** All AzureClients.X packages must maintain the same version
3. **Meta-packages:** Version independently but reference correct constituent package versions

### Synchronization Process
1. If any package in a group (AppCore or AzureClients) is modified, increment version for ALL packages in that group
2. For packages without changes, add changelog entry: "No functional changes - version synchronization with package group"
3. Update meta-package versions to reference new constituent package versions

### Example Synchronization Scenario
- If `AppCore.Data` changes from 1.2.3 → 1.3.0
- Then `AppCore.Core`, `AppCore.Application`, `AppCore.Shared`, `AppCore.Web`, `AppCore.Tools.Data` also become 1.3.0
- `AppCore.Package` updates to reference all AppCore packages at 1.3.0
- `AppCore.AzureImplementation` updates to reference AppCore.Package at new version

## CHANGELOG Structure

### Standard Format
```markdown
# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [X.Y.Z] - YYYY-MM-DD
### Added
- New features and functionality

### Changed
- Changes in existing functionality
- Improvements and enhancements

### Fixed
- Bug fixes and corrections

### Removed
- Removed features or functionality

### Deprecated
- Features marked for future removal

### Security
- Security-related changes

### Breaking Changes
- List of breaking changes with migration guidance
```

## Practical Examples

### Example: updateVersions = false
**Before:**
```markdown
## [Unreleased]

## [1.2.0] - 2024-01-15
### Added
- Previous feature
```

**After adding new changes to LATEST VERSION:**
```markdown
## [Unreleased]

## [1.2.0] - 2024-01-15
### Added
- Previous feature
- New translation service integration

### Fixed
- Memory leak in connection pooling
```

### Example: updateVersions = true
**Before:**
```markdown
## [Unreleased]
### Added
- New translation service integration
### Fixed
- Memory leak in connection pooling

## [1.2.0] - 2024-01-15
### Added
- Previous feature
```

**After version increment:**
```markdown
## [Unreleased]

## [1.3.0] - 2024-08-07
### Added
- New translation service integration
### Fixed
- Memory leak in connection pooling

## [1.2.0] - 2024-01-15
### Added
- Previous feature
```

### Security
- Security-related changes

### Breaking Changes
- List of breaking changes with migration guidance
```

## Entry Categories

### Added
- New features
- New APIs or methods
- New configuration options
- New dependencies

### Changed
- Modifications to existing functionality
- Performance improvements
- Updated dependencies
- API signature changes (non-breaking)

### Fixed
- Bug fixes
- Crash fixes
- Memory leak fixes
- Validation improvements

### Removed
- Removed features
- Removed APIs
- Removed dependencies
- Removed configuration options

### Deprecated
- Features marked for future removal
- APIs that will be removed in next major version
- Include timeline for removal

### Security
- Security vulnerability fixes
- Security enhancements
- Updated security dependencies

### Breaking Changes
- API changes that break backward compatibility
- Removed functionality
- Changed behavior that affects existing implementations
- Migration instructions required

## Writing Guidelines

### Entry Format
```markdown
- Brief description of the change [#IssueNumber](link-to-issue) by [@contributor](link-to-profile)
```

### Description Guidelines
- **Concise**: Keep descriptions brief but informative
- **User-focused**: Write from the user's perspective
- **Actionable**: Include what users need to do (if anything)
- **Technical**: Include technical details when relevant

### Examples
```markdown
### Added
- Add support for Azure Cosmos DB connection pooling [#123](link) by [@developer](link)
- New `TranslateAsync` method with cancellation token support
- Configuration option for custom retry policies

### Changed
- Improve performance of data retrieval operations by 40%
- Update Azure SDK dependencies to latest stable versions
- Standardize error handling across all services

### Fixed
- Fix memory leak in connection pooling mechanism [#456](link)
- Correct validation logic for translation language codes
- Resolve race condition in concurrent data access

### Breaking Changes
- `ITranslationService.Translate()` method signature changed to include `CancellationToken`
  - **Migration**: Add `CancellationToken.None` as the last parameter to existing calls
- Removed deprecated `LegacyDataAccess` class
  - **Migration**: Use `ModernDataAccess` instead
```

## Version Synchronization Entries

### For Packages Without Changes
```markdown
## [X.Y.Z] - YYYY-MM-DD
### Changed
- No functional changes - version synchronization with AppCore package group
- Updated to maintain version consistency across related packages
```

### For Meta-Packages
```markdown
## [X.Y.Z] - YYYY-MM-DD
### Changed
- Updated AppCore.Data dependency to version X.Y.Z
- Updated AppCore.Application dependency to version X.Y.Z

### Dependencies
- AppCore.Core: X.Y.Z
- AppCore.Data: X.Y.Z
- AppCore.Application: X.Y.Z
```

## Update Workflow

### Individual Package Changes
1. **Determine version increment** based on change type
2. **Add entry under appropriate version**
3. **Categorize changes** using standard categories
4. **Include breaking change details** if applicable
5. **Add migration guidance** for breaking changes

### Group Synchronization (when updateVersions = true)
1. **Identify the highest version increment** needed in the group
2. **Apply same version increment** to all packages in group
3. **Add synchronization entries** for unchanged packages
4. **Update meta-package dependencies**

### Meta-Package Updates
1. **Document constituent package version changes**
2. **Summarize major changes** from sub-packages
3. **Note any breaking changes** propagated from sub-packages
4. **Update dependency table**

## Quality Assurance

### Before Publishing
- [ ] All version numbers are consistent within package groups
- [ ] Breaking changes include migration guidance
- [ ] Entries are properly categorized
- [ ] Dates are in correct format (YYYY-MM-DD)
- [ ] Links to issues/PRs are functional
- [ ] Grammar and spelling are correct

### Validation Rules
- **Semantic Versioning**: Version increments match change types
- **Consistency**: Related packages have synchronized versions
- **Completeness**: All significant changes are documented
- **Clarity**: Entries are understandable to end users

## Final Validation Checklist

After completing all CHANGELOG updates, validate each file against these requirements:

### Structure Validation
- [ ] **updateVersions = false**: Changes added to LATEST VERSION (not [Unreleased])
- [ ] **updateVersions = true**: New version entry created with proper increment
- [ ] Proper section headers (Added, Changed, Fixed, Removed, etc.)
- [ ] Consistent date format (YYYY-MM-DD)

### Content Validation
- [ ] All changes properly categorized in appropriate sections
- [ ] Breaking changes clearly documented with migration guidance
- [ ] Version numbers follow semantic versioning rules
- [ ] Entry descriptions are clear and user-focused

### Synchronization Validation (when updateVersions = true)
- [ ] All packages in same group have matching version numbers
- [ ] Unchanged packages have synchronization entries
- [ ] Meta-package dependency versions are updated correctly

### Cross-Package Consistency
- [ ] Version increments are consistent within package groups
- [ ] Breaking changes propagate to meta-packages appropriately
- [ ] All affected packages have corresponding CHANGELOG entries
