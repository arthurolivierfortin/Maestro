# FileBrowser Native Display Improvements

## Overview

Enhanced the FileBrowser component to accurately represent the native file system of the user's operating system, ensuring users see the same folder structure as in their native file explorer (Windows Explorer, macOS Finder, or Linux file managers).

## Date
January 2026

## Changes Made

### 1. Backend: Extended Special Folders (Cross-Platform)

**File:** `backend/src/Maestro.Infrastructure/Services/FileSystemBrowser.cs`

**Added support for all common special folders:**

| Folder | Windows | macOS | Linux |
|--------|---------|-------|-------|
| Home | ✅ | ✅ | ✅ |
| Desktop | ✅ | ✅ | ✅ |
| Documents | ✅ | ✅ | ✅ |
| **Downloads** | ✅ **NEW** | ✅ **NEW** | ✅ **NEW** |
| **Pictures** | ✅ **NEW** | ✅ **NEW** | ✅ **NEW** |
| **Music** | ✅ **NEW** | ✅ **NEW** | ✅ **NEW** |
| **Videos** | ✅ **NEW** | ✅ **NEW** | ✅ **NEW** |
| Dev folders | ✅ All shown | ✅ All shown | ✅ All shown |

**Key improvements:**
- Uses `Environment.SpecialFolder` for cross-platform compatibility
- Falls back to common path patterns when SpecialFolder unavailable (e.g., Downloads)
- Only adds folders that **actually exist** (no folder creation)
- Shows **ALL** development folders found, not just the first one
- Prevents duplicates with case-insensitive comparison

**Implementation:**
```csharp
// Helper to try multiple path patterns (e.g., Downloads, downloads)
void TryAddCommonPath(string displayName, string icon, params string[] pathPatterns)
{
    foreach (var pattern in pathPatterns)
    {
        if (Directory.Exists(pattern))
        {
            directories.Add(new CommonDirectoryInfo { ... });
            return; // Only add first match
        }
    }
}

// Example: Downloads folder
TryAddCommonPath("Downloads", "download",
    Path.Combine(userHome, "Downloads"),
    Path.Combine(userHome, "downloads")
);
```

### 2. Frontend: Show Hidden Folders

**File:** `frontend/src/components/Projects/FileBrowser.tsx`

**Changes:**
- **Removed** the filter `!d.isHidden` that was hiding all hidden folders
- **Added** visual styling for hidden folders (opacity, italic, gray text)
- **Added** "Hidden" badge for hidden folders

**Before:**
```typescript
{listing.directories
  .filter((d) => !d.isHidden)  // ❌ Hidden folders never shown
  .map((dir) => ...)}
```

**After:**
```typescript
{listing.directories.map((dir) => (
  <button
    className={`file-browser__item ${
      dir.isHidden ? 'file-browser__item--hidden' : ''
    }`}
  >
    {/* ... */}
    {dir.isHidden && (
      <span className="file-browser__item-badge--hidden">Hidden</span>
    )}
  </button>
))}
```

### 3. Frontend: Styling for Hidden Folders

**File:** `frontend/src/components/Projects/FileBrowser.scss`

**Added CSS:**
```scss
.file-browser__item {
  &--hidden {
    opacity: 0.6;
    font-style: italic;

    .file-browser__item-name {
      color: var(--text-muted, #6e7681);
    }
  }
}

.file-browser__item-badge {
  &--hidden {
    background-color: rgba(110, 118, 129, 0.3);
    color: #6e7681;
  }
}
```

**Visual effect:**
- Hidden folders appear dimmed (60% opacity)
- Names in gray italic text
- "Hidden" badge with gray background

### 4. Frontend: Improved Icon Mapping

**File:** `frontend/src/components/Projects/FileBrowser.tsx`

**Added new icon mappings:**
```typescript
dir.icon === 'download' ? '⬇️'    // Downloads folder
: dir.icon === 'image' ? '🖼️'     // Pictures folder
: dir.icon === 'music' ? '🎵'     // Music folder
: dir.icon === 'video' ? '🎬'     // Videos folder
: dir.icon === 'file-text' ? '📄' // Documents folder
```

## Platform-Specific Behavior

### Windows
- Shows all drives (C:, D:, etc.) when no path selected
- Quick Access includes: Home, Desktop, Documents, **Downloads, Pictures, Music, Videos**
- All existing development folders shown (Projects, Code, workspace, etc.)
- Hidden folders (e.g., AppData) shown with dimmed style

### macOS
- Shows `/` root and `~` home when no path selected
- Quick Access includes: Home, Desktop, Documents, **Downloads, Pictures, Music, Movies**
- Development folders: Projects, Code, workspace, repos, src, etc.
- Hidden folders (e.g., `.config`, `.local`) shown with dimmed style

### Linux
- Shows `/` root and `~` home when no path selected
- Quick Access includes: Home, Desktop, Documents, **Downloads, Pictures, Music, Videos**
- Development folders detected from common locations
- Hidden folders (e.g., `.config`, `.local`, `.cache`) shown with dimmed style

## User Experience Improvements

### Before
- Only 4 Quick Access folders: Home, Desktop, Documents, first dev folder
- Hidden folders completely invisible
- User couldn't navigate to important system folders
- Didn't match native file explorer

### After
- 7+ Quick Access folders: Home, Desktop, Documents, Downloads, Pictures, Music, Videos, all dev folders
- Hidden folders visible but clearly marked
- User can access all folders they can see in native explorer
- Matches native file explorer structure

## Testing Checklist

- [ ] Windows: Verify Downloads, Pictures, Music, Videos appear in Quick Access
- [ ] Windows: Verify hidden folders (AppData) are visible with gray styling
- [ ] Windows: Verify all drives (C:, D:) shown at root level
- [ ] macOS: Verify special folders appear correctly
- [ ] macOS: Verify hidden folders (`.config`) are visible
- [ ] Linux: Verify XDG directories appear
- [ ] Linux: Verify hidden folders (`.local`, `.cache`) are visible
- [ ] All: Verify only folders that exist are shown (no creation)
- [ ] All: Verify navigation works to all visible folders

## Breaking Changes

None. This is a **backward-compatible enhancement**. Existing functionality is preserved.

## Future Enhancements

1. **Toggle for hidden folders:** Add UI control to show/hide hidden folders
2. **Lucide-react icons:** Replace emoji icons with professional icon library
3. **Favorites/Bookmarks:** Allow users to pin frequently used folders
4. **Recent folders:** Track recently accessed folders
5. **Search:** Add search/filter for large directory listings
6. **Network locations:** Support SMB, NFS, OneDrive, iCloud Drive

## Related Files

- Backend: `backend/src/Maestro.Infrastructure/Services/FileSystemBrowser.cs`
- Frontend: `frontend/src/components/Projects/FileBrowser.tsx`
- Styles: `frontend/src/components/Projects/FileBrowser.scss`
- API: `backend/src/Maestro.Api/Controllers/FileSystemController.cs`
- DTOs: `backend/src/Maestro.Application/DTOs/DirectoryListingDto.cs`

## References

- Phase 8 Documentation: `docs/PHASE-8-PROJECT-CONTAINERS.md`
- .NET Environment.SpecialFolder: https://learn.microsoft.com/en-us/dotnet/api/system.environment.specialfolder
- XDG Base Directory Specification (Linux): https://specifications.freedesktop.org/basedir-spec/latest/
