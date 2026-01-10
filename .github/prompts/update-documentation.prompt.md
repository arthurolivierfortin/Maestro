---
mode: 'agent'
description: 'Update README.md, CHANGELOG.md, and versions for modified packages with complete synchronization'
---

# Update Documentation and Versions for Modified Packages

## MANDATORY PRE-EXECUTION STEPS (DO NOT SKIP)

**Before starting ANY work, you MUST:**

1. **Read instruction files in this order:**
   - `.github/instructions/updateDocs.instructions.md`
   - `.github/instructions/changelog.instructions.md`
   - `.github/instructions/readme.instructions.md`
   - These files define RULES you MUST follow

2. **Understand repository structure:**
   - **Individual packages:** `AppCore.X`, `AzureClients.X` (each has: README.md, CHANGELOG.md, X.csproj)
   - **Meta-packages:** `AppCore.Package`, `AzureClients.Package` (aggregate child packages with PackageReference)
   - **Root meta-package:** `AppCore.AzureImplementation` (aggregates all AppCore and AzureClients groups)

3. **Map the full package hierarchy:**
   ```
   AppCore.AzureImplementation (ROOT)
   ├── AppCore.Package (meta)
   │   ├── AppCore.Core
   │   ├── AppCore.Application
   │   ├── AppCore.Shared
   │   └── AppCore.Web
   └── AzureClients.Package (meta)
       ├── AzureClients.ActiveDirectory
       ├── AzureClients.KeyVault
       ├── AzureClients.PostgreSQL
       ├── AzureClients.StorageAccount.Core
       ├── AzureClients.StorageAccount.Application
       ├── AzureClients.Translator.Core
       └── AzureClients.Translator.Application
   ```

## Parameters:
- **updateVersions**: Set to `true` to increment package versions AND update ALL related files
  - When `false` or not specified: **Documentation content ONLY** (no version changes)
  - When `true`: **COMPLETE update** including versions, .csproj, PackageReferences, CHANGELOG versions

---

## EXECUTION CHECKLIST (Follow in EXACT order - DO NOT SKIP STEPS)

### STEP 1: Analyze Changed Packages
- [ ] Find last README update commit using git history
- [ ] Generate diff between that commit and HEAD
- [ ] Analyze commit messages (feat:, fix:, refactor:, BREAKING CHANGE)
- [ ] **List ALL modified packages** (you will use this list throughout)
- [ ] Categorize changes (features, fixes, breaking changes)

### STEP 2: Source Code Inspection (CRITICAL - DO NOT SKIP)
**For EACH modified package:**
- [ ] Read `.csproj` to see current version and dependencies
- [ ] Read `Services/`, `UseCases/`, `Controllers/` to get actual class/method names
- [ ] Read existing README.md to understand current structure
- [ ] Read existing CHANGELOG.md to understand entry format
- [ ] Note any interfaces, request objects, response objects mentioned in examples

### STEP 3: Individual Package Documentation Updates
**For EACH modified package (in dependency order: leaf packages first):**
- [ ] Update README.md following `readme.instructions.md` rules
- [ ] Verify class names match actual source code
- [ ] Verify method signatures match actual source code
- [ ] Verify examples are executable and correct
- [ ] If `updateVersions: true`: Determine version increment (major/minor/patch)
- [ ] If `updateVersions: true`: Update .csproj `<Version>` tag
- [ ] Update CHANGELOG.md following `changelog.instructions.md` rules
- [ ] Verify README version matches CHANGELOG latest version

### STEP 4: Meta-Package Updates (AppCore.Package, AzureClients.Package)
**For AppCore.Package:**
- [ ] Update README.md to reflect child package changes
- [ ] Update CHANGELOG.md with aggregated changes
- [ ] If `updateVersions: true`:
  - [ ] Update .csproj `<Version>` tag
  - [ ] Update ALL PackageReference versions for: AppCore.Core, AppCore.Application, AppCore.Shared, AppCore.Web
  - [ ] Ensure versions reference the LATEST versions from child packages

**For AzureClients.Package:**
- [ ] Update README.md to reflect child package changes
- [ ] Update CHANGELOG.md with aggregated changes
- [ ] If `updateVersions: true`:
  - [ ] Update .csproj `<Version>` tag
  - [ ] Update ALL PackageReference versions for: ActiveDirectory, KeyVault, PostgreSQL, StorageAccount.Core, StorageAccount.Application, Translator.Core, Translator.Application
  - [ ] Ensure versions reference the LATEST versions from child packages

### STEP 5: Root Meta-Package Update (AppCore.AzureImplementation)
- [ ] If `updateVersions: true`:
  - [ ] Update .csproj `<Version>` tag (bump to reflect changes in child meta-packages)
  - [ ] Update PackageReference versions for: AppCore.Package, AzureClients.Package
  - [ ] Use LATEST versions from both meta-packages
- [ ] Check if root README.md or CHANGELOG.md exists and update if present

### STEP 6: Final Validation
- [ ] All README.md files have version in metadata matching CHANGELOG latest entry
- [ ] All CHANGELOG.md files have consistent entry format
- [ ] No .csproj has mismatched PackageReference versions
- [ ] No broken package dependency chains (meta-packages reference correct child versions)
- [ ] All examples in READMEs match source code
- [ ] All class/method names are spelled correctly

---

## FILES TO UPDATE BY SCENARIO

### When updateVersions: false (Documentation only)
Update these files for EACH modified package:
```
<Package>/README.md          (content only, no version)
<Package>/CHANGELOG.md       (new entries, no version tags if not already present)
```

### When updateVersions: true (COMPLETE update)
Update THESE files for EACH modified package:
```
<Package>/README.md                          (content + version number)
<Package>/<Package>.csproj                   (update <Version> tag)
<Package>/CHANGELOG.md                       (new entries with version tag)
```

Additionally, update meta-packages:
```
AppCore.Package/README.md                    (aggregate AppCore package changes)
AppCore.Package/AppCore.Package.csproj       (update <Version>, update ALL PackageReference versions)
AppCore.Package/CHANGELOG.md                 (aggregate entries, update version)

AzureClients.Package/README.md               (aggregate AzureClients package changes)
AzureClients.Package/AzureClients.Package.csproj (update <Version>, update ALL PackageReference versions)
AzureClients.Package/CHANGELOG.md            (aggregate entries, update version)

AppCore.AzureImplementation/AppCore.AzureImplementation.csproj (update PackageReference for both meta-packages)
```

---

## VERSION SYNCHRONIZATION MATRIX (when updateVersions: true)

**AppCore group synchronization:**
| Package | Type | Updates |
|---------|------|---------|
| AppCore.Core | Individual | README, CHANGELOG, .csproj Version |
| AppCore.Application | Individual | README, CHANGELOG, .csproj Version |
| AppCore.Shared | Individual | README, CHANGELOG, .csproj Version |
| AppCore.Web | Individual | README, CHANGELOG, .csproj Version |
| **AppCore.Package** | **Meta** | **README, CHANGELOG, .csproj Version + ALL PackageReferences** |

**AzureClients group synchronization:**
| Package | Type | Updates |
|---------|------|---------|
| AzureClients.ActiveDirectory | Individual | README, CHANGELOG, .csproj Version |
| AzureClients.KeyVault | Individual | README, CHANGELOG, .csproj Version |
| AzureClients.PostgreSQL | Individual | README, CHANGELOG, .csproj Version |
| AzureClients.StorageAccount.Core | Individual | README, CHANGELOG, .csproj Version |
| AzureClients.StorageAccount.Application | Individual | README, CHANGELOG, .csproj Version |
| AzureClients.Translator.Core | Individual | README, CHANGELOG, .csproj Version |
| AzureClients.Translator.Application | Individual | README, CHANGELOG, .csproj Version |
| **AzureClients.Package** | **Meta** | **README, CHANGELOG, .csproj Version + ALL PackageReferences** |

**Root synchronization:**
| Package | Type | Updates |
|---------|------|---------|
| **AppCore.AzureImplementation** | **Root Meta** | **.csproj PackageReferences only** (AppCore.Package, AzureClients.Package) |

---

## COMMON MISTAKES TO AVOID (READ THIS CAREFULLY)

❌ **MISTAKE 1:** Updating only version numbers without updating READMEs
- **FIX:** Update both documentation AND versions together

❌ **MISTAKE 2:** Forgetting to update .csproj `<Version>` tag
- **FIX:** Check every package's .csproj for `<Version>` tag

❌ **MISTAKE 3:** Not updating PackageReference versions in meta-packages
- **FIX:** In AppCore.Package.csproj, update ALL PackageReference versions
- **FIX:** In AzureClients.Package.csproj, update ALL PackageReference versions
- **FIX:** In AppCore.AzureImplementation.csproj, update AppCore.Package and AzureClients.Package references

❌ **MISTAKE 4:** Forgetting to update CHANGELOG.md
- **FIX:** Create new version entries in CHANGELOG for each package

❌ **MISTAKE 5:** Version mismatch between README and CHANGELOG
- **FIX:** README version must match latest CHANGELOG version

❌ **MISTAKE 6:** Not reading instruction files
- **FIX:** Read updateDocs.instructions.md, changelog.instructions.md, readme.instructions.md BEFORE starting

❌ **MISTAKE 7:** Not inspecting source code
- **FIX:** Verify all class/method names from source code, not assumptions

❌ **MISTAKE 8:** Updating meta-package versions to same as child versions
- **FIX:** Meta-packages may have different versions (usually higher) based on their own changes

❌ **MISTAKE 9:** Forgetting to update root AppCore.AzureImplementation
- **FIX:** When child meta-packages change, root PackageReferences must update

❌ **MISTAKE 10:** Incomplete package hierarchy updates
- **FIX:** Update bottom-up: individual packages → meta-packages → root meta-package

---

## GIT ANALYSIS COMMANDS

**Find last README update commit:**
```bash
git log --oneline --grep="docs:" --grep="README" --grep="documentation" -i --since="3 months ago" | head -1
```

**Get targeted diff since last README update:**
```bash
git diff <last-readme-commit-hash>..HEAD --name-status
git diff <last-readme-commit-hash>..HEAD
```

**Analyze commit messages for change types:**
```bash
git log --oneline <last-readme-commit-hash>..HEAD
git log --grep="feat:" --grep="fix:" --grep="refactor:" <last-readme-commit-hash>..HEAD
```

---

## COMMIT MESSAGE TO CHANGELOG MAPPING

| Commit Type | CHANGELOG Section | Version Impact |
|-------------|------------------|-----------------|
| `feat:` | Added | Minor bump |
| `fix:` | Fixed | Patch bump |
| `refactor:` | Changed | Patch or Minor |
| `perf:` | Changed | Patch or Minor |
| `docs:` | *(no update unless content change)* | No bump |
| `BREAKING CHANGE` or `!` | Breaking Changes | Major bump |

---

## STEP-BY-STEP EXAMPLE (updateVersions: true)

**Example: Fix in AzureClients.Translator.Core**

1. **Individual Package:**
   - [ ] Read TranslatorTextTranslationService.cs to verify method names
   - [ ] Update README.md with fix description (e.g., "Fixed caching issue")
   - [ ] Update .csproj: `<Version>0.3.1</Version>` (patch bump)
   - [ ] Update CHANGELOG.md: Add "## [0.3.1] - 2024-01-09" section with fix entry

2. **Meta-Package AzureClients.Package:**
   - [ ] Update README.md: Note Translator.Core fix
   - [ ] Update .csproj: 
     - `<Version>0.4.1</Version>` (aggregate version)
     - `<PackageReference Include="AzureClients.Translator.Core" Version="0.3.1" />` (match child version)
   - [ ] Update CHANGELOG.md: Add entry noting Translator.Core fix

3. **Root AppCore.AzureImplementation:**
   - [ ] Update .csproj:
     - `<PackageReference Include="AzureClients.Package" Version="0.4.1" />` (match meta-package version)

---

## FINAL VALIDATION CHECKLIST

Before declaring the task complete, verify ALL of these:

- [ ] All modified packages have updated README.md
- [ ] All modified packages have updated CHANGELOG.md
- [ ] All README.md files have correct version numbers (if updateVersions: true)
- [ ] All .csproj files have correct Version tags (if updateVersions: true)
- [ ] All PackageReference versions in .csproj files match their target package versions (if updateVersions: true)
- [ ] No typos in class names or method signatures
- [ ] All examples in READMEs are functional and match source code
- [ ] All CHANGELOG entries follow the correct format
- [ ] Meta-packages have been updated to reflect child package changes
- [ ] Root meta-package references are current
- [ ] No broken package dependency chains
- [ ] All version numbers follow semantic versioning (MAJOR.MINOR.PATCH)
- [ ] README versions match CHANGELOG latest versions

---

## Output Format

Provide a summary with:
- **Packages Modified:** List all packages updated with their scope (individual/meta/root)
- **Version Changes:** (if updateVersions: true)
  - Old version → New version for each package
  - Reason for bump (feat, fix, breaking change)
- **Documentation Changes:** 
  - Key additions/updates to READMEs
  - CHANGELOG entry summaries
- **Validation Results:**
  - Any issues found and how they were resolved
  - Confirmation that all files are synchronized
