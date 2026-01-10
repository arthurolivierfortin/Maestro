---
description: "Instructions for README.md modifications across all packages"
applyTo: "**/README.md"
---

# README Modification Guidelines

## Parameters Available for Prompts

- **updateVersions**: When specified as true, increment versions according to versioning strategy

## Package Architecture Overview

The project follows a hierarchical package structure:

### AppCore Packages
- **AppCore.Core** - Core entities and interfaces
- **AppCore.Data** - Data access layer
- **AppCore.Application** - Application services and use cases
- **AppCore.Shared** - Shared utilities and interfaces
- **AppCore.Web** - Web components and controllers
- **AppCore.Tools.Data** - Data tooling utilities
- **AppCore.Package** - Meta-package for all AppCore packages

### AzureClients Packages
- **AzureClients.ActiveDirectory** - Azure AD integration
- **AzureClients.CosmosDB** - Cosmos DB client
- **AzureClients.KeyVault** - Key Vault client
- **AzureClients.PostgreSQL** - PostgreSQL client
- **AzureClients.Shared** - Shared Azure utilities
- **AzureClients.StorageAccount** - Storage Account client
- **AzureClients.Translator** - Translation services
- **AzureClients.Package** - Meta-package for all AzureClients packages

### Meta-Package
- **AppCore.AzureImplementation** - Ultimate meta-package combining AppCore.Package and AzureClients.Package

## README Update Rules

### 1. Individual Package README Updates
When an individual AppCore.X or AzureClients.X package is modified:

**Update the package's README.md:**
- Follow standard README structure (Purpose, Installation, Usage, API Documentation)
- Document new features, breaking changes, or improvements
- Include code examples for new functionality
- Maintain professional tone and clear explanations
- Use consistent formatting and structure throughout the document

**What's New Section Management:**
- **Always maintain a "What's New" section** that reflects the latest version from CHANGELOG.md
- **When updateVersions = false:** Update "What's New" with current unreleased changes
- **When updateVersions = true (version increment):**
  1. **Integrate previous "What's New" content** into appropriate README sections
  2. **Write content as established features** (not "now supports" but "supports")
  3. **Replace "What's New" with current version changes** from CHANGELOG
  4. **Ensure seamless integration** - new features should read as if they were always part of the project

### 2. Meta-Package README Updates
When any package within a meta-package is modified:

1. **For AppCore.Package:** Update when any AppCore.X package changes
2. **For AzureClients.Package:** Update when any AzureClients.X package changes
3. **For AppCore.AzureImplementation:** Update when either AppCore.Package or AzureClients.Package changes

**Meta-package README updates should include:**
- Summary of changes in constituent packages
- Updated dependency versions
- New capabilities or breaking changes propagated from sub-packages

**Content Strategy for Meta-Packages:**
- **High-level overview** of capabilities rather than detailed feature lists
- **Reference child package READMEs** for detailed documentation
- **Focus on integration** and how packages work together
- **Avoid duplication** - if a feature is well-documented in a child package README, reference it instead of re-explaining

## README Structure Templates

### Individual Packages
```markdown
# Package Name
Brief description of package purpose

## Version
Current: X.Y.Z (YYYY-MM-DD)

## What's New
Latest features and improvements from the current version:
- Feature or improvement from latest CHANGELOG version
- Another notable change or enhancement

## Installation
```bash
dotnet add package PackageName
```

## Features
- List of key features
- Capabilities provided

## Usage
### Basic Usage
```csharp
// Code examples and basic usage patterns
```

### Advanced Usage
```csharp
// More complex examples
```

## API Documentation
### Key Classes
- `ClassName` - Description
- `InterfaceName` - Description

### Key Methods
- `MethodName()` - Description and usage

## Configuration
Configuration options and setup instructions

## Dependencies
List of package dependencies

## Version History
See [CHANGELOG.md](CHANGELOG.md) for version history.
```

### Meta-Packages
```markdown
# Meta-Package Name (without .Package suffix)
Description of meta-package purpose and included packages

**IMPORTANT:** For meta-package names in titles and headers, use only the base name without the .Package suffix:
- Use "AppCore" instead of "AppCore.Package"
- Use "AzureClients" instead of "AzureClients.Package"
- Use "AppCore.AzureImplementation" (keep full name for ultimate meta-package)

## Version
Current: X.Y.Z (YYYY-MM-DD)

## What's New
Latest updates across all included packages:
- Key feature from Package A
- Important improvement in Package B
- Notable enhancement in Package C

## Included Packages
| Package | Version | Description |
|---------|---------|-------------|
| PackageName1 | x.y.z | Package description |
| PackageName2 | x.y.z | Package description |

## Installation
```bash
dotnet add package MetaPackageName
```

## Features
High-level overview of capabilities:
- **Data Management** - See [AppCore.Data](../AppCore.Data/README.md) for detailed data access features
- **Application Services** - See [AppCore.Application](../AppCore.Application/README.md) for business logic capabilities
- **Web Components** - See [AppCore.Web](../AppCore.Web/README.md) for web-specific features

*For detailed feature documentation, please refer to individual package README files.*

## Getting Started
### Quick Start
```csharp
// Quick start guide using multiple package features
```

### Configuration
```csharp
// Configuration examples
```

## Package Dependencies
Visual representation or description of dependency relationships

## Documentation Links
- [Package1 Documentation](../Package1/README.md)
- [Package2 Documentation](../Package2/README.md)

## Version History
See [CHANGELOG.md](CHANGELOG.md) for version history.
```

## Quality Guidelines

### Content Requirements
- **Professional Tone**: Use formal and professional language
- **Clarity**: Ensure explanations are clear and concise
- **Completeness**: Cover all essential aspects of the package
- **Examples**: Include practical, working code examples
- **Consistency**: Maintain consistent formatting across all READMEs

### Content Strategy by Package Type

#### Individual Packages
- **Detailed documentation** of all features and capabilities
- **Comprehensive examples** for all major use cases
- **Complete API documentation**

#### Meta-Packages
- **High-level overview** focusing on integration and package relationships
- **Reference child READMEs** for detailed feature documentation
- **Avoid duplication** - don't re-explain what's well-documented in child packages
- **Focus on quick start** and how packages work together
- **Summarize key capabilities** with links to detailed documentation

### Technical Requirements
- **Code Examples**: All examples must be functional and tested
- **Version References**: Ensure all version numbers are current and consistent
- **Links**: Verify all internal and external links work correctly
- **Formatting**: Use proper Markdown formatting throughout

### Update Workflow
1. **Identify changes** in the package
2. **Update relevant sections** of README
3. **Add or update code examples** for new features
4. **Verify all links and references**
5. **Ensure consistency** with package group standards
6. **Cascade updates** to meta-packages if necessary
7. **Final validation** - Review changes against these instructions

## Final Validation Checklist

After completing all README updates, validate each file against these requirements:

### Structure Validation
- [ ] **Title** (# Package Name) is first
- [ ] **Version section** comes immediately after title and description
- [ ] **What's New section** comes after Version section
- [ ] All sections follow the specified order from templates

### Content Validation
- [ ] Version information is accurate and consistent with CHANGELOG.md latest version
- [ ] **Version synchronization check**: README version number must match the latest version in CHANGELOG.md
- [ ] "What's New" reflects latest CHANGELOG version entries
- [ ] Code examples are functional and up-to-date
- [ ] Links to other packages and files are working
- [ ] Professional tone maintained throughout

### Meta-Package Specific
- [ ] High-level overview without duplicating child package details
- [ ] References to child package READMEs instead of re-explaining features
- [ ] Included packages table is accurate with correct versions

### Cross-Package Consistency
- [ ] Related packages reference each other correctly
- [ ] Version numbers are consistent within package groups
- [ ] Templates and formatting are consistent across similar packages

## What's New Section Management Examples

### Example: updateVersions = false
**Scenario:** Adding unreleased changes to What's New

**Before:**
```markdown
## What's New
- Enhanced error handling in data operations
- Improved performance for bulk operations
```

**After adding new unreleased features:**
```markdown
## What's New
- New translation service with Azure Cognitive Services integration
- Added support for custom retry policies
- Enhanced error handling in data operations
- Improved performance for bulk operations
```

### Example: updateVersions = true (Version Increment)
**Scenario:** Version changes from 1.2.0 → 1.3.0

**Before version increment:**
```markdown
## What's New
- New translation service with Azure Cognitive Services integration
- Added support for custom retry policies

## Features
- Data access layer with Entity Framework
- Caching mechanisms
```

**After version increment:**
```markdown
## What's New
- Enhanced connection pooling for better performance
- New monitoring and logging capabilities

## Features
- Data access layer with Entity Framework
- Translation service with Azure Cognitive Services integration
- Custom retry policies support
- Caching mechanisms
```

### Integration Guidelines

**When integrating previous "What's New" content:**

❌ **Avoid temporal language:**
- "Now supports translation services"
- "Recently added retry policies"
- "New in version 1.3.0"

✅ **Use established feature language:**
- "Supports translation services"
- "Includes retry policies"
- "Provides translation capabilities"

**Content placement by category:**
- **New APIs/Classes** → API Documentation section
- **New Features** → Features section with examples
- **New Configuration** → Configuration section
- **Performance improvements** → Integrate into relevant usage examples
- **Breaking changes** → Update examples and note in Version History reference
