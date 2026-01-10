---
description: "Master instructions for README.md and CHANGELOG.md modifications across all packages"
applyTo: "**/README.md, **/CHANGELOG.md"
---

# Package Documentation Update Guidelines

## Parameters Available for Prompts

- **updateVersions**: When specified as true, increment versions according to versioning strategy

## Instruction Files

This master instruction file coordinates the use of specialized instruction files:

### README Instructions
- **File**: `readme.instructions.md`
- **Purpose**: Detailed guidelines for README.md modifications
- **Covers**: Package architecture, content structure, templates, quality guidelines

### CHANGELOG Instructions  
- **File**: `changelog.instructions.md`
- **Purpose**: Detailed guidelines for CHANGELOG.md modifications
- **Covers**: Versioning strategy, entry categories, synchronization rules, quality assurance

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

## Documentation Update Workflow

### 1. Analyze Changes
- Identify which packages have been modified
- Determine the scope and type of changes
- Assess version increment requirements (if updateVersions = true)

### 2. Bottom-Up Update Process

**IMPORTANT: Always update in this specific order to ensure each level builds on accurate information from the level below.**

#### Step 1: Individual Package Updates (Leaf Nodes)
For each modified AppCore.X or AzureClients.X package:

1. **Update CHANGELOG.md first** (per changelog.instructions.md)
   - Add entries for the changes made
   - Follow versioning strategy if updateVersions = true
   
2. **Update .csproj version** (when updateVersions = true)
   - Update the `<Version>` element in .csproj to match CHANGELOG.md latest version
   - Ensure version consistency between CHANGELOG and project file
   
3. **Update README.md third** (per readme.instructions.md)
   - Base "What's New" section on the latest CHANGELOG version
   - Integrate previous "What's New" content if versions were incremented
   - Update examples and documentation for new features

#### Step 2: Group Meta-Package Updates (Middle Tier)
After ALL individual packages in a group are updated:

1. **Update AppCore.Package** (if any AppCore.X package was modified)
   - Update CHANGELOG.md to reflect constituent package changes
   - Update .csproj version (when updateVersions = true) to match CHANGELOG.md latest version
   - **Update PackageReference versions** in .csproj to reference latest versions of constituent packages
   - Update README.md with high-level overview referencing updated child READMEs
   
2. **Update AzureClients.Package** (if any AzureClients.X package was modified)
   - Update CHANGELOG.md to reflect constituent package changes
   - Update .csproj version (when updateVersions = true) to match CHANGELOG.md latest version
   - **Update PackageReference versions** in .csproj to reference latest versions of constituent packages
   - Update README.md with high-level overview referencing updated child READMEs

#### Step 3: Ultimate Meta-Package Update (Top Tier)
Finally, if either group meta-package was updated:

1. **Update AppCore.AzureImplementation**
   - Update CHANGELOG.md to reflect changes in AppCore.Package and/or AzureClients.Package
   - Update .csproj version (when updateVersions = true) to match CHANGELOG.md latest version
   - **Update PackageReference versions** in .csproj to reference latest versions of AppCore.Package and AzureClients.Package
   - Update README.md with consolidated overview referencing updated group meta-packages

### 3. Detailed Update Rules

**Apply these rules following the bottom-up order specified above:**

#### CHANGELOG Updates (Always First)
**Follow `changelog.instructions.md` for:**
- Version increment strategy
- Entry categorization and formatting
- Package synchronization rules
- Breaking change documentation

#### README Updates (Always Second, Based on Updated CHANGELOG)
**Follow `readme.instructions.md` for:**
- Individual package README updates
- Meta-package README updates that reference updated child documentation
- "What's New" section based on latest CHANGELOG entries
- Content structure and quality guidelines
- Code examples and documentation standards

### 4. Dependency Chain Examples

#### Example 1: AppCore.Data modification
1. **AppCore.Data/CHANGELOG.md** → Add data access improvements
2. **AppCore.Data/README.md** → Update "What's New" based on CHANGELOG
3. **AppCore.Package/CHANGELOG.md** → Reference AppCore.Data changes
4. **AppCore.Package/README.md** → Update overview with link to AppCore.Data README
5. **AppCore.AzureImplementation/CHANGELOG.md** → Reference AppCore.Package changes
6. **AppCore.AzureImplementation/README.md** → Update with consolidated overview

#### Example 2: Multiple package modification (AppCore.Data + AzureClients.Translator)
1. **Individual packages first:**
   - AppCore.Data/CHANGELOG.md → AppCore.Data/README.md
   - AzureClients.Translator/CHANGELOG.md → AzureClients.Translator/README.md
2. **Group meta-packages second:**
   - AppCore.Package/CHANGELOG.md → AppCore.Package/README.md
   - AzureClients.Package/CHANGELOG.md → AzureClients.Package/README.md
3. **Ultimate meta-package last:**
   - AppCore.AzureImplementation/CHANGELOG.md → AppCore.AzureImplementation/README.md

### 5. Version Synchronization (when updateVersions = true)

#### Synchronization Rules
- **AppCore packages**: All AppCore.X packages must maintain the same version
- **AzureClients packages**: All AzureClients.X packages must maintain the same version
- **Meta-packages**: Version independently but reference correct constituent package versions

#### .csproj Version Synchronization Rules
**CRITICAL: When updateVersions = true, .csproj files must be updated to maintain consistency:**

1. **Individual Package .csproj Updates:**
   - Update `<Version>` element to match latest CHANGELOG.md version
   - Must occur after CHANGELOG update, before README update

2. **Meta-Package .csproj Updates:**
   - Update `<Version>` element to match latest CHANGELOG.md version
   - **Update ALL PackageReference versions** to reference latest constituent package versions
   - Example: If AppCore.Data updates to 1.3.0, AppCore.Package must reference AppCore.Data version 1.3.0

3. **Ultimate Meta-Package .csproj Updates:**
   - Update `<Version>` element to match latest CHANGELOG.md version
   - Update PackageReference versions for AppCore.Package and AzureClients.Package

#### Version Consistency Validation
**Before completing any updateVersions = true operation:**
- [ ] All .csproj `<Version>` elements match their respective CHANGELOG.md latest versions
- [ ] All PackageReference versions in meta-packages reference latest constituent versions
- [ ] Package group versions are synchronized (all AppCore.X have same version, all AzureClients.X have same version)

#### Synchronization Process
1. Determine highest version increment needed in affected package group
2. Apply same version increment to ALL packages in that group
3. Add synchronization entries in CHANGELOG for unchanged packages
4. Update meta-package dependency references

### 6. Quality Assurance Checklist

#### README Validation
- [ ] Professional tone and clear explanations
- [ ] Functional code examples
- [ ] Consistent formatting across related packages
- [ ] Accurate version references and links

#### CHANGELOG Validation  
- [ ] Proper semantic versioning
- [ ] Consistent versions within package groups
- [ ] Complete breaking change documentation
- [ ] Correct date formats and categorization

#### Cross-Package Consistency
- [ ] Meta-package dependency versions match constituent packages
- [ ] Synchronized packages have consistent version numbers
- [ ] Documentation reflects actual package capabilities
- [ ] **Bottom-up order maintained** - each README references accurate, updated child documentation
- [ ] **CHANGELOG → README order** respected at each level

## Critical Success Factors

### Order Compliance
**MUST follow this exact sequence:**
1. **CHANGELOG first, README second** for each package
2. **Bottom-up hierarchy** - children before parents
3. **Complete one level** before moving to the next

### Information Flow
- Each CHANGELOG captures changes at its level
- Each README's "What's New" reflects its own CHANGELOG
- Meta-package READMEs reference, don't duplicate, child content
- Version numbers flow upward through dependency chain

### Quality Checkpoints
After each level completion:
- [ ] CHANGELOGs are accurate and complete
- [ ] READMEs reflect CHANGELOG content
- [ ] **.csproj versions synchronized** (when updateVersions = true) - Version elements match CHANGELOG latest versions
- [ ] **PackageReference versions updated** (meta-packages only) - All referenced packages use latest versions
- [ ] References to child packages are accurate
- [ ] Version consistency maintained within groups

### Final Validation Process
After completing ALL documentation updates:
1. **Run validation checklists** from both readme.instructions.md and changelog.instructions.md
2. **Verify structure compliance** - Check that all templates are followed correctly
3. **Cross-reference consistency** - Ensure README "What's New" matches latest CHANGELOG entries
4. **Version synchronization validation** (when updateVersions = true):
   - [ ] All .csproj `<Version>` elements match CHANGELOG.md latest versions
   - [ ] Meta-package PackageReference versions reference latest constituent package versions
   - [ ] README version numbers match CHANGELOG latest versions
5. **Test all links and references** - Confirm all internal and external links work
6. **Review for accuracy** - Validate that changes reflect actual code modifications

## Usage in Prompts

### Basic Documentation Update
```
Follow updateDocs.instructions.md to update documentation for modified packages
```

### Documentation with Version Updates
```
Follow updateDocs.instructions.md with updateVersions: true
```

### Specific Focus
```
Update README files following updateDocs.instructions.md and readme.instructions.md
Update CHANGELOG files following updateDocs.instructions.md and changelog.instructions.md
```
